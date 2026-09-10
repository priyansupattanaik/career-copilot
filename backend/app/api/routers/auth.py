import hashlib
import hmac
import logging
import re
import secrets
import uuid
from typing import Any
from uuid import UUID

import httpx
from fastapi import APIRouter, Body, Depends, Request, Response

from app.core.config import Settings, get_settings
from app.core.constants import MIN_PASSWORD_LENGTH
from app.core.errors import ApiError
from app.database.client import database_client
from app.features.auth.service import CurrentUser, create_access_token, get_current_user
from app.features.auth.username import validate_username

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Auth"])


def identifier_uses_email_lookup(identifier: str) -> bool:
    """Email collection scans are only worth it when the identifier has an @."""
    return "@" in (identifier or "").strip()


def _password_hash(password: str, salt: bytes | None = None) -> str:
    salt = salt or secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, n=2**14, r=8, p=1)
    return f"scrypt${salt.hex()}${digest.hex()}"


def _password_matches(password: str, stored: str) -> bool:
    try:
        _, salt_hex, digest_hex = stored.split("$", 2)
        actual = hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt_hex), n=2**14, r=8, p=1)
        return hmac.compare_digest(actual.hex(), digest_hex)
    except (ValueError, TypeError):
        return False


def _parse_uuid(value: Any) -> str | None:
    raw = str(value or "").strip()
    if not raw:
        return None
    try:
        return str(UUID(raw))
    except ValueError:
        return None


def _supabase_admin_headers(settings: Settings) -> dict[str, str] | None:
    key = settings.supabase_server_key
    if not settings.resolved_supabase_url or not key:
        return None
    return {"apikey": key, "Authorization": f"Bearer {key}"}


def _supabase_email_is_confirmed(settings: Settings, *, email: str, supabase_uid: str) -> bool:
    """True when GoTrue confirmed the email, or when there is no Auth user to confirm."""
    headers = _supabase_admin_headers(settings)
    base_url = settings.resolved_supabase_url
    if not headers or not base_url:
        return True
    uid = _parse_uuid(supabase_uid)
    try:
        if uid:
            response = httpx.get(f"{base_url}/auth/v1/admin/users/{uid}", headers=headers, timeout=15)
            if response.status_code == 200:
                identity = response.json()
                if isinstance(identity, dict):
                    return bool(identity.get("email_confirmed_at") or identity.get("confirmed_at"))
        email_clean = email.strip().lower()
        if not email_clean:
            return not bool(uid)
        response = httpx.get(
            f"{base_url}/auth/v1/admin/users",
            headers=headers,
            params={"page": 1, "per_page": 200, "email": email_clean},
            timeout=20,
        )
        if response.status_code >= 400:
            logger.warning("sign_in_confirm_lookup_failed status=%s", response.status_code)
            return not bool(uid)
        payload = response.json() or {}
        users = payload.get("users") if isinstance(payload, dict) else payload
        if not isinstance(users, list):
            return not bool(uid)
        for row in users:
            if not isinstance(row, dict):
                continue
            if str(row.get("email") or "").strip().lower() != email_clean:
                continue
            return bool(row.get("email_confirmed_at") or row.get("confirmed_at"))
    except httpx.HTTPError:
        logger.warning("sign_in_confirm_lookup_unreachable email=%s", email[:40])
        return not bool(uid)
    return not bool(uid)


def _supabase_password_identity(email: str, password: str, settings: Settings) -> dict[str, Any] | None:
    """Return the GoTrue user when this email/password is valid. None otherwise."""
    base_url = settings.resolved_supabase_url
    api_key = settings.supabase_publishable_key or settings.supabase_server_key
    if not base_url or not api_key or "@" not in email or not password:
        return None
    try:
        response = httpx.post(
            f"{base_url}/auth/v1/token?grant_type=password",
            headers={
                "apikey": api_key,
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={"email": email, "password": password},
            timeout=15,
        )
    except httpx.HTTPError:
        logger.warning("sign_in_supabase_password_unreachable email=%s", email[:40])
        return None
    if response.status_code != 200:
        return None
    try:
        payload = response.json()
    except ValueError:
        return None
    identity = payload.get("user") if isinstance(payload, dict) else None
    if not isinstance(identity, dict):
        return None
    granted_email = str(identity.get("email") or "").strip().lower()
    if granted_email != email.strip().lower():
        return None
    return identity


def _find_user_for_sign_in(client, identifier: str) -> tuple[list[dict[str, Any]], str]:
    email = identifier.lower()
    if identifier_uses_email_lookup(email):
        rows = client.table("users").select("*").eq("email", email).limit(1).execute().data or []
        if rows:
            return rows, "query_email"
    phone_identifier = sanitize_signup_phone(identifier)
    if phone_identifier:
        rows = client.table("users").select("*").eq("phone", phone_identifier).limit(1).execute().data or []
        if rows:
            return rows, "query_phone"
    try:
        username = validate_username(identifier)
    except ValueError:
        username = ""
    if not username:
        return [], "none"
    profile_rows = client.table("profiles").select("id").eq("username", username).limit(1).execute().data or []
    if profile_rows:
        rows = client.table("users").select("*").eq("id", str(profile_rows[0]["id"])).limit(1).execute().data or []
        if rows:
            return rows, "query_username"
    rows = client.table("users").select("*").eq("username", username).limit(1).execute().data or []
    if rows:
        return rows, "query_users_username"
    return [], "none"


def _auth_payload(user: dict[str, Any], settings: Settings) -> dict[str, Any]:
    token = create_access_token(
        UUID(str(user["id"])), str(user["email"]), settings, int(user.get("token_version") or 0)
    )
    return {"access_token": token, "token_type": "bearer", "user": {"id": str(user["id"]), "email": user["email"], "full_name": user.get("full_name")}}


def _create_user_records(client, user: dict[str, Any]) -> dict[str, Any]:
    """Create the user graph with compensating cleanup if a child write fails."""
    user_id = str(user["id"])
    created_children: list[str] = []
    user_created = False
    try:
        created = client.table("users").insert(user).execute().data or []
        if not created:
            raise RuntimeError("The users record was not created")
        user_created = True
        for table, row in (
            ("profiles", {"id": user_id, "full_name": user.get("full_name") or "", **({"phone": user["phone"]} if user.get("phone") else {}), **({"username": user["username"]} if user.get("username") else {})}),
            ("candidate_preferences", {"user_id": user_id}),
            ("notification_preferences", {"user_id": user_id}),
            ("privacy_preferences", {"user_id": user_id}),
        ):
            created_children.append(table)
            client.table(table).insert(row).execute()
        return created[0]
    except Exception as exc:
        for table in reversed(created_children):
            try:
                key = "id" if table == "profiles" else "user_id"
                client.table(table).delete().eq(key, user_id).execute()
            except Exception:
                logger.exception("signup_rollback_failed table=%s user_id=%s", table, user_id)
        if user_created:
            try:
                client.table("users").delete().eq("id", user_id).execute()
            except Exception:
                logger.exception("signup_rollback_failed table=users user_id=%s", user_id)
        raise ApiError(500, "account_creation_incomplete", "The account could not be created completely.") from exc


def _supabase_user(access_token: str, settings: Settings) -> dict[str, Any]:
    base_url = settings.resolved_supabase_url
    api_key = settings.supabase_publishable_key or settings.supabase_server_key
    if not base_url or not api_key:
        raise ApiError(503, "supabase_auth_unavailable", "Supabase authentication is not configured.")
    try:
        response = httpx.get(
            f"{base_url}/auth/v1/user",
            headers={"apikey": api_key, "Authorization": f"Bearer {access_token}"},
            timeout=15,
        )
    except httpx.HTTPError as exc:
        raise ApiError(503, "supabase_auth_unavailable", "Supabase authentication could not be reached.") from exc
    if response.status_code != 200:
        raise ApiError(401, "invalid_supabase_token", "The Supabase session is invalid or expired.")
    try:
        user = response.json()
    except ValueError as exc:
        raise ApiError(401, "invalid_supabase_token", "Supabase returned an invalid identity response.") from exc
    if not isinstance(user, dict) or not user.get("id") or not user.get("email"):
        raise ApiError(401, "invalid_supabase_identity", "The Supabase identity is incomplete.")
    return user


_PHONE_ALLOWED = re.compile(r"^[\d\s()+\-]{6,20}$")


def sanitize_signup_phone(value: Any) -> str | None:
    """Normalize an optional signup phone to a compact E.164-ish string.

    Accepts digits with optional +, spaces, dashes and parentheses. Returns
    None when absent or malformed so a bad value never blocks account creation.
    """
    raw = str(value or "").strip()
    if not raw:
        return None
    compact = re.sub(r"[\s()\-]", "", raw)
    if not _PHONE_ALLOWED.match(raw) or not re.fullmatch(r"\+?\d{6,15}", compact):
        return None
    if not compact.startswith("+"):
        compact = f"+{compact}"
    return compact[:20]


@router.post("/auth/sign-up", status_code=201)
def auth_sign_up(payload: dict[str, Any] = Body(...), settings: Settings = Depends(get_settings)):
    email = str(payload.get("email") or "").strip().lower()
    password = str(payload.get("password") or "")
    full_name = str(payload.get("full_name") or "").strip()[:120] or None
    phone = sanitize_signup_phone(payload.get("phone"))
    username = None
    if payload.get("username"):
        try:
            username = validate_username(str(payload.get("username")))
        except ValueError as exc:
            raise ApiError(400, "invalid_username", str(exc)) from None
    if "@" not in email or len(password) < MIN_PASSWORD_LENGTH:
        raise ApiError(
            400,
            "invalid_signup",
            f"Enter a valid email and a password with at least {MIN_PASSWORD_LENGTH} characters.",
        )
    client = database_client(settings)
    if client.table("users").select("id").eq("email", email).limit(1).execute().data:
        raise ApiError(409, "user_already_exists", "An account with this email already exists.")
    # A stable document id makes the email identity collision-safe across
    # concurrent workers; the preflight lookup remains a fast user-facing path.
    try:
        if username and client.table("profiles").select("id").ilike("username", username).limit(1).execute().data:
            raise ApiError(409, "username_taken", "That username is already taken.")
        record = {
            "id": str(uuid.uuid5(uuid.NAMESPACE_URL, f"career-copilot:{email}")),
            "email": email,
            "full_name": full_name,
            "password_hash": _password_hash(password),
            "token_version": 0,
            "phone": phone,
            "username": username,
        }
        supabase_uid = _parse_uuid(payload.get("supabase_uid"))
        if supabase_uid:
            record["supabase_uid"] = supabase_uid
        user = _create_user_records(client, record)
    except ApiError:
        if client.table("users").select("id").eq("email", email).limit(1).execute().data:
            raise ApiError(409, "user_already_exists", "An account with this email already exists.") from None
        raise
    return {
        "email_confirmation_required": True,
        "user": {
            "id": str(user["id"]),
            "email": user.get("email"),
            "full_name": user.get("full_name"),
        },
    }


def _sync_profile_identity(client, user_id: str, *, full_name: str | None, phone: str | None, username: str | None) -> None:
    values: dict[str, Any] = {}
    if full_name:
        values["full_name"] = full_name[:120]
    if phone:
        values["phone"] = phone
    if username:
        try:
            candidate = validate_username(username)
        except ValueError:
            candidate = ""
        if candidate and not client.table("profiles").select("id").ilike("username", candidate).limit(1).execute().data:
            values["username"] = candidate
    if values:
        client.table("profiles").update(values).eq("id", user_id).execute()


@router.post("/auth/sign-in")
def auth_sign_in(payload: dict[str, Any] = Body(...), settings: Settings = Depends(get_settings)):
    import time

    identifier = str(payload.get("identifier") or payload.get("email") or "").strip()
    password = str(payload.get("password") or "")
    client = database_client(settings)
    t_start = time.perf_counter()
    rows, lookup = _find_user_for_sign_in(client, identifier)
    total_ms = (time.perf_counter() - t_start) * 1000
    if total_ms > 1500:
        logger.warning("sign_in_total_slow lookup=%s identifier=%s total_ms=%.0f", lookup, identifier[:40], total_ms)
    if not rows:
        logger.info("sign_in_no_user lookup=%s identifier=%s", lookup, identifier[:40])
        raise ApiError(401, "invalid_credentials", "Email, phone, username, or password is incorrect.")
    user = rows[0]
    stored_hash = str(user.get("password_hash") or "")
    email = str(user.get("email") or "").strip().lower()
    authenticated = bool(stored_hash and _password_matches(password, stored_hash))
    if not authenticated and not stored_hash:
        identity = _supabase_password_identity(email, password, settings)
        granted_uid = str((identity or {}).get("id") or "").strip()
        existing_uid = str(user.get("supabase_uid") or "").strip()
        if identity and (not existing_uid or existing_uid == granted_uid):
            digest = _password_hash(password)
            patch: dict[str, Any] = {"password_hash": digest}
            if granted_uid and not existing_uid:
                patch["supabase_uid"] = granted_uid
            client.table("users").update(patch).eq("id", str(user["id"])).execute()
            user.update(patch)
            authenticated = True
    if not authenticated:
        if not stored_hash:
            logger.info(
                "sign_in_empty_password_hash user_id=%s email=%s lookup=%s has_supabase_uid=%s",
                str(user.get("id"))[:8],
                email[:40],
                lookup,
                bool(str(user.get("supabase_uid") or "").strip()),
            )
        else:
            logger.info("sign_in_password_mismatch user_id=%s lookup=%s", str(user.get("id"))[:8], lookup)
        raise ApiError(401, "invalid_credentials", "Email, phone, username, or password is incorrect.")
    if str(user.get("auth_provider") or "email") != "google":
        if not _supabase_email_is_confirmed(
            settings,
            email=email,
            supabase_uid=str(user.get("supabase_uid") or ""),
        ):
            raise ApiError(
                403,
                "email_not_confirmed",
                "Your email is not verified yet. Open the verification link from your inbox, then try signing in again.",
            )
    return _auth_payload(user, settings)


@router.post("/auth/session")
def auth_session(user: CurrentUser = Depends(get_current_user)):
    return {
        "user": {
            "id": str(user.id),
            "email": user.email,
            "full_name": user.full_name,
            "auth_provider": user.auth_provider,
        }
    }


@router.post("/auth/sign-out", status_code=204)
def auth_sign_out(request: Request, response: Response):
    response.delete_cookie(
        "career_copilot_session",
        path="/",
        secure=request.url.scheme == "https",
        httponly=True,
        samesite="lax",
    )




@router.post("/auth/supabase")
def auth_supabase(payload: dict[str, Any] = Body(...), settings: Settings = Depends(get_settings)):
    """Exchange a verified Supabase Auth access token for the app JWT."""
    import time

    access_token = str(payload.get("access_token") or "").strip()
    if not access_token:
        raise ApiError(400, "invalid_supabase_token", "A Supabase access token is required.")
    identity = _supabase_user(access_token, settings)
    supabase_uid = str(identity["id"]).strip()
    email = str(identity["email"]).strip().lower()
    providers: list[str] = []
    metadata = identity.get("app_metadata") if isinstance(identity.get("app_metadata"), dict) else {}
    raw_providers = metadata.get("providers")
    if isinstance(raw_providers, list):
        providers = [str(item) for item in raw_providers]
    identities = identity.get("identities") if isinstance(identity.get("identities"), list) else []
    for item in identities:
        if isinstance(item, dict) and item.get("provider"):
            providers.append(str(item["provider"]))
    if "google" not in providers:
        confirmed = bool(identity.get("email_confirmed_at") or identity.get("confirmed_at"))
        if not confirmed:
            raise ApiError(
                403,
                "email_not_confirmed",
                "Your email is not verified yet. Open the verification link from your inbox, then try signing in again.",
            )
    client = database_client(settings)
    rows: list[dict[str, Any]] | None = None
    t0 = time.perf_counter()
    q0 = time.perf_counter()
    rows = client.table("users").select("*").eq("supabase_uid", supabase_uid).limit(1).execute().data or []
    if not rows and email:
        rows = client.table("users").select("*").eq("email", email).limit(1).execute().data or []
    q_ms = (time.perf_counter() - q0) * 1000
    if q_ms > 1000:
        logger.warning("supabase_query_slow email=%s ms=%.0f", email[:40], q_ms)
    if (time.perf_counter() - t0) * 1000 > 1500:
        logger.warning("supabase_lookup_slow email=%s total_ms=%.0f", email[:40], (time.perf_counter() - t0) * 1000)
    if rows:
        user = rows[0]
        existing_uid = str(user.get("supabase_uid") or "").strip()
        if existing_uid and existing_uid != supabase_uid:
            raise ApiError(409, "supabase_uid_conflict", "This email is already linked to a different Supabase account.")
        if not existing_uid:
            client.table("users").update({"supabase_uid": supabase_uid}).eq("id", str(user["id"])).execute()
            user["supabase_uid"] = supabase_uid
        metadata = identity.get("user_metadata") if isinstance(identity.get("user_metadata"), dict) else {}
        _sync_profile_identity(
            client,
            str(user["id"]),
            full_name=str(metadata.get("full_name") or metadata.get("name") or "").strip() or None,
            phone=sanitize_signup_phone(metadata.get("phone")),
            username=str(metadata.get("username") or "").strip() or None,
        )
    else:
        metadata = identity.get("user_metadata") if isinstance(identity.get("user_metadata"), dict) else {}
        full_name = str(metadata.get("full_name") or metadata.get("name") or "").strip()[:120] or None
        try:
            user_id = str(UUID(supabase_uid))
        except ValueError:
            user_id = str(uuid.uuid4())
        metadata_phone = sanitize_signup_phone((metadata or {}).get("phone"))
        metadata_username = None
        if metadata.get("username"):
            try:
                metadata_username = validate_username(str(metadata["username"]))
            except ValueError:
                metadata_username = None
        user = _create_user_records(
            client,
            {"id": user_id, "email": email, "full_name": full_name, "supabase_uid": supabase_uid, "password_hash": "", "phone": metadata_phone, "username": metadata_username},
        )
    return _auth_payload(user, settings)


@router.post("/auth/confirm-email")
def auth_confirm_email(payload: dict[str, Any] = Body(...), settings: Settings = Depends(get_settings)):
    """Mark a signup as verified after the email link is opened. Does not sign the user in."""
    access_token = str(payload.get("access_token") or "").strip()
    if not access_token:
        raise ApiError(400, "invalid_supabase_token", "A confirmation session is required.")
    identity = _supabase_user(access_token, settings)
    confirmed = bool(identity.get("email_confirmed_at") or identity.get("confirmed_at"))
    if not confirmed:
        headers = _supabase_admin_headers(settings)
        uid = str(identity.get("id") or "").strip()
        if headers and settings.resolved_supabase_url and uid:
            try:
                admin = httpx.get(
                    f"{settings.resolved_supabase_url}/auth/v1/admin/users/{uid}",
                    headers=headers,
                    timeout=15,
                )
                if admin.status_code == 200:
                    body = admin.json()
                    if isinstance(body, dict):
                        confirmed = bool(body.get("email_confirmed_at") or body.get("confirmed_at"))
            except httpx.HTTPError:
                confirmed = False
    if not confirmed:
        raise ApiError(403, "email_not_confirmed", "The email address is not verified yet.")
    email = str(identity["email"]).strip().lower()
    supabase_uid = str(identity["id"]).strip()
    client = database_client(settings)
    rows = client.table("users").select("id,supabase_uid").eq("email", email).limit(1).execute().data or []
    if not rows:
        rows = client.table("users").select("id,supabase_uid").eq("supabase_uid", supabase_uid).limit(1).execute().data or []
    if not rows:
        metadata = identity.get("user_metadata") if isinstance(identity.get("user_metadata"), dict) else {}
        username = None
        if metadata.get("username"):
            try:
                username = validate_username(str(metadata["username"]))
            except ValueError:
                username = None
        try:
            user_id = str(UUID(supabase_uid))
        except ValueError:
            user_id = str(uuid.uuid4())
        _create_user_records(
            client,
            {
                "id": user_id,
                "email": email,
                "full_name": str(metadata.get("full_name") or metadata.get("name") or "").strip()[:120] or None,
                "supabase_uid": supabase_uid,
                "password_hash": "",
                "phone": sanitize_signup_phone(metadata.get("phone")),
                "username": username,
            },
        )
        return {"ok": True, "email": email}
    user = rows[0]
    existing_uid = str(user.get("supabase_uid") or "").strip()
    if existing_uid and existing_uid != supabase_uid:
        raise ApiError(409, "supabase_uid_conflict", "This email is already linked to a different account.")
    if not existing_uid:
        client.table("users").update({"supabase_uid": supabase_uid}).eq("id", str(user["id"])).execute()
    return {"ok": True, "email": email}


@router.post("/auth/resend")
def auth_resend():
    raise ApiError(
        503,
        "email_delivery_not_configured",
        (
            "Verification emails are delivered by Supabase. If messages do not arrive, "
            "resend from the app or configure custom SMTP under Supabase Dashboard "
            "-> Authentication -> SMTP."
        ),
    )


@router.post("/auth/reset-password")
def auth_reset_password():
    raise ApiError(
        503,
        "email_delivery_not_configured",
        "Password recovery email is not configured. Sign in and change your password from Account settings.",
    )


@router.post("/auth/update-password")
def auth_update_password(payload: dict[str, Any] = Body(...), user: CurrentUser = Depends(get_current_user), settings: Settings = Depends(get_settings)):
    password = str(payload.get("password") or "")
    current_password = str(payload.get("current_password") or payload.get("old_password") or "")
    if len(password) < MIN_PASSWORD_LENGTH:
        raise ApiError(
            400,
            "invalid_password",
            f"Password must contain at least {MIN_PASSWORD_LENGTH} characters.",
        )
    client = database_client(settings)
    rows = client.table("users").select("id,password_hash,token_version,email").eq("id", str(user.id)).limit(1).execute().data or []
    if not rows:
        raise ApiError(401, "invalid_user_identity", "The authentication identity is invalid.")
    stored_hash = str(rows[0].get("password_hash") or "")
    # Password accounts must prove knowledge of the current password before rotation
    # (stolen JWT alone must not lock out the owner). Provider-only accounts (empty
    # hash) may set a password without a prior local password.
    if stored_hash:
        if not current_password or not _password_matches(current_password, stored_hash):
            raise ApiError(
                401,
                "invalid_current_password",
                "Current password is incorrect.",
            )
    next_version = int(rows[0].get("token_version") or 0) + 1
    client.table("users").update({"password_hash": _password_hash(password), "token_version": next_version}).eq("id", str(user.id)).execute()
    return {"updated": True, "access_token": create_access_token(user.id, str(rows[0].get("email") or user.email or ""), settings, next_version), "token_type": "bearer"}

