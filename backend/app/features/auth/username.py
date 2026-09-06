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
