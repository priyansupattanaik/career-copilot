from __future__ import annotations

import re

USERNAME_PATTERN = re.compile(r"^[a-z0-9](?:[a-z0-9_]{1,28}[a-z0-9])?$")

# First-path app/marketing slugs that would collide with /:username public profiles.
RESERVED_USERNAMES = frozenset(
    {
        "about",
        "account",
        "admin",
        "api",
        "app",
        "auth",
        "blog",
        "careers",
        "community",
        "dashboard",
        "demo",
        "docs",
        "files",
        "health",
        "help",
        "home",
        "jobs",
        "learning",
        "login",
        "logout",
        "me",
        "onboarding",
        "privacy",
        "profile",
        "profiles",
        "public",
        "register",
        "root",
        "search",
        "settings",
        "signin",
        "signout",
        "signup",
        "static",
        "status",
        "support",
        "teams",
        "terms",
        "username",
        "users",
        "www",
    }
)


def normalize_username(value: str | None) -> str:
    return str(value or "").strip().lower().lstrip("@").replace(" ", "_")


def validate_username(value: str | None) -> str:
    username = normalize_username(value)
    if not USERNAME_PATTERN.fullmatch(username):
        raise ValueError("Username must be 3–30 characters using lowercase letters, numbers, and underscores.")
    if username in RESERVED_USERNAMES:
        raise ValueError("That username is reserved.")
    return username


def _username_owner_id(client, table: str, username: str) -> str | None:
    rows = client.table(table).select("id").ilike("username", username).limit(1).execute().data or []
    if not rows:
        return None
    return str(rows[0].get("id") or "") or None


def change_username(client, user_id: str, raw: str) -> str:
    """Validate, uniquely assign, and persist username on profiles and users."""
    from app.core.errors import ApiError

    normalized = validate_username(raw)
    uid = str(user_id)
    for table in ("profiles", "users"):
        owner = _username_owner_id(client, table, normalized)
        if owner and owner != uid:
            raise ApiError(409, "username_taken", "That username is already taken.")
    client.table("profiles").update({"username": normalized}).eq("id", uid).execute()
    try:
        client.table("users").update({"username": normalized}).eq("id", uid).execute()
    except Exception:
        # Sign-in still resolves through profiles.username; keep the profile write.
        pass
    stored = client.table("profiles").select("username").eq("id", uid).limit(1).execute().data or []
    saved = normalize_username((stored[0] or {}).get("username") if stored else "")
    if saved != normalized:
        raise ApiError(500, "username_update_failed", "Could not save the username. Try again.")
    return normalized
