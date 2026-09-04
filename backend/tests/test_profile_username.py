"""Tests for username validation and profile patch requirements."""
import pytest
from app.features.auth.username import validate_username, normalize_username
from app.api.schemas import ProfilePatch


def test_normalize_username():
    assert normalize_username("  @Priyansu_User  ") == "priyansu_user"
    assert normalize_username("John Doe") == "john_doe"


def test_validate_username_valid():
    assert validate_username("priyansu") == "priyansu"
    assert validate_username("@priyansu_dev") == "priyansu_dev"
    assert validate_username("alex123") == "alex123"
    assert validate_username("a_1") == "a_1"


def test_validate_username_invalid():
    with pytest.raises(ValueError):
        validate_username("ab")  # too short
    with pytest.raises(ValueError):
        validate_username("a" * 31)  # too long
    with pytest.raises(ValueError):
        validate_username("user-name")  # hyphen not allowed
    with pytest.raises(ValueError):
        validate_username("user.name")  # dot not allowed
    with pytest.raises(ValueError):
        validate_username("_username")  # cannot start with underscore
    with pytest.raises(ValueError):
        validate_username("username_")  # cannot end with underscore


def test_profile_patch_username():
    patch = ProfilePatch(username="priyansu_test")
    assert patch.username == "priyansu_test"
