"""Candidate activity feed."""
import logging
from typing import Any

from fastapi import APIRouter, Depends

from app.core.config import Settings, get_settings
from app.database.repository import (
    client_for,
    list_recent_activity,
)
from app.features.auth.service import (
    CurrentUser,
    get_current_user,
)

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/me/activity")
def list_activity(
    user: CurrentUser = Depends(get_current_user), settings: Settings = Depends(get_settings)
) -> list[dict[str, Any]]:
    """Return the candidate's retained activity feed (max 5 newest rows)."""
    return list_recent_activity(client_for(settings, user), user)

