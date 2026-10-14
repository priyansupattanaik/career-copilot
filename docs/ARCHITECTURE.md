# Career Copilot Architecture Guide

This guide details the structural design, module responsibilities, data flow, and development workflows for the Career Copilot application.

---

## 1. System Overview

Career Copilot operates as a decoupled architecture tailored for free-tier cloud deployment:
- **Frontend**: Single Page Application built with React 19, TypeScript, Vite, Tailwind CSS v4, deployed to **Vercel**.
- **Backend**: Asynchronous REST API built with FastAPI, Python 3.12, Uvicorn, deployed to **Render** free tier.
- **Data & Auth**: Managed PostgreSQL, Auth, and Object Storage provided by **Supabase**.

```
[Browser Client (Vercel)]
       │  (HTTPS / REST)
       ▼
[FastAPI Backend (Render Free Tier)]
  ├── /health/live (Immediate probe)
  ├── /api/v1/ (Authenticated endpoints)
  └── Integrations: Groq, NVIDIA, FreeHire, YouTube
       │
       ▼
[Supabase (Database, Auth, Storage)]
```

---

## 2. Directory Structure

```text
career-copilot/
├── frontend/
│   ├── src/
│   │   ├── app/                # Application entry, router, and route guards
│   │   ├── features/           # Domain feature modules
│   │   │   ├── auth/           # Authentication, sign-in, session state
│   │   │   ├── community/      # Public candidate directory & search
│   │   │   ├── dashboard/      # User metrics, action items, activity feed
│   │   │   ├── interview/      # Mock interview sessions, STT/TTS, evaluation
│   │   │   ├── jobs/           # Job discovery, FreeHire sync, saved jobs
│   │   │   ├── learning/       # Curated paths, YouTube video tracking
│   │   │   ├── marketing/      # Public landing page & marketing assets
│   │   │   ├── onboarding/     # Post-signup initial setup wizard
│   │   │   ├── profile/        # Candidate resume data & public profiles
│   │   │   ├── resume/         # Resume upload, ATS scoring & suggestions
│   │   │   ├── settings/       # Account, privacy, notification preferences
│   │   │   └── workspace/      # Shell layout, navigation, workspace bootstrap
│   │   └── shared/             # Cross-feature infrastructure
│   │       ├── config/         # Environment variables (env.ts) and constants
│   │       ├── lib/            # HTTP client, TanStack Query, error classes
│   │       ├── styles/         # Global themes, CSS variables, design tokens
│   │       ├── ui/             # Reusable design system primitives (workbench.tsx)
│   │       └── utils/          # General helpers (cn, formatting, clipboard)
│   ├── package.json
│   └── vite.config.mjs
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── router.py       # Versioned router composition
│   │   │   ├── routers/        # Resource-specific route modules
│   │   │   ├── schemas.py      # Input validation schemas (Pydantic)
│   │   │   └── support.py      # Shared router helpers
│   │   ├── core/
│   │   │   ├── config.py       # Pydantic Settings & environment validation
│   │   │   └── errors.py       # ApiError exception and central handlers
│   │   ├── database/
│   │   │   ├── client.py       # Supabase PostgREST & Storage client
│   │   │   └── repository.py   # Database query abstraction
│   │   ├── features/           # Pure domain services (ATS, LLM, Interview)
│   │   └── main.py             # Server boot, CORS, middleware, health endpoints
│   └── pyproject.toml
├── docs/                       # Technical architecture & operational manuals
└── scripts/                    # Development runners, diagnostics, smoke tests
```

---

## 3. Request Lifecycle

The application enforces a strictly unidirectional request lifecycle:

```text
[User Interaction]
       │
       ▼
[React UI Component] ─── (calls custom hook or mutation)
       │
       ▼
[Feature API Function] ─── (src/features/<feature>/api.ts)
       │
       ▼
[Shared HTTP Client] ─── (src/shared/lib/client.ts)
  - Injects Bearer token
  - Enforces timeout (75s cold start / 30s subsequent)
  - Retries idempotent GETs on network failure
       │
       ▼ (HTTPS / JSON)
[FastAPI Router] ─── (app/api/routers/<resource>.py)
  - Validates request payload against Pydantic schema
  - Injects authenticated CurrentUser via Depends()
       │
       ▼
[Domain Service] ─── (app/features/<feature>/service.py)
  - Executes pure business rules, scoring, external LLM calls
       │
       ▼
[Repository Layer] ─── (app/database/client.py)
  - Executes PostgREST / Storage queries against Supabase
  - Maps database aliases and column types
       │
       ▼
[Database / Storage] ─── Supabase PostgreSQL
```

---

## 4. Error Handling Flow

1. **Backend**:
   - Handled exceptions raise `ApiError(status_code, code, message, details)`.
   - FastApi returns JSON: `{ "error": { "code": string, "message": string, "details": any, "request_id": string }, "detail": string }`.
   - Unhandled exceptions are caught by `unexpected_error_handler`, logging a full traceback with `request_id` and returning a generic 500 error without leaking internal state.
2. **Frontend**:
   - Network timeouts and failures are caught in `shared/lib/client.ts`.
   - Mapped into an `ApiError` instance.
   - User-facing UI displays userMessage; technical details are hidden in production and revealed via disclosures in dev mode.

---

## 5. Guide: How to Add a Feature

1. **Create the Feature Folder**:
   Under `frontend/src/features/<new-feature>/`, create:
   - `api.ts`: Functions that call `apiRequest()` from `@/shared/lib/client`.
   - `model/`: TypeScript interfaces and pure domain calculation functions.
   - `components/`: UI components for this feature.
   - `index.ts`: The public feature entry point exporting only what other modules need.
2. **Register Routes**:
   In `frontend/src/App.tsx`, lazy-load the feature's primary view with `React.lazy` and add the `<Route>` entry inside `<WorkspaceRoute>` or `<ProtectedRoute>`.
3. **Add Query Keys**:
   Register a new query key factory in `frontend/src/shared/lib/query-keys.ts`.

---

## 6. Guide: How to Add an Endpoint

1. **Define Request/Response Schemas**:
   Add Pydantic models in `backend/app/api/schemas.py`.
2. **Add Domain Logic**:
   Implement pure processing in `backend/app/features/<domain>/`.
3. **Create the Route Handler**:
   In `backend/app/api/routers/<resource>.py`, add the endpoint function decorated with `@router.get`, `@router.post`, etc.
   Use `user: CurrentUser = Depends(get_current_user)` for protected endpoints.
4. **Register in Router**:
   If creating a new router module, mount it in `backend/app/api/router.py`.
5. **Add Smoke Test**:
   Add a test case in `backend/tests/test_api_smoke.py` verifying status codes and response structures.
