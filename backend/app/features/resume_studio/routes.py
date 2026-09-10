from uuid import UUID

from fastapi import APIRouter, Depends, Query

from app.core.config import Settings, get_settings
from app.database.repository import client_for
from app.features.auth.service import CurrentUser, get_current_user
from app.features.resume_studio.ai import suggest_revision
from app.features.resume_studio.schema import StudioSessionOpen, StudioSessionSave, StudioSuggestRequest
from app.features.resume_studio.service import get_session, open_session, reset_session, save_session
from app.features.resume_studio.mapper import document_from_structured

router = APIRouter(prefix="/resume-studio", tags=["resume-studio"])


@router.post("/sessions")
def create_studio_session(
    payload: StudioSessionOpen,
    user: CurrentUser = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
):
    return open_session(
        client_for(settings, user),
        user,
        source_version_id=payload.source_version_id,
        ats_analysis_id=payload.ats_analysis_id,
        resume_id=payload.resume_id,
    )


@router.get("/sessions/{version_id}")
def read_studio_session(
    version_id: UUID,
    ats_analysis_id: str | None = Query(default=None),
    user: CurrentUser = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
):
    return get_session(client_for(settings, user), user, version_id, ats_analysis_id)


@router.put("/sessions/{version_id}")
def update_studio_session(
    version_id: UUID,
    payload: StudioSessionSave,
    user: CurrentUser = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
):
    return save_session(
        client_for(settings, user),
        user,
        version_id,
        payload.content,
        payload.presentation,
    )


@router.post("/sessions/{version_id}/reset")
def reset_studio_session(
    version_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
):
    return reset_session(client_for(settings, user), user, version_id)


@router.post("/sessions/{version_id}/suggest")
async def suggest_studio_revision(
    version_id: UUID,
    payload: StudioSuggestRequest,
    user: CurrentUser = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
):
    session = get_session(client_for(settings, user), user, version_id, None)
    document = document_from_structured(
        {"studio": session["document"]},
        source_version_id=session["source_version"]["id"],
        ats_analysis_id=session["document"].get("ats_analysis_id"),
    )
    return await suggest_revision(settings, document, payload, session.get("ats"))
