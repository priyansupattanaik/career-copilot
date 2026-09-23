# AI slop design audit

Check only. Nothing in the product was changed.

Captured 23 September 2026 against `http://127.0.0.1:3000` with the dev demo cookie (`career_copilot_demo=1`) for signed-in routes. Chrome DevTools could not launch (`spawn UNKNOWN`), so the shots are Playwright Chromium, reduced motion, light and dark, desktop 1440×900 and mobile 390×844, full page. One extra mobile viewport shot of the dashboard checks that the bottom bar is really pinned to the screen, because full-page shots misplace `position: fixed` elements.

Screenshots: `docs/design-audit/2026-09-23-ai-slop/screenshots/{light|dark}/{desktop|mobile}/`. Index: `capture-manifest.json` (122 rows, 0 capture errors, plus `public-profile-ada-demo.png` and `dashboard-viewport.png`).

## Verdict

The signed-in product is not a purple-gradient template. Landing copy is specific, icons are a custom set, and the ATS report is a ledger. The slop is the layer on top: an ice-blue SaaS dashboard, a pure-black dark theme that does not match it, and marketing chrome built from numbered starter blocks (`navigation-5`, `team-5`, `error-6`, `breadcrumb-5`) plus beams, aurora, and a rainbow footer component.

Worst screens, in order:

1. Dashboard. Four identical stat tiles, sparkle button, readiness ring, and the line “Signals synced with Copilot intelligence.”
2. Team page at rest. Five anonymous grayscale portraits. Names exist in the component and stay at `opacity: 0` until hover.
3. Learning path card. The card is a row flex, so the title, progress, chips, and actions sit side by side and collide.
4. Dark theme. `#000000` and zinc surfaces under warm off-white type, while light mode is `#f5faff` and navy. Two products.
5. Interview room empty state. A cyan blob and a black “You” tile when the demo session has no questions.

## What was opened

Public: `/`, `/teams`, `/sign-in`, `/sign-up`, `/forgot-password`, `/reset-password`, `/verify-email`, a missing URL, mobile nav sheet, empty sign-in submit.

Demo session: `/onboarding`, `/dashboard`, `/jobs`, `/jobs/saved`, `/jobs/demo-job-1`, `/community`, `/learning`, `/learning/demo-path-1`, `/mock-interview`, `/mock-interview/preparation`, `/mock-interview/setup`, `/mock-interview/report/demo-interview-1`, `/mock-interview/session/demo-interview-1`, `/resume-analysis`, `/resume-analysis/new`, `/resume-analysis?tab=upload`, `/resume-analysis/report/demo-ats-1`, `/settings/profile`, `/settings/account`, `/settings/preferences`, `/settings/privacy`.

`/learning/topic/:topicId` is a redirect to `/learning`. `/resume-studio` and `/resume-analysis/review` redirect away.

`/ada-lovelace` renders the 404 even with the demo cookie. `isPublicProfileUsername` only allows `[a-z0-9_]`, and the only demo public usernames are `ada-lovelace` and `grace-hopper`. The designed public profile never mounted in this pass.

## Page by page

### Landing `/`

Distinct, and the strongest page. “Show up ready.” is a real headline. The practice-room still, the dark “Confidence is a practice habit.” band, and the closing card are composed, not a three-column feature grid. The three steps are a quiet list.

Still generic: tight negative tracking on every display line, a sample stat card with `+18%` and `+11%`, and a hero that is the same shape as a hundred other product sites (kicker, two-line headline, primary pill, text link, product mock). Dark mode drops the page onto pure black. The footer in the shots is quiet; `RuixenGradientFooter` still carries a Dia-style rainbow (`#0358F7`, `#FFD400`, `#FD02F5`) in source, and `BeamsBackground` is an Aceternity-style beam field. Mobile stacks cleanly. The nav sheet is a normal bottom sheet, not a feature-card mega menu.

### Team `/teams`

Same marketing chrome as home, then a centered “The team” and five equal grayscale headshots. That strip is `team-5.tsx`: `transition-all`, hover expands one photo, and the name, role, and links are `opacity-0` until hover or focus. At rest the page does not say who anyone is. The component’s unused default line is “Five minds. One mission. We ship products that matter.”

### Auth

Sign-in, sign-up, forgot password, reset password, and verify email share one split shell: navy panel, tight “Welcome back.” style headline, three icon bullets, white card. Copy is plain (“Sign in to open your private career records…”). It is not purple and it is not “Unlock your potential.” It is the same screen five times.

Forgot password tells you recovery email is not configured and offers no field. That is a dead end wearing a marketing hero. Empty submit is `screenshots/light/desktop/sign-in-empty-submit.png`.

### Onboarding

One card, sentence-case “Build your profile,” a loading sentence rather than a skeleton. Generic, and visually unrelated to the workspace that follows. Fine as a form. No distinct idea.

### Dashboard

`screenshots/light/desktop/dashboard.png` and `screenshots/dark/desktop/dashboard.png`. Also `screenshots/light/mobile/dashboard-viewport.png`.

This is the slop center.

- Headline is enormous and tightly tracked: “Welcome, Demo.” Subcopy is model language: “High-signal metrics, preparation trajectory, and immediate next steps.”
- Buttons are Title Case: “Practice Interview”, “New ATS Run” (sparkle icon), “Upload Resume”.
- Eyebrows are small-caps: PRIORITY NEXT STEP, ATS SCORE, PERFORMANCE TRAJECTORY, PROFILE & MILESTONES.
- Four equal stat cards. Then a chart card and a milestone card. Then a sparkle footer: “Signals synced with Copilot intelligence.”
- The breadcrumb is drawn twice. The shell header says Workspace → Dashboard, and the page repeats it. Confirmed on the mobile viewport, so it is not a screenshot artifact.
- The mobile bottom bar sits at the bottom of the viewport. The mid-page bar in the full-page mobile shot is the fixed bar painted into the long capture.

Dark dashboard is the same layout on `#000` with a cyan primary button. The ice-blue light theme and the black dark theme do not share a gray family.

### Jobs

“Your next move, shortlisted” is fine. “Less scrolling. More signal.” and the “RECOMMENDATION ENGINE / Profile evidence active” panel are the AI-product voice. Three identical count tiles (Saved, Applied, Rejected), all zero in the demo because recommendations wait on a confirmed resume. The empty state is composed: icon, “No jobs yet”, one sentence. Job detail for `demo-job-1` is a single document card (“Software Engineer”, Northstar Labs). Thin, not decorative.

### Community

Icon plus headline, one search card, pill chips (AI engineer, fresher, designer, data scientist, backend). Empty state is a dashed box and a sentence. A “complete your profile” toast repeats the 62% that is already in the sidebar. Pleasant, and still a hero-plus-card.

### Learning

The ledger of ATS runs is specific. The path card is broken. `.lp-path-card` is `display: flex` with no column direction (`frontend/src/features/learning/learning.css` line 234), so title, source line, progress, chips, “Open path & track progress”, and Delete sit in one row. `screenshots/light/desktop/learning.png` shows that collision. The path studio (`learning-path.png`) is a lesson layout and is the more considered of the two.

The generate button uses the sparkle icon (`assist`, aliased from `sparkles`).

### Mock interview

Home is a real setup desk: 2×2 focus tiles, length chips, a session list. Copy is direct (“Practice out loud”). This does not read as a template.

Preparation collapses to stacked suggestion cards. Setup repeats the home form without the list. The debrief is another score ring, and the demo report honestly says no answers were recorded.

The live room (`interview-session.png`) is mostly empty space, a pale cyan blob marked Ready, a black camera labeled You, and “No questions in this session.” The blob is decoration. The room itself, when it has a question, is the one workspace screen with its own shape.

### Resume analysis

The history, upload steps, and ATS report are the least generic workspace. “Audit sheet”, an evidence ledger, and “Keyword coverage is not a hiring prediction” are product language.

The demo report contradicts itself on one screen: “1 MISSING OF 3 SCORED TERMS · 2 MATCHED” beside “FOUND 0 · PARTIAL 0 · MISSING 1”, and the resume is “Resume unavailable (unavailable)”. That is broken content, visible in `resume-report.png`. “LLM improvement report” is the one heading that sounds like a model pipeline.

### Settings

Profile, account, preferences, and privacy are forms. They look like the same card as everything else, which is appropriate for settings. Weak spots: placeholder `your_name`, “Demo Candidate”, and completion shown again as 62% in the header, the sidebar, and the community toast. Preferences and privacy text in the capture still sit under a Profile crumb in the shell sample (`capture-manifest.json` text for those routes). Account has a real danger zone, which most generated settings pages forget.

### 404

`error-6`: giant “404”, faint grid, rounded card, “Go to Dashboard”. Useful, and obviously a template block. It is also what `/ada-lovelace` shows.

## System findings

These are in `frontend/src/globals.css` unless noted.

**Type.** Outfit, loaded at 400, 500, 600, and 700 (`frontend/index.html`). UI, headings, and code all use it. `--font-code` is not a mono face. Workspace `h1` is forced to `clamp(2.8rem, 6vw, 5.8rem)`, weight `650`, tracking `-0.08em`, line-height `0.92` (around line 10825). 650 and 800 are not in the font file, so the browser synthesizes them. `text-wrap: balance` and `tabular-nums` are present. The tracking is the “premium SaaS” move on every page title, including settings.

**Color.** Tokens say blue and white: `--background: #f5faff`, `--primary-strong: #1769aa`, `--accent: #3da2ff`. Dark tokens are `#000000`, `#0a0a0a`, `#121212`, zinc borders, and warm text `#f5f5f0`. Elsewhere the file hardcodes acid lime on the home system, indigo `#3f4fc4` on dashboard links, and the book loader is violet `hsl(268, 90%, 65%)` (`frontend/src/shared/ui/book-loader.css`). `theme-color` in `index.html` starts at `#f5f1e8` and the boot script overwrites it. One accent was not chosen.

**Surfaces.** `.panel` is white, 1px border, 16px radius, blue-tinted shadow. A later block reasserts radius with `!important` across jobs, learning, interview, and dashboard cards. Ad-hoc radii (10, 11, 14, 17, 18, 20) sit beside the 6/8/12/16/24 scale. A fixed fractal-noise layer on `body::before` uses `z-index: 9999` (lines 66–75), above modals at 80.

**Chrome.** Desktop is a left nav plus a sticky header. That is a normal app frame, not a sin by itself. Marketing nav is the slop: frosted pill, `backdrop-filter: blur(20px)`, liquid fill, `will-change` on the morph bar, `grid-cols-3` mega menu (`navigation-5.tsx`). Auth aurora blurs lime radials. A later rule tries to ban glass inside the workspace and does not cover the marketing pill.

**Icons.** Not a Lucide app. Lucide is three breadcrumb glyphs. The product set is `copilot-icons.tsx` (62 glyphs). `sparkles` aliases to a four-point star that plays `ci-sparkle`. It is used on “New ATS Run”, “Generate from ATS gaps”, and the dashboard intelligence pill. `shield-check` aliases to a scan mark.

**Motion and focus.** Global `:focus-visible` is a 3px outline. Buttons list transition properties and use a 0.97 press scale. `transition: all` remains on nav links, team strips, breadcrumb chips, and two dashboard controls (around lines 18466 and 18514). An empty `prefers-reduced-motion` block at line 4854 does nothing; later blocks do.

**States.** Jobs, interview prep, and the resume library have composed empty states. Dashboard has a skeleton. Several routes still boot with a sentence (“Loading sessions from your account”, “Loading interview report…”, “Checking session…”). Community search uses a spinner. There is no `Loader2`. The pixel-grid loader and the violet book loader are a second and third loading personality.

**Copy that cleared the usual ban list.** Elevate, Seamless, Unleash, Next-Gen, Supercharge, Oops, lorem, Acme, and John Doe do not appear. Success strings do not end in exclamation marks. What remains is the softer dialect: high-signal, trajectory, Copilot intelligence, less scrolling more signal, unlock the trend line, Title Case on the dashboard.

## Not slop, so it should stay

- Landing sentences about evidence, practice, and the next role.
- Custom icons on nav, jobs, resume, and settings.
- ATS audit sheet and the “not a hiring prediction” line.
- Interview setup copy and the refusal to claim hiring outcomes.
- Settings danger zone and privacy controls written as real choices.
- Focus rings, 44px button height, tabular numbers on metrics.
- A sidebar on a signed-in job app.

## Team pass

| Card | Owner | State | Evidence |
| --- | --- | --- | --- |
| Token and chrome audit | design-tokens | review | Findings in this file, sourced from `globals.css`, `theme.tsx`, icon and loader files |
| Page copy and layout audit | page-copy | review | Route-by-route notes above, checked against the captures |
| Component and state audit | components | review | Buttons, cards, empty states, badges, dialogs |
| Screenshot pass | capture | review | `screenshots/`, `capture-manifest.json` |

No branch. No merge. Check only.

Blocked visual: the public profile component. Demo usernames contain hyphens, and the route rejects hyphens, so every visit is the 404 card.
