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
        user = _create_user_records(
            client,
            {"id": str(uuid.uuid5(uuid.NAMESPACE_URL, f"career-copilot:{email}")), "email": email, "full_name": full_name, "password_hash": _password_hash(password), "token_version": 0, "phone": phone, "username": username},
        )
    except ApiError:
        if client.table("users").select("id").eq("email", email).limit(1).execute().data:
            raise ApiError(409, "user_already_exists", "An account with this email already exists.") from None
        raise
    return _auth_payload(user, settings)


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
    email = identifier.lower()
    rows: list[dict[str, Any]] | None = None
    lookup = "none"
    t_start = time.perf_counter()
    # Fast-path: legacy app accounts use deterministic uuid5 id; a direct doc get
    # avoids a full collection query and is measurably faster on cold Firestore
    # (measured ~0.4s vs ~3.7s for where(email==) in diagnosis).
    if identifier_uses_email_lookup(email):
        try:
            direct_id = str(uuid.uuid5(uuid.NAMESPACE_URL, f"career-copilot:{email}"))
            snap = client.db.collection("users").document(direct_id).get()
            if snap.exists:
                data = snap.to_dict() or {}
                data["id"] = snap.id
                if str(data.get("email") or "").strip().lower() == email:
                    rows = [data]
                    lookup = "direct_uuid5"
        except Exception:
            logger.debug("sign_in_direct_lookup_failed identifier=%s", email[:40])
        # Only scan the users collection by email when the identifier actually
        # looks like one. Usernames (e.g. "priyansu") used to pay a multi-second
        # Firestore where(email==) miss before the username path ran.
        if rows is None:
            q0 = time.perf_counter()
            rows = client.table("users").select("*").eq("email", email).limit(1).execute().data
            q_ms = (time.perf_counter() - q0) * 1000
            lookup = "query_email"
            if q_ms > 1000:
                logger.warning("sign_in_slow_query lookup=%s email=%s ms=%.0f", lookup, email[:40], q_ms)
    if not rows:
        phone_identifier = sanitize_signup_phone(identifier)
        if phone_identifier:
            rows = client.table("users").select("*").eq("phone", phone_identifier).limit(1).execute().data
            if rows:
                lookup = "query_phone"
    if not rows:
        try:
            username = validate_username(identifier)
        except ValueError:
            username = ""
        if username:
            profile_rows = client.table("profiles").select("id").ilike("username", username).limit(1).execute().data or []
            if profile_rows:
                rows = client.table("users").select("*").eq("id", str(profile_rows[0]["id"])).limit(1).execute().data
                if rows:
                    lookup = "query_username"
    total_ms = (time.perf_counter() - t_start) * 1000
    if total_ms > 1500:
        logger.warning("sign_in_total_slow lookup=%s identifier=%s total_ms=%.0f", lookup, identifier[:40], total_ms)
    if not rows:
        logger.info("sign_in_no_user lookup=%s identifier=%s", lookup, identifier[:40])
        raise ApiError(401, "invalid_credentials", "Email, phone, username, or password is incorrect.")
    stored_hash = str(rows[0].get("password_hash") or "")
    if not stored_hash:
        # Supabase-created accounts have empty password_hash; app password cannot
        # succeed until a local password is set. Keep 401 for security but log
        # producer detail so ops can distinguish from wrong-password.
        logger.info(
            "sign_in_empty_password_hash user_id=%s email=%s lookup=%s has_supabase_uid=%s",
            str(rows[0].get("id"))[:8],
            str(rows[0].get("email") or "")[:40],
            lookup,
            bool(str(rows[0].get("supabase_uid") or "").strip()),
        )
        raise ApiError(401, "invalid_credentials", "Email, phone, username, or password is incorrect.")
    if not _password_matches(password, stored_hash):
        logger.info("sign_in_password_mismatch user_id=%s lookup=%s", str(rows[0].get("id"))[:8], lookup)
        raise ApiError(401, "invalid_credentials", "Email, phone, username, or password is incorrect.")
    return _auth_payload(rows[0], settings)


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


@router.post("/auth/firebase")
def auth_firebase(payload: dict[str, Any] = Body(...), settings: Settings = Depends(get_settings)):
    """Exchange a verified Firebase ID token for an app JWT."""
    from firebase_admin import auth as firebase_auth

    from app.database.client import firebase_admin_app

    id_token = str(payload.get("id_token") or "").strip()
    if not id_token:
        raise ApiError(400, "invalid_firebase_token", "A Firebase ID token is required.")
    try:
        admin_app = firebase_admin_app(settings)
        decoded = firebase_auth.verify_id_token(
            id_token,
            app=admin_app,
            check_revoked=settings.effective_firebase_check_revoked,
            clock_skew_seconds=getattr(settings, "firebase_clock_skew_seconds", 10),
        )
    except ApiError:
        raise
    except RuntimeError as exc:
        # Producer is misconfigured Admin/credentials â€” not an invalid user token.
        detail = str(exc)[:200]
        raise ApiError(
            503,
            "firebase_admin_unavailable",
            f"Firebase Admin is not available: {detail}",
        ) from exc
    except Exception as exc:
        detail = f"{type(exc).__name__}: {str(exc)[:120]}"
        raise ApiError(
            401,
            "invalid_firebase_token",
            f"The Firebase session is invalid or expired ({detail}).",
        ) from exc
    email = str(decoded.get("email") or "").strip().lower()
    uid = str(decoded.get("uid") or "").strip()
    if not uid:
        raise ApiError(401, "invalid_firebase_token", "Firebase identity is missing a UID.")
    if not email or "@" not in email:
        raise ApiError(401, "firebase_email_required", "A verified Firebase email is required.")
    if decoded.get("email_verified") is not True:
        raise ApiError(
            401,
            "firebase_email_unverified",
            "Verify your email with the identity provider before signing in.",
        )
    client = database_client(settings)
    rows = client.table("users").select("*").eq("email", email).limit(1).execute().data or []
    if rows:
        user = rows[0]
        existing_fb = str(user.get("firebase_uid") or "").strip()
        if existing_fb and existing_fb != uid:
            raise ApiError(
                409,
                "firebase_uid_conflict",
                "This email is already linked to a different identity provider account.",
            )
        if not existing_fb:
            # Refuse silent link when a local password account already owns this email.
            # Otherwise an attacker can sign-up with the victim's email, then the real
            # Google owner inherits (or shares) that attacker-owned account graph.
            if str(user.get("password_hash") or "").strip():
                raise ApiError(
                    409,
                    "account_exists_password",
                    "An account with this email already exists. Sign in with email and password.",
                )
            client.table("users").update({"firebase_uid": uid}).eq("id", str(user["id"])).execute()
            user["firebase_uid"] = uid
        _sync_profile_identity(
            client,
            str(user["id"]),
            full_name=str(decoded.get("name") or "").strip() or None,
            phone=sanitize_signup_phone(decoded.get("phone")),
            username=str(decoded.get("username") or "").strip() or None,
        )
    else:
        user_id = str(uuid.uuid4())
        full_name = str(decoded.get("name") or "").strip()[:120] or None
        user = _create_user_records(
            client,
            {
                "id": user_id,
                "email": email,
                "full_name": full_name,
                "firebase_uid": uid,
                "password_hash": "",
            },
        )
    return _auth_payload(user, settings)


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
    client = database_client(settings)
    rows: list[dict[str, Any]] | None = None
    t0 = time.perf_counter()
    # Fast-path: Supabase-created accounts use supabase_uid as document id
    try:
        snap = client.db.collection("users").document(supabase_uid).get()
        if snap.exists:
            data = snap.to_dict() or {}
            data["id"] = snap.id
            if str(data.get("email") or "").strip().lower() == email:
                rows = [data]
    except Exception:
        logger.debug("supabase_direct_lookup_failed uid=%s", supabase_uid[:8])
    if rows is None:
        # Legacy fallback: deterministic uuid5 for app-created accounts
        try:
            direct_id = str(uuid.uuid5(uuid.NAMESPACE_URL, f"career-copilot:{email}"))
            snap = client.db.collection("users").document(direct_id).get()
            if snap.exists:
                data = snap.to_dict() or {}
                data["id"] = snap.id
                if str(data.get("email") or "").strip().lower() == email:
                    rows = [data]
        except Exception:
            pass
    if rows is None:
        q0 = time.perf_counter()
        rows = client.table("users").select("*").eq("email", email).limit(1).execute().data or []
        q_ms = (time.perf_counter() - q0) * 1000
        if q_ms > 1000:
            logger.warning("supabase_query_slow email=%s ms=%.0f", email[:40], q_ms)
    else:
        # rows already from direct lookup
        pass
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
    # (stolen JWT alone must not lock out the owner). Firebase-only accounts (empty
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
