#!/usr/bin/env python3
"""Verify all data for a given user end-to-end in Supabase."""

import argparse
import json
import sys
from pathlib import Path

import httpx

ROOT_DIR = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT_DIR / "backend"))

from app.core.config import get_settings

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
sys.stderr.reconfigure(encoding="utf-8", errors="replace")


def main() -> None:
    parser = argparse.ArgumentParser(description="Verify user data across Supabase tables and storage.")
    parser.add_argument("--email", default="ircpriyanshu@gmail.com", help="Email to verify (default: ircpriyanshu@gmail.com)")
    args = parser.parse_args()

    settings = get_settings()
    url = settings.resolved_supabase_url
    key = settings.supabase_server_key
    headers = {"apikey": key, "Authorization": f"Bearer {key}"}

    client = httpx.Client(timeout=30)
    email = args.email.strip().lower()

    print(f"\n=======================================================")
    print(f"VERIFYING DATA IN SUPABASE FOR: {email}")
    print(f"Supabase Project: {settings.supabase_project_ref} ({url})")
    print(f"=======================================================\n")

    # 1. Lookup user
    r = client.get(f"{url}/rest/v1/users?email=eq.{email}&select=*", headers=headers)
    users = r.json() if r.status_code == 200 else []
    if not users:
        print(f"❌ User with email '{email}' NOT FOUND in Supabase 'users' table!")
        sys.exit(1)

    user = users[0]
    user_id = user["id"]
    print(f"✅ User record found in 'users' table:")
    print(f"   - ID: {user_id}")
    print(f"   - Email: {user.get('email')}")
    print(f"   - Full Name: {user.get('full_name')}")
    print(f"   - Supabase UID: {user.get('supabase_uid')}")
    print(f"   - Phone: {user.get('phone')}")
    print(f"   - Auth Provider: {user.get('auth_provider')}")

    # 2. Check profile
    r_prof = client.get(f"{url}/rest/v1/profiles?id=eq.{user_id}&select=*", headers=headers)
    profs = r_prof.json() if r_prof.status_code == 200 else []
    if profs:
        prof = profs[0]
        print(f"✅ Profile found: full_name='{prof.get('full_name')}', username='{prof.get('username')}', avatar_path='{prof.get('avatar_path')}'")
    else:
        print(f"⚠️ Profile record not found for user {user_id}")

    # 3. Check all candidate tables
    candidate_tables = [
        "candidate_preferences",
        "candidate_skills",
        "candidate_experiences",
        "candidate_projects",
        "candidate_education",
        "candidate_certifications",
        "candidate_languages",
        "candidate_links",
        "resumes",
        "resume_versions",
        "job_descriptions",
        "ats_analyses",
        "interview_sessions",
        "interview_reports",
        "learning_paths",
        "saved_jobs",
        "job_recommendations",
        "notification_preferences",
        "privacy_preferences",
    ]

    print("\n--- USER DATA ROW COUNTS IN SUPABASE ---")
    for tbl in candidate_tables:
        col = "user_id"
        r_tbl = client.get(f"{url}/rest/v1/{tbl}?{col}=eq.{user_id}&select=id", headers={**headers, "Prefer": "count=exact", "Range": "0-0"})
        content_range = r_tbl.headers.get("content-range", "")
        count = content_range.split("/")[-1] if "/" in content_range else "0"
        status_symbol = "✅" if count not in ("0", "*") else "⚠️"
        print(f"{status_symbol} {tbl}: {count} records (range: {content_range})")

    # 4. Detailed preview for resumes
    r_res = client.get(f"{url}/rest/v1/resumes?user_id=eq.{user_id}&select=id,title,is_active,created_at", headers=headers)
    resumes = r_res.json() if r_res.status_code == 200 else []
    print(f"\n--- RESUMES ({len(resumes)}) ---")
    for res in resumes:
        r_vers = client.get(f"{url}/rest/v1/resume_versions?resume_id=eq.{res['id']}&select=id,version_number,storage_path,original_filename", headers=headers)
        versions = r_vers.json() if r_vers.status_code == 200 else []
        print(f"   * Resume: '{res.get('title')}' (ID: {res['id']}, Active: {res.get('is_active')})")
        for v in versions:
            print(f"     -> Version {v.get('version_number')}: '{v.get('original_filename')}' | Path: {v.get('storage_path')}")

    # 5. Skills sample
    r_skills = client.get(f"{url}/rest/v1/candidate_skills?user_id=eq.{user_id}&select=name,category&limit=10", headers=headers)
    skills = r_skills.json() if r_skills.status_code == 200 else []
    if skills:
        skill_names = [s.get("name") for s in skills]
        print(f"\n--- SKILLS SAMPLE ({len(skill_names)} of total) ---")
        print(f"   {', '.join(filter(None, skill_names))}...")

    # 6. Interview session preview
    r_int = client.get(f"{url}/rest/v1/interview_sessions?user_id=eq.{user_id}&select=id,mode,status,created_at", headers=headers)
    sessions = r_int.json() if r_int.status_code == 200 else []
    print(f"\n--- INTERVIEW SESSIONS ({len(sessions)}) ---")
    for s in sessions:
        r_rep = client.get(f"{url}/rest/v1/interview_reports?session_id=eq.{s['id']}&select=overall_score,communication_score", headers=headers)
        rep = r_rep.json() if r_rep.status_code == 200 else []
        score_info = f"Score: {rep[0].get('overall_score')}" if rep else "No report"
        print(f"   * Session {s['id'][:8]}: Mode={s.get('mode')} Status={s.get('status')} {score_info}")

    print("\n=======================================================")
    print("VERIFICATION COMPLETE!")
    print("=======================================================\n")


if __name__ == "__main__":
    main()
