"""Shared HTTP helpers used by more than one route module."""
import logging
import uuid
from datetime import UTC, datetime
from typing import Any
from urllib.parse import urlparse

from fastapi import UploadFile

from app.core.config import Settings
from app.core.errors import ApiError
from app.features.auth.service import CurrentUser
from app.features.document_parsing.pipeline import parse_document_bytes
from app.features.document_parsing.service import (
    infer_resume_title,
    safe_filename,
    sha256_bytes,
    validate_document,
)
from app.features.profile.agent.normalize import normalize_date_value

logger = logging.getLogger(__name__)


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


def ensure_profile_row(client, user: CurrentUser) -> dict[str, Any]:
    """Return the candidate profile row, auto-creating default for legacy or OAuth accounts."""
    uid = str(user.id)
    rows = client.table("profiles").select("*").eq("id", uid).limit(1).execute().data or []
    if rows and rows[0]:
        return rows[0]
    profile_data: dict[str, Any] = {
        "id": uid,
        "full_name": (user.full_name or "").strip()[:120] or None,
        "profile_completion": 0,
    }
    client.table("profiles").upsert(profile_data).execute()
    return profile_data


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
