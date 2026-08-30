import asyncio
from types import SimpleNamespace
from unittest.mock import patch

from app.api.schemas import JobFitBatch, JobFitDecision
from app.features.job_agent import rank_jobs_with_agent


def test_job_agent_only_returns_evaluations_for_supplied_jobs():
    async def fake_generate(*args, **kwargs):
        return (
            JobFitBatch(
                evaluations=[
                    JobFitDecision(
                        job_id="unknown",
                        score=99,
                        verdict="strong_fit",
                    ),
                    JobFitDecision(
                        job_id="job-1",
                        score=82,
                        verdict="strong_fit",
                        strengths=["Python"],
                        gaps=["Kubernetes"],
                        rationale="The profile evidence supports the core engineering work.",
                    ),
                ]
            ),
            "nvidia",
        )

    jobs = [{"id": "job-1", "title": "Backend Engineer", "requirements": ["Python"]}]
    with patch("app.features.job_agent.generate_structured_with_failover", new=fake_generate):
        result, provider = asyncio.run(
            rank_jobs_with_agent(
                SimpleNamespace(),
                candidate={"skills": ["Python"]},
                jobs=jobs,
            )
        )

    assert provider == "nvidia"
    assert [item["job_id"] for item in result["evaluations"]] == ["job-1"]
    assert result["evaluations"][0]["score"] == 82
