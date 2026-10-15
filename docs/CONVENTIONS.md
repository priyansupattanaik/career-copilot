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

---

## 6. UI Consistency Rules

- **Spacing scale (px)**: `4, 8, 12, 16, 24, 32, 48, 64` (plus 0 and 1px borders).
  - Vertical rhythm: 24px between page blocks (`--space-6`).
  - Surface padding: 24px (20px below 768px).
  - Field grid row-gap: 16px; column-gap: 24px.
  - Label-to-control gap: 8px.
  - Heading-to-description gap: 4px.
- **Radius scale**:
  - `sm` (4px): Checkbox.
  - `md` (8px): Buttons, inputs, selects, row hover.
  - `lg` (12px): Surfaces, dialogs, sheets.
  - `full` (9999px or 50%): Chips, badges, avatars, rings.
  - Buttons use `md` (8px), never full pill shapes.
- **Borders**: 1px solid; `--hairline` for Surfaces and section dividers; `--border-control` for inputs, selects, checkboxes, and secondary buttons.
- **Heights**:
  - Buttons and inputs: 40px (44px on coarse pointer).
  - Tabs: 44px.
  - Chips and badges: 24px.
  - Icon buttons: 40px (avatar badge 28px).
- **Page container**: `max-width: 1200px`, centered in the main area right of sidebar. Padding-inline 32px at >= 1024px, 24px at 768–1023px, 16px below 768px. Used by topbar inner wrapper and page content.
- **Top bar**: 56px height. Transparent at scroll 0. When scrolled > 8px, receives opaque `--canvas` background spanning full main width with bottom hairline. Section tabs are not sticky.
- **Surfaces**: `Surface` component only, never nested. `--surface-1` fill, `--hairline` border, radius `lg`. Content between blocks sits directly on the canvas mesh.
- **Colour**: `--accent` only for primary buttons, active nav icons, active tab underlines, selected states, focus rings, ScoreRing arcs, and text links. Secondary buttons use `--border-control` border and `--ink` text. Ghost buttons use `--ink-2` text, hover `--ink`. Zero cyan/teal literals.
- **Typography**:
  - Page-identity name: Instrument Serif 28/32, weight 400, letter-spacing -0.02em.
  - Section titles (`h2`): Geist 600 18/28.
  - Sub-titles (`h3`): Geist 600 14/20 in `--ink`.
  - Body and descriptions: Geist 14/22 `--ink-2`.
  - Small / captions: Geist 13/20.
  - Numbers in the ring: Geist Mono (tabular-nums). Mono is strictly for numbers/scores.

