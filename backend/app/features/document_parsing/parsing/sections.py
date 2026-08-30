
from __future__ import annotations

import re
from typing import Any

from app.features.document_parsing.parsing.llm_sections import (
    _looks_like_heading,
    _slug_kind,
    extract_sections_structural,
)

HEADING_ALIASES: dict[str, frozenset[str]] = {
    "contact": frozenset({"contact", "personal_details", "personal_information", "basic_information"}),
    "summary": frozenset({"summary", "profile", "professional_summary", "about_me"}),
    "skills": frozenset(
        {
            "skills",
            "technical_skills",
            "core_competencies",
            "technologies",
            "tech_stack",
            "tools",
            "technical_stack",
        }
    ),
    "experience": frozenset(
        {
            "experience",
            "work_experience",
            "professional_experience",
            "employment",
            "work_history",
            "internships",
            "internship",
        }
    ),
    "education": frozenset({"education", "academic_background", "academic_details", "qualifications"}),
    "projects": frozenset(
        {
            "projects",
            "personal_projects",
            "academic_projects",
            "project_experience",
            "key_projects",
        }
    ),
    "certifications": frozenset(
        {
            "certifications",
            "certificates",
            "licenses",
            "courses",
            "coursework",
            "training",
            "online_courses",
            "technical_certification",
            "technical_certifications",
            "certificate",
        }
    ),
    "languages": frozenset({"languages", "spoken_languages"}),
    "links": frozenset({"links", "profiles", "online_profiles", "embedded_links"}),
}


def _slug_key(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", (value or "").casefold()).strip("_")


def canonical_section_key(value: str) -> str:
    raw = (value or "").strip().casefold()
    slug = _slug_key(raw)
    for canonical, aliases in HEADING_ALIASES.items():
        if raw == canonical or slug == canonical:
            return canonical
        if raw in aliases or slug in aliases:
            return canonical
    return slug or raw


def canonicalize_sections(sections: dict[str, Any] | None) -> dict[str, list[Any]]:
    """Merge section buckets under canonical keys (skills, projects, …)."""
    if not isinstance(sections, dict):
        return {}
    out: dict[str, list[Any]] = {}
    for key, values in sections.items():
        ckey = canonical_section_key(str(key))
        bucket = out.setdefault(ckey, [])
        if isinstance(values, list):
            for item in values:
                text = str(item).strip() if item is not None else ""
                if text:
                    bucket.append(text)
        elif values is not None and str(values).strip():
            bucket.append(str(values).strip())
    return {key: values for key, values in out.items() if values}


def match_section_heading(line: str) -> str | None:
    if not _looks_like_heading(line):
        return None
    return _slug_kind(line.rstrip(":").strip())


def extract_sections(text: str, schema_version: str = "resume-extraction-v1") -> dict[str, Any]:
    """Return structural extraction with section keys canonicalized."""
    raw = extract_sections_structural(text, schema_version)
    sections = canonicalize_sections(raw.get("sections") if isinstance(raw, dict) else None)
    return {
        "schema_version": (raw.get("schema_version") if isinstance(raw, dict) else None) or schema_version,
        "sections": sections,
        "unclassified_blocks": list((raw or {}).get("unclassified_blocks") or []),
        "warnings": list((raw or {}).get("warnings") or []),
        "corrections": dict((raw or {}).get("corrections") or {}),
        "detected_headings": list((raw or {}).get("detected_headings") or []),
        "extraction_method": (raw or {}).get("extraction_method") or "structural_layout_v1",
    }
