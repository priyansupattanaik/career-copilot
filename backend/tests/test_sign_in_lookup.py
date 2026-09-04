"""Sign-in identifier routing — usernames must not scan users by email."""

from app.api.routers.auth import identifier_uses_email_lookup, sanitize_signup_phone
from app.features.auth.username import validate_username


def test_username_sign_in_skips_email_collection_scan():
    identifier = "priyansu"
    assert identifier_uses_email_lookup(identifier) is False
    assert sanitize_signup_phone(identifier) in {None, ""}
    assert validate_username(identifier) == "priyansu"


def test_email_sign_in_still_uses_email_lookup():
    assert identifier_uses_email_lookup("priyansu@example.com") is True
