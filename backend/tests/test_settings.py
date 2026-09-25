from uuid import uuid4
from pydantic import ValidationError
import pytest

from app.api.schemas import (
    NotificationSettings,
    PrivacySettings,
    PreferencesUpdate,
    AccountDeleteRequest,
    UsernameChange,
)


def test_notification_settings_defaults():
    notifs = NotificationSettings()
    assert notifs.job_alerts is False
    assert notifs.learning_reminders is True
    assert notifs.interview_reminders is True
    assert notifs.product_updates is False
    assert notifs.email_frequency == "weekly"


def test_notification_settings_custom():
    notifs = NotificationSettings(
        job_alerts=True,
        learning_reminders=False,
        interview_reminders=False,
        product_updates=True,
        email_frequency="daily",
    )
    assert notifs.job_alerts is True
    assert notifs.email_frequency == "daily"


def test_privacy_settings_defaults():
    privacy = PrivacySettings()
    assert privacy.camera_permission == "ask"
    assert privacy.microphone_permission == "ask"
    assert privacy.recording_retention_days == 0
    assert privacy.resume_processing_consent is False
    assert privacy.job_recommendation_consent is False
    assert privacy.profile_visibility == "private"


def test_privacy_settings_retention_bounds():
    with pytest.raises(ValidationError):
        PrivacySettings(recording_retention_days=-1)

    with pytest.raises(ValidationError):
        PrivacySettings(recording_retention_days=400)

    valid = PrivacySettings(recording_retention_days=90)
    assert valid.recording_retention_days == 90


def test_preferences_update_schema():
    prefs = PreferencesUpdate(
        target_roles=["Frontend Engineer", "Full Stack Engineer"],
        preferred_industries=["Technology"],
        preferred_locations=["Remote", "Pune"],
        work_modes=["remote", "hybrid"],
        employment_types=["full_time"],
        notice_period_days=30,
        willing_to_relocate=True,
        work_authorization="citizen",
        salary_min=1200000.0,
        salary_currency="INR",
    )
    assert prefs.notice_period_days == 30
    assert prefs.willing_to_relocate is True
    assert prefs.salary_currency == "INR"


def test_preferences_currency_validation():
    with pytest.raises(ValidationError):
        PreferencesUpdate(salary_currency="INVALID")

    valid = PreferencesUpdate(salary_currency="USD")
    assert valid.salary_currency == "USD"


def test_account_delete_schema():
    req = AccountDeleteRequest(confirmation="DELETE MY ACCOUNT", email="test@example.com")
    assert req.confirmation == "DELETE MY ACCOUNT"
    assert req.email == "test@example.com"


def test_username_change_schema():
    change = UsernameChange(username="valid_name_123")
    assert change.username == "valid_name_123"


def test_settings_routes_registered():
    from app.api.router import router

    paths = {getattr(route, "path", None) for route in router.routes}
    assert "/settings" in paths
    assert "/settings/notifications" in paths
    assert "/settings/privacy" in paths
    assert "/settings/career-preferences" in paths
    assert "/account" in paths

