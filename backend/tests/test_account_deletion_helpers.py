from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

from app.features.auth.account_deletion import (
    CONFIRM_PHRASE,
    USER_OWNED_TABLES,
    confirmation_is_valid,
    delete_supabase_auth_user,
    delete_user_owned_records,
    email_matches_account,
)


def test_confirmation_phrase_exact():
    assert confirmation_is_valid(CONFIRM_PHRASE)
    assert not confirmation_is_valid("delete my account")
    assert not confirmation_is_valid("")


def test_email_match_requires_non_empty():
    assert not email_matches_account(None, "a@b.com")
    assert not email_matches_account("", "a@b.com")
    assert not email_matches_account("x@y.com", "a@b.com")
    assert email_matches_account("A@B.com", "a@b.com")


def test_delete_user_owned_records_walks_tables():
    client = MagicMock()
    delete_result = MagicMock()
    delete_result.data = [{"id": "1"}]
    client.table.return_value.delete.return_value.eq.return_value.execute.return_value = delete_result
    user = SimpleNamespace(id="user-1")
    counts = delete_user_owned_records(client, user)  # type: ignore[arg-type]
    assert "profiles" in counts
    assert len(USER_OWNED_TABLES) >= 10
    assert client.table.call_count >= len(USER_OWNED_TABLES)


def _settings_with_supabase(url: str = "https://sb.example.com", key: str = "service-key"):
    return SimpleNamespace(resolved_supabase_url=url, supabase_server_key=key)


def test_delete_supabase_auth_user_calls_admin_endpoint(monkeypatch):
    calls: list[tuple[str, str, dict]] = []

    def fake_delete(url, headers=None, timeout=None):
        calls.append((url, headers.get("Authorization", ""), dict(headers or {})))
        return SimpleNamespace(status_code=204, text="")

    monkeypatch.setattr("httpx.delete", fake_delete)
    ok = delete_supabase_auth_user(_settings_with_supabase(), "supa-uid-1")
    assert ok is True
    assert calls[0][0] == "https://sb.example.com/auth/v1/admin/users/supa-uid-1"
    assert calls[0][1] == "Bearer service-key"


def test_delete_supabase_auth_user_treats_missing_identity_as_deleted(monkeypatch):
    monkeypatch.setattr(
        "httpx.delete",
        lambda *a, **k: SimpleNamespace(status_code=404, text=""),
    )
    assert delete_supabase_auth_user(_settings_with_supabase(), "gone-uid") is True


def test_delete_supabase_auth_user_raises_on_provider_error(monkeypatch):
    monkeypatch.setattr(
        "httpx.delete",
        lambda *a, **k: SimpleNamespace(status_code=500, text="boom"),
    )
    with pytest.raises(RuntimeError):
        delete_supabase_auth_user(_settings_with_supabase(), "stuck-uid")


def test_delete_supabase_auth_user_requires_credentials():
    with pytest.raises(RuntimeError):
        delete_supabase_auth_user(_settings_with_supabase(url="", key=""), "uid")
    with pytest.raises(RuntimeError):
        delete_supabase_auth_user(_settings_with_supabase(url="https://sb.example.com", key=""), "uid")
