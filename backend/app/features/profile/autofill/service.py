from __future__ import annotations

import hashlib
import logging
import re
import secrets
import time
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from app.agents.providers.reliable import generate_structured_with_failover
from app.api.schemas import ProfilePatch
from app.api.support import (
    _prepare_candidate_payload,
    ensure_profile_row,
)
from app.core.config import Settings
from app.core.errors import ApiError
from app.database.repository import (
    owned_row,
    owned_rows,
    recalculate_completion,
    write_activity,
)
from app.features.auth.service import CurrentUser
from app.features.profile.autofill.deriver import build_proposals
from app.features.profile.autofill.limiter import check_and_record_user_rate_limit
from app.features.profile.autofill.options_mapper import (
    LOCATION_OPTIONS,
    map_value_to_catalog,
    pick_best_location,
)
from app.features.profile.autofill.prompts import (
    PROMPT_VERSION,
    build_system_prompt,
    build_user_message,
)
from app.features.profile.autofill.schema import ResumeAutofillExtraction
from app.features.profile.autofill.verifier import (
    normalize_text,
    verify_and_sanitize,
)
from app.features.profile.avatars import attach_avatar_url

logger = logging.getLogger(__name__)


def normalize_source_text_for_llm(text: str) -> str:
    """Normalize text for sending to LLM.

    Collapses runs of spaces/tabs to one space and runs of 3+ newlines to 2. Never alters words.
    """
    # Replace runs of spaces and tabs with a single space
    collapsed_spaces = re.sub(r"[ \t]+", " ", text)
    # Replace 3 or more newlines with 2 newlines
    collapsed_newlines = re.sub(r"\n{3,}", "\n\n", collapsed_spaces)
    return collapsed_newlines.strip()


def resolve_resume_version_for_autofill(
    client: Any,
    user: CurrentUser,
    resume_id: UUID | str,
) -> dict[str, Any]:
    """Verify ownership of resume and resolve to current/confirmed version."""
    resume = owned_row(client, "resumes", resume_id, user)
    if resume.get("deleted_at"):
        raise ApiError(404, "resume_not_found", "The requested resume was not found.")

    select_cols = (
        "id,resume_id,user_id,version_number,original_filename,plain_text,structured_content,"
        "extraction_status,created_at"
    )
    # Prefer confirmed version for this resume, then newest version
    confirmed = (
        client.table("resume_versions")
        .select(select_cols)
        .eq("resume_id", str(resume_id))
        .eq("user_id", str(user.id))
        .eq("extraction_status", "confirmed")
        .order("version_number", desc=True)
        .limit(1)
        .execute()
        .data
        or []
    )
    if confirmed:
        return confirmed[0]

    all_versions = (
        client.table("resume_versions")
        .select(select_cols)
        .eq("resume_id", str(resume_id))
        .eq("user_id", str(user.id))
        .order("version_number", desc=True)
        .limit(5)
        .execute()
        .data
        or []
    )
    if not all_versions:
        raise ApiError(404, "resume_version_not_found", "No version found for the selected resume.")
    return all_versions[0]


async def parse_resume_for_autofill(
    client: Any,
    settings: Settings,
    user: CurrentUser,
    *,
    resume_id: UUID | str,
    only_fill_empty: bool = True,
    force: bool = False,
    injected_llm_call: Any = None,
) -> dict[str, Any]:
    start_time = time.monotonic()
    deadline = start_time + float(getattr(settings, "resume_parse_total_timeout_seconds", 65.0))

    # 1. Authorise and fetch resume version
    version = resolve_resume_version_for_autofill(client, user, resume_id)
    version_id = str(version["id"])

    # 2. Per-user rate limiting
    max_per_hour = int(getattr(settings, "resume_parse_max_per_hour_per_user", 5))
    check_and_record_user_rate_limit(str(user.id), max_per_hour)

    # 3. Get source text: confirmed text if available, else plain_text
    source_text = (version.get("plain_text") or "").strip()
    if not source_text:
        raise ApiError(
            422,
            "NO_TEXT",
            "We couldn't read any text in this file. If it's a scan, upload a text-based PDF or a DOCX.",
        )

    # 4. Length check
    max_chars = int(getattr(settings, "resume_parse_max_text_chars", 40000))
    if len(source_text) > max_chars:
        raise ApiError(
            422,
            "TEXT_TOO_LONG",
            "This resume is longer than we can read. Try a shorter version.",
        )

    # Compute source text sha256
    norm_source = normalize_text(source_text)
    text_sha256 = hashlib.sha256(norm_source.encode("utf-8")).hexdigest()

    # Current profile and candidate rows for merge status & cache returns
    profile = ensure_profile_row(client, user)
    cand_skills = owned_rows(client, "candidate_skills", user)
    cand_exp = owned_rows(client, "candidate_experiences", user)
    cand_edu = owned_rows(client, "candidate_education", user)
    cand_links = owned_rows(client, "candidate_links", user)

    # 5. Cache check
    structured = version.get("structured_content")
    if not isinstance(structured, dict):
        structured = {}
    cached_autofill = structured.get("profile_autofill")

    if not force and isinstance(cached_autofill, dict):
        if (
            cached_autofill.get("schema_version") == "1"
            and cached_autofill.get("prompt_version") == PROMPT_VERSION
            and cached_autofill.get("text_sha256") == text_sha256
            and isinstance(cached_autofill.get("data"), dict)
        ):
            try:
                cached_extraction = ResumeAutofillExtraction.model_validate(cached_autofill["data"])
                # Recompute proposals against current profile state
                proposals = build_proposals(
                    cached_extraction,
                    profile,
                    cand_skills,
                    cand_exp,
                    cand_edu,
                    cand_links,
                    only_fill_empty=only_fill_empty,
                )
                logger.info(
                    "profile_autofill_cache_hit resume_id=%s user_id=%s provider=%s",
                    str(resume_id),
                    str(user.id),
                    cached_autofill.get("provider", "cached"),
                )
                return {
                    "resume_id": str(resume_id),
                    "schema_version": "1",
                    "prompt_version": PROMPT_VERSION,
                    "quality": cached_autofill.get("quality", "ok"),
                    "dropped_count": cached_autofill.get("dropped_count", 0),
                    "proposals": proposals,
                }
            except Exception:
                # If cached data fails validation, proceed with fresh extraction
                pass

    # 6. Normalise text for LLM prompt
    clean_prompt_text = normalize_source_text_for_llm(source_text)

    # 7. LLM call
    nonce = secrets.token_hex(8)
    system_prompt = build_system_prompt(nonce)
    user_message = build_user_message(nonce, clean_prompt_text)

    # Check remaining budget
    remaining_time = deadline - time.monotonic()
    if remaining_time < 10.0:
        raise ApiError(
            503,
            "PARSE_UNAVAILABLE",
            "Autofill isn't available right now. You can fill your profile manually and try again later.",
        )

    call_timeout = min(
        float(getattr(settings, "nvidia_timeout_seconds", 90.0)),
        max(1.0, remaining_time - 2.0),
    )

    provider_used = "unknown"

    try:
        if injected_llm_call is not None:
            raw_extraction, provider_used = await injected_llm_call(
                settings=settings,
                system_prompt=system_prompt,
                user_payload={"resume_text": user_message},
                schema_model=ResumeAutofillExtraction,
                timeout_seconds=call_timeout,
            )
        else:
            raw_extraction, provider_used = await generate_structured_with_failover(
                settings,
                system_prompt=system_prompt,
                user_payload={"resume_text": user_message},
                schema_model=ResumeAutofillExtraction,
                temperature_overrides={"groq": 0.0},
                max_output_tokens=getattr(settings, "resume_parse_max_output_tokens", 8000),
                strict_schema=True,
                allow_repair=True,
                timeout_seconds=call_timeout,
            )
    except ApiError as exc:
        if exc.code == "llm_rpm_limit" or exc.status_code == 429:
            raise ApiError(429, "PARSE_BUSY", "Autofill is busy right now. Try again in a minute.") from None
        if exc.code in {"invalid_llm_response", "invalid_provider_response", "invalid_groq_response"}:
            raise ApiError(422, "PARSE_INVALID", "We couldn't read this resume reliably. You can fill your profile manually.") from None
        raise ApiError(
            503,
            "PARSE_UNAVAILABLE",
            "Autofill isn't available right now. You can fill your profile manually and try again later.",
        ) from None
    except Exception:
        raise ApiError(
            503,
            "PARSE_UNAVAILABLE",
            "Autofill isn't available right now. You can fill your profile manually and try again later.",
        ) from None

    # 8. Deterministic verification
    verification = verify_and_sanitize(raw_extraction, source_text)
    sanitized = verification.extraction
    quality = verification.quality
    dropped_count = verification.dropped_count

    # 9. Option mapping
    mapped_loc = None
    if sanitized.location:
        best_comp = pick_best_location(
            sanitized.location.city,
            sanitized.location.region,
            sanitized.location.country,
        )
        mapped_loc, _ = map_value_to_catalog(best_comp, LOCATION_OPTIONS, accepts_free_text=True)

    # 10. Derive and merge
    proposals = build_proposals(
        sanitized,
        profile,
        cand_skills,
        cand_exp,
        cand_edu,
        cand_links,
        only_fill_empty=only_fill_empty,
        mapped_location=mapped_loc,
    )

    # 11. Persistence under "profile_autofill"
    model_name = getattr(settings, f"{provider_used}_model", provider_used)
    autofill_storage = {
        "schema_version": "1",
        "prompt_version": PROMPT_VERSION,
        "provider": provider_used,
        "model": str(model_name),
        "text_sha256": text_sha256,
        "extracted_at": datetime.now(UTC).isoformat(),
        "quality": quality,
        "dropped_count": dropped_count,
        "data": sanitized.model_dump(),
    }
    updated_structured = {**structured, "profile_autofill": autofill_storage}
    try:
        client.table("resume_versions").update({"structured_content": updated_structured}).eq(
            "id", version_id
        ).eq("user_id", str(user.id)).execute()
    except Exception as exc:
        logger.warning("Failed to store profile_autofill cache in resume_versions: %s", exc)

    # 12. Logging
    elapsed = time.monotonic() - start_time
    logger.info(
        "profile_autofill_parse_complete resume_id=%s user_id=%s provider=%s duration=%.2f kept=%d dropped=%d quality=%s",
        str(resume_id),
        str(user.id),
        provider_used,
        elapsed,
        verification.kept_count,
        verification.dropped_count,
        quality,
    )

    return {
        "resume_id": str(resume_id),
        "schema_version": "1",
        "prompt_version": PROMPT_VERSION,
        "quality": quality,
        "dropped_count": dropped_count,
        "proposals": proposals,
    }


def apply_autofill_changes(
    client: Any,
    settings: Settings,
    user: CurrentUser,
    *,
    resume_id: UUID | str,
    changes: dict[str, Any],
) -> dict[str, Any]:
    """Stateless apply of selected resume autofill changes.

    Applies in order: about, skills, experience, education, links.
    """
    applied = {
        "about": False,
        "skills": 0,
        "experience": 0,
        "education": 0,
        "links": 0,
    }

    # 1. About section
    about_data = changes.get("about")
    if isinstance(about_data, dict) and about_data:
        try:
            # Map about fields to ProfilePatch fields
            patch_dict: dict[str, Any] = {}
            for k in ("full_name", "headline", "bio", "location", "current_role", "years_experience"):
                if k in about_data and about_data[k] is not None:
                    patch_dict[k] = about_data[k]
            if "years_of_experience" in about_data and about_data["years_of_experience"] is not None:
                patch_dict["years_experience"] = float(about_data["years_of_experience"])

            if patch_dict:
                payload = ProfilePatch(**patch_dict)
                values = payload.model_dump(exclude_none=True)
                client.table("profiles").update(values).eq("id", str(user.id)).execute()
                applied["about"] = True
        except Exception as exc:
            logger.warning("profile_autofill_apply about failed: %s", exc)

    # 2. Skills
    skills_data = changes.get("skills")
    if isinstance(skills_data, list):
        for item in skills_data:
            skill_name = str(item if isinstance(item, str) else (item.get("name") if isinstance(item, dict) else "")).strip()
            if not skill_name:
                continue
            try:
                prepared = _prepare_candidate_payload("skills", {"name": skill_name}, require_core=True)
                client.table("candidate_skills").insert({**prepared, "user_id": str(user.id)}).execute()
                applied["skills"] += 1
            except Exception as exc:
                logger.warning("profile_autofill_apply skill failed: %s", exc)

    # 3. Experience
    exp_data = changes.get("experience")
    if isinstance(exp_data, list):
        for item in exp_data:
            if not isinstance(item, dict):
                continue
            try:
                prepared = _prepare_candidate_payload("experiences", item, require_core=True)
                client.table("candidate_experiences").insert({**prepared, "user_id": str(user.id)}).execute()
                applied["experience"] += 1
            except Exception as exc:
                logger.warning("profile_autofill_apply experience failed: %s", exc)

    # 4. Education
    edu_data = changes.get("education")
    if isinstance(edu_data, list):
        for item in edu_data:
            if not isinstance(item, dict):
                continue
            try:
                prepared = _prepare_candidate_payload("education", item, require_core=True)
                client.table("candidate_education").insert({**prepared, "user_id": str(user.id)}).execute()
                applied["education"] += 1
            except Exception as exc:
                logger.warning("profile_autofill_apply education failed: %s", exc)

    # 5. Links
    links_data = changes.get("links")
    if isinstance(links_data, list):
        for item in links_data:
            if not isinstance(item, dict):
                continue
            try:
                link_type = item.get("link_type") or item.get("label") or "other"
                url_val = item.get("url") or ""
                prepared = _prepare_candidate_payload(
                    "links",
                    {"link_type": link_type, "url": url_val},
                    require_core=True,
                )
                client.table("candidate_links").insert({**prepared, "user_id": str(user.id)}).execute()
                applied["links"] += 1
            except Exception as exc:
                logger.warning("profile_autofill_apply link failed: %s", exc)

    # Recalculate completion and write activity
    recalculate_completion(client, user)
    write_activity(
        client,
        user,
        "profile_autofill_applied",
        "Profile updated from resume autofill",
        "resume",
        str(resume_id),
    )

    profile = ensure_profile_row(client, user)
    return {
        "applied": applied,
        "profile": attach_avatar_url(profile, client, settings),
    }
