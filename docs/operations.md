# Operations

**Canonical:** [DOCUMENTATION.md](./DOCUMENTATION.md) — *Configuration* and *Operations*.

## Prerequisites

- Node.js 20+  
- Python 3.11–3.13  
- Supabase project (PostgreSQL Database + Auth + Storage bucket)  

## Setup

`ash
cp .env.example .env   # Windows: copy .env.example .env
# Fill AUTH_SECRET, SUPABASE_*, VITE_SUPABASE_*
npm run setup
npm run dev
`

| Service | URL |
|---------|-----|
| App | http://127.0.0.1:3000 |
| API | http://127.0.0.1:8000 |
| OpenAPI (dev) | http://127.0.0.1:8000/docs |

There is **no** Celery worker process. All product work is synchronous request/response inside FastAPI (with timeouts and fallbacks).

## Useful scripts

| Command | Purpose |
|---------|---------|
| 
pm run dev | Preflight + FE + BE |
| 
pm run check:env | Required env keys |
| 
pm run check:secrets | Secret scan |
| 
pm run test:backend | pytest |
| 
pm run supabase:check | Supabase DB/Storage verification |
| cd frontend && npm run test | Vitest |
| scripts/diagnostics/* | API/Supabase/connection audits |

## Health endpoints

| Path | Meaning |
|------|---------|
| GET /api/v1/health/live | Process up (no network probes) |
| GET /api/v1/health | Agents + bounded DB/storage probes |
| GET /api/v1/health/database | Deeper dependency probe |
| GET /api/v1/agents/status | Agent inventory |

## Production checklist

1. Strong AUTH_SECRET, restricted FRONTEND_ORIGINS.  
2. APP_ENV=production (docs disabled).  
3. Proxy /api/backend (or build with VITE_API_BASE_URL) **and** /api/files → API /api/v1/files.  
4. Supabase tables created from docs/database/supabase-schema.sql with RLS enabled.  
5. Supabase storage bucket private; only service role on server.  
6. Supabase URL and secret keys configured (SUPABASE_URL, SUPABASE_SECRET_KEY).  
7. Email/Password and Google OAuth providers enabled in Supabase, with Vercel and local hostnames in Supabase Redirect URLs.  
8. Vercel was rebuilt after changing any VITE_* value; those values are embedded at build time.  

The full split-host Vercel/Render procedure is in deployment.md.

## Troubleshooting

| Symptom | Check |
|---------|-------|
| Bootstrap empty / — | API health, JWT, CORS origin |
| File/avatar 404 | /api/files rewrite present on page origin |
| Storage / DB 503 | Supabase env keys configured (SUPABASE_URL, SUPABASE_SECRET_KEY) |
| LLM features weak | GROQ_* / NVIDIA_* / LLM_PROVIDER |
| Demo data | Clear career_copilot_demo cookie |
