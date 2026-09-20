# Original User Request

## 2026-09-10T21:34:30Z

Analyse the srbhr/Resume-Matcher repository to extract its Swiss-style Resume Builder UI, draggable section workflows, and side-by-side Job Description (JD) comparison and keyword tailoring interface, and implement them into Career Copilot's Resume Studio.

Working directory: d:\My Creations\career-copilot
Integrity mode: demo

## Requirements

### R1. Analyze and Extract Resume Builder UI
Analyse the `srbhr/Resume-Matcher` repository (including `apps/frontend` components such as `resume-wizard-page`, draggable section controls, and preview styling) and adapt the core builder interaction patterns into Career Copilot.

### R2. Side-by-Side JD Comparison & Keyword Tailoring
Implement a side-by-side Job Description comparison interface inspired by Resume-Matcher's `jd-comparison-view`. The interface must provide keyword extraction and visual gap indicators (matched vs. missing keywords) alongside configurable tailoring depth controls (*Light nudge*, *Keyword enhance*, *Full tailor*).

### R3. Design System & Theme Harmonization
Harmonize the newly integrated UI with Career Copilot's existing theme tokens (supporting both light and dark modes), accessible form primitives (ensuring zero unstyled native `<select>` elements), and responsive breakpoints (desktop, tablet, and mobile).

## Acceptance Criteria

### Resume Builder & Section Management
- [ ] Resume sections can be dynamically organized with clear visual hierarchy, count badges, and reorder controls.
- [ ] Multi-entry sections support collapsible accordion views with live item summaries.

### JD Match & Keyword Tailoring
- [ ] Users can view a side-by-side comparison between their resume and a target job description.
- [ ] Matched and missing keywords are color-coded and clearly distinguished.
- [ ] Tailoring depth options (*Light nudge*, *Keyword enhance*, *Full tailor*) are available to steer AI revisions.

### Code Quality & Verification
- [ ] Zero unstyled native `<select>` elements remain; all dropdowns use project design primitives.
- [ ] Both light mode and dark mode render consistently without visual overlap or unreadable contrast.
- [ ] `npm run typecheck` passes with 0 errors.
- [ ] `npm run build` succeeds cleanly.
- [ ] Existing automated test suite (`scratch/test_resume_studio_e2e.py`) passes all tests.
