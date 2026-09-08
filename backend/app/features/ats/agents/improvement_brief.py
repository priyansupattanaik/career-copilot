
from __future__ import annotations

import asyncio
import logging
import re
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from app.agents.providers.groq_client import GroqClient
from app.agents.providers.nvidia_client import PROMPTS_DIR, NvidiaClient
from app.agents.providers.routing import preferred_llm_providers
from app.core.config import Settings

logger = logging.getLogger(__name__)
_PROMPT_PATH = PROMPTS_DIR / "ats_improvement_v1.txt"
# Optional enrichment only — never block ATS scoring on a hung provider.
# Profile AI uses the same 12s cap; full provider timeout+retries can exceed 4 minutes.
_OPTIONAL_BRIEF_TIMEOUT_SECONDS = 12.0


class AtsImprovementBriefResult(BaseModel):
    model_config = ConfigDict(extra="ignore")
    overall_inference: str = Field(min_length=20, max_length=6000)
    focus_areas: list[str] = Field(default_factory=list, max_length=12)
    priority_actions: list[str] = Field(default_factory=list, max_length=12)
    section_guidance: list[str] = Field(default_factory=list, max_length=20)
    do_not_claim: list[str] = Field(default_factory=list, max_length=12)


class AtsDomainGateResult(BaseModel):
    model_config = ConfigDict(extra="ignore")
    decision: Literal["ALLOW", "REJECT"]
    resume_domain: str = Field(default="unknown", max_length=120)
    job_domain: str = Field(default="unknown", max_length=120)
    role_family: str = Field(default="unknown", max_length=160)
    reason: str = Field(min_length=1, max_length=1000)


_DOMAIN_GATE_PROMPT = """
Evaluate whether a resume and job description belong to the same professional
domain before ATS scoring. Return only the supplied JSON schema.

Reject only when the domains are clearly incompatible (for example, a software
engineering resume against a medical clinician role) and explain the mismatch
from the text. Do not reject merely because the resume misses skills, seniority,
or preferred tools. Do not use a hardcoded industry list, and do not invent
candidate experience. If the domain is ambiguous, allow the analysis and say
that the evidence is ambiguous in the reason.
""".strip()


def _optional_timeout(settings: Settings, attr: str, default: float) -> float:
    configured = float(getattr(settings, attr, default) or default)
    return max(0.5, min(configured, _OPTIONAL_BRIEF_TIMEOUT_SECONDS))


def _validate_inference(text: str, allowed_items: list[dict[str, Any]]) -> str:
    allowed = {str(item.get("term", "")).casefold() for item in allowed_items}
    known = {
        "docker", "kubernetes", "python", "javascript", "typescript", "react",
        "node.js", "nodejs", "sql", "machine learning", "computer vision", "llm", "rag",
    }
    safe: list[str] = []
    for sentence in re.split(r"(?<=[.!?])\s+", (text or "").strip()):
        lowered = sentence.casefold()
        unsupported = [
            term for term in known
            if re.search(rf"(?<![a-z0-9]){re.escape(term)}(?![a-z0-9])", lowered)
            and not any(term in item for item in allowed)
        ]
        if not unsupported:
            safe.append(sentence)
    return " ".join(safe).strip()
def _grounded_items(
    items: list[str],
    evidence_items: list[dict[str, Any]],
    *,
    generic_prefixes: tuple[str, ...] = (),
) -> list[str]:
    terms = {
        str(item.get("term", "")).casefold().strip()
        for item in evidence_items
        if str(item.get("term", "")).strip()
    }
    grounded: list[str] = []
    for raw in items:
        item = str(raw).strip()
        lowered = item.casefold()
        if any(term in lowered for term in terms) or any(
            lowered.startswith(prefix) for prefix in generic_prefixes
        ):
            grounded.append(item)
    return grounded


def _brief_from_llm(
    result: AtsImprovementBriefResult,
    *,
    overall_score: float,
    missing: list[str],
    matched_count: int,
    total_terms: int,
    role_title: str | None,
    missing_items: list[dict[str, Any]],
    evidence_items: list[dict[str, Any]],
    provider: str,
    model: str | None,
    focus_limit: int,
    generation_id: str | None,
) -> dict[str, Any]:
    allowed = {term.casefold() for term in missing}
    focus = [
        item
        for item in result.focus_areas
        if any(term in str(item).casefold() for term in allowed)
    ][:focus_limit]
    inference = _validate_inference(result.overall_inference, evidence_items)
    if not inference:
        return {
            "overall_inference": None,
            "focus_areas": [],
            "priority_actions": [],
            "section_guidance": [],
            "do_not_claim": [],
            "provider": provider,
            "model": model,
            "agent": "ats_improvement_brief",
            "fallback": False,
            "report_status": "invalid_llm_output",
            "generation_id": generation_id,
        }
    priority_actions = _grounded_items(result.priority_actions, evidence_items)
    section_guidance = _grounded_items(result.section_guidance, evidence_items)
    do_not_claim = _grounded_items(
        result.do_not_claim,
        evidence_items,
        generic_prefixes=("do not", "never", "only", "avoid"),
    )
    return {
        "overall_inference": inference,
        "focus_areas": focus[:12],
        "priority_actions": priority_actions[:12],
        "section_guidance": section_guidance[:20],
        "do_not_claim": do_not_claim[:12],
        "provider": provider,
        "model": model,
        "agent": "ats_improvement_brief",
        "fallback": False,
        "report_status": "generated",
        "generation_id": generation_id,
    }


async def evaluate_ats_domain_gate(
    settings: Settings,
    *,
    resume_text: str,
    job_description: str,
    generation_id: str | None = None,
) -> dict[str, Any]:
    """Ask the configured LLM whether the two documents are in-domain.

    An unavailable provider is explicitly reported as UNVERIFIED. It must not
    silently become a hardcoded reject or allow decision.
    """
    payload = {
        "generation_id": generation_id,
        "resume_text": resume_text,
        "job_description": job_description,
    }
    for provider in preferred_llm_providers(settings):
        try:
            timeout = _optional_timeout(
                settings,
                "groq_timeout_seconds" if provider == "groq" else "nvidia_timeout_seconds",
                _OPTIONAL_BRIEF_TIMEOUT_SECONDS,
            )
            client = GroqClient(settings) if provider == "groq" else NvidiaClient(settings)
            result = await asyncio.wait_for(
                client.generate_structured(
                    system_prompt=_DOMAIN_GATE_PROMPT,
                    user_payload=payload,
                    schema_model=AtsDomainGateResult,
                    temperature=0.1,
                ),
                timeout=timeout,
            )
            return {
                "decision": result.decision,
                "resume_domain": result.resume_domain,
                "job_domain": result.job_domain,
                "role_family": result.role_family,
                "reason": result.reason,
                "provider": provider,
                "model": settings.groq_model if provider == "groq" else settings.nvidia_model,
                "status": "generated",
                "generation_id": generation_id,
            }
        except Exception as exc:
            logger.warning("ats_domain_gate_%s_failed error=%s", provider, type(exc).__name__)
    return {
        "decision": "UNVERIFIED",
        "reason": "The LLM domain gate was unavailable, so domain compatibility could not be verified.",
        "provider": "unavailable",
        "model": None,
        "status": "unavailable",
        "generation_id": generation_id,
    }


async def generate_ats_improvement_brief(
    settings: Settings,
    *,
    overall_score: float,
    missing_terms: list[str],
    matched_count: int,
    total_terms: int,
    role_title: str | None = None,
    company: str | None = None,
    missing_items: list[dict[str, Any]] | None = None,
    matched_items: list[dict[str, Any]] | None = None,
    structured_parameter_scores: dict[str, float] | None = None,
    domain_gate: dict[str, Any] | None = None,
    resume_section_summary: dict[str, list[str]] | None = None,
    generation_id: str | None = None,
) -> dict[str, Any]:
    """Build an improvement brief for an ATS run.

    The narrative report is LLM-only. Provider failure is returned as an
    explicit unavailable state; deterministic evidence remains persisted, but
    no deterministic prose is presented as an AI report.
    """
    missing = [str(term).strip() for term in (missing_terms or []) if str(term).strip()]
    missing_items = missing_items or [
        {"term": term, "priority": "critical", "suggested_section": "skills"}
        for term in missing
    ]
    matched_items = matched_items or []
    evidence_items = missing_items + matched_items
    payload = {
        "score": overall_score,
        "method": "deterministic phrase coverage plus optional structured score",
        "role": role_title,
        "company": company,
        "missing": missing_items,
        "matched": matched_items[:20],
        "structured_parameter_scores": structured_parameter_scores,
        "domain_gate": domain_gate,
        "resume_section_summary": resume_section_summary or {},
        "generation_id": generation_id,
        "rules": [
            "Use only supplied fields; every claim must cite a missing or matched item.",
            "Do not invent employers, projects, metrics, years, tools, or achievements.",
            "Do not claim the candidate already has a missing requirement.",
            "Write a fresh, analysis-specific narrative; do not reuse stock wording.",
            "If domain_gate.decision is REJECT, clearly state that the candidate is not eligible for this role and should not advance.",
            "Return JSON with overall_inference, priority_actions, section_guidance, and do_not_claim.",
        ],
    }
    prompt = _PROMPT_PATH.read_text(encoding="utf-8") if _PROMPT_PATH.is_file() else (
        "Return the required evidence-constrained JSON fields only."
    )
    # Respect LLM_PROVIDER order so Groq-first configs never wait on NVIDIA.
    for provider in preferred_llm_providers(settings):
        try:
            if provider == "groq":
                timeout = _optional_timeout(
                    settings, "groq_timeout_seconds", _OPTIONAL_BRIEF_TIMEOUT_SECONDS
                )
                result = await asyncio.wait_for(
                    GroqClient(settings).generate_structured(
                        system_prompt=prompt,
                        user_payload=payload,
                        schema_model=AtsImprovementBriefResult,
                    temperature=min(settings.groq_temperature, 0.4),
                    ),
                    timeout=timeout,
                )
                return _brief_from_llm(
                    result,
                    overall_score=overall_score,
                    missing=missing,
                    matched_count=matched_count,
                    total_terms=total_terms,
                    role_title=role_title,
                    missing_items=missing_items,
                    evidence_items=evidence_items,
                    provider="groq",
                    model=settings.groq_model,
                    focus_limit=12,
                    generation_id=generation_id,
                )
            timeout = _optional_timeout(
                settings, "nvidia_timeout_seconds", _OPTIONAL_BRIEF_TIMEOUT_SECONDS
            )
            result = await asyncio.wait_for(
                NvidiaClient(settings).generate_structured(
                    system_prompt=prompt,
                    user_payload=payload,
                    schema_model=AtsImprovementBriefResult,
                    temperature=min(settings.nvidia_temperature, 0.3),
                ),
                timeout=timeout,
            )
            return _brief_from_llm(
                result,
                overall_score=overall_score,
                missing=missing,
                matched_count=matched_count,
                total_terms=total_terms,
                role_title=role_title,
                missing_items=missing_items,
                evidence_items=evidence_items,
                provider="nvidia",
                    model=settings.nvidia_model,
                    focus_limit=8,
                    generation_id=generation_id,
                )
        except Exception as exc:
            # Never re-raise: brief must not fail the ATS persistence path.
            logger.warning("ats_brief_%s_failed error=%s", provider, type(exc).__name__)
    return {
        "overall_inference": None,
        "focus_areas": [],
        "priority_actions": [],
        "section_guidance": [],
        "do_not_claim": [],
        "provider": "unavailable",
        "model": None,
        "agent": "ats_improvement_brief",
        "fallback": False,
        "report_status": "unavailable",
        "generation_id": generation_id,
    }
