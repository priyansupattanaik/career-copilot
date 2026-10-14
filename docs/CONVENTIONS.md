# Codebase Conventions & Standards

This document establishes development conventions for the Career Copilot project to maintain clean architecture, maintainability, and safety across both frontend and backend codebases.

---

## 1. Naming Conventions

| Artifact | Convention | Example |
|:---|:---|:---|
| **React Components** | PascalCase | `Dashboard.tsx`, `JobCard.tsx`, `WorkspaceShell.tsx` |
| **Custom Hooks** | camelCase (`use<Thing>`) | `useWorkspaceBootstrap`, `useTheme`, `useDebounce` |
| **Non-Component Modules** | kebab-case | `query-client.ts`, `route-prefetch.ts`, `demo-session.ts` |
| **Types & Interfaces** | PascalCase | `WorkspaceBootstrap`, `PublicProfileResult`, `AtsScore` |
| **Constants** | SCREAMING_SNAKE_CASE | `INITIAL_REQUEST_TIMEOUT_MS`, `ACCESS_TOKEN_STORAGE_KEY` |
| **Feature Folders** | kebab-case | `resume-analysis`, `mock-interview`, `learning-path` |
| **Backend Modules** | snake_case / resource-scoped | `routers/jobs.py`, `database/client.py`, `ats_score.py` |
| **Event Handlers** | camelCase (`handle<Event>`) | `handleSubmit`, `handleSearchChange`, `handleJobSave` |
| **Boolean Flags & Props** | camelCase (`is<Condition>` / `has<Trait>`) | `isLoading`, `isSaved`, `hasActiveSession` |

---

## 2. Frontend Import & Layering Rules

Modules follow strict dependency hierarchy to prevent cyclical dependencies and logic leakage:

```text
Pages (routes)
  └── Feature Components & Hooks
        └── Feature API (feature/api.ts)
              └── Shared Infrastructure (shared/lib/client.ts, shared/config)
```

- **Rule 1**: UI components NEVER fetch data directly using `fetch` or `axios`. They consume queries or callbacks via hooks/props.
- **Rule 2**: `shared/` never imports from `features/`.
- **Rule 3**: Cross-feature imports must ONLY import from the target feature's `index.ts` public API, never reaching into internal component files.
- **Rule 4**: `import.meta.env` is accessed exclusively in `shared/config/env.ts`.

---

## 3. Backend Architecture Rules

The FastAPI backend follows layered separation of concerns:

1. **Config Layer (`app/core/config.py`)**: The only module that reads `process.env`. Enforces typed settings via Pydantic.
2. **Routing Layer (`app/api/routers/`)**: HTTP endpoints wiring paths to handlers, auth dependencies, and responses.
3. **Schemas Layer (`app/api/schemas.py`)**: Pydantic input models validating payloads at the network boundary.
4. **Service Layer (`app/features/`)**: Pure domain logic and calculations (e.g. ATS scoring, prompt engineering, interview turn logic).
5. **Repository Layer (`app/database/client.py`, `repository.py`)**: The sole layer communicating with Supabase PostgreSQL and Storage.
6. **Error Handling (`app/core/errors.py`)**: `ApiError` class with consistent error envelope `{ "error": { "code", "message", "details", "request_id" } }`.

---

## 4. Error Handling & User Safety

- **Zero Secret Leaks**: Passwords, tokens, database credentials, and service role keys must never appear in logs or client-facing responses.
- **Safe End-User Messages**: In production, internal stack traces, SQL errors, or proxy/npm debugging hints are suppressed in favor of user-friendly guidance.
- **Dev Disclosure**: In development mode (`isDevBuild`), technical diagnostics are provided inside collapsible disclosures for debugging.

---

## 5. Git & Commit Guidelines

- Format: `<type>(<scope>): <summary>`
  - Types: `refactor`, `fix`, `test`, `docs`, `perf`, `chore`
  - Examples:
    - `refactor(step-a): separate environment configuration from code`
    - `test: add safety net pure logic and smoke tests`
    - `docs: update architecture and api references`
