"""Job catalog, recommendations, and saved jobs."""
import logging
import threading
import time
import uuid
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends

from app.agents.providers.routing import preferred_llm_providers
from app.api.schemas import (
    JobRecommendationGenerate,
    SavedJobPatch,
)
from app.api.support import (
    utc_now,
)
from app.core.config import Settings, get_settings
from app.core.errors import ApiError
from app.database.repository import (
    client_for,
    owned_row,
    owned_rows,
    sort_rows_by_recency,
    write_activity,
)
from app.features.auth.service import (
    CurrentUser,
    get_current_user,
)
from app.features.career_matching import (
    ALGORITHM_VERSION as CAREER_MATCH_ALGORITHM_VERSION,
)
from app.features.career_matching import (
    _infer_work_mode,
    candidate_skill_evidence,
    score_job,
)
from app.features.job_agent import rank_jobs_with_agent

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/jobs")
def list_jobs(user: CurrentUser = Depends(get_current_user), settings: Settings = Depends(get_settings)):
    client = client_for(settings, user)
    jobs = (
        client
        .table("jobs")
        .select("*")
        .order("created_at", desc=True)
        .execute()
        .data
        or []
    )
    return _with_application_counts(client, jobs)


_external_sync_lock = __import__("threading").Lock()
_external_sync_last: dict[str, float] = {}
_EXTERNAL_SYNC_COOLDOWN_SECONDS = 60.0

_recommendation_generation_lock = threading.Lock()
_recommendation_generation_by_user: dict[str, int] = {}


def _with_application_counts(client: Any, jobs: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Attach distinct tracked applicants without exposing who applied."""
    if not jobs:
        return jobs
    job_ids = {str(row.get("id")) for row in jobs if row.get("id")}
    rows = client.table("saved_jobs").select("job_id,user_id,status").execute().data or []
    applicants: dict[str, set[str]] = {}
    for row in rows:
        job_id = str(row.get("job_id") or "")
        status = str(row.get("status") or "").casefold()
        user_id = str(row.get("user_id") or "")
        if job_id in job_ids and user_id and status in {"applied", "interviewing", "offer"}:
            applicants.setdefault(job_id, set()).add(user_id)
    return [{**job, "application_count": len(applicants.get(str(job.get("id")), set()))} for job in jobs]


@router.post("/jobs/external/sync")
def sync_external_jobs(
    user: CurrentUser = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
):

    from app.features.ai_job_search import AiJobSearchClient

    now = time.monotonic()
    last = _external_sync_last.get(str(user.id), 0.0)
    if now - last < _EXTERNAL_SYNC_COOLDOWN_SECONDS:
        raise ApiError(
            429,
            "jobs_sync_cooldown",
            f"Wait {int(_EXTERNAL_SYNC_COOLDOWN_SECONDS - (now - last))}s before syncing external jobs again.",
        )
    if not _external_sync_lock.acquire(blocking=False):
        raise ApiError(429, "jobs_sync_busy", "An external job sync is already running. Try again shortly.")
    try:
        client = client_for(settings, user)
        prefs_rows = (
            client.table("candidate_preferences")
            .select("target_roles,locations")
            .eq("user_id", str(user.id))
            .limit(1)
            .execute()
            .data
            or []
        )
        prefs = prefs_rows[0] if prefs_rows else {}
        target_roles = [str(r).strip() for r in (prefs.get("target_roles") or []) if str(r).strip()]
        locations = [str(loc).strip() for loc in (prefs.get("preferred_locations") or prefs.get("locations") or []) if str(loc).strip()]
        fetched_by_source: list[tuple[str, list[dict[str, Any]]]] = []
        if getattr(settings, "freehire_enabled", True):
            job_search = AiJobSearchClient(
                getattr(settings, "freehire_api_url", "https://freehire.me"),
                timeout_seconds=getattr(settings, "freehire_timeout_seconds", 15.0),
            )
            fetched_by_source.append(("freehire", job_search.search_jobs(
                target_roles=target_roles,
                locations=locations,
                results_per_page=getattr(settings, "freehire_results_per_page", 25),
                max_days_old=getattr(settings, "freehire_max_days_old", 30),
            )))
        if not fetched_by_source:
            raise ApiError(503, "job_sources_not_configured", "No external job source is configured.")
        fetched = [job for _, rows in fetched_by_source for job in rows]
        existing_rows = client.table("jobs").select("id,external_id,source").execute().data or []
        existing_by_external = {
            f"{row.get('source') or 'freehire'}:{str(row.get('external_id') or '').strip()}": str(row.get("id"))
            for row in existing_rows
            if str(row.get("external_id") or "").strip()
        }
        created = 0
        updated = 0
        stamp = utc_now()
        for source, jobs_for_source in fetched_by_source:
            for job in jobs_for_source:
                external_id = str(job.get("external_id") or "").strip()
                if not external_id:
                    continue
                payload = {
                    "source": source,
                    "external_id": external_id,
                    "title": job.get("title") or "Unknown Title",
                    "company": job.get("company") or "Unknown Company",
                    "location": job.get("location"),
                    "description": job.get("description") or "",
                    "application_url": job.get("application_url"),
                    "salary_min": job.get("salary_min"),
                    "salary_max": job.get("salary_max"),
                    "published_at": job.get("published_at") or stamp,
                    "latitude": job.get("latitude"),
                    "longitude": job.get("longitude"),
                    "is_active": True,
                    "requirements": job.get("requirements") or [],
                    # Persist source-inferred mode so filters and UI cards stay in sync.
                    "work_mode": job.get("work_mode"),
                    "updated_at": stamp,
                }
                existing_id = existing_by_external.get(f"{payload['source']}:{external_id}")
                if existing_id:
                    client.table("jobs").update(payload).eq("id", existing_id).execute()
                    updated += 1
                else:
                    new_id = str(uuid.uuid4())
                    client.table("jobs").insert({**payload, "id": new_id, "created_at": stamp}).execute()
                    existing_by_external[f"{payload['source']}:{external_id}"] = new_id
                    created += 1
        _external_sync_last[str(user.id)] = time.monotonic()
        write_activity(
            client,
            user,
            "jobs_external_synced",
            f"Synced {created + updated} external jobs ({created} new, {updated} updated)",
            "jobs",
            None,
        )
        return {
            "workflow": AiJobSearchClient.workflow,
            "providers": [source for source, _ in fetched_by_source],
            "configured": bool(fetched_by_source),
            "fetched": len(fetched),
            "created": created,
            "updated": updated,
            "roles": target_roles,
            "locations": locations,
        }
    finally:
        _external_sync_lock.release()


@router.get("/jobs/{job_id}")
def get_job(
    job_id: UUID, user: CurrentUser = Depends(get_current_user), settings: Settings = Depends(get_settings)
):
    rows = (
        client_for(settings, user)
        .table("jobs")
        .select("*")
        .eq("id", str(job_id))
        .eq("is_active", True)
        .limit(1)
        .execute()
        .data
        or []
    )
    if not rows:
        raise ApiError(404, "job_not_found", "The job was not found.")
    return rows[0]


@router.get("/job-recommendations")
def list_job_recommendations(
    user: CurrentUser = Depends(get_current_user), settings: Settings = Depends(get_settings)
):
    client = client_for(settings, user)
    rows = owned_rows(client, "job_recommendations", user, "generated_at")
    jobs = (
        client.table("jobs")
        .select("*")
        .in_("id", [row["job_id"] for row in rows])
        .execute()
        .data
        if rows
        else []
    )
    by_id = {str(job["id"]): job for job in jobs}
    return [{**row, "job": by_id.get(str(row.get("job_id")))} for row in rows]


@router.post("/job-recommendations/generate")
async def generate_job_recommendations(
    payload: JobRecommendationGenerate,
    user: CurrentUser = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
):
    """Score active local job records against the candidate's confirmed resume evidence."""
    client = client_for(settings, user)
    user_key = str(user.id)
    with _recommendation_generation_lock:
        generation = _recommendation_generation_by_user.get(user_key, 0) + 1
        _recommendation_generation_by_user[user_key] = generation
    if payload.resume_version_id:
        version = owned_row(client, "resume_versions", payload.resume_version_id, user)
        if version.get("extraction_status") != "confirmed":
            raise ApiError(
                409,
                "confirmed_resume_required",
                "Confirm the extracted resume before generating job recommendations.",
            )
    else:
        active = client.table("resumes").select("id,title").eq("user_id", str(user.id)).eq("is_active", True).is_("deleted_at", "null").limit(1).execute().data or []
        if not active:
            raise ApiError(409, "active_resume_required", "Activate a confirmed resume before generating job recommendations.")
        versions = (
            client.table("resume_versions")
            .select("*")
            .eq("resume_id", active[0]["id"])
            .eq("user_id", str(user.id))
            .eq("extraction_status", "confirmed")
            .execute()
            .data
            or []
        )
        versions = sort_rows_by_recency(versions, desc=True)[:1]
        if not versions:
            raise ApiError(409, "confirmed_resume_required", "Confirm the extracted resume before generating job recommendations.")
        version = versions[0]
    resume = owned_row(client, "resumes", version["resume_id"], user)
    if resume.get("deleted_at"):
        raise ApiError(409, "resume_deleted", "The selected resume was deleted. Activate another resume first.")
    skills, evidence_text = candidate_skill_evidence(client, str(user.id), resume, version)
    jobs = (
        client.table("jobs")
        .select("*")
        .order("created_at", desc=True)
        .limit(500)
        .execute()
        .data
        or []
    )
    jobs = _with_application_counts(client, jobs)
    if payload.location:
        needle = payload.location.casefold()
        jobs = [job for job in jobs if needle in str(job.get("location") or "").casefold()]
    if payload.work_mode:
        needle = payload.work_mode.casefold()
        jobs = [
            job
            for job in jobs
            if needle in str(job.get("work_mode") or _infer_work_mode(job) or "").casefold()
        ]
    if payload.salary_min is not None:
        jobs = [
            job
            for job in jobs
            if (
                job.get("salary_max") is not None
                and float(job.get("salary_max") or 0) >= float(payload.salary_min)
            )
            or (
                job.get("salary_max") is None
                and job.get("salary_min") is not None
                and float(job.get("salary_min") or 0) >= float(payload.salary_min)
            )
        ]
    deterministic_ranked = sorted(
        (score_job(job, skills, evidence_text) for job in jobs),
        key=lambda row: row["match_score"],
        reverse=True,
    )
    profile_rows = client.table("profiles").select(
        "full_name,bio,location,target_role,years_experience"
    ).eq("id", str(user.id)).limit(1).execute().data or []
    preference_rows = client.table("candidate_preferences").select("*").eq(
        "user_id", str(user.id)
    ).limit(1).execute().data or []
    candidate_profile = {
        "profile": profile_rows[0] if profile_rows else {},
        "preferences": preference_rows[0] if preference_rows else {},
        "skills": sorted(skills),
        "confirmed_evidence": evidence_text[:12_000],
    }
    agent_status: dict[str, Any] = {"mode": "evidence", "provider": None}
    ranked = deterministic_ranked
    if preferred_llm_providers(settings):
        try:
            agent_result, provider = await rank_jobs_with_agent(
                settings,
                candidate=candidate_profile,
                jobs=[row["job"] for row in deterministic_ranked[:24]],
            )
            decisions = {str(item["job_id"]): item for item in agent_result["evaluations"]}
            for row in ranked:
                decision = decisions.get(str(row["job"]["id"]))
                if not decision:
                    continue
                row["match_score"] = decision["score"]
                row["match_breakdown"] = {
                    **row["match_breakdown"],
                    "matched_requirements": decision["strengths"],
                    "missing_requirements": decision["gaps"],
                    "verdict": decision["verdict"],
                    "rationale": decision["rationale"],
                }
                row["evidence"] = {
                    **row["evidence"],
                    "method": "llm-job-fit-v1",
                    "provider": provider,
                    "agent": "job_matching",
                }
            ranked.sort(key=lambda row: row["match_score"], reverse=True)
            agent_status = {"mode": "agent", "provider": provider}
        except ApiError as exc:
            agent_status = {
                "mode": "evidence_fallback",
                "provider": None,
                "error": getattr(exc, "code", "llm_generation_failed"),
            }
    page = ranked[payload.offset : payload.offset + payload.limit]
    # Always clear prior recommendations for this resume version before writing a page
    # so offset>0 pagination cannot accumulate duplicate (user, resume, job) rows.
    recommendations = []
    with _recommendation_generation_lock:
        if _recommendation_generation_by_user.get(user_key) != generation:
            recommendations = [{**row, "job": row["job"]} for row in page]
        else:
            if payload.offset == 0:
                client.table("job_recommendations").delete().eq("user_id", str(user.id)).eq(
                    "resume_version_id", str(version["id"])
                ).execute()
            for row in page:
                job_id = str(row["job"]["id"])
                client.table("job_recommendations").delete().eq("user_id", str(user.id)).eq(
                    "resume_version_id", str(version["id"])
                ).eq("job_id", job_id).execute()
                stored = client.table("job_recommendations").insert({
                    "user_id": str(user.id),
                    "job_id": job_id,
                    "resume_version_id": str(version["id"]),
                    "match_score": row["match_score"],
                    "match_breakdown": row["match_breakdown"],
                    "evidence": row["evidence"],
                    "algorithm_version": CAREER_MATCH_ALGORITHM_VERSION,
                }).execute().data[0]
                recommendations.append({**stored, "job": row["job"]})
    return {
        "resume_version_id": version["id"],
        "algorithm_version": CAREER_MATCH_ALGORITHM_VERSION,
        "recommendations": recommendations,
        "candidate_evidence": sorted(skills),
        "agent": agent_status,
    }


@router.get("/saved-jobs")
def list_saved_jobs(
    user: CurrentUser = Depends(get_current_user), settings: Settings = Depends(get_settings)
):
    client = client_for(settings, user)
    rows = (
        client.table("saved_jobs")
        .select("*")
        .eq("user_id", str(user.id))
        .execute()
        .data
        or []
    )
    rows.sort(
        key=lambda row: str(row.get("updated_at") or row.get("saved_at") or ""),
        reverse=True,
    )
    job_ids = [str(row.get("job_id")) for row in rows if row.get("job_id")]
    jobs = (
        client.table("jobs")
        .select("*")
        .in_("id", job_ids)
        .execute()
        .data
        if job_ids
        else []
    )
    by_id = {str(job["id"]): job for job in (jobs or [])}
    output = []
    for row in rows:
        job = by_id.get(str(row.get("job_id")))
        item = dict(row)
        item["jobs"] = job
        if job:
            for key in ("title", "company", "location", "work_mode", "url", "source"):
                if not item.get(key) and job.get(key):
                    item[key] = job.get(key)
        output.append(item)
    return output


@router.post("/saved-jobs/{job_id}", status_code=201)
def save_job(
    job_id: UUID, user: CurrentUser = Depends(get_current_user), settings: Settings = Depends(get_settings)
):
    """Bookmark a job as saved without downgrading applied/interview/offer tracking."""
    client = client_for(settings, user)
    job = (
        client.table("jobs")
        .select("id,title,company,location,work_mode,url,source")
        .eq("id", str(job_id))
        .limit(1)
        .execute()
        .data
        or []
    )
    if not job:
        raise ApiError(404, "job_not_found", "The job was not found.")
    job_info = job[0]
    existing = (
        client.table("saved_jobs")
        .select("*")
        .eq("user_id", str(user.id))
        .eq("job_id", str(job_id))
        .limit(1)
        .execute()
        .data
        or []
    )
    # Keep pipeline progress if the candidate already marked applied/interview/offer.
    protected = {"applied", "interviewing", "offer"}
    if existing and str(existing[0].get("status") or "") in protected:
        return existing[0]
    stamp = utc_now()
    payload = {
        "user_id": str(user.id),
        "job_id": str(job_id),
        "title": job_info.get("title"),
        "company": job_info.get("company"),
        "location": job_info.get("location"),
        "work_mode": job_info.get("work_mode"),
        "url": job_info.get("url"),
        "source": job_info.get("source"),
        "status": "saved",
        "saved_at": (existing[0].get("saved_at") if existing else None) or stamp,
    }
    if existing and existing[0].get("id"):
        payload["id"] = existing[0]["id"]
    result = client.table("saved_jobs").upsert(payload).execute().data[0]
    write_activity(client, user, "job_saved", "Job saved", "job", str(job_id))
    return result


@router.patch("/saved-jobs/{job_id}")
def patch_saved_job(
    job_id: UUID,
    payload: SavedJobPatch,
    user: CurrentUser = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
):
    """Update tracking status (saved / applied / rejected / dismissed / …). Creates the row if needed."""
    client = client_for(settings, user)
    job = (
        client.table("jobs")
        .select("id,title,company,location,work_mode,url,source")
        .eq("id", str(job_id))
        .limit(1)
        .execute()
        .data
        or []
    )
    if not job:
        raise ApiError(404, "job_not_found", "The job was not found.")
    job_info = job[0]
    stamp = utc_now()
    body = payload.model_dump(exclude_unset=True)
    existing = (
        client.table("saved_jobs")
        .select("id,saved_at,status,title,company,location,work_mode,url,source")
        .eq("user_id", str(user.id))
        .eq("job_id", str(job_id))
        .limit(1)
        .execute()
        .data
        or []
    )
    prev = existing[0] if existing else {}
    row = {
        "user_id": str(user.id),
        "job_id": str(job_id),
        "title": prev.get("title") or job_info.get("title"),
        "company": prev.get("company") or job_info.get("company"),
        "location": prev.get("location") or job_info.get("location"),
        "work_mode": prev.get("work_mode") or job_info.get("work_mode"),
        "url": prev.get("url") or job_info.get("url"),
        "source": prev.get("source") or job_info.get("source"),
        **body,
        "saved_at": prev.get("saved_at") or stamp,
    }
    if prev and prev.get("id"):
        row["id"] = prev["id"]
    result = client.table("saved_jobs").upsert(row).execute().data or []
    if not result:
        raise ApiError(404, "saved_job_not_found", "The job could not be tracked on your account.")
    status = str(result[0].get("status") or body.get("status") or "saved")
    activity_map = {
        "applied": ("job_applied", "Marked job as applied"),
        "rejected": ("job_rejected", "Marked job as rejected"),
        "dismissed": ("job_dismissed", "Dismissed job recommendation"),
        "saved": ("job_saved", "Job saved"),
        "withdrawn": ("job_withdrawn", "Withdrew job application"),
        "interviewing": ("job_interviewing", "Marked job as interviewing"),
        "offer": ("job_offer", "Marked job as offer"),
    }
    event, summary = activity_map.get(status, ("job_status_updated", f"Updated job status to {status}"))
    write_activity(client, user, event, summary, "job", str(job_id))
    return result[0]


@router.delete("/saved-jobs/{job_id}", status_code=204)
def unsave_job(
    job_id: UUID, user: CurrentUser = Depends(get_current_user), settings: Settings = Depends(get_settings)
):
    client = client_for(settings, user)
    result = client.table("saved_jobs").delete().eq("job_id", str(job_id)).eq("user_id", str(user.id)).execute()
    if result.data:
        write_activity(client, user, "job_unsaved", "Job removed from saved jobs", "job", str(job_id))

