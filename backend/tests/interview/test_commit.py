import asyncio
from types import SimpleNamespace

import pytest

from app.core.errors import ApiError
from app.features.interview.commit import commit_live_interview
from app.features.interview.agent.evaluator import evaluate_answer_offline


class FakeResult:
    def __init__(self, data):
        self.data = data


class FakeTable:
    def __init__(self, store, name):
        self.store = store
        self.name = name
        self._payload = None

    def insert(self, payload):
        self._payload = payload
        return self

    def execute(self):
        rows = self._payload if isinstance(self._payload, list) else [self._payload]
        self.store.setdefault(self.name, []).extend(rows)
        return FakeResult(rows)


class FakeClient:
    def __init__(self):
        self.store = {}

    def table(self, name):
        return FakeTable(self.store, name)


def test_evaluate_answer_offline_is_instant_and_scored():
    weak = evaluate_answer_offline("I fixed it.", "Tell me about a challenging bug.")
    strong = evaluate_answer_offline(
        "Recently I owned a checkout latency issue. The situation was p95 over two seconds. "
        "I profiled the API, reduced N+1 queries, and shipped a cache layer. "
        "The result was p95 under 400ms.",
        "Tell me about a challenging bug.",
    )
    assert strong["score"] > weak["score"]
    assert "spoken_reply" in strong


def test_commit_live_interview_saves_session_questions_answers_and_report(monkeypatch):
    async def fake_report(*_args, **kwargs):
        return {
            "overall_summary": "Saved live session debrief.",
            "overall_score": 70,
            "communication_score": 68,
            "structure_score": 71,
            "content_score": 72,
            "strengths": ["Answered"],
            "improvements": ["Add a result"],
            "practice_plan": ["Rehearse STAR"],
            "provider": "test",
            "model": "test-model",
            "report_version": "evidence-report-v2",
            "generation_status": "ai_generated",
        }

    monkeypatch.setattr(
        "app.features.interview.commit.generate_interview_session_report",
        fake_report,
    )
    client = FakeClient()
    result = asyncio.run(commit_live_interview(
        client,
        SimpleNamespace(),
        SimpleNamespace(id="user-1"),
        session_fields={
            "mode": "technical",
            "target_role": "Backend engineer",
            "question_count": 2,
            "camera_enabled": True,
            "microphone_enabled": True,
        },
        questions_in=[
            {"position": 1, "question": "Walk me through a production incident.", "question_type": "technical"},
            {"position": 2, "question": "How do you test a risky change?", "question_type": "technical"},
        ],
        responses_in=[
            {"position": 1, "typed_response": "I owned the outage and we shipped a fix.", "transcript": "I owned the outage and we shipped a fix."},
            {"position": 2, "typed_response": "I write tests first and watch metrics.", "transcript": "I write tests first and watch metrics."},
        ],
        now="2026-08-27T00:00:00Z",
    ))
    assert result["session"]["status"] == "completed"
    assert len(client.store["interview_questions"]) == 2
    assert len(client.store["interview_responses"]) == 2
    assert result["report"]["overall_score"] == 70
    assert result["report"]["provider"] == "test"


def test_commit_live_interview_rejects_empty_answers():
    client = FakeClient()
    with pytest.raises(ApiError) as caught:
        asyncio.run(commit_live_interview(
            client,
            SimpleNamespace(),
            SimpleNamespace(id="user-1"),
            session_fields={"mode": "mixed", "question_count": 1},
            questions_in=[{"position": 1, "question": "Tell me about yourself.", "question_type": "hr"}],
            responses_in=[],
            now="2026-08-27T00:00:00Z",
        ))
    assert caught.value.code == "empty_interview_session"


def test_commit_falls_back_when_report_agent_fails(monkeypatch):
    async def boom(*_args, **_kwargs):
        raise ApiError(503, "llm_generation_failed", "down")

    monkeypatch.setattr("app.features.interview.commit.generate_interview_session_report", boom)
    client = FakeClient()
    result = asyncio.run(
        commit_live_interview(
            client,
            SimpleNamespace(),
            SimpleNamespace(id="user-1"),
            session_fields={"mode": "mixed", "target_role": "Engineer", "question_count": 1},
            questions_in=[{"position": 1, "question": "Tell me about a time you led.", "question_type": "behavioural"}],
            responses_in=[
                {
                    "position": 1,
                    "typed_response": "I led a migration and shipped it.",
                    "transcript": "I led a migration and shipped it.",
                }
            ],
            now="2026-08-27T00:00:00Z",
        )
    )
    assert result["session"]["status"] == "completed"
    assert result["report"]["report"]["generation_status"] == "evidence_only_ai_unavailable"
    assert result["report"]["overall_score"] is not None
