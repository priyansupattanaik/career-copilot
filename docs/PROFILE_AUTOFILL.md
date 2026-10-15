# Profile Resume Autofill Subsystem

## Overview
The Profile Resume Autofill pipeline (`/profile/autofill/parse` and `/profile/autofill/apply`) extracts candidate information directly from uploaded resumes using structured LLM outputs, validates each extracted field against source text evidence to prevent hallucinations, and presents a non-destructive review workflow before committing changes.

## Pipeline Architecture

```
[Uploaded Resume PDF/DOCX]
            │
            ▼
[Plain Text Extraction & Cleaning]
            │
            ├─► Plain text length check (<= 40,000 chars)
            ├─► Rate limit check (5 requests / rolling hour per user)
            ├─► Cache check (resume_versions.structured_sections["profile_autofill"])
            │
            ▼
[Structured LLM Call with Failover]
  (NVIDIA Nemotron 30B ──fallback──► Groq Llama 3.3 70B)
  - Nonce-bracketed system & user prompts
  - Strict Pydantic schema validation
  - Reasoning marker stripping (<think>, [THOUGHT])
            │
            ▼
[Two-Stage Verification & Sanitization]
  - Unicode NFKC normalization
  - Substring evidence matching (3-160 chars)
  - Token-subset verification for multi-line summaries
  - Date token validation & chronological consistency
  - Quality score classification ("ok" | "partial" | "empty")
            │
            ▼
[Catalog Options Mapping & Value Derivation]
  - City / Role catalog matching with free-text pass-through
  - Experience interval merging & internship exclusion
  - Years of experience calculation: `total_months // 12`
  - Diff status comparison (`new` | `differs` | `duplicate`)
  - Defaults: `selected_by_default = (status in {"new", "differs"})`
            │
            ▼
[Caching in resume_versions.structured_sections]
            │
            ▼
[Client Review Dialog (`Review what we found`)]
            │
            ▼
[Stateless Apply (`POST /profile/autofill/apply`)]
  - Updates profiles, candidate_skills, candidate_experiences,
    candidate_education, and candidate_links
  - Recalculates 8-item profile completion
  - Writes activity event `profile_autofill_applied`
```

## Security & Nonce Protection
To defend against indirect prompt injections embedded in uploaded resume text, each extraction request generates a cryptographic 64-bit hex nonce:
- System prompt instructs the model that genuine instructions are bounded by `===BEGIN_NONCE_<hex>===` and `===END_NONCE_<hex>===`.
- Candidate resume text is provided within data boundaries and explicitly framed as untrusted user content.

## Verification Engine
The verifier (`verifier.py`) enforces strict hallucination defenses:
1. **Evidence Spans**: Non-null values must have an associated evidence snippet of 3–160 characters that exists as a verbatim substring (case- and whitespace-normalized) in the source resume text.
2. **Summaries**: Alphanumeric tokens in experience/project summaries must form a subset of the tokens in the source text.
3. **Date Verification**: Extracted years and month tokens must be present in the resume text.
4. **List Caps**: Skills (60), Experience (15), Education (6), Projects (12), Certifications (12), Links (10).
5. **Quality Assessment**:
   - `empty`: 0 verified items survived.
   - `partial`: >30% of returned items failed verification OR resume text < 200 chars.
   - `ok`: Verification succeeded with normal confidence.

## Endpoints

### 1. `POST /api/v1/profile/autofill/parse`
Parses a candidate's resume and returns proposed fields and diff statuses.

- **Request Body**:
  ```json
  {
    "resume_id": "uuid-string",
    "force": false,
    "only_fill_empty": true
  }
  ```
- **Response**:
  ```json
  {
    "quality": "ok",
    "source_summary": {
      "text_chars": 1420,
      "total_returned": 18,
      "kept_count": 18,
      "dropped_count": 0
    },
    "proposals": {
      "about": {
        "full_name": { "value": "Aria Nova", "status": "new", "selected_by_default": true },
        "current_role": { "value": "Junior Developer", "status": "new", "selected_by_default": true },
        "location": { "value": "Bengaluru, Karnataka, India", "status": "new", "selected_by_default": true },
        "years_of_experience": { "value": 0, "status": "new", "selected_by_default": true, "basis": "Calculated from 5 months of internship experience" }
      },
      "skills": [
        { "value": "Python", "status": "new", "selected_by_default": true }
      ],
      "experience": [...],
      "education": [...],
      "links": [...]
    }
  }
  ```
- **Error Codes**:
  - `400 PARSE_TEXT_EMPTY`: Resume document has no extractable plain text.
  - `413 PARSE_TOO_LONG`: Resume exceeds `resume_parse_max_text_chars` (40,000 chars).
  - `422 PARSE_INVALID`: Model failed structured generation or extraction was empty.
  - `429 PARSE_RATE_LIMITED`: User exceeded 5 parses per rolling hour.
  - `429 PARSE_BUSY`: Upstream LLM RPM limit reached.
  - `503 PARSE_UNAVAILABLE`: Total timeout (<10s remaining from 65s budget) or provider failure.

### 2. `POST /api/v1/profile/autofill/apply`
Statelessly applies the user-confirmed changes to their candidate profile.

- **Request Body**:
  ```json
  {
    "resume_id": "uuid-string",
    "changes": {
      "about": {
        "full_name": "Aria Nova",
        "current_role": "Junior Developer",
        "location": "Bengaluru, Karnataka, India",
        "years_of_experience": 0
      },
      "skills": ["Python", "FastAPI"],
      "experience": [...],
      "education": [...],
      "links": [...]
    }
  }
  ```
- **Response**:
  ```json
  {
    "applied": {
      "about": 4,
      "skills": 2,
      "experience": 1,
      "education": 1,
      "links": 2
    },
    "profile": { ...updated profile record... }
  }
  ```
