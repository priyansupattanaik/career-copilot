# Data model

**Canonical:** [DOCUMENTATION.md](./DOCUMENTATION.md) — section *Data model*.

## Stores

| Store | Role | Access |
|-------|------|--------|
| Supabase PostgreSQL (PostgREST) | Structured candidate data (31 relational tables) | FastAPI service role / PostgREST |
| Supabase Storage | Resumes, avatars, exports | FastAPI service role only |

Row Level Security (RLS) is configured across all candidate tables (`docs/database/supabase-schema.sql`). Direct client access is guarded; all product API access flows through the FastAPI backend.

## Ownership

Almost every candidate document includes `user_id` (profiles use `id` = user id). Handlers use `owned_row` / `owned_rows` from `database/repository.py`.

## Table / Entity groups

| Group | Tables |
|-------|-------------|
| Identity | `users`, `profiles` |
| Preferences | `candidate_preferences`, `notification_preferences`, `privacy_preferences` |
| Profile rows | `candidate_skills`, `candidate_experiences`, `candidate_projects`, `candidate_education`, `candidate_certifications`, `candidate_languages`, `candidate_links` |
| Documents | `resumes`, `resume_versions`, `job_descriptions` |
| ATS | `ats_analyses`, `ats_evidence` |
| Improvement | `resume_improvement_runs`, `resume_suggestions`, `resume_exports` |
| Interview | `interview_sessions`, `interview_questions`, `interview_responses`, `interview_reports` |
| Learning | `learning_paths`, `learning_items`, `learning_resources` |
| Jobs | `jobs`, `job_recommendations`, `saved_jobs` |
| Activity | `activity_events`, `user_notifications` |

## Document lifecycle (confirm gate)

```text
resume_versions / job_descriptions
  extraction_status: review_required → confirmed
  candidate_confirmed_at set on confirm
```

Resumes soft-delete via `deleted_at` (not hard delete of versions by default).

## Object storage layout

```text
{SUPABASE_STORAGE_BUCKET}/
  {DOCUMENT_BUCKET}/{user_id}/resumes/...
  {DOCUMENT_BUCKET}/{user_id}/job-descriptions/...
  {AVATAR_BUCKET}/{user_id}/avatars/...
```

Browser reads only through `GET /api/v1/files/{bucket}/{path}` with JWT and path ownership checks.
