# Slop-fix board

Working tree only. No branch, no commit.

| Card | Owner | Files | State | Gate |
| --- | --- | --- | --- | --- |
| Dashboard chrome | dashboard | `frontend/src/features/dashboard/components/dashboard.tsx` | merged locally | One “Workspace” crumb. Sentence-case actions. Intelligence line gone. |
| Team names | team | `frontend/src/components/ui/team-5.tsx`, name color in `globals.css` | merged locally | Five names readable at rest. |
| Learning card | learning | `frontend/src/features/learning/learning.css`, sparkle removed in `learning.tsx` | merged locally | `flex-direction: column`. Card no longer collides. |
| Empty interview orb | interview | `frontend/src/features/interview/components/interview-session.tsx` | merged locally | Aura count 0 when the demo session has no questions. Camera and empty copy remain. |
| Dark surfaces, noise, loader | integrator | `frontend/src/globals.css`, `frontend/src/shared/ui/book-loader.css` | merged locally | Dark body background `rgb(7, 17, 26)`. Noise `z-index: 1`. Book loader is blue. |

## Evidence

- `npx tsc -p tsconfig.app.json --noEmit` passed.
- `breadcrumb-5.test.ts`: 2 passed.
- ESLint on the touched TSX files: no errors.
- Screenshots in this folder.
- `/ada-lovelace` still renders “Page not found”.

## Left alone

Username pattern, ATS score math, auth, landing lime, and the shared workspace title size. A later rule already sets workspace titles to weight 600 and about 2.25rem.
