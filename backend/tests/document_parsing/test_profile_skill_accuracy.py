"""Regression: skill extraction must not pollute profiles with short non-skill fragments."""
from __future__ import annotations

from app.features.document_parsing.parsing.llm_sections import extract_sections_structural
from app.features.document_parsing.pipeline import _clean_structured
from app.features.profile.agent.deterministic import build_profile_draft
from app.features.profile.agent.pipeline import merge_profile_drafts

RESUME_NO_SKILLS_SECTION = """
Priyansu Candidate
Maharashtra
email@example.com

Academic Projects
Career Gap Detection System
Duration : 1 Month
Built gap detection for resumes using FastAPI and Python
PGCP-AI
Feb26
612

Technical Certification
AWS Cloud Practitioner
Duration : 1 Month
Technologies used: FastAPI, React, PostgreSQL

Education
B.Tech Computer Science
2020 - 2024
"""

JUNK = {
    "maharashtra",
    "pgcp-ai",
    "feb26",
    "612",
    "duration : 1 month",
    "academic projects",
    "priyansu candidate",
    "email@example.com",
    "technical certification",
    "education",
    "2020 - 2024",
}


def _names(draft: dict) -> set[str]:
    return {str(s.get("name") or "").casefold() for s in (draft.get("skills") or [])}


def test_deterministic_skills_only_from_labeled_or_skills_section() -> None:
    structural = extract_sections_structural(RESUME_NO_SKILLS_SECTION)
    cleaned = _clean_structured(structural, "resume-extraction-v1", source_text=RESUME_NO_SKILLS_SECTION)
    draft = build_profile_draft(RESUME_NO_SKILLS_SECTION, cleaned)
    names = _names(draft)
    # Labeled tech line recovers real tools without a Skills heading.
    assert "fastapi" in names
    assert "react" in names
    assert "postgresql" in names
    # Short layout fragments must not become skills.
    assert not (names & JUNK)


def test_merge_prefers_ai_skills_and_drops_deterministic_noise() -> None:
    structural = extract_sections_structural(RESUME_NO_SKILLS_SECTION)
    cleaned = _clean_structured(structural, "resume-extraction-v1", source_text=RESUME_NO_SKILLS_SECTION)
    base = build_profile_draft(RESUME_NO_SKILLS_SECTION, cleaned)
    # Force some junk into base to prove merge policy (not just extraction).
    base["skills"] = [
        *base.get("skills", []),
        {"name": "Maharashtra", "source": "resume_import", "selected": True},
        {"name": "Feb26", "source": "resume_import", "selected": True},
    ]
    ai = {
        "profile": dict(base.get("profile") or {}),
        "skills": [
            {"name": "Python", "source": "resume_ai", "selected": True},
            {"name": "FastAPI", "source": "resume_ai", "selected": True},
            {"name": "React", "source": "resume_ai", "selected": True},
            {"name": "PostgreSQL", "source": "resume_ai", "selected": True},
        ],
        "experiences": [],
        "education": [],
        "projects": [],
        "certifications": [],
        "languages": [],
        "links": [],
        "meta": {"warnings": [], "method": "ai", "ai_used": True},
    }
    merged = merge_profile_drafts(base, ai, plain_text=RESUME_NO_SKILLS_SECTION)
    names = _names(merged)
    assert names == {"python", "fastapi", "react", "postgresql"}
    assert not (names & JUNK)
    assert all(s.get("source") == "resume_ai" for s in merged.get("skills") or [])


def test_merge_falls_back_to_deterministic_when_ai_has_no_skills() -> None:
    structural = extract_sections_structural(RESUME_NO_SKILLS_SECTION)
    cleaned = _clean_structured(structural, "resume-extraction-v1", source_text=RESUME_NO_SKILLS_SECTION)
    base = build_profile_draft(RESUME_NO_SKILLS_SECTION, cleaned)
    ai = {
        "profile": dict(base.get("profile") or {}),
        "skills": [],
        "experiences": [],
        "education": [],
        "projects": [],
        "certifications": [],
        "languages": [],
        "links": [],
        "meta": {"warnings": [], "method": "ai", "ai_used": True},
    }
    merged = merge_profile_drafts(base, ai, plain_text=RESUME_NO_SKILLS_SECTION)
    names = _names(merged)
    # AI empty → keep scoped deterministic skills (labeled line).
    assert "fastapi" in names or "react" in names or "postgresql" in names
    assert not (names & JUNK)


def test_academic_projects_map_to_projects_section() -> None:
    structural = extract_sections_structural(RESUME_NO_SKILLS_SECTION)
    cleaned = _clean_structured(structural, "resume-extraction-v1", source_text=RESUME_NO_SKILLS_SECTION)
    draft = build_profile_draft(RESUME_NO_SKILLS_SECTION, cleaned)
    titles = {str(p.get("title") or "").casefold() for p in (draft.get("projects") or [])}
    assert any("gap detection" in t or "career" in t for t in titles)


def test_name_is_recovered_from_combined_or_unclassified_resume_header() -> None:
    resume = """
    Priyansu Pattanaik | priyansupattanaikwork@gmail.com | +91 9876543210
    Backend Engineer
    Skills: Python, FastAPI
    Experience
    Built APIs for recruitment workflows.
    """

    draft = build_profile_draft(resume, {"sections": {"skills": ["Skills: Python, FastAPI"]}})

    assert draft["profile"]["full_name"] == "Priyansu Pattanaik"
    assert draft["profile"]["phone"]
    assert any(skill["name"].casefold() == "python" for skill in draft["skills"])


def test_merge_prefers_agent_semantics_for_an_evidenced_embedded_link() -> None:
    url = "https://priyansu.example.dev"
    base = build_profile_draft(f"Portfolio\n{url}", {})
    ai = {
        "profile": {},
        "skills": [],
        "experiences": [],
        "education": [],
        "projects": [],
        "certifications": [],
        "languages": [],
        "links": [
            {
                "link_type": "portfolio",
                "url": url,
                "label": "Portfolio",
                "source": "resume_ai",
                "selected": True,
            }
        ],
        "meta": {"warnings": [], "method": "ai", "ai_used": True},
    }

    merged = merge_profile_drafts(base, ai, plain_text=f"Portfolio\n{url}")

    assert merged["links"] == [
        {
            "link_type": "portfolio",
            "url": url,
            "label": "Portfolio",
            "source": "resume_ai",
            "selected": True,
        }
    ]
