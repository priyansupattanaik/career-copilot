"""Verify Supabase PostgreSQL (PostgREST) + Supabase Storage connectivity."""

import uuid

from app.core.config import get_settings
from app.core.errors import ApiError
from app.database.client import database_client


def main() -> None:
    settings = get_settings()
    if not settings.database_configured:
        raise SystemExit(
            "Supabase database is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
        )
    try:
        client = database_client(settings)
        check_id = str(uuid.uuid4())
        client.table("_setup_checks").insert({"id": check_id, "kind": "startup"}).execute()
        rows = (
            client.table("_setup_checks")
            .select("id,kind")
            .eq("id", check_id)
            .single()
            .execute()
            .data
            or []
        )
        row = rows[0] if rows else None
        if not row or row.get("id") != check_id:
            raise RuntimeError("Supabase read-after-write verification returned the wrong document")
        client.table("_setup_checks").delete().eq("id", check_id).execute()

        storage_path = f"_setup_checks/{check_id}.txt"
        client.storage.from_(settings.document_bucket).upload(
            storage_path,
            b"career-copilot-storage-check",
            {"upsert": True, "content_type": "text/plain"},
        )
        downloaded = client.storage.from_(settings.document_bucket).download(storage_path)
        if downloaded != b"career-copilot-storage-check":
            raise RuntimeError("Supabase Storage read-after-write returned unexpected bytes")
        client.storage.from_(settings.document_bucket).remove([storage_path])
    except Exception as exc:
        message = str(exc).strip() or type(exc).__name__
        if isinstance(exc, ApiError) and exc.code == "database_privileges_missing":
            raise SystemExit(
                f"Supabase tables exist, but the API role cannot read or write them ({message}).\n"
                "Please execute 'docs/database/supabase-grants.sql' in your Supabase SQL Editor, "
                "then retry. This grants SELECT/INSERT/UPDATE/DELETE on public tables to service_role."
            ) from exc
        if "pgrst205" in message.lower() or "could not find the table" in message.lower():
            raise SystemExit(
                f"Supabase database reached successfully, but schema tables have not been initialized yet ({message}).\n"
                "Please execute 'docs/database/supabase-schema.sql' in your Supabase SQL Editor to initialize the 31 tables, foreign keys, and RLS policies."
            ) from exc
        if "42501" in message or "permission denied" in message.lower():
            raise SystemExit(
                f"Supabase tables exist, but the API role cannot read or write them ({message}).\n"
                "Please execute 'docs/database/supabase-grants.sql' in your Supabase SQL Editor, "
                "then retry. This grants SELECT/INSERT/UPDATE/DELETE on public tables to service_role."
            ) from exc
        if "storage" in message.lower() or "bucket" in message.lower():
            raise SystemExit(
                "Supabase Storage check failed. The configured bucket "
                f"'{settings.supabase_storage_bucket}' does not exist or is not accessible "
                f"for Supabase project '{settings.supabase_url}'. Create the private bucket in Supabase, "
                "copy the bucket name into SUPABASE_STORAGE_BUCKET, then retry. Detail: "
                f"{message}"
            ) from exc
        raise SystemExit(f"Supabase connectivity check failed: {message}") from exc
    print(
        f"supabase_url={settings.resolved_supabase_url} "
        f"project_ref={settings.supabase_project_ref} "
        f"storage_bucket={settings.supabase_storage_bucket} "
        "engine=supabase storage_engine=supabase_storage "
        "write_read=passed cleanup=passed"
    )


if __name__ == "__main__":
    main()
