"""Tests for pure business logic in ATS scoring and analysis."""
import pytest
from app.features.ats.ats_score import (
    AtsScore,
    ats_source_fingerprint,
    evidence_match_status,
    score_resume,
)


def test_ats_source_fingerprint_deterministic():
    fp1 = ats_source_fingerprint("Python Developer", None, "Job Description with Python")
    fp2 = ats_source_fingerprint("Python Developer", None, "Job Description with Python")
    assert fp1 == fp2
    assert isinstance(fp1, str)
    assert len(fp1) == 64  # SHA256 hex


def test_evidence_match_status():
    assert evidence_match_status("strong") == "strong_match"
    assert evidence_match_status("partial") == "partial_match"
    assert evidence_match_status("missing") == "not_found"
    assert evidence_match_status("unknown") == "unverified"


def test_score_resume_empty_raises():
    with pytest.raises(ValueError, match="not contain enough scorable terms"):
        score_resume("", "")


def test_score_resume_matching_skills():
    resume = """
    Skills:
    - Python, FastAPI, PostgreSQL, TypeScript, React

    Experience:
    Senior Software Engineer:
    - Built services with FastAPI and PostgreSQL
    """
    jd = """
    Job Requirements:
    - 5+ years of experience in Python development
    - Experience with FastAPI and PostgreSQL
    - Strong skills in TypeScript and React
    """
    score = score_resume(resume, jd)
    assert isinstance(score, AtsScore)
    assert score.overall_score > 30
    all_terms = [t.lower() for t in score.matched_terms + score.partial_terms]
    assert any("python" in k for k in all_terms)
