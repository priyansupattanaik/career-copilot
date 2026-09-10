-- =============================================================================
-- Career Copilot - Complete Supabase PostgreSQL Schema
-- =============================================================================
-- Optimized for Supabase PostgreSQL with PostgREST, Row Level Security (RLS),
-- cascading foreign keys, covering indexes, and partial indexes for soft deletes.
-- =============================================================================

-- Extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- 1. Identity & Profile
-- -----------------------------------------------------------------------------

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  full_name text,
  password_hash text default '',
  token_version integer not null default 0,
  phone text,
  username text,
  supabase_uid text unique,
  auth_provider text default 'email',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_users_email on public.users (email);
create index if not exists idx_users_supabase_uid on public.users (supabase_uid);
create index if not exists idx_users_phone on public.users (phone);
create unique index if not exists users_username_lower_unique
  on public.users (lower(username))
  where username is not null;

create table if not exists public.profiles (
  id uuid primary key references public.users(id) on delete cascade,
  username text,
  full_name text,
  phone text,
  avatar_url text,
  avatar_path text,
  target_role text,
  years_experience numeric,
  profile_completion integer default 0,
  profile_completion_details jsonb default '{}'::jsonb,
  bio text,
  location text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists profiles_username_lower_unique
  on public.profiles (lower(username))
  where username is not null;

-- -----------------------------------------------------------------------------
-- 2. Preferences
-- -----------------------------------------------------------------------------

create table if not exists public.candidate_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  target_roles jsonb default '[]'::jsonb,
  locations jsonb default '[]'::jsonb,
  work_modes jsonb default '[]'::jsonb,
  salary_currency text default 'USD',
  salary_min numeric,
  salary_max numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  email_alerts boolean default true,
  job_recommendations boolean default true,
  interview_reminders boolean default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.privacy_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  public_profile boolean default false,
  analytics_sharing boolean default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- 3. Candidate Profile Details
-- -----------------------------------------------------------------------------

create table if not exists public.candidate_skills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  category text,
  level text,
  created_at timestamptz not null default now()
);
create index if not exists idx_candidate_skills_user_id on public.candidate_skills (user_id);

create table if not exists public.candidate_experiences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  company text not null,
  role text not null,
  start_date text,
  end_date text,
  is_current boolean default false,
  description text,
  highlights jsonb default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_candidate_experiences_user_id on public.candidate_experiences (user_id);

create table if not exists public.candidate_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  description text,
  role text,
  technologies jsonb default '[]'::jsonb,
  url text,
  created_at timestamptz not null default now()
);
create index if not exists idx_candidate_projects_user_id on public.candidate_projects (user_id);

create table if not exists public.candidate_education (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  institution text not null,
  degree text,
  field_of_study text,
  start_date text,
  end_date text,
  created_at timestamptz not null default now()
);
create index if not exists idx_candidate_education_user_id on public.candidate_education (user_id);

create table if not exists public.candidate_certifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  issuer text,
  issue_date text,
  expiry_date text,
  credential_id text,
  credential_url text,
  created_at timestamptz not null default now()
);
create index if not exists idx_candidate_certifications_user_id on public.candidate_certifications (user_id);

create table if not exists public.candidate_languages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  language text not null,
  proficiency text,
  created_at timestamptz not null default now()
);
create index if not exists idx_candidate_languages_user_id on public.candidate_languages (user_id);

create table if not exists public.candidate_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  label text,
  url text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_candidate_links_user_id on public.candidate_links (user_id);

-- -----------------------------------------------------------------------------
-- 4. Resumes & Documents
-- -----------------------------------------------------------------------------

create table if not exists public.resumes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  title text,
  is_active boolean not null default true,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_resumes_user_id on public.resumes (user_id);
create index if not exists idx_resumes_active_user on public.resumes (user_id, is_active) where deleted_at is null;

create table if not exists public.resume_versions (
  id uuid primary key default gen_random_uuid(),
  resume_id uuid not null references public.resumes(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  version_number integer default 1,
  source_type text,
  original_filename text,
  storage_path text,
  raw_text text,
  structured_sections jsonb default '{}'::jsonb,
  extraction_status text default 'review_required',
  candidate_confirmed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_resume_versions_user_id on public.resume_versions (user_id);
create index if not exists idx_resume_versions_resume_id on public.resume_versions (resume_id);

create table if not exists public.job_descriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  title text,
  company text,
  role_title text,
  storage_path text,
  raw_text text,
  extracted_keywords jsonb default '[]'::jsonb,
  extraction_status text default 'review_required',
  candidate_confirmed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_job_descriptions_user_id on public.job_descriptions (user_id);

-- -----------------------------------------------------------------------------
-- 5. ATS Scoring & Evidence
-- -----------------------------------------------------------------------------

create table if not exists public.ats_analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  resume_version_id uuid,
  job_description_id uuid,
  overall_score integer,
  breakdown jsonb default '{}'::jsonb,
  status text default 'pending',
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_ats_analyses_user_id on public.ats_analyses (user_id);
create index if not exists idx_ats_analyses_completed on public.ats_analyses (user_id, status, completed_at desc);

create table if not exists public.ats_evidence (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null references public.ats_analyses(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  category text,
  finding text,
  match_status text,
  source_reference text,
  created_at timestamptz not null default now()
);
create index if not exists idx_ats_evidence_analysis_id on public.ats_evidence (analysis_id);
create index if not exists idx_ats_evidence_user_id on public.ats_evidence (user_id);

-- -----------------------------------------------------------------------------
-- 6. Resume Improvement
-- -----------------------------------------------------------------------------

create table if not exists public.resume_improvement_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  resume_version_id uuid references public.resume_versions(id) on delete set null,
  status text default 'pending',
  created_at timestamptz not null default now()
);
create index if not exists idx_resume_improvement_runs_user on public.resume_improvement_runs (user_id);

create table if not exists public.resume_suggestions (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.resume_improvement_runs(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  section text,
  original_text text,
  suggested_text text,
  rationale text,
  status text default 'pending',
  created_at timestamptz not null default now()
);
create index if not exists idx_resume_suggestions_run_id on public.resume_suggestions (run_id);
create index if not exists idx_resume_suggestions_user_id on public.resume_suggestions (user_id);

create table if not exists public.resume_exports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  resume_version_id uuid references public.resume_versions(id) on delete set null,
  format text not null,
  storage_path text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_resume_exports_user_id on public.resume_exports (user_id);

-- -----------------------------------------------------------------------------
-- 7. Mock Interview Sessions
-- -----------------------------------------------------------------------------

create table if not exists public.interview_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  mode text,
  target_role text,
  target_company text,
  status text default 'created',
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_interview_sessions_user_id on public.interview_sessions (user_id);

create table if not exists public.interview_questions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.interview_sessions(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  question_index integer default 0,
  question_text text not null,
  category text,
  created_at timestamptz not null default now()
);
create index if not exists idx_interview_questions_session_id on public.interview_questions (session_id);
create index if not exists idx_interview_questions_user_id on public.interview_questions (user_id);

create table if not exists public.interview_responses (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.interview_questions(id) on delete cascade,
  session_id uuid not null references public.interview_sessions(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  audio_path text,
  transcript text,
  evaluation jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_interview_responses_session_id on public.interview_responses (session_id);
create index if not exists idx_interview_responses_user_id on public.interview_responses (user_id);

create table if not exists public.interview_reports (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.interview_sessions(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  overall_score integer,
  communication_score integer,
  structure_score integer,
  content_score integer,
  report jsonb default '{}'::jsonb,
  status text default 'completed',
  created_at timestamptz not null default now()
);
create index if not exists idx_interview_reports_session_id on public.interview_reports (session_id);
create index if not exists idx_interview_reports_user_id on public.interview_reports (user_id);

-- -----------------------------------------------------------------------------
-- 8. Learning Paths
-- -----------------------------------------------------------------------------

create table if not exists public.learning_paths (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  title text not null,
  target_skill text,
  status text default 'in_progress',
  progress_percent integer default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_learning_paths_user_id on public.learning_paths (user_id);

create table if not exists public.learning_items (
  id uuid primary key default gen_random_uuid(),
  learning_path_id uuid not null references public.learning_paths(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  title text not null,
  status text default 'pending',
  progress_percent integer default 0,
  item_order integer default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_learning_items_path_id on public.learning_items (learning_path_id);
create index if not exists idx_learning_items_user_id on public.learning_items (user_id);

create table if not exists public.learning_resources (
  id uuid primary key default gen_random_uuid(),
  learning_item_id uuid not null references public.learning_items(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  title text not null,
  url text not null,
  resource_type text,
  duration_minutes integer,
  is_completed boolean default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_learning_resources_item_id on public.learning_resources (learning_item_id);
create index if not exists idx_learning_resources_user_id on public.learning_resources (user_id);

-- -----------------------------------------------------------------------------
-- 9. Jobs & Recommendations
-- -----------------------------------------------------------------------------

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  external_id text,
  title text not null,
  company text not null,
  location text,
  work_mode text,
  description text,
  url text,
  source text,
  created_at timestamptz not null default now()
);
create index if not exists idx_jobs_external_id on public.jobs (external_id);

create table if not exists public.job_recommendations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  job_id uuid references public.jobs(id) on delete cascade,
  match_score integer default 0,
  score_breakdown jsonb default '{}'::jsonb,
  status text default 'recommended',
  created_at timestamptz not null default now()
);
create index if not exists idx_job_recommendations_user_id on public.job_recommendations (user_id);

create table if not exists public.saved_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  job_id text not null,
  title text,
  company text,
  location text,
  work_mode text,
  url text,
  source text,
  status text default 'saved',
  saved_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique(user_id, job_id)
);
create index if not exists idx_saved_jobs_user_id on public.saved_jobs (user_id);

-- -----------------------------------------------------------------------------
-- 10. Activity Events & Diagnostics
-- -----------------------------------------------------------------------------

create table if not exists public.activity_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  event_type text not null,
  summary text not null,
  entity_type text,
  entity_id text,
  created_at timestamptz not null default now()
);
create index if not exists idx_activity_events_user_id on public.activity_events (user_id, created_at desc);

create table if not exists public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  title text not null,
  message text not null,
  is_read boolean default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_user_notifications_user_id on public.user_notifications (user_id);

-- Diagnostic table used by database_probe and health readiness checks
create table if not exists public._setup_checks (
  id text primary key,
  kind text,
  created_at timestamptz default now()
);

-- -----------------------------------------------------------------------------
-- 11. Row Level Security (RLS)
-- -----------------------------------------------------------------------------
-- Enable RLS on all tables
alter table public.users enable row level security;
alter table public.profiles enable row level security;
alter table public.candidate_preferences enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.privacy_preferences enable row level security;
alter table public.candidate_skills enable row level security;
alter table public.candidate_experiences enable row level security;
alter table public.candidate_projects enable row level security;
alter table public.candidate_education enable row level security;
alter table public.candidate_certifications enable row level security;
alter table public.candidate_languages enable row level security;
alter table public.candidate_links enable row level security;
alter table public.resumes enable row level security;
alter table public.resume_versions enable row level security;
alter table public.job_descriptions enable row level security;
alter table public.ats_analyses enable row level security;
alter table public.ats_evidence enable row level security;
alter table public.resume_improvement_runs enable row level security;
alter table public.resume_suggestions enable row level security;
alter table public.resume_exports enable row level security;
alter table public.interview_sessions enable row level security;
alter table public.interview_questions enable row level security;
alter table public.interview_responses enable row level security;
alter table public.interview_reports enable row level security;
alter table public.learning_paths enable row level security;
alter table public.learning_items enable row level security;
alter table public.learning_resources enable row level security;
alter table public.jobs enable row level security;
alter table public.job_recommendations enable row level security;
alter table public.saved_jobs enable row level security;
alter table public.activity_events enable row level security;
alter table public.user_notifications enable row level security;

-- Service role bypasses RLS automatically. For authenticated users:
create policy "Users can view and edit their own record"
  on public.users for all
  using (id = (select auth.uid()));

create policy "Users can view and edit their own profile"
  on public.profiles for all
  using (id = (select auth.uid()));

create policy "Users can manage their own candidate preferences"
  on public.candidate_preferences for all
  using (user_id = (select auth.uid()));

create policy "Users can manage their own notification preferences"
  on public.notification_preferences for all
  using (user_id = (select auth.uid()));

create policy "Users can manage their own privacy preferences"
  on public.privacy_preferences for all
  using (user_id = (select auth.uid()));

create policy "Users can manage their own skills"
  on public.candidate_skills for all
  using (user_id = (select auth.uid()));

create policy "Users can manage their own experiences"
  on public.candidate_experiences for all
  using (user_id = (select auth.uid()));

create policy "Users can manage their own projects"
  on public.candidate_projects for all
  using (user_id = (select auth.uid()));

create policy "Users can manage their own education"
  on public.candidate_education for all
  using (user_id = (select auth.uid()));

create policy "Users can manage their own certifications"
  on public.candidate_certifications for all
  using (user_id = (select auth.uid()));

create policy "Users can manage their own languages"
  on public.candidate_languages for all
  using (user_id = (select auth.uid()));

create policy "Users can manage their own links"
  on public.candidate_links for all
  using (user_id = (select auth.uid()));

create policy "Users can manage their own resumes"
  on public.resumes for all
  using (user_id = (select auth.uid()));

create policy "Users can manage their own resume versions"
  on public.resume_versions for all
  using (user_id = (select auth.uid()));

create policy "Users can manage their own job descriptions"
  on public.job_descriptions for all
  using (user_id = (select auth.uid()));

create policy "Users can manage their own ats analyses"
  on public.ats_analyses for all
  using (user_id = (select auth.uid()));

create policy "Users can manage their own ats evidence"
  on public.ats_evidence for all
  using (user_id = (select auth.uid()));

create policy "Users can manage their own improvement runs"
  on public.resume_improvement_runs for all
  using (user_id = (select auth.uid()));

create policy "Users can manage their own suggestions"
  on public.resume_suggestions for all
  using (user_id = (select auth.uid()));

create policy "Users can manage their own exports"
  on public.resume_exports for all
  using (user_id = (select auth.uid()));

create policy "Users can manage their own interview sessions"
  on public.interview_sessions for all
  using (user_id = (select auth.uid()));

create policy "Users can manage their own interview questions"
  on public.interview_questions for all
  using (user_id = (select auth.uid()));

create policy "Users can manage their own interview responses"
  on public.interview_responses for all
  using (user_id = (select auth.uid()));

create policy "Users can manage their own interview reports"
  on public.interview_reports for all
  using (user_id = (select auth.uid()));

create policy "Users can manage their own learning paths"
  on public.learning_paths for all
  using (user_id = (select auth.uid()));

create policy "Users can manage their own learning items"
  on public.learning_items for all
  using (user_id = (select auth.uid()));

create policy "Users can manage their own learning resources"
  on public.learning_resources for all
  using (user_id = (select auth.uid()));

create policy "Users can view jobs"
  on public.jobs for select
  using (true);

create policy "Users can manage their own job recommendations"
  on public.job_recommendations for all
  using (user_id = (select auth.uid()));

create policy "Users can manage their own saved jobs"
  on public.saved_jobs for all
  using (user_id = (select auth.uid()));

create policy "Users can manage their own activity events"
  on public.activity_events for all
  using (user_id = (select auth.uid()));

create policy "Users can manage their own notifications"
  on public.user_notifications for all
  using (user_id = (select auth.uid()));

-- Diagnostic table: RLS on, no policies. Only BYPASSRLS (service_role) can use it.
alter table public._setup_checks enable row level security;

-- -----------------------------------------------------------------------------
-- 12. Data API grants (required after the 2026 explicit-grant change)
-- FastAPI uses the secret / service_role key. The browser never talks to
-- PostgREST, so table DML is granted only to service_role.
-- -----------------------------------------------------------------------------
grant usage on schema public to anon, authenticated, service_role;

grant select, insert, update, delete on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant all on all routines in schema public to service_role;

alter default privileges for role postgres in schema public
  grant select, insert, update, delete on tables to service_role;
alter default privileges for role postgres in schema public
  grant all on sequences to service_role;

notify pgrst, 'reload schema';
