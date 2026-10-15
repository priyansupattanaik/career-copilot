"""Candidate profile, avatar, and resume-fill."""
import logging
import uuid
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Body, Depends, File, Form, UploadFile

from app.api.schemas import (
    PreferencesUpdate,
    ProfileAutofillApplyRequest,
    ProfileAutofillParseRequest,
    ProfileFromResumeApplyRequest,
    ProfileFromResumePreviewRequest,
    ProfilePatch,
)
from app.api.support import (
    _normalize_token,
    _prepare_candidate_payload,
    _store_uploaded_resume,
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
from app.features.document_parsing.service import (
    extract_sections_enriched,
    extract_skill_candidates,
    safe_filename,
    skill_source_text,
    validate_document,
)
from app.features.profile.agent import build_profile_draft_enriched, profile_draft_response_payload
from app.features.profile.agent.normalize import normalize_date_value
from app.features.profile.autofill import apply_autofill_changes, parse_resume_for_autofill
from app.features.profile.avatars import (
    attach_avatar_url,
    avatar_extension_for_mime,
    signed_avatar_url,
    validate_avatar_upload,
)
from app.features.profile.importer import insert_validated_batch

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
        "target_role",
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

