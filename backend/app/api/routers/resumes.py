"""Resume library and confirmed versions."""
import logging
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Body, Depends, File, Form, UploadFile

from app.api.schemas import (
    ExtractionPatch,
)
from app.api.support import (
    _store_uploaded_resume,
    _upload_resume_version,
    utc_now,
)
from app.core.config import Settings, get_settings
from app.core.errors import ApiError
from app.database.repository import (
    client_for,
    owned_row,
    recalculate_completion,
    row_recency_key,
    sort_rows_by_recency,
    write_activity,
)
from app.features.auth.service import (
    CurrentUser,
    get_current_user,
)
from app.features.document_parsing.service import (
    validate_document,
)

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/resumes")
def list_resumes(user: CurrentUser = Depends(get_current_user), settings: Settings = Depends(get_settings)):
    client = client_for(settings, user)
    # Never order by created_at server-side: docs missing that field are dropped by ordering.
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
            "mime_type": version.get("mime_type") or (
                "application/pdf"
                if str(version.get("original_filename") or "").lower().endswith(".pdf")
                else "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            ),
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

