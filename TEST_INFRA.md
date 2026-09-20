# E2E Test Infra: Career Copilot - Resume Studio

## Test Philosophy
- Opaque-box, requirement-driven derived directly from ORIGINAL_REQUEST.md.
- Methodology: Category-Partition + Boundary Value Analysis (BVA) + Pairwise Combinatorial Testing + Real-World Workload Testing.
- No dependency on internal implementation private methods; exercises user-visible UI and standard APIs.

## Feature Inventory & Test Matrix
| # | Feature | Source | Tier 1 (Coverage >=5) | Tier 2 (Boundary >=5) | Tier 3 (Pairwise) |
|---|---------|--------|:---------------------:|:---------------------:|:-----------------:|
| F1 | Section Reorder Controls | ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ |
| F2 | Dynamic Count Badges | ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ |
| F3 | Collapsible Accordions & Summaries | ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ |
| F4 | Swiss-Style Template & Preview | ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ |
| F5 | Keyword Matching Engine | ORIGINAL_REQUEST §R2 | 5 | 5 | ✓ |
| F6 | Side-by-Side JD Comparison View | ORIGINAL_REQUEST §R2 | 5 | 5 | ✓ |
| F7 | Matched & Missing Gap Indicators | ORIGINAL_REQUEST §R2 | 5 | 5 | ✓ |
| F8 | Tailoring Depth Controls | ORIGINAL_REQUEST §R2 | 5 | 5 | ✓ |
| F9 | Design System & Form Primitives | ORIGINAL_REQUEST §R3 | 5 | 5 | ✓ |
| F10 | Python E2E Test Suite Pass | ORIGINAL_REQUEST §AC | 5 | 5 | ✓ |

## Test Architecture
- **E2E Runner**: Playwright (`frontend/playwright.config.ts`, test file `frontend/e2e/resume-studio.spec.ts`).
- **Python E2E Suite**: `python scratch/test_resume_studio_e2e.py` testing schema, 30 ReportLab PDFs, mutations, ATS score, and edge cases.
- **Unit Test Runner**: Vitest (`npm test` running `src/**/__tests__/**/*.test.ts`).
- **Static Verification**: `npm run typecheck` and `npm run build`.
- **Selector Rules**: Use accessible ARIA roles, test IDs, and visible text labels; zero reliance on unstable CSS hashes.

## Real-World Application Scenarios (Tier 4)
| # | Scenario | Features Exercised | Complexity |
|---|----------|--------------------|------------|
| 1 | Full Resume Reorganization & Section Reorder | F1, F2, F3, F4 | High |
| 2 | Live Accordion Editing with Real-time Header Summary Updates | F1, F2, F3 | Medium |
| 3 | Side-by-Side Job Description Paste & Keyword Gap Audit | F5, F6, F7 | High |
| 4 | Tailoring Depth Selection & Revision Steering with Custom Select | F6, F7, F8, F9 | High |
| 5 | Theme Toggle (Light to Dark) across Swiss Preview & Comparison Panels | F4, F6, F9 | Medium |
| 6 | Responsive Breakpoint Transitions (Desktop -> Tablet Dock -> Mobile Tabs) | F1, F6, F9 | High |

## Coverage Thresholds
- Tier 1: >= 5 test cases per feature (>= 50 test cases)
- Tier 2: >= 5 boundary/corner cases per feature (>= 50 test cases)
- Tier 3: Pairwise combinations across major features (>= 10 test cases)
- Tier 4: >= 6 realistic end-to-end user application workflows
- **Total Minimum Test Count: >= 116 test cases across unit, E2E, and python suites**
