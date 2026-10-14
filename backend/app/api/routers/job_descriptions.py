"""Job description upload and confirm."""
import logging
import uuid
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, UploadFile

from app.api.schemas import (
    ExtractionPatch,
    JobDescriptionMetadataPatch,
    JobDescriptionTextCreate,
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
from app.features.document_parsing.pipeline import parse_document_bytes
from app.features.document_parsing.service import (
    extract_sections_enriched,
    infer_job_metadata,
    infer_resume_title,
    safe_filename,
    sha256_bytes,
    validate_document,
)

router = APIRouter()
logger = logging.getLogger(__name__)

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
        "extracted_keywords": list(structured.get("keywords") or structured.get("extracted_keywords") or structured.get("required_skills") or []),
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
            "extracted_keywords": list(structured.get("keywords") or structured.get("extracted_keywords") or structured.get("required_skills") or []),
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
    updates: dict[str, Any] = {
        "structured_content": payload.structured_content,
        "extraction_status": "review_required",
    }
    sc = payload.structured_content or {}
    kws = sc.get("keywords") or sc.get("extracted_keywords") or sc.get("required_skills")
    if kws is not None:
        updates["extracted_keywords"] = list(kws)
    return (
        client.table("job_descriptions")
        .update(updates)
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

