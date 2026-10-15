from __future__ import annotations

from typing import Any
from unittest.mock import MagicMock
from uuid import uuid4

import pytest

from app.agents.providers.nvidia_client import strip_reasoning_markers
from app.core.config import Settings
from app.core.errors import ApiError
from app.features.profile.autofill.deriver import (
    build_proposals,
    calculate_years_experience,
    parse_year_month,
)
from app.features.profile.autofill.limiter import (
    check_and_record_user_rate_limit,
    reset_user_rate_limit_for_tests,
)
from app.features.profile.autofill.options_mapper import (
    LOCATION_OPTIONS,
    map_value_to_catalog,
    pick_best_location,
)
from app.features.profile.autofill.schema import (
    EducationItem,
    EvidenceSpan,
    ExperienceItem,
    LinkItem,
    ResumeAutofillExtraction,
)
from app.features.profile.autofill.service import (
    apply_autofill_changes,
    parse_resume_for_autofill,
)
from app.features.profile.autofill.verifier import (
    extract_alphanumeric_tokens,
    normalize_text,
    verify_and_sanitize,
    verify_date,
    verify_evidence,
)
from app.features.profile.completion import calculate_profile_completion

# --- 1. Normalisation & Verification Tests ---


def test_normalize_text_nfkc_and_bullets():
    raw = "•  Senior Software Engineer\u200b\u00ad – Python & React  "
    norm = normalize_text(raw)
    assert norm == "senior software engineer – python & react"
    assert "\u200b" not in norm
    assert "\u00ad" not in norm


def test_extract_alphanumeric_tokens():
    text = "FastAPI, PostgreSQL & Docker (v2.0)!"
    tokens = extract_alphanumeric_tokens(text)
    assert "fastapi" in tokens
    assert "postgresql" in tokens
    assert "docker" in tokens
    assert "v2" in tokens


def test_verify_evidence_length_and_substring():
    haystack = "Worked on distributed telemetry processing 40k events/sec."
    h_norm = normalize_text(haystack)
    h_compact = h_norm.replace(" ", "")

    # Valid span
    assert verify_evidence("distributed telemetry", h_norm, h_compact) is True
    # Too short (<3)
    assert verify_evidence("on", h_norm, h_compact) is False
    # Too long (>160)
    assert verify_evidence("a" * 161, h_norm, h_compact) is False
    # Not in resume
    assert verify_evidence("kubernetes cluster migration", h_norm, h_compact) is False


def test_verify_date_rules():
    tokens = {"2021", "2023", "jan", "may"}
    # Valid YYYY-MM
    assert verify_date("2021-05", tokens) == "2021-05"
    # Year only
    assert verify_date("2023", tokens) == "2023"
    # Year not in resume
    assert verify_date("2018-01", tokens) is None


def test_verify_and_sanitize_drops_hallucinated_evidence():
    source_resume = "Alex Rivers\nSoftware Engineer\nPython and Go developer in Bengaluru.\nApex University B.Tech 2022"
    extraction = ResumeAutofillExtraction(
        full_name=EvidenceSpan(value="Alex Rivers", evidence="Alex Rivers"),
        skills=["Python", "Go", "Rust"],  # Rust is hallucinated
        experience=[
            ExperienceItem(
                company="RealCorp",
                title="Software Engineer",
                evidence="Invented company not in text",  # Hallucinated evidence
            )
        ],
        education=[
            EducationItem(
                institution="Apex University",
                degree="B.Tech",
                start_year="2018",
                end_year="2022",
                evidence="Apex University B.Tech 2022",
            )
        ],
    )
    result = verify_and_sanitize(extraction, source_resume)
    assert result.extraction.full_name.value == "Alex Rivers"
    assert "Python" in result.extraction.skills
    assert "Go" in result.extraction.skills
    assert "Rust" not in result.extraction.skills
    # Experience dropped due to failing evidence
    assert len(result.extraction.experience) == 0
    # Education kept
    assert len(result.extraction.education) == 1
    assert result.extraction.education[0].institution == "Apex University"


def test_experience_summary_token_subset_check():
    source = "Built microservices using Python and Redis for low latency caching."
    extraction = ResumeAutofillExtraction(
        experience=[
            ExperienceItem(
                company="Built microservices",
                title="Python and Redis",
                summary="Built microservices using Python and Redis",  # All tokens in source
                evidence="Built microservices using Python and Redis",
            ),
            ExperienceItem(
                company="Built microservices",
                title="Python and Redis",
                summary="Built microservices with AWS DynamoDB and GraphQL",  # Hallucinated tokens
                evidence="Built microservices using Python and Redis",
            ),
        ]
    )
    result = verify_and_sanitize(extraction, source)
    assert result.extraction.experience[0].summary == "Built microservices using Python and Redis"
    # Second experience summary should be nulled because tokens don't match
    assert result.extraction.experience[1].summary is None


def test_list_caps_enforced():
    source = " ".join([f"skill{i}" for i in range(100)])
    extraction = ResumeAutofillExtraction.model_construct(
        skills=[f"skill{i}" for i in range(100)],
    )
    result = verify_and_sanitize(extraction, source)
    assert len(result.extraction.skills) == 60


# --- 2. Date Arithmetic & Derived Values Tests ---


def test_parse_year_month():
    assert parse_year_month("2023-08") == (2023, 8)
    assert parse_year_month("2023-13") is None
    assert parse_year_month("2023") is None
    assert parse_year_month(None) is None


def test_calculate_years_experience_overlapping_and_internships():
    experiences = [
        # Job 1: 2020-01 to 2021-06 (18 months)
        ExperienceItem(
            company="Co A",
            title="Dev",
            start="2020-01",
            end="2021-06",
            employment_type="full_time",
            evidence="ev",
        ),
        # Job 2 (overlapping): 2021-01 to 2022-12 (24 months). Combined with Job 1: 2020-01 to 2022-12 (36 months = 3 years)
        ExperienceItem(
            company="Co B",
            title="Senior Dev",
            start="2021-01",
            end="2022-12",
            employment_type="full_time",
            evidence="ev",
        ),
        # Internship: should be excluded
        ExperienceItem(
            company="Co C",
            title="Intern",
            start="2019-01",
            end="2019-12",
            employment_type="internship",
            evidence="ev",
        ),
    ]
    years, basis = calculate_years_experience(experiences)
    assert years == 3
    assert len(basis) == 2  # Internship excluded from basis


def test_calculate_years_experience_empty_returns_zero():
    years, basis = calculate_years_experience([])
    assert years == 0
    assert basis == []


# --- 3. Merge Status Tests ---


def test_build_proposals_merge_statuses():
    extraction = ResumeAutofillExtraction(
        full_name=EvidenceSpan(value="Jordan Lee", evidence="Jordan Lee"),
        headline=EvidenceSpan(value="Full Stack Engineer", evidence="Full Stack Engineer"),
        skills=["Python", "FastAPI", "React"],
        experience=[
            ExperienceItem(
                company="Acme Corp",
                title="Software Engineer",
                start="2022-01",
                is_current=True,
                evidence="Acme Corp Software Engineer",
            )
        ],
        links=[
            LinkItem(type="linkedin", url="https://www.linkedin.com/in/jordanlee/", evidence="ev"),
            LinkItem(type="github", url="https://github.com/jordanlee", evidence="ev"),
        ],
    )
    current_profile = {
        "full_name": "Jordan Lee",  # duplicate
        "headline": "Junior Developer",  # differs
        "current_role": None,  # new
        "years_experience": None,  # new
    }
    candidate_skills = [{"name": "Python"}]  # duplicate
    candidate_exp = [
        {"company": "Acme Corp", "role": "Software Engineer", "start_date": "2022-01-01"}  # duplicate
    ]
    candidate_edu = []
    candidate_links = [{"url": "https://linkedin.com/in/jordanlee"}]  # duplicate (after normalization)

    proposals = build_proposals(
        extraction,
        current_profile,
        candidate_skills,
        candidate_exp,
        candidate_edu,
        candidate_links,
        only_fill_empty=True,
    )

    # full_name duplicate
    assert proposals["about"]["full_name"]["status"] == "duplicate"
    assert proposals["about"]["full_name"]["selected_by_default"] is False

    # headline differs (only_fill_empty=True -> unchecked)
    assert proposals["about"]["headline"]["status"] == "differs"
    assert proposals["about"]["headline"]["selected_by_default"] is False

    # current_role is new (derived from is_current experience) -> checked
    assert proposals["about"]["current_role"]["status"] == "new"
    assert proposals["about"]["current_role"]["value"] == "Software Engineer"
    assert proposals["about"]["current_role"]["selected_by_default"] is True

    # skills
    skills_map = {s["value"]: s for s in proposals["skills"]}
    assert skills_map["Python"]["status"] == "duplicate"
    assert skills_map["Python"]["selected_by_default"] is False
    assert skills_map["FastAPI"]["status"] == "new"
    assert skills_map["FastAPI"]["selected_by_default"] is True

    # experience
    assert proposals["experience"][0]["status"] == "duplicate"

    # links
    links_map = {item["value"]["url"]: item for item in proposals["links"]}
    assert links_map["https://www.linkedin.com/in/jordanlee/"]["status"] == "duplicate"
    assert links_map["https://github.com/jordanlee"]["status"] == "new"


def test_build_proposals_only_fill_empty_false_checks_differs():
    extraction = ResumeAutofillExtraction(
        headline=EvidenceSpan(value="Lead Architect", evidence="Lead Architect"),
    )
    current_profile = {"headline": "Senior Architect"}
    proposals = build_proposals(
        extraction,
        current_profile,
        [],
        [],
        [],
        [],
        only_fill_empty=False,
    )
    assert proposals["about"]["headline"]["status"] == "differs"
    assert proposals["about"]["headline"]["selected_by_default"] is True


# --- 4. Options Mapping Tests ---


def test_pick_best_location_order():
    assert pick_best_location("Pune", "Maharashtra", "India") == "Pune"
    assert pick_best_location(None, "Maharashtra", "India") == "Maharashtra"
    assert pick_best_location(None, None, "India") == "India"
    assert pick_best_location(None, None, None) is None


def test_map_value_to_catalog():
    val, status = map_value_to_catalog("bengaluru", LOCATION_OPTIONS)
    assert val == "Bengaluru"
    assert status == "matched"

    val2, status2 = map_value_to_catalog("Seattle", LOCATION_OPTIONS, accepts_free_text=True)
    assert val2 == "Seattle"
    assert status2 == "custom"


# --- 5. Reasoning Marker Stripping Tests ---


def test_strip_reasoning_markers():
    raw_with_think = "<think>The user wants a json object with experience.</think>{\"schema_version\": \"1\"}"
    cleaned = strip_reasoning_markers(raw_with_think)
    assert cleaned == '{"schema_version": "1"}'

    raw_with_thought = "[THOUGHT]Step 1: parse education[/THOUGHT]{\"skills\": [\"Python\"]}"
    cleaned2 = strip_reasoning_markers(raw_with_thought)
    assert cleaned2 == '{"skills": ["Python"]}'


# --- 6. Completeness Calculation (8 Items) Tests ---


def test_profile_completion_eight_items():
    context_all = {
        "profile": {
            "full_name": "Test User",
            "location": "Pune",
            "current_role": "Backend Engineer",
            "years_experience": 3.0,
        },
        "skill_count": 5,
        "has_experience": True,
        "education_count": 1,
        "link_count": 2,
    }
    pct, details = calculate_profile_completion(context_all)
    assert pct == 100
    assert details["done"] == 8
    assert details["total_items"] == 8
    assert details["label"] == "Profile complete"

    context_partial = {
        "profile": {
            "full_name": "Test User",
            "location": "Pune",
            "current_role": None,
            "years_experience": 0,  # 0 counts!
        },
        "skill_count": 1,
        "has_experience": False,
        "no_experience_declared": True,  # 0 years credit for fresher
        "education_count": 0,
        "link_count": 0,
    }
    pct2, details2 = calculate_profile_completion(context_partial)
    # done: full_name (1), location (2), years_experience (3), skills (4), experience (5) = 5/8 -> 62%
    assert details2["done"] == 5
    assert pct2 == round(5 / 8 * 100)
    assert details2["label"] == "5 of 8 done"


# --- 7. Pipeline with Fake LLM Tests ---


class FakeClient:
    def __init__(self, resume_data: dict[str, Any], profile_data: dict[str, Any]):
        self._resume = resume_data
        self._profile = profile_data
        self.tables = {
            "resumes": [
                {
                    "id": str(resume_data["resume_id"]),
                    "user_id": str(profile_data["id"]),
                    "title": "My Resume",
                    "deleted_at": None,
                }
            ],
            "resume_versions": [
                {
                    "id": str(resume_data["id"]),
                    "resume_id": str(resume_data["resume_id"]),
                    "user_id": str(profile_data["id"]),
                    "version_number": 1,
                    "plain_text": resume_data["plain_text"],
                    "structured_content": resume_data.get("structured_content") or {},
                    "extraction_status": "confirmed",
                }
            ],
            "profiles": [dict(profile_data)],
            "candidate_skills": [],
            "candidate_experiences": [],
            "candidate_education": [],
            "candidate_links": [],
            "activity_events": [],
        }

    def table(self, table_name: str):
        outer = self

        class QueryBuilder:
            def __init__(self, name: str):
                self.name = name
                self.filters = []
                self._update_data = None
                self._insert_data = None
                self._delete = False

            def select(self, cols: str = "*"):
                return self

            def single(self):
                return self

            def eq(self, col: str, val: Any):
                self.filters.append((col, val))
                return self

            def in_(self, col: str, vals: list[Any]):
                return self

            def is_(self, col: str, val: Any):
                return self

            def order(self, col: str, desc: bool = False):
                return self

            def limit(self, n: int):
                return self

            def delete(self):
                self._delete = True
                return self

            def update(self, data: dict[str, Any]):
                self._update_data = data
                return self

            def insert(self, data: dict[str, Any]):
                self._insert_data = data
                return self

            def upsert(self, data: dict[str, Any]):
                self._insert_data = data
                return self

            def execute(self):
                rows = outer.tables.setdefault(self.name, [])
                if self._delete:
                    return MagicMock(data=[])
                if self._insert_data is not None:
                    row = {**self._insert_data, "id": self._insert_data.get("id") or str(uuid4())}
                    rows.append(row)
                    return MagicMock(data=[row])
                if self._update_data is not None:
                    matched = []
                    for r in rows:
                        if all(str(r.get(c)) == str(v) for c, v in self.filters):
                            r.update(self._update_data)
                            matched.append(r)
                    return MagicMock(data=matched)
                filtered = [
                    r for r in rows if all(str(r.get(c)) == str(v) for c, v in self.filters)
                ]
                return MagicMock(data=filtered)

        return QueryBuilder(table_name)


@pytest.mark.anyio
async def test_pipeline_valid_output_and_caching():
    reset_user_rate_limit_for_tests()
    user_id = str(uuid4())
    resume_id = str(uuid4())
    version_id = str(uuid4())

    source_text = (
        "Morgan Smith\nBackend Engineer\nSoftware developer in Pune.\n"
        "Skills: Python, FastAPI, Docker\n"
        "Apex University B.Tech 2021\n"
        "Experienced software developer building high throughput distributed systems in cloud environments. "
        "Passionate about API design, low-latency architectures, and modern engineering practices."
    )

    resume_row = {"id": version_id, "resume_id": resume_id, "plain_text": source_text}
    profile_row = {"id": user_id, "full_name": None, "current_role": None, "years_experience": None}
    fake_client = FakeClient(resume_row, profile_row)

    user = MagicMock()
    user.id = user_id
    settings = Settings(
        app_name="test",
        app_env="test",
        api_v1_prefix="/api/v1",
        public_api_base_url="http://127.0.0.1:8000",
        log_level="INFO",
        frontend_origins=["http://localhost:3000"],
        auth_secret="test-secret-long-enough-32-chars-ok",
        document_bucket="docs",
        avatar_bucket="avatars",
        nvidia_base_url="https://integrate.api.nvidia.com/v1",
        nvidia_model="nvidia/nemotron-3.5-lightning-30b-a3b",
        nvidia_prompt_version="1",
        groq_base_url="https://api.groq.com/openai/v1",
        groq_model="llama-3.3-70b-versatile",
        llm_provider="nvidia",
    )

    call_count = 0

    async def fake_llm(**kwargs):
        nonlocal call_count
        call_count += 1
        return (
            ResumeAutofillExtraction(
                full_name=EvidenceSpan(value="Morgan Smith", evidence="Morgan Smith"),
                headline=EvidenceSpan(value="Backend Engineer", evidence="Backend Engineer"),
                skills=["Python", "FastAPI", "Docker"],
                education=[
                    EducationItem(
                        institution="Apex University",
                        degree="B.Tech",
                        end_year="2021",
                        evidence="Apex University B.Tech 2021",
                    )
                ],
            ),
            "nvidia",
        )

    # First call: hits fake LLM
    res1 = await parse_resume_for_autofill(
        fake_client,
        settings,
        user,
        resume_id=resume_id,
        injected_llm_call=fake_llm,
    )
    assert call_count == 1
    assert res1["quality"] == "ok"
    assert res1["proposals"]["about"]["full_name"]["value"] == "Morgan Smith"
    assert res1["proposals"]["about"]["full_name"]["status"] == "new"

    # Second call without force: must hit cache and NOT invoke LLM again
    res2 = await parse_resume_for_autofill(
        fake_client,
        settings,
        user,
        resume_id=resume_id,
        injected_llm_call=fake_llm,
    )
    assert call_count == 1  # Unchanged!
    assert res2["quality"] == "ok"

    # Third call WITH force: must bypass cache and invoke LLM
    res3 = await parse_resume_for_autofill(
        fake_client,
        settings,
        user,
        resume_id=resume_id,
        force=True,
        injected_llm_call=fake_llm,
    )
    assert call_count == 2
    assert res3["quality"] == "ok"


@pytest.mark.anyio
async def test_pipeline_per_user_rate_limit():
    reset_user_rate_limit_for_tests()
    user_id = str(uuid4())
    # Exceed limit of 5
    for _ in range(5):
        check_and_record_user_rate_limit(user_id, max_per_hour=5)

    with pytest.raises(ApiError) as exc:
        check_and_record_user_rate_limit(user_id, max_per_hour=5)
    assert exc.value.status_code == 429
    assert exc.value.code == "RATE_LIMITED"


@pytest.mark.anyio
async def test_pipeline_no_text_raises_422():
    reset_user_rate_limit_for_tests()
    user_id = str(uuid4())
    resume_id = str(uuid4())
    fake_client = FakeClient(
        {"id": str(uuid4()), "resume_id": resume_id, "plain_text": "   "},
        {"id": user_id},
    )
    user = MagicMock(id=user_id)
    settings = MagicMock(resume_parse_total_timeout_seconds=65.0)

    with pytest.raises(ApiError) as exc:
        await parse_resume_for_autofill(fake_client, settings, user, resume_id=resume_id)
    assert exc.value.status_code == 422
    assert exc.value.code == "NO_TEXT"


@pytest.mark.anyio
async def test_pipeline_text_too_long_raises_422():
    reset_user_rate_limit_for_tests()
    user_id = str(uuid4())
    resume_id = str(uuid4())
    fake_client = FakeClient(
        {"id": str(uuid4()), "resume_id": resume_id, "plain_text": "a" * 45000},
        {"id": user_id},
    )
    user = MagicMock(id=user_id)
    settings = MagicMock(
        resume_parse_total_timeout_seconds=65.0,
        resume_parse_max_text_chars=40000,
        resume_parse_max_per_hour_per_user=5,
    )

    with pytest.raises(ApiError) as exc:
        await parse_resume_for_autofill(fake_client, settings, user, resume_id=resume_id)
    assert exc.value.status_code == 422
    assert exc.value.code == "TEXT_TOO_LONG"


# --- 8. Apply Endpoint Tests ---


def test_apply_autofill_changes():
    user_id = str(uuid4())
    resume_id = str(uuid4())
    fake_client = FakeClient(
        {"id": str(uuid4()), "resume_id": resume_id, "plain_text": "text"},
        {"id": user_id, "full_name": None},
    )
    user = MagicMock(id=user_id)
    settings = MagicMock(avatar_token_ttl_seconds=86400)

    changes = {
        "about": {
            "full_name": "Taylor Swift",
            "current_role": "Lead Architect",
            "years_of_experience": 8,
        },
        "skills": ["TypeScript", "Python"],
        "experience": [
            {
                "company_name": "Tech Corp",
                "role_title": "Senior Engineer",
                "start_date": "2021-01-01",
                "is_current": True,
            }
        ],
        "education": [
            {
                "institution": "Global University",
                "degree": "B.Sc",
            }
        ],
        "links": [
            {
                "link_type": "github",
                "url": "https://github.com/taylorswift",
            }
        ],
    }

    result = apply_autofill_changes(
        fake_client,
        settings,
        user,
        resume_id=resume_id,
        changes=changes,
    )
    applied = result["applied"]
    assert applied["about"] is True
    assert applied["skills"] == 2
    assert applied["experience"] == 1
    assert applied["education"] == 1
    assert applied["links"] == 1
