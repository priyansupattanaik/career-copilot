from __future__ import annotations

import asyncio
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from uuid import UUID

import jwt
from fastapi import Cookie, Depends, Header

from app.core.config import Settings, get_settings
from app.core.constants import JWT_ALGORITHM
from app.core.errors import ApiError
from app.database.client import database_client

SESSION_COOKIE_NAME = "career_copilot_session"


@dataclass(frozen=True)
class CurrentUser:
    id: UUID
    email: str | None
    access_token: str
    full_name: str | None = None
    auth_provider: str = "unknown"


def parse_bearer_header(value: str | None) -> str:
    if not value:
        raise ApiError(401, "authentication_required", "Authentication is required.")
    scheme, _, token = value.partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        raise ApiError(401, "invalid_authorization", "A valid Bearer token is required.")
    return token.strip()


FILE_READ_SCOPE = "file_read"


def create_access_token(user_id: UUID, email: str, settings: Settings, token_version: int = 0) -> str:
    now = datetime.now(UTC)
    ttl_seconds = max(60, int(getattr(settings, "jwt_ttl_seconds", 60 * 60 * 24 * 7)))
    payload = {
        "sub": str(user_id),
        "email": email,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(seconds=ttl_seconds)).timestamp()),
        "ver": int(token_version),
    }
    return jwt.encode(payload, settings.auth_secret, algorithm=JWT_ALGORITHM)


def auth_provider_from_user_row(row: dict) -> str:
    """Return the persisted authentication method without trusting browser state."""
    if str(row.get("firebase_uid") or "").strip():
        return "google"
    if str(row.get("password_hash") or "").strip() or str(row.get("supabase_uid") or "").strip():
        return "email"
    return "unknown"


def create_file_access_token(
    *,
    user_id: UUID | str,
    bucket: str,
    path: str,
    settings: Settings,
    expires_seconds: int | None = None,
) -> str:
    """Short-lived, path-scoped token so <img src> can load private files without Authorization.

    Browser image tags cannot send Bearer headers. Session cookies often fail when the
    API origin differs from the frontend origin (port/host). A scoped query token is the
    correct producer fix for avatar_url / file URLs used as subresources.
    """
    now = datetime.now(UTC)
    ttl = max(30, int(expires_seconds or getattr(settings, "export_signed_url_seconds", 300)))
    payload = {
        "sub": str(user_id),
        "bucket": str(bucket),
        "path": str(path),
        "scope": FILE_READ_SCOPE,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(seconds=ttl)).timestamp()),
    }
    return jwt.encode(payload, settings.auth_secret, algorithm=JWT_ALGORITHM)


def parse_file_access_token(
    token: str,
    settings: Settings,
    *,
    bucket: str,
    path: str,
) -> UUID:
    # Enrich low-level validation with truncated token/path for telemetry (producer unknown, so enrich here)
    trunc_token = str(token)[:80] if isinstance(token, str) else f"type={type(token).__name__} value={str(token)[:80]}"
    try:
        payload = jwt.decode(
            token,
            settings.auth_secret,
            algorithms=[JWT_ALGORITHM],
            options={"require": ["sub", "exp", "iat", "scope", "bucket", "path"]},
        )
    except jwt.ExpiredSignatureError as exc:
        raise ApiError(401, "file_token_expired", f"The file access link has expired for bucket '{bucket}' path '{str(path)[:80]}': type={type(token).__name__} token={trunc_token[:40]}") from exc
    except jwt.PyJWTError as exc:
        raise ApiError(401, "invalid_file_token", f"[FileToken] Invalid file token for bucket '{bucket}' path '{str(path)[:80]}': type={type(token).__name__} token={trunc_token[:40]} ({type(exc).__name__})") from exc
    if payload.get("scope") != FILE_READ_SCOPE:
        raise ApiError(401, "invalid_file_token", f"[FileToken] Scope mismatch for bucket '{bucket}' path '{str(path)[:80]}': type={type(token).__name__} token={trunc_token[:40]} scope={str(payload.get('scope'))[:20]}")
    if str(payload.get("bucket") or "") != str(bucket) or str(payload.get("path") or "") != str(path):
        raise ApiError(401, "invalid_file_token", f"[FileToken] Path mismatch for request bucket '{bucket}' path '{str(path)[:80]}': token bucket='{str(payload.get('bucket'))[:40]}' token path='{str(payload.get('path'))[:80]}' type={type(token).__name__}")
    try:
        return UUID(str(payload["sub"]))
    except (KeyError, TypeError, ValueError) as exc:
        raise ApiError(401, "invalid_file_token", f"[FileToken] Invalid sub for bucket '{bucket}' path '{str(path)[:80]}': type={type(token).__name__} token={trunc_token[:40]}") from exc


def _user_from_token(token: str, settings: Settings) -> CurrentUser:
    try:
        payload = jwt.decode(
            token,
            settings.auth_secret,
            algorithms=[JWT_ALGORITHM],
            options={"require": ["sub", "exp", "iat"]},
        )
        user_id = UUID(str(payload["sub"]))
    except jwt.ExpiredSignatureError as exc:
        raise ApiError(401, "token_expired", "The authentication session has expired. Sign in again.") from exc
    except (jwt.PyJWTError, KeyError, TypeError, ValueError) as exc:
        raise ApiError(401, "invalid_access_token", "The authentication session is invalid or expired.") from exc
    rows = (
        database_client(settings)
        .table("users")
        .select("id,email,full_name,token_version,password_hash,supabase_uid,firebase_uid")
        .eq("id", str(user_id))
        .limit(1)
        .execute()
        .data
    )
    if not rows:
        raise ApiError(401, "invalid_user_identity", "The authentication identity is invalid.")
    row = rows[0]
    if int(payload.get("ver") or 0) != int(row.get("token_version") or 0):
        raise ApiError(401, "session_revoked", "This session is no longer valid. Sign in again.")
    auth_provider = auth_provider_from_user_row(row)
    return CurrentUser(
        id=user_id,
        email=row.get("email"),
        access_token=token,
        full_name=row.get("full_name"),
        auth_provider=auth_provider,
    )


async def get_current_user(
    authorization: str | None = Header(default=None),
    career_copilot_session: str | None = Cookie(default=None),
    settings: Settings = Depends(get_settings),
) -> CurrentUser:
    token = parse_bearer_header(authorization) if authorization else career_copilot_session
    if not token:
        raise ApiError(401, "authentication_required", "Authentication is required.")
    # Firestore identity verification is synchronous network I/O. Keep it off
    # the async event loop so auth/session cannot stall unrelated requests.
    return await asyncio.to_thread(_user_from_token, token, settings)


async def get_current_user_optional(
    authorization: str | None = Header(default=None),
    career_copilot_session: str | None = Cookie(default=None),
    settings: Settings = Depends(get_settings),
) -> CurrentUser | None:
    """Like get_current_user but returns None when no session is presented."""
    if authorization:
        token = parse_bearer_header(authorization)
    else:
        token = career_copilot_session
    if not token:
        return None
    return await asyncio.to_thread(_user_from_token, token, settings)
