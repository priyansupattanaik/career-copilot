# Project: Career Copilot - Resume Studio Swiss Builder & JD Comparison Integration

## Architecture
- **Frontend Architecture**: React 19 + TypeScript + Vite 8 located in `frontend/src/features/resume-studio`.
  - Split view container: `resume-studio.tsx` managing session, layout mode, undo/redo, auto-save, and PDF export.
  - Section navigation & forms: `resume-section-editor.tsx` managing section order, collapsible accordions, and live summaries.
  - Paper preview: `resume-preview.tsx` rendering scaled SVG/HTML preview with Swiss-style layout.
  - JD comparison & tailoring: `resume-jd-comparison.tsx` displaying side-by-side JD vs Resume with keyword highlights and tailoring depth controls.
  - Keyword algorithm: `model/keyword-matcher.ts` for regex keyword extraction, stop-word filtering, and text segmentation.
- **Backend Architecture**: FastAPI + Pydantic v2 located in `backend/app/features/resume_studio`.
  - Schemas: `schema.py` (`ConfigDict(extra="forbid")`) with template IDs including `"swiss"`.
  - PDF Generation: `pdf.py` generating ReportLab PDF variations.
  - Automated E2E Suite: `scratch/test_resume_studio_e2e.py` validating 5/5 test phases.
- **Design System & Primitives**:
  - Tokens in `frontend/src/globals.css` with semantic variables for light (`:root`) and dark (`[data-theme="dark"]`).
  - Dropdown Primitive: Strictly `@/shared/ui/select-field` (`<Select>`) — 0 unstyled native `<select>` elements.
  - Icons: `@/components/ui/copilot-icons` (`<CopilotIcon>`).
  - Responsive: Desktop (>1200px), Tablet (960-1199px), Mobile (<960px), Phone (<600px).

## Code Layout
- `scratch/test_resume_studio_e2e.py` — Python automated E2E test suite.
- `frontend/src/features/resume-studio/model/keyword-matcher.ts` — Keyword extraction and matching engine.
- `frontend/src/features/resume-studio/__tests__/keyword-matcher.test.ts` — Unit tests for keyword matcher.
- `frontend/src/features/resume-studio/components/resume-jd-comparison.tsx` — Side-by-side JD comparison component.
- `frontend/src/features/resume-studio/components/resume-section-editor.tsx` — Builder section nav, reorder controls, count badges, and accordions.
- `frontend/src/features/resume-studio/components/resume-preview.tsx` — Swiss template preview renderer.
- `frontend/src/features/resume-studio/model/resume-schema.ts` — Frontend schema with `"swiss"` template.
- `backend/app/features/resume_studio/schema.py` — Backend schema with `"swiss"` template.
- `frontend/src/features/resume-studio/resume-studio.css` — Swiss template styling, badges, drag styles, and comparison layout.
- `frontend/src/features/dashboard/components/dashboard.tsx` — ESLint empty catch block fix.
- `frontend/e2e/resume-studio.spec.ts` — Requirement-driven Playwright E2E test suite.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| F1 | Section Reorder Controls | Draggable handles and accessible reorder controls for resume sections | M2 | Survey / R1 |
| F2 | Dynamic Count Badges | Monospace badges in section outline showing live item counts ("X roles", etc.) | M2 | Survey / R1 |
| F3 | Collapsible Accordions | Expandable/collapsible multi-entry cards with live header summaries | M2 | Survey / R1 |
| F4 | Swiss-Style Template & Preview | Editorial Swiss-style resume template with hard borders and mono tags | M2 | Survey / R1 |
| F5 | Keyword Matching Engine | Pure TS keyword extraction, stop-word filtering, match stats, and text segmentation | M1 | Survey / R2 |
| F6 | Side-by-Side JD Comparison View | Two-column comparison layout with target JD on left and highlighted resume on right | M3 | Survey / R2 |
| F7 | Matched & Missing Gap Indicators | Color-coded indicator chips and highlighted text for matched vs missing keywords | M3 | Survey / R2 |
| F8 | Tailoring Depth Controls | Configurable steering dropdown (*Light nudge*, *Keyword enhance*, *Full tailor*) using `<Select>` | M3 | Survey / R2 |
| F9 | Design System & Theme Harmonization | Light/dark theme tokens, zero native `<select>` elements, and responsive breakpoints | M4 | Survey / R3 |
| F10 | Automated Python E2E & Baseline Quality | `scratch/test_resume_studio_e2e.py` passes 5/5, `npm run typecheck` passes, `npm run build` succeeds | M1 | Survey / AC |
| F11 | Final E2E Test Suite Pass (Tiers 1-4) | 100% pass of all requirement-driven E2E tests in TEST_READY.md | M5 | AC / Dual Track |
| F12 | Adversarial Coverage Hardening (Tier 5) | White-box stress testing, edge case coverage, and gap remediation | M5 | Pattern |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Baseline Setup & Keyword Engine | `scratch/test_resume_studio_e2e.py` setup, `keyword-matcher.ts` & unit tests, lint fix | none | DONE (python 5/5, vitest 56/56, lint 0) |
| M2 | Swiss-Style Builder UI & Draggable Workflows | Reorder handles, count badges, live summary accordions, Swiss template | M1 | DONE (worker_m2_r2 6/6 verified) |
| M3 | Side-by-Side JD Comparison & Tailoring | `ResumeJdComparison` view, matched/missing chips, tailoring depth `<Select>` | M1 | DONE (worker_m3 38/38 Playwright, CLEAN audit) |
| M4 | Design System & Theme Harmonization | Light/dark mode styling, zero unstyled `<select>` audit, responsive breakpoints | M2, M3 | IN_PROGRESS |
| M5 | Final Milestone: E2E Pass & Hardening | Phase 1: 100% E2E tests pass (Tiers 1-4). Phase 2: Adversarial hardening (Tier 5) | M4, TEST_READY | PLANNED |

## Parallel Track: E2E Testing Track
- Scope: Independent, requirement-driven test suite covering all features across Tiers 1-4.
- Deliverables: `TEST_INFRA.md`, automated Playwright test suite (`frontend/e2e/resume-studio.spec.ts`), and `TEST_READY.md`.

## Interface Contracts
### `keyword-matcher.ts` ↔ UI Components (`ResumeJdComparison`, `ResumePreview`)
- `extractKeywords(text: string): Set<string>`
  - Inputs: `text: string`
  - Outputs: `Set<string>` (normalized, filtered keywords)
- `calculateMatchStats(resumeText: string, keywords: Set<string>): { totalKeywords: number, matchedCount: number, matchPercentage: number, matchedKeywords: string[], missingKeywords: string[] }`
  - Inputs: `resumeText: string`, `keywords: Set<string>`
  - Outputs: match metrics and arrays of matched and missing terms
- `segmentTextByKeywords(text: string, keywords: Set<string>): Array<{ text: string, isMatch: boolean }>`
  - Inputs: `text: string`, `keywords: Set<string>`
  - Outputs: text chunks for rendering `<mark>` tags while preserving whitespace

### Tailoring Depth Options
- `TailoringDepth = "nudge" | "keywords" | "full"`
- Display Labels:
  - `"nudge"`: "Light nudge" (Description: "Minimal edits to better align existing experience")
  - `"keywords"`: "Keyword enhance" (Description: "Blend in relevant keywords without changing role or scope")
  - `"full"`: "Full tailor" (Description: "Comprehensive tailoring using the job description")
- Form primitive: Strictly `@/shared/ui/select-field` (`<Select>`).

### Template Interface (`resume-schema.ts` & `backend/schema.py`)
- `TemplateId = "classic" | "modern" | "minimal" | "swiss"`
