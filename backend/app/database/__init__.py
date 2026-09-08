"""Supabase database and object storage data access for Career Copilot.

Structured data: Supabase PostgreSQL (PostgREST) via SupabaseDatabaseClient.
Binary objects (resumes, avatars, media): Supabase Storage via ObjectStorage.
Automated tests: in-memory database and storage (APP_ENV=test).
"""

from app.database.client import (
    MemoryDatabaseClient,
    ObjectStorage,
    Result,
    SupabaseDatabaseClient,
    database_client,
    database_probe,
)

__all__ = [
    "MemoryDatabaseClient",
    "ObjectStorage",
    "Result",
    "SupabaseDatabaseClient",
    "database_client",
    "database_probe",
]
