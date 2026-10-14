# State Management Architecture

This document defines the state management strategy for Career Copilot, delineating server state, global client state, local component state, and URL state.

## Core Principles

1. **Server data is never copied into global client state.**
2. **Server state belongs in TanStack Query.** Re-fetches, caching, background revalidation, and de-duplication are handled through `@tanstack/react-query`.
3. **Client state stays minimal.** Only genuinely global cross-cutting concerns (Auth session and Theme) use React Context.
4. **URL is the source of truth for navigational state.** Filter selections, active tab keys, search terms, and resource identifiers belong in URL query parameters or route paths.

---

## State Categories

### 1. Server State (TanStack Query)

On a free-tier hosting model (Render backend spinning down after 15 minutes of inactivity), client-side caching is essential:
- Eliminates redundant network round-trips when switching views.
- Eliminates duplicate in-flight requests via request de-duplication.
- Preserves last-known-good snapshots so transient cold starts do not blank screens.

#### Query Key Hierarchy (`shared/lib/query-keys.ts`)
All query keys follow standardized factory patterns:
- `dashboardKeys.all`, `dashboardKeys.bootstrap(scope)`
- `jobsKeys.all`, `jobsKeys.list(filters)`, `jobsKeys.detail(id)`, `jobsKeys.saved()`
- `interviewKeys.all`, `interviewKeys.sessions()`, `interviewKeys.session(id)`, `interviewKeys.report(id)`
- `resumeKeys.all`, `resumeKeys.list()`, `resumeKeys.detail(id)`, `resumeKeys.analysis(id)`
- `learningKeys.all`, `learningKeys.paths()`, `learningKeys.path(id)`
- `profileKeys.all`, `profileKeys.me()`, `profileKeys.publicProfile(username)`, `profileKeys.communitySearch(query)`
- `settingsKeys.all`, `settingsKeys.preferences()`

#### Cache Invalidation & Stale Times (`shared/config/constants.ts`)
- **Dashboard & Jobs List**: `STALE_TIME_DEFAULT_MS` (60 seconds). Fast updates while preventing excessive reload bursts.
- **Static Catalogs & Rarely Changing Content**: `STALE_TIME_STATIC_MS` (5 minutes).
- **Profile Data**: `STALE_TIME_PROFILE_MS` (2 minutes).
- **Mutations**: Mutations invalidate relevant query key families upon success (e.g. saving a job invalidates `jobsKeys.saved()` and `jobsKeys.lists()`).

---

### 2. Global Client State (React Context)

Only two concerns are genuinely global:
- **Auth Session**: Managed via `localStorage` (`career_copilot_access_token`) and the Supabase Auth client, synchronized via custom events (`career-copilot:auth-expired`).
- **Theme Preference**: Managed by `ThemeProvider` in `shared/theme.tsx`, reading from and persisting to `localStorage` (`career-copilot-theme`).

---

### 3. Local UI State (`useState`, `useReducer`)

- Modal dialogs, dropdowns, and sheet open/closed states.
- In-progress form inputs before submission (e.g. mock interview setup fields, resume upload dropzone).
- Local disclosure states (e.g. expandable card sections, accordion toggles).

---

### 4. URL State (`useSearchParams`, `useParams`)

- Active sub-tabs in settings and resume analysis (`?tab=upload`, `?tab=history`).
- Filter parameters in job search and community profiles.
- Route parameters (`:jobId`, `:sessionId`, `:pathId`, `:username`).
