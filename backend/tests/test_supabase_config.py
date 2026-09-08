"""Tests for Supabase database configuration and in-memory test client."""

import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock

import httpx

from app.core.errors import ApiError
from app.database import client as db_client
from app.database.client import MemoryDatabaseClient, SupabaseDatabaseClient, database_client


class SupabaseConfigTests(unittest.TestCase):
    def setUp(self) -> None:
        db_client._db_client_cache.clear()

    def tearDown(self) -> None:
        db_client._db_client_cache.clear()

    def test_database_client_fails_closed_when_unconfigured(self) -> None:
        settings = SimpleNamespace(
            app_env="development",
            database_configured=False,
            resolved_supabase_url="",
            supabase_server_key="",
        )
        with self.assertRaises(ApiError) as caught:
            database_client(settings)
        error = caught.exception
        self.assertEqual(error.status_code, 503)
        self.assertEqual(error.code, "database_not_configured")
        self.assertIn("Supabase database is not configured", str(error))

    def test_test_environment_uses_memory_database(self) -> None:
        settings = SimpleNamespace(
            app_env="test",
            database_configured=False,
            resolved_supabase_url="",
            supabase_server_key="",
            supabase_storage_bucket="test-bucket",
            supabase_storage_configured=False,
        )
        client = database_client(settings)
        self.assertIsInstance(client, MemoryDatabaseClient)

        # Test in-memory table operations (insert, select, update, delete)
        client.table("users").insert({"id": "u1", "email": "test@example.com"}).execute()
        rows = client.table("users").select("*").eq("id", "u1").execute().data
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["email"], "test@example.com")

        client.table("users").update({"email": "updated@example.com"}).eq("id", "u1").execute()
        updated_rows = client.table("users").select("*").eq("id", "u1").execute().data
        self.assertEqual(updated_rows[0]["email"], "updated@example.com")

        client.table("users").delete().eq("id", "u1").execute()
        deleted_rows = client.table("users").select("*").eq("id", "u1").execute().data
        self.assertEqual(len(deleted_rows), 0)

    def test_select_missing_table_is_database_unavailable(self) -> None:
        settings = SimpleNamespace(
            app_env="development",
            resolved_supabase_url="https://example.supabase.co",
            supabase_server_key="test-key",
            supabase_storage_bucket="test-bucket",
            supabase_storage_configured=False,
        )
        client = SupabaseDatabaseClient(settings)
        request = httpx.Request("GET", "https://example.supabase.co/rest/v1/profiles")
        response = httpx.Response(
            404,
            request=request,
            content=b'{"code":"PGRST205","message":"Could not find the table \'public.profiles\' in the schema cache"}',
        )
        client.http = MagicMock()
        client.http.request.return_value = response

        with self.assertRaises(ApiError) as caught:
            client.table("profiles").select("id").limit(1).execute()
        error = caught.exception
        self.assertEqual(error.status_code, 503)
        self.assertEqual(error.code, "database_unavailable")
        self.assertIn("PGRST205", error.message)

    def test_select_empty_result_is_not_error(self) -> None:
        settings = SimpleNamespace(
            app_env="development",
            resolved_supabase_url="https://example.supabase.co",
            supabase_server_key="test-key",
            supabase_storage_bucket="test-bucket",
            supabase_storage_configured=False,
        )
        client = SupabaseDatabaseClient(settings)
        request = httpx.Request("GET", "https://example.supabase.co/rest/v1/profiles")
        response = httpx.Response(200, request=request, content=b"[]")
        client.http = MagicMock()
        client.http.request.return_value = response

        result = client.table("profiles").select("id").limit(1).execute()
        self.assertEqual(result.data, [])

    def test_select_permission_denied_is_privileges_missing(self) -> None:
        settings = SimpleNamespace(
            app_env="development",
            resolved_supabase_url="https://example.supabase.co",
            supabase_server_key="test-key",
            supabase_storage_bucket="test-bucket",
            supabase_storage_configured=False,
        )
        client = SupabaseDatabaseClient(settings)
        request = httpx.Request("GET", "https://example.supabase.co/rest/v1/profiles")
        response = httpx.Response(
            403,
            request=request,
            content=b'{"code":"42501","hint":"Grant the required privileges to the current role with: GRANT SELECT ON public.profiles TO service_role;","message":"permission denied for table profiles"}',
        )
        client.http = MagicMock()
        client.http.request.return_value = response

        with self.assertRaises(ApiError) as caught:
            client.table("profiles").select("id").limit(1).execute()
        error = caught.exception
        self.assertEqual(error.status_code, 503)
        self.assertEqual(error.code, "database_privileges_missing")
        self.assertIn("supabase-grants.sql", error.message)

    def test_insert_permission_denied_is_privileges_missing(self) -> None:
        settings = SimpleNamespace(
            app_env="development",
            resolved_supabase_url="https://example.supabase.co",
            supabase_server_key="test-key",
            supabase_storage_bucket="test-bucket",
            supabase_storage_configured=False,
        )
        client = SupabaseDatabaseClient(settings)
        request = httpx.Request("POST", "https://example.supabase.co/rest/v1/_setup_checks")
        response = httpx.Response(
            403,
            request=request,
            content=b'{"code":"42501","message":"permission denied for table _setup_checks"}',
        )
        client.http = MagicMock()
        client.http.post.return_value = response

        with self.assertRaises(ApiError) as caught:
            client.table("_setup_checks").insert({"id": "check-1", "kind": "startup"}).execute()
        error = caught.exception
        self.assertEqual(error.status_code, 503)
        self.assertEqual(error.code, "database_privileges_missing")


if __name__ == "__main__":
    unittest.main()
