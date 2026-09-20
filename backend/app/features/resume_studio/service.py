from __future__ import annotations

from typing import Any
from uuid import UUID, uuid4

from app.core.errors import ApiError
from app.database.repository import owned_row, write_activity
from app.features.auth.service import CurrentUser
from app.features.resume_management.improvement_repository import completed_analysis, now_iso
from app.features.resume_studio.mapper import document_from_structured, flatten_content, flatten_plain_text
from app.features.resume_studio.schema import (
    SOURCE_TYPE_STUDIO,
    STUDIO_SCHEMA_VERSION,
    ResumeContent,
    PresentationSettings,
    StudioDocument,
    parse_studio_document,
    studio_payload,
)


def _versions_for_resume(client, user: CurrentUser, resume_id: str) -> list[dict[str, Any]]:
    rows = (
        client.table("resume_versions")
        .select("*")
        .eq("resume_id", str(resume_id))
        .eq("user_id", str(user.id))
        .execute()
        .data
        or []
    )
    return sorted(rows, key=lambda row: int(row.get("version_number") or 0))


def _is_studio_version(version: dict[str, Any]) -> bool:
    if str(version.get("source_type") or "") == SOURCE_TYPE_STUDIO:
        return True
    structured = (
        version.get("structured_content")
        if isinstance(version.get("structured_content"), dict)
        else version.get("structured_sections")
        if isinstance(version.get("structured_sections"), dict)
        else {}
    )
    return str(structured.get("schema_version") or "") == STUDIO_SCHEMA_VERSION and isinstance(
        structured.get("studio"), dict
    )


def _source_id_of(version: dict[str, Any]) -> str | None:
    structured = (
        version.get("structured_content")
        or version.get("structured_sections")
        or {}
    )
    document = parse_studio_document(structured)
    if document and document.source_version_id:
        return str(document.source_version_id)
    return None


def resolve_original_version(client, user: CurrentUser, version: dict[str, Any]) -> dict[str, Any]:
    resume_id = str(version.get("resume_id") or "")
    hinted = _source_id_of(version)
    versions = _versions_for_resume(client, user, resume_id)
    by_id = {str(row.get("id")): row for row in versions if row.get("id")}
    if hinted and hinted in by_id and not _is_studio_version(by_id[hinted]):
        return by_id[hinted]
    if not _is_studio_version(version):
        return version
    for row in versions:
        if not _is_studio_version(row):
            return row
    return version


def _find_working_copy(
    client, user: CurrentUser, original: dict[str, Any]
) -> dict[str, Any] | None:
    original_id = str(original.get("id"))
    for row in reversed(_versions_for_resume(client, user, str(original.get("resume_id")))):
        if str(row.get("id")) == original_id:
            continue
        if not _is_studio_version(row):
            continue
        if _source_id_of(row) == original_id:
            return row
    return None


def _parent_resume(client, user: CurrentUser, resume_id: str) -> dict[str, Any]:
    resume = owned_row(client, "resumes", resume_id, user)
    if resume.get("deleted_at"):
        raise ApiError(404, "resume_not_found", "The selected resume is no longer available.")
    return resume


def _require_confirmed(version: dict[str, Any]) -> dict[str, Any]:
    if version.get("extraction_status") != "confirmed":
        raise ApiError(
            409,
            "resume_not_confirmed",
            "Confirm the extracted resume in Resume Match before opening Resume Studio.",
        )
    return version


def _write_structured(document: StudioDocument) -> tuple[dict[str, Any], str]:
    sections = flatten_content(document.content)
    plain = flatten_plain_text(document.content)
    return studio_payload(document, sections), plain


def _insert_working_copy(
    client, user: CurrentUser, original: dict[str, Any], document: StudioDocument
) -> dict[str, Any]:
    structured, plain = _write_structured(document)
    resume_id = str(original["resume_id"])
    count = len(_versions_for_resume(client, user, resume_id))
    version_id = str(uuid4())
    record = {
        "id": version_id,
        "resume_id": resume_id,
        "user_id": str(user.id),
        "version_number": count + 1,
        "source_type": SOURCE_TYPE_STUDIO,
        "original_filename": original.get("original_filename") or "resume.pdf",
        "storage_path": original.get("storage_path"),
        "raw_text": plain,
        "plain_text": plain,
        "structured_sections": structured,
        "structured_content": structured,
        "extraction_status": "confirmed",
        "candidate_confirmed_at": now_iso(),
    }
    rows = client.table("resume_versions").insert(record).execute().data or []
    if not rows:
        raise ApiError(500, "resume_studio_create_failed", "The working resume could not be created.")
    write_activity(
        client,
        user,
        "resume_studio_opened",
        "Resume Studio working copy created",
        "resume_version",
        version_id,
    )
    return rows[0]


def _update_working_copy(client, user: CurrentUser, version_id: str, document: StudioDocument) -> dict[str, Any]:
    structured, plain = _write_structured(document)
    rows = (
        client.table("resume_versions")
        .update(
            {
                "raw_text": plain,
                "plain_text": plain,
                "structured_sections": structured,
                "structured_content": structured,
                "extraction_status": "confirmed",
                "candidate_confirmed_at": now_iso(),
                "source_type": SOURCE_TYPE_STUDIO,
            }
        )
        .eq("id", version_id)
        .eq("user_id", str(user.id))
        .execute()
        .data
        or []
    )
    if not rows:
        raise ApiError(500, "resume_studio_save_failed", "The working resume could not be saved.")
    return rows[0]


def _ats_context(client, user: CurrentUser, analysis_id: str | None) -> dict[str, Any] | None:
    if not analysis_id:
        return None
    analysis, evidence = completed_analysis(client, analysis_id, user)
    summary = analysis.get("summary") if isinstance(analysis.get("summary"), dict) else {}
    breakdown = analysis.get("score_breakdown") if isinstance(analysis.get("score_breakdown"), dict) else {}
    if not summary and isinstance(analysis.get("breakdown"), dict):
        summary = analysis.get("breakdown", {}).get("summary") or {}
        breakdown = analysis.get("breakdown") or breakdown
    job = None
    job_id = analysis.get("job_description_id")
    if job_id:
        try:
            job = owned_row(client, "job_descriptions", job_id, user)
        except ApiError:
            job = None
    return {
        "analysis": {
            "id": analysis.get("id"),
            "overall_score": analysis.get("overall_score"),
            "status": analysis.get("status"),
            "resume_version_id": analysis.get("resume_version_id"),
            "job_description_id": analysis.get("job_description_id"),
            "created_at": analysis.get("created_at"),
            "summary": summary,
            "score_breakdown": breakdown,
        },
        "evidence": [
            {
                "id": row.get("id"),
                "requirement_text": row.get("requirement_text") or row.get("finding"),
                "requirement_type": row.get("requirement_type"),
                "match_status": row.get("match_status"),
                "resume_evidence_text": row.get("resume_evidence_text"),
                "resume_section": row.get("resume_section"),
                "explanation": row.get("explanation"),
            }
            for row in evidence
        ],
        "job_description": (
            {
                "id": job.get("id"),
                "title": job.get("title"),
                "company": job.get("company"),
                "role_title": job.get("role_title"),
                "raw_text": (job.get("raw_text") or "")[:8000],
            }
            if job
            else None
        ),
    }


def _session_payload(
    client,
    user: CurrentUser,
    working: dict[str, Any],
    original: dict[str, Any],
    document: StudioDocument,
    ats: dict[str, Any] | None,
) -> dict[str, Any]:
    resume = _parent_resume(client, user, str(working.get("resume_id")))
    return {
        "working_version": {
            "id": working.get("id"),
            "resume_id": working.get("resume_id"),
            "version_number": working.get("version_number"),
            "source_type": working.get("source_type"),
            "extraction_status": working.get("extraction_status"),
            "original_filename": working.get("original_filename"),
            "created_at": working.get("created_at"),
        },
        "source_version": {
            "id": original.get("id"),
            "resume_id": original.get("resume_id"),
            "version_number": original.get("version_number"),
            "source_type": original.get("source_type"),
            "extraction_status": original.get("extraction_status"),
            "original_filename": original.get("original_filename"),
            "created_at": original.get("created_at"),
        },
        "resume": {
            "id": resume.get("id"),
            "title": resume.get("title"),
            "is_active": resume.get("is_active"),
        },
        "document": document.model_dump(),
        "ats": ats,
    }


def _latest_confirmed(client, user: CurrentUser) -> dict[str, Any]:
    versions = (
        client.table("resume_versions")
        .select("*")
        .eq("user_id", str(user.id))
        .eq("extraction_status", "confirmed")
        .execute()
        .data
        or []
    )
    parents = (
        client.table("resumes")
        .select("id,deleted_at,is_active,updated_at,created_at")
        .eq("user_id", str(user.id))
        .is_("deleted_at", "null")
        .execute()
        .data
        or []
    )
    parent_by_id = {str(row.get("id")): row for row in parents}
    ranked = []
    for row in versions:
        parent = parent_by_id.get(str(row.get("resume_id")))
        if not parent:
            continue
        ranked.append((int(bool(parent.get("is_active"))), int(row.get("version_number") or 0), row))
    ranked.sort(key=lambda item: (item[0], item[1]), reverse=True)
    if not ranked:
        raise ApiError(
            409,
            "resume_required",
            "Upload and confirm a resume in Resume Match before opening Resume Studio.",
        )
    return ranked[0][2]


def open_session(
    client,
    user: CurrentUser,
    *,
    source_version_id: str | None,
    ats_analysis_id: str | None,
    resume_id: str | None,
) -> dict[str, Any]:
    ats = _ats_context(client, user, ats_analysis_id) if ats_analysis_id else None
    source: dict[str, Any] | None = None
    if ats_analysis_id and ats:
        linked = ats["analysis"].get("resume_version_id")
        if linked:
            source = owned_row(client, "resume_versions", linked, user)
    if source is None and source_version_id:
        source = owned_row(client, "resume_versions", source_version_id, user)
    if source is None and resume_id:
        _parent_resume(client, user, resume_id)
        versions = _versions_for_resume(client, user, resume_id)
        confirmed = [row for row in versions if row.get("extraction_status") == "confirmed"]
        source = (confirmed or versions)[-1] if (confirmed or versions) else None
    if source is None:
        source = _latest_confirmed(client, user)
    _require_confirmed(source)
    original = resolve_original_version(client, user, source)
    working = source if _is_studio_version(source) else _find_working_copy(client, user, original)
    if working is None:
        document = document_from_structured(
            original.get("structured_content") or original.get("structured_sections") or {},
            source_version_id=str(original["id"]),
            ats_analysis_id=ats_analysis_id or (ats["analysis"]["id"] if ats else None),
        )
        working = _insert_working_copy(client, user, original, document)
    document = document_from_structured(
        working.get("structured_content") or working.get("structured_sections") or {},
        source_version_id=str(original["id"]),
        ats_analysis_id=ats_analysis_id or (ats["analysis"]["id"] if ats else None),
    )
    if ats and not document.ats_analysis_id:
        document.ats_analysis_id = str(ats["analysis"]["id"])
        working = _update_working_copy(client, user, str(working["id"]), document)
    return _session_payload(client, user, working, original, document, ats)


def get_session(client, user: CurrentUser, version_id: UUID, ats_analysis_id: str | None) -> dict[str, Any]:
    working = owned_row(client, "resume_versions", version_id, user)
    original = resolve_original_version(client, user, working)
    document = document_from_structured(
        working.get("structured_content") or working.get("structured_sections") or {},
        source_version_id=str(original["id"]),
        ats_analysis_id=ats_analysis_id,
    )
    ats_id = ats_analysis_id or document.ats_analysis_id
    ats = _ats_context(client, user, ats_id) if ats_id else None
    return _session_payload(client, user, working, original, document, ats)


def save_session(
    client,
    user: CurrentUser,
    version_id: UUID,
    content: ResumeContent,
    presentation: PresentationSettings,
) -> dict[str, Any]:
    working = owned_row(client, "resume_versions", version_id, user)
    original = resolve_original_version(client, user, working)
    existing = parse_studio_document(
        working.get("structured_content") or working.get("structured_sections") or {}
    )
    document = StudioDocument(
        source_version_id=str(original["id"]),
        ats_analysis_id=existing.ats_analysis_id if existing else None,
        content=content,
        presentation=presentation,
    )
    updated = _update_working_copy(client, user, str(working["id"]), document)
    return get_session(client, user, UUID(str(updated["id"])), document.ats_analysis_id)


def reset_session(client, user: CurrentUser, version_id: UUID) -> dict[str, Any]:
    working = owned_row(client, "resume_versions", version_id, user)
    original = resolve_original_version(client, user, working)
    existing = parse_studio_document(
        working.get("structured_content") or working.get("structured_sections") or {}
    )
    document = document_from_structured(
        original.get("structured_content") or original.get("structured_sections") or {},
        source_version_id=str(original["id"]),
        ats_analysis_id=existing.ats_analysis_id if existing else None,
        presentation=existing.presentation if existing else PresentationSettings(),
    )
    _update_working_copy(client, user, str(working["id"]), document)
    return get_session(client, user, version_id, document.ats_analysis_id)
