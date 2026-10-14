"""Mock interview sessions."""
import logging
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, File, UploadFile
from fastapi.responses import Response as PlainResponse

from app.api.schemas import (
    InterviewCommit,
    InterviewCreate,
    InterviewPreparationCreate,
    InterviewResponseCreate,
    InterviewTtsRequest,
)
from app.api.support import (
    utc_now,
)
from app.core.config import Settings, get_settings
from app.core.errors import ApiError
from app.database.repository import (
    client_for,
    owned_row,
    owned_rows,
    sort_rows_by_recency,
    write_activity,
)
from app.features.auth.service import (
    CurrentUser,
    get_current_user,
    get_current_user_optional,
)
from app.features.interview.agent import (
    evaluate_interview_answer,
    generate_interview_questions,
    generate_interview_session_report,
)
from app.features.interview.agent.evaluator import INTERVIEW_REPORT_VERSION
from app.features.interview.commit import commit_live_interview
from app.features.interview.follow_up import (
    is_follow_up_question,
    max_question_budget,
)
from app.features.interview.preparation import generate_interview_preparation

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/interviews")
def list_interviews(
    user: CurrentUser = Depends(get_current_user), settings: Settings = Depends(get_settings)
):
    """Return all interview sessions for the signed-in user, newest first.

    Uses the same collection and user filter as dashboard bootstrap
    (`_latest_actions` / interview counts) so the mock-interview list stays
    aligned with "Last mock interview" on the dashboard.
    """
    return owned_rows(
        client_for(settings, user),
        "interview_sessions",
        user,
        "created_at",
        desc=True,
    )


@router.post("/interview-preparation")
async def create_interview_preparation(
    payload: InterviewPreparationCreate,
    user: CurrentUser = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
):
    """Return a non-persistent preparation plan from confirmed candidate evidence."""
    return await generate_interview_preparation(
        client_for(settings, user),
        settings,
        user,
        resume_version_id=payload.resume_version_id,
        job_description_id=payload.job_description_id,
    )


@router.get("/interviews/tts/status")
def interview_tts_status(
    user: CurrentUser | None = Depends(get_current_user_optional),
    settings: Settings = Depends(get_settings),
):
    """Whether a server interviewer voice is available (no secrets leaked)."""
    _ = user
    from app.features.interview.tts import preferred_tts_provider

    groq_ready = bool(settings.groq_tts_configured)
    nvidia_ready = bool(settings.nvidia_tts_configured)
    fish_ready = bool(settings.fish_audio_configured)
    configured = groq_ready or nvidia_ready or fish_ready
    stt_configured = bool(settings.groq_configured)
    chain: list[str] = []
    if groq_ready:
        chain.append("groq_orpheus")
    if nvidia_ready:
        chain.append("nvidia_magpie")
    if fish_ready:
        chain.append("fish_audio")
    chain.append("browser_speech_synthesis")
    provider = preferred_tts_provider(settings)
    if groq_ready:
        model = (settings.groq_tts_model or "").strip() or None
        voice = (settings.groq_tts_voice or "").strip() or None
    elif nvidia_ready:
        model = "nvidia/magpie-tts-multilingual"
        voice = (settings.nvidia_tts_voice or "").strip() or None
    else:
        model = (settings.fish_audio_model or "").strip() or None
        voice = None
    fallbacks = chain[1:]
    return {
        "provider": provider,
        "configured": configured,
        "model": model,
        "voice": voice,
        "fallback": fallbacks[0] if fallbacks else "browser_speech_synthesis",
        "fallbacks": fallbacks,
        "stt_provider": "groq_whisper" if stt_configured else None,
        "stt_configured": stt_configured,
    }


@router.post("/interviews/tts")
def interview_tts(
    payload: InterviewTtsRequest,
    user: CurrentUser | None = Depends(get_current_user_optional),
    settings: Settings = Depends(get_settings),
):
    """
    Synthesize interviewer speech. Tries Groq Orpheus, then NVIDIA Magpie, then Fish.
    Clients should fall back to browser TTS on 503 so the session never stalls silent.
    """
    _ = user
    if not settings.interviewer_tts_configured:
        raise ApiError(
            503,
            "tts_unavailable",
            "Interviewer voice is not configured. Set GROQ_API_KEY or NVIDIA_API_KEY, or use browser speech.",
        )
    from app.features.interview.tts import synthesize_speech

    try:
        audio, media_type, provider = synthesize_speech(settings, payload.text)
    except ValueError as exc:
        raise ApiError(400, "tts_invalid_text", str(exc)) from exc
    except RuntimeError as exc:
        raise ApiError(503, "tts_provider_error", str(exc)) from exc

    return PlainResponse(
        content=audio,
        media_type=media_type,
        headers={
            "Cache-Control": "no-store",
            "X-TTS-Provider": provider,
            "X-TTS-Kind": payload.kind,
        },
    )


@router.post("/interviews/transcribe")
async def interview_transcribe(
    audio: UploadFile = File(...),
    user: CurrentUser | None = Depends(get_current_user_optional),
    settings: Settings = Depends(get_settings),
):
    """Verbatim speech-to-text for a spoken answer (Groq Whisper). Keeps filler words."""
    _ = user
    from app.features.interview.transcribe import MAX_AUDIO_BYTES, transcribe_audio

    if not settings.groq_configured:
        raise ApiError(
            503,
            "stt_unavailable",
            "Speech transcription is not configured. Browser speech recognition remains available.",
        )
    raw = await audio.read()
    if not raw:
        raise ApiError(400, "stt_empty_audio", "Audio is empty.")
    if len(raw) > MAX_AUDIO_BYTES:
        raise ApiError(413, "stt_audio_too_large", "Audio is too large to transcribe.")
    filename = (audio.filename or "answer.webm").strip() or "answer.webm"
    content_type = (audio.content_type or "audio/webm").split(";")[0]
    try:
        transcript = transcribe_audio(
            settings,
            raw,
            filename=filename,
            content_type=content_type,
        )
    except ValueError as exc:
        raise ApiError(400, "stt_invalid_audio", str(exc)) from exc
    except RuntimeError as exc:
        raise ApiError(503, "stt_provider_error", str(exc)) from exc
    return {"transcript": transcript, "provider": "groq_whisper"}


@router.post("/interviews/commit", status_code=201)
async def commit_interview(
    payload: InterviewCommit,
    user: CurrentUser = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
):
    """Save a finished live interview (questions + answers) and build the debrief.

    The live round runs on the client with no per-answer writes. This is the
    single persistence + agent pass after the candidate completes the session.
    """
    client = client_for(settings, user)
    body = payload.session.model_dump(mode="json")
    for key in ("target_role", "target_company", "topic", "difficulty", "job_description_text"):
        value = body.get(key)
        if isinstance(value, str):
            cleaned = value.strip()
            body[key] = cleaned or None
    if body.get("job_description_text"):
        body["job_description_text"] = str(body["job_description_text"])[:20_000]
    result = await commit_live_interview(
        client,
        settings,
        user,
        session_fields=body,
        questions_in=[item.model_dump(mode="json") for item in payload.questions],
        responses_in=[item.model_dump(mode="json") for item in payload.responses],
        now=utc_now(),
    )
    write_activity(
        client,
        user,
        "interview_completed",
        "Practice session saved",
        "interview_session",
        str(result["session"]["id"]),
    )
    return result


@router.post("/interviews", status_code=201)
def create_interview(
    payload: InterviewCreate,
    user: CurrentUser = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
):
    """Create a draft mock-interview session (mode, role, optional pasted JD text)."""
    client = client_for(settings, user)
    body = payload.model_dump(mode="json")
    # Normalize empty strings so the database does not store noise fields.
    for key in ("target_role", "target_company", "topic", "difficulty", "job_description_text"):
        value = body.get(key)
        if isinstance(value, str):
            cleaned = value.strip()
            body[key] = cleaned or None
    if body.get("job_description_text"):
        body["job_description_text"] = str(body["job_description_text"])[:20_000]
    return (
        client.table("interview_sessions")
        .insert(
            {
                **body,
                "user_id": str(user.id),
                "created_at": utc_now(),
                "status": "draft",
            }
        )
        .execute()
        .data[0]
    )


@router.get("/interviews/{session_id}")
def get_interview(
    session_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
):
    client = client_for(settings, user)
    session = owned_row(client, "interview_sessions", session_id, user)
    questions = (
        client.table("interview_questions")
        .select("id,position,question,question_type,source_context,created_at")
        .eq("session_id", str(session_id))
        .eq("user_id", str(user.id))
        .order("position")
        .execute()
        .data
        or []
    )
    return {"session": session, "questions": questions}


@router.delete("/interviews/{session_id}", status_code=204)
def delete_interview(
    session_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
):
    """
    Permanently delete a mock interview session for the signed-in candidate.
    Cascades to interview_questions, interview_responses, and interview_reports in DB.
    Also removes any interview media files referenced by responses.
    """
    client = client_for(settings, user)
    owned_row(client, "interview_sessions", session_id, user)

    # Media is no longer stored, so no storage cleanup is needed.
    # Cascade delete children first — delete children first (same pattern as learning paths).
    sid = str(session_id)
    uid = str(user.id)
    client.table("interview_reports").delete().eq("session_id", sid).eq("user_id", uid).execute()
    client.table("interview_responses").delete().eq("session_id", sid).eq("user_id", uid).execute()
    client.table("interview_questions").delete().eq("session_id", sid).eq("user_id", uid).execute()
    client.table("interview_sessions").delete().eq("id", sid).eq("user_id", uid).execute()
    write_activity(
        client,
        user,
        "interview_deleted",
        "Practice session deleted",
        "interview_session",
        sid,
    )


@router.post("/interviews/{session_id}/start")
async def start_interview(
    session_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
):
    """
    Start a session and generate practice questions via the preferred LLM
    failover chain (LLM_PROVIDER first, then the other configured provider).
    Falls back to no questions (retryable 503) when all providers fail.
    """
    client = client_for(settings, user)
    session = owned_row(client, "interview_sessions", session_id, user)
    result = (
        client.table("interview_sessions")
        .update({"status": "in_progress", "started_at": utc_now()})
        .eq("id", str(session_id))
        .eq("user_id", str(user.id))
        .execute()
        .data[0]
    )

    existing = (
        client.table("interview_questions")
        .select("id")
        .eq("session_id", str(session_id))
        .eq("user_id", str(user.id))
        .limit(1)
        .execute()
        .data
        or []
    )
    questions_payload: dict[str, Any] = {"questions": [], "provider": None, "model": None}
    if not existing:
        count = int(session.get("question_count") or 3)
        resume_text: str | None = None
        candidate_skills: list[str] | None = None
        if session.get("resume_version_id"):
            res_rows = (
                client.table("resume_versions")
                .select("plain_text,structured_content")
                .eq("id", str(session["resume_version_id"]))
                .eq("user_id", str(user.id))
                .limit(1)
                .execute()
                .data
                or []
            )
            if res_rows:
                resume_text = str(res_rows[0].get("plain_text") or "")
            skill_rows = (
                client.table("candidate_skills")
                .select("name")
                .eq("user_id", str(user.id))
                .execute()
                .data
                or []
            )
            if skill_rows:
                candidate_skills = [str(r.get("name")) for r in skill_rows if r.get("name")]

        try:
            questions_payload = await generate_interview_questions(
                settings,
                mode=str(session.get("mode") or "mixed"),
                count=count,
                target_role=session.get("target_role"),
                target_company=session.get("target_company"),
                difficulty=session.get("difficulty"),
                topic=session.get("topic"),
                job_description_text=session.get("job_description_text"),
                resume_text=resume_text,
                candidate_skills=candidate_skills,
            )
        except Exception as exc:
            # Producer fallback: enrich error with type/truncated value, then local templates — do NOT swallow at crash site.
            # Keep telemetry visible via ApiError enrichment in generator; here provide deterministic fallback.
            from app.core.errors import ApiError as _ApiErr
            if isinstance(exc, _ApiErr):
                # Already enriched with type/value
                pass
            else:
                # Wrap unexpected so telemetry captures truncated context
                raise _ApiErr(502, "llm_returned_no_questions", f"Interview generation failed: type={type(exc).__name__}, value={str(exc)[:120]}") from exc
            # Deterministic local templates when all providers fail — preserves contract (no 503).
            templates = {
                "behavioral": "Tell me about a time your plan changed and how you adapted.",
                "technical": "Walk me through how you would approach a technical problem in your domain.",
                "mixed": "Describe a challenging project and the decisions you made.",
            }
            base = templates.get(str(session.get("mode") or "mixed").strip().lower(), templates["mixed"])
            questions_payload = {
                "questions": [{"question": f"{base} (Question {i+1})", "question_type": str(session.get("mode") or "mixed")[:80]} for i in range(count)],
                "provider": "template",
                "model": "local-template-v1",
                "agent": "interview_questions",
                "fallback": True,
                "fallback_reason": f"type={type(exc).__name__}, value={str(exc)[:80]}",
            }
        rows = []
        for index, item in enumerate(questions_payload.get("questions") or [], start=1):
            rows.append(
                {
                    "user_id": str(user.id),
                    "session_id": str(session_id),
                    "position": index,
                    "question": str(item.get("question") or "").strip()[:800],
                    "question_type": (item.get("question_type") or session.get("mode") or "mixed")[:80],
                    "source_context": {
                        "provider": questions_payload.get("provider"),
                        "model": questions_payload.get("model"),
                    },
                }
            )
        if rows:
            client.table("interview_questions").insert(rows).execute()

    questions = (
        client.table("interview_questions")
        .select("id,position,question,question_type,source_context,created_at")
        .eq("session_id", str(session_id))
        .eq("user_id", str(user.id))
        .order("position")
        .execute()
        .data
        or []
    )
    write_activity(
        client, user, "interview_started", "Interview session started", "interview_session", str(session_id)
    )
    return {
        "session": result,
        "questions": questions,
        "question_provider": questions_payload.get("provider"),
        "question_model": questions_payload.get("model"),
        "agent": questions_payload.get("agent") or "interview_questions",
        "fallback": bool(questions_payload.get("fallback")),
        "fallback_reason": questions_payload.get("fallback_reason"),
    }


@router.post("/interviews/{session_id}/responses", status_code=201)
async def add_response(
    session_id: UUID,
    payload: InterviewResponseCreate,
    user: CurrentUser = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
):
    """Store an answer, return live interviewer reply, and optionally insert a follow-up."""
    client = client_for(settings, user)
    session = owned_row(client, "interview_sessions", session_id, user)
    question_rows = (
        client.table("interview_questions")
        .select("id,question,question_type,position,source_context")
        .eq("id", str(payload.question_id))
        .eq("session_id", str(session_id))
        .eq("user_id", str(user.id))
        .limit(1)
        .execute()
        .data
        or []
    )
    if not question_rows:
        raise ApiError(404, "question_not_found", "The question does not belong to this interview session.")
    question = question_rows[0]
    answer_text = (payload.transcript or payload.typed_response or "").strip()
    client_speech = payload.speech_metrics if isinstance(payload.speech_metrics, dict) else None
    client_gaze = payload.gaze_metrics if isinstance(payload.gaze_metrics, dict) else None
    existing_questions = (
        client.table("interview_questions")
        .select("id,position,question,question_type,source_context")
        .eq("session_id", str(session_id))
        .eq("user_id", str(user.id))
        .order("position")
        .execute()
        .data
        or []
    )
    existing_responses = (
        client.table("interview_responses")
        .select("question_id,transcript,typed_response")
        .eq("session_id", str(session_id))
        .eq("user_id", str(user.id))
        .execute()
        .data
        or []
    )
    answer_by_question = {
        str(row.get("question_id")): str(row.get("transcript") or row.get("typed_response") or "")
        for row in existing_responses
        if row.get("question_id")
    }
    recent_turns = [
        {
            "question": str(item.get("question") or "")[:400],
            "answer": str(answer_by_question.get(str(item.get("id"))) or "")[:800],
            "question_type": item.get("question_type"),
        }
        for item in existing_questions
        if answer_by_question.get(str(item.get("id")))
    ][-6:]
    already_followed_up = is_follow_up_question(question.get("source_context"))
    follow_ups_used = sum(
        1 for item in existing_questions if is_follow_up_question(item.get("source_context"))
    )
    evaluation = await evaluate_interview_answer(
        settings,
        question=str(question.get("question") or ""),
        answer=answer_text,
        question_type=question.get("question_type"),
        target_role=session.get("target_role"),
        mode=session.get("mode"),
        duration_seconds=payload.duration_seconds,
        gaze_metrics=client_gaze,
        recent_turns=recent_turns,
        already_followed_up=already_followed_up,
        follow_ups_used=follow_ups_used,
        seed_count=int(session.get("question_count") or 5),
    )
    # Prefer server-measured delivery; optionally merge client speech_metrics duration if server lacks it.
    if client_speech and not evaluation.get("speaking_delivery", {}).get("duration_seconds"):
        raw_dur = client_speech.get("duration_seconds")
        try:
            if raw_dur is not None and float(raw_dur) > 0:
                from app.features.interview.agent.evaluator import analyze_speaking_delivery

                evaluation["speaking_delivery"] = analyze_speaking_delivery(
                    answer_text, float(raw_dur)
                )
        except (TypeError, ValueError):
            pass
    row = {
        "question_id": str(payload.question_id),
        "typed_response": payload.typed_response,
        "transcript": payload.transcript,
        "duration_seconds": payload.duration_seconds,
        "speech_metrics": client_speech,
        "gaze_metrics": evaluation.get("gaze_metrics") or client_gaze,
        "session_id": str(session_id),
        "user_id": str(user.id),
        "created_at": utc_now(),
        "evaluation": evaluation,
        "score": evaluation.get("score"),
        "verdict": evaluation.get("verdict"),
        "filler_analysis": evaluation.get("filler_analysis") or {},
        "speaking_delivery": evaluation.get("speaking_delivery") or {},
    }
    saved = client.table("interview_responses").insert(row).execute().data[0]

    follow_up_row = None
    follow_text = str(evaluation.get("follow_up_question") or "").strip()
    under_budget = len(existing_questions) < max_question_budget(session)
    if evaluation.get("should_follow_up") and follow_text and under_budget and not already_followed_up:
        current_pos = int(question.get("position") or 0)
        later = sorted(
            [item for item in existing_questions if int(item.get("position") or 0) > current_pos],
            key=lambda item: int(item.get("position") or 0),
            reverse=True,
        )
        for item in later:
            client.table("interview_questions").update(
                {"position": int(item.get("position") or 0) + 1}
            ).eq("id", str(item.get("id"))).eq("user_id", str(user.id)).execute()
        inserted = (
            client.table("interview_questions")
            .insert(
                {
                    "user_id": str(user.id),
                    "session_id": str(session_id),
                    "position": current_pos + 1,
                    "question": follow_text[:800],
                    "question_type": "follow_up",
                    "source_context": {
                        "kind": "follow_up",
                        "parent_question_id": str(question.get("id")),
                        "provider": evaluation.get("provider"),
                    },
                    "created_at": utc_now(),
                }
            )
            .execute()
            .data
            or []
        )
        follow_up_row = inserted[0] if inserted else None

    questions = (
        client.table("interview_questions")
        .select("id,position,question,question_type,source_context,created_at")
        .eq("session_id", str(session_id))
        .eq("user_id", str(user.id))
        .order("position")
        .execute()
        .data
        or []
    )
    return {
        "response": saved,
        "evaluation": evaluation,
        "follow_up": follow_up_row,
        "questions": questions,
        "question": {
            "id": question.get("id"),
            "position": question.get("position"),
            "question": question.get("question"),
            "question_type": question.get("question_type"),
        },
    }


async def _create_interview_report(
    client,
    settings: Settings,
    user: CurrentUser,
    session_id: UUID,
    session: dict[str, Any],
) -> dict[str, Any]:
    """Build and persist the latest report for a session.

    This is shared by completion and the report read path so completed legacy
    sessions without a report can be repaired on first view.
    """
    questions = (
        client.table("interview_questions")
        .select("id,position,question,question_type")
        .eq("session_id", str(session_id))
        .eq("user_id", str(user.id))
        .order("position")
        .execute()
        .data
        or []
    )
    responses = (
        client.table("interview_responses")
        .select("*")
        .eq("session_id", str(session_id))
        .eq("user_id", str(user.id))
        .execute()
        .data
        or []
    )
    latest_by_q: dict[str, dict[str, Any]] = {}
    for row in responses:
        qid = str(row.get("question_id") or "")
        if not qid:
            continue
        previous = latest_by_q.get(qid)
        if previous is None or str(row.get("created_at") or "") >= str(previous.get("created_at") or ""):
            latest_by_q[qid] = row

    turns: list[dict[str, Any]] = []
    for question in questions:
        qid = str(question.get("id") or "")
        response = latest_by_q.get(qid)
        if not response:
            turns.append(
                {
                    "question_id": qid,
                    "position": question.get("position"),
                    "question": question.get("question"),
                    "question_type": question.get("question_type"),
                    "answer": "[No answer provided]",
                    "unattempted": True,
                    "evaluation": {
                        "verdict": "unattempted",
                        "score": 0,
                        "interviewer_feedback": "This question was skipped or not answered.",
                        "strengths": [],
                        "improvements": ["Attempt every question to practice full interview coverage."],
                    },
                    "gaze_metrics": None,
                }
            )
            continue
        answer = (response.get("transcript") or response.get("typed_response") or "").strip()
        evaluation = response.get("evaluation") or {}
        if not evaluation and answer:
            evaluation = await evaluate_interview_answer(
                settings,
                question=str(question.get("question") or ""),
                answer=answer,
                question_type=question.get("question_type"),
                target_role=session.get("target_role"),
                mode=session.get("mode"),
                duration_seconds=response.get("duration_seconds"),
            )
        if isinstance(evaluation, dict) and not evaluation.get("gaze_metrics"):
            # Prefer metrics stored on the response document when eval payload is older.
            if response.get("gaze_metrics"):
                evaluation = {**evaluation, "gaze_metrics": response.get("gaze_metrics")}
        turns.append(
            {
                "question_id": qid,
                "position": question.get("position"),
                "question": question.get("question"),
                "question_type": question.get("question_type"),
                "answer": answer,
                "evaluation": evaluation,
                "gaze_metrics": (evaluation or {}).get("gaze_metrics")
                if isinstance(evaluation, dict)
                else response.get("gaze_metrics"),
            }
        )

    report_body = await generate_interview_session_report(
        settings,
        turns=turns,
        target_role=session.get("target_role"),
        mode=session.get("mode"),
    )
    report_row = {
        "user_id": str(user.id),
        "session_id": str(session_id),
        "created_at": utc_now(),
        "status": "ready",
        "overall_score": int(round(float(report_body["overall_score"]))) if report_body.get("overall_score") is not None else None,
        "communication_score": int(round(float(report_body["communication_score"]))) if report_body.get("communication_score") is not None else None,
        "structure_score": int(round(float(report_body["structure_score"]))) if report_body.get("structure_score") is not None else None,
        "content_score": int(round(float(report_body["content_score"]))) if report_body.get("content_score") is not None else None,
        "summary": report_body.get("overall_summary"),
        "report": report_body,
        "provider": report_body.get("provider"),
        "model": report_body.get("model"),
        "report_version": report_body.get("report_version") or INTERVIEW_REPORT_VERSION,
    }
    existing_reports = (
        client.table("interview_reports")
        .select("id")
        .eq("session_id", str(session_id))
        .eq("user_id", str(user.id))
        .execute()
        .data
        or []
    )
    for old in existing_reports:
        if old.get("id"):
            client.table("interview_reports").delete().eq("id", str(old["id"])).eq(
                "user_id", str(user.id)
            ).execute()
    return client.table("interview_reports").insert(report_row).execute().data[0]


@router.post("/interviews/{session_id}/complete")
async def complete_interview(
    session_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
):
    """Mark session complete and persist a detailed debrief report."""
    client = client_for(settings, user)
    session = owned_row(client, "interview_sessions", session_id, user)
    questions = (
        client.table("interview_questions")
        .select("id")
        .eq("session_id", str(session_id))
        .eq("user_id", str(user.id))
        .execute()
        .data
        or []
    )
    answered = (
        client.table("interview_responses")
        .select("question_id")
        .eq("session_id", str(session_id))
        .eq("user_id", str(user.id))
        .execute()
        .data
        or []
    )
    answered_ids = {str(row.get("question_id")) for row in answered if row.get("question_id")}
    required_ids = {str(row.get("id")) for row in questions if row.get("id")}
    if required_ids - answered_ids:
        raise ApiError(409, "interview_questions_unanswered", "Answer every interview question before completing the session.")
    result = (
        client.table("interview_sessions")
        .update({"status": "completed", "completed_at": utc_now()})
        .eq("id", str(session_id))
        .eq("user_id", str(user.id))
        .execute()
        .data[0]
    )
    saved_report = await _create_interview_report(client, settings, user, session_id, session)
    write_activity(
        client,
        user,
        "interview_completed",
        "Practice session completed",
        "interview_session",
        str(session_id),
    )
    return {
        "session": result,
        "report": saved_report,
        "message": "Session completed. Review your report.",
    }


@router.get("/interviews/{session_id}/report")
async def get_interview_report(
    session_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
):
    client = client_for(settings, user)
    session = owned_row(client, "interview_sessions", session_id, user)
    rows = (
        client.table("interview_reports")
        .select("*")
        .eq("session_id", str(session_id))
        .eq("user_id", str(user.id))
        .execute()
        .data
        or []
    )
    current = rows[0] if rows else None
    if not rows or current.get("report_version") != INTERVIEW_REPORT_VERSION:
        if session.get("status") != "completed":
            raise ApiError(
                404,
                "report_not_found",
                "No report for this session yet. Finish the session to create one.",
            )
        rows = [await _create_interview_report(client, settings, user, session_id, session)]
    # Prefer newest by created_at when multiple exist.
    rows = sort_rows_by_recency(rows, desc=True, preferred="created_at")
    return {"session": session, "report": rows[0]}

