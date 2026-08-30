from app.features.document_parsing.semantic_json import build_semantic_json


def test_resume_semantic_json_keeps_projects_separate_from_experience():
    result = build_semantic_json(
        {
            "professional_experience": ["Backend Engineer - Acme", "Reduced latency by 40%"],
            "academic_projects": ["Campus hiring portal", "Built with FastAPI"],
        },
        document_type="resume",
    )
    assert result["experience"] == ["Backend Engineer - Acme", "Reduced latency by 40%"]
    assert result["projects"] == ["Campus hiring portal", "Built with FastAPI"]
    assert all("project" not in item.lower() for item in result["experience"])


def test_job_description_semantic_json_preserves_original_sections():
    result = build_semantic_json(
        {"required_skills": ["Python"], "responsibilities": ["Build APIs"]},
        document_type="job_description",
    )
    assert result["required_skills"] == ["Python"]
    assert result["responsibilities"] == ["Build APIs"]
    assert result["all_sections"]["required_skills"] == ["Python"]
