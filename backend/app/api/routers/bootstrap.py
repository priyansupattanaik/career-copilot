"""Workspace bootstrap payload."""
import logging
import time
from concurrent.futures import ThreadPoolExecutor
from typing import Any

from fastapi import APIRouter, Depends, Query

from app.agents.registry import agents_status
from app.core.config import Settings, get_settings
from app.database.repository import (
    client_for,
    list_recent_activity,
    row_recency_key,
    sort_rows_by_recency,
)
from app.features.auth.service import (
    CurrentUser,
    get_current_user,
)
from app.features.profile.avatars import (
    attach_avatar_url,
)

router = APIRouter()
logger = logging.getLogger(__name__)
_bootstrap_cache: dict[str, tuple[float, dict[str, Any]]] = {}
_bootstrap_cache_ttl = 5.0

@router.get("/me/bootstrap")
def bootstrap(
    scope: str = Query(default="full", pattern="^(full|shell)$"),
    user: CurrentUser = Depends(get_current_user), settings: Settings = Depends(get_settings)
) -> dict[str, Any]:
    client = client_for(settings, user)
    # Bootstrap is a read endpoint. Completion is recalculated after mutations;
    # never perform cleanup or writes while loading a page.
    uid = str(user.id)
    # Cache per user/scope for 5s to avoid hammering the database on every navigation
    cache_key = f"{uid}:{scope}"
    now = time.time()
    if cache_key in _bootstrap_cache:
        ts, cached = _bootstrap_cache[cache_key]
        if now - ts < _bootstrap_cache_ttl:
            return cached

    def _read_profile():
        return (
            client.table("profiles")
            .select("id,username,full_name,avatar_url,avatar_path,profile_completion,profile_completion_details")
            .eq("id", uid)
            .limit(1)
            .execute()
        )

    def _read_active_resume():
        return (
            client.table("resumes")
            .select("id,title")
            .eq("user_id", uid)
            .eq("is_active", True)
            .is_("deleted_at", "null")
            .limit(1)
            .execute()
        )

    def _read_confirmed_resume():
        versions = (
            client.table("resume_versions")
            .select("resume_id")
            .eq("user_id", uid)
            .eq("extraction_status", "confirmed")
            .execute()
        )
        version_rows = versions.data or []
        if not version_rows:
            return 0
        resume_ids = {str(row.get("resume_id")) for row in version_rows if row.get("resume_id")}
        active = (
            client.table("resumes")
            .select("id")
            .eq("user_id", uid)
            .is_("deleted_at", "null")
            .in_("id", list(resume_ids))
            .execute()
            .data
            or []
        )
        return sum(1 for row in active if str(row.get("id")) in resume_ids)

    def _read_latest_jd():
        latest = (
            client.table("job_descriptions")
            .select("id,title,company,role_title,created_at")
            .eq("user_id", uid)
            # Keep ordering client-side: this user-scoped query must also work
            # before the optional composite index is provisioned.
            .order("created_at", desc=True)
            .limit(1)
            .execute()
            .data
            or []
        )
        if latest:
            return latest
        # Legacy rows may omit created_at; retain the old correctness fallback.
        rows = (
            client.table("job_descriptions")
            .select("id,title,company,role_title,created_at")
            .eq("user_id", uid)
            .execute()
            .data
            or []
        )
        return sort_rows_by_recency(rows, desc=True)[:1]

    def _read_latest_analysis():
        latest = (
            client.table("ats_analyses")
            .select("id,overall_score,status,created_at,started_at,completed_at,score_breakdown,summary")
            .eq("user_id", uid)
            .eq("status", "completed")
            # Keep ordering client-side for the same index-independent path.
            .order("completed_at", desc=True)
            .limit(1)
            .execute()
            .data
            or []
        )
        if latest:
            return latest
        rows = (
            client.table("ats_analyses")
            .select("id,overall_score,status,created_at,started_at,completed_at,score_breakdown,summary")
            .eq("user_id", uid)
            .eq("status", "completed")
            .execute()
            .data
            or []
        )
        return sort_rows_by_recency(rows, desc=True, preferred="completed_at")[:1]

    if scope == "shell":
        with ThreadPoolExecutor(max_workers=2, thread_name_prefix="bootstrap-shell") as executor:
            profile_future = executor.submit(_read_profile)
            active_resume_future = executor.submit(_read_active_resume)
            profile = (profile_future.result().data or [{}])[0]
            active_resume = active_resume_future.result().data or []
        result = {
            "profile": attach_avatar_url(profile, client, settings),
            "active_resume": active_resume[0] if active_resume else None,
            "workspace": {
                "profile_completion": max(0, min(100, int(profile.get("profile_completion") or 0))),
                "profile_completion_details": profile.get("profile_completion_details") or {},
                "profile_missing": [
                    item
                    for item in ((profile.get("profile_completion_details") or {}).get("missing") or [])
                    if isinstance(item, dict) and item.get("key") and item.get("label")
                    and str(item.get("key")) != "resume"
                ],
                "has_active_resume": bool(active_resume),
            },
        }
        _bootstrap_cache[cache_key] = (time.time(), result)
        return result

    def _count(table: str, *, deleted_only: bool = False, failed_only: bool = False) -> int:
        query = client.table(table).select("*", count="exact", head=True).eq("user_id", uid)
        if deleted_only:
            query = query.is_("deleted_at", "null")
        if failed_only:
            query = query.eq("status", "failed")
        return query.execute().count or 0

    count_jobs = {
        "resumes": ("resumes", True, False),
        "ats_analyses": ("ats_analyses", False, False),
        "interviews": ("interview_sessions", False, False),
        "learning_paths": ("learning_paths", False, False),
        "saved_jobs": ("saved_jobs", False, False),
        "failed_ats": ("ats_analyses", False, True),
    }

    with ThreadPoolExecutor(max_workers=14, thread_name_prefix="bootstrap") as executor:
        futures = {
            "profile": executor.submit(_read_profile),
            "active_resume": executor.submit(_read_active_resume),
            "confirmed_resume": executor.submit(_read_confirmed_resume),
            "latest_jd": executor.submit(_read_latest_jd),
            "latest_analysis": executor.submit(_read_latest_analysis),
            "recent_activity": executor.submit(list_recent_activity, client, user),
            "latest_actions": executor.submit(_latest_actions, client, user),
            "interview_progress": executor.submit(_interview_progress, client, user),
        }
        count_futures = {
            key: executor.submit(_count, table, deleted_only=deleted_only, failed_only=failed_only)
            for key, (table, deleted_only, failed_only) in count_jobs.items()
        }
        profile = (futures["profile"].result().data or [{}])[0]
        active_resume = futures["active_resume"].result().data or []
        confirmed_resume_count = futures["confirmed_resume"].result()
        latest_jd = futures["latest_jd"].result() or []
        latest_analysis = futures["latest_analysis"].result() or []
        recent_activity = futures["recent_activity"].result()
        latest_actions = futures["latest_actions"].result()
        interview_progress = futures["interview_progress"].result()
        counts = {
            key: count_futures[key].result()
            for key in ("resumes", "ats_analyses", "interviews", "learning_paths", "saved_jobs")
        }
        failed_ats = count_futures["failed_ats"].result()
    result = {
        "profile": attach_avatar_url(profile, client, settings),
        "active_resume": active_resume[0] if active_resume else None,
        "active_job_description": latest_jd[0] if latest_jd else None,
        "latest_ats_analysis": latest_analysis[0] if latest_analysis else None,
        "latest_actions": latest_actions,
        "interview_progress": interview_progress,
        "counts": counts,
        "recent_activity": recent_activity,
        "workspace": {
            "profile_completion": max(
                0, min(100, int(profile.get("profile_completion") or 0))
            ),
            "profile_completion_details": profile.get("profile_completion_details") or {},
            # Server checklist only — never include retired criteria (e.g. old "resume" weight).
            "profile_missing": [
                item
                for item in (
                    (profile.get("profile_completion_details") or {}).get("missing") or []
                )
                if isinstance(item, dict)
                and item.get("key")
                and item.get("label")
                and str(item.get("key")) != "resume"
            ],
            "has_active_resume": bool(active_resume),
            "has_confirmed_resume": bool(confirmed_resume_count),
            "failed_ats_count": failed_ats,
            "ready_for_ats": bool(confirmed_resume_count) and bool(latest_jd),
        },
        "capabilities": {
            "ats_scoring": True,
            "interview_evaluation": True,
            "interview_questions": True,  # Groq when configured; templates otherwise
            "interview_questions_ai": settings.groq_configured,
            "interview_evaluation_ai": settings.groq_configured,
            "resume_improvements": settings.nvidia_configured or settings.groq_configured,
            "profile_fill_ai": settings.nvidia_configured or settings.groq_configured,
            "ats_improvement_brief_ai": settings.nvidia_configured or settings.groq_configured,
            "job_recommendations": True,
            "nvidia_configured": settings.nvidia_configured,
            "groq_configured": settings.groq_configured,
        },
        "agents": agents_status(settings),
    }
    _bootstrap_cache[cache_key] = (time.time(), result)
    return result


def _safe_score(value: Any) -> int | None:
    """Coerce a report score to an int 0–100, or None when missing/invalid."""
    if value is None or value == "":
        return None
    try:
        score = int(round(float(value)))
    except (TypeError, ValueError):
        return None
    return max(0, min(100, score))


def _interview_progress(client, user: CurrentUser) -> dict[str, Any]:
    """
    Aggregate mock-interview scores for dashboard charts.

    Joins interview_reports with sessions so the UI can plot improvement over time
    without N+1 report fetches. Never raises — empty history is a valid state.
    """
    empty = {
        "sessions_total": 0,
        "sessions_completed": 0,
        "sessions_with_scores": 0,
        "latest_overall": None,
        "previous_overall": None,
        "delta": None,
        "best_overall": None,
        "average_overall": None,
        "trend": "none",
        "history": [],
        "dimensions": {
            "communication": {"latest": None, "previous": None, "average": None},
            "structure": {"latest": None, "previous": None, "average": None},
            "content": {"latest": None, "previous": None, "average": None},
            "eye_contact": {"latest": None, "previous": None, "average": None},
        },
    }
    uid = str(user.id)
    try:
        sessions = (
            client.table("interview_sessions")
            .select(
                "id,mode,target_role,target_company,status,created_at,completed_at,started_at"
            )
            .eq("user_id", uid)
            .execute()
            .data
            or []
        )
        reports = (
            client.table("interview_reports")
            .select(
                "id,session_id,overall_score,communication_score,structure_score,"
                "content_score,created_at,status,report"
            )
            .eq("user_id", uid)
            .execute()
            .data
            or []
        )
    except Exception:
        return empty

    def _score_from_report(report: dict[str, Any], key: str) -> int | None:
        """Prefer top-level score columns; fall back to nested report JSON."""
        direct = _safe_score(report.get(key))
        if direct is not None:
            return direct
        nested = report.get("report") if isinstance(report.get("report"), dict) else {}
        return _safe_score(nested.get(key))

    def _eye_from_report(report: dict[str, Any]) -> int | None:
        nested = report.get("report") if isinstance(report.get("report"), dict) else {}
        gaze = nested.get("gaze_summary") if isinstance(nested.get("gaze_summary"), dict) else {}
        return _safe_score(gaze.get("average_eye_contact_score"))

    sessions_total = len(sessions)
    sessions_completed = sum(1 for row in sessions if row.get("status") == "completed")
    session_by_id = {str(row.get("id")): row for row in sessions if row.get("id")}

    # Keep the newest report per session (created_at preferred).
    best_report_by_session: dict[str, dict[str, Any]] = {}
    for report in sort_rows_by_recency(reports, desc=True, preferred="created_at"):
        sid = str(report.get("session_id") or "")
        if not sid or sid in best_report_by_session:
            continue
        if _score_from_report(report, "overall_score") is None:
            continue
        best_report_by_session[sid] = report

    history: list[dict[str, Any]] = []
    for sid, report in best_report_by_session.items():
        session = session_by_id.get(sid) or {}
        label_parts = [
            part
            for part in (session.get("target_role"), session.get("target_company"))
            if part
        ]
        if not label_parts and session.get("mode"):
            label_parts = [str(session["mode"]).replace("_", " ").title()]
        at = (
            session.get("completed_at")
            or report.get("created_at")
            or session.get("started_at")
            or session.get("created_at")
        )
        history.append(
            {
                "session_id": sid,
                "label": " · ".join(label_parts) if label_parts else "Mock interview",
                "mode": session.get("mode"),
                "status": session.get("status") or "completed",
                "at": at,
                "overall_score": _score_from_report(report, "overall_score"),
                "communication_score": _score_from_report(report, "communication_score"),
                "structure_score": _score_from_report(report, "structure_score"),
                "content_score": _score_from_report(report, "content_score"),
                "eye_contact_score": _eye_from_report(report),
            }
        )

    # Chronological for charts (oldest → newest).
    history = sorted(
        history,
        key=lambda row: str(row.get("at") or ""),
    )
    # Cap points so the sparkline stays readable on the dashboard.
    if len(history) > 12:
        history = history[-12:]

    overalls = [int(h["overall_score"]) for h in history if h.get("overall_score") is not None]
    latest_overall = overalls[-1] if overalls else None
    previous_overall = overalls[-2] if len(overalls) >= 2 else None
    delta = (
        (latest_overall - previous_overall)
        if latest_overall is not None and previous_overall is not None
        else None
    )
    if delta is None:
        trend = "none"
    elif delta > 0:
        trend = "up"
    elif delta < 0:
        trend = "down"
    else:
        trend = "flat"

    def _dim_stats(key: str) -> dict[str, Any]:
        values = [int(h[key]) for h in history if h.get(key) is not None]
        if not values:
            return {"latest": None, "previous": None, "average": None}
        return {
            "latest": values[-1],
            "previous": values[-2] if len(values) >= 2 else None,
            "average": round(sum(values) / len(values), 1),
        }

    return {
        "sessions_total": sessions_total,
        "sessions_completed": sessions_completed,
        "sessions_with_scores": len(history),
        "latest_overall": latest_overall,
        "previous_overall": previous_overall,
        "delta": delta,
        "best_overall": max(overalls) if overalls else None,
        "average_overall": round(sum(overalls) / len(overalls), 1) if overalls else None,
        "trend": trend,
        "history": history,
        "dimensions": {
            "communication": _dim_stats("communication_score"),
            "structure": _dim_stats("structure_score"),
            "content": _dim_stats("content_score"),
            "eye_contact": _dim_stats("eye_contact_score"),
        },
    }


def _latest_actions(client, user: CurrentUser) -> dict[str, Any]:
    """
    Build dashboard "latest progress" cards from real persisted rows.
    Uses existing tables only — simple queries (no nested joins) for reliability.
    """
    uid = str(user.id)
    last_resume_upload = None
    try:
        from concurrent.futures import ThreadPoolExecutor as _TPE
        with _TPE(max_workers=2) as _ex:
            f_parents = _ex.submit(lambda: (client.table("resumes").select("id,title,deleted_at,created_at").eq("user_id", uid).is_("deleted_at", "null").execute().data or []))
            f_versions = _ex.submit(lambda: (client.table("resume_versions").select("id,resume_id,original_filename,created_at,source_type,version_number").eq("user_id", uid).execute().data or []))
            parents = f_parents.result()
            versions = f_versions.result()
        parent_by_id = {str(row.get("id")): row for row in parents}
        # Prefer version recency; fall back to version_number when created_at is missing.
        versions = sort_rows_by_recency(versions, desc=True)
        versions = sorted(
            versions,
            key=lambda row: (
                row_recency_key(row),
                int(row.get("version_number") or 0),
            ),
            reverse=True,
        )
        for row in versions:
            resume_id = row.get("resume_id")
            if not resume_id:
                continue
            parent = parent_by_id.get(str(resume_id), {})
            if not parent or parent.get("deleted_at"):
                continue
            last_resume_upload = {
                "version_id": row.get("id"),
                "resume_id": resume_id,
                "title": parent.get("title") or row.get("original_filename") or "Resume",
                "filename": row.get("original_filename"),
                "source_type": row.get("source_type"),
                "created_at": row.get("created_at") or parent.get("created_at"),
            }
            break
        # Fallback when versions lack timestamps/ids still map to an active resume parent.
        if last_resume_upload is None and parents:
            parent = sort_rows_by_recency(parents, desc=True)[0]
            last_resume_upload = {
                "version_id": None,
                "resume_id": parent.get("id"),
                "title": parent.get("title") or "Resume",
                "filename": None,
                "source_type": None,
                "created_at": parent.get("created_at"),
            }
    except Exception:
        last_resume_upload = None

    last_interview = None
    try:
        sessions = (
            client.table("interview_sessions")
            .select("id,mode,target_role,target_company,status,created_at,completed_at,started_at")
            .eq("user_id", uid)
            .execute()
            .data
            or []
        )
        completed = [row for row in sessions if row.get("status") == "completed"]
        pool = completed or sessions
        rows = sort_rows_by_recency(pool, desc=True, preferred="completed_at")[:1]
        if rows:
            row = rows[0]
            label_parts = [part for part in (row.get("target_role"), row.get("target_company")) if part]
            if not label_parts and row.get("mode"):
                label_parts = [str(row["mode"]).replace("_", " ").title()]
            last_interview = {
                "id": row.get("id"),
                "label": " · ".join(label_parts) if label_parts else "Mock interview",
                "mode": row.get("mode"),
                "status": row.get("status"),
                "created_at": row.get("created_at"),
                "at": row.get("completed_at") or row.get("started_at") or row.get("created_at"),
            }
    except Exception:
        last_interview = None

    last_job_applied = None
    try:
        applied = (
            client.table("saved_jobs")
            .select("job_id,status,saved_at")
            .eq("user_id", uid)
            .eq("status", "applied")
            .order("saved_at", desc=True)
            .limit(1)
            .execute()
            .data
            or []
        )
        rows = applied or (
            client.table("saved_jobs")
            .select("job_id,status,saved_at")
            .eq("user_id", uid)
            .order("saved_at", desc=True)
            .limit(1)
            .execute()
            .data
            or []
        )
        if rows:
            row = rows[0]
            job_id = row.get("job_id")
            title = "Saved job"
            company = None
            if job_id:
                jobs = (
                    client.table("jobs")
                    .select("id,title,company")
                    .eq("id", str(job_id))
                    .limit(1)
                    .execute()
                    .data
                    or []
                )
                if jobs:
                    title = jobs[0].get("title") or title
                    company = jobs[0].get("company")
            last_job_applied = {
                "job_id": job_id,
                "title": title,
                "company": company,
                "label": f"{title} · {company}" if company else title,
                "status": row.get("status"),
                "is_application": row.get("status") == "applied",
                "at": row.get("updated_at") if row.get("status") == "applied" else row.get("saved_at"),
            }
    except Exception:
        last_job_applied = None

    return {
        "last_resume_upload": last_resume_upload,
        "last_interview": last_interview,
        "last_job_applied": last_job_applied,
    }

