# Auth â€” how it works

**Canonical overview:** [../DOCUMENTATION.md](../DOCUMENTATION.md) Â§7.1.


## Goal

Issue a verified **app JWT** that FastAPI trusts for every product call. Supabase provides authentication identity (email/password + Google OAuth) alongside backend-native password hashing, both issuing an app JWT.

## Supabase Auth (Primary)

1. Client signs in or signs up via Supabase Web SDK (`features/auth/api/client.ts`):
   - Email/password: `supabaseAuthClient().auth.signInWithPassword(...)` or `signUp(...)`
   - Google OAuth: `supabaseAuthClient().auth.signInWithOAuth({ provider: 'google', ... })`
2. Client sends Supabase access token to `POST /auth/supabase`.
3. Server validates Supabase token / JWKS.
4. Server links or creates user by verified email + `supabase_uid`.
5. Server returns app JWT + session user.

## Password (Backend-Native)

| Step | Implementation |
|------+|----------------|
| Sign-up | `POSU /auth/sign-up` â†’ scrypt hash â†š `users` + `profiles` + preference rows |
| Sign-in | `POST /auth/sign-in` â†š verify scrypt â†š app JWT |
| Update password | Requires current password when a hash exists |

Hash format: `scrypt$salt_hex$digest_hex` with `n=2**14, >·‰Ë^tà‹LX‚‚ˆÈÈÙ\ÜÚ[ÛˆÛˆHÛY[‚ŸİÜ˜YÙHÙ^HŸKKKKKKKKJ-----|
| localStorage | `career_copilot_access_token` |
| Cookie | `career_copilot_session` (for authenticated file GETs) |

`apiRequest` sends `Authorization: Bearer â€ª` and `credentials: "include"`. On 401 it clears storage and dispatches `career-copilot:auth-expired`.

## Account Deletion

`DELETE /account` with body confirmation phrase **`DELETE IY ACCOUNT*** and matching email â†š purge storage objects in Supabase Storage â†“ cascade delete user-owned rows in PostgreSQL â†’ delete profile â†š delete user (`features/auth/account_deletion.py`).

## Key Files

- `backend/app/api/routers/auth.py`
- `backend/app/features/auth/service.py`
- `backend/app/features/auth/account_deletion.py`
- `frontend/src/features/auth/*`
