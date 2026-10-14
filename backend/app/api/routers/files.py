"""Authenticated file streaming."""
import logging
import mimetypes

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response as PlainResponse

from app.core.config import Settings, get_settings
from app.core.errors import ApiError
from app.database.client import database_client
from app.features.auth.service import (
    CurrentUser,
    get_current_user_optional,
    parse_file_access_token,
)

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/files/{bucket}/{path:path}")
async def authenticated_file(
    bucket: str,
    path: str,
    token: str | None = Query(default=None, description="Path-scoped file access token for <img> loads"),
    user: CurrentUser | None = Depends(get_current_user_optional),
    settings: Settings = Depends(get_settings),
):
    """Stream a user-owned object after ownership checks.

    Auth sources (first match wins):
    1. Bearer / session cookie (API fetches)
    2. ``token`` query param — short-lived path-scoped JWT for browser subresources
       (``<img src>`` cannot send Authorization headers)
    """
    allowed = {settings.document_bucket, settings.avatar_bucket}
    if bucket not in allowed:
        raise ApiError(404, "file_not_found", "The requested file was not found.")

    if user is not None:
        owner_id = str(user.id)
    elif token:
        owner_uuid = parse_file_access_token(token, settings, bucket=bucket, path=path)
        owner_id = str(owner_uuid)
    else:
        raise ApiError(
            401,
            "authentication_required",
            "Authentication is required to access this file.",
        )

    # Canonicalize before ownership check — producer fix, not crash-site swallowing.
    # Enrich invalid paths for telemetry: type, truncated value, operation.
    try:
        from app.database.client import _safe_object_key
        canonical = _safe_object_key(path)
    except ValueError as exc:
        raise ApiError(404, "file_not_found", f"Invalid file path for bucket '{bucket}': type={type(path).__name__}, value={str(path)[:80]} [{exc}]") from exc
    if not canonical.startswith(f"{owner_id}/"):
        raise ApiError(404, "file_not_found", "The requested file was not found.")
    # Use canonical for download to avoid double-cleaning divergence.
    path = canonical
    try:
        content = database_client(settings).storage.from_(bucket).download(path)
    except FileNotFoundError as exc:
        raise ApiError(404, "file_not_found", "The requested file was not found.") from exc
    except Exception as exc:
        raise ApiError(503, "storage_unavailable", "Object storage is temporarily unavailable.") from exc
    media_type = mimetypes.guess_type(path)[0] or "application/octet-stream"
    return PlainResponse(
        content=content,
        media_type=media_type,
        headers={
            # Avatars are private; discourage long-lived shared caches of tokenized URLs.
            "Cache-Control": "private, max-age=300",
        },
    )

