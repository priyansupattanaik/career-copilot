from __future__ import annotations

import re
from typing import Any

_STAR_MARKERS = (
    "situation",
    "task",
    "action",
    "result",
    "because",
    "i led",
    "i owned",
    "we shipped",
    "impact",
    "outcome",
    "measured",
)

_EXAMPLE_MARKERS = (
    "for example",
    "for instance",
    "when i",
    "one time",
    "recently",
    "last year",
    "on a project",
    "at my last",
)

_RESULT_MARKERS = (
    "result",
    "outcome",
    "impact",
    "shipped",
    "reduced",
    "increased",
    "improved",
    "saved",
    "grew",
    "%",
    "percent",
)


def is_follow_up_question(source_context: dict[str, Any] | None) -> bool:
    if not isinstance(source_context, dict):
        return False
    return str(source_context.get("kind") or "").strip().lower() == "follow_up"


def decide_interviewer_turn(
    *,
    answer: str,
    question: str,
    question_type: str | None = None,
    already_followed_up: bool = False,
) -> dict[str, Any]:
    """Deterministic live-turn decision: short spoken reply + optional probe.

    Used when the LLM omits conversational fields, and as a cap so follow-ups
    cannot chain forever. Never invents candidate experience.
    """
    text = (answer or "").strip()
    words = re.findall(r"[A-Za-z']+", text.lower())
    word_count = len(words)
    lower = text.lower()
    q = (question or "").strip().lower()
    kind = (question_type or "").strip().lower()
    star_hits = sum(1 for marker in _STAR_MARKERS if marker in lower)
    has_example = any(token in lower for token in _EXAMPLE_MARKERS)
    has_result = any(token in lower for token in _RESULT_MARKERS)
    behavioural = kind in {"behavioural", "behavioral", "hr", "situational"} or any(
        token in q for token in ("tell me about", "a time", "example", "conflict", "challenge")
    )

    if already_followed_up:
        return {
            "should_follow_up": False,
            "follow_up_question": None,
            "spoken_reply": "Thanks, that helps. Let's keep going.",
        }
    if not text:
        return {
            "should_follow_up": True,
            "follow_up_question": (
                "Take that again with a bit more room — what happened, what did you do, and how did it turn out?"
            ),
            "spoken_reply": "I didn't catch a full answer there. Let's stay on this one.",
        }
    complete_enough = word_count >= 28 and (has_example or star_hits >= 2) and (has_result or star_hits >= 2)
    if complete_enough:
        return {
            "should_follow_up": False,
            "follow_up_question": None,
            "spoken_reply": "Thanks, that was clear. Let's move on.",
        }
    if word_count < 18:
        return {
            "should_follow_up": True,
            "follow_up_question": (
                "Expand on that — what was the situation, what did you personally do, and what changed?"
            ),
            "spoken_reply": "That's a start, but I need more of the story.",
        }
    if behavioural and not has_example:
        return {
            "should_follow_up": True,
            "follow_up_question": "What specifically did you do, and what changed because of it?",
            "spoken_reply": "I'm with you on the setup. Stay with that example for a second.",
        }
    if not has_example:
        return {
            "should_follow_up": True,
            "follow_up_question": "Can you walk me through one concrete example of that in practice?",
            "spoken_reply": "Got it. I want to hear how that looked in a real situation.",
        }
    if behavioural and not has_result:
        return {
            "should_follow_up": True,
            "follow_up_question": "What was the result of that work — for you, the team, or the product?",
            "spoken_reply": "Useful context. Let's land the outcome.",
        }
    return {
        "should_follow_up": False,
        "follow_up_question": None,
        "spoken_reply": "Thanks, that was clear. Let's move on.",
    }


def merge_interviewer_turn(
    llm_turn: dict[str, Any] | None,
    heuristic: dict[str, Any],
    *,
    already_followed_up: bool,
) -> dict[str, Any]:
    """Prefer a valid LLM spoken reply / probe, else the heuristic turn."""
    if already_followed_up:
        return {
            "should_follow_up": False,
            "follow_up_question": None,
            "spoken_reply": (
                str((llm_turn or {}).get("spoken_reply") or heuristic.get("spoken_reply") or "")
                .strip()
                or "Thanks, that helps. Let's keep going."
            )[:500],
        }
    payload = llm_turn if isinstance(llm_turn, dict) else {}
    spoken = str(payload.get("spoken_reply") or heuristic.get("spoken_reply") or "").strip()
    follow = str(payload.get("follow_up_question") or heuristic.get("follow_up_question") or "").strip()
    should = payload.get("should_follow_up")
    if should is None:
        should = bool(heuristic.get("should_follow_up"))
    should = bool(should) and len(follow) >= 8
    if not should:
        follow = ""
        if not spoken:
            spoken = str(heuristic.get("spoken_reply") or "Thanks, that was clear. Let's move on.")
    return {
        "should_follow_up": should,
        "follow_up_question": follow[:800] if follow else None,
        "spoken_reply": (spoken or "Thanks, I've noted that. Let's continue.")[:500],
    }


def max_question_budget(session: dict[str, Any]) -> int:
    planned = int(session.get("question_count") or 5)
    planned = max(1, min(planned, 20))
    # One follow-up per seed question, never more than 2x the planned set.
    return min(20, planned * 2)
