
from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from app.agents.providers.reliable import generate_structured_with_failover
from app.core.config import Settings
from app.core.errors import ApiError

logger = logging.getLogger(__name__)
_PROMPT_PATH = Path(__file__).resolve().parents[3] / "agents" / "prompts" / "interview_questions_v1.txt"
class InterviewQuestionItem(BaseModel):
    model_config = ConfigDict(extra="ignore")
    question: str = Field(min_length=8, max_length=800)
    question_type: str | None = Field(default=None, max_length=80)
class InterviewQuestionsResult(BaseModel):
    model_config = ConfigDict(extra="ignore")
    questions: list[InterviewQuestionItem] = Field(min_length=1, max_length=20)
async def generate_interview_questions(
    settings: Settings,
    *,
    mode: str,
    count: int,
    target_role: str | None = None,
    target_company: str | None = None,
    difficulty: str | None = None,
    topic: str | None = None,
    job_description_text: str | None = None,
    resume_text: str | None = None,
    candidate_skills: list[str] | None = None,
) -> dict[str, Any]:
    count = max(1, min(int(count or 3), 20))
    mode = (mode or "mixed").strip().lower()
    jd_text = (job_description_text or "").strip()[:12_000] or None
    res_text = (resume_text or "").strip()[:8_000] or None
    skills = [s.strip() for s in (candidate_skills or []) if str(s).strip()][:20] or None
    prompt = _PROMPT_PATH.read_text(encoding="utf-8")
    result, provider = await generate_structured_with_failover(
        settings,
        system_prompt=prompt,
        user_payload={
            "mode": mode,
            "question_count": count,
            "target_role": target_role,
            "target_company": target_company,
            "difficulty": difficulty,
            "topic": topic,
            # Only user-pasted JD text — never invent requirements.
            "job_description_text": jd_text,
            "resume_summary": res_text,
            "candidate_skills": skills,
        },
        schema_model=InterviewQuestionsResult,
    )
    try:
        result = InterviewQuestionsResult.model_validate(result)
        questions = [
            {
                "question": item.question.strip(),
                "question_type": (item.question_type or mode)[:80],
            }
            for item in result.questions[:count]
            if item.question.strip()
        ]
    except Exception as exc:
        # Enrich low-level validation for telemetry: type, truncated payload.
        raise ApiError(502, "llm_returned_no_questions", f"LLM validation failed: type={type(exc).__name__}, value={str(exc)[:120]}") from exc
    if not questions:
        raise ApiError(
            502,
            "llm_returned_no_questions",
            "The LLM returned no usable interview questions. Retry the request.",
        )
    return {
        "questions": questions,
        "provider": provider,
        "model": getattr(settings, f"{provider}_model", None),
        "agent": "interview_questions",
        "fallback": False,
    }
