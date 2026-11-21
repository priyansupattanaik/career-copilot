"""Candidate profile, avatar, and resume-fill."""
import logging
import uuid
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Body, Depends, File, UploadFile

from app.api.schemas import (
    PreferencesUpdate,
    ProfileAutofillApplyRequest,
    ProfileAutofillParseRequest,
    ProfileFromResumePreviewRequest,
    ProfilePatch,
)
from app.api.support import (
    _normalize_token,
    _prepare_candidate_payload,
    ensure_preference_row,
    ensure_profile_row,
)
from app.core.config import Settings, get_settings
from app.core.errors import ApiError
from app.database.repository import (
    CANDIDATE_TABLES,
    client_for,
    owned_row,
    owned_rows,
    recalculate_completion,
    write_activity,
)
from app.features.auth.service import (
    CurrentUser,
    get_current_user,
)
from app.features.auth.username import change_username
from app.features.document_parsing.service import extract_sections_enriched
from app.features.profile.agent import build_profile_draft_enriched, profile_draft_response_payload
from app.features.profile.autofill import apply_autofill_changes, parse_resume_for_autofill
from app.features.profile.avatars import (
    attach_avatar_url,
    avatar_extension_for_mime,
    signed_avatar_url,
    validate_avatar_upload,
)

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/profile")
def get_profile(user: CurrentUser = Depends(get_current_user), settings: Settings = Depends(get_settings)):
    client = client_for(settings, user)
    profile = ensure_profile_row(client, user)
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
    ensure_profile_row(client, user)
    values = payload.model_dump(exclude_none=True)
    if "username" in values:
        try:
            values["username"] = change_username(client, str(user.id), values["username"])
        except ValueError as exc:
            raise ApiError(400, "invalid_username", str(exc)) from None
    client.table("profiles").update(values).eq("id", str(user.id)).execute()
    profile = recalculate_completion(client, user)
    write_activity(client, user, "profile_updated", "Profile updated", "profile", str(user.id))
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
        client, user, "profile_updated", "Job preferences updated", "preferences", str(user.id)
    )
    return result[0]



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


@router.post("/profile/autofill/parse")
async def profile_autofill_parse(
    payload: ProfileAutofillParseRequest,
    user: CurrentUser = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
):
    """
    LLM-based resume extraction and profile proposal generation with failover and verification.
    """
    client = client_for(settings, user)
    return await parse_resume_for_autofill(
        client,
        settings,
        user,
        resume_id=payload.resume_id,
        only_fill_empty=payload.only_fill_empty,
        force=payload.force,
    )


@router.post("/profile/autofill/apply")
def profile_autofill_apply(
    payload: ProfileAutofillApplyRequest,
    user: CurrentUser = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
):
    """
    Apply selected resume autofill proposals into candidate profile tables.
    """
    client = client_for(settings, user)
    return apply_autofill_changes(
        client,
        settings,
        user,
        resume_id=payload.resume_id,
        changes=payload.changes,
    )


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
        # silently excluded by order_by behavior.
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

