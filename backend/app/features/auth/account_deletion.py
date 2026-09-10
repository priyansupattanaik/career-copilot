from __future__ import annotations

import logging
from typing import Any

from app.core.config import Settings
from app.core.errors import ApiError
from app.features.auth.service import CurrentUser

logger = logging.getLogger(__name__)
CONFIRM_PHRASE = "DELETE MY ACCOUNT"

# Shared catalog tables are never user-owned. Everything else with user_id is.
_SHARED_TABLES = frozenset({"jobs", "_setup_checks"})

# User-owned collections deleted before the users document (children first by convention).
# Keep the explicit list as a fallback if TABLE_COLUMNS is unavailable.
USER_OWNED_TABLES: list[tuple[str, str]] = [
    ("activity_events", "user_id"),
    ("user_notifications", "user_id"),
    ("saved_jobs", "user_id"),
    ("job_recommendations", "user_id"),
    ("learning_resources", "user_id"),
    ("learning_items", "user_id"),
    ("learning_paths", "user_id"),
    ("interview_reports", "user_id"),
    ("interview_responses", "user_id"),
    ("interview_questions", "user_id"),
    ("interview_sessions", "user_id"),
    ("ats_evidence", "user_id"),
    ("ats_analyses", "user_id"),
    ("resume_improvement_runs", "user_id"),
    ("resume_suggestions", "user_id"),
    ("resume_exports", "user_id"),
    ("resume_versions", "user_id"),
    ("resumes", "user_id"),
    ("job_descriptions", "user_id"),
    ("candidate_links", "user_id"),
    ("candidate_languages", "user_id"),
    ("candidate_certifications", "user_id"),
    ("candidate_education", "user_id"),
    ("candidate_projects", "user_id"),
    ("candidate_experiences", "user_id"),
    ("candidate_skills", "user_id"),
    ("candidate_preferences", "user_id"),
    ("notification_preferences", "user_id"),
    ("privacy_preferences", "user_id"),
]

_DOCUMENT_PATH_QUERIES: list[tuple[str, str]] = [
    ("resume_versions", "storage_path"),
    ("resume_exports", "storage_path"),
    ("job_descriptions", "storage_path"),
    ("interview_responses", "audio_path"),
]


def _owned_tables() -> list[tuple[str, str]]:
    try:
        from app.database.client import TABLE_COLUMNS
    except Exception:
        return list(USER_OWNED_TABLES)
    discovered: list[tuple[str, str]] = []
    seen: set[str] = set()
    for table, columns in TABLE_COLUMNS.items():
        if table in _SHARED_TABLES or table in {"users", "profiles"}:
            continue
        if "user_id" not in columns:
            continue
        discovered.append((table, "user_id"))
        seen.add(table)
    for table, column in USER_OWNED_TABLES:
        if table not in seen:
            discovered.append((table, column))
    return discovered


def confirmation_is_valid(phrase: str | None) -> bool:
    return (phrase or "").strip() == CONFIRM_PHRASE


def email_matches_account(provided: str | None, account_email: str | None) -> bool:
    if provided is None or not str(provided).strip():
        return False
    if not account_email:
        return False
    return str(provided).strip().lower() == str(account_email).strip().lower()


def collect_user_storage_paths(client, user: CurrentUser) -> dict[str, list[str]]:
    uid = str(user.id)
    buckets: dict[str, list[str]] = {"candidate-documents": [], "candidate-avatars": []}

    def _add(bucket: str, path: Any) -> None:
        if not path:
            return
        cleaned = str(path).strip()
        if cleaned and cleaned not in buckets[bucket]:
            buckets[bucket].append(cleaned)

    for table, column in _DOCUMENT_PATH_QUERIES:
        try:
            rows = client.table(table).select(column).eq("user_id", uid).execute().data or []
            for row in rows:
                _add("candidate-documents", row.get(column))
        except Exception as exc:
            logger.exception("account_delete_path_collect_failed table=%s user_id=%s", table, uid)
            raise ApiError(500, "account_deletion_incomplete", "Could not enumerate stored account files.") from exc
    try:
        profile = client.table("profiles").select("avatar_path").eq("id", uid).limit(1).execute().data or []
        if profile:
            _add("candidate-avatars", profile[0].get("avatar_path"))
    except Exception as exc:
        logger.exception("account_delete_path_collect_failed table=profiles user_id=%s", uid)
        raise ApiError(500, "account_deletion_incomplete", "Could not enumerate the account avatar.") from exc
    return buckets


def lookup_supabase_auth_ids(settings: Settings, *, supabase_uid: str, email: str | None) -> list[str]:
    """Collect every Auth user id that still belongs to this account."""
    ids: list[str] = []
    seen: set[str] = set()

    def _add(value: str) -> None:
        cleaned = str(value or "").strip()
        if cleaned and cleaned not in seen:
            seen.add(cleaned)
            ids.append(cleaned)

    _add(supabase_uid)
    email_clean = str(email or "").strip().lower()
    if not email_clean or not settings.resolved_supabase_url or not settings.supabase_server_key:
        return ids
    import httpx

    url = f"{settings.resolved_supabase_url}/auth/v1/admin/users"
    headers = {
        "Authorization": f"Bearer {settings.supabase_server_key}",
        "apikey": settings.supabase_server_key,
    }
    try:
        response = httpx.get(
            url,
            headers=headers,
            params={"page": 1, "per_page": 200},
            timeout=30,
        )
        if response.status_code >= 400:
            logger.warning(
                "account_delete_auth_lookup_failed status=%s body=%s",
                response.status_code,
                response.text[:200],
            )
            return ids
        payload = response.json() or {}
        users = payload.get("users") if isinstance(payload, dict) else payload
        if not isinstance(users, list):
            return ids
        for row in users:
            if not isinstance(row, dict):
                continue
            row_email = str(row.get("email") or "").strip().lower()
            if row_email == email_clean:
                _add(str(row.get("id") or ""))
    except Exception:
        logger.exception("account_delete_auth_lookup_failed email=%s", email_clean)
    return ids


def delete_supabase_auth_user(settings: Settings, supabase_uid: str) -> bool:
    """Delete the Supabase Auth identity so nothing about the account survives.

    Returns True when the user was deleted (or was already gone). Raises
    RuntimeError on any other failure so the caller can stop the destructive
    local purge while the provider identity still exists.
    """
    import httpx

    base_url = settings.resolved_supabase_url
    key = settings.supabase_server_key
    if not base_url or not key:
        raise RuntimeError("Supabase admin credentials are not configured.")
    url = f"{base_url}/auth/v1/admin/users/{supabase_uid}"
    response = httpx.delete(
        url,
        headers={"Authorization": f"Bearer {key}", "apikey": key},
        timeout=30,
    )
    if response.status_code in (200, 204, 404):
        # 404 means the identity was already removed; nothing left to purge.
        return True
    logger.error(
        "account_delete_supabase_auth_failed uid=%s status=%s body=%s",
        supabase_uid,
        response.status_code,
        response.text[:200],
    )
    raise RuntimeError(f"Supabase auth deletion failed with status {response.status_code}.")


def delete_user_owned_records(client, user: CurrentUser) -> dict[str, int]:
    uid = str(user.id)
    deleted: dict[str, int] = {}
    for table, column in _owned_tables():
        try:
            result = client.table(table).delete().eq(column, uid).execute()
            deleted[table] = len(result.data or [])
        except Exception as exc:
            logger.exception("account_delete_table_failed table=%s user_id=%s", table, uid)
            raise ApiError(
                500,
                "account_deletion_incomplete",
                f"Could not delete user data from {table}. Account deletion stopped.",
            ) from exc
    try:
        result = client.table("profiles").delete().eq("id", uid).execute()
        deleted["profiles"] = len(result.data or [])
    except Exception as exc:
        logger.exception("account_delete_profile_failed user_id=%s", uid)
        raise ApiError(
            500,
            "account_deletion_incomplete",
            "Could not delete the profile. Account deletion stopped.",
        ) from exc
    return deleted


def remaining_user_rows(client, user_id: str) -> dict[str, int]:
    """Count leftover rows that still mention this account."""
    uid = str(user_id)
    leftover: dict[str, int] = {}
    for table, column in _owned_tables():
        count = _count_eq(client, table, column, uid)
        if count:
            leftover[table] = count
    for table in ("profiles", "users"):
        count = _count_eq(client, table, "id", uid)
        if count:
            leftover[table] = count
    return leftover


def _count_eq(client, table: str, column: str, value: str) -> int:
    try:
        result = client.table(table).select("id", count="exact", head=True).eq(column, value).execute()
        if result.count is not None:
            return int(result.count)
        rows = client.table(table).select("id").eq(column, value).limit(20).execute().data or []
        return len(rows)
    except Exception:
        logger.exception("account_delete_leftover_count_failed table=%s", table)
        return -1


def assert_user_erased(client, user_id: str) -> None:
    leftover = remaining_user_rows(client, user_id)
    unknown = [table for table, count in leftover.items() if count < 0]
    present = {table: count for table, count in leftover.items() if count > 0}
    if unknown or present:
        logger.error(
            "account_delete_leftover user_id=%s leftover=%s unknown=%s",
            user_id,
            present,
            unknown,
        )
        raise ApiError(
            500,
            "account_deletion_incomplete",
            "Account data still remained after deletion. Please retry.",
        )


def _list_prefix_recursive(admin_client, bucket: str, prefix: str) -> list[str]:
    found: list[str] = []
    stack = [prefix.strip("/")]
    seen_dirs: set[str] = set()
    while stack:
        current = stack.pop()
        if current in seen_dirs:
            continue
        seen_dirs.add(current)
        try:
            entries = admin_client.storage.from_(bucket).list(current) or []
        except Exception as exc:
            logger.exception("account_delete_storage_list_failed bucket=%s prefix=%s", bucket, current)
            raise RuntimeError(f"Could not enumerate Supabase Storage bucket {bucket}") from exc
        for entry in entries:
            name = (entry or {}).get("name")
            if not name:
                continue
            path = f"{current}/{name}" if current else name
            metadata = (entry or {}).get("metadata") or {}
            is_file = bool(metadata) or (entry or {}).get("id")
            if is_file:
                found.append(path)
            else:
                stack.append(path)
    return found


def purge_user_storage(
    admin_client, settings: Settings, user: CurrentUser, known_paths: dict[str, list[str]]
) -> dict[str, int]:
    uid = str(user.id)
    bucket_map = {
        "candidate-documents": settings.document_bucket,
        "candidate-avatars": settings.avatar_bucket,
    }
    removed: dict[str, int] = {key: 0 for key in bucket_map}
    for logical, bucket in bucket_map.items():
        paths = list(known_paths.get(logical) or [])
        try:
            paths.extend(_list_prefix_recursive(admin_client, bucket, uid))
        except Exception as exc:
            logger.exception("account_delete_storage_list_failed bucket=%s user_id=%s", bucket, uid)
            raise ApiError(500, "account_deletion_incomplete", "Could not enumerate stored account files.") from exc
        unique: list[str] = []
        seen: set[str] = set()
        for path in paths:
            if path and path not in seen:
                seen.add(path)
                unique.append(path)
        chunk_size = 50
        for index in range(0, len(unique), chunk_size):
            chunk = unique[index : index + chunk_size]
            try:
                admin_client.storage.from_(bucket).remove(chunk)
                removed[logical] += len(chunk)
            except Exception as exc:
                logger.exception(
                    "account_delete_storage_remove_failed bucket=%s count=%s user_id=%s",
                    bucket,
                    len(chunk),
                    uid,
                )
                raise ApiError(500, "account_deletion_incomplete", "Could not remove all stored account files.") from exc
        try:
            leftover_files = _list_prefix_recursive(admin_client, bucket, uid)
        except Exception:
            logger.exception("account_delete_storage_relist_failed bucket=%s user_id=%s", bucket, uid)
            leftover_files = []
        if leftover_files:
            logger.error(
                "account_delete_storage_leftover bucket=%s user_id=%s count=%s",
                bucket,
                uid,
                len(leftover_files),
            )
            raise ApiError(
                500,
                "account_deletion_incomplete",
                "Stored account files still remained after deletion. Please retry.",
            )
    return removed

