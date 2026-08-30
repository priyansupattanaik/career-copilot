import logging
import mimetypes
import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime
from typing import Any
from urllib.parse import urlparse
from uuid import UUID

from fastapi import APIRouter, Body, Depends, File, Form, Header, Query, UploadFile
from fastapi.responses import JSONResponse
from fastapi.responses import Response as PlainResponse

from app.agents.providers.routing import preferred_llm_providers
from app.agents.registry import agents_status
from app.api.routers.auth import router as auth_router
from app.api.schemas import (
    AccountDeleteRequest,
    AtsAnalysisCreate,
    ExtractionPatch,
    InterviewCommit,
    InterviewCreate,
    InterviewPreparationCreate,
    InterviewResponseCreate,
    InterviewTtsRequest,
    JobDescriptionMetadataPatch,
    JobDescriptionTextCreate,
    JobRecommendationGenerate,
    LearningItemProgressPatch,
    LearningPathCreate,
    LearningPathGenerate,
    LearningResourceProgressPatch,
    NotificationSettings,
    PreferencesUpdate,
    PrivacySettings,
    ProfileFromResumeApplyRequest,
    ProfileFromResumePreviewRequest,
    ProfilePatch,
    SavedJobPatch,
)
from app.core.config import Settings, get_settings
from app.core.errors import ApiError
from app.database.client import database_client, database_probe
from app.database.repository import (
    CANDIDATE_TABLES,
    client_for,
    list_recent_activity,
    owned_row,
    owned_rows,
    recalculate_completion,
    row_recency_key,
    sort_rows_by_recency,
    write_activity,
)
from app.features.ats.agents import evaluate_ats_domain_gate, generate_ats_improvement_brief
from app.features.ats.ats_score import (
    ALGORITHM_VERSION,
    ats_source_fingerprint,
    evidence_match_status,
    score_resume,
)
from app.features.auth.account_deletion import (
    CONFIRM_PHRASE,
    collect_user_storage_paths,
    confirmation_is_valid,
    email_matches_account,
    purge_user_storage,
)
from app.features.auth.service import (
    CurrentUser,
    get_current_user,
    get_current_user_optional,
    parse_file_access_token,
)
from app.features.auth.username import normalize_username, validate_username
from app.features.career_matching import (
    ALGORITHM_VERSION as CAREER_MATCH_ALGORITHM_VERSION,
)
from app.features.career_matching import (
    _infer_work_mode,
    candidate_skill_evidence,
    score_job,
)
from app.features.document_parsing.pipeline import parse_document_bytes
from app.features.document_parsing.service import (
    extract_sections_enriched,
    extract_skill_candidates,
    infer_job_metadata,
    infer_resume_title,
    safe_filename,
    sha256_bytes,
    skill_source_text,
    validate_document,
)
from app.features.interview.agent import (
    evaluate_interview_answer,
    generate_interview_questions,
    generate_interview_session_report,
)
from app.features.interview.agent.evaluator import INTERVIEW_REPORT_VERSION
from app.features.interview.commit import commit_live_interview
from app.features.interview.follow_up import (
    is_follow_up_question,
    max_question_budget,
)
from app.features.interview.preparation import generate_interview_preparation
from app.features.job_agent import rank_jobs_with_agent
from app.features.learning.service import generate_learning_path_from_ats
from app.features.learning.watch_progress import (
    apply_watch_patch,
    build_ats_source_snapshot,
    complete_resource,
    empty_watch_fields,
    item_percent,
    item_status_from_percent,
    path_rollup,
    watch_fields_for_write,
    with_watch_defaults,
)
from app.features.profile.agent import build_profile_draft_enriched, profile_draft_response_payload
from app.features.profile.agent.normalize import normalize_date_value
from app.features.profile.avatars import (
    attach_avatar_url,
    avatar_extension_for_mime,
    signed_avatar_url,
    validate_avatar_upload,
)
from app.features.profile.importer import insert_validated_batch
from app.features.resume_improvement.routes import router as resume_improvement_router

_bootstrap_cache: dict[str, tuple[float, dict[str, Any]]] = {}
_bootstrap_cache_ttl = 5.0

router = APIRouter()
router.include_router(resume_improvement_router)
logger = logging.getLogger(__name__)
SCORING_ALGORITHM_VERSION = ALGORITHM_VERSION



router.include_router(auth_router)

def utc_now() -> str:
    return datetime.now(UTC).isoformat()


async def _extract_resume_content(
    content: bytes, filename: str, declared_mime: str | None, settings: Settings
) -> tuple[str, dict[str, Any]]:
    """Parse resume with pypdf (and optional fast PDF backends) + section map (no source-block payload)."""
    mime = validate_document(filename or "document", declared_mime, content, settings.document_max_bytes)
    return await parse_document_bytes(content, mime_type=mime, settings=settings)


def ensure_preference_row(client, table: str, user_id: str) -> dict[str, Any]:
    """Return a candidate preference row, repairing legacy users missing defaults."""
    rows = (
        client.table(table)
        .select("*")
        .eq("user_id", user_id)
        .limit(1)
        .execute()
        .data
        or []
    )
    if rows:
        return rows[0]
    created = client.table(table).upsert({"user_id": user_id}).execute().data or []
    if not created:
        raise ApiError(500, "preferences_unavailable", "Candidate preferences could not be loaded.")
    return created[0]


@router.get("/health/live")
def health_live(settings: Settings = Depends(get_settings)) -> dict[str, Any]:
    """Process liveness only — no Firestore/Storage network I/O.

    Used by local ``npm run dev`` readiness waits so a slow remote probe cannot
    block starting the frontend after uvicorn is already up.
    """
    return {
        "status": "ok",
        "service": settings.app_name,
        "live": True,
    }


@router.get("/health")
def health(settings: Settings = Depends(get_settings)) -> dict[str, Any]:
    """App health with bounded dependency probes (never hangs indefinitely)."""
    status = agents_status(settings)
    # Concurrent probes + 5s timeout (was 3s sequential)
    probe = database_probe(settings, timeout_seconds=5.0)
    probe_status = probe.get("status") or "unreachable"
    overall = "ok" if probe_status == "reachable" else "degraded"
    return {
        "status": overall,
        "service": settings.app_name,
        "database_engine": "firestore",
        "storage_engine": probe.get("storage_engine")
        or ("supabase_storage" if settings.supabase_storage_configured else "unconfigured"),
        "database_configured": settings.database_configured,
        "storage_configured": settings.storage_configured,
        "firebase_project_id": settings.firebase_project_id or None,
        "nvidia_configured": settings.nvidia_configured,
        "groq_configured": settings.groq_configured,
        "agent_count": status["agent_count"],
        "agents_ready": status["ready_count"],
        "llm_agents_configured": status["llm_configured_agent_count"],
        "database_status": probe["database_status"],
        "storage_status": probe["storage_status"],
        "probe_status": probe_status,
        "database_error": probe.get("database_error"),
        "storage_error": probe.get("storage_error"),
    }


@router.get("/health/ready", response_model=None)
def health_ready(settings: Settings = Depends(get_settings)) -> dict[str, Any] | JSONResponse:
    """Readiness probe that fails closed when required dependencies are degraded."""
    payload = health(settings)
    if payload.get("status") != "ok":
        return JSONResponse(status_code=503, content=payload)
    return payload


@router.get("/agents/status")
def agent_status(settings: Settings = Depends(get_settings)) -> dict[str, Any]:
    """Public agent inventory + configuration readiness (no secrets)."""
    return agents_status(settings)


@router.get("/health/database")
def health_database(settings: Settings = Depends(get_settings)) -> dict[str, Any]:
    """Deep dependency probe with bounded timeouts (ops / diagnostics)."""
    return database_probe(settings, timeout_seconds=5.0)


@router.get("/files/{bucket}/{path:path}")
async def authenticated_file(
    bucket: str,
    path: str,
    token: str | None = Query(default=None, description="Path-scoped file access token for <img> loads"),
    user: CurrentUser | None = Depends(get_current_user_optional),
    settings: Settings = Depends(get_settings),
):
    """Stream a user-owned object after ownership checks.

    Auth sources (first match wins):
    1. Bearer / session cookie (API fetches)
    2. ``token`` query param — short-lived path-scoped JWT for browser subresources
       (``<img src>`` cannot send Authorization headers)
    """
    allowed = {settings.document_bucket, settings.avatar_bucket}
    if bucket not in allowed:
        raise ApiError(404, "file_not_found", "The requested file was not found.")

    if user is not None:
        owner_id = str(user.id)
    elif token:
        owner_uuid = parse_file_access_token(token, settings, bucket=bucket, path=path)
        owner_id = str(owner_uuid)
    else:
        raise ApiError(
            401,
            "authentication_required",
            "Authentication is required to access this file.",
        )

    # Canonicalize before ownership check — producer fix, not crash-site swallowing.
    # Enrich invalid paths for telemetry: type, truncated value, operation.
    try:
        from app.database.client import _safe_object_key
        canonical = _safe_object_key(path)
    except ValueError as exc:
        raise ApiError(404, "file_not_found", f"Invalid file path for bucket '{bucket}': type={type(path).__name__}, value={str(path)[:80]} [{exc}]") from exc
    if not canonical.startswith(f"{owner_id}/"):
        raise ApiError(404, "file_not_found", "The requested file was not found.")
    # Use canonical for download to avoid double-cleaning divergence.
    path = canonical
    try:
        content = database_client(settings).storage.from_(bucket).download(path)
    except FileNotFoundError as exc:
        raise ApiError(404, "file_not_found", "The requested file was not found.") from exc
    except Exception as exc:
        raise ApiError(503, "storage_unavailable", "Object storage is temporarily unavailable.") from exc
    media_type = mimetypes.guess_type(path)[0] or "application/octet-stream"
    return PlainResponse(
        content=content,
        media_type=media_type,
        headers={
            # Avatars are private; discourage long-lived shared caches of tokenized URLs.
            "Cache-Control": "private, max-age=300",
        },
    )


@router.get("/me/bootstrap")
def bootstrap(
    scope: str = Query(default="full", pattern="^(full|shell)$"),
    user: CurrentUser = Depends(get_current_user), settings: Settings = Depends(get_settings)
) -> dict[str, Any]:
    client = client_for(settings, user)
    # Bootstrap is a read endpoint. Completion is recalculated after mutations;
    # never perform cleanup or writes while loading a page.
    uid = str(user.id)
    # Cache per user/scope for 5s to avoid hammering Firestore on every navigation
    cache_key = f"{uid}:{scope}"
    now = time.time()
    if cache_key in _bootstrap_cache:
        ts, cached = _bootstrap_cache[cache_key]
        if now - ts < _bootstrap_cache_ttl:
            return cached

    def _read_profile():
        from app.database.client import FirestoreResult
        try:
            snap = client.db.collection("profiles").document(uid).get()
            if snap.exists:
                data = snap.to_dict() or {}
                data["id"] = snap.id
                filtered = {k: data.get(k) for k in ("id","full_name","avatar_url","avatar_path","profile_completion","profile_completion_details")}
                return FirestoreResult([filtered])
            return FirestoreResult([])
        except Exception:
            return (
                client.table("profiles")
                .select("id,full_name,avatar_url,avatar_path,profile_completion,profile_completion_details")
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
            # before the optional Firestore composite index is provisioned.
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
            .select("id,overall_score,status,created_at,started_at,completed_at")
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
            .select("id,overall_score,status,created_at,started_at,completed_at")
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

    with ThreadPoolExecutor(max_workers=8, thread_name_prefix="bootstrap") as executor:
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
        profile = (futures["profile"].result().data or [{}])[0]
        active_resume = futures["active_resume"].result().data or []
        confirmed_resume_count = futures["confirmed_resume"].result()
        latest_jd = futures["latest_jd"].result() or []
        latest_analysis = futures["latest_analysis"].result() or []
        recent_activity = futures["recent_activity"].result()
        latest_actions = futures["latest_actions"].result()
        interview_progress = futures["interview_progress"].result()
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
    with ThreadPoolExecutor(max_workers=len(count_jobs), thread_name_prefix="bootstrap-count") as executor:
        count_futures = {
            key: executor.submit(_count, table, deleted_only=deleted_only, failed_only=failed_only)
            for key, (table, deleted_only, failed_only) in count_jobs.items()
        }
        counts = {key: count_futures[key].result() for key in ("resumes", "ats_analyses", "interviews", "learning_paths", "saved_jobs")}
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
            .select("job_id,status,saved_at,updated_at")
            .eq("user_id", uid)
            .eq("status", "applied")
            .order("updated_at", desc=True)
            .limit(1)
            .execute()
            .data
            or []
        )
        rows = applied or (
            client.table("saved_jobs")
            .select("job_id,status,saved_at,updated_at")
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


@router.get("/me/activity")
def list_activity(
    user: CurrentUser = Depends(get_current_user), settings: Settings = Depends(get_settings)
) -> list[dict[str, Any]]:
    """Return the candidate's retained activity feed (max 5 newest rows)."""
    return list_recent_activity(client_for(settings, user), user)


def _normalize_token(value: str) -> str:
    return " ".join(value.strip().lower().split())


def _prepare_candidate_payload(
    resource: str, payload: dict[str, Any], *, require_core: bool
) -> dict[str, Any]:
    data = {key: value for key, value in payload.items() if key not in {"user_id", "id"}}
    if resource == "skills":
        if "name" in data or require_core:
            name = str(data.get("name") or "").strip()
            if not name:
                raise ApiError(400, "invalid_skill", "Skill name is required.")
            data["name"] = name
            data["normalized_name"] = _normalize_token(str(data.get("normalized_name") or name))
    elif resource == "languages":
        if "language" in data or require_core:
            language = str(data.get("language") or "").strip()
            if not language:
                raise ApiError(400, "invalid_language", "Language is required.")
            data["language"] = language
            data["normalized_language"] = _normalize_token(str(data.get("normalized_language") or language))
    elif resource == "experiences" and require_core:
        if not str(data.get("company_name") or "").strip() or not str(data.get("role_title") or "").strip():
            raise ApiError(400, "invalid_experience", "Company name and role title are required.")
    if resource == "experiences":
        for key in ("start_date", "end_date"):
            if key in data and data[key] not in (None, ""):
                normalized = normalize_date_value(data[key])
                if normalized is None:
                    raise ApiError(400, "invalid_experience_date", "Experience dates must use YYYY-MM-DD format.")
                data[key] = normalized
        if data.get("is_current"):
            data["end_date"] = None
        if data.get("start_date") and data.get("end_date") and data["end_date"] < data["start_date"]:
            raise ApiError(400, "invalid_experience_date", "Experience end date cannot be before start date.")
    elif resource == "education" and require_core:
        if not str(data.get("institution") or "").strip():
            raise ApiError(400, "invalid_education", "Institution is required.")
    elif resource == "projects":
        # Title is required for new projects; patch may update only URLs.
        if require_core and not str(data.get("title") or "").strip():
            raise ApiError(400, "invalid_project", "Project title is required.")
        if "title" in data:
            title = str(data.get("title") or "").strip()
            if not title and require_core:
                raise ApiError(400, "invalid_project", "Project title is required.")
            if title:
                if len(title) > 200:
                    raise ApiError(400, "invalid_project", "Project title must be 200 characters or fewer.")
                data["title"] = title
        # Normalize optional URL aliases (github / live -> github_url / live_url)
        url_aliases = {
            "github": "github_url",
            "github_url": "github_url",
            "githubUrl": "github_url",
            "live": "live_url",
            "live_url": "live_url",
            "liveUrl": "live_url",
            "url": "live_url",
            "demo_url": "live_url",
        }
        for alias, canonical in list(url_aliases.items()):
            if alias in data and alias != canonical:
                if canonical not in data or not str(data.get(canonical) or "").strip():
                    data[canonical] = data.pop(alias)
                else:
                    data.pop(alias, None)
        for key in ("github_url", "live_url"):
            if key in data:
                raw = str(data.get(key) or "").strip()
                if not raw:
                    data[key] = None
                else:
                    if len(raw) > 500:
                        raise ApiError(400, "invalid_project_url", f"{key} must be 500 characters or fewer.")
                    parsed = urlparse(raw)
                    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
                        raise ApiError(400, "invalid_project_url", f"{key} must be a valid http(s) URL.")
                    # Normalize: ensure no trailing spaces
                    data[key] = raw
        # Description / role optional but trimmed and length-limited
        for key, max_len in (("description", 4000), ("role", 160)):
            if key in data and data[key] is not None:
                val = str(data[key] or "").strip()
                if not val:
                    data[key] = None
                else:
                    if len(val) > max_len:
                        raise ApiError(400, "invalid_project", f"{key} must be {max_len} characters or fewer.")
                    data[key] = val
    elif resource == "links":
        if require_core or "link_type" in data or "url" in data:
            link_type = str(data.get("link_type") or "").strip()
            url = str(data.get("url") or "").strip()
            if require_core and (
                link_type not in {"linkedin", "github", "portfolio", "website", "other"}
                or not url
            ):
                raise ApiError(400, "invalid_link", "A valid link type and URL are required.")
            if link_type:
                data["link_type"] = link_type
            if url:
                data["url"] = url
    if resource in {"experiences", "education", "projects", "languages", "links"}:
        data.setdefault("display_order", 0)
    return data


@router.get("/profile/username/availability")
def username_availability(
    username: str = Query(..., min_length=3, max_length=30),
    user: CurrentUser = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
):
    try:
        normalized = validate_username(username)
    except ValueError as exc:
        return {"username": normalize_username(username), "available": False, "reason": str(exc)}
    rows = (
        client_for(settings, user).table("profiles").select("id").ilike("username", normalized).limit(1).execute().data
        or []
    )
    available = not rows or str(rows[0].get("id")) == str(user.id)
    return {"username": normalized, "available": available, "reason": None if available else "Username is already taken."}


@router.get("/public/username-availability")
def public_username_availability(username: str = Query(..., min_length=3, max_length=30), settings: Settings = Depends(get_settings)):
    try:
        normalized = validate_username(username)
    except ValueError as exc:
        return {"username": normalize_username(username), "available": False, "reason": str(exc), "suggestions": []}
    rows = database_client(settings).table("profiles").select("id").ilike("username", normalized).limit(1).execute().data or []
    suggestions = [] if not rows else [f"{normalized}_{suffix}"[:30] for suffix in (1, 2, 3)]
    return {"username": normalized, "available": not rows, "reason": None if not rows else "Username is already taken.", "suggestions": suggestions}


_PUBLIC_PROFILE_CARD_FIELDS = (
    "username",
    "full_name",
    "avatar_url",
    "headline",
    "location",
    "current_role",
    "career_level",
    "career_goal",
)


def public_profile_search_needle(raw: str) -> str:
    """Normalize a community search. Leading @ is stripped because stored usernames never include it."""
    cleaned = " ".join((raw or "").split()).casefold()
    if cleaned.startswith("@"):
        cleaned = cleaned[1:].lstrip()
    return cleaned


def public_profile_directory_cards(
    rows: list[dict[str, Any]],
    needle: str,
    limit: int,
) -> list[dict[str, Any]]:
    """Return public identity cards that match needle. Empty or short needles return nothing."""
    cleaned = public_profile_search_needle(needle)
    if len(cleaned) < 2:
        return []
    matches: list[dict[str, Any]] = []
    ranked = sorted(
        rows,
        key=lambda row: (
            str(row.get("full_name") or "").casefold(),
            str(row.get("username") or "").casefold(),
        ),
    )
    for row in ranked:
        username = str(row.get("username") or "").strip()
        if not username:
            continue
        haystack = " ".join(str(row.get(key) or "") for key in _PUBLIC_PROFILE_CARD_FIELDS).casefold()
        if cleaned not in haystack:
            continue
        matches.append({key: row.get(key) for key in _PUBLIC_PROFILE_CARD_FIELDS})
        if len(matches) >= limit:
            break
    return matches


@router.get("/public/profiles/search")
def search_public_profiles(
    q: str = Query(..., min_length=2, max_length=80),
    limit: int = Query(20, ge=1, le=50),
    settings: Settings = Depends(get_settings),
):
    """Search public identity/profile fields; never list the directory or expose resume records.

    Requires a query of at least 2 characters. An empty or short query is rejected.
    """
    needle = public_profile_search_needle(q)
    if len(needle) < 2:
        return []
    rows = (
        database_client(settings)
        .table("profiles")
        .select("username,full_name,avatar_url,avatar_path,headline,location,current_role,career_level,career_goal")
        .limit(500)
        .execute()
        .data
        or []
    )
    return public_profile_directory_cards(rows, needle, limit)


@router.get("/public/profiles/{username}")
def public_profile(username: str, settings: Settings = Depends(get_settings)):
    try:
        normalized = validate_username(username)
    except ValueError:
        raise ApiError(404, "profile_not_found", "Public profile not found.") from None
    client = database_client(settings)
    rows = client.table("profiles").select(
        "id,username,full_name,avatar_url,avatar_path,headline,bio,location,current_role,years_experience,career_level,career_goal"
    ).ilike("username", normalized).limit(1).execute().data or []
    if not rows:
        raise ApiError(404, "profile_not_found", "Public profile not found.")
    profile = rows[0]
    owner = str(profile["id"])
    public_rows: dict[str, list[dict[str, Any]]] = {}
    for resource in ("skills", "experiences", "education", "projects", "certifications", "languages", "links"):
        table = CANDIDATE_TABLES.get(resource)
        if not table:
            continue
        fields = "*" if resource != "links" else "id,link_type,label,url,display_order"
        public_rows[resource] = client.table(table).select(fields).eq("user_id", owner).limit(100).execute().data or []
    # Public page should show the avatar like private bootstrap does.
    # Generate a fresh signed URL with token so <img> works without Authorization.
    # Keep avatar_url, hide raw storage path from public response.
    try:
        enriched = attach_avatar_url(profile, client, settings)
        if enriched is not None:
            profile = enriched
    except Exception:
        logger.warning("public_profile_avatar_failed username=%s id=%s", normalized, owner[:8])
    profile.pop("avatar_path", None)
    # Keep avatar_url (None when no avatar or storage outage) for frontend <img>
    return {"profile": profile, "sections": public_rows}


@router.get("/profile")
def get_profile(user: CurrentUser = Depends(get_current_user), settings: Settings = Depends(get_settings)):
    client = client_for(settings, user)
    profile = (
        client.table("profiles")
        .select("*")
        .eq("id", str(user.id))
        .limit(1)
        .execute()
        .data
        or [{}]
    )[0]
    return {
        "profile": attach_avatar_url(profile, client, settings),
        "preferences": ensure_preference_row(client, "candidate_preferences", str(user.id)),
    }


@router.patch("/profile")
def update_profile(
    payload: ProfilePatch,
    user: CurrentUser = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
):
    client = client_for(settings, user)
    values = payload.model_dump(exclude_none=True)
    if "username" in values:
        try:
            values["username"] = validate_username(values["username"])
        except ValueError as exc:
            raise ApiError(400, "invalid_username", str(exc)) from None
        existing = client.table("profiles").select("id").ilike("username", values["username"]).limit(1).execute().data or []
        if existing and str(existing[0].get("id")) != str(user.id):
            raise ApiError(409, "username_taken", "That username is already taken.")
    client.table("profiles").update(values).eq("id", str(user.id)).execute()
    profile = recalculate_completion(client, user)
    write_activity(client, user, "profile_updated", "Candidate profile updated", "profile", str(user.id))
    return attach_avatar_url(profile, client, settings)


@router.post("/profile/avatar")
async def upload_profile_avatar(
    file: UploadFile = File(...),
    user: CurrentUser = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
):
    """
    Upload or replace the candidate profile picture.
    Max size: settings.avatar_max_bytes (3 MB). JPEG / PNG / WebP only.
    Stores path on profiles.avatar_path and returns a short-lived signed URL.
    """
    client = client_for(settings, user)
    raw = await file.read()
    mime = validate_avatar_upload(
        file.filename, file.content_type, raw, settings.avatar_max_bytes
    )
    ext = avatar_extension_for_mime(mime)
    new_path = f"{user.id}/avatars/{uuid.uuid4()}{ext}"

    current = (
        client.table("profiles")
        .select("avatar_path")
        .eq("id", str(user.id))
        .limit(1)
        .execute()
        .data
        or []
    )
    old_path = (current[0].get("avatar_path") if current else None) or None

    try:
        client.storage.from_(settings.avatar_bucket).upload(
            new_path,
            raw,
            {"content-type": mime, "upsert": "false"},
        )
    except Exception as exc:
        raise ApiError(500, "avatar_upload_failed", "The profile picture could not be stored.") from exc

    try:
        updated = (
            client.table("profiles")
            .update({"avatar_path": new_path})
            .eq("id", str(user.id))
            .execute()
            .data
        )
        if not updated:
            raise ApiError(
                500,
                "avatar_profile_update_failed",
                "The profile picture path could not be saved.",
            )
    except ApiError:
        try:
            client.storage.from_(settings.avatar_bucket).remove([new_path])
        except Exception:
            pass
        raise
    except Exception as exc:
        try:
            client.storage.from_(settings.avatar_bucket).remove([new_path])
        except Exception:
            pass
        raise ApiError(
            500,
            "avatar_profile_update_failed",
            "The profile picture path could not be saved.",
        ) from exc
    if old_path and old_path != new_path:
        try:
            client.storage.from_(settings.avatar_bucket).remove([old_path])
        except Exception:
            pass

    profile = recalculate_completion(client, user)
    write_activity(
        client, user, "avatar_updated", "Profile picture updated", "profile", str(user.id)
    )
    return {
        "profile": attach_avatar_url(profile, client, settings),
        "avatar_path": new_path,
        "avatar_url": signed_avatar_url(
            client, settings, new_path, user_id=str(user.id)
        ),
        "max_bytes": settings.avatar_max_bytes,
        "expires_in": settings.export_signed_url_seconds,
    }


@router.delete("/profile/avatar", status_code=204)
def delete_profile_avatar(
    user: CurrentUser = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
):
    """Remove the candidate profile picture from storage and clear profiles.avatar_path."""
    client = client_for(settings, user)
    rows = (
        client.table("profiles")
        .select("avatar_path")
        .eq("id", str(user.id))
        .limit(1)
        .execute()
        .data
        or []
    )
    path = (rows[0].get("avatar_path") if rows else None) or None
    client.table("profiles").update({"avatar_path": None}).eq("id", str(user.id)).execute()
    if path:
        try:
            client.storage.from_(settings.avatar_bucket).remove([path])
        except Exception:
            pass
    write_activity(
        client, user, "avatar_removed", "Profile picture removed", "profile", str(user.id)
    )


@router.put("/profile/preferences")
def update_preferences(
    payload: PreferencesUpdate,
    user: CurrentUser = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
):
    client = client_for(settings, user)
    result = client.table("candidate_preferences").upsert(
        # Clear the legacy field while keeping the public preference contract
        # limited to a minimum salary.
        {"user_id": str(user.id), "salary_max": None, **payload.model_dump()}
    ).execute().data or []
    if not result:
        raise ApiError(500, "preferences_save_failed", "Candidate preferences could not be saved.")
    recalculate_completion(client, user)
    write_activity(
        client, user, "profile_updated", "Candidate preferences updated", "preferences", str(user.id)
    )
    return result[0]


@router.post("/profile/skills/from-resume")
def import_skills_from_resume(
    user: CurrentUser = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
):
    """Import deterministic skill candidates from the candidate's confirmed resume text."""
    client = client_for(settings, user)
    versions = (
        client.table("resume_versions")
        .select("id,plain_text,structured_content")
        .eq("user_id", str(user.id))
        .eq("extraction_status", "confirmed")
        .order("created_at", desc=True)
        .limit(1)
        .execute()
        .data
        or []
    )
    if not versions:
        raise ApiError(404, "confirmed_resume_required", "Confirm a resume before importing skills.")
    version = versions[0]
    plain_text = version.get("plain_text") or ""
    sections = (version.get("structured_content") or {}).get("sections") or {}
    if not isinstance(sections, dict):
        sections = {}
    skill_blob, from_skills_section = skill_source_text(plain_text=plain_text, sections=sections)
    candidates = extract_skill_candidates(
        skill_blob,
        limit=40,
        allow_bare_short_lines=from_skills_section,
    )
    existing = {
        str(row.get("normalized_name") or "").lower()
        for row in owned_rows(client, "candidate_skills", user)
    }
    created: list[dict[str, Any]] = []
    for skill in candidates:
        normalized = _normalize_token(skill)
        if not normalized or normalized in existing:
            continue
        row = (
            client.table("candidate_skills")
            .insert(
                {
                    "user_id": str(user.id),
                    "name": skill,
                    "normalized_name": normalized,
                    "source": "resume_import",
                }
            )
            .execute()
            .data[0]
        )
        created.append(row)
        existing.add(normalized)
    profile = recalculate_completion(client, user)
    write_activity(
        client,
        user,
        "skills_imported",
        f"Imported {len(created)} skills from confirmed resume",
        "profile",
        str(user.id),
    )
    return {
        "suggested": candidates,
        "created": created,
        "created_count": len(created),
        "profile_completion": profile.get("profile_completion"),
    }


def _load_resume_version_for_profile_fill(
    client, user: CurrentUser, resume_version_id: UUID | str | None
) -> dict[str, Any]:
    """Load a candidate-owned resume version that has extractable text.

    Profile fill has its own review/apply gate, so any stored version with text
    is allowed (confirmed preferred when no id is given). ATS/interview still
    require confirmation separately.
    """
    select_cols = (
        "id,resume_id,plain_text,structured_content,extraction_status,original_filename,created_at"
    )
    if resume_version_id:
        rows = (
            client.table("resume_versions")
            .select(select_cols)
            .eq("id", str(resume_version_id))
            .eq("user_id", str(user.id))
            .limit(1)
            .execute()
            .data
            or []
        )
        if not rows:
            raise ApiError(404, "resume_version_not_found", "The selected resume version was not found.")
        version = rows[0]
    else:
        # Prefer confirmed, then any version with text (newest first).
        confirmed = (
            client.table("resume_versions")
            .select(select_cols)
            .eq("user_id", str(user.id))
            .eq("extraction_status", "confirmed")
            .order("created_at", desc=True)
            .limit(1)
            .execute()
            .data
            or []
        )
        version = confirmed[0] if confirmed else None
        if not version:
            any_versions = (
                client.table("resume_versions")
                .select(select_cols)
                .eq("user_id", str(user.id))
                .order("created_at", desc=True)
                .limit(10)
                .execute()
                .data
                or []
            )
            version = next(
                (row for row in any_versions if (row.get("plain_text") or "").strip()),
                None,
            )
        if not version:
            raise ApiError(
                409,
                "resume_required",
                "Upload a resume to fill your profile, or save one under Resume Analysis first.",
            )

    plain = (version.get("plain_text") or "").strip()
    if not plain:
        raise ApiError(
            422,
            "resume_has_no_text",
            "The selected resume has no extractable text. Re-upload a text-based PDF or DOCX.",
        )
    return version


async def _store_uploaded_resume(
    client,
    settings: Settings,
    user: CurrentUser,
    file: UploadFile,
    content: bytes,
    title: str | None = None,
) -> tuple[dict[str, Any], dict[str, Any]]:
    """Create a resumes row + stored version from an uploaded PDF/DOCX.

    Shared by POST /resumes and profile fill upload so a resume used during
    profile completion is available for ATS and mock interview without re-upload.
    """
    resume_id = str(uuid.uuid4())
    profile_name = ""
    try:
        profile_rows = (
            client.table("profiles").select("full_name").eq("id", str(user.id)).limit(1).execute().data or []
        )
        profile_name = str((profile_rows[0] if profile_rows else {}).get("full_name") or "").strip()
    except Exception as exc:
        logger.warning("resume_create_profile_lookup_failed type=%s", type(exc).__name__)
        profile_name = ""
    if (title or "").strip():
        resume_title = title.strip()[:200]
    elif profile_name:
        resume_title = f"{profile_name} Resume"[:200]
    else:
        resume_title = infer_resume_title(file.filename)
    has_existing = bool(
        client.table("resumes")
        .select("id")
        .eq("user_id", str(user.id))
        .is_("deleted_at", "null")
        .limit(1)
        .execute()
        .data
        or []
    )
    resume = (
        client.table("resumes")
        .insert(
            {
                "id": resume_id,
                "user_id": str(user.id),
                "title": resume_title,
                "created_at": utc_now(),
                "is_active": not has_existing,
            }
        )
        .execute()
        .data[0]
    )
    try:
        version = await _upload_resume_version(client, settings, user, resume_id, file, content)
    except Exception:
        client.table("resumes").delete().eq("id", resume_id).eq("user_id", str(user.id)).execute()
        raise
    return resume, version


@router.post("/profile/from-resume/preview")
async def preview_profile_from_resume(
    payload: ProfileFromResumePreviewRequest | None = Body(default=None),
    user: CurrentUser = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
):
    """
    Build a reviewable profile draft from a stored resume version.
    Uses NVIDIA structured extraction when configured, plus deterministic mapping.
    Does not write profile tables until /profile/from-resume/apply.
    """
    client = client_for(settings, user)
    version_id = payload.resume_version_id if payload else None
    version = _load_resume_version_for_profile_fill(client, user, version_id)
    plain_text = version.get("plain_text") or ""
    structured = version.get("structured_content") or {}
    if not isinstance(structured, dict) or not structured.get("sections"):
        structured = await extract_sections_enriched(plain_text, settings, prefer_llm=False)
    draft = await build_profile_draft_enriched(
        plain_text,
        structured if isinstance(structured, dict) else {},
        settings,
    )
    return profile_draft_response_payload(
        draft,
        {
            "id": version.get("id"),
            "resume_id": version.get("resume_id"),
            "original_filename": version.get("original_filename"),
            "extraction_status": version.get("extraction_status"),
            "source": "stored_version",
        },
    )


@router.post("/profile/from-resume/preview-upload")
async def preview_profile_from_resume_upload(
    file: UploadFile = File(...),
    title: str | None = Form(default=None),
    user: CurrentUser = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
):
    """
    Store an uploaded PDF/DOCX in the resume library, then build a reviewable
    profile draft from it. The stored resume can be reused for ATS analysis and
    mock interview without uploading again.
    """
    raw = await file.read()
    # Validate early so we fail before writing a resumes row.
    validate_document(
        file.filename or "resume.pdf", file.content_type, raw, settings.document_max_bytes
    )
    client = client_for(settings, user)
    resume, version = await _store_uploaded_resume(client, settings, user, file, raw, title=title)
    write_activity(client, user, "resume_uploaded", "Resume uploaded for profile fill", "resume", str(resume["id"]))
    plain_text = version.get("plain_text") or ""
    if not str(plain_text).strip():
        raise ApiError(
            422,
            "resume_has_no_text",
            "The resume was stored but has no extractable text. Use a text-based PDF or DOCX.",
        )
    structured = version.get("structured_content") or {}
    if not isinstance(structured, dict):
        structured = {}
    draft = await build_profile_draft_enriched(plain_text, structured, settings)
    return profile_draft_response_payload(
        draft,
        {
            "id": version.get("id"),
            "resume_id": resume.get("id"),
            "original_filename": version.get("original_filename")
            or safe_filename(file.filename or "resume"),
            "extraction_status": version.get("extraction_status"),
            "title": resume.get("title"),
            "is_active": resume.get("is_active"),
            "source": "upload_stored",
        },
    )


@router.post("/profile/from-resume/apply")
def apply_profile_from_resume(
    payload: ProfileFromResumeApplyRequest,
    user: CurrentUser = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
):
    """
    Persist a reviewed resume-derived draft into profiles + candidate_* tables.
    Default fill_empty_only=True avoids overwriting existing profile fields.
    """
    client = client_for(settings, user)
    uid = str(user.id)
    created: dict[str, int] = {
        "skills": 0,
        "experiences": 0,
        "education": 0,
        "projects": 0,
        "certifications": 0,
        "languages": 0,
        "links": 0,
    }
    updated_profile_fields: list[str] = []

    # --- profile core fields ---
    _profile_rows = client.table("profiles").select("*").eq("id", uid).single().execute().data or []
    current_profile = _profile_rows[0] if _profile_rows else {}
    profile_patch: dict[str, Any] = {}
    allowed = {
        "full_name",
        "headline",
        "bio",
        "phone",
        "location",
        "current_role",
        "years_experience",
        "career_level",
        "career_goal",
    }
    incoming = payload.profile or {}
    # Support draft shape { selected: true, full_name: ... }
    if incoming.get("selected") is False:
        incoming = {}
    for key in allowed:
        if key not in incoming:
            continue
        value = incoming.get(key)
        if value is None:
            continue
        if isinstance(value, str):
            value = value.strip()
            if not value and key != "bio":
                continue
            if len(value) > 4000:
                value = value[:4000]
        if key == "years_experience":
            try:
                value = float(value)
            except (TypeError, ValueError):
                continue
            if value < 0 or value > 80:
                continue
        existing = current_profile.get(key)
        empty_existing = existing is None or (isinstance(existing, str) and not str(existing).strip())
        if payload.fill_empty_only and not empty_existing:
            continue
        profile_patch[key] = value
        updated_profile_fields.append(key)

    if profile_patch:
        client.table("profiles").update(profile_patch).eq("id", uid).execute()

    def _selected(row: dict[str, Any]) -> bool:
        return row.get("selected", True) is not False

    # --- skills ---
    existing_skills = {
        str(row.get("normalized_name") or "").lower()
        for row in owned_rows(client, "candidate_skills", user)
    }
    skill_rows: list[dict[str, Any]] = []
    for row in payload.skills or []:
        if not _selected(row):
            continue
        name = str(row.get("name") or "").strip()
        if not name:
            continue
        normalized = _normalize_token(str(row.get("normalized_name") or name))
        if not normalized or normalized in existing_skills:
            continue
        skill_rows.append(
            {
                "user_id": uid,
                "name": name[:120],
                "normalized_name": normalized,
                "source": str(row.get("source") or "resume_import")[:40],
            }
        )
        existing_skills.add(normalized)
    created["skills"] = insert_validated_batch(client, "candidate_skills", skill_rows)

    # --- experiences ---
    existing_exp = {
        (
            _normalize_token(str(row.get("company_name") or "")),
            _normalize_token(str(row.get("role_title") or "")),
        )
        for row in owned_rows(client, "candidate_experiences", user)
    }
    experience_rows: list[dict[str, Any]] = []
    for index, row in enumerate(payload.experiences or []):
        if not _selected(row):
            continue
        company = str(row.get("company_name") or "").strip()
        role = str(row.get("role_title") or "").strip()
        if not company or not role:
            continue
        key = (_normalize_token(company), _normalize_token(role))
        if key in existing_exp:
            continue
        experience_rows.append(
            {
                "user_id": uid,
                "company_name": company[:200],
                "role_title": role[:200],
                "location": (str(row["location"]).strip()[:160] if row.get("location") else None),
                "employment_type": (
                    str(row["employment_type"]).strip()[:80] if row.get("employment_type") else None
                ),
                "start_date": normalize_date_value(row.get("start_date")),
                "end_date": None if row.get("is_current") else normalize_date_value(row.get("end_date")),
                "summary": (str(row["summary"]).strip()[:4000] if row.get("summary") else None),
                "is_current": bool(row.get("is_current")),
                "display_order": int(row.get("display_order") or index),
            }
        )
        existing_exp.add(key)
    created["experiences"] = insert_validated_batch(client, "candidate_experiences", experience_rows)

    # --- education ---
    existing_edu = {
        (
            _normalize_token(str(row.get("institution") or "")),
            _normalize_token(str(row.get("degree") or "")),
        )
        for row in owned_rows(client, "candidate_education", user)
    }
    education_rows: list[dict[str, Any]] = []
    for index, row in enumerate(payload.education or []):
        if not _selected(row):
            continue
        institution = str(row.get("institution") or "").strip()
        if not institution:
            continue
        degree = str(row.get("degree") or "").strip() or None
        key = (_normalize_token(institution), _normalize_token(degree or ""))
        if key in existing_edu:
            continue
        education_rows.append(
            {
                "user_id": uid,
                "institution": institution[:200],
                "degree": degree[:160] if degree else None,
                "field_of_study": (
                    str(row["field_of_study"]).strip()[:160] if row.get("field_of_study") else None
                ),
                "grade": (str(row["grade"]).strip()[:80] if row.get("grade") else None),
                "description": (str(row["description"]).strip()[:2000] if row.get("description") else None),
                "display_order": int(row.get("display_order") or index),
            }
        )
        existing_edu.add(key)
    created["education"] = insert_validated_batch(client, "candidate_education", education_rows)

    # --- projects ---
    existing_projects = {
        _normalize_token(str(row.get("title") or ""))
        for row in owned_rows(client, "candidate_projects", user)
    }
    project_rows: list[dict[str, Any]] = []
    for index, row in enumerate(payload.projects or []):
        if not _selected(row):
            continue
        title = str(row.get("title") or "").strip()
        if not title:
            continue
        key = _normalize_token(title)
        if key in existing_projects:
            continue
        project_rows.append(
            {
                "user_id": uid,
                "title": title[:200],
                "role": (str(row["role"]).strip()[:160] if row.get("role") else None),
                "description": (str(row["description"]).strip()[:4000] if row.get("description") else None),
                "skills": row.get("skills") if isinstance(row.get("skills"), list) else [],
                "display_order": int(row.get("display_order") or index),
            }
        )
        existing_projects.add(key)
    created["projects"] = insert_validated_batch(client, "candidate_projects", project_rows)

    # --- certifications ---
    existing_certs = {
        _normalize_token(str(row.get("name") or ""))
        for row in owned_rows(client, "candidate_certifications", user)
    }
    certification_rows: list[dict[str, Any]] = []
    for row in payload.certifications or []:
        if not _selected(row):
            continue
        name = str(row.get("name") or "").strip()
        if not name:
            continue
        key = _normalize_token(name)
        if key in existing_certs:
            continue
        certification_rows.append(
            {
                "user_id": uid,
                "name": name[:200],
                "issuer": (str(row["issuer"]).strip()[:160] if row.get("issuer") else None),
            }
        )
        existing_certs.add(key)
    created["certifications"] = insert_validated_batch(client, "candidate_certifications", certification_rows)

    # --- languages ---
    existing_langs = {
        str(row.get("normalized_language") or "").lower()
        for row in owned_rows(client, "candidate_languages", user)
    }
    language_rows: list[dict[str, Any]] = []
    for index, row in enumerate(payload.languages or []):
        if not _selected(row):
            continue
        language = str(row.get("language") or "").strip()
        if not language:
            continue
        normalized = _normalize_token(language)
        if not normalized or normalized in existing_langs:
            continue
        language_rows.append(
            {
                "user_id": uid,
                "language": language[:80],
                "normalized_language": normalized,
                "proficiency": (str(row["proficiency"]).strip()[:80] if row.get("proficiency") else None),
                "display_order": int(row.get("display_order") or index),
            }
        )
        existing_langs.add(normalized)
    created["languages"] = insert_validated_batch(client, "candidate_languages", language_rows)

    # --- links ---
    existing_links = {
        str(row.get("url") or "").strip().lower() for row in owned_rows(client, "candidate_links", user)
    }
    allowed_link_types = {"linkedin", "github", "portfolio", "website", "other"}
    link_rows: list[dict[str, Any]] = []
    for index, row in enumerate(payload.links or []):
        if not _selected(row):
            continue
        url = str(row.get("url") or "").strip()
        link_type = str(row.get("link_type") or "other").strip().lower()
        if not url or link_type not in allowed_link_types:
            continue
        if url.lower() in existing_links:
            continue
        link_rows.append(
            {
                "user_id": uid,
                "link_type": link_type,
                "url": url[:500],
                "label": (str(row["label"]).strip()[:120] if row.get("label") else None),
                "display_order": int(row.get("display_order") or index),
            }
        )
        existing_links.add(url.lower())
    created["links"] = insert_validated_batch(client, "candidate_links", link_rows)

    profile = recalculate_completion(client, user)
    write_activity(
        client,
        user,
        "profile_filled_from_resume",
        "Profile filled from resume draft",
        "profile",
        uid,
    )
    return {
        "profile": profile,
        "updated_profile_fields": updated_profile_fields,
        "created": created,
        "fill_empty_only": payload.fill_empty_only,
        "profile_completion": profile.get("profile_completion"),
    }


@router.get("/profile/{resource}")
def list_candidate_records(
    resource: str, user: CurrentUser = Depends(get_current_user), settings: Settings = Depends(get_settings)
):
    table = CANDIDATE_TABLES.get(resource)
    if not table:
        raise ApiError(404, "resource_not_found", "The requested profile resource does not exist.")
    rows = owned_rows(client_for(settings, user), table, user)
    if resource not in {"skills", "certifications"}:
        # Sort after reading so legacy rows without display_order are not
        # silently excluded by Firestore's order_by behavior.
        rows.sort(key=lambda row: (row.get("display_order") is None, row.get("display_order") or 0))
    return rows


@router.post("/profile/{resource}", status_code=201)
def create_candidate_record(
    resource: str,
    payload: dict[str, Any] = Body(...),
    user: CurrentUser = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
):
    table = CANDIDATE_TABLES.get(resource)
    if not table:
        raise ApiError(404, "resource_not_found", "The requested profile resource does not exist.")
    if "user_id" in payload or "id" in payload:
        raise ApiError(400, "ownership_field_forbidden", "Ownership fields cannot be supplied.")
    client = client_for(settings, user)
    prepared = _prepare_candidate_payload(resource, payload, require_core=True)
    result = client.table(table).insert({**prepared, "user_id": str(user.id)}).execute().data[0]
    recalculate_completion(client, user)
    return result


@router.patch("/profile/{resource}/{record_id}")
def update_candidate_record(
    resource: str,
    record_id: UUID,
    payload: dict[str, Any] = Body(...),
    user: CurrentUser = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
):
    table = CANDIDATE_TABLES.get(resource)
    if not table:
        raise ApiError(404, "resource_not_found", "The requested profile resource does not exist.")
    client = client_for(settings, user)
    owned_row(client, table, record_id, user)
    prepared = _prepare_candidate_payload(resource, payload, require_core=False)
    result = (
        client.table(table)
        .update(prepared)
        .eq("id", str(record_id))
        .eq("user_id", str(user.id))
        .execute()
        .data[0]
    )
    recalculate_completion(client, user)
    return result


@router.delete("/profile/{resource}/{record_id}", status_code=204)
def delete_candidate_record(
    resource: str,
    record_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
):
    table = CANDIDATE_TABLES.get(resource)
    if not table:
        raise ApiError(404, "resource_not_found", "The requested profile resource does not exist.")
    client = client_for(settings, user)
    owned_row(client, table, record_id, user)
    client.table(table).delete().eq("id", str(record_id)).eq("user_id", str(user.id)).execute()
    recalculate_completion(client, user)


async def _upload_resume_version(
    client, settings: Settings, user: CurrentUser, resume_id: str, file: UploadFile, content: bytes
) -> dict[str, Any]:
    mime = validate_document(
        file.filename or "document", file.content_type, content, settings.document_max_bytes
    )
    version_id = str(uuid.uuid4())
    suffix = ".pdf" if mime == "application/pdf" else ".docx"
    path = f"{user.id}/resumes/{resume_id}/{version_id}/{uuid.uuid4()}{suffix}"
    count = (
        client.table("resume_versions")
        .select("id", count="exact", head=True)
        .eq("resume_id", resume_id)
        .execute()
        .count
        or 0
    )
    try:
        client.storage.from_(settings.document_bucket).upload(
            path, content, {"content-type": mime, "upsert": "false"}
        )
        text, structured = await _extract_resume_content(
            content, file.filename or "document", mime, settings
        )
        record = {
            "id": version_id,
            "resume_id": resume_id,
            "user_id": str(user.id),
            "version_number": count + 1,
            "source_type": "uploaded",
            "original_filename": safe_filename(file.filename or "document"),
            "storage_path": path,
            "mime_type": mime,
            "size_bytes": len(content),
            "sha256": sha256_bytes(content),
            "plain_text": text,
            "structured_content": structured,
            "extraction_status": "review_required",
            "extraction_warnings": list(structured.get("warnings") or []),
            "created_at": utc_now(),
        }
        return client.table("resume_versions").insert(record).execute().data[0]
    except ApiError:
        try:
            client.storage.from_(settings.document_bucket).remove([path])
        except Exception:
            pass
        raise
    except Exception as exc:
        try:
            client.storage.from_(settings.document_bucket).remove([path])
        except Exception:
            pass
        raise ApiError(500, "resume_upload_failed", "The resume could not be stored.") from exc


@router.get("/resumes")
def list_resumes(user: CurrentUser = Depends(get_current_user), settings: Settings = Depends(get_settings)):
    client = client_for(settings, user)
    # Never order by created_at server-side: docs missing that field are dropped by Firestore.
    rows = (
        client.table("resumes")
        .select("*")
        .eq("user_id", str(user.id))
        .is_("deleted_at", "null")
        .execute()
        .data
        or []
    )
    rows = sort_rows_by_recency(rows, desc=True)
    version_rows = (
        client.table("resume_versions")
        .select("id,resume_id,version_number,original_filename,mime_type,extraction_status,created_at,size_bytes")
        .eq("user_id", str(user.id))
        .execute()
        .data
        or []
    )
    version_rows = sorted(
        version_rows,
        key=lambda row: (int(row.get("version_number") or 0), row_recency_key(row)),
        reverse=True,
    )
    latest_by_resume: dict[str, dict[str, Any]] = {}
    for version in version_rows:
        latest_by_resume.setdefault(str(version.get("resume_id")), version)
    for row in rows:
        row["latest_version"] = latest_by_resume.get(str(row["id"]))
    return rows


@router.post("/resumes", status_code=201)
async def create_resume(
    file: UploadFile = File(...),
    title: str | None = Form(default=None),
    user: CurrentUser = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
):
    client = client_for(settings, user)
    max_bytes = int(getattr(settings, "document_max_bytes", 10 * 1024 * 1024))
    if getattr(file, "size", None) is not None and file.size is not None and file.size > max_bytes:
        raise ApiError(413, "file_too_large", f"File too large for '{str(getattr(file, 'filename', ''))[:80]}': type={type(file.filename).__name__ if hasattr(file, 'filename') else 'unknown'}, size={file.size} > {max_bytes}")
    content = await file.read()
    if len(content) > max_bytes:
        raise ApiError(413, "file_too_large", f"File too large for '{str(getattr(file, 'filename', ''))[:80]}': size={len(content)} > {max_bytes}")
    validate_document(file.filename or "document", file.content_type, content, max_bytes)
    resume, version = await _store_uploaded_resume(client, settings, user, file, content)
    write_activity(client, user, "resume_uploaded", "Resume uploaded", "resume", str(resume["id"]))
    return {"resume": resume, "version": version}


@router.get("/resumes/{resume_id}")
def get_resume(
    resume_id: UUID, user: CurrentUser = Depends(get_current_user), settings: Settings = Depends(get_settings)
):
    client = client_for(settings, user)
    resume = owned_row(client, "resumes", resume_id, user)
    resume["versions"] = (
        client.table("resume_versions")
        .select("*")
        .eq("resume_id", str(resume_id))
        .eq("user_id", str(user.id))
        .order("version_number", desc=True)
        .execute()
        .data
        or []
    )
    return resume


@router.patch("/resumes/{resume_id}")
def patch_resume(
    resume_id: UUID,
    payload: dict[str, Any] = Body(...),
    user: CurrentUser = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
):
    client = client_for(settings, user)
    owned_row(client, "resumes", resume_id, user)
    allowed = {k: v for k, v in payload.items() if k in {"title"}}
    return (
        client.table("resumes")
        .update(allowed)
        .eq("id", str(resume_id))
        .eq("user_id", str(user.id))
        .execute()
        .data[0]
    )


@router.delete("/resumes/{resume_id}", status_code=204)
def delete_resume(
    resume_id: UUID, user: CurrentUser = Depends(get_current_user), settings: Settings = Depends(get_settings)
):
    client = client_for(settings, user)
    owned_row(client, "resumes", resume_id, user)
    client.table("resumes").update({"deleted_at": utc_now(), "is_active": False}).eq("id", str(resume_id)).eq(
        "user_id", str(user.id)
    ).execute()
    recalculate_completion(client, user)
    write_activity(client, user, "resume_deleted", "Resume deleted", "resume", str(resume_id))


@router.get("/resumes/{resume_id}/preview")
def preview_resume(
    resume_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
):
    """Return extracted resume text plus a short-lived signed URL for the original file."""
    client = client_for(settings, user)
    resume = owned_row(client, "resumes", resume_id, user)
    if resume.get("deleted_at"):
        raise ApiError(404, "record_not_found", "The requested record was not found.")
    versions = (
        client.table("resume_versions")
        .select(
            "id,version_number,original_filename,mime_type,extraction_status,created_at,"
            "plain_text,structured_content,storage_path,size_bytes,change_metadata"
        )
        .eq("resume_id", str(resume_id))
        .eq("user_id", str(user.id))
        .order("version_number", desc=True)
        .limit(1)
        .execute()
        .data
        or []
    )
    if not versions:
        raise ApiError(404, "resume_version_not_found", "No resume version is available to preview.")
    version = versions[0]
    download_url = None
    storage_path = version.get("storage_path")
    if storage_path:
        try:
            response = client.storage.from_(settings.document_bucket).create_signed_url(
                storage_path, settings.export_signed_url_seconds
            )
            download_url = response.get("signedURL") or response.get("signed_url")
        except Exception:
            download_url = None
    change_meta = version.get("change_metadata") if isinstance(version.get("change_metadata"), dict) else {}
    content_edited = bool(change_meta.get("in_place_edit") or change_meta.get("content_edited_at"))
    return {
        "resume": {
            "id": resume.get("id"),
            "title": resume.get("title"),
            "is_active": resume.get("is_active"),
            "created_at": resume.get("created_at"),
        },
        "version": {
            "id": version.get("id"),
            "version_number": version.get("version_number"),
            "original_filename": version.get("original_filename"),
            "mime_type": version.get("mime_type"),
            "extraction_status": version.get("extraction_status"),
            "created_at": version.get("created_at"),
            "size_bytes": version.get("size_bytes"),
            "plain_text": version.get("plain_text") or "",
            "structured_content": version.get("structured_content") or {},
            "change_metadata": change_meta,
            "content_edited": content_edited,
        },
        "download_url": download_url,
        "expires_in": settings.export_signed_url_seconds if download_url else 0,
        # Prefer regenerated PDF when the existing resume was patched after upload.
        "prefer_rendered_pdf": content_edited,
    }


@router.post("/resumes/{resume_id}/activate")
def activate_resume(
    resume_id: UUID, user: CurrentUser = Depends(get_current_user), settings: Settings = Depends(get_settings)
):
    client = client_for(settings, user)
    resume = owned_row(client, "resumes", resume_id, user)
    if resume.get("deleted_at"):
        raise ApiError(409, "resume_deleted", "A deleted resume cannot be activated. Restore is not supported; upload a new resume.")
    client.table("resumes").update({"is_active": False}).eq("user_id", str(user.id)).execute()
    result = (
        client.table("resumes")
        .update({"is_active": True})
        .eq("id", str(resume_id))
        .eq("user_id", str(user.id))
        .is_("deleted_at", "null")
        .execute()
        .data[0]
    )
    write_activity(client, user, "resume_activated", "Active resume changed", "resume", str(resume_id))
    return result


@router.post("/resumes/{resume_id}/versions", status_code=201)
async def create_resume_version(
    resume_id: UUID,
    file: UploadFile = File(...),
    user: CurrentUser = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
):
    client = client_for(settings, user)
    resume = owned_row(client, "resumes", resume_id, user)
    if resume.get("deleted_at"):
        raise ApiError(409, "resume_deleted", "Cannot upload a new version to a deleted resume.")
    content = await file.read()
    return await _upload_resume_version(client, settings, user, str(resume_id), file, content)


@router.get("/resume-versions/{version_id}")
def get_resume_version(
    version_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
):
    return owned_row(client_for(settings, user), "resume_versions", version_id, user)


@router.patch("/resume-versions/{version_id}/extraction")
def patch_resume_extraction(
    version_id: UUID,
    payload: ExtractionPatch,
    user: CurrentUser = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
):
    client = client_for(settings, user)
    owned_row(client, "resume_versions", version_id, user)
    return (
        client.table("resume_versions")
        .update({"structured_content": payload.structured_content, "extraction_status": "review_required"})
        .eq("id", str(version_id))
        .eq("user_id", str(user.id))
        .execute()
        .data[0]
    )


@router.post("/resume-versions/{version_id}/confirm")
def confirm_resume_extraction(
    version_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
):
    client = client_for(settings, user)
    owned_row(client, "resume_versions", version_id, user)
    result = (
        client.table("resume_versions")
        .update({"extraction_status": "confirmed", "candidate_confirmed_at": utc_now()})
        .eq("id", str(version_id))
        .eq("user_id", str(user.id))
        .execute()
        .data[0]
    )
    recalculate_completion(client, user)
    write_activity(
        client,
        user,
        "resume_extraction_confirmed",
        "Resume extraction confirmed",
        "resume_version",
        str(version_id),
    )
    return result


@router.get("/job-descriptions")
def list_jds(user: CurrentUser = Depends(get_current_user), settings: Settings = Depends(get_settings)):
    return owned_rows(client_for(settings, user), "job_descriptions", user, "created_at")


@router.post("/job-descriptions", status_code=201)
async def create_jd(
    payload: JobDescriptionTextCreate,
    user: CurrentUser = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
):
    client = client_for(settings, user)
    # Text JD has no file bytes — section-parse the raw text only.
    from app.features.document_parsing.pipeline import _clean_structured

    raw_structured = await extract_sections_enriched(
        payload.raw_text,
        settings,
        schema_version="jd-extraction-v1",
        prefer_llm=False,
    )
    structured = _clean_structured(raw_structured, "jd-extraction-v1")
    inferred = infer_job_metadata(payload.raw_text)
    title = (payload.title or "").strip() or inferred["title"] or "Job description"
    role_title = (payload.role_title or "").strip() or inferred["role_title"]
    company = (payload.company or "").strip() or inferred["company"]
    record = {
        "title": title,
        "company": company,
        "role_title": role_title,
        "raw_text": payload.raw_text,
        "user_id": str(user.id),
        "input_type": "text",
        "structured_content": structured,
        "extraction_status": "review_required",
        "extraction_warnings": list(structured.get("warnings") or []),
        "created_at": utc_now(),
    }
    result = client.table("job_descriptions").insert(record).execute().data[0]
    write_activity(
        client, user, "job_description_created", "Job description created", "job_description", result["id"]
    )
    return result


@router.post("/job-descriptions/upload", status_code=201)
async def upload_jd(
    file: UploadFile = File(...),
    title: str | None = Form(default=None),
    company: str | None = Form(default=None),
    role_title: str | None = Form(default=None),
    user: CurrentUser = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
):
    content = await file.read()
    mime = validate_document(
        file.filename or "document", file.content_type, content, settings.document_max_bytes
    )
    text, structured = await parse_document_bytes(
        content, mime_type=mime, settings=settings, schema_version="jd-extraction-v1"
    )
    inferred = infer_job_metadata(text)
    resolved_title = (title or "").strip() or inferred["title"] or infer_resume_title(file.filename)
    resolved_role = (role_title or "").strip() or inferred["role_title"]
    resolved_company = (company or "").strip() or inferred["company"]
    client = client_for(settings, user)
    jd_id = str(uuid.uuid4())
    suffix = ".pdf" if mime == "application/pdf" else ".docx"
    path = f"{user.id}/job-descriptions/{jd_id}/{uuid.uuid4()}{suffix}"
    try:
        client.storage.from_(settings.document_bucket).upload(
            path, content, {"content-type": mime, "upsert": "false"}
        )
        record = {
            "id": jd_id,
            "user_id": str(user.id),
            "title": resolved_title,
            "company": resolved_company,
            "role_title": resolved_role,
            "input_type": "pdf" if mime == "application/pdf" else "docx",
            "original_filename": safe_filename(file.filename or "document"),
            "storage_path": path,
            "mime_type": mime,
            "size_bytes": len(content),
            "sha256": sha256_bytes(content),
            "raw_text": text,
            "structured_content": structured,
            "extraction_status": "review_required",
            "extraction_warnings": list(structured.get("warnings") or []),
            "created_at": utc_now(),
        }
        result = client.table("job_descriptions").insert(record).execute().data[0]
        write_activity(
            client, user, "job_description_created", "Job description uploaded", "job_description", jd_id
        )
        return result
    except Exception as exc:
        try:
            client.storage.from_(settings.document_bucket).remove([path])
        except Exception:
            pass
        if isinstance(exc, ApiError):
            raise
        raise ApiError(
            500, "job_description_upload_failed", "The job description could not be stored."
        ) from exc


@router.get("/job-descriptions/{jd_id}")
def get_jd(
    jd_id: UUID, user: CurrentUser = Depends(get_current_user), settings: Settings = Depends(get_settings)
):
    return owned_row(client_for(settings, user), "job_descriptions", jd_id, user)


@router.patch("/job-descriptions/{jd_id}/metadata")
def patch_jd_metadata(
    jd_id: UUID,
    payload: JobDescriptionMetadataPatch,
    user: CurrentUser = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
):
    """Allow candidate override of auto-detected role/company/title."""
    client = client_for(settings, user)
    owned_row(client, "job_descriptions", jd_id, user)
    updates = {key: value for key, value in payload.model_dump(exclude_none=True).items()}
    if not updates:
        raise ApiError(400, "empty_metadata_patch", "Provide at least one metadata field to update.")
    if "role_title" in updates or "company" in updates:
        role = updates.get("role_title")
        company = updates.get("company")
        if role is None or company is None:
            current = owned_row(client, "job_descriptions", jd_id, user)
            role = role if role is not None else current.get("role_title")
            company = company if company is not None else current.get("company")
        if role and company:
            updates.setdefault("title", f"{role} · {company}"[:200])
        elif role:
            updates.setdefault("title", str(role)[:200])
    result = (
        client.table("job_descriptions")
        .update(updates)
        .eq("id", str(jd_id))
        .eq("user_id", str(user.id))
        .execute()
        .data[0]
    )
    write_activity(
        client,
        user,
        "job_description_updated",
        "Job description metadata updated",
        "job_description",
        str(jd_id),
    )
    return result


@router.patch("/job-descriptions/{jd_id}/extraction")
def patch_jd_extraction(
    jd_id: UUID,
    payload: ExtractionPatch,
    user: CurrentUser = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
):
    client = client_for(settings, user)
    owned_row(client, "job_descriptions", jd_id, user)
    return (
        client.table("job_descriptions")
        .update({"structured_content": payload.structured_content, "extraction_status": "review_required"})
        .eq("id", str(jd_id))
        .eq("user_id", str(user.id))
        .execute()
        .data[0]
    )


@router.post("/job-descriptions/{jd_id}/confirm")
def confirm_jd(
    jd_id: UUID, user: CurrentUser = Depends(get_current_user), settings: Settings = Depends(get_settings)
):
    client = client_for(settings, user)
    owned_row(client, "job_descriptions", jd_id, user)
    result = (
        client.table("job_descriptions")
        .update({"extraction_status": "confirmed", "candidate_confirmed_at": utc_now()})
        .eq("id", str(jd_id))
        .eq("user_id", str(user.id))
        .execute()
        .data[0]
    )
    write_activity(
        client,
        user,
        "job_description_confirmed",
        "Job description extraction confirmed",
        "job_description",
        str(jd_id),
    )
    return result


def _unavailable_resume_payload(
    *,
    resume_id: Any = None,
    title: str = "Resume unavailable",
    original_filename: Any = None,
    version_number: Any = None,
    created_at: Any = None,
) -> dict[str, Any]:
    return {
        "id": resume_id,
        "title": title,
        "original_filename": original_filename,
        "version_number": version_number,
        "created_at": created_at,
        "unavailable": True,
    }


def _unavailable_job_payload() -> dict[str, Any]:
    return {
        "id": None,
        "title": "Job description unavailable",
        "company": None,
        "role_title": None,
        "input_type": None,
        "original_filename": None,
        "created_at": None,
        "unavailable": True,
    }


def _enrich_ats_analysis(
    client, user: CurrentUser, analysis: dict[str, Any], *, include_parsed: bool = False
) -> dict[str, Any]:
    """Attach the resume version and job description used for a stored ATS run.

    Never raises for missing related rows: list history must stay visible even when
    a linked resume/JD was deleted or a legacy analysis row is incomplete.
    """
    enriched = dict(analysis or {})
    version_id = enriched.get("resume_version_id")
    job_id = enriched.get("job_description_id")

    # --- Resume used ---
    try:
        if not version_id:
            enriched["resume"] = _unavailable_resume_payload(title="Resume unavailable (no version linked)")
        else:
            version = owned_row(client, "resume_versions", version_id, user)
            resume_id = version.get("resume_id")
            version_meta = {
                "original_filename": version.get("original_filename"),
                "version_number": version.get("version_number"),
                "created_at": version.get("created_at"),
            }
            try:
                resume = owned_row(client, "resumes", resume_id, user) if resume_id else None
            except ApiError:
                resume = None
            if not resume:
                enriched["resume"] = _unavailable_resume_payload(
                    resume_id=resume_id,
                    title="Resume unavailable",
                    **version_meta,
                )
            elif resume.get("deleted_at"):
                enriched["resume"] = {
                    "id": resume.get("id"),
                    "title": resume.get("title") or "Deleted resume",
                    **version_meta,
                    "unavailable": True,
                }
            else:
                enriched["resume"] = {
                    "id": resume.get("id"),
                    "title": resume.get("title"),
                    **version_meta,
                    "unavailable": False,
                }
            if include_parsed:
                enriched["parsed_inputs"] = {
                    "resume": {
                        "filename": version.get("original_filename"),
                        "extraction_status": version.get("extraction_status"),
                        "plain_text": version.get("plain_text") or "",
                        "structured_content": version.get("structured_content") or {},
                    }
                }
    except Exception as exc:
        logger.warning(
            "ats_enrich_resume_failed analysis_id=%s type=%s",
            enriched.get("id"),
            type(exc).__name__,
        )
        enriched["resume"] = _unavailable_resume_payload()

    # --- Job description used ---
    try:
        if not job_id:
            enriched["job_description"] = {
                **_unavailable_job_payload(),
                "title": "Job description unavailable (none linked)",
            }
        else:
            job = owned_row(client, "job_descriptions", job_id, user)
            enriched["job_description"] = {
                "id": job.get("id"),
                "title": job.get("title"),
                "company": job.get("company"),
                "role_title": job.get("role_title"),
                "input_type": job.get("input_type"),
                "original_filename": job.get("original_filename"),
                "created_at": job.get("created_at"),
                "unavailable": False,
            }
            if include_parsed:
                enriched.setdefault("parsed_inputs", {})["job_description"] = {
                    "filename": job.get("original_filename"),
                    "extraction_status": job.get("extraction_status"),
                    "plain_text": job.get("raw_text") or "",
                    "structured_content": job.get("structured_content") or {},
                }
    except Exception as exc:
        logger.warning(
            "ats_enrich_job_failed analysis_id=%s type=%s",
            enriched.get("id"),
            type(exc).__name__,
        )
        enriched["job_description"] = _unavailable_job_payload()
    return enriched


@router.get("/ats-analyses")
def list_ats(user: CurrentUser = Depends(get_current_user), settings: Settings = Depends(get_settings)):
    client = client_for(settings, user)
    analyses = (
        client.table("ats_analyses")
        .select("*")
        .eq("user_id", str(user.id))
        .execute()
        .data
        or []
    )
    # Client-side recency: Firestore order_by(created_at) hides docs missing created_at.
    analyses = sort_rows_by_recency(analyses, desc=True, preferred="started_at")
    # Keep every candidate-owned run visible; never drop the list on a single bad row.
    output: list[dict[str, Any]] = []
    for row in analyses:
        try:
            output.append(_enrich_ats_analysis(client, user, row))
        except Exception as exc:
            logger.exception(
                "ats_list_enrich_row_failed analysis_id=%s type=%s",
                (row or {}).get("id"),
                type(exc).__name__,
            )
            fallback = dict(row or {})
            fallback.setdefault("resume", _unavailable_resume_payload())
            fallback.setdefault("job_description", _unavailable_job_payload())
            output.append(fallback)
    return output


@router.get("/ats-analyses/{analysis_id}")
def get_ats(
    analysis_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
):
    client = client_for(settings, user)
    return _enrich_ats_analysis(
        client, user, owned_row(client, "ats_analyses", analysis_id, user), include_parsed=True
    )


@router.delete("/ats-analyses/{analysis_id}", status_code=204)
def delete_ats(
    analysis_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
):
    """Delete a candidate-owned ATS analysis and related evidence."""
    client = client_for(settings, user)
    owned_row(client, "ats_analyses", analysis_id, user)
    try:
        # These nullable reference cleanups are independent. Running them in
        # parallel removes two avoidable network round trips from deletion.
        with ThreadPoolExecutor(max_workers=2, thread_name_prefix="ats-delete") as executor:
            detach_runs = executor.submit(
                lambda: client.table("resume_improvement_runs").update({"ats_analysis_id": None}).eq(
                    "ats_analysis_id", str(analysis_id)
                ).eq("user_id", str(user.id)).execute()
            )
            detach_suggestions = executor.submit(
                lambda: client.table("resume_suggestions").update({"analysis_id": None}).eq(
                    "analysis_id", str(analysis_id)
                ).eq("user_id", str(user.id)).execute()
            )
            detach_runs.result()
            detach_suggestions.result()
        client.table("ats_evidence").delete().eq("analysis_id", str(analysis_id)).eq(
            "user_id", str(user.id)
        ).execute()
        client.table("ats_analyses").delete().eq("id", str(analysis_id)).eq(
            "user_id", str(user.id)
        ).execute()
    except ApiError:
        raise
    except Exception as exc:
        raise ApiError(
            503,
            "ats_delete_failed",
            "Could not delete the ATS analysis and related rows. Retry the request.",
        ) from exc
    write_activity(
        client,
        user,
        "ats_analysis_deleted",
        "ATS analysis deleted",
        "ats_analysis",
        str(analysis_id),
    )


@router.post("/ats-analyses", status_code=201)
async def create_ats(
    payload: AtsAnalysisCreate,
    user: CurrentUser = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
):
    client = client_for(settings, user)
    version = owned_row(client, "resume_versions", payload.resume_version_id, user)
    parent_rows = (
        client.table("resumes")
        .select("id,deleted_at")
        .eq("id", str(version.get("resume_id") or ""))
        .eq("user_id", str(user.id))
        .limit(1)
        .execute()
        .data
        or []
    )
    if not parent_rows or parent_rows[0].get("deleted_at"):
        raise ApiError(404, "resume_not_found", "The selected resume is no longer available.")
    job = owned_row(client, "job_descriptions", payload.job_description_id, user)
    if version.get("extraction_status") != "confirmed":
        raise ApiError(409, "resume_not_confirmed", "Confirm the extracted resume before scoring it.")
    if job.get("extraction_status") != "confirmed":
        raise ApiError(409, "job_description_not_confirmed", "Confirm the job description before scoring it.")

    structured = version.get("structured_content") or {}
    structured_sections = structured.get("sections") if isinstance(structured, dict) else None
    if not isinstance(structured_sections, dict):
        structured_sections = None

    # Fingerprint of the exact text used for scoring. Same version/job ids after
    # an in-place edit must re-score, not return a stale completed analysis.
    source_fp = ats_source_fingerprint(
        version.get("plain_text"),
        structured,
        job.get("raw_text"),
        resume_confirmed_at=str(version.get("candidate_confirmed_at") or ""),
        job_confirmed_at=str(job.get("candidate_confirmed_at") or ""),
    )

    existing_rows = (
        client.table("ats_analyses")
        .select("*")
        .eq("user_id", str(user.id))
        .eq("resume_version_id", str(payload.resume_version_id))
        .eq("job_description_id", str(payload.job_description_id))
        .eq("algorithm_version", SCORING_ALGORITHM_VERSION)
        .eq("status", "completed")
        .execute()
        .data
        or []
    )
    existing = sort_rows_by_recency(existing_rows, desc=True, preferred="completed_at")[:1]
    if existing:
        prior = existing[0]
        prior_breakdown = prior.get("score_breakdown") if isinstance(prior.get("score_breakdown"), dict) else {}
        prior_fp = prior_breakdown.get("source_fingerprint") if isinstance(prior_breakdown, dict) else None
        if prior_fp and prior_fp == source_fp:
            return _enrich_ats_analysis(client, user, prior, include_parsed=False)
        # Content changed under the same ids — fall through and re-score.

    try:
        score = score_resume(
            version.get("plain_text") or "",
            job.get("raw_text") or "",
            structured_sections=structured_sections,
        )
    except ValueError as exc:
        raise ApiError(422, "ats_input_insufficient", str(exc)) from exc

    # Single scoring path: deterministic keyword coverage only.
    # Source = JD requirement text. Evidence = exact resume quote or null.
    # Domain compatibility is a separate LLM gate; an unavailable gate is
    # explicitly unverified and must not silently reject or approve the run.
    domain_gate = await evaluate_ats_domain_gate(
        settings,
        resume_text=version.get("plain_text") or "",
        job_description=job.get("raw_text") or "",
        generation_id=source_fp,
    )
    scoring_method = "Evidence-backed keyword coverage"
    persisted_score = 0.0 if domain_gate.get("decision") == "REJECT" else score.overall_score
    score_breakdown = {
        **score.breakdown,
        "method": scoring_method,
        "source_fingerprint": source_fp,
        "domain_gate": domain_gate,
    }
    missing_items = [
        {
            "term": item.requirement,
            "category": item.requirement_type,
            "priority": item.priority,
            "suggested_section": item.suggested_section,
            "match_strength": item.match_strength,
        }
        for item in score.evidence
        if not item.matched
    ]
    matched_items = [
        {
            "term": item.requirement,
            "evidence_line": item.resume_evidence,
            "section": item.resume_section,
            "match_strength": item.match_strength,
            "matched_alias": item.matched_alias,
        }
        for item in score.evidence
        if item.matched
    ]

    now_iso = utc_now()
    analysis = (
        client.table("ats_analyses")
        .insert(
            {
                "user_id": str(user.id),
                "resume_version_id": str(payload.resume_version_id),
                "job_description_id": str(payload.job_description_id),
                "status": "processing",
                "algorithm_version": SCORING_ALGORITHM_VERSION,
                "created_at": now_iso,
                "started_at": now_iso,
            }
        )
        .execute()
        .data[0]
    )
    try:
        evidence_rows = [
            {
                "user_id": str(user.id),
                "analysis_id": analysis["id"],
                "category": "keyword_coverage",
                "requirement_text": item.requirement,
                "requirement_type": item.requirement_type,
                "resume_evidence_text": item.resume_evidence if item.matched else None,
                "resume_section": item.resume_section if item.matched else None,
                "resume_source_reference": {
                    "resume_version_id": str(payload.resume_version_id),
                    "quoted_line": item.resume_evidence if item.matched else None,
                    "section": item.resume_section if item.matched else None,
                    "matched_alias": item.matched_alias if item.matched else None,
                },
                "job_description_source_reference": {
                    "job_description_id": str(payload.job_description_id),
                    "requirement": item.requirement,
                    "requirement_type": item.requirement_type,
                },
                "match_status": evidence_match_status(item.match_strength),
                "score_contribution": item.score_contribution,
                "rule_id": "exact_resume_quote_match_v3",
                "explanation": item.explanation,
            }
            for item in score.evidence
        ]
        if evidence_rows:
            client.table("ats_evidence").insert(evidence_rows).execute()

        brief = await generate_ats_improvement_brief(
            settings,
            overall_score=persisted_score,
            missing_terms=score.missing_terms,
            matched_count=len(score.matched_terms),
            total_terms=len(score.evidence),
            role_title=job.get("role_title") or job.get("title"),
            company=job.get("company"),
            missing_items=missing_items,
            matched_items=matched_items,
            structured_parameter_scores=None,
            domain_gate=domain_gate,
            resume_section_summary=score.section_summary,
            generation_id=str(analysis.get("id")),
        )

        completed_rows = (
            client.table("ats_analyses")
            .update(
                {
                    "status": "completed",
                    "overall_score": persisted_score,
                    "score_breakdown": score_breakdown,
                    "summary": {
                        "method": scoring_method,
                        "matched": len(score.matched_terms),
                        "missing": len(score.missing_terms),
                        "total": len(score.evidence),
                        "missing_terms": score.missing_terms,
                        "partial_terms": score.partial_terms or [],
                        "critical_missing": [
                            item.requirement
                            for item in score.evidence
                            if item.priority == "critical" and not item.matched
                        ],
                        "preferred_missing": [
                            item.requirement
                            for item in score.evidence
                            if item.priority == "preferred" and not item.matched
                        ],
                        "required_score": score.required_score,
                        "preferred_score": score.preferred_score,
                        "section_summary": score.section_summary or {},
                        "domain_gate": domain_gate,
                        "overall_inference": brief.get("overall_inference"),
                        "focus_areas": brief.get("focus_areas") or [],
                        "priority_actions": brief.get("priority_actions") or [],
                        "section_guidance": brief.get("section_guidance") or [],
                        "do_not_claim": brief.get("do_not_claim") or [],
                        "inference_provider": brief.get("provider"),
                        "inference_model": brief.get("model"),
                        "report_status": brief.get("report_status", "unavailable"),
                        "report_generation_id": brief.get("generation_id"),
                        "disclaimer": (
                            "The score is evidence-backed keyword coverage. The narrative report is LLM-generated only. "
                            "This is not a hiring prediction; never add experience that is not in the resume."
                        ),
                    },
                    "completed_at": utc_now(),
                }
            )
            .eq("id", analysis["id"])
            .eq("user_id", str(user.id))
            .execute()
            .data
            or []
        )
        if not completed_rows:
            # Query-by-field miss after insert used to IndexError as a vague 500.
            raise RuntimeError(
                f"ats_analysis_update_returned_empty analysis_id={analysis.get('id')}"
            )
        completed = completed_rows[0]
    except Exception as exc:
        logger.exception(
            "ats_persistence_failed analysis_id=%s type=%s",
            analysis.get("id"),
            type(exc).__name__,
        )
        try:
            client.table("ats_analyses").update(
                {
                    "status": "failed",
                    "error_code": "ats_persistence_failed",
                    "error_message": "Scoring could not be persisted.",
                }
            ).eq("id", analysis["id"]).eq("user_id", str(user.id)).execute()
        except Exception:
            logger.exception(
                "ats_mark_failed_also_failed analysis_id=%s",
                analysis.get("id"),
            )
        raise ApiError(500, "ats_persistence_failed", "The ATS analysis could not be persisted.") from exc

    write_activity(
        client,
        user,
        "ats_analysis_completed",
        "ATS keyword coverage completed",
        "ats_analysis",
        completed["id"],
    )
    # Return the same shape as GET list/detail so the UI can show resume + JD used.
    return _enrich_ats_analysis(client, user, completed, include_parsed=False)


@router.get("/ats-analyses/{analysis_id}/evidence")
def list_ats_evidence(
    analysis_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
):
    client = client_for(settings, user)
    owned_row(client, "ats_analyses", analysis_id, user)
    return (
        client.table("ats_evidence")
        .select("*")
        .eq("analysis_id", str(analysis_id))
        .eq("user_id", str(user.id))
        .order("created_at")
        .execute()
        .data
        or []
    )


@router.get("/ats-analyses/{analysis_id}/suggestions")
def list_suggestions(
    analysis_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
):
    client = client_for(settings, user)
    owned_row(client, "ats_analyses", analysis_id, user)
    return (
        client.table("resume_suggestions")
        .select("*")
        .eq("analysis_id", str(analysis_id))
        .eq("user_id", str(user.id))
        .execute()
        .data
        or []
    )


@router.get("/interviews")
def list_interviews(
    user: CurrentUser = Depends(get_current_user), settings: Settings = Depends(get_settings)
):
    """Return all interview sessions for the signed-in user, newest first.

    Uses the same Firestore collection and user filter as dashboard bootstrap
    (`_latest_actions` / interview counts) so the mock-interview list stays
    aligned with "Last mock interview" on the dashboard.
    """
    return owned_rows(
        client_for(settings, user),
        "interview_sessions",
        user,
        "created_at",
        desc=True,
    )


@router.post("/interview-preparation")
async def create_interview_preparation(
    payload: InterviewPreparationCreate,
    user: CurrentUser = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
):
    """Return a non-persistent preparation plan from confirmed candidate evidence."""
    return await generate_interview_preparation(
        client_for(settings, user),
        settings,
        user,
        resume_version_id=payload.resume_version_id,
        job_description_id=payload.job_description_id,
    )


@router.get("/interviews/tts/status")
def interview_tts_status(
    user: CurrentUser | None = Depends(get_current_user_optional),
    settings: Settings = Depends(get_settings),
):
    """Whether a server interviewer voice is available (no secrets leaked)."""
    _ = user
    from app.features.interview.tts import preferred_tts_provider

    groq_ready = bool(settings.groq_tts_configured)
    nvidia_ready = bool(settings.nvidia_tts_configured)
    fish_ready = bool(settings.fish_audio_configured)
    configured = groq_ready or nvidia_ready or fish_ready
    stt_configured = bool(settings.groq_configured)
    chain: list[str] = []
    if groq_ready:
        chain.append("groq_orpheus")
    if nvidia_ready:
        chain.append("nvidia_magpie")
    if fish_ready:
        chain.append("fish_audio")
    chain.append("browser_speech_synthesis")
    provider = preferred_tts_provider(settings)
    if groq_ready:
        model = (settings.groq_tts_model or "").strip() or None
        voice = (settings.groq_tts_voice or "").strip() or None
    elif nvidia_ready:
        model = "nvidia/magpie-tts-multilingual"
        voice = (settings.nvidia_tts_voice or "").strip() or None
    else:
        model = (settings.fish_audio_model or "").strip() or None
        voice = None
    fallbacks = chain[1:]
    return {
        "provider": provider,
        "configured": configured,
        "model": model,
        "voice": voice,
        "fallback": fallbacks[0] if fallbacks else "browser_speech_synthesis",
        "fallbacks": fallbacks,
        "stt_provider": "groq_whisper" if stt_configured else None,
        "stt_configured": stt_configured,
    }


@router.post("/interviews/tts")
def interview_tts(
    payload: InterviewTtsRequest,
    user: CurrentUser | None = Depends(get_current_user_optional),
    settings: Settings = Depends(get_settings),
):
    """
    Synthesize interviewer speech. Tries Groq Orpheus, then NVIDIA Magpie, then Fish.
    Clients should fall back to browser TTS on 503 so the session never stalls silent.
    """
    _ = user
    if not settings.interviewer_tts_configured:
        raise ApiError(
            503,
            "tts_unavailable",
            "Interviewer voice is not configured. Set GROQ_API_KEY or NVIDIA_API_KEY, or use browser speech.",
        )
    from app.features.interview.tts import synthesize_speech

    try:
        audio, media_type, provider = synthesize_speech(settings, payload.text)
    except ValueError as exc:
        raise ApiError(400, "tts_invalid_text", str(exc)) from exc
    except RuntimeError as exc:
        raise ApiError(503, "tts_provider_error", str(exc)) from exc

    return PlainResponse(
        content=audio,
        media_type=media_type,
        headers={
            "Cache-Control": "no-store",
            "X-TTS-Provider": provider,
            "X-TTS-Kind": payload.kind,
        },
    )


@router.post("/interviews/transcribe")
async def interview_transcribe(
    audio: UploadFile = File(...),
    user: CurrentUser | None = Depends(get_current_user_optional),
    settings: Settings = Depends(get_settings),
):
    """Verbatim speech-to-text for a spoken answer (Groq Whisper). Keeps filler words."""
    _ = user
    from app.features.interview.transcribe import MAX_AUDIO_BYTES, transcribe_audio

    if not settings.groq_configured:
        raise ApiError(
            503,
            "stt_unavailable",
            "Speech transcription is not configured. Browser speech recognition remains available.",
        )
    raw = await audio.read()
    if not raw:
        raise ApiError(400, "stt_empty_audio", "Audio is empty.")
    if len(raw) > MAX_AUDIO_BYTES:
        raise ApiError(413, "stt_audio_too_large", "Audio is too large to transcribe.")
    filename = (audio.filename or "answer.webm").strip() or "answer.webm"
    content_type = (audio.content_type or "audio/webm").split(";")[0]
    try:
        transcript = transcribe_audio(
            settings,
            raw,
            filename=filename,
            content_type=content_type,
        )
    except ValueError as exc:
        raise ApiError(400, "stt_invalid_audio", str(exc)) from exc
    except RuntimeError as exc:
        raise ApiError(503, "stt_provider_error", str(exc)) from exc
    return {"transcript": transcript, "provider": "groq_whisper"}


@router.post("/interviews/commit", status_code=201)
async def commit_interview(
    payload: InterviewCommit,
    user: CurrentUser = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
):
    """Save a finished live interview (questions + answers) and build the debrief.

    The live round runs on the client with no per-answer writes. This is the
    single persistence + agent pass after the candidate completes the session.
    """
    client = client_for(settings, user)
    body = payload.session.model_dump(mode="json")
    for key in ("target_role", "target_company", "topic", "difficulty", "job_description_text"):
        value = body.get(key)
        if isinstance(value, str):
            cleaned = value.strip()
            body[key] = cleaned or None
    if body.get("job_description_text"):
        body["job_description_text"] = str(body["job_description_text"])[:20_000]
    result = await commit_live_interview(
        client,
        settings,
        user,
        session_fields=body,
        questions_in=[item.model_dump(mode="json") for item in payload.questions],
        responses_in=[item.model_dump(mode="json") for item in payload.responses],
        now=utc_now(),
    )
    write_activity(
        client,
        user,
        "interview_completed",
        "Live mock interview saved with debrief report",
        "interview_session",
        str(result["session"]["id"]),
    )
    return result


@router.post("/interviews", status_code=201)
def create_interview(
    payload: InterviewCreate,
    user: CurrentUser = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
):
    """Create a draft mock-interview session (mode, role, optional pasted JD text)."""
    client = client_for(settings, user)
    body = payload.model_dump(mode="json")
    # Normalize empty strings so Firestore does not store noise fields.
    for key in ("target_role", "target_company", "topic", "difficulty", "job_description_text"):
        value = body.get(key)
        if isinstance(value, str):
            cleaned = value.strip()
            body[key] = cleaned or None
    if body.get("job_description_text"):
        body["job_description_text"] = str(body["job_description_text"])[:20_000]
    return (
        client.table("interview_sessions")
        .insert(
            {
                **body,
                "user_id": str(user.id),
                "created_at": utc_now(),
                "status": "draft",
            }
        )
        .execute()
        .data[0]
    )


@router.get("/interviews/{session_id}")
def get_interview(
    session_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
):
    client = client_for(settings, user)
    session = owned_row(client, "interview_sessions", session_id, user)
    questions = (
        client.table("interview_questions")
        .select("id,position,question,question_type,source_context,created_at")
        .eq("session_id", str(session_id))
        .eq("user_id", str(user.id))
        .order("position")
        .execute()
        .data
        or []
    )
    return {"session": session, "questions": questions}


@router.delete("/interviews/{session_id}", status_code=204)
def delete_interview(
    session_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
):
    """
    Permanently delete a mock interview session for the signed-in candidate.
    Cascades to interview_questions, interview_responses, and interview_reports in DB.
    Also removes any interview media files referenced by responses.
    """
    client = client_for(settings, user)
    owned_row(client, "interview_sessions", session_id, user)

    # Media is no longer stored, so no storage cleanup is needed.
    # Firestore has no FK cascade — delete children first (same pattern as learning paths).
    sid = str(session_id)
    uid = str(user.id)
    client.table("interview_reports").delete().eq("session_id", sid).eq("user_id", uid).execute()
    client.table("interview_responses").delete().eq("session_id", sid).eq("user_id", uid).execute()
    client.table("interview_questions").delete().eq("session_id", sid).eq("user_id", uid).execute()
    client.table("interview_sessions").delete().eq("id", sid).eq("user_id", uid).execute()
    write_activity(
        client,
        user,
        "interview_deleted",
        "Mock interview session deleted",
        "interview_session",
        sid,
    )


@router.post("/interviews/{session_id}/start")
async def start_interview(
    session_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
):
    """
    Start a session and generate practice questions via the preferred LLM
    failover chain (LLM_PROVIDER first, then the other configured provider).
    Falls back to no questions (retryable 503) when all providers fail.
    """
    client = client_for(settings, user)
    session = owned_row(client, "interview_sessions", session_id, user)
    result = (
        client.table("interview_sessions")
        .update({"status": "in_progress", "started_at": utc_now()})
        .eq("id", str(session_id))
        .eq("user_id", str(user.id))
        .execute()
        .data[0]
    )

    existing = (
        client.table("interview_questions")
        .select("id")
        .eq("session_id", str(session_id))
        .eq("user_id", str(user.id))
        .limit(1)
        .execute()
        .data
        or []
    )
    questions_payload: dict[str, Any] = {"questions": [], "provider": None, "model": None}
    if not existing:
        count = int(session.get("question_count") or 3)
        resume_text: str | None = None
        candidate_skills: list[str] | None = None
        if session.get("resume_version_id"):
            res_rows = (
                client.table("resume_versions")
                .select("plain_text,structured_content")
                .eq("id", str(session["resume_version_id"]))
                .eq("user_id", str(user.id))
                .limit(1)
                .execute()
                .data
                or []
            )
            if res_rows:
                resume_text = str(res_rows[0].get("plain_text") or "")
            skill_rows = (
                client.table("candidate_skills")
                .select("name")
                .eq("user_id", str(user.id))
                .execute()
                .data
                or []
            )
            if skill_rows:
                candidate_skills = [str(r.get("name")) for r in skill_rows if r.get("name")]

        try:
            questions_payload = await generate_interview_questions(
                settings,
                mode=str(session.get("mode") or "mixed"),
                count=count,
                target_role=session.get("target_role"),
                target_company=session.get("target_company"),
                difficulty=session.get("difficulty"),
                topic=session.get("topic"),
                job_description_text=session.get("job_description_text"),
                resume_text=resume_text,
                candidate_skills=candidate_skills,
            )
        except Exception as exc:
            # Producer fallback: enrich error with type/truncated value, then local templates — do NOT swallow at crash site.
            # Keep telemetry visible via ApiError enrichment in generator; here provide deterministic fallback.
            from app.core.errors import ApiError as _ApiErr
            if isinstance(exc, _ApiErr):
                # Already enriched with type/value
                pass
            else:
                # Wrap unexpected so telemetry captures truncated context
                raise _ApiErr(502, "llm_returned_no_questions", f"Interview generation failed: type={type(exc).__name__}, value={str(exc)[:120]}") from exc
            # Deterministic local templates when all providers fail — preserves contract (no 503).
            templates = {
                "behavioral": "Tell me about a time your plan changed and how you adapted.",
                "technical": "Walk me through how you would approach a technical problem in your domain.",
                "mixed": "Describe a challenging project and the decisions you made.",
            }
            base = templates.get(str(session.get("mode") or "mixed").strip().lower(), templates["mixed"])
            questions_payload = {
                "questions": [{"question": f"{base} (Question {i+1})", "question_type": str(session.get("mode") or "mixed")[:80]} for i in range(count)],
                "provider": "template",
                "model": "local-template-v1",
                "agent": "interview_questions",
                "fallback": True,
                "fallback_reason": f"type={type(exc).__name__}, value={str(exc)[:80]}",
            }
        rows = []
        for index, item in enumerate(questions_payload.get("questions") or [], start=1):
            rows.append(
                {
                    "user_id": str(user.id),
                    "session_id": str(session_id),
                    "position": index,
                    "question": str(item.get("question") or "").strip()[:800],
                    "question_type": (item.get("question_type") or session.get("mode") or "mixed")[:80],
                    "source_context": {
                        "provider": questions_payload.get("provider"),
                        "model": questions_payload.get("model"),
                    },
                }
            )
        if rows:
            client.table("interview_questions").insert(rows).execute()

    questions = (
        client.table("interview_questions")
        .select("id,position,question,question_type,source_context,created_at")
        .eq("session_id", str(session_id))
        .eq("user_id", str(user.id))
        .order("position")
        .execute()
        .data
        or []
    )
    write_activity(
        client, user, "interview_started", "Interview session started", "interview_session", str(session_id)
    )
    return {
        "session": result,
        "questions": questions,
        "question_provider": questions_payload.get("provider"),
        "question_model": questions_payload.get("model"),
        "agent": questions_payload.get("agent") or "interview_questions",
        "fallback": bool(questions_payload.get("fallback")),
        "fallback_reason": questions_payload.get("fallback_reason"),
    }


@router.post("/interviews/{session_id}/responses", status_code=201)
async def add_response(
    session_id: UUID,
    payload: InterviewResponseCreate,
    user: CurrentUser = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
):
    """Store an answer, return live interviewer reply, and optionally insert a follow-up."""
    client = client_for(settings, user)
    session = owned_row(client, "interview_sessions", session_id, user)
    question_rows = (
        client.table("interview_questions")
        .select("id,question,question_type,position,source_context")
        .eq("id", str(payload.question_id))
        .eq("session_id", str(session_id))
        .eq("user_id", str(user.id))
        .limit(1)
        .execute()
        .data
        or []
    )
    if not question_rows:
        raise ApiError(404, "question_not_found", "The question does not belong to this interview session.")
    question = question_rows[0]
    answer_text = (payload.transcript or payload.typed_response or "").strip()
    client_speech = payload.speech_metrics if isinstance(payload.speech_metrics, dict) else None
    client_gaze = payload.gaze_metrics if isinstance(payload.gaze_metrics, dict) else None
    existing_questions = (
        client.table("interview_questions")
        .select("id,position,question,question_type,source_context")
        .eq("session_id", str(session_id))
        .eq("user_id", str(user.id))
        .order("position")
        .execute()
        .data
        or []
    )
    existing_responses = (
        client.table("interview_responses")
        .select("question_id,transcript,typed_response")
        .eq("session_id", str(session_id))
        .eq("user_id", str(user.id))
        .execute()
        .data
        or []
    )
    answer_by_question = {
        str(row.get("question_id")): str(row.get("transcript") or row.get("typed_response") or "")
        for row in existing_responses
        if row.get("question_id")
    }
    recent_turns = [
        {
            "question": str(item.get("question") or "")[:400],
            "answer": str(answer_by_question.get(str(item.get("id"))) or "")[:800],
            "question_type": item.get("question_type"),
        }
        for item in existing_questions
        if answer_by_question.get(str(item.get("id")))
    ][-6:]
    already_followed_up = is_follow_up_question(question.get("source_context"))
    follow_ups_used = sum(
        1 for item in existing_questions if is_follow_up_question(item.get("source_context"))
    )
    evaluation = await evaluate_interview_answer(
        settings,
        question=str(question.get("question") or ""),
        answer=answer_text,
        question_type=question.get("question_type"),
        target_role=session.get("target_role"),
        mode=session.get("mode"),
        duration_seconds=payload.duration_seconds,
        gaze_metrics=client_gaze,
        recent_turns=recent_turns,
        already_followed_up=already_followed_up,
        follow_ups_used=follow_ups_used,
        seed_count=int(session.get("question_count") or 5),
    )
    # Prefer server-measured delivery; optionally merge client speech_metrics duration if server lacks it.
    if client_speech and not evaluation.get("speaking_delivery", {}).get("duration_seconds"):
        raw_dur = client_speech.get("duration_seconds")
        try:
            if raw_dur is not None and float(raw_dur) > 0:
                from app.features.interview.agent.evaluator import analyze_speaking_delivery

                evaluation["speaking_delivery"] = analyze_speaking_delivery(
                    answer_text, float(raw_dur)
                )
        except (TypeError, ValueError):
            pass
    row = {
        "question_id": str(payload.question_id),
        "typed_response": payload.typed_response,
        "transcript": payload.transcript,
        "duration_seconds": payload.duration_seconds,
        "speech_metrics": client_speech,
        "gaze_metrics": evaluation.get("gaze_metrics") or client_gaze,
        "session_id": str(session_id),
        "user_id": str(user.id),
        "created_at": utc_now(),
        "evaluation": evaluation,
        "score": evaluation.get("score"),
        "verdict": evaluation.get("verdict"),
        "filler_analysis": evaluation.get("filler_analysis") or {},
        "speaking_delivery": evaluation.get("speaking_delivery") or {},
    }
    saved = client.table("interview_responses").insert(row).execute().data[0]

    follow_up_row = None
    follow_text = str(evaluation.get("follow_up_question") or "").strip()
    under_budget = len(existing_questions) < max_question_budget(session)
    if evaluation.get("should_follow_up") and follow_text and under_budget and not already_followed_up:
        current_pos = int(question.get("position") or 0)
        later = sorted(
            [item for item in existing_questions if int(item.get("position") or 0) > current_pos],
            key=lambda item: int(item.get("position") or 0),
            reverse=True,
        )
        for item in later:
            client.table("interview_questions").update(
                {"position": int(item.get("position") or 0) + 1}
            ).eq("id", str(item.get("id"))).eq("user_id", str(user.id)).execute()
        inserted = (
            client.table("interview_questions")
            .insert(
                {
                    "user_id": str(user.id),
                    "session_id": str(session_id),
                    "position": current_pos + 1,
                    "question": follow_text[:800],
                    "question_type": "follow_up",
                    "source_context": {
                        "kind": "follow_up",
                        "parent_question_id": str(question.get("id")),
                        "provider": evaluation.get("provider"),
                    },
                    "created_at": utc_now(),
                }
            )
            .execute()
            .data
            or []
        )
        follow_up_row = inserted[0] if inserted else None

    questions = (
        client.table("interview_questions")
        .select("id,position,question,question_type,source_context,created_at")
        .eq("session_id", str(session_id))
        .eq("user_id", str(user.id))
        .order("position")
        .execute()
        .data
        or []
    )
    return {
        "response": saved,
        "evaluation": evaluation,
        "follow_up": follow_up_row,
        "questions": questions,
        "question": {
            "id": question.get("id"),
            "position": question.get("position"),
            "question": question.get("question"),
            "question_type": question.get("question_type"),
        },
    }


async def _create_interview_report(
    client,
    settings: Settings,
    user: CurrentUser,
    session_id: UUID,
    session: dict[str, Any],
) -> dict[str, Any]:
    """Build and persist the latest report for a session.

    This is shared by completion and the report read path so completed legacy
    sessions without a report can be repaired on first view.
    """
    questions = (
        client.table("interview_questions")
        .select("id,position,question,question_type")
        .eq("session_id", str(session_id))
        .eq("user_id", str(user.id))
        .order("position")
        .execute()
        .data
        or []
    )
    responses = (
        client.table("interview_responses")
        .select("*")
        .eq("session_id", str(session_id))
        .eq("user_id", str(user.id))
        .execute()
        .data
        or []
    )
    latest_by_q: dict[str, dict[str, Any]] = {}
    for row in responses:
        qid = str(row.get("question_id") or "")
        if not qid:
            continue
        previous = latest_by_q.get(qid)
        if previous is None or str(row.get("created_at") or "") >= str(previous.get("created_at") or ""):
            latest_by_q[qid] = row

    turns: list[dict[str, Any]] = []
    for question in questions:
        qid = str(question.get("id") or "")
        response = latest_by_q.get(qid)
        if not response:
            turns.append(
                {
                    "question_id": qid,
                    "position": question.get("position"),
                    "question": question.get("question"),
                    "question_type": question.get("question_type"),
                    "answer": "[No answer provided]",
                    "unattempted": True,
                    "evaluation": {
                        "verdict": "unattempted",
                        "score": 0,
                        "interviewer_feedback": "This question was skipped or not answered.",
                        "strengths": [],
                        "improvements": ["Attempt every question to practice full interview coverage."],
                    },
                    "gaze_metrics": None,
                }
            )
            continue
        answer = (response.get("transcript") or response.get("typed_response") or "").strip()
        evaluation = response.get("evaluation") or {}
        if not evaluation and answer:
            evaluation = await evaluate_interview_answer(
                settings,
                question=str(question.get("question") or ""),
                answer=answer,
                question_type=question.get("question_type"),
                target_role=session.get("target_role"),
                mode=session.get("mode"),
                duration_seconds=response.get("duration_seconds"),
            )
        if isinstance(evaluation, dict) and not evaluation.get("gaze_metrics"):
            # Prefer metrics stored on the response document when eval payload is older.
            if response.get("gaze_metrics"):
                evaluation = {**evaluation, "gaze_metrics": response.get("gaze_metrics")}
        turns.append(
            {
                "question_id": qid,
                "position": question.get("position"),
                "question": question.get("question"),
                "question_type": question.get("question_type"),
                "answer": answer,
                "evaluation": evaluation,
                "gaze_metrics": (evaluation or {}).get("gaze_metrics")
                if isinstance(evaluation, dict)
                else response.get("gaze_metrics"),
            }
        )

    report_body = await generate_interview_session_report(
        settings,
        turns=turns,
        target_role=session.get("target_role"),
        mode=session.get("mode"),
    )
    report_row = {
        "user_id": str(user.id),
        "session_id": str(session_id),
        "created_at": utc_now(),
        "status": "ready",
        "overall_score": report_body.get("overall_score"),
        "communication_score": report_body.get("communication_score"),
        "structure_score": report_body.get("structure_score"),
        "content_score": report_body.get("content_score"),
        "summary": report_body.get("overall_summary"),
        "report": report_body,
        "provider": report_body.get("provider"),
        "model": report_body.get("model"),
        "report_version": report_body.get("report_version") or INTERVIEW_REPORT_VERSION,
    }
    existing_reports = (
        client.table("interview_reports")
        .select("id")
        .eq("session_id", str(session_id))
        .eq("user_id", str(user.id))
        .execute()
        .data
        or []
    )
    for old in existing_reports:
        if old.get("id"):
            client.table("interview_reports").delete().eq("id", str(old["id"])).eq(
                "user_id", str(user.id)
            ).execute()
    return client.table("interview_reports").insert(report_row).execute().data[0]


@router.post("/interviews/{session_id}/complete")
async def complete_interview(
    session_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
):
    """Mark session complete and persist a detailed debrief report."""
    client = client_for(settings, user)
    session = owned_row(client, "interview_sessions", session_id, user)
    questions = (
        client.table("interview_questions")
        .select("id")
        .eq("session_id", str(session_id))
        .eq("user_id", str(user.id))
        .execute()
        .data
        or []
    )
    answered = (
        client.table("interview_responses")
        .select("question_id")
        .eq("session_id", str(session_id))
        .eq("user_id", str(user.id))
        .execute()
        .data
        or []
    )
    answered_ids = {str(row.get("question_id")) for row in answered if row.get("question_id")}
    required_ids = {str(row.get("id")) for row in questions if row.get("id")}
    if required_ids - answered_ids:
        raise ApiError(409, "interview_questions_unanswered", "Answer every interview question before completing the session.")
    result = (
        client.table("interview_sessions")
        .update({"status": "completed", "completed_at": utc_now()})
        .eq("id", str(session_id))
        .eq("user_id", str(user.id))
        .execute()
        .data[0]
    )
    saved_report = await _create_interview_report(client, settings, user, session_id, session)
    write_activity(
        client,
        user,
        "interview_completed",
        "Interview session completed with debrief report",
        "interview_session",
        str(session_id),
    )
    return {
        "session": result,
        "report": saved_report,
        "message": "Session completed. Review your detailed debrief report.",
    }


@router.get("/interviews/{session_id}/report")
async def get_interview_report(
    session_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
):
    client = client_for(settings, user)
    session = owned_row(client, "interview_sessions", session_id, user)
    rows = (
        client.table("interview_reports")
        .select("*")
        .eq("session_id", str(session_id))
        .eq("user_id", str(user.id))
        .execute()
        .data
        or []
    )
    current = rows[0] if rows else None
    if not rows or current.get("report_version") != INTERVIEW_REPORT_VERSION:
        if session.get("status") != "completed":
            raise ApiError(
                404,
                "report_not_found",
                "No debrief report for this session yet. Complete the session to generate one.",
            )
        rows = [await _create_interview_report(client, settings, user, session_id, session)]
    # Prefer newest by created_at when multiple exist.
    rows = sort_rows_by_recency(rows, desc=True, preferred="created_at")
    return {"session": session, "report": rows[0]}


def _sort_learning_items(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return sorted(
        items,
        key=lambda row: (
            row.get("position") is None,
            int(row["position"]) if isinstance(row.get("position"), (int, float)) else 10**9,
            str(row.get("id") or ""),
        ),
    )


def _load_learning_resources_for_items(client, user: CurrentUser, item_ids: list[str]) -> dict[str, list[dict[str, Any]]]:
    by_item: dict[str, list[dict[str, Any]]] = {}
    if not item_ids:
        return by_item
    resources = (
        client.table("learning_resources")
        .select("*")
        .eq("user_id", str(user.id))
        .in_("learning_item_id", item_ids)
        .execute()
        .data
        or []
    )
    for resource in resources:
        row = with_watch_defaults(resource)
        by_item.setdefault(str(resource.get("learning_item_id") or ""), []).append(row)
    return by_item


def _persist_path_rollup(client, user: CurrentUser, path_id: str, items: list[dict[str, Any]]) -> dict[str, Any]:
    rollup = path_rollup(items)
    client.table("learning_paths").update({
        "progress_percentage": rollup["progress_percentage"],
        "status": rollup["status"],
        "watch_summary": rollup["watch_summary"],
        "updated_at": utc_now(),
    }).eq("id", str(path_id)).eq("user_id", str(user.id)).execute()
    return rollup


def _first_row(result: Any) -> dict[str, Any] | None:
    data = getattr(result, "data", None)
    if isinstance(data, list) and data:
        row = data[0]
        return row if isinstance(row, dict) else None
    return None


@router.get("/learning-paths")
def list_learning(user: CurrentUser = Depends(get_current_user), settings: Settings = Depends(get_settings)):
    """List learning paths with lightweight item summaries for list-card counts.

    Full resources are loaded only on GET /learning-paths/{path_id}.
    """
    client = client_for(settings, user)
    paths = owned_rows(client, "learning_paths", user, "created_at")
    if not paths:
        return paths
    path_ids = {str(path.get("id")) for path in paths if path.get("id")}
    # One user-scoped query — avoid per-path round-trips and unchunked in_ limits.
    all_items = (
        client.table("learning_items")
        .select("id,learning_path_id,status,title,position")
        .eq("user_id", str(user.id))
        .execute()
        .data
        or []
    )
    item_ids = [
        str(item.get("id"))
        for item in all_items
        if item.get("id") and str(item.get("learning_path_id") or "") in path_ids
    ]
    by_item_resources = _load_learning_resources_for_items(client, user, item_ids)
    by_path: dict[str, list[dict[str, Any]]] = {}
    for item in all_items:
        pid = str(item.get("learning_path_id") or "")
        if pid not in path_ids:
            continue
        row = dict(item)
        resources = by_item_resources.get(str(item.get("id")), [])
        row["learning_resources"] = resources
        row["watch_percent"] = item_percent(row)
        if resources:
            row["status"] = item_status_from_percent(row["watch_percent"])
        by_path.setdefault(pid, []).append(row)
    for path in paths:
        pid = str(path.get("id") or "")
        items = _sort_learning_items(by_path.get(pid, []))
        rollup = path_rollup(items)
        path["item_count"] = len(items)
        path["progress_percentage"] = rollup["progress_percentage"]
        path["status"] = rollup["status"] if items else (path.get("status") or "active")
        path["watch_summary"] = rollup["watch_summary"]
        # Lightweight items (no resources) so the list UI can show step counts.
        path["items"] = [
            {
                "id": item.get("id"),
                "title": item.get("title"),
                "status": item.get("status") or "pending",
                "position": item.get("position"),
                "watch_percent": item.get("watch_percent") or 0,
            }
            for item in items
        ]
    return paths


@router.get("/learning-paths/{path_id}")
def get_learning(
    path_id: UUID, user: CurrentUser = Depends(get_current_user), settings: Settings = Depends(get_settings)
):
    client = client_for(settings, user)
    path = owned_row(client, "learning_paths", path_id, user)
    items = _sort_learning_items(
        client.table("learning_items")
        .select("*")
        .eq("learning_path_id", str(path_id))
        .eq("user_id", str(user.id))
        .execute()
        .data
        or []
    )
    item_ids = [str(item.get("id")) for item in items if item.get("id")]
    by_item = _load_learning_resources_for_items(client, user, item_ids)
    attached: list[dict[str, Any]] = []
    for item in items:
        row = dict(item)
        resources = by_item.get(str(item.get("id")), [])
        row["learning_resources"] = resources
        row["watch_percent"] = item_percent(row)
        if resources:
            row["status"] = item_status_from_percent(row["watch_percent"])
        attached.append(row)
    rollup = path_rollup(attached)
    path["items"] = attached
    path["item_count"] = len(attached)
    path["progress_percentage"] = rollup["progress_percentage"]
    path["status"] = rollup["status"] if attached else (path.get("status") or "active")
    path["watch_summary"] = rollup["watch_summary"]
    return path


@router.delete("/learning-paths/{path_id}", status_code=204)
def delete_learning_path(
    path_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
):
    """Delete a candidate-owned learning path and cascade items/resources."""
    client = client_for(settings, user)
    owned_row(client, "learning_paths", path_id, user)
    items = (
        client.table("learning_items")
        .select("id")
        .eq("learning_path_id", str(path_id))
        .eq("user_id", str(user.id))
        .execute()
        .data
        or []
    )
    item_ids = [str(item.get("id")) for item in items if item.get("id")]
    if item_ids:
        client.table("learning_resources").delete().eq("user_id", str(user.id)).in_(
            "learning_item_id", item_ids
        ).execute()
    client.table("learning_items").delete().eq("learning_path_id", str(path_id)).eq(
        "user_id", str(user.id)
    ).execute()
    client.table("learning_paths").delete().eq("id", str(path_id)).eq("user_id", str(user.id)).execute()
    write_activity(
        client,
        user,
        "learning_path_deleted",
        "Learning path deleted",
        "learning_path",
        str(path_id),
    )


@router.post("/learning-paths", status_code=201)
def create_learning(
    payload: LearningPathCreate,
    user: CurrentUser = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
):
    return (
        client_for(settings, user)
        .table("learning_paths")
        .insert({**payload.model_dump(), "user_id": str(user.id)})
        .execute()
        .data[0]
    )


@router.post("/learning-paths/generate", status_code=201)
async def generate_learning_path(
    payload: LearningPathGenerate,
    user: CurrentUser = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
):
    """Create a YouTube-backed learning path from a completed ATS analysis only.

    Crew (sequential, CrewAI-compatible):
      1) ATS gap analyst (deterministic evidence extract)
      2) YouTube curriculum planner (Groq LLM or deterministic) — queries only
      3) Resource validator: YouTube Data API exact videos (no invented IDs)
    """
    client = client_for(settings, user)
    analyses = (
        client.table("ats_analyses")
        .select("*")
        .eq("user_id", str(user.id))
        .eq("status", "completed")
        .order("created_at", desc=True)
        .limit(1)
        .execute()
        .data
        or []
    )
    if payload.source_analysis_id:
        analyses = (
            client.table("ats_analyses")
            .select("*")
            .eq("id", str(payload.source_analysis_id))
            .eq("user_id", str(user.id))
            .eq("status", "completed")
            .limit(1)
            .execute()
            .data
            or []
        )
    if not analyses:
        raise ApiError(409, "completed_ats_required", "Complete an ATS analysis before generating a learning path.")
    analysis = analyses[0]
    resume_version_id = analysis.get("resume_version_id")
    if not resume_version_id:
        raise ApiError(
            409,
            "completed_ats_required",
            "Complete an ATS analysis before generating a learning path.",
        )
    version = owned_row(client, "resume_versions", resume_version_id, user)
    resume = owned_row(client, "resumes", version["resume_id"], user)
    # Optional role context from linked JD (never invents a role)
    role_title: str | None = None
    jd: dict[str, Any] | None = None
    jd_id = analysis.get("job_description_id")
    if jd_id:
        try:
            jd = owned_row(client, "job_descriptions", jd_id, user)
            role_title = str(jd.get("role_title") or jd.get("title") or "").strip() or None
        except Exception:
            jd = None
            role_title = None
    evidence = (
        client.table("ats_evidence")
        .select("requirement_text,match_status,category,explanation")
        .eq("analysis_id", analysis["id"])
        .eq("user_id", str(user.id))
        .order("created_at")
        .execute()
        .data
        or []
    )
    generated = await generate_learning_path_from_ats(
        settings,
        evidence_rows=evidence,
        source_analysis_id=str(analysis["id"]),
        role_title=role_title,
    )
    items = list(generated.get("items") or [])
    crew_meta = generated.get("crew") if isinstance(generated.get("crew"), dict) else {}
    if crew_meta.get("success") is False:
        raise ApiError(
            502,
            "learning_path_generation_failed",
            str(crew_meta.get("message") or "Learning path generation failed. Check ATS evidence and YouTube API configuration."),
        )
    if not items:
        raise ApiError(
            422,
            "no_learning_gaps",
            "No missing or partial ATS requirements were available to build a learning path.",
        )
    algorithm_version = str(generated.get("algorithm_version") or CAREER_MATCH_ALGORITHM_VERSION)
    source_snapshot = build_ats_source_snapshot(
        analysis=analysis,
        resume=resume,
        job=jd,
        evidence_rows=evidence,
        role_title=role_title,
    )
    role_label = source_snapshot.get("role_title") or resume.get("title") or "your resume"
    path = client.table("learning_paths").insert({
        "user_id": str(user.id),
        "title": f"Skill gap path · {role_label}",
        "description": (
            "Study plan from requirements not fully evidenced in your completed ATS analysis. "
            "Each step includes free video lessons and blogs/articles grounded in those gaps. "
            "Watch progress is saved as you play each lesson — skipping ahead does not count."
        ),
        "source_type": "ats_analysis",
        "source_id": str(analysis["id"]),
        "source_snapshot": source_snapshot,
        "algorithm_version": algorithm_version,
        "status": "active",
        "progress_percentage": 0,
        "watch_summary": {
            "resource_count": 0,
            "completed_resources": 0,
            "watched_percent": 0,
            "last_watched_at": None,
            "last_resource_id": None,
            "last_resource_title": None,
            "last_item_id": None,
        },
    }).execute().data[0]
    stored_items = []
    for item in items:
        resources = item.pop("resources", [])
        # Ensure metadata remains a plain JSON-serializable mapping for Firestore.
        metadata = item.get("metadata")
        if isinstance(metadata, dict):
            item = {**item, "metadata": metadata}
        stored = client.table("learning_items").insert({
            **item,
            "user_id": str(user.id),
            "learning_path_id": path["id"],
            "status": "pending",
        }).execute().data[0]
        stored_resources = []
        for resource in resources:
            inserted = client.table("learning_resources").insert({
                **resource,
                **empty_watch_fields(),
                "user_id": str(user.id),
                "learning_item_id": stored["id"],
            }).execute()
            row = _first_row(inserted)
            stored_resources.append(with_watch_defaults(row or {**resource, **empty_watch_fields()}))
        stored["learning_resources"] = stored_resources
        stored["watch_percent"] = item_percent(stored)
        stored_items.append(stored)
    rollup = path_rollup(stored_items)
    path["progress_percentage"] = rollup["progress_percentage"]
    path["watch_summary"] = rollup["watch_summary"]
    client.table("learning_paths").update({
        "watch_summary": rollup["watch_summary"],
        "progress_percentage": rollup["progress_percentage"],
    }).eq("id", path["id"]).eq("user_id", str(user.id)).execute()
    return {
        **path,
        "items": stored_items,
        "item_count": len(stored_items),
        "algorithm_version": algorithm_version,
        "source_snapshot": source_snapshot,
        "crew": generated.get("crew"),
        "grounding": {
            "source": "completed_ats_analysis",
            "analysis_id": str(analysis["id"]),
            "policy": (
                "youtube_api_or_search_plus_educational_article_search_"
                "no_invented_video_ids_or_article_urls"
            ),
        },
    }


@router.patch("/learning-paths/{path_id}/items/{item_id}")
def update_learning_item(
    path_id: UUID,
    item_id: UUID,
    payload: LearningItemProgressPatch,
    user: CurrentUser = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
):
    client = client_for(settings, user)
    owned_row(client, "learning_paths", path_id, user)
    item = (
        client.table("learning_items")
        .select("*")
        .eq("id", str(item_id))
        .eq("learning_path_id", str(path_id))
        .eq("user_id", str(user.id))
        .limit(1)
        .execute()
        .data
        or []
    )
    if not item:
        raise ApiError(404, "learning_item_not_found", "The learning item was not found.")
    now = utc_now()
    resources = (
        client.table("learning_resources")
        .select("*")
        .eq("learning_item_id", str(item_id))
        .eq("user_id", str(user.id))
        .execute()
        .data
        or []
    )
    if payload.status == "completed":
        for resource in resources:
            completed = complete_resource(resource, now=now)
            client.table("learning_resources").update(watch_fields_for_write(completed)).eq(
                "id", str(resource.get("id"))
            ).eq("user_id", str(user.id)).execute()
    updated_result = client.table("learning_items").update({
        "status": payload.status,
        "completed_at": now if payload.status == "completed" else None,
        "watch_percent": 100 if payload.status == "completed" else (item_percent({"learning_resources": resources}) if payload.status != "pending" else 0),
    }).eq("id", str(item_id)).eq("user_id", str(user.id)).execute()
    updated = _first_row(updated_result) or {**item[0], "status": payload.status}
    all_items = (
        client.table("learning_items")
        .select("*")
        .eq("learning_path_id", str(path_id))
        .eq("user_id", str(user.id))
        .execute()
        .data
        or []
    )
    item_ids = [str(row.get("id")) for row in all_items if row.get("id")]
    by_item = _load_learning_resources_for_items(client, user, item_ids)
    attached = []
    for row in all_items:
        packed = dict(row)
        packed["learning_resources"] = by_item.get(str(row.get("id")), [])
        if str(row.get("id")) == str(item_id):
            packed["status"] = payload.status
            if payload.status == "completed":
                packed["learning_resources"] = [complete_resource(r, now=now) for r in packed["learning_resources"]]
        packed["watch_percent"] = 100 if packed.get("status") == "completed" else item_percent(packed)
        attached.append(packed)
    rollup = _persist_path_rollup(client, user, str(path_id), attached)
    return {**updated, "progress_percentage": rollup["progress_percentage"], "watch_summary": rollup["watch_summary"]}


@router.patch("/learning-paths/{path_id}/resources/{resource_id}")
def update_learning_resource_progress(
    path_id: UUID,
    resource_id: UUID,
    payload: LearningResourceProgressPatch,
    user: CurrentUser = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
):
    """Persist accurate watch/read progress for one lesson resource."""
    client = client_for(settings, user)
    owned_row(client, "learning_paths", path_id, user)
    resources = (
        client.table("learning_resources")
        .select("*")
        .eq("id", str(resource_id))
        .eq("user_id", str(user.id))
        .limit(1)
        .execute()
        .data
        or []
    )
    if not resources:
        raise ApiError(404, "learning_resource_not_found", "The learning resource was not found.")
    resource = resources[0]
    item_id = str(resource.get("learning_item_id") or "")
    item_rows = (
        client.table("learning_items")
        .select("*")
        .eq("id", item_id)
        .eq("learning_path_id", str(path_id))
        .eq("user_id", str(user.id))
        .limit(1)
        .execute()
        .data
        or []
    )
    if not item_rows:
        raise ApiError(404, "learning_item_not_found", "The learning item was not found for this path.")
    now = utc_now()
    patched = apply_watch_patch(resource, payload.model_dump(exclude_unset=True), now=now)
    write_fields = watch_fields_for_write(patched)
    updated_result = (
        client.table("learning_resources")
        .update(write_fields)
        .eq("id", str(resource_id))
        .eq("user_id", str(user.id))
        .execute()
    )
    updated_resource = _first_row(updated_result) or {**resource, **write_fields}
    updated_resource = with_watch_defaults(updated_resource)

    all_items = (
        client.table("learning_items")
        .select("*")
        .eq("learning_path_id", str(path_id))
        .eq("user_id", str(user.id))
        .execute()
        .data
        or []
    )
    item_ids = [str(row.get("id")) for row in all_items if row.get("id")]
    by_item = _load_learning_resources_for_items(client, user, item_ids)
    by_item[item_id] = [
        updated_resource if str(row.get("id")) == str(resource_id) else row
        for row in (by_item.get(item_id) or [updated_resource])
    ]
    attached: list[dict[str, Any]] = []
    current_item: dict[str, Any] | None = None
    for row in all_items:
        packed = dict(row)
        packed["learning_resources"] = by_item.get(str(row.get("id")), [])
        packed["watch_percent"] = item_percent(packed)
        packed["status"] = item_status_from_percent(packed["watch_percent"])
        if packed["status"] != row.get("status"):
            client.table("learning_items").update({
                "status": packed["status"],
                "watch_percent": packed["watch_percent"],
                "completed_at": now if packed["status"] == "completed" else None,
            }).eq("id", str(row.get("id"))).eq("user_id", str(user.id)).execute()
        elif packed["watch_percent"] != row.get("watch_percent"):
            client.table("learning_items").update({
                "watch_percent": packed["watch_percent"],
            }).eq("id", str(row.get("id"))).eq("user_id", str(user.id)).execute()
        attached.append(packed)
        if str(row.get("id")) == item_id:
            current_item = packed
    rollup = _persist_path_rollup(client, user, str(path_id), attached)
    return {
        **updated_resource,
        "item_status": (current_item or {}).get("status"),
        "item_watch_percent": (current_item or {}).get("watch_percent"),
        "progress_percentage": rollup["progress_percentage"],
        "watch_summary": rollup["watch_summary"],
    }


@router.get("/jobs")
def list_jobs(user: CurrentUser = Depends(get_current_user), settings: Settings = Depends(get_settings)):
    client = client_for(settings, user)
    jobs = (
        client_for(settings, user)
        .table("jobs")
        .select("*")
        .eq("is_active", True)
        .order("published_at", desc=True)
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
    import time

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
            .select("target_roles,preferred_locations")
            .eq("user_id", str(user.id))
            .limit(1)
            .execute()
            .data
            or []
        )
        prefs = prefs_rows[0] if prefs_rows else {}
        target_roles = [str(r).strip() for r in (prefs.get("target_roles") or []) if str(r).strip()]
        locations = [str(loc).strip() for loc in (prefs.get("preferred_locations") or []) if str(loc).strip()]
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
        .eq("is_active", True)
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
        .eq("is_active", True)
        .order("published_at", desc=True)
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
        "full_name,headline,bio,location,current_role,years_experience,career_level,career_goal"
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
        .eq("is_active", True)
        .execute()
        .data
        if job_ids
        else []
    )
    by_id = {str(job["id"]): job for job in (jobs or [])}
    return [{**row, "jobs": by_id.get(str(row.get("job_id")))} for row in rows]


@router.post("/saved-jobs/{job_id}", status_code=201)
def save_job(
    job_id: UUID, user: CurrentUser = Depends(get_current_user), settings: Settings = Depends(get_settings)
):
    """Bookmark a job as saved without downgrading applied/interview/offer tracking."""
    client = client_for(settings, user)
    job = (
        client.table("jobs").select("id").eq("id", str(job_id)).eq("is_active", True).limit(1).execute().data
        or []
    )
    if not job:
        raise ApiError(404, "job_not_found", "The job was not found.")
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
        "status": "saved",
        "updated_at": stamp,
    }
    if not existing:
        payload["saved_at"] = stamp
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
        client.table("jobs").select("id").eq("id", str(job_id)).eq("is_active", True).limit(1).execute().data
        or []
    )
    if not job:
        raise ApiError(404, "job_not_found", "The job was not found.")
    stamp = utc_now()
    body = payload.model_dump()
    row = {
        "user_id": str(user.id),
        "job_id": str(job_id),
        **body,
        "updated_at": stamp,
    }
    existing = (
        client.table("saved_jobs")
        .select("id,saved_at,status")
        .eq("user_id", str(user.id))
        .eq("job_id", str(job_id))
        .limit(1)
        .execute()
        .data
        or []
    )
    if not existing:
        row["saved_at"] = stamp
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


@router.get("/settings")
def get_settings_records(
    user: CurrentUser = Depends(get_current_user), settings: Settings = Depends(get_settings)
):
    client = client_for(settings, user)
    return {
        "notifications": ensure_preference_row(client, "notification_preferences", str(user.id)),
        "privacy": ensure_preference_row(client, "privacy_preferences", str(user.id)),
    }


@router.put("/settings/notifications")
def update_notifications(
    payload: NotificationSettings,
    user: CurrentUser = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
):
    client = client_for(settings, user)
    result = client.table("notification_preferences").upsert(
        {"user_id": str(user.id), **payload.model_dump()}
    ).execute().data or []
    if not result:
        raise ApiError(500, "notifications_save_failed", "Notification settings could not be saved.")
    return result[0]


@router.put("/settings/privacy")
def update_privacy(
    payload: PrivacySettings,
    user: CurrentUser = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
):
    client = client_for(settings, user)
    result = client.table("privacy_preferences").upsert(
        {"user_id": str(user.id), **payload.model_dump()}
    ).execute().data or []
    if not result:
        raise ApiError(500, "privacy_save_failed", "Privacy settings could not be saved.")
    return result[0]


@router.delete("/account", status_code=204)
def delete_account(
    payload: AccountDeleteRequest | None = Body(default=None),
    x_confirm_delete: str | None = Header(default=None),
    user: CurrentUser = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
):
    """
    Permanently delete the signed-in candidate account and all owned data.

    Confirmation (required): body.confirmation or header X-Confirm-Delete must equal
    "DELETE MY ACCOUNT". Body email must match the account email.
    """
    from app.features.auth.account_deletion import delete_user_owned_records

    if payload is None:
        raise ApiError(
            400,
            "account_deletion_confirmation_required",
            f"Explicit confirmation and account email are required. Type exactly: {CONFIRM_PHRASE}",
        )
    confirmation = payload.confirmation or x_confirm_delete
    if not confirmation_is_valid(confirmation):
        raise ApiError(
            400,
            "account_deletion_confirmation_required",
            f"Explicit confirmation is required. Type exactly: {CONFIRM_PHRASE}",
        )
    if not email_matches_account(payload.email, user.email):
        raise ApiError(
            400,
            "account_deletion_email_mismatch",
            "The email does not match this signed-in account.",
        )

    user_client = client_for(settings, user)
    storage_paths = collect_user_storage_paths(user_client, user)

    # Capture provider identities before we delete the users document.
    firebase_uid = ""
    supabase_uid = ""
    try:
        user_rows = (
            user_client.table("users")
            .select("firebase_uid, supabase_uid")
            .eq("id", str(user.id))
            .limit(1)
            .execute()
            .data
            or []
        )
        if user_rows:
            firebase_uid = str(user_rows[0].get("firebase_uid") or "").strip()
            supabase_uid = str(user_rows[0].get("supabase_uid") or "").strip()
    except Exception as exc:
        logger.exception("account_delete_firebase_uid_lookup_failed user_id=%s", user.id)
        raise ApiError(
            500,
            "account_deletion_incomplete",
            "The linked identity could not be verified. No local data was removed.",
        ) from exc

    admin = database_client(settings)
    # Remove the provider identity before deleting local records. If this fails,
    # stop before destructive local deletion so the identity cannot resurrect a
    # new account after a partial purge.
    if firebase_uid and settings.firebase_configured:
        try:
            from firebase_admin import auth as firebase_auth

            from app.database.client import firebase_admin_app

            firebase_auth.delete_user(firebase_uid, app=firebase_admin_app(settings))
        except Exception as exc:
            logger.exception("account_delete_firebase_auth_failed user_id=%s", user.id)
            raise ApiError(
                500,
                "account_deletion_incomplete",
                "The linked identity provider account could not be deleted. No local data was removed.",
            ) from exc

    # The Supabase Auth identity (email + credentials) must die with the
    # account too, or the address stays "already registered" and can never
    # sign up again. Same fail-closed contract as Firebase above.
    if supabase_uid:
        if not (settings.resolved_supabase_url and settings.supabase_server_key):
            logger.error(
                "account_delete_supabase_unconfigured user_id=%s supabase_uid_present=true", user.id
            )
            raise ApiError(
                500,
                "account_deletion_incomplete",
                "The Supabase identity could not be deleted because server credentials are missing. No local data was removed.",
            )
        try:
            from app.features.auth.account_deletion import delete_supabase_auth_user

            delete_supabase_auth_user(settings, supabase_uid)
        except Exception as exc:
            logger.exception("account_delete_supabase_auth_failed user_id=%s", user.id)
            raise ApiError(
                500,
                "account_deletion_incomplete",
                "The Supabase identity could not be deleted. No local data was removed. Please retry.",
            ) from exc

    # Fail closed: do not erase Firestore identity while storage blobs may remain.
    try:
        purge_user_storage(admin, settings, user, storage_paths)
    except Exception as exc:
        logger.exception("account_delete_storage_purge_failed user_id=%s", user.id)
        raise ApiError(
            500,
            "account_deletion_incomplete",
            "Could not remove all stored account files. Account deletion stopped so data stays consistent.",
        ) from exc

    delete_user_owned_records(admin, user)
    try:
        admin.table("users").delete().eq("id", str(user.id)).execute()
    except Exception as exc:
        raise ApiError(
            500,
            "account_deletion_failed",
            "The account could not be deleted from the local database.",
        ) from exc
