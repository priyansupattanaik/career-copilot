# Deployment

Career Copilot is deployed as a split application: the Vite frontend is served by Vercel and the FastAPI service runs on Render. The deployment folder contains local templates only and is intentionally excluded from Git. Keep the authoritative deployment checklist here.

## Frontend on Vercel

Configure the Vercel project with rontend as the root directory, 
pm run build as the build command, and dist as the output directory. Set these client-safe variables in both Preview and Production environments:

`	ext
VITE_API_BASE_URL=<Render backend origin>
VITE_API_V1_PREFIX=/api/v1
VITE_SUPABASE_URL=<Supabase project URL>
VITE_SUPABASE_PUBLISHABLE_KEY=<Supabase publishable key>
`

VITE_API_BASE_URL must be the backend origin only; do not append /api/v1. The frontend adds the API prefix. After changing any VITE_* value, create a new Vercel deployment because Vite embeds these values at build time.

Supabase Authentication must have Email/Password and Google OAuth enabled under Authentication -> Providers. Add the local and deployed frontend callback origins (e.g. https://careercopilotai.vercel.app, http://localhost:3000) to Supabase Authentication URL Configuration (Redirect URLs and Site URL). The frontend signs in with Supabase, exchanges the Supabase access token at POST /api/v1/auth/supabase, and receives the Career Copilot API session.

## Backend on Render

Create a Render Web Service with ackend as the root directory:

`	ext
Build Command: pip install -e .
Start Command: uvicorn app.main:app --host 0.0.0.0 --port 
Health Check Path: /api/v1/health/live
`

Required backend configuration includes:

`	ext
APP_ENV=production
API_V1_PREFIX=/api/v1
PUBLIC_API_BASE_URL=<Render backend origin>
FRONTEND_ORIGINS=https://careercopilotai.vercel.app
AUTH_SECRET=<random-secret>
SUPABASE_URL=<Supabase project URL>
SUPABASE_SECRET_KEY=<Supabase secret / service role key>
SUPABASE_SERVICE_ROLE_KEY=<Supabase service role key>
SUPABASE_STORAGE_BUCKET=career-copilot-files
`

Add AUTH_SECRET, SUPABASE_SECRET_KEY, and LLM provider keys (GROQ_API_KEY, NVIDIA_API_KEY) as Render secret environment variables. Never place secret values in frontend variables or Git. Run database migrations from docs/database/supabase-schema.sql via Supabase SQL Editor.

## Verification

Run these checks from the repository before release:

`powershell
npm.cmd run check:env
npm.cmd run supabase:check
npm.cmd run check:frontend
backend\.venv\Scripts\python.exe -m pytest
`

Then verify the deployed service with GET /api/v1/health/live, open the frontend, complete email/password sign-in, complete Google sign-in, and test an authenticated API request. A successful local build does not prove that the Vercel and Render dashboards contain the same values.

## Rollback

If a deployment fails, roll back to the previous Vercel and Render deployment pair. Do not manually mutate database data to recover from a configuration error. Correct the provider environment variables, redeploy, and repeat the verification checks.
