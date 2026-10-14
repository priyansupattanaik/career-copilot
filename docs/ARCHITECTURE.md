# Architecture

Career Copilot is a Vite + React frontend and a FastAPI backend. The browser never holds database or LLM keys. Product behavior (confirmed resume text, scores, interviews, jobs) lives in feature modules. This file is the map of those modules.

## Layout

```text
frontend/src/
  features/<feature>/
    api.ts            HTTP calls for that feature
    components/       Screens
    model/            Types and pure rules, when a feature has them
  shared/
    config.ts         The only frontend module that reads import.meta.env
    api/client.ts     Authenticated fetch, demo-session switch, ApiRequestError
    api/errors.ts     Status, code, and message for a failed response
    theme.tsx         Theme state
    ui/               Controls used by more than one feature
  components/ui/      Visual treatments (ribbons, beams, icons, error panel)

backend/app/
  main.py             App, CORS, request id, exception handlers
  api/router.py       Mounts feature routers at API_V1_PREFIX
  api/routers/        One module per area (health, profile, resumes, jobs, …)
  api/support.py      Helpers shared by more than one router
  api/schemas.py      Request bodies
  core/config.py      The only backend module that reads the process environment
  core/errors.py      ApiError and the JSON error body
  features/           Domain logic (scoring, parsing, interview, learning, FreeHire client)
  database/           Supabase adapters
```

Root `scripts/design/` holds unused logo experiments. They are not imported by the app.

## Environment

One root `.env`. Backend settings are `backend/app/core/config.py` (`Settings` via pydantic-settings). Browser values are only `VITE_*`, read in `frontend/src/shared/config.ts`:

| Export | Source |
| --- | --- |
| `resolveApiBase()` | `VITE_API_BASE_URL`, else same-origin `/api/backend` |
| `supabaseUrl`, `supabasePublishableKey` | `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` |
| `vitePublicAppOrigin()` | `VITE_PUBLIC_APP_ORIGIN` |
| `isProductionBuild` | Vite `PROD` |

Feature code imports those exports. It does not read `import.meta.env` itself.

## API

`backend/app/api/router.py` includes the routers in `backend/app/api/routers/`. Each router owns its paths. Shared upload and profile helpers live in `backend/app/api/support.py` so profile and resume routes do not import each other except where settings reuses `update_preferences`.

`app/main.py` mounts that router at `settings.api_v1_prefix` and also mounts `features/ats/routes.py` for `POST /ats/score`. Resume improvement stays on `features/resume_improvement/routes.py`.

Failed requests use `ApiError` (`code`, `message`, `details`, `request_id`). The browser client turns that body into `ApiRequestError` (`status`, `code`, `message`, `requestId`). Callers still read `error.message`. Abort is not rewritten into a network error.

OpenAPI at `/docs` is the path list. `backend/tests/test_settings.py` checks that settings, account, health, jobs sync, and resumes stay registered.

## State

There is no global store library.

| State | Where |
| --- | --- |
| Theme | `shared/theme.tsx` |
| Signed-in workspace payload | `features/workspace/bootstrap-context.tsx` (`GET /me/bootstrap`) |
| Screen state | `useState` in the feature screen |
| Server calls | `features/<feature>/api.ts`, then `shared/api/client.ts` |

Some older screens still call `apiRequest` for reads (settings profile loads, resume check flow, interview session). New calls go through the feature `api.ts`.

A workspace page crash is caught by an error boundary inside the shell. The shell stays mounted. The outer boundary in `App` still catches failures outside a page.

## Naming

- Frontend features: `features/<name>/{api.ts,components,model}`.
- Backend HTTP: `api/routers/<name>.py`. Domain logic: `features/<name>/`.
- UI class helper: `shared/utils.ts` `cn`. Do not add a second `cn`.
