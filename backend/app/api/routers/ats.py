"""Resume-check history."""
import logging
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends

from app.api.schemas import (
    AtsAnalysisCreate,
)
from app.api.support import (
    utc_now,
)
from app.core.config import Settings, get_settings
from app.core.errors import ApiError
from app.database.repository import (
    client_for,
    owned_row,
    sort_rows_by_recency,
    write_activity,
)
from app.features.ats.agents import evaluate_ats_domain_gate, generate_ats_improvement_brief
from app.features.ats.ats_score import (
    ats_source_fingerprint,
    evidence_match_status,
    score_resume,
)
from app.features.auth.service import (
    CurrentUser,
    get_current_user,
)

router = APIRouter()
logger = logging.getLogger(__name__)

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
    if not enriched.get("summary") and isinstance(enriched.get("breakdown"), dict):
        enriched["summary"] = enriched["breakdown"].get("summary")
    if not enriched.get("score_breakdown") and isinstance(enriched.get("breakdown"), dict):
        enriched["score_breakdown"] = enriched["breakdown"]
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
    # Client-side recency: order_by(created_at) hides docs missing created_at.
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
            "Could not delete this resume check. Try again.",
        ) from exc
    write_activity(
        client,
        user,
        "ats_analysis_deleted",
        "Resume check deleted",
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
    persisted_score = 0 if domain_gate.get("decision") == "REJECT" else int(round(score.overall_score))
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

        summary_payload = {
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
        }
        score_breakdown["summary"] = summary_payload

        completed_rows = (
            client.table("ats_analyses")
            .update(
                {
                    "status": "completed",
                    "overall_score": int(round(persisted_score)),
                    "breakdown": score_breakdown,
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
        completed.setdefault("summary", summary_payload)
        completed.setdefault("score_breakdown", score_breakdown)
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
                    "breakdown": {
                        "error_code": "ats_persistence_failed",
                        "error_message": "Scoring could not be persisted.",
                    },
                }
            ).eq("id", analysis["id"]).eq("user_id", str(user.id)).execute()
        except Exception:
            logger.exception(
                "ats_mark_failed_also_failed analysis_id=%s",
                analysis.get("id"),
            )
        raise ApiError(500, "ats_persistence_failed", "This resume check could not be saved.") from exc

    write_activity(
        client,
        user,
        "ats_analysis_completed",
        "Resume check completed",
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


