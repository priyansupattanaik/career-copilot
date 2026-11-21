# Career Copilot API Reference

This document is extracted directly from the verified FastAPI routes and OpenAPI specifications.

- **Base Prefix**: `/api/v1`
- **Liveness Probes**: `/health/live`, `/api/health/live`, `/api/v1/health/live`
- **Response Error Envelope**: `{ "error": { "code": string, "message": string, "details": any, "request_id": string } }`

## Auth

| Method | Path | Authentication | Description |
|:---|:---|:---|:---|
| `POST` | `/api/v1/auth/confirm-email` | Public | Auth Confirm Email |
| `POST` | `/api/v1/auth/resend` | Public | Auth Resend |
| `POST` | `/api/v1/auth/reset-password` | Public | Auth Reset Password |
| `POST` | `/api/v1/auth/session` | Bearer JWT (Required) | Auth Session |
| `POST` | `/api/v1/auth/sign-in` | Public | Auth Sign In |
| `POST` | `/api/v1/auth/sign-out` | Bearer JWT (Required) | Auth Sign Out |
| `POST` | `/api/v1/auth/sign-up` | Public | Auth Sign Up |
| `POST` | `/api/v1/auth/supabase` | Bearer JWT (Required) | Auth Supabase |
| `POST` | `/api/v1/auth/update-password` | Bearer JWT (Required) | Auth Update Password |

## General

| Method | Path | Authentication | Description |
|:---|:---|:---|:---|
| `GET` | `/api/health` | Public |  Unversioned Health Live |
| `GET` | `/api/health/live` | Public |  Unversioned Health Live |
| `DELETE` | `/api/v1/account` | Bearer JWT (Required) | Delete Account |
| `GET` | `/api/v1/agents/status` | Bearer JWT (Required) | Agent Status |
| `GET` | `/api/v1/ats-analyses` | Bearer JWT (Required) | List Ats |
| `POST` | `/api/v1/ats-analyses` | Bearer JWT (Required) | Create Ats |
| `DELETE` | `/api/v1/ats-analyses/{analysis_id}` | Bearer JWT (Required) | Delete Ats |
| `GET` | `/api/v1/ats-analyses/{analysis_id}` | Bearer JWT (Required) | Get Ats |
| `GET` | `/api/v1/ats-analyses/{analysis_id}/evidence` | Bearer JWT (Required) | List Ats Evidence |
| `GET` | `/api/v1/files/{bucket}/{path}` | Bearer JWT (Required) | Authenticated File |
| `GET` | `/api/v1/health` | Bearer JWT (Required) | Health |
| `GET` | `/api/v1/health/database` | Bearer JWT (Required) | Health Database |
| `GET` | `/api/v1/health/live` | Public | Health Live |
| `GET` | `/api/v1/health/ready` | Public | Health Ready |
| `POST` | `/api/v1/interview-preparation` | Bearer JWT (Required) | Create Interview Preparation |
| `GET` | `/api/v1/interviews` | Bearer JWT (Required) | List Interviews |
| `POST` | `/api/v1/interviews` | Bearer JWT (Required) | Create Interview |
| `POST` | `/api/v1/interviews/commit` | Bearer JWT (Required) | Commit Interview |
| `POST` | `/api/v1/interviews/transcribe` | Bearer JWT (Required) | Interview Transcribe |
| `POST` | `/api/v1/interviews/tts` | Bearer JWT (Required) | Interview Tts |
| `GET` | `/api/v1/interviews/tts/status` | Bearer JWT (Required) | Interview Tts Status |
| `DELETE` | `/api/v1/interviews/{session_id}` | Bearer JWT (Required) | Delete Interview |
| `GET` | `/api/v1/interviews/{session_id}` | Bearer JWT (Required) | Get Interview |
| `POST` | `/api/v1/interviews/{session_id}/complete` | Bearer JWT (Required) | Complete Interview |
| `GET` | `/api/v1/interviews/{session_id}/report` | Bearer JWT (Required) | Get Interview Report |
| `POST` | `/api/v1/interviews/{session_id}/responses` | Bearer JWT (Required) | Add Response |
| `POST` | `/api/v1/interviews/{session_id}/start` | Bearer JWT (Required) | Start Interview |
| `GET` | `/api/v1/job-descriptions` | Bearer JWT (Required) | List Jds |
| `POST` | `/api/v1/job-descriptions` | Bearer JWT (Required) | Create Jd |
| `POST` | `/api/v1/job-descriptions/upload` | Bearer JWT (Required) | Upload Jd |
| `GET` | `/api/v1/job-descriptions/{jd_id}` | Bearer JWT (Required) | Get Jd |
| `POST` | `/api/v1/job-descriptions/{jd_id}/confirm` | Bearer JWT (Required) | Confirm Jd |
| `PATCH` | `/api/v1/job-descriptions/{jd_id}/extraction` | Bearer JWT (Required) | Patch Jd Extraction |
| `PATCH` | `/api/v1/job-descriptions/{jd_id}/metadata` | Bearer JWT (Required) | Patch Jd Metadata |
| `GET` | `/api/v1/job-recommendations` | Bearer JWT (Required) | List Job Recommendations |
| `POST` | `/api/v1/job-recommendations/generate` | Bearer JWT (Required) | Generate Job Recommendations |
| `GET` | `/api/v1/jobs` | Bearer JWT (Required) | List Jobs |
| `POST` | `/api/v1/jobs/external/sync` | Bearer JWT (Required) | Sync External Jobs |
| `GET` | `/api/v1/jobs/{job_id}` | Bearer JWT (Required) | Get Job |
| `GET` | `/api/v1/learning-paths` | Bearer JWT (Required) | List Learning |
| `POST` | `/api/v1/learning-paths` | Bearer JWT (Required) | Create Learning |
| `POST` | `/api/v1/learning-paths/generate` | Bearer JWT (Required) | Generate Learning Path |
| `DELETE` | `/api/v1/learning-paths/{path_id}` | Bearer JWT (Required) | Delete Learning Path |
| `GET` | `/api/v1/learning-paths/{path_id}` | Bearer JWT (Required) | Get Learning |
| `PATCH` | `/api/v1/learning-paths/{path_id}/items/{item_id}` | Bearer JWT (Required) | Update Learning Item |
| `PATCH` | `/api/v1/learning-paths/{path_id}/resources/{resource_id}` | Bearer JWT (Required) | Update Learning Resource Progress |
| `GET` | `/api/v1/me/activity` | Bearer JWT (Required) | List Activity |
| `GET` | `/api/v1/me/bootstrap` | Bearer JWT (Required) | Bootstrap |
| `GET` | `/api/v1/profile` | Bearer JWT (Required) | Get Profile |
| `PATCH` | `/api/v1/profile` | Bearer JWT (Required) | Update Profile |
| `DELETE` | `/api/v1/profile/avatar` | Bearer JWT (Required) | Delete Profile Avatar |
| `POST` | `/api/v1/profile/avatar` | Bearer JWT (Required) | Upload Profile Avatar |
| `POST` | `/api/v1/profile/autofill/apply` | Bearer JWT (Required) | Apply Profile Autofill Proposals |
| `POST` | `/api/v1/profile/autofill/parse` | Bearer JWT (Required) | Parse Resume For Profile Autofill |
| `POST` | `/api/v1/profile/from-resume/preview` | Bearer JWT (Required) | Preview Profile From Resume |
| `PUT` | `/api/v1/profile/preferences` | Bearer JWT (Required) | Update Preferences |
| `PATCH` | `/api/v1/profile/username` | Bearer JWT (Required) | Update Profile Username |
| `GET` | `/api/v1/profile/username/availability` | Bearer JWT (Required) | Username Availability |
| `GET` | `/api/v1/profile/{resource}` | Bearer JWT (Required) | List Candidate Records |
| `POST` | `/api/v1/profile/{resource}` | Bearer JWT (Required) | Create Candidate Record |
| `DELETE` | `/api/v1/profile/{resource}/{record_id}` | Bearer JWT (Required) | Delete Candidate Record |
| `PATCH` | `/api/v1/profile/{resource}/{record_id}` | Bearer JWT (Required) | Update Candidate Record |
| `GET` | `/api/v1/public/profiles/search` | Public | Search Public Profiles |
| `GET` | `/api/v1/public/profiles/{username}` | Public | Public Profile |
| `GET` | `/api/v1/public/username-availability` | Public | Public Username Availability |
| `GET` | `/api/v1/resume-versions/{version_id}` | Bearer JWT (Required) | Get Resume Version |
| `POST` | `/api/v1/resume-versions/{version_id}/confirm` | Bearer JWT (Required) | Confirm Resume Extraction |
| `PATCH` | `/api/v1/resume-versions/{version_id}/extraction` | Bearer JWT (Required) | Patch Resume Extraction |
| `GET` | `/api/v1/resumes` | Bearer JWT (Required) | List Resumes |
| `POST` | `/api/v1/resumes` | Bearer JWT (Required) | Create Resume |
| `DELETE` | `/api/v1/resumes/{resume_id}` | Bearer JWT (Required) | Delete Resume |
| `GET` | `/api/v1/resumes/{resume_id}` | Bearer JWT (Required) | Get Resume |
| `PATCH` | `/api/v1/resumes/{resume_id}` | Bearer JWT (Required) | Patch Resume |
| `POST` | `/api/v1/resumes/{resume_id}/activate` | Bearer JWT (Required) | Activate Resume |
| `GET` | `/api/v1/resumes/{resume_id}/preview` | Bearer JWT (Required) | Preview Resume |
| `POST` | `/api/v1/resumes/{resume_id}/versions` | Bearer JWT (Required) | Create Resume Version |
| `GET` | `/api/v1/saved-jobs` | Bearer JWT (Required) | List Saved Jobs |
| `DELETE` | `/api/v1/saved-jobs/{job_id}` | Bearer JWT (Required) | Unsave Job |
| `PATCH` | `/api/v1/saved-jobs/{job_id}` | Bearer JWT (Required) | Patch Saved Job |
| `POST` | `/api/v1/saved-jobs/{job_id}` | Bearer JWT (Required) | Save Job |
| `GET` | `/api/v1/settings` | Bearer JWT (Required) | Get Settings Records |
| `GET` | `/api/v1/settings/career-preferences` | Bearer JWT (Required) | Get Career Preferences Settings |
| `PUT` | `/api/v1/settings/career-preferences` | Bearer JWT (Required) | Update Settings Career Preferences |
| `GET` | `/api/v1/settings/notifications` | Bearer JWT (Required) | Get Notifications Settings |
| `PUT` | `/api/v1/settings/notifications` | Bearer JWT (Required) | Update Notifications |
| `GET` | `/api/v1/settings/privacy` | Bearer JWT (Required) | Get Privacy Settings |
| `PUT` | `/api/v1/settings/privacy` | Bearer JWT (Required) | Update Privacy |
| `GET` | `/health` | Public |  Unversioned Health Live |
| `GET` | `/health/live` | Public |  Unversioned Health Live |

## Ats Scoring

| Method | Path | Authentication | Description |
|:---|:---|:---|:---|
| `POST` | `/api/v1/ats/score` | Bearer JWT (Required) | Score |

## Resume Improvements

| Method | Path | Authentication | Description |
|:---|:---|:---|:---|
| `GET` | `/api/v1/resume-comparisons` | Bearer JWT (Required) | Compare Resume Versions |
| `GET` | `/api/v1/resume-exports/{export_id}/download` | Bearer JWT (Required) | Download Resume Export |
| `POST` | `/api/v1/resume-improvements` | Bearer JWT (Required) | Create Improvement |
| `GET` | `/api/v1/resume-improvements/capabilities` | Bearer JWT (Required) | Improvement Capabilities |
| `GET` | `/api/v1/resume-improvements/{run_id}` | Bearer JWT (Required) | Read Improvement |
| `POST` | `/api/v1/resume-improvements/{run_id}/apply` | Bearer JWT (Required) | Apply Improvement |
| `GET` | `/api/v1/resume-improvements/{run_id}/suggestions` | Bearer JWT (Required) | Read Improvement Suggestions |
| `PATCH` | `/api/v1/resume-suggestions/{suggestion_id}` | Bearer JWT (Required) | Update Suggestion Decision |
| `POST` | `/api/v1/resume-versions/{version_id}/exports` | Bearer JWT (Required) | Export Resume Version |

