
from __future__ import annotations

import logging
import re
from pathlib import Path
from typing import Any

from app.agents.providers.reliable import generate_structured_with_failover
from app.api.schemas import ProfileResumeExtractResult
from app.core.config import Settings
from app.features.profile.agent.deterministic import build_profile_draft, draft_counts
from app.features.profile.agent.normalize import extract_explicit_years, normalize_draft

logger = logging.getLogger(__name__)
_PROMPT_PATH = (
    Path(__file__).resolve().parents[3] / "agents" / "prompts" / "fill_profile_from_resume_v1.txt"
)
_MAX_RESUME_CHARS = 28_000
# Profile extraction receives the complete resume and a large structured schema.
# A 12-second hard cap caused the configured NVIDIA long-context provider to be
# cancelled before it could respond, which then looked like an extraction bug in
# the UI. Keep a bounded safety limit, but respect the provider's configured
# timeout up to that limit.
_MAX_AI_TIMEOUT_SECONDS = 90.0
def _norm(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").casefold()).strip()
def _haystack(plain_text: str) -> str:
    return f" {_norm(plain_text)} "
def _digits(text: str) -> str:
    return re.sub(r"\D", "", text or "")
def _supported_in_resume(value: str | None, haystack: str, *, min_len: int = 3) -> bool:
    if not value:
        return False
    needle = _norm(value)
    if len(needle) < min_len:
        return False
    if re.search(rf"(?<![a-z0-9]){re.escape(needle)}(?![a-z0-9])", haystack):
        return True
    d_val = _digits(value)
    if len(d_val) >= 8 and d_val in re.sub(r"\D", "", haystack):
        return True
    tokens = [t for t in re.split(r"[^a-z0-9+#.]+", needle) if len(t) >= 3]
    if not tokens:
        return needle in haystack
    hits = sum(1 for t in tokens if t in haystack)
    if len(tokens) == 1:
        return hits == 1
    return hits >= max(1, int(len(tokens) * 0.6))
def _date_year_supported(value: str | None, haystack: str) -> bool:
    match = re.search(r"(?:19|20)\d{2}", str(value or ""))
    return bool(match and match.group(0) in haystack)


def _credential_url_supported(name: str, url: str, plain_text: str) -> bool:
    """Allow a credential URL only when the source ties it to this credential."""
    name_norm = _norm(name)
    url_norm = _norm(url)
    lines = [line.strip() for line in (plain_text or "").splitlines() if line.strip()]
    in_embedded_links = False
    for line in lines:
        heading = re.sub(r"[:\s]+$", "", line).casefold()
        if heading in {"embedded links", "links", "profiles", "online profiles"}:
            in_embedded_links = True
            continue
        if in_embedded_links and not re.search(r"https?://|www\.", line, re.I):
            # A new all-caps/title heading ends the recovered-link block.
            if line.isupper() or (len(line.split()) <= 6 and line == line.title()):
                in_embedded_links = False
        if url_norm in _norm(line) and name_norm in _norm(line):
            return True
        if in_embedded_links and url_norm in _norm(line):
            label = re.sub(r"https?://\S+|www\.\S+", "", line, flags=re.I).strip(" \t—–-:·|")
            label_norm = _norm(label)
            if label_norm and (label_norm == name_norm or label_norm in name_norm or name_norm in label_norm):
                return True
    return False
def _llm_to_draft(result: ProfileResumeExtractResult) -> dict[str, Any]:
    profile = result.profile.model_dump()
    profile["career_goal"] = None
    profile["selected"] = True
    skills = [
        {"name": name.strip(), "source": "resume_ai", "selected": True}
        for name in result.skills
        if isinstance(name, str) and name.strip()
    ]
    experiences = []
    for index, item in enumerate(result.experiences):
        row = item.model_dump()
        row["display_order"] = index
        row["selected"] = True
        experiences.append(row)
    education = []
    for index, item in enumerate(result.education):
        row = item.model_dump()
        row["display_order"] = index
        row["selected"] = True
        education.append(row)
    projects = []
    for index, item in enumerate(result.projects):
        row = item.model_dump()
        row["skills"] = []
        row["display_order"] = index
        row["selected"] = True
        projects.append(row)
    certifications = [{**item.model_dump(), "selected": True} for item in result.certifications]
    languages = [{**item.model_dump(), "selected": True} for item in result.languages]
    links = [{**item.model_dump(), "selected": True} for item in result.links]
    return {
        "profile": profile,
        "skills": skills,
        "experiences": experiences,
        "education": education,
        "projects": projects,
        "certifications": certifications,
        "languages": languages,
        "links": links,
        "meta": {
            "warnings": list(result.warnings or []),
            "method": "ai_structured_profile_extract_v1",
            "ai_used": True,
        },
    }
def _filter_draft_by_evidence(draft: dict[str, Any], plain_text: str) -> dict[str, Any]:
    hay = _haystack(plain_text)
    out = {
        "profile": dict(draft.get("profile") or {}),
        "skills": [],
        "experiences": [],
        "education": [],
        "projects": [],
        "certifications": [],
        "languages": [],
        "links": [],
        "meta": dict(draft.get("meta") or {}),
    }
    warnings = list(out["meta"].get("warnings") or [])
    profile = out["profile"]
    for key in ("full_name", "phone", "location", "current_role"):
        val = profile.get(key)
        if val and not _supported_in_resume(str(val), hay, min_len=2 if key in {"phone", "full_name"} else 3):
            profile[key] = None
            warnings.append(f"Dropped unsupported {key} from AI extract (not found in resume text).")
    for key in ("headline", "bio"):
        val = profile.get(key)
        if not val:
            continue
        tokens = [t for t in re.split(r"[^a-z0-9]+", _norm(str(val))) if len(t) >= 4]
        if tokens and sum(1 for t in tokens[:15] if t in hay) < max(1, min(2, len(tokens) // 4)):
            if not any(t in hay for t in tokens[:10]):
                profile[key] = None
                warnings.append(f"Dropped unsupported {key} from AI extract.")
    for skill in draft.get("skills") or []:
        name = str(skill.get("name") or "").strip()
        if name and _supported_in_resume(name, hay, min_len=2):
            out["skills"].append({**skill, "name": name, "selected": True})
    for exp in draft.get("experiences") or []:
        company = str(exp.get("company_name") or "").strip()
        role = str(exp.get("role_title") or "").strip()
        if not role or not company:
            continue
        company_ok = _supported_in_resume(company, hay, min_len=3)
        role_ok = _supported_in_resume(role, hay, min_len=3)
        if company_ok and role_ok:
            row = {**exp, "company_name": company, "role_title": role, "selected": True}
            if row.get("start_date") and not _date_year_supported(row["start_date"], hay):
                row["start_date"] = None
            if row.get("end_date") and not _date_year_supported(row["end_date"], hay):
                row["end_date"] = None
            if row.get("is_current"):
                row["end_date"] = None
            out["experiences"].append(row)
    for edu in draft.get("education") or []:
        inst = str(edu.get("institution") or "").strip()
        degree = str(edu.get("degree") or "").strip()
        if not inst and not degree:
            continue
        institution_ok = bool(inst) and _supported_in_resume(inst, hay, min_len=3)
        degree_ok = not degree or _supported_in_resume(degree, hay, min_len=3)
        if institution_ok and degree_ok:
            out["education"].append({**edu, "selected": True})
    for proj in draft.get("projects") or []:
        title = str(proj.get("title") or "").strip()
        if title and _supported_in_resume(title, hay, min_len=2):
            out["projects"].append({**proj, "selected": True})
    for cert in draft.get("certifications") or []:
        name = str(cert.get("name") or "").strip()
        name_tokens = [token for token in re.split(r"[^a-z0-9+#]+", _norm(name)) if len(token) >= 3]
        name_is_grounded = (
            bool(name)
            and _supported_in_resume(name, hay, min_len=3)
            and all(token in hay for token in name_tokens)
        )
        if name_is_grounded:
            row = {**cert, "selected": True}
            credential_url = str(row.get("credential_url") or "").strip()
            if credential_url and not _credential_url_supported(name, credential_url, plain_text):
                row["credential_url"] = None
                warnings.append(f"Dropped unsupported credential URL for {name}.")
            out["certifications"].append(row)
    for lang in draft.get("languages") or []:
        language = str(lang.get("language") or "").strip()
        if language and _supported_in_resume(language, hay, min_len=2):
            out["languages"].append({**lang, "selected": True})
    compact_hay = hay.replace(" ", "")
    for link in draft.get("links") or []:
        url = str(link.get("url") or "").strip()
        if not url:
            continue
        host = re.sub(r"^https?://(www\.)?", "", url.casefold()).split("/")[0]
        if (host and host in compact_hay) or _supported_in_resume(url, hay, min_len=6):
            out["links"].append({**link, "selected": True})
    out["meta"]["warnings"] = warnings
    return out
def _prefer(a: Any, b: Any) -> Any:
    if a is None or (isinstance(a, str) and not str(a).strip()):
        return b
    return a
def _prefer_years(ai_years: Any, base_years: Any, plain_text: str) -> float | None:
    explicit = extract_explicit_years(plain_text)
    # Do not infer years from the number of jobs or from an ungrounded model
    # estimate. Only an explicit duration in the source document is safe.
    return explicit
def merge_profile_drafts(
    base: dict[str, Any],
    ai: dict[str, Any],
    *,
    plain_text: str,
) -> dict[str, Any]:
    filtered_ai = _filter_draft_by_evidence(ai, plain_text)
    bp = base.get("profile") or {}
    ap = filtered_ai.get("profile") or {}
    profile = {
        "full_name": _prefer(ap.get("full_name"), bp.get("full_name")),
        "headline": _prefer(ap.get("headline"), bp.get("headline")),
        "bio": _prefer(ap.get("bio"), bp.get("bio")),
        "phone": _prefer(bp.get("phone"), ap.get("phone")),
        "location": _prefer(ap.get("location"), bp.get("location")),
        "current_role": _prefer(ap.get("current_role"), bp.get("current_role")),
        "years_experience": _prefer_years(ap.get("years_experience"), bp.get("years_experience"), plain_text),
        "career_level": _prefer(ap.get("career_level"), bp.get("career_level")),
        "career_goal": bp.get("career_goal"),
        "selected": True,
    }
    def _merge_list(ai_rows: list, base_rows: list, key_fn) -> list:
        if ai_rows:
            seen = {key_fn(row) for row in ai_rows}
            merged = list(ai_rows)
            for row in base_rows:
                k = key_fn(row)
                if k and k not in seen:
                    merged.append(row)
                    seen.add(k)
            return merged
        return list(base_rows)
    # Prefer AI skills when present. Deterministic whole-doc heuristics are noisy;
    # unioning them pollutes profiles (and downstream ATS / skill import) with
    # short non-skill fragments. Fall back to deterministic only if AI found none.
    ai_skills = filtered_ai.get("skills") or []
    base_skills = base.get("skills") or []
    if ai_skills:
        skills = list(ai_skills)
    else:
        skills = list(base_skills)
    ai_experiences = filtered_ai.get("experiences") or []
    base_experiences = base.get("experiences") or []
    base_by_key = {
        (_norm(str(row.get("company_name") or "")), _norm(str(row.get("role_title") or ""))): row
        for row in base_experiences
    }
    experiences = []
    seen_experiences: set[tuple[str, str]] = set()
    for row in ai_experiences:
        key = (_norm(str(row.get("company_name") or "")), _norm(str(row.get("role_title") or "")))
        base_row = base_by_key.get(key) or {}
        experiences.append({
            **base_row,
            **row,
            "start_date": row.get("start_date") or base_row.get("start_date"),
            "end_date": None if row.get("is_current") else (row.get("end_date") or base_row.get("end_date")),
        })
        seen_experiences.add(key)
    for row in base_experiences:
        key = (_norm(str(row.get("company_name") or "")), _norm(str(row.get("role_title") or "")))
        if key not in seen_experiences:
            experiences.append(row)
    education = _merge_list(
        filtered_ai.get("education") or [],
        base.get("education") or [],
        lambda r: (_norm(str(r.get("institution") or "")), _norm(str(r.get("degree") or ""))),
    )
    projects = _merge_list(
        filtered_ai.get("projects") or [],
        base.get("projects") or [],
        lambda r: _norm(str(r.get("title") or "")),
    )
    certifications = []
    base_certs = {
        _norm(str(row.get("name") or "")): row for row in (base.get("certifications") or [])
    }
    seen_certs: set[str] = set()
    for row in filtered_ai.get("certifications") or []:
        key = _norm(str(row.get("name") or ""))
        if not key or key in seen_certs:
            continue
        base_row = base_certs.get(key) or {}
        certifications.append({**base_row, **row, "credential_url": row.get("credential_url") or base_row.get("credential_url")})
        seen_certs.add(key)
    for row in base.get("certifications") or []:
        key = _norm(str(row.get("name") or ""))
        if key and key not in seen_certs:
            certifications.append(row)
            seen_certs.add(key)
    languages = _merge_list(
        filtered_ai.get("languages") or [],
        base.get("languages") or [],
        lambda r: _norm(str(r.get("language") or "")),
    )
    links = _merge_list(
        filtered_ai.get("links") or [],
        base.get("links") or [],
        lambda r: _norm(str(r.get("url") or "")),
    )
    warnings = []
    warnings.extend((base.get("meta") or {}).get("warnings") or [])
    warnings.extend((filtered_ai.get("meta") or {}).get("warnings") or [])
    warnings.append("AI structured extraction merged with deterministic parsing. Review before applying.")
    draft = {
        "profile": profile,
        "skills": skills[:50],
        "experiences": experiences[:30],
        "education": education[:15],
        "projects": projects[:20],
        "certifications": certifications[:20],
        "languages": languages[:15],
        "links": links[:15],
        "meta": {
            "email_detected": (base.get("meta") or {}).get("email_detected"),
            "method": "ai_plus_deterministic_profile_fill_v1",
            "ai_used": True,
            "warnings": warnings[:30],
        },
    }
    return normalize_draft(draft, resume_text=plain_text)
async def build_profile_draft_enriched(
    plain_text: str,
    structured_content: dict[str, Any] | None,
    settings: Settings,
) -> dict[str, Any]:
    base = build_profile_draft(plain_text, structured_content)
    text = (plain_text or "").strip()
    if not text:
        return base
    sections = {}
    if isinstance(structured_content, dict):
        sections = structured_content.get("sections") or {}
    clipped = text[:_MAX_RESUME_CHARS]
    prompt = _PROMPT_PATH.read_text(encoding="utf-8")
    user_payload = {
        "task": "extract_candidate_profile_from_resume",
        "resume_plain_text": clipped,
        "resume_sections": sections,
        "instructions": "Extract only facts present in the resume. Prefer accurate job/education splits.",
    }
    result, provider = await generate_structured_with_failover(
        settings,
        system_prompt=prompt,
        user_payload=user_payload,
        schema_model=ProfileResumeExtractResult,
        temperature=0.2,
    )
    ai_draft = _llm_to_draft(result)
    merged = merge_profile_drafts(base, ai_draft, plain_text=text)
    meta = dict(merged.get("meta") or {})
    meta["agent"] = "profile_fill"
    meta["provider"] = provider
    meta["fallback"] = False
    meta["ai_used"] = True
    merged["meta"] = meta
    return merged
def profile_draft_response_payload(
    draft: dict[str, Any],
    version_meta: dict[str, Any],
) -> dict[str, Any]:
    fields = (draft.get("meta") or {}).get("fields_extracted") or {}
    return {
        "draft": draft,
        "counts": draft_counts(draft),
        "fields_extracted": fields,
        "resume": version_meta,
        "ai_used": bool((draft.get("meta") or {}).get("ai_used")),
        "method": (draft.get("meta") or {}).get("method"),
        "disclaimer": (
            "Review every field before applying. "
            "Extraction maps: name, phone, location, role, years, skills, experience, education, "
            "projects, certifications, languages, and links. AI uses resume text only when configured."
        ),
    }
