from unittest.mock import MagicMock

from app.api.routers.auth import _create_user_records, sanitize_signup_phone


def test_sanitize_signup_phone_accepts_valid_formats():
    assert sanitize_signup_phone("+91 98765 43210") == "+919876543210"
    assert sanitize_signup_phone("9876543210") == "+9876543210"
    assert sanitize_signup_phone("+1 (415) 555-0100") == "+14155550100"
    assert sanitize_signup_phone("  ") is None
    assert sanitize_signup_phone(None) is None
    assert sanitize_signup_phone("abc") is None
    assert sanitize_signup_phone("123") is None
    assert sanitize_signup_phone("+919876543210987654321") is None


def test_create_user_records_seeds_profile_phone():
    client = MagicMock()
    insert_result = MagicMock()
    insert_result.data = [{"id": "u1", "email": "a@b.com"}]
    client.table.return_value.insert.return_value.execute.return_value = insert_result
    user = {"id": "u1", "email": "a@b.com", "full_name": "A", "phone": "+919876543210"}
    _create_user_records(client, user)
    inserts = client.table.return_value.insert.call_args_list
    profile_insert = inserts[1].args[0]
    assert profile_insert["phone"] == "+919876543210"


def test_create_user_records_omits_empty_phone():
    client = MagicMock()
    insert_result = MagicMock()
    insert_result.data = [{"id": "u1"}]
    client.table.return_value.insert.return_value.execute.return_value = insert_result
    _create_user_records(client, {"id": "u1", "email": "a@b.com", "full_name": "A", "phone": None})
    profile_insert = client.table.return_value.insert.call_args_list[1].args[0]
    assert "phone" not in profile_insert
