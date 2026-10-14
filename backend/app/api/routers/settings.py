"""Notification, privacy, career preferences, and account deletion."""
import logging

from fastapi import APIRouter, Body, Depends, Header

from app.api.routers.profile import update_preferences
from app.api.schemas import (
    AccountDeleteRequest,
    NotificationSettings,
    PreferencesUpdate,
    PrivacySettings,
)
from app.api.support import (
    ensure_preference_row,
)
from app.core.config import Settings, get_settings
from app.core.errors import ApiError
from app.database.client import database_client
from app.database.repository import (
    client_for,
)
from app.features.auth.account_deletion import (
    CONFIRM_PHRASE,
    assert_user_erased,
    collect_user_storage_paths,
    confirmation_is_valid,
    delete_supabase_auth_user,
    delete_user_owned_records,
    email_matches_account,
    lookup_supabase_auth_ids,
    purge_user_storage,
)
from app.features.auth.service import (
    CurrentUser,
    get_current_user,
)

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/settings")
def get_settings_records(
    user: CurrentUser = Depends(get_current_user), settings: Settings = Depends(get_settings)
):
    client = client_for(settings, user)
    return {
        "notifications": ensure_preference_row(client, "notification_preferences", str(user.id)),
        "privacy": ensure_preference_row(client, "privacy_preferences", str(user.id)),
        "career_preferences": ensure_preference_row(client, "candidate_preferences", str(user.id)),
    }


@router.get("/settings/notifications")
def get_notifications_settings(
    user: CurrentUser = Depends(get_current_user), settings: Settings = Depends(get_settings)
):
    client = client_for(settings, user)
    return ensure_preference_row(client, "notification_preferences", str(user.id))


@router.put("/settings/notifications")
def update_notifications(
    payload: NotificationSettings,
    user: CurrentUser = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
):
    client = client_for(settings, user)
    result = client.table("notification_preferences").upsert(
        {"user_id": str(user.id), **payload.model_dump()}
    ).execute().data or []
    if not result:
        raise ApiError(500, "notifications_save_failed", "Notification settings could not be saved.")
    return result[0]


@router.get("/settings/privacy")
def get_privacy_settings(
    user: CurrentUser = Depends(get_current_user), settings: Settings = Depends(get_settings)
):
    client = client_for(settings, user)
    return ensure_preference_row(client, "privacy_preferences", str(user.id))


@router.put("/settings/privacy")
def update_privacy(
    payload: PrivacySettings,
    user: CurrentUser = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
):
    client = client_for(settings, user)
    result = client.table("privacy_preferences").upsert(
        {"user_id": str(user.id), **payload.model_dump()}
    ).execute().data or []
    if not result:
        raise ApiError(500, "privacy_save_failed", "Privacy settings could not be saved.")
    return result[0]


@router.get("/settings/career-preferences")
def get_career_preferences_settings(
    user: CurrentUser = Depends(get_current_user), settings: Settings = Depends(get_settings)
):
    client = client_for(settings, user)
    return ensure_preference_row(client, "candidate_preferences", str(user.id))


@router.put("/settings/career-preferences")
def update_settings_career_preferences(
    payload: PreferencesUpdate,
    user: CurrentUser = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
):
    return update_preferences(payload=payload, user=user, settings=settings)



@router.delete("/account", status_code=204)
def delete_account(
    payload: AccountDeleteRequest | None = Body(default=None),
    x_confirm_delete: str | None = Header(default=None),
    user: CurrentUser = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
):
    """
    Permanently delete the signed-in candidate account and all owned data.

    Confirmation (required): body.confirmation or header X-Confirm-Delete must equal
    "DELETE MY ACCOUNT". Body email must match the account email.
    """
    if payload is None:
        raise ApiError(
            400,
            "account_deletion_confirmation_required",
            f"Explicit confirmation and account email are required. Type exactly: {CONFIRM_PHRASE}",
        )
    confirmation = payload.confirmation or x_confirm_delete
    if not confirmation_is_valid(confirmation):
        raise ApiError(
            400,
            "account_deletion_confirmation_required",
            f"Explicit confirmation is required. Type exactly: {CONFIRM_PHRASE}",
        )
    if not email_matches_account(payload.email, user.email):
        raise ApiError(
            400,
            "account_deletion_email_mismatch",
            "The email does not match this signed-in account.",
        )

    user_client = client_for(settings, user)
    storage_paths = collect_user_storage_paths(user_client, user)

    supabase_uid = ""
    account_email = user.email
    try:
        user_rows = (
            user_client.table("users")
            .select("supabase_uid,email")
            .eq("id", str(user.id))
            .limit(1)
            .execute()
            .data
            or []
        )
        if user_rows:
            supabase_uid = str(user_rows[0].get("supabase_uid") or "").strip()
            account_email = account_email or str(user_rows[0].get("email") or "").strip()
    except Exception as exc:
        logger.exception("account_delete_identity_lookup_failed user_id=%s", user.id)
        raise ApiError(
            500,
            "account_deletion_incomplete",
            "The linked identity could not be verified. No local data was removed.",
        ) from exc

    admin = database_client(settings)

    # Fail closed: do not erase database identity while storage blobs may remain.
    try:
        purge_user_storage(admin, settings, user, storage_paths)
    except Exception as exc:
        logger.exception("account_delete_storage_purge_failed user_id=%s", user.id)
        raise ApiError(
            500,
            "account_deletion_incomplete",
            "Could not remove all stored account files. Account deletion stopped so data stays consistent.",
        ) from exc

    # Child rows first so a later retry can still authenticate.
    delete_user_owned_records(admin, user)

    auth_ids = lookup_supabase_auth_ids(
        settings, supabase_uid=supabase_uid, email=account_email or payload.email
    )
    if auth_ids and not (settings.resolved_supabase_url and settings.supabase_server_key):
        raise ApiError(
            500,
            "account_deletion_incomplete",
            "The Supabase identity could not be deleted because server credentials are missing.",
        )
    for auth_id in auth_ids:
        try:
            delete_supabase_auth_user(settings, auth_id)
        except Exception as exc:
            logger.exception("account_delete_supabase_auth_failed user_id=%s", user.id)
            raise ApiError(
                500,
                "account_deletion_incomplete",
                "The sign-in identity could not be deleted. Please retry.",
            ) from exc

    try:
        admin.table("users").delete().eq("id", str(user.id)).execute()
    except Exception as exc:
        raise ApiError(
            500,
            "account_deletion_failed",
            "The account could not be deleted from the local database.",
        ) from exc

    try:
        assert_user_erased(admin, str(user.id))
    except ApiError:
        delete_user_owned_records(admin, user)
        try:
            admin.table("users").delete().eq("id", str(user.id)).execute()
        except Exception:
            pass
        assert_user_erased(admin, str(user.id))

