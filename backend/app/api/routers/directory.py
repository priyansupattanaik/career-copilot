"""Usernames and public profiles."""
import logging
from typing import Any

from fastapi import APIRouter, Depends, Query

from app.api.schemas import (
    UsernameChange,
)
from app.api.support import (
    ensure_profile_row,
)
from app.core.config import Settings, get_settings
from app.core.errors import ApiError
from app.database.client import database_client
from app.database.repository import (
    CANDIDATE_TABLES,
    client_for,
    recalculate_completion,
    write_activity,
)
from app.features.auth.service import (
    CurrentUser,
    get_current_user,
)
from app.features.auth.username import change_username, normalize_username, validate_username
from app.features.profile.avatars import (
    attach_avatar_url,
)

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/profile/username/availability")
def username_availability(
    username: str = Query(..., min_length=3, max_length=30),
    user: CurrentUser = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
):
    try:
        normalized = validate_username(username)
    except ValueError as exc:
        return {"username": normalize_username(username), "available": False, "reason": str(exc)}
    rows = (
        client_for(settings, user).table("profiles").select("id").ilike("username", normalized).limit(1).execute().data
        or []
    )
    available = not rows or str(rows[0].get("id")) == str(user.id)
    return {"username": normalized, "available": available, "reason": None if available else "Username is already taken."}


@router.patch("/profile/username")
def update_profile_username(
    payload: UsernameChange,
    user: CurrentUser = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
):
    client = client_for(settings, user)
    ensure_profile_row(client, user)
    try:
        username = change_username(client, str(user.id), payload.username)
    except ValueError as exc:
        raise ApiError(400, "invalid_username", str(exc)) from None
    write_activity(client, user, "username_updated", f"Username changed to @{username}", "profile", str(user.id))
    profile = recalculate_completion(client, user)
    return {"username": username, "profile": attach_avatar_url(profile, client, settings)}


@router.get("/public/username-availability")
def public_username_availability(username: str = Query(..., min_length=3, max_length=30), settings: Settings = Depends(get_settings)):
    try:
        normalized = validate_username(username)
    except ValueError as exc:
        return {"username": normalize_username(username), "available": False, "reason": str(exc), "suggestions": []}
    rows = database_client(settings).table("profiles").select("id").ilike("username", normalized).limit(1).execute().data or []
    suggestions = [] if not rows else [f"{normalized}_{suffix}"[:30] for suffix in (1, 2, 3)]
    return {"username": normalized, "available": not rows, "reason": None if not rows else "Username is already taken.", "suggestions": suggestions}


_PUBLIC_PROFILE_CARD_FIELDS = (
    "username",
    "full_name",
    "avatar_url",
    "headline",
    "location",
    "current_role",
    "career_level",
    "career_goal",
)


def public_profile_search_needle(raw: str) -> str:
    """Normalize a community search. Leading @ is stripped because stored usernames never include it."""
    cleaned = " ".join((raw or "").split()).casefold()
    if cleaned.startswith("@"):
        cleaned = cleaned[1:].lstrip()
    return cleaned


def public_profile_directory_cards(
    rows: list[dict[str, Any]],
    needle: str,
    limit: int,
) -> list[dict[str, Any]]:
    """Return public identity cards that match needle. Empty or short needles return nothing."""
    cleaned = public_profile_search_needle(needle)
    if len(cleaned) < 2:
        return []
    matches: list[dict[str, Any]] = []
    ranked = sorted(
        rows,
        key=lambda row: (
            str(row.get("full_name") or "").casefold(),
            str(row.get("username") or "").casefold(),
        ),
    )
    for row in ranked:
        username = str(row.get("username") or "").strip()
        if not username:
            continue
        haystack = " ".join(str(row.get(key) or "") for key in _PUBLIC_PROFILE_CARD_FIELDS).casefold()
        if cleaned not in haystack:
            continue
        matches.append({key: row.get(key) for key in _PUBLIC_PROFILE_CARD_FIELDS})
        if len(matches) >= limit:
            break
    return matches


@router.get("/public/profiles/search")
def search_public_profiles(
    q: str = Query(..., min_length=2, max_length=80),
    limit: int = Query(20, ge=1, le=50),
    settings: Settings = Depends(get_settings),
):
    """Search public identity/profile fields; never list the directory or expose resume records.

    Requires a query of at least 2 characters. An empty or short query is rejected.
    """
    needle = public_profile_search_needle(q)
    if len(needle) < 2:
        return []
    rows = (
        database_client(settings)
        .table("profiles")
        .select("username,full_name,avatar_url,avatar_path,headline,location,current_role,career_level,career_goal")
        .limit(500)
        .execute()
        .data
        or []
    )
    return public_profile_directory_cards(rows, needle, limit)


@router.get("/public/profiles/{username}")
def public_profile(username: str, settings: Settings = Depends(get_settings)):
    try:
        normalized = validate_username(username)
    except ValueError:
        raise ApiError(404, "profile_not_found", "Public profile not found.") from None
    client = database_client(settings)
    rows = client.table("profiles").select(
        "id,username,full_name,avatar_url,avatar_path,headline,bio,location,current_role,years_experience,career_level,career_goal"
    ).ilike("username", normalized).limit(1).execute().data or []
    if not rows:
        raise ApiError(404, "profile_not_found", "Public profile not found.")
    profile = rows[0]
    if not profile.get("current_role") and profile.get("target_role"):
        profile["current_role"] = profile.get("target_role")
    owner = str(profile["id"])
    public_rows: dict[str, list[dict[str, Any]]] = {}
    for resource in ("skills", "experiences", "education", "projects", "certifications", "languages", "links"):
        table = CANDIDATE_TABLES.get(resource)
        if not table:
            continue
        fields = "*"
        public_rows[resource] = client.table(table).select(fields).eq("user_id", owner).limit(100).execute().data or []
    # Public page should show the avatar like private bootstrap does.
    # Generate a fresh signed URL with token so <img> works without Authorization.
    # Keep avatar_url, hide raw storage path from public response.
    try:
        enriched = attach_avatar_url(profile, client, settings)
        if enriched is not None:
            profile = enriched
    except Exception:
        logger.warning("public_profile_avatar_failed username=%s id=%s", normalized, owner[:8])
    profile.pop("avatar_path", None)
    # Keep avatar_url (None when no avatar or storage outage) for frontend <img>
    return {"profile": profile, "sections": public_rows}

