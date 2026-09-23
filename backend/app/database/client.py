from __future__ import annotations

import copy
import json
import logging
import re
import secrets
import time
import uuid
from pathlib import Path
from typing import Any
from urllib.parse import quote

import httpx

from app.core.config import Settings
from app.core.errors import ApiError

_IDENTIFIER = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")
_BUCKET = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]*$")
_TABLES = {
    "users", "profiles", "candidate_preferences", "candidate_skills", "candidate_experiences",
    "candidate_projects", "candidate_education", "candidate_certifications", "candidate_languages",
    "candidate_links", "resumes", "resume_versions", "job_descriptions", "ats_analyses",
    "ats_evidence", "resume_suggestions", "resume_exports", "resume_improvement_runs",
    "interview_sessions", "interview_questions", "interview_responses", "interview_reports",
    "learning_paths", "learning_items", "learning_resources", "jobs", "job_recommendations",
    "saved_jobs", "notification_preferences", "privacy_preferences", "activity_events",
    "user_notifications", "_setup_checks",
}

# Real column sets from the live Supabase PostgreSQL schema to prevent 400 Bad Request
# when queries ask for non-existent columns.
TABLE_COLUMNS: dict[str, set[str]] = {
    "user_notifications": {"id", "user_id", "title", "message", "is_read", "created_at"},
    "users": {"id", "email", "full_name", "password_hash", "token_version", "phone", "username", "supabase_uid", "auth_provider", "created_at", "updated_at"},
    "saved_jobs": {"id", "user_id", "job_id", "title", "company", "location", "work_mode", "url", "source", "status", "saved_at", "created_at"},
    "resume_suggestions": {"id", "run_id", "user_id", "section", "original_text", "suggested_text", "rationale", "status", "created_at"},
    "candidate_links": {"id", "user_id", "label", "url", "created_at"},
    "learning_paths": {"id", "user_id", "title", "target_skill", "status", "progress_percent", "created_at"},
    "job_recommendations": {"id", "user_id", "job_id", "match_score", "score_breakdown", "status", "created_at"},
    "candidate_preferences": {"id", "user_id", "target_roles", "locations", "work_modes", "salary_currency", "salary_min", "salary_max", "created_at", "updated_at"},
    "ats_evidence": {"id", "analysis_id", "user_id", "category", "finding", "match_status", "source_reference", "created_at"},
    "resume_improvement_runs": {"id", "user_id", "resume_version_id", "status", "created_at"},
    "resumes": {"id", "user_id", "title", "is_active", "deleted_at", "created_at", "updated_at"},
    "interview_responses": {"id", "question_id", "session_id", "user_id", "audio_path", "transcript", "evaluation", "created_at"},
    "jobs": {"id", "external_id", "title", "company", "location", "work_mode", "description", "url", "source", "created_at"},
    "candidate_certifications": {"id", "user_id", "name", "issuer", "issue_date", "expiry_date", "credential_id", "credential_url", "created_at"},
    "profiles": {"id", "username", "full_name", "phone", "avatar_url", "avatar_path", "target_role", "years_experience", "profile_completion", "profile_completion_details", "bio", "location", "created_at", "updated_at"},
    "learning_items": {"id", "learning_path_id", "user_id", "title", "status", "progress_percent", "item_order", "created_at"},
    "candidate_education": {"id", "user_id", "institution", "degree", "field_of_study", "start_date", "end_date", "created_at"},
    "candidate_experiences": {"id", "user_id", "company", "role", "start_date", "end_date", "is_current", "description", "highlights", "created_at"},
    "activity_events": {"id", "user_id", "event_type", "summary", "entity_type", "entity_id", "created_at"},
    "notification_preferences": {"id", "user_id", "email_alerts", "job_recommendations", "interview_reminders", "created_at", "updated_at"},
    "candidate_projects": {"id", "user_id", "name", "description", "role", "technologies", "url", "created_at"},
    "interview_questions": {"id", "session_id", "user_id", "question_index", "question_text", "category", "created_at"},
    "learning_resources": {"id", "learning_item_id", "user_id", "title", "url", "resource_type", "duration_minutes", "is_completed", "created_at"},
    "job_descriptions": {"id", "user_id", "title", "company", "role_title", "storage_path", "raw_text", "extracted_keywords", "extraction_status", "candidate_confirmed_at", "created_at"},
    "_setup_checks": {"id", "kind", "created_at"},
    "ats_analyses": {"id", "user_id", "resume_version_id", "job_description_id", "overall_score", "breakdown", "status", "started_at", "completed_at", "created_at"},
    "resume_exports": {"id", "user_id", "resume_version_id", "format", "storage_path", "created_at"},
    "interview_sessions": {"id", "user_id", "mode", "target_role", "target_company", "status", "started_at", "completed_at", "created_at"},
    "interview_reports": {"id", "session_id", "user_id", "overall_score", "communication_score", "structure_score", "content_score", "report", "status", "created_at"},
    "privacy_preferences": {"id", "user_id", "public_profile", "analytics_sharing", "created_at", "updated_at"},
    "resume_versions": {"id", "resume_id", "user_id", "version_number", "source_type", "original_filename", "storage_path", "raw_text", "structured_sections", "extraction_status", "candidate_confirmed_at", "created_at"},
    "candidate_languages": {"id", "user_id", "language", "proficiency", "created_at"},
    "candidate_skills": {"id", "user_id", "name", "category", "level", "created_at"},
}

logger = logging.getLogger(__name__)

# Reads copy real schema names onto expected app fields.
_READ_ALIASES: dict[str, tuple[tuple[str, str], ...]] = {
    "resume_versions": (
        ("raw_text", "plain_text"),
        ("structured_sections", "structured_content"),
    ),
    "job_descriptions": (
        ("raw_text", "plain_text"),
        ("structured_sections", "structured_content"),
    ),
    "interview_questions": (
        ("question_index", "position"),
        ("question_text", "question"),
        ("category", "question_type"),
    ),
    "interview_responses": (
        ("transcript", "typed_response"),
    ),
    "learning_items": (
        ("item_order", "position"),
        ("progress_percent", "watch_percent"),
        ("progress_percent", "progress_percentage"),
    ),
    "learning_paths": (
        ("progress_percent", "progress_percentage"),
    ),
    "ats_analyses": (
        ("breakdown", "score_breakdown"),
    ),
    "ats_evidence": (
        ("finding", "requirement_text"),
        ("finding", "explanation"),
        ("source_reference", "resume_evidence_text"),
    ),
    "candidate_projects": (
        ("name", "title"),
        ("technologies", "skills"),
    ),
    "candidate_preferences": (
        ("locations", "preferred_locations"),
    ),
    "candidate_experiences": (
        ("company", "company_name"),
        ("role", "role_title"),
        ("description", "summary"),
    ),
    "candidate_skills": (
        ("name", "normalized_name"),
    ),
    "candidate_languages": (
        ("language", "normalized_language"),
    ),
    "saved_jobs": (
        ("saved_at", "updated_at"),
    ),
    "profiles": (
        ("target_role", "current_role"),
    ),
    "candidate_links": (
        ("label", "link_type"),
    ),
    "jobs": (
        ("url", "application_url"),
    ),
}

# Writes translate app fields to real schema names.
_WRITE_ALIASES: dict[str, tuple[tuple[str, str], ...]] = {
    "resume_versions": (
        ("plain_text", "raw_text"),
        ("structured_content", "structured_sections"),
    ),
    "job_descriptions": (
        ("plain_text", "raw_text"),
        ("structured_content", "structured_sections"),
    ),
    "interview_questions": (
        ("position", "question_index"),
        ("question", "question_text"),
        ("question_type", "category"),
    ),
    "learning_items": (
        ("position", "item_order"),
        ("watch_percent", "progress_percent"),
        ("progress_percentage", "progress_percent"),
    ),
    "learning_paths": (
        ("progress_percentage", "progress_percent"),
    ),
    "ats_analyses": (
        ("score_breakdown", "breakdown"),
    ),
    "ats_evidence": (
        ("requirement_text", "finding"),
        ("explanation", "finding"),
        ("resume_evidence_text", "source_reference"),
    ),
    "candidate_projects": (
        ("title", "name"),
        ("skills", "technologies"),
    ),
    "candidate_preferences": (
        ("preferred_locations", "locations"),
    ),
    "candidate_experiences": (
        ("company_name", "company"),
        ("role_title", "role"),
        ("summary", "description"),
    ),
    "saved_jobs": (
        ("updated_at", "saved_at"),
    ),
    "resume_suggestions": (
        ("section_key", "section"),
        ("reason", "rationale"),
        ("decision", "status"),
        ("validation_status", "status"),
    ),
    "jobs": (
        ("application_url", "url"),
    ),
    "candidate_links": (
        ("link_type", "label"),
    ),
    "profiles": (
        ("current_role", "target_role"),
    ),
}

_ORDER_ALIASES: dict[str, dict[str, str]] = {
    "profiles": {"current_role": "target_role"},
    "saved_jobs": {"updated_at": "saved_at"},
    "interview_questions": {"position": "question_index"},
    "learning_items": {"position": "item_order"},
    "jobs": {"published_at": "created_at"},
    "candidate_projects": {"display_order": "created_at"},
    "candidate_experiences": {"display_order": "created_at"},
    "candidate_education": {"display_order": "created_at"},
}

_FILTER_ALIASES: dict[str, dict[str, str]] = {
    "profiles": {"current_role": "target_role"},
    "interview_questions": {"position": "question_index", "question": "question_text", "question_type": "category"},
    "learning_items": {"position": "item_order"},
    "candidate_projects": {"title": "name"},
    "resume_suggestions": {"analysis_id": "run_id"},
}

# Filters on columns that don't exist in the database that should be skipped cleanly
_FILTER_IGNORES: dict[str, set[str]] = {
    "jobs": {"is_active"},
    "resume_improvement_runs": {"ats_analysis_id"},
    "job_recommendations": {"resume_version_id"},
    "ats_analyses": {"algorithm_version"},
    "saved_jobs": {"is_active"},
}

_UNKNOWN_COLUMN = re.compile(
    r"(?:Could not find the '([^']+)' column|column (?:[a-zA-Z0-9_]+\.)?([a-zA-Z0-9_]+) does not exist)",
    re.IGNORECASE,
)


def _apply_read_aliases(table: str, rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    aliases = _READ_ALIASES.get(table) or ()
    if not aliases:
        return rows
    for row in rows:
        if not isinstance(row, dict):
            continue
        for source, dest in aliases:
            if row.get(dest) in (None, "", {}, []):
                if row.get(source) not in (None, "", {}, []):
                    row[dest] = row[source]
    return rows


def _apply_write_aliases(table: str, payload: Any) -> Any:
    aliases = _WRITE_ALIASES.get(table) or ()
    if not aliases:
        return payload

    def _one(row: Any) -> Any:
        if not isinstance(row, dict):
            return row
        updated = dict(row)
        for source, dest in aliases:
            if source in updated and dest not in updated:
                updated[dest] = updated[source]
        return updated

    if isinstance(payload, list):
        return [_one(row) for row in payload]
    return _one(payload)


TABLE_INT_COLUMNS: dict[str, set[str]] = {
    "users": {"token_version"},
    "learning_paths": {"progress_percent"},
    "job_recommendations": {"match_score"},
    "profiles": {"profile_completion"},
    "learning_items": {"progress_percent", "item_order"},
    "interview_questions": {"question_index"},
    "learning_resources": {"duration_minutes"},
    "ats_analyses": {"overall_score"},
    "interview_reports": {"overall_score", "communication_score", "structure_score", "content_score"},
    "resume_versions": {"version_number"},
}


def _sanitize_payload_for_table(table: str, payload: Any) -> Any:
    """Drop any keys that do not exist in the database table schema to avoid 400 Bad Request,
    and coerce known integer columns if provided as floats or numeric strings."""
    valid_cols = TABLE_COLUMNS.get(table)
    int_cols = TABLE_INT_COLUMNS.get(table, set())
    if not valid_cols:
        return payload

    def _clean(row: Any) -> Any:
        if not isinstance(row, dict):
            return row
        res = {}
        for k, v in row.items():
            if k in valid_cols:
                if k in int_cols and v is not None:
                    try:
                        res[k] = int(round(float(v)))
                    except (ValueError, TypeError):
                        res[k] = v
                else:
                    res[k] = v
        return res

    if isinstance(payload, list):
        return [_clean(r) for r in payload]
    return _clean(payload)


def _unknown_column_name(body: str) -> str | None:
    match = _UNKNOWN_COLUMN.search(body or "")
    if match:
        return match.group(1) or match.group(2)
    return None


def _drop_payload_column(payload: Any, column: str) -> Any:
    if isinstance(payload, list):
        return [{k: v for k, v in row.items() if k != column} if isinstance(row, dict) else row for row in payload]
    if isinstance(payload, dict):
        return {k: v for k, v in payload.items() if k != column}
    return payload


def _identifier(value: str) -> str:
    if not _IDENTIFIER.fullmatch(value):
        raise ValueError(f"Unsafe field identifier: {value}")
    return value


def _bucket_name(value: str) -> str:
    cleaned = (value or "").strip()
    if not _BUCKET.fullmatch(cleaned):
        raise ValueError(f"Unsafe storage bucket name: {value}")
    return cleaned


def _with_file_access_token(settings: Settings, bucket: str, path: str, url: str, expires: int) -> str:
    owner = str(path).split("/", 1)[0]
    try:
        uuid.UUID(owner)
    except (ValueError, TypeError, AttributeError):
        return url
    from app.features.auth.service import create_file_access_token

    token = create_file_access_token(
        user_id=owner, bucket=bucket, path=path, settings=settings, expires_seconds=expires
    )
    separator = "&" if "?" in url else "?"
    return f"{url}{separator}token={quote(token, safe='')}"


def _authenticated_file_url(settings: Settings, bucket: str, path: str) -> str:
    suffix = f"/files/{quote(bucket)}/{quote(path, safe='/')}"
    base = (settings.public_api_base_url or "").rstrip("/")
    prefix = (settings.api_v1_prefix or "/api/v1").rstrip("/")
    if not base:
        return f"{prefix}{suffix}"
    if base.endswith(prefix):
        return f"{base}{suffix}"
    return f"{base}{prefix}{suffix}"


def _order_value(value: Any) -> tuple[int, Any]:
    if isinstance(value, bool):
        return (0, int(value))
    if isinstance(value, (int, float)):
        return (0, value)
    if isinstance(value, str):
        try:
            return (0, float(value.strip()))
        except ValueError:
            return (1, value.casefold())
    return (1, str(value).casefold())


def _safe_object_key(name: str) -> str:
    if not isinstance(name, str):
        raise ValueError(f"Invalid storage path: type={type(name).__name__}, value={str(name)[:80]}")
    from urllib.parse import unquote
    decoded = unquote(name)
    relative = Path(decoded)
    if relative.is_absolute() or ".." in relative.parts:
        raise ValueError(f"Invalid storage path: type=str, value={name[:80]} contains '..' or absolute")
    cleaned = "/".join(part for part in relative.as_posix().split("/") if part and part != ".")
    if not cleaned:
        raise ValueError(f"Invalid storage path: type=str, value={name[:80]} empty after cleaning")
    if cleaned != decoded.strip("/"):
        normalized = "/".join(p for p in decoded.split("/") if p and p != ".")
        if cleaned != normalized:
            raise ValueError(f"Invalid storage path: type=str, value={name[:80]} normalized mismatch")
    return cleaned


class Result:
    def __init__(self, data: list[dict[str, Any]] | None = None, count: int | None = None):
        self.data = data or []
        self.count = count


class SupabaseStorageObject:
    def __init__(self, settings: Settings, logical_bucket: str):
        self.settings = settings
        self.bucket = _bucket_name(logical_bucket)
        self.storage_bucket = _bucket_name(settings.supabase_storage_bucket)
        self._http = httpx.Client(timeout=30)

    def _url(self, path: str = "") -> str:
        key = f"{self.bucket}/{_safe_object_key(path)}" if path else self.bucket
        return f"{self.settings.resolved_supabase_url}/storage/v1/object/{self.storage_bucket}/{quote(key, safe='/')}"

    def _request(self, method: str, url: str, **kwargs) -> httpx.Response:
        server_key = self.settings.supabase_server_key
        headers = {
            "apikey": server_key,
            "Authorization": f"Bearer {server_key}",
            **(kwargs.pop("headers", {}) or {}),
        }
        response = self._http.request(method, url, headers=headers, **kwargs)
        if response.status_code == 404:
            raise FileNotFoundError(url)
        response.raise_for_status()
        return response

    def upload(self, path: str, content: bytes, options: dict[str, Any] | None = None) -> dict[str, Any]:
        content_type = (options or {}).get("content-type") or (options or {}).get("content_type")
        headers = {"Content-Type": content_type or "application/octet-stream"}
        if (options or {}).get("upsert") in {True, "true"}:
            headers["x-upsert"] = "true"
        self._request("POST", self._url(path), content=content, headers=headers)
        return {"path": path}

    def download(self, path: str) -> bytes:
        return self._request("GET", self._url(path)).content

    def remove(self, paths: list[str]) -> list[dict[str, str]]:
        removed: list[dict[str, str]] = []
        for path in paths:
            try:
                self._request("DELETE", self._url(path))
            except FileNotFoundError:
                continue
            removed.append({"name": path})
        return removed

    def list(self, prefix: str = "") -> list[dict[str, Any]]:
        base_prefix = f"{self.bucket}/{_safe_object_key(prefix)}" if prefix else self.bucket
        items: list[dict[str, Any]] = []
        offset = 0
        page_size = 1000
        while True:
            response = self._request(
                "POST",
                f"{self.settings.resolved_supabase_url}/storage/v1/object/list/{self.storage_bucket}",
                json={"prefix": base_prefix, "limit": page_size, "offset": offset},
            )
            page = response.json() or []
            if not isinstance(page, list):
                break
            items.extend(page)
            if len(page) < page_size:
                break
            offset += page_size
        return items

    def create_signed_url(self, path: str, expires: int) -> dict[str, str]:
        url = _authenticated_file_url(self.settings, self.bucket, path)
        url = _with_file_access_token(self.settings, self.bucket, path, url, expires)
        return {"signedURL": url, "authenticated_file_url": url, "expires_in": int(expires)}


class MemoryStorageObject:
    _STORE: dict[str, dict[str, bytes]] = {}

    def __init__(self, settings: Settings, logical_bucket: str):
        self.settings = settings
        self.bucket = _bucket_name(logical_bucket)
        self._STORE.setdefault(self.bucket, {})

    def upload(self, path: str, content: bytes, options: dict[str, Any] | None = None) -> dict[str, Any]:
        key = _safe_object_key(path)
        bucket = self._STORE[self.bucket]
        if key in bucket and (options or {}).get("upsert") not in {True, "true"}:
            raise FileExistsError(path)
        bucket[key] = content
        return {"path": path}

    def download(self, path: str) -> bytes:
        key = _safe_object_key(path)
        try:
            return self._STORE[self.bucket][key]
        except KeyError as exc:
            raise FileNotFoundError(path) from exc

    def remove(self, paths: list[str]) -> list[dict[str, str]]:
        removed: list[dict[str, str]] = []
        bucket = self._STORE[self.bucket]
        for name in paths:
            key = _safe_object_key(name)
            if key in bucket:
                del bucket[key]
                removed.append({"name": name})
        return removed

    def list(self, prefix: str = "") -> list[dict[str, Any]]:
        base = _safe_object_key(prefix) if prefix else ""
        items: list[dict[str, Any]] = []
        children: set[str] = set()
        for key, content in self._STORE[self.bucket].items():
            if base and not (key == base or key.startswith(base + "/")):
                continue
            rest = key[len(base) :].lstrip("/") if base else key
            if not rest:
                continue
            head = rest.split("/", 1)[0]
            if head in children:
                continue
            children.add(head)
            if "/" in rest:
                items.append({"name": head, "id": None, "metadata": {}})
            else:
                items.append({"name": head, "id": secrets.token_hex(8), "metadata": {"size": len(content)}})
        return items

    def create_signed_url(self, path: str, expires: int) -> dict[str, str]:
        self.download(path)
        url = _authenticated_file_url(self.settings, self.bucket, path)
        url = _with_file_access_token(self.settings, self.bucket, path, url, expires)
        return {"signedURL": url, "authenticated_file_url": url, "expires_in": int(expires)}


class ObjectStorage:
    def __init__(self, settings: Settings):
        self.settings = settings
        self._memory = str(settings.app_env).lower() == "test"
        self._objects: dict[str, SupabaseStorageObject | MemoryStorageObject] = {}

    def from_(self, bucket: str) -> SupabaseStorageObject | MemoryStorageObject:
        logical_bucket = _bucket_name(bucket)
        cached = self._objects.get(logical_bucket)
        if cached is not None:
            return cached

        if self._memory:
            storage: SupabaseStorageObject | MemoryStorageObject = MemoryStorageObject(
                self.settings, logical_bucket
            )
        elif self.settings.supabase_storage_configured:
            storage = SupabaseStorageObject(self.settings, logical_bucket)
        else:
            raise ApiError(
                503,
                "storage_not_configured",
                "Object storage is not configured. Set SUPABASE_URL, "
                "SUPABASE_SERVICE_ROLE_KEY, and SUPABASE_STORAGE_BUCKET.",
            )
        self._objects[logical_bucket] = storage
        return storage


class SupabaseQuery:
    def __init__(self, client: SupabaseDatabaseClient, table: str):
        self.client = client
        self.table_name = _identifier(table)
        if self.table_name not in _TABLES:
            raise ValueError(f"Unknown table: {table}")
        self.columns = ["*"]
        self.requested_columns: list[str] = ["*"]
        self.filters: list[tuple[str, str, Any]] = []
        self.orders: list[tuple[str, bool]] = []
        self.max_rows: int | None = None
        self.single_row = False
        self.count_requested = False
        self.head = False
        self.operation = "select"
        self.payload: Any = None

    def select(self, columns: str = "*", count: str | None = None, head: bool = False) -> SupabaseQuery:
        parts = [column.strip() for column in columns.split(",") if column.strip()]
        self.columns = parts or ["*"]
        self.requested_columns = list(parts or ["*"])
        self.count_requested = count == "exact"
        self.head = head
        return self

    def eq(self, column: str, value: Any) -> SupabaseQuery: return self._filter("eq", column, value)
    def neq(self, column: str, value: Any) -> SupabaseQuery: return self._filter("neq", column, value)
    def ilike(self, column: str, value: Any) -> SupabaseQuery: return self._filter("ilike", column, value)
    def lt(self, column: str, value: Any) -> SupabaseQuery: return self._filter("lt", column, value)
    def lte(self, column: str, value: Any) -> SupabaseQuery: return self._filter("lte", column, value)
    def gt(self, column: str, value: Any) -> SupabaseQuery: return self._filter("gt", column, value)
    def gte(self, column: str, value: Any) -> SupabaseQuery: return self._filter("gte", column, value)
    def in_(self, column: str, values: list[Any]) -> SupabaseQuery: return self._filter("in", column, list(values or []))
    def is_(self, column: str, value: str) -> SupabaseQuery: return self._filter("is", column, value)

    def _filter(self, operator: str, column: str, value: Any) -> SupabaseQuery:
        self.filters.append((operator, _identifier(column), value))
        return self

    def order(self, column: str, desc: bool = False, *, server: bool = False) -> SupabaseQuery:
        self.orders.append((_identifier(column), desc))
        return self

    def limit(self, amount: int) -> SupabaseQuery:
        self.max_rows = max(0, int(amount))
        return self

    def single(self) -> SupabaseQuery:
        self.max_rows = 1
        self.single_row = True
        return self

    def insert(self, payload: Any) -> SupabaseQuery:
        self.operation = "insert"
        self.payload = payload
        return self

    def update(self, payload: Any) -> SupabaseQuery:
        self.operation = "update"
        self.payload = payload
        return self

    def upsert(self, payload: Any) -> SupabaseQuery:
        self.operation = "upsert"
        self.payload = payload
        return self

    def delete(self) -> SupabaseQuery:
        self.operation = "delete"
        return self

    def _build_params(self) -> dict[str, Any]:
        params: dict[str, Any] = {}
        valid_cols = TABLE_COLUMNS.get(self.table_name)
        if self.operation == "select":
            if valid_cols and "*" not in self.columns:
                select_cols: list[str] = []
                for c in self.columns:
                    if c in valid_cols:
                        select_cols.append(c)
                    else:
                        source = next((s for s, d in _READ_ALIASES.get(self.table_name, ()) if d == c and s in valid_cols), None)
                        if source and source not in select_cols:
                            select_cols.append(source)
                if not select_cols:
                    select_cols = ["id"] if "id" in valid_cols else ["*"]
                params["select"] = ",".join(select_cols)
            else:
                params["select"] = ",".join(self.columns)

            if self.orders:
                order_specs: list[str] = []
                for col, desc in self.orders:
                    real_col: str | None = col
                    if valid_cols and col not in valid_cols:
                        real_col = _ORDER_ALIASES.get(self.table_name, {}).get(col)
                        if not real_col:
                            source = next((s for s, d in _READ_ALIASES.get(self.table_name, ()) if d == col and s in valid_cols), None)
                            real_col = source
                        if not real_col:
                            real_col = "created_at" if "created_at" in valid_cols else ("saved_at" if "saved_at" in valid_cols else None)
                    if real_col:
                        order_specs.append(f"{real_col}.desc" if desc else f"{real_col}.asc")
                if order_specs:
                    params["order"] = ",".join(order_specs)

            if self.max_rows is not None:
                params["limit"] = str(self.max_rows)

        ignores = _FILTER_IGNORES.get(self.table_name, set())
        for op, col, val in self.filters:
            if col in ignores:
                continue
            real_col = col
            if valid_cols and col not in valid_cols:
                alias = _FILTER_ALIASES.get(self.table_name, {}).get(col)
                if alias and alias in valid_cols:
                    real_col = alias
                else:
                    source = next((s for s, d in _READ_ALIASES.get(self.table_name, ()) if d == col and s in valid_cols), None)
                    if source and source in valid_cols:
                        real_col = source
                    else:
                        logger.warning("omitting_unknown_filter_column table=%s col=%s", self.table_name, col)
                        continue
            if op == "eq":
                params[real_col] = f"eq.{val}"
            elif op == "neq":
                params[real_col] = f"neq.{val}"
            elif op == "ilike":
                params[real_col] = f"ilike.{val}"
            elif op == "lt":
                params[real_col] = f"lt.{val}"
            elif op == "lte":
                params[real_col] = f"lte.{val}"
            elif op == "gt":
                params[real_col] = f"gt.{val}"
            elif op == "gte":
                params[real_col] = f"gte.{val}"
            elif op == "is":
                params[real_col] = f"is.{str(val).lower()}"
            elif op == "in":
                items = []
                for item in val:
                    s = str(item)
                    if "," in s or '"' in s:
                        items.append(f'"{s}"')
                    else:
                        items.append(s)
                params[real_col] = f"in.({','.join(items)})"
        return params

    def execute(self) -> Result:
        base_url = f"{self.client.settings.resolved_supabase_url}/rest/v1/{self.table_name}"
        server_key = self.client.settings.supabase_server_key
        headers = {
            "apikey": server_key,
            "Authorization": f"Bearer {server_key}",
            "Content-Type": "application/json",
        }

        params = self._build_params()

        try:
            if self.operation == "select":
                if self.count_requested:
                    headers["Prefer"] = "count=exact"
                method = "HEAD" if self.head else "GET"
                resp = self.client.http.request(method, base_url, headers=headers, params=params)
                resp.raise_for_status()

                count = None
                if self.count_requested:
                    range_header = resp.headers.get("content-range", "")
                    if "/" in range_header:
                        total_str = range_header.split("/")[-1].strip()
                        if total_str.isdigit():
                            count = int(total_str)

                if self.head:
                    return Result([], count)

                data = resp.json() or []
                if not isinstance(data, list):
                    data = [data]
                if self.single_row:
                    data = data[:1]
                data = _apply_read_aliases(self.table_name, data)
                # Ensure all requested columns exist in returned row dictionaries
                req_cols = getattr(self, "requested_columns", self.columns)
                if "*" not in req_cols:
                    for row in data:
                        if isinstance(row, dict):
                            for col in req_cols:
                                if col not in row:
                                    if self.table_name == "profiles" and col == "current_role":
                                        row[col] = row.get("target_role")
                                    elif self.table_name == "saved_jobs" and col == "updated_at":
                                        row[col] = row.get("saved_at")
                                    else:
                                        row[col] = None
                return Result(data, count)

            elif self.operation == "insert":
                headers["Prefer"] = "return=representation"
                rows = _apply_write_aliases(
                    self.table_name, self.payload if isinstance(self.payload, list) else [self.payload]
                )
                rows = _sanitize_payload_for_table(self.table_name, rows)
                resp = None
                for _ in range(12):
                    resp = self.client.http.post(base_url, headers=headers, json=rows)
                    if resp.status_code != 400:
                        break
                    missing = _unknown_column_name(resp.text)
                    if not missing:
                        break
                    rows = _drop_payload_column(rows, missing)
                resp.raise_for_status()
                data = resp.json() or []
                if not isinstance(data, list):
                    data = [data]
                return Result(_apply_read_aliases(self.table_name, data))

            elif self.operation == "update":
                headers["Prefer"] = "return=representation"
                body = _apply_write_aliases(self.table_name, self.payload)
                body = _sanitize_payload_for_table(self.table_name, body)
                resp = None
                for _ in range(12):
                    resp = self.client.http.patch(base_url, headers=headers, params=params, json=body)
                    if resp.status_code != 400:
                        break
                    missing = _unknown_column_name(resp.text)
                    if not missing:
                        break
                    body = _drop_payload_column(body, missing)
                resp.raise_for_status()
                data = resp.json() or []
                if not isinstance(data, list):
                    data = [data]
                return Result(_apply_read_aliases(self.table_name, data))

            elif self.operation == "upsert":
                headers["Prefer"] = "resolution=merge-duplicates,return=representation"
                params = {}
                if self.table_name == "saved_jobs":
                    params["on_conflict"] = "user_id,job_id"
                elif self.table_name in {"candidate_preferences", "notification_preferences", "privacy_preferences"}:
                    params["on_conflict"] = "user_id"
                rows = _apply_write_aliases(
                    self.table_name, self.payload if isinstance(self.payload, list) else [self.payload]
                )
                rows = _sanitize_payload_for_table(self.table_name, rows)
                resp = None
                for _ in range(12):
                    resp = self.client.http.post(base_url, headers=headers, params=params, json=rows)
                    if resp.status_code != 400:
                        break
                    missing = _unknown_column_name(resp.text)
                    if not missing:
                        break
                    rows = _drop_payload_column(rows, missing)
                resp.raise_for_status()
                data = resp.json() or []
                if not isinstance(data, list):
                    data = [data]
                return Result(_apply_read_aliases(self.table_name, data))

            elif self.operation == "delete":
                headers["Prefer"] = "return=representation"
                resp = self.client.http.delete(base_url, headers=headers, params=params)
                resp.raise_for_status()
                data = resp.json() or []
                if not isinstance(data, list):
                    data = [data]
                return Result(data)

        except httpx.HTTPStatusError as exc:
            body_snippet = exc.response.text[:300] if exc.response.text else ""
            logger.error("supabase_http_error table=%s status=%s body=%s", self.table_name, exc.response.status_code, body_snippet)
            postgrest_code = ""
            postgrest_message = ""
            try:
                payload = exc.response.json()
            except (ValueError, json.JSONDecodeError):
                payload = None
            if isinstance(payload, dict):
                postgrest_code = str(payload.get("code") or "")
                postgrest_message = str(payload.get("message") or "")
            if postgrest_code == "42501" or postgrest_message.lower().startswith("permission denied"):
                raise ApiError(
                    503,
                    "database_privileges_missing",
                    "Supabase tables exist, but the API role cannot access them. "
                    "Run docs/database/supabase-grants.sql in the Supabase SQL Editor.",
                ) from exc
            detail = f"Supabase query failed: HTTP {exc.response.status_code}"
            if body_snippet:
                detail = f"{detail} ({body_snippet})"
            raise ApiError(503, "database_unavailable", detail) from exc
        except httpx.RequestError as exc:
            logger.error("supabase_request_error table=%s error=%s", self.table_name, exc)
            raise ApiError(503, "database_unavailable", "Supabase database could not be reached.") from exc


class MemoryQuery:
    def __init__(self, client: MemoryDatabaseClient, table: str):
        self.client = client
        self.table_name = _identifier(table)
        self.columns = ["*"]
        self.requested_columns: list[str] = ["*"]
        self.filters: list[tuple[str, str, Any]] = []
        self.orders: list[tuple[str, bool]] = []
        self.max_rows: int | None = None
        self.single_row = False
        self.count_requested = False
        self.head = False
        self.operation = "select"
        self.payload: Any = None

    def select(self, columns: str = "*", count: str | None = None, head: bool = False) -> MemoryQuery:
        parts = [column.strip() for column in columns.split(",") if column.strip()]
        self.columns = parts or ["*"]
        self.requested_columns = list(parts or ["*"])
        self.count_requested = count == "exact"
        self.head = head
        return self

    def eq(self, column: str, value: Any) -> MemoryQuery: return self._filter("eq", column, value)
    def neq(self, column: str, value: Any) -> MemoryQuery: return self._filter("neq", column, value)
    def ilike(self, column: str, value: Any) -> MemoryQuery: return self._filter("ilike", column, value)
    def lt(self, column: str, value: Any) -> MemoryQuery: return self._filter("lt", column, value)
    def lte(self, column: str, value: Any) -> MemoryQuery: return self._filter("lte", column, value)
    def gt(self, column: str, value: Any) -> MemoryQuery: return self._filter("gt", column, value)
    def gte(self, column: str, value: Any) -> MemoryQuery: return self._filter("gte", column, value)
    def in_(self, column: str, values: list[Any]) -> MemoryQuery: return self._filter("in", column, list(values or []))
    def is_(self, column: str, value: str) -> MemoryQuery: return self._filter("is", column, value)

    def _filter(self, operator: str, column: str, value: Any) -> MemoryQuery:
        self.filters.append((operator, _identifier(column), value))
        return self

    def order(self, column: str, desc: bool = False, *, server: bool = False) -> MemoryQuery:
        self.orders.append((_identifier(column), desc))
        return self

    def limit(self, amount: int) -> MemoryQuery:
        self.max_rows = max(0, int(amount))
        return self

    def single(self) -> MemoryQuery:
        self.max_rows = 1
        self.single_row = True
        return self

    def insert(self, payload: Any) -> MemoryQuery:
        self.operation = "insert"
        self.payload = payload
        return self

    def update(self, payload: Any) -> MemoryQuery:
        self.operation = "update"
        self.payload = payload
        return self

    def upsert(self, payload: Any) -> MemoryQuery:
        self.operation = "upsert"
        self.payload = payload
        return self

    def delete(self) -> MemoryQuery:
        self.operation = "delete"
        return self

    def _matches(self, row: dict[str, Any]) -> bool:
        ignores = _FILTER_IGNORES.get(self.table_name, set())
        for op, col, val in self.filters:
            if col in ignores:
                continue
            actual = row.get(col)
            if op == "eq":
                if str(actual) != str(val) and actual != val:
                    return False
            elif op == "neq":
                if str(actual) == str(val) or actual == val:
                    return False
            elif op == "ilike":
                pattern = re.escape(str(val or "")).replace(r"%", ".*").replace(r"_", ".")
                if actual is None or re.fullmatch(pattern, str(actual), flags=re.IGNORECASE) is None:
                    return False
            elif op == "lt":
                if actual is None or actual >= val:
                    return False
            elif op == "lte":
                if actual is None or actual > val:
                    return False
            elif op == "gt":
                if actual is None or actual <= val:
                    return False
            elif op == "gte":
                if actual is None or actual < val:
                    return False
            elif op == "is":
                if str(val).lower() == "null":
                    if actual is not None:
                        return False
                else:
                    if actual != val:
                        return False
            elif op == "in":
                str_vals = {str(v) for v in val}
                if str(actual) not in str_vals and actual not in val:
                    return False
        return True

    def execute(self) -> Result:
        store = self.client.get_table(self.table_name)
        if self.operation == "insert":
            rows = self.payload if isinstance(self.payload, list) else [self.payload]
            rows = _apply_write_aliases(self.table_name, rows)
            rows = _sanitize_payload_for_table(self.table_name, rows)
            output = []
            for r in rows:
                row = copy.deepcopy(dict(r or {}))
                if "id" not in row or not row["id"]:
                    row["id"] = str(uuid.uuid4())
                store.append(row)
                output.append(copy.deepcopy(row))
            return Result(_apply_read_aliases(self.table_name, output))

        elif self.operation == "upsert":
            rows = self.payload if isinstance(self.payload, list) else [self.payload]
            rows = _apply_write_aliases(self.table_name, rows)
            rows = _sanitize_payload_for_table(self.table_name, rows)
            output = []
            for r in rows:
                row = copy.deepcopy(dict(r or {}))
                key_field = "id"
                if self.table_name in {"candidate_preferences", "notification_preferences", "privacy_preferences"}:
                    key_field = "user_id"
                elif self.table_name == "saved_jobs":
                    key_field = ("user_id", "job_id")

                existing = None
                for idx, item in enumerate(store):
                    if isinstance(key_field, tuple):
                        if all(item.get(k) == row.get(k) for k in key_field):
                            existing = idx
                            break
                    else:
                        if item.get(key_field) == row.get(key_field):
                            existing = idx
                            break

                if existing is not None:
                    store[existing].update(row)
                    output.append(copy.deepcopy(store[existing]))
                else:
                    if "id" not in row or not row["id"]:
                        row["id"] = str(uuid.uuid4())
                    store.append(row)
                    output.append(copy.deepcopy(row))
            return Result(_apply_read_aliases(self.table_name, output))

        elif self.operation == "update":
            output = []
            payload = _apply_write_aliases(self.table_name, self.payload)
            payload = _sanitize_payload_for_table(self.table_name, payload)
            for item in store:
                if self._matches(item):
                    item.update(copy.deepcopy(dict(payload or {})))
                    output.append(copy.deepcopy(item))
            return Result(_apply_read_aliases(self.table_name, output))

        elif self.operation == "delete":
            kept = []
            deleted = []
            for item in store:
                if self._matches(item):
                    deleted.append(copy.deepcopy(item))
                else:
                    kept.append(item)
            self.client.set_table(self.table_name, kept)
            return Result(deleted)

        matching = [copy.deepcopy(item) for item in store if self._matches(item)]
        matching = _apply_read_aliases(self.table_name, matching)
        total_count = len(matching) if self.count_requested else None

        for col, desc in reversed(self.orders):
            real_col = col
            if self.table_name in TABLE_COLUMNS and col not in TABLE_COLUMNS[self.table_name]:
                real_col = _ORDER_ALIASES.get(self.table_name, {}).get(col)
                if not real_col:
                    source = next((s for s, d in _READ_ALIASES.get(self.table_name, ()) if d == col), None)
                    real_col = source or "created_at"
            matching.sort(key=lambda r: _order_value(r.get(real_col) if real_col else r.get(col)), reverse=desc)

        if self.max_rows is not None:
            matching = matching[: self.max_rows]

        req_cols = getattr(self, "requested_columns", self.columns)
        if "*" not in req_cols:
            res_matching = []
            for r in matching:
                row_dict = {}
                for k in req_cols:
                    if k in r:
                        row_dict[k] = r.get(k)
                    elif self.table_name == "profiles" and k == "current_role":
                        row_dict[k] = r.get("target_role")
                    elif self.table_name == "saved_jobs" and k == "updated_at":
                        row_dict[k] = r.get("saved_at")
                    else:
                        row_dict[k] = None
                res_matching.append(row_dict)
            matching = res_matching

        if self.head:
            return Result([], total_count)
        if self.single_row:
            return Result(matching[:1], total_count)
        return Result(matching, total_count)


class MemoryDatabaseClient:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.storage = ObjectStorage(settings)
        self._tables: dict[str, list[dict[str, Any]]] = {}

    def get_table(self, name: str) -> list[dict[str, Any]]:
        return self._tables.setdefault(name, [])

    def set_table(self, name: str, rows: list[dict[str, Any]]) -> None:
        self._tables[name] = rows

    def table(self, name: str) -> MemoryQuery:
        return MemoryQuery(self, name)


class SupabaseDatabaseClient:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.storage = ObjectStorage(settings)
        self.http = httpx.Client(timeout=30)

    def table(self, name: str) -> SupabaseQuery:
        return SupabaseQuery(self, name)


_db_client_cache: dict[str, Any] = {}


def database_client(settings: Settings) -> SupabaseDatabaseClient | MemoryDatabaseClient:
    if str(settings.app_env).lower() == "test":
        cache_key = "test_memory_db"
        if cache_key not in _db_client_cache:
            _db_client_cache[cache_key] = MemoryDatabaseClient(settings)
        return _db_client_cache[cache_key]

    if not settings.database_configured:
        raise ApiError(
            503,
            "database_not_configured",
            "Supabase database is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
        )

    cache_key = f"{settings.resolved_supabase_url}:{settings.supabase_server_key}"
    if cache_key in _db_client_cache:
        return _db_client_cache[cache_key]

    client = SupabaseDatabaseClient(settings)
    _db_client_cache[cache_key] = client
    return client


def _probe_with_timeout(label: str, fn, timeout_seconds: float = 3.0) -> tuple[bool, str | None]:
    from concurrent.futures import ThreadPoolExecutor
    from concurrent.futures import TimeoutError as FuturesTimeout

    timeout = max(0.5, float(timeout_seconds))
    pool = ThreadPoolExecutor(max_workers=1, thread_name_prefix=f"probe-{label}")
    try:
        future = pool.submit(fn)
        try:
            future.result(timeout=timeout)
            return True, None
        except FuturesTimeout:
            future.cancel()
            return False, f"{label}_probe_timeout_after_{timeout:.1f}s"
        except Exception as exc:
            return False, f"{type(exc).__name__}: {exc}"[:240]
    finally:
        pool.shutdown(wait=False, cancel_futures=True)


_probe_cache: dict[str, tuple[float, dict[str, Any]]] = {}


def database_probe(settings: Settings, *, timeout_seconds: float = 3.0) -> dict[str, Any]:
    cache_key = f"{settings.resolved_supabase_url}:{settings.supabase_storage_bucket}:{timeout_seconds}"
    now = time.time()
    if cache_key in _probe_cache:
        ts, cached = _probe_cache[cache_key]
        if now - ts < 10:
            return cached

    storage_engine = "supabase_storage" if settings.supabase_storage_configured else "unconfigured"
    storage_bucket = settings.supabase_storage_bucket or None
    result: dict[str, Any] = {
        "status": "unreachable",
        "configured": settings.database_configured,
        "database": "postgres",
        "engine": "supabase",
        "project": settings.supabase_project_ref or None,
        "storage_bucket": storage_bucket,
        "storage_engine": storage_engine,
        "database_status": "unreachable",
        "storage_status": "unreachable",
    }

    if not settings.database_configured:
        result["database_error"] = "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY not configured"
        return result

    def _db_ping() -> None:
        client = database_client(settings)
        if isinstance(client, MemoryDatabaseClient):
            client.table("_setup_checks").select("id").limit(1).execute()
            return
        url = f"{settings.resolved_supabase_url}/rest/v1/"
        server_key = settings.supabase_server_key
        headers = {"apikey": server_key, "Authorization": f"Bearer {server_key}"}
        resp = client.http.get(url, headers=headers, timeout=timeout_seconds)
        if resp.status_code not in (200, 404):
            resp.raise_for_status()

    def _storage_ping() -> None:
        if not settings.storage_configured:
            raise RuntimeError("Object storage is not configured")
        ObjectStorage(settings).from_(settings.document_bucket).list("_setup_checks")

    from concurrent.futures import ThreadPoolExecutor as _TPE
    with _TPE(max_workers=2) as _pool:
        f_db = _pool.submit(_probe_with_timeout, "supabase_db", _db_ping, timeout_seconds)
        f_st = _pool.submit(_probe_with_timeout, "storage", _storage_ping, timeout_seconds)
        ok_db, db_err = f_db.result()
        ok_st, st_err = f_st.result()

    if ok_db:
        result["database_status"] = "reachable"
    elif db_err:
        result["database_error"] = db_err

    if ok_st:
        result["storage_status"] = "reachable"
    elif st_err:
        result["storage_error"] = st_err

    if result["database_status"] == "reachable" and result["storage_status"] == "reachable":
        result["status"] = "reachable"
    elif result["database_status"] == "reachable" or result["storage_status"] == "reachable":
        result["status"] = "degraded"

    _probe_cache[cache_key] = (time.time(), result)
    return result
