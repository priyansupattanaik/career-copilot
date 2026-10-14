"""Study plans generated from a resume check."""
import logging
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends

from app.api.schemas import (
    LearningItemProgressPatch,
    LearningPathCreate,
    LearningPathGenerate,
    LearningResourceProgressPatch,
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
    write_activity,
)
from app.features.auth.service import (
    CurrentUser,
    get_current_user,
)
from app.features.career_matching import (
    ALGORITHM_VERSION as CAREER_MATCH_ALGORITHM_VERSION,
)
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

router = APIRouter()
logger = logging.getLogger(__name__)

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
        "Study plan deleted",
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
        raise ApiError(409, "completed_ats_required", "Finish a resume check before building a study plan.")
    analysis = analyses[0]
    resume_version_id = analysis.get("resume_version_id")
    if not resume_version_id:
        raise ApiError(
            409,
            "completed_ats_required",
            "Finish a resume check before building a study plan.",
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
            str(crew_meta.get("message") or "Could not build a study plan. Check the resume check and try again."),
        )
    if not items:
        raise ApiError(
            422,
            "no_learning_gaps",
            "This resume check did not list missing words, so there is nothing to study.",
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
        "title": f"Study plan · {role_label}",
        "description": (
            "Study plan from words missing in this resume check. "
            "Each step includes a free lesson link. "
            "Watch time is saved as you play. Skipping ahead does not count."
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
        # Ensure metadata remains a plain JSON-serializable mapping for the database.
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

