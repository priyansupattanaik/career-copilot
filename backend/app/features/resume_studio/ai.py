from __future__ import annotations

from pathlib import Path
import re
from typing import Any

from app.agents.providers.reliable import generate_structured_with_failover
from app.core.config import Settings
from app.core.errors import ApiError
from app.features.resume_management.evidence import build_fact_inventory, build_blocks
from app.features.resume_studio.mapper import flatten_content, visible_text_blob
from app.features.resume_studio.schema import StudioDocument, StudioSuggestRequest, StudioSuggestion

PROMPTS_DIR = Path(__file__).resolve().parents[2] / "agents" / "prompts"
NUMBER_PATTERN = re.compile(r"(?<!\w)(?:\d+(?:\.\d+)?%?|(?:19|20)\d{2})(?!\w)")
PROPER_TOKEN_PATTERN = re.compile(r"\b(?:[A-Z][a-z]+[A-Z]\w*|[A-Z]{2,}|[A-Z][\w.+#-]+)\b")
COMMON_CAPITALIZED = {
    "Built",
    "Created",
    "Developed",
    "Delivered",
    "Designed",
    "Implemented",
    "Improved",
    "Led",
    "Maintained",
    "Managed",
    "Optimized",
    "Reduced",
    "Supported",
    "Used",
    "Worked",
    "Collaborated",
    "Contributed",
    "Analyzed",
    "Automated",
    "Configured",
    "Deployed",
    "Documented",
    "Facilitated",
    "Integrated",
    "Launched",
    "Migrated",
    "Monitored",
    "Refactored",
    "Resolved",
    "Reviewed",
    "Tested",
    "Wrote",
}


def _evidence_terms(document: StudioDocument) -> tuple[set[str], set[str]]:
    structured = {"sections": flatten_content(document.content)}
    blocks = build_blocks(structured)
    facts = build_fact_inventory(blocks)
    numbers = {fact.normalized_value for fact in facts if fact.fact_type == "number_or_date"}
    numbers.update(item.casefold() for item in NUMBER_PATTERN.findall(visible_text_blob(document.content)))
    entities = {fact.normalized_value for fact in facts if fact.fact_type in {"entity", "skill"}}
    blob = visible_text_blob(document.content)
    for token in PROPER_TOKEN_PATTERN.findall(blob):
        entities.add(token.casefold())
    return numbers, entities


def _validate_suggestion(document: StudioDocument, original: str, proposed: str) -> tuple[bool, list[str]]:
    numbers, entities = _evidence_terms(document)
    numbers.update(item.casefold() for item in NUMBER_PATTERN.findall(original))
    for token in PROPER_TOKEN_PATTERN.findall(original):
        entities.add(token.casefold())
    unsupported: list[str] = []
    for item in NUMBER_PATTERN.findall(proposed):
        if item.casefold() not in numbers:
            unsupported.append(item)
    proposed_entities = set(PROPER_TOKEN_PATTERN.findall(proposed)) - COMMON_CAPITALIZED
    first = re.match(r"\s*([A-Z][\w.+#-]*)", proposed)
    if first:
        proposed_entities.discard(first.group(1))
    for token in proposed_entities:
        if token.casefold() not in entities:
            unsupported.append(token)
    return bool(unsupported), unsupported[:12]


def _ats_slice(ats: dict[str, Any] | None) -> dict[str, Any]:
    if not ats:
        return {}
    analysis = ats.get("analysis") or {}
    summary = analysis.get("summary") if isinstance(analysis.get("summary"), dict) else {}
    evidence = ats.get("evidence") or []
    missing = [
        {
            "requirement": row.get("requirement_text"),
            "status": row.get("match_status"),
            "section": row.get("resume_section"),
            "quote": row.get("resume_evidence_text"),
        }
        for row in evidence
        if row.get("match_status") in {"not_found", "partial_match"}
    ]
    matched = [
        {
            "requirement": row.get("requirement_text"),
            "status": row.get("match_status"),
            "quote": row.get("resume_evidence_text"),
        }
        for row in evidence
        if row.get("match_status") == "strong_match"
    ]
    job = ats.get("job_description") or {}
    return {
        "overall_score": analysis.get("overall_score"),
        "missing_terms": (summary.get("missing_terms") or [])[:20],
        "critical_missing": (summary.get("critical_missing") or [])[:12],
        "preferred_missing": (summary.get("preferred_missing") or [])[:12],
        "do_not_claim": (summary.get("do_not_claim") or [])[:12],
        "focus_areas": (summary.get("focus_areas") or [])[:8],
        "priority_actions": (summary.get("priority_actions") or [])[:8],
        "gaps": missing[:16],
        "matched": matched[:12],
        "job": {
            "title": job.get("title"),
            "company": job.get("company"),
            "role_title": job.get("role_title"),
            "excerpt": (job.get("raw_text") or "")[:2500],
        },
    }


async def suggest_revision(
    settings: Settings,
    document: StudioDocument,
    payload: StudioSuggestRequest,
    ats: dict[str, Any] | None,
) -> dict[str, Any]:
    prompt_path = PROMPTS_DIR / "resume_studio_suggest_v1.txt"
    if not prompt_path.is_file():
        raise ApiError(500, "studio_prompt_missing", "Resume Studio assistance is unavailable.")
    system_prompt = prompt_path.read_text(encoding="utf-8")
    user_payload = {
        "action": payload.action,
        "section_key": payload.section_key,
        "selected_text": payload.selected_text,
        "entry_id": payload.entry_id,
        "bullet_id": payload.bullet_id,
        "ats_issue": payload.ats_issue,
        "resume_excerpt": visible_text_blob(document.content)[:6000],
        "ats": _ats_slice(ats),
        "rules": {
            "never_invent_facts": True,
            "candidate_must_approve": True,
            "unsupported_claims_require_confirmation": True,
        },
    }
    try:
        result, provider = await generate_structured_with_failover(
            settings,
            system_prompt=system_prompt,
            user_payload=user_payload,
            schema_model=StudioSuggestion,
            temperature=0.2,
            attempts_per_provider=1,
            allow_repair=True,
        )
    except ApiError as exc:
        if exc.code in {"llm_not_configured", "groq_not_configured", "nvidia_not_configured"}:
            raise ApiError(
                503,
                "studio_ai_unavailable",
                "AI assistance is not configured. You can still edit and export the resume.",
            ) from exc
        raise
    suggestion = result if isinstance(result, StudioSuggestion) else StudioSuggestion.model_validate(result)
    proposed = (suggestion.proposed_text or "").strip()
    original = payload.selected_text.strip()
    if not proposed:
        proposed = original
        suggestion.needs_candidate_input = True
        suggestion.reason = suggestion.reason or "No rewrite was produced from the available evidence."
    requires_confirmation, unsupported = _validate_suggestion(document, original, proposed)
    if requires_confirmation:
        suggestion.requires_confirmation = True
        suggestion.unsupported_claims = list(dict.fromkeys([*suggestion.unsupported_claims, *unsupported]))
        if not suggestion.needs_candidate_input:
            suggestion.needs_candidate_input = True
            suggestion.missing_facts = suggestion.missing_facts or [
                "Confirm any new numbers, tools, or claims before using this suggestion."
            ]
    return {
        "original_text": original,
        "proposed_text": proposed,
        "reason": suggestion.reason,
        "addresses": suggestion.addresses,
        "needs_candidate_input": suggestion.needs_candidate_input,
        "missing_facts": suggestion.missing_facts,
        "requires_confirmation": suggestion.requires_confirmation,
        "unsupported_claims": suggestion.unsupported_claims,
        "provider": provider,
    }
