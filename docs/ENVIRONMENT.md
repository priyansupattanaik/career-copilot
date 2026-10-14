# Environment Variables Reference

This document catalogs every environment variable recognized by Career Copilot, where it is read, whether it is required, and where it must be set.

> **Security Notice**: No secrets or credential values are stored in this document or committed to git. All secret variables must only be configured in deployment provider environment dashboards (Render / Vercel) or local uncommitted `.env` files.

---

## Frontend Variables (Vercel / Local)

Only variables prefixed with `VITE_` are exposed in browser bundles. They are read **exclusively** in `frontend/src/shared/config/env.ts`.

| Variable Name | Required | Where to Set | Description |
|:---|:---|:---|:---|
| `VITE_SUPABASE_URL` | Yes (Prod) | Vercel, Local `.env` | Project URL from Supabase Dashboard -> Settings -> API. |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Yes (Prod) | Vercel, Local `.env` | Browser publishable or anon key from Supabase Dashboard. |
| `VITE_SUPABASE_ANON_KEY` | Optional | Vercel, Local `.env` | Backward-compatible alias for publishable key. |
| `VITE_PUBLIC_APP_ORIGIN` | Yes (Prod) | Vercel, Local `.env` | Canonical public origin of the frontend (e.g. `https://careercopilotai.vercel.app`). |
| `VITE_API_BASE_URL` | Optional | Vercel, Local `.env` | Upstream Render API URL (e.g. `https://career-copilot-api.onrender.com`). If unset, local Vite proxy `/api/backend` is used. |
| `VITE_API_V1_PREFIX` | Optional | Vercel, Local `.env` | API version prefix (defaults to `/api/v1`). |

---

## Backend Variables (Render / Local)

Backend variables are read and validated **exclusively** in `backend/app/core/config.py` using Pydantic Settings.

| Variable Name | Required | Where to Set | Description |
|:---|:---|:---|:---|
| `APP_NAME` | Yes | Render, Local `.env` | Service display name returned in health and diagnostics. |
| `APP_ENV` | Yes | Render, Local `.env` | Execution environment (`development`, `production`, `test`). |
| `API_V1_PREFIX` | Yes | Render, Local `.env` | Route prefix for all product endpoints (default `/api/v1`). |
| `PUBLIC_API_BASE_URL` | Yes | Render, Local `.env` | Absolute origin of the backend process (e.g. `http://127.0.0.1:8000` or Render URL). |
| `LOG_LEVEL` | Yes | Render, Local `.env` | Logging verbosity (`debug`, `info`, `warning`, `error`). |
| `FRONTEND_ORIGINS` | Yes | Render, Local `.env` | Comma-separated list or JSON array of allowed frontend CORS origins. |
| `SUPABASE_URL` | Yes | Render, Local `.env` | Supabase project REST URL (`https://<project-ref>.supabase.co`). |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Render, Local `.env` | Supabase service-role secret key for PostgREST and admin auth operations. |
| `SUPABASE_SECRET_KEY` | Optional | Render, Local `.env` | Accepted alias for service-role key. |
| `SUPABASE_PUBLISHABLE_KEY` | Optional | Render, Local `.env` | Public key copy on server for client parity. |
| `SUPABASE_STORAGE_BUCKET` | Yes | Render, Local `.env` | Root storage bucket name (default `career-copilot-files`). |
| `SUPABASE_JWKS_URL` | Optional | Render, Local `.env` | JSON Web Key Set endpoint for offline JWT verification. |
| `DOCUMENT_BUCKET` | Yes | Render, Local `.env` | Storage folder prefix for uploaded resumes (default `resumes`). |
| `AVATAR_BUCKET` | Yes | Render, Local `.env` | Storage folder prefix for profile pictures (default `avatars`). |
| `AUTH_SECRET` | Yes | Render, Local `.env` | HMAC secret for session and signed file access tokens (min 32 characters). |
| `JWT_TTL_SECONDS` | Optional | Render, Local `.env` | Lifetime in seconds for auth tokens (default `604800` = 7 days). |
| `NVIDIA_API_KEY` | Optional | Render, Local `.env` | NVIDIA NIM API key for Nemotron LLM operations. |
| `NVIDIA_BASE_URL` | Conditional | Render, Local `.env` | NVIDIA base URL (required if `NVIDIA_API_KEY` is set). |
| `NVIDIA_MODEL` | Conditional | Render, Local `.env` | Model name (required if `NVIDIA_API_KEY` is set). |
| `NVIDIA_PROMPT_VERSION` | Conditional | Render, Local `.env` | Prompt version identifier (e.g. `v1`). |
| `NVIDIA_TTS_URL` | Optional | Render, Local `.env` | NVIDIA Riva / Magpie TTS synthesis endpoint. |
| `GROQ_API_KEY` | Optional | Render, Local `.env` | Groq API key for Llama 3.3 parsing and Orpheus TTS. |
| `GROQ_BASE_URL` | Conditional | Render, Local `.env` | Groq API base URL (required if `GROQ_API_KEY` is set). |
| `GROQ_MODEL` | Conditional | Render, Local `.env` | Primary model for Groq completions. |
| `GROQ_RESUME_PARSER_ENABLED` | Optional | Render, Local `.env` | Enable fast structured resume parser (default `true`). |
| `GROQ_RESUME_PARSER_MODEL` | Conditional | Render, Local `.env` | Parser model name (`llama-3.3-70b-versatile`). |
| `GROQ_RESUME_PARSER_FALLBACK_MODEL` | Conditional | Render, Local `.env` | Fallback model name (`openai/gpt-oss-120b`). |
| `FREEHIRE_ENABLED` | Optional | Render, Local `.env` | Enable public job search sync (default `true`). |
| `FREEHIRE_API_URL` | Optional | Render, Local `.env` | FreeHire service URL (`https://freehire.me`). |
| `YOUTUBE_API_KEY` | Optional | Render, Local `.env` | Google YouTube Data API v3 key for real learning video IDs. |
| `YOUTUBE_API_BASE_URL` | Optional | Render, Local `.env` | YouTube API base (`https://www.googleapis.com/youtube/v3`). |
