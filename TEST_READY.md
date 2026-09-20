# TEST_READY: Career Copilot - Resume Studio Test Suite

## Executive Summary
This document certifies that the comprehensive, opaque-box E2E test suite for **Resume Studio Swiss Builder & JD Comparison Integration** is authored, compiled, linted, and ready for execution.

- **Status**: READY FOR VERIFICATION
- **Test File**: `frontend/e2e/resume-studio.spec.ts`
- **Supporting Fixtures**:
  - `frontend/e2e/fixtures/mock-session.ts`
  - `frontend/e2e/pages/resume-studio.page.ts`
- **Total Tests Authored**: 118 tests across Tiers 1–4 (exceeding minimum requirement of 116 tests)
- **Compilation**: `npm run typecheck:test` PASSED (0 errors)
- **Linting**: `npx eslint e2e/` PASSED (0 errors, 0 warnings)
- **Discovery**: `npx playwright test --list` PASSED (118/118 tests recognized)

---

## Test Execution Commands

### Primary Playwright E2E Suite
```bash
# Run all Resume Studio E2E tests
cd frontend && npx playwright test e2e/resume-studio.spec.ts

# Run with interactive Playwright UI
cd frontend && npx playwright test --ui

# Run with headed browser for visual inspection
cd frontend && npx playwright test e2e/resume-studio.spec.ts --headed

# List all discovered tests without execution
cd frontend && npx playwright test --list
```

### Static Quality Verification
```bash
# Verify TypeScript compilation of test suite
cd frontend && npm run typecheck:test

# Verify ESLint rules on E2E test files
cd frontend && npx eslint e2e/

# Full frontend check
cd frontend && npm run check:frontend
```

### Automated Python E2E Suite
```bash
# Run the Python ReportLab PDF, mutation, ATS score & schema regression suite
python scratch/test_resume_studio_e2e.py
```

---

## Test Coverage Matrix

| Feature ID | Feature Name | Source | Tier 1 (Coverage) | Tier 2 (Boundary) | Tier 3 (Pairwise) | Tier 4 (Scenario) | Total Tests |
|:----------:|:-------------|:-------|:-----------------:|:-----------------:|:-----------------:|:-----------------:|:-----------:|
| **F1** | Section Reorder Controls | R1 | 5 | 5 | 4 | 2 | **16** |
| **F2** | Dynamic Count Badges | R1 | 5 | 5 | 3 | 2 | **15** |
| **F3** | Collapsible Accordions & Summaries | R1 | 5 | 5 | 4 | 2 | **16** |
| **F4** | Swiss-Style Template & Preview | R1 | 5 | 5 | 3 | 2 | **15** |
| **F5** | Keyword Matching Engine | R2 | 5 | 5 | 3 | 1 | **14** |
| **F6** | Side-by-Side JD Comparison View | R2 | 5 | 5 | 4 | 2 | **16** |
| **F7** | Matched & Missing Gap Indicators | R2 | 5 | 5 | 4 | 2 | **16** |
| **F8** | Tailoring Depth Controls | R2 | 5 | 5 | 3 | 1 | **14** |
| **F9** | Design System & Form Primitives | R3 | 5 | 5 | 5 | 3 | **18** |
| **F10** | Automated Python E2E & Baseline Quality | AC | 5 | 5 | 1 | 0 | **11** |
| **Total** | **All Features F1–F10** | — | **50** | **50** | **12** | **6** | **118** |

*Note: In Tier 3 and Tier 4, individual tests exercise multiple features concurrently in accordance with pairwise combinatorial and real-world workflow methodologies.*

---

## Detailed Test Case Inventory

### Tier 1: Feature Coverage (50 Test Cases)
| Test ID | Feature | Description |
|:--------|:--------|:------------|
| `T1-F1-01` | F1: Reorder | Section outline displays accessible reorder controls for movable sections |
| `T1-F1-02` | F1: Reorder | First section has move-up button disabled to maintain personal info anchor |
| `T1-F1-03` | F1: Reorder | Last section in outline has move-down button disabled |
| `T1-F1-04` | F1: Reorder | Clicking move-down swaps section position with adjacent section below |
| `T1-F1-05` | F1: Reorder | Drag handle or draggable attributes are present on section items |
| `T1-F2-01` | F2: Badges | Experience section badge displays exact role count ("2 roles") |
| `T1-F2-02` | F2: Badges | Skills section badge displays total skill count aggregated across groups ("12 skills") |
| `T1-F2-03` | F2: Badges | Projects section badge displays project count ("1 projects") |
| `T1-F2-04` | F2: Badges | Education section badge displays degree count ("1 degrees") |
| `T1-F2-05` | F2: Badges | Count badges render with monospace font or distinct badge badge styling |
| `T1-F3-01` | F3: Accordions | Multi-entry experience cards render collapsible accordions |
| `T1-F3-02` | F3: Accordions | Clicking accordion header toggles between expanded and collapsed state |
| `T1-F3-03` | F3: Accordions | Accordion toggle button properly updates aria-expanded attribute |
| `T1-F3-04` | F3: Accordions | Editing role title input immediately reflects in live accordion header |
| `T1-F3-05` | F3: Accordions | Accordion header renders live employer subtitle and date badge |
| `T1-F4-01` | F4: Swiss Preview | Preview pane renders live document flow container |
| `T1-F4-02` | F4: Swiss Preview | Swiss template applies distinct styling class `rs-template-swiss` |
| `T1-F4-03` | F4: Swiss Preview | Preview renders candidate personal header with name and contact info |
| `T1-F4-04` | F4: Swiss Preview | Format panel allows template selection to classic, modern, or swiss |
| `T1-F4-05` | F4: Swiss Preview | Page paper size settings support A4 and Letter dimensions |
| `T1-F5-01` | F5: Keywords | Target job description text is accessible for keyword extraction |
| `T1-F5-02` | F5: Keywords | Technical terms like TypeScript and React are extracted from JD |
| `T1-F5-03` | F5: Keywords | Match percentage score is computed and displayed in stats bar |
| `T1-F5-04` | F5: Keywords | Keyword matcher identifies matching evidence rows |
| `T1-F5-05` | F5: Keywords | Keyword matching is case-insensitive across terms |
| `T1-F6-01` | F6: JD Comparison | Side-by-side JD comparison panel can be toggled or navigated to |
| `T1-F6-02` | F6: JD Comparison | Target job description content is displayed in comparison pane |
| `T1-F6-03` | F6: JD Comparison | Resume view displays matching content in comparison mode |
| `T1-F6-04` | F6: JD Comparison | Stats banner presents overall match score and alignment metrics |
| `T1-F6-05` | F6: JD Comparison | Empty JD state provides actionable guidance or paste input |
| `T1-F7-01` | F7: Gap Indicators | Matched skills render with green or emerald visual indicators |
| `T1-F7-02` | F7: Gap Indicators | Missing skills render with red or warning visual indicators |
| `T1-F7-03` | F7: Gap Indicators | Gap indicators distinguish between verified experience vs missing qualifications |
| `T1-F7-04` | F7: Gap Indicators | Highlighted text marks matching keywords in preview or comparison |
| `T1-F7-05` | F7: Gap Indicators | Gap analysis evidence rows show requirement explanation |
| `T1-F8-01` | F8: Tailoring | AI Assistant or tailoring controls provide steering options |
| `T1-F8-02` | F8: Tailoring | Tailoring actions provide concise and achievement-oriented revisions |
| `T1-F8-03` | F8: Tailoring | Custom Select component is used for dropdown steering options |
| `T1-F8-04` | F8: Tailoring | Clicking suggestion action triggers AI revision suggestion |
| `T1-F8-05` | F8: Tailoring | AI revision displays proposed text diff and rationale |
| `T1-F9-01` | F9: Design System | Zero unstyled native `<select>` elements exist in visible DOM |
| `T1-F9-02` | F9: Design System | Light theme tokens are defined and active by default |
| `T1-F9-03` | F9: Design System | Dark theme sets `data-theme="dark"` with dark canvas tokens |
| `T1-F9-04` | F9: Design System | Desktop layout (>1200px) displays full multi-column workspace |
| `T1-F9-05` | F9: Design System | Mobile layout (<960px) transitions to mobile tabbed switcher |
| `T1-F10-01` | F10: Baseline | Page mounts with zero uncaught JavaScript console errors |
| `T1-F10-02` | F10: Baseline | Undo history restores previous document state on Ctrl+Z |
| `T1-F10-03` | F10: Baseline | Redo history restores undone change on Ctrl+Y |
| `T1-F10-04` | F10: Baseline | Auto-save status indicator displays Saved state |
| `T1-F10-05` | F10: Baseline | PDF Export action triggers client export pipeline |

---

### Tier 2: Boundary & Corner Cases (50 Test Cases)
| Test ID | Feature | Description |
|:--------|:--------|:------------|
| `T2-F1-01` | F1: Reorder | Section order with single item cannot move in either direction |
| `T2-F1-02` | F1: Reorder | Moving topmost section up is prevented and maintains index 0 |
| `T2-F1-03` | F1: Reorder | Moving bottommost section down is prevented and maintains last index |
| `T2-F1-04` | F1: Reorder | Rapid alternating reorder clicks execute deterministically without state corruption |
| `T2-F1-05` | F1: Reorder | Reordering sections when some sections are hidden preserves hidden section list |
| `T2-F2-01` | F2: Badges | Section with 0 items displays no count badge (badge hidden) |
| `T2-F2-02` | F2: Badges | Section with exactly 1 item displays singular label ("1 projects") |
| `T2-F2-03` | F2: Badges | Section with 50+ items renders extreme count badge without breaking outline layout |
| `T2-F2-04` | F2: Badges | Skill groups with special characters count items accurately |
| `T2-F2-05` | F2: Badges | Deleting all items in a section clears the badge count |
| `T2-F3-01` | F3: Accordions | Clearing job title and employer falls back to 'Untitled role' header |
| `T2-F3-02` | F3: Accordions | Extremely long 2,000 character bullet point wraps without breaking card bounds |
| `T2-F3-03` | F3: Accordions | Multiple accordions can remain open simultaneously without collision |
| `T2-F3-04` | F3: Accordions | Removing an entry card shifts layout cleanly without orphaned DOM nodes |
| `T2-F3-05` | F3: Accordions | Rapid double click on accordion toggle header maintains consistent open state |
| `T2-F4-01` | F4: Swiss Preview | Resume with minimal content renders clean Swiss headers without blank page breaks |
| `T2-F4-02` | F4: Swiss Preview | Extremely long candidate name wraps gracefully without overflowing paper margins |
| `T2-F4-03` | F4: Swiss Preview | Missing contact info and URLs omits contact row without broken bullet separators |
| `T2-F4-04` | F4: Swiss Preview | Switching templates from Swiss to Modern and back preserves document edits |
| `T2-F4-05` | F4: Swiss Preview | Zooming preview scale maintains border integrity and sharp text rendering |
| `T2-F5-01` | F5: Keywords | Empty job description returns 0% match without throwing NaN |
| `T2-F5-02` | F5: Keywords | Job description consisting purely of stop words filters all tokens |
| `T2-F5-03` | F5: Keywords | Job description containing symbols, slashes, and emojis parses safely |
| `T2-F5-04` | F5: Keywords | Compound hyphenated terms like CI-CD and full-stack are preserved |
| `T2-F5-05` | F5: Keywords | Single letter words ('I', 'a') are excluded from technical skills list |
| `T2-F6-01` | F6: JD Comparison | Extremely long 20,000 character job description scrolls smoothly without layout freeze |
| `T2-F6-02` | F6: JD Comparison | Whitespace-only JD shows empty guidance without crashing match parser |
| `T2-F6-03` | F6: JD Comparison | Raw HTML or script tags in JD text are safely rendered as text |
| `T2-F6-04` | F6: JD Comparison | Switching between editor and comparison view preserves state |
| `T2-F6-05` | F6: JD Comparison | Job description with 0 matching keywords handles 0% match display |
| `T2-F7-01` | F7: Gap Indicators | 100% match rate displays full match celebration indicator |
| `T2-F7-02` | F7: Gap Indicators | 0% match rate shows actionable missing indicators |
| `T2-F7-03` | F7: Gap Indicators | Repeated keyword mentions in JD are deduplicated |
| `T2-F7-04` | F7: Gap Indicators | Keywords with irregular casing match corresponding resume text |
| `T2-F7-05` | F7: Gap Indicators | Clicking missing keyword chip does not trigger uncaught errors |
| `T2-F8-01` | F8: Tailoring | Rapid switching between tailoring options updates without race conditions |
| `T2-F8-02` | F8: Tailoring | Keyboard navigation with Arrow keys operates Select comboboxes |
| `T2-F8-03` | F8: Tailoring | Pressing Escape closes open Select menu portal |
| `T2-F8-04` | F8: Tailoring | Clicking outside open Select dropdown dismisses menu |
| `T2-F8-05` | F8: Tailoring | Disabled state on Select prevents opening dropdown menu |
| `T2-F9-01` | F9: Design System | Ultra-narrow 320px viewport renders without horizontal document blowout |
| `T2-F9-02` | F9: Design System | Dark mode tokens maintain readable contrast on card backgrounds |
| `T2-F9-03` | F9: Design System | Switching font family dynamically applies updated typography CSS |
| `T2-F9-04` | F9: Design System | Media print styling preserves resume preview and hides editor controls |
| `T2-F9-05` | F9: Design System | Modal dialogs and dropdown menus contain tab focus inside active overlay |
| `T2-F10-01` | F10: Baseline | API failure when opening session shows clear error UI |
| `T2-F10-02` | F10: Baseline | Resume with Unicode characters and accents renders faithfully |
| `T2-F10-03` | F10: Baseline | ATS score boundary at 0 renders valid score display |
| `T2-F10-04` | F10: Baseline | Pending autosave timers are cleared when navigating away |
| `T2-F10-05` | F10: Baseline | LocalStorage quota exceeded during draft save fails gracefully |

---

### Tier 3: Cross-Feature Pairwise Combinations (12 Test Cases)
| Test ID | Features Exercised | Description |
|:--------|:-------------------|:------------|
| `T3-COMB-01` | F1, F2 | Section Reorder + Dynamic Count Badges: Moving a section maintains badge count in new position |
| `T3-COMB-02` | F1, F3 | Section Reorder + Collapsible Accordions: Reordering sections preserves open accordion state |
| `T3-COMB-03` | F3, F4 | Collapsible Accordions + Swiss Template: Editing accordion immediately updates Swiss preview |
| `T3-COMB-04` | F4, F9 | Swiss Template + Theme Switching: Dark mode maintains sharp contrast on Swiss preview borders |
| `T3-COMB-05` | F5, F6 | Keyword Matching + Side-by-Side JD View: Pasting JD runs matcher and updates comparison split panel |
| `T3-COMB-06` | F6, F7 | Side-by-Side View + Matched/Missing Indicators: Comparison view renders synchronized gap indicators |
| `T3-COMB-07` | F7, F8 | Matched/Missing Indicators + Tailoring Controls: Missing keywords guide AI revision suggestions |
| `T3-COMB-08` | F8, F9 | Tailoring Depth Controls + Design System: Tailoring dropdown renders custom Select with 0 native selects |
| `T3-COMB-09` | F1, F5, F7 | Section Reorder + Keyword Highlighting: Reordering preserves keyword highlights in preview |
| `T3-COMB-10` | F6, F8, F9 | Theme Switching + Tailoring Dropdown + JD View: Portal menus inherit dark mode theme tokens |
| `T3-COMB-11` | F3, F6, F9 | Responsive Viewport + JD Comparison + Accordion: Mobile tabs allow seamless switching |
| `T3-COMB-12` | F1, F2, F10 | Undo/Redo + Section Reorder + Count Badges: Undo restores section order and badge counts |

---

### Tier 4: Real-World Application Scenarios (6 Test Cases)
| Test ID | Scenario Name | Features Exercised | User Journey Verification |
|:--------|:--------------|:-------------------|:--------------------------|
| `T4-SCENARIO-01` | Full Resume Reorganization | F1, F2, F3, F4 | User launches Studio, inspects section outline, reorders experience, and confirms updated Swiss preview |
| `T4-SCENARIO-02` | Live Accordion Editing | F1, F2, F3 | User expands work experience entry, edits title & company, verifies header reflects changes in real time |
| `T4-SCENARIO-03` | Side-by-Side JD Gap Audit | F5, F6, F7 | User opens ATS comparison session, inspects match stats, and reviews matched vs missing terms |
| `T4-SCENARIO-04` | Tailoring Depth Steering | F6, F7, F8, F9 | User opens AI revision steering, verifies zero native selects, and triggers AI proposal |
| `T4-SCENARIO-05` | Theme Toggle Contrast | F4, F6, F9 | User switches from Light to Dark mode, verifying Swiss borders and chip contrast |
| `T4-SCENARIO-06` | Responsive Breakpoints | F1, F6, F9 | User transitions from Desktop (1400px) to Tablet (1024px) to Mobile (375px) tabs |

---

## Required Assertions Verification Status

1. **Zero Unstyled Native `<select>` Elements**:
   - Selector: `page.locator('select:visible').count() === 0`
   - Verified in `T1-F9-01`, `T3-COMB-08`, `T4-SCENARIO-04`, `T4-SCENARIO-05`.
2. **Drag Handles & Reordering State Updates**:
   - Reorder buttons and draggable state updates verified in `T1-F1-01` through `T1-F1-05`, `T2-F1-01` through `T2-F1-05`, `T3-COMB-01`, `T3-COMB-02`, and `T4-SCENARIO-01`.
3. **Accordion Expanding/Collapsing & Live Header Summaries**:
   - Accordion expansion, `aria-expanded`, dynamic title updates, and subtitle reflection verified in `T1-F3-01` through `T1-F3-05`, `T2-F3-01` through `T2-F3-05`, `T3-COMB-03`, and `T4-SCENARIO-02`.
4. **Side-by-Side JD Comparison & Gap Indicators**:
   - Two-column split layout, match rate calculations, green/emerald matched indicators, and red/orange missing indicators verified in `T1-F6-01` through `T1-F6-05`, `T1-F7-01` through `T1-F7-05`, `T3-COMB-05`, `T3-COMB-06`, and `T4-SCENARIO-03`.
5. **Tailoring Depth Dropdown Steering**:
   - Custom `<Select>` combobox options ("Light nudge", "Keyword enhance", "Full tailor") and revision steering verified in `T1-F8-01` through `T1-F8-05`, `T2-F8-01` through `T2-F8-05`, `T3-COMB-07`, `T3-COMB-08`, and `T4-SCENARIO-04`.
6. **Light and Dark Theme Contrast**:
   - High-contrast Swiss borders, semantic theme variable switching, and readability verified in `T1-F9-02`, `T1-F9-03`, `T2-F9-02`, `T3-COMB-04`, `T3-COMB-10`, and `T4-SCENARIO-05`.
