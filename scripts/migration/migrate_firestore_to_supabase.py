#!/usr/bin/env python3
"""Migrate all user and application data from Firebase Firestore to Supabase PostgreSQL.

Reads all documents from Firestore via REST API using the Firebase Admin Service Account key,
decodes and maps fields to Supabase PostgreSQL schema, validates foreign keys, and batch-upserts
via PostgREST in topological dependency order.

Usage:
    python scripts/migration/migrate_firestore_to_supabase.py [--dry-run]
"""

import argparse
import json
import logging
import os
import sys
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

import httpx
from google.auth.transport.requests import Request
from google.oauth2 import service_account

# Ensure backend directory is in path to import app config if needed
ROOT_DIR = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT_DIR / "backend"))

from app.core.config import get_settings

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("migration")


def decode_firestore_value(val: dict) -> Any:
    """Recursively decode Firestore REST API typed values into Python types."""
    if not isinstance(val, dict):
        return val
    if "stringValue" in val:
        return val["stringValue"]
    if "integerValue" in val:
        try:
            return int(val["integerValue"])
        except ValueError:
            return val["integerValue"]
    if "doubleValue" in val:
        return float(val["doubleValue"])
    if "booleanValue" in val:
        return bool(val["booleanValue"])
    if "timestampValue" in val:
        return val["timestampValue"]
    if "nullValue" in val:
        return None
    if "mapValue" in val:
        fields = val["mapValue"].get("fields", {})
        return {k: decode_firestore_value(v) for k, v in fields.items()}
    if "arrayValue" in val:
        values = val["arrayValue"].get("values", [])
        return [decode_firestore_value(v) for v in values]
    if "referenceValue" in val:
        return val["referenceValue"].split("/")[-1]
    if "geoPointValue" in val:
        return val["geoPointValue"]
    if "bytesValue" in val:
        return val["bytesValue"]
    return val


def decode_firestore_doc(doc: dict) -> dict:
    """Extract doc ID and decode all fields."""
    doc_id = doc.get("name", "").split("/")[-1]
    raw_fields = doc.get("fields", {})
    data = {k: decode_firestore_value(v) for k, v in raw_fields.items()}
    if "id" not in data or not data["id"]:
        data["id"] = doc_id
    return data


class FirestoreToSupabaseMigrator:
    def __init__(self, dry_run: bool = False):
        self.dry_run = dry_run
        self.settings = get_settings()
        self.client = httpx.Client(timeout=60)
        self.fs_token: Optional[str] = None
        self.project_id = "career-copilot05"
        self.sb_columns: Dict[str, Set[str]] = {}
        self.all_fs_docs: Dict[str, List[dict]] = {}

        self.existing_by_user: Dict[str, Dict[str, str]] = {}
        self.existing_saved_jobs: Dict[Tuple[str, str], str] = {}
        self.existing_users_by_email: Dict[str, str] = {}
        self.user_id_remap: Dict[str, str] = {}

        # Track valid IDs to enforce foreign key integrity
        self.valid_ids: Dict[str, Set[str]] = {
            "users": set(),
            "profiles": set(),
            "jobs": set(),
            "resumes": set(),
            "resume_versions": set(),
            "job_descriptions": set(),
            "ats_analyses": set(),
            "interview_sessions": set(),
            "interview_questions": set(),
            "learning_paths": set(),
            "learning_items": set(),
            "resume_improvement_runs": set(),
        }

    def init_firestore(self) -> None:
        """Authenticate with Firebase using service account key."""
        cred_path = os.environ.get("FIREBASE_CREDENTIALS_PATH") or "./secrets/career-copilot05-firebase-adminsdk-fbsvc-62f08f3eea.json"
        p = Path(cred_path)
        if not p.is_absolute():
            p = ROOT_DIR / p
        if not p.exists():
            raise FileNotFoundError(f"Firebase credentials not found at: {p}")

        scopes = ["https://www.googleapis.com/auth/datastore", "https://www.googleapis.com/auth/cloud-platform"]
        creds = service_account.Credentials.from_service_account_file(str(p), scopes=scopes)
        creds.refresh(Request())
        self.fs_token = creds.token
        self.project_id = os.environ.get("FIREBASE_PROJECT_ID", "career-copilot05")
        logger.info("Authenticated with Firebase Firestore successfully (project: %s).", self.project_id)

    def init_supabase(self) -> None:
        """Verify Supabase PostgREST connection, fetch table definitions, and cache existing unique constraints."""
        url = self.settings.resolved_supabase_url
        key = self.settings.supabase_server_key
        if not url or not key:
            raise ValueError("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing.")

        headers = {"apikey": key, "Authorization": f"Bearer {key}"}
        resp = self.client.get(f"{url}/rest/v1/", headers=headers)
        if resp.status_code != 200:
            raise RuntimeError(f"Could not reach Supabase PostgREST ({resp.status_code}): {resp.text}")

        spec = resp.json()
        definitions = spec.get("definitions", {})
        for table, schema in definitions.items():
            props = schema.get("properties", {})
            self.sb_columns[table] = set(props.keys())

        logger.info("Fetched %d table schemas from Supabase PostgREST.", len(self.sb_columns))

        # Cache existing users by email to avoid unique email conflicts
        r_u = self.client.get(f"{url}/rest/v1/users?select=id,email", headers=headers)
        if r_u.status_code == 200:
            for u in r_u.json():
                if u.get("email") and u.get("id"):
                    self.existing_users_by_email[u["email"].lower()] = str(u["id"])
                    self.valid_ids["users"].add(str(u["id"]))

        # Cache existing records for tables where user_id is unique
        for tbl in ("candidate_preferences", "notification_preferences", "privacy_preferences"):
            self.existing_by_user[tbl] = {}
            r = self.client.get(f"{url}/rest/v1/{tbl}?select=id,user_id", headers=headers)
            if r.status_code == 200:
                for row in r.json():
                    if row.get("user_id") and row.get("id"):
                        self.existing_by_user[tbl][str(row["user_id"])] = str(row["id"])

        # Cache saved_jobs (unique on user_id, job_id)
        r_sj = self.client.get(f"{url}/rest/v1/saved_jobs?select=id,user_id,job_id", headers=headers)
        if r_sj.status_code == 200:
            for row in r_sj.json():
                if row.get("user_id") and row.get("job_id") and row.get("id"):
                    self.existing_saved_jobs[(str(row["user_id"]), str(row["job_id"]))] = str(row["id"])

    def fetch_firestore_collection(self, collection_id: str) -> List[dict]:
        """Page through all documents in a Firestore collection."""
        base_url = f"https://firestore.googleapis.com/v1/projects/{self.project_id}/databases/(default)/documents"
        headers = {"Authorization": f"Bearer {self.fs_token}"}
        docs: List[dict] = []
        page_token: Optional[str] = None

        while True:
            url = f"{base_url}/{collection_id}?pageSize=300"
            if page_token:
                url += f"&pageToken={page_token}"
            resp = self.client.get(url, headers=headers)
            if resp.status_code != 200:
                logger.error("Failed to fetch Firestore collection %s: %s %s", collection_id, resp.status_code, resp.text)
                break
            data = resp.json()
            items = data.get("documents", [])
            for item in items:
                docs.append(decode_firestore_doc(item))
            page_token = data.get("nextPageToken")
            if not page_token:
                break

        return docs

    def fetch_all_firestore_data(self) -> None:
        """Download all documents across all Firestore collections into memory."""
        base_url = f"https://firestore.googleapis.com/v1/projects/{self.project_id}/databases/(default)/documents"
        headers = {"Authorization": f"Bearer {self.fs_token}"}

        resp = self.client.post(f"{base_url}:listCollectionIds", headers=headers, json={})
        collections = resp.json().get("collectionIds", [])
        logger.info("Discovered %d Firestore collections: %s", len(collections), collections)

        total_docs = 0
        for col in collections:
            if col == "_setup_checks":
                continue
            docs = self.fetch_firestore_collection(col)
            self.all_fs_docs[col] = docs
            total_docs += len(docs)
            logger.info("Downloaded %d documents from Firestore collection '%s'.", len(docs), col)

        logger.info("Total Firestore documents fetched: %d", total_docs)

    def link_supabase_auth_users(self, users_data: List[dict]) -> List[dict]:
        """Ensure users have their supabase_uid correctly linked if an auth account exists."""
        url = self.settings.resolved_supabase_url
        key = self.settings.supabase_server_key
        headers = {"apikey": key, "Authorization": f"Bearer {key}"}

        try:
            resp = self.client.get(f"{url}/auth/v1/admin/users", headers=headers)
            if resp.status_code == 200:
                auth_users = {u["email"].lower(): u["id"] for u in resp.json().get("users", [])}
                logger.info("Found %d existing Supabase Auth users to link.", len(auth_users))
                for u in users_data:
                    email = str(u.get("email") or "").lower()
                    if email in auth_users:
                        u["supabase_uid"] = auth_users[email]
        except Exception as exc:
            logger.warning("Could not fetch Supabase Auth users for auto-linking: %s", exc)

        return users_data

    def transform_row(self, table: str, row: dict) -> Optional[dict]:
        """Transform Firestore fields to match Supabase table schema."""
        out = dict(row)

        # Apply any user_id remapping
        if "user_id" in out and str(out["user_id"]) in self.user_id_remap:
            out["user_id"] = self.user_id_remap[str(out["user_id"])]

        # 1. users
        if table == "users":
            if not out.get("email"):
                return None
            email = str(out["email"]).strip().lower()
            out["email"] = email
            if not out.get("supabase_uid"):
                out["supabase_uid"] = None  # Prevent empty string unique collision
            if not out.get("password_hash"):
                out["password_hash"] = ""
            try:
                out["token_version"] = int(out.get("token_version") or 0)
            except (ValueError, TypeError):
                out["token_version"] = 0
            if "auth_provider" not in out:
                out["auth_provider"] = "email"

            # If user already exists in Supabase by email, reuse that ID and remap child rows
            if email in self.existing_users_by_email:
                target_id = self.existing_users_by_email[email]
                orig_id = str(out.get("id") or "")
                if orig_id and orig_id != target_id:
                    self.user_id_remap[orig_id] = target_id
                out["id"] = target_id

        # 2. profiles
        elif table == "profiles":
            orig_id = str(out.get("id") or "")
            if orig_id in self.user_id_remap:
                out["id"] = self.user_id_remap[orig_id]
            if not out.get("username"):
                out["username"] = None
            if "profile_completion_details" in out and not isinstance(out["profile_completion_details"], dict):
                out["profile_completion_details"] = {}

        # 3. Tables with user_id unique constraints
        elif table in ("candidate_preferences", "notification_preferences", "privacy_preferences"):
            uid = str(out.get("user_id") or "")
            if uid in self.existing_by_user.get(table, {}):
                out["id"] = self.existing_by_user[table][uid]
            if table == "candidate_preferences":
                for k in ("target_roles", "locations", "work_modes"):
                    if k in out and not isinstance(out[k], list):
                        out[k] = []

        # 4. candidate_experiences
        elif table == "candidate_experiences":
            if "company_name" in out and not out.get("company"):
                out["company"] = out.pop("company_name")
            if not out.get("company"):
                out["company"] = "Unknown Company"
            if "role_title" in out and not out.get("role"):
                out["role"] = out.pop("role_title")
            if not out.get("role"):
                out["role"] = "Candidate"
            if "summary" in out and not out.get("description"):
                out["description"] = out.pop("summary")
            if "highlights" in out and not isinstance(out["highlights"], list):
                out["highlights"] = []

        # 5. candidate_projects
        elif table == "candidate_projects":
            if "title" in out and not out.get("name"):
                out["name"] = out.pop("title")
            if not out.get("name"):
                out["name"] = "Project"
            if "skills" in out and not out.get("technologies"):
                val = out.pop("skills")
                out["technologies"] = val if isinstance(val, list) else list(val.keys()) if isinstance(val, dict) else []
            if "technologies" not in out or not isinstance(out["technologies"], list):
                out["technologies"] = []

        # 6. candidate_education
        elif table == "candidate_education":
            if not out.get("institution"):
                out["institution"] = "Educational Institution"

        # 7. candidate_skills
        elif table == "candidate_skills":
            if not out.get("name"):
                return None

        # 8. resumes
        elif table == "resumes":
            if "is_active" not in out:
                out["is_active"] = True

        # 9. resume_versions
        elif table == "resume_versions":
            if "plain_text" in out and not out.get("raw_text"):
                out["raw_text"] = out.pop("plain_text")
            if "structured_content" in out and not out.get("structured_sections"):
                out["structured_sections"] = out.pop("structured_content")
            if "structured_sections" in out and not isinstance(out["structured_sections"], dict):
                out["structured_sections"] = {}
            if out.get("version_number") is not None:
                try:
                    out["version_number"] = int(out["version_number"])
                except (ValueError, TypeError):
                    out["version_number"] = 1

        # 10. job_descriptions
        elif table == "job_descriptions":
            if "extracted_keywords" in out and not isinstance(out["extracted_keywords"], list):
                out["extracted_keywords"] = []

        # 11. ats_analyses
        elif table == "ats_analyses":
            if "score_breakdown" in out and not out.get("breakdown"):
                out["breakdown"] = out.pop("score_breakdown")
            if "breakdown" in out and not isinstance(out["breakdown"], dict):
                out["breakdown"] = {}
            if out.get("overall_score") is not None:
                try:
                    out["overall_score"] = int(round(float(out["overall_score"])))
                except (ValueError, TypeError):
                    out["overall_score"] = None

        # 12. ats_evidence
        elif table == "ats_evidence":
            if not out.get("finding"):
                out["finding"] = out.get("explanation") or out.get("requirement_text") or "Evidence"
            if not out.get("source_reference"):
                out["source_reference"] = out.get("resume_source_reference") or out.get("job_description_source_reference")

        # 13. interview_questions
        elif table == "interview_questions":
            if "question" in out and not out.get("question_text"):
                out["question_text"] = out.pop("question")
            if not out.get("question_text"):
                out["question_text"] = "Interview question"
            if "position" in out and "question_index" not in out:
                try:
                    out["question_index"] = int(out.pop("position"))
                except (ValueError, TypeError):
                    out["question_index"] = 0
            if "question_type" in out and not out.get("category"):
                out["category"] = out.pop("question_type")

        # 14. interview_responses
        elif table == "interview_responses":
            if "evaluation" in out and not isinstance(out["evaluation"], dict):
                out["evaluation"] = {}

        # 15. interview_reports
        elif table == "interview_reports":
            if "report" in out and not isinstance(out["report"], dict):
                out["report"] = {}
            for score_field in ("overall_score", "communication_score", "structure_score", "content_score"):
                if out.get(score_field) is not None:
                    try:
                        out[score_field] = int(round(float(out[score_field])))
                    except (ValueError, TypeError):
                        out[score_field] = None

        # 16. learning_paths
        elif table == "learning_paths":
            if "progress_percentage" in out and "progress_percent" not in out:
                out["progress_percent"] = out.pop("progress_percentage")
            if out.get("progress_percent") is not None:
                try:
                    out["progress_percent"] = int(round(float(out["progress_percent"])))
                except (ValueError, TypeError):
                    out["progress_percent"] = 0

        # 17. learning_items
        elif table == "learning_items":
            if "position" in out and "item_order" not in out:
                try:
                    out["item_order"] = int(out.pop("position"))
                except (ValueError, TypeError):
                    out["item_order"] = 0
            if out.get("progress_percent") is not None:
                try:
                    out["progress_percent"] = int(round(float(out["progress_percent"])))
                except (ValueError, TypeError):
                    out["progress_percent"] = 0

        # 18. learning_resources
        elif table == "learning_resources":
            if "duration_seconds" in out and "duration_minutes" not in out:
                try:
                    out["duration_minutes"] = int(out.pop("duration_seconds")) // 60
                except (ValueError, TypeError):
                    out["duration_minutes"] = None
            if "is_completed" not in out:
                out["is_completed"] = out.get("watch_status") == "completed"

        # 19. jobs
        elif table == "jobs":
            if "application_url" in out and not out.get("url"):
                out["url"] = out.pop("application_url")
            if not out.get("external_id"):
                out["external_id"] = None

        # 20. job_recommendations
        elif table == "job_recommendations":
            if "match_breakdown" in out and not out.get("score_breakdown"):
                out["score_breakdown"] = out.pop("match_breakdown")
            if "score_breakdown" in out and not isinstance(out["score_breakdown"], dict):
                out["score_breakdown"] = {}
            if out.get("match_score") is not None:
                try:
                    out["match_score"] = int(round(float(out["match_score"])))
                except (ValueError, TypeError):
                    out["match_score"] = 0

        # 21. saved_jobs
        elif table == "saved_jobs":
            s_key = (str(out.get("user_id") or ""), str(out.get("job_id") or ""))
            if s_key in self.existing_saved_jobs:
                out["id"] = self.existing_saved_jobs[s_key]

        # Filter strictly to columns present in Supabase table
        allowed = self.sb_columns.get(table, set())
        filtered = {k: v for k, v in out.items() if k in allowed}
        return filtered

    def filter_foreign_keys(self, table: str, rows: List[dict]) -> List[dict]:
        """Ensure rows satisfy parent foreign key references and deduplicate unique constraints."""
        valid: List[dict] = []
        user_ids = self.valid_ids["users"]

        seen_user_ids: Set[str] = set()
        seen_saved_jobs: Set[Tuple[str, str]] = set()

        for row in rows:
            uid = row.get("user_id")
            if uid and uid not in user_ids:
                continue

            if table == "profiles":
                if row["id"] not in user_ids:
                    continue

            elif table in ("candidate_preferences", "notification_preferences", "privacy_preferences"):
                if uid in seen_user_ids:
                    continue
                seen_user_ids.add(uid)

            elif table == "saved_jobs":
                s_key = (str(uid), str(row.get("job_id") or ""))
                if s_key in seen_saved_jobs:
                    continue
                seen_saved_jobs.add(s_key)

            elif table == "resume_versions":
                if row.get("resume_id") not in self.valid_ids["resumes"]:
                    continue

            elif table == "ats_analyses":
                if row.get("resume_version_id") and row.get("resume_version_id") not in self.valid_ids["resume_versions"]:
                    row["resume_version_id"] = None
                if row.get("job_description_id") and row.get("job_description_id") not in self.valid_ids["job_descriptions"]:
                    row["job_description_id"] = None

            elif table == "ats_evidence":
                if row.get("analysis_id") not in self.valid_ids["ats_analyses"]:
                    continue

            elif table == "interview_questions":
                if row.get("session_id") not in self.valid_ids["interview_sessions"]:
                    continue

            elif table == "interview_responses":
                if row.get("session_id") not in self.valid_ids["interview_sessions"]:
                    continue
                if row.get("question_id") not in self.valid_ids["interview_questions"]:
                    continue

            elif table == "interview_reports":
                if row.get("session_id") not in self.valid_ids["interview_sessions"]:
                    continue

            elif table == "learning_items":
                if row.get("learning_path_id") not in self.valid_ids["learning_paths"]:
                    continue

            elif table == "learning_resources":
                if row.get("learning_item_id") not in self.valid_ids["learning_items"]:
                    continue

            elif table == "resume_improvement_runs":
                if row.get("resume_version_id") and row.get("resume_version_id") not in self.valid_ids["resume_versions"]:
                    row["resume_version_id"] = None

            elif table == "resume_suggestions":
                if row.get("run_id") not in self.valid_ids["resume_improvement_runs"]:
                    continue

            elif table == "resume_exports":
                if row.get("resume_version_id") and row.get("resume_version_id") not in self.valid_ids["resume_versions"]:
                    row["resume_version_id"] = None

            elif table == "job_recommendations":
                if row.get("job_id") not in self.valid_ids["jobs"]:
                    continue

            valid.append(row)

        return valid

    def upsert_batch(self, table: str, rows: List[dict]) -> int:
        """Upsert a batch of rows into Supabase PostgREST."""
        if not rows:
            return 0
        if self.dry_run:
            return len(rows)

        url = f"{self.settings.resolved_supabase_url}/rest/v1/{table}"
        headers = {
            "apikey": self.settings.supabase_server_key,
            "Authorization": f"Bearer {self.settings.supabase_server_key}",
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates,return=minimal",
        }

        # Deduplicate rows by primary key ('id') in batch to avoid PostgREST duplicate error in same request
        seen_ids = set()
        deduped = []
        for r in rows:
            row_id = r.get("id")
            if row_id:
                if row_id in seen_ids:
                    continue
                seen_ids.add(row_id)
            deduped.append(r)

        batch_size = 100
        total_upserted = 0

        for i in range(0, len(deduped), batch_size):
            chunk = deduped[i : i + batch_size]
            # PostgREST requires all objects in an array payload to have the exact same set of keys (PGRST102)
            all_keys = sorted(set().union(*(r.keys() for r in chunk)))
            normalized_chunk = [{k: r.get(k, None) for k in all_keys} for r in chunk]
            resp = self.client.post(url, headers=headers, json=normalized_chunk)
            if resp.status_code in (200, 201, 204):
                total_upserted += len(chunk)
            else:
                logger.warning("Batch failed on %s (status %d): %s. Retrying row-by-row...", table, resp.status_code, resp.text[:200])
                # Try single row fallback to rescue non-failing records
                for single in chunk:
                    r_single = self.client.post(url, headers=headers, json=[single])
                    if r_single.status_code in (200, 201, 204):
                        total_upserted += 1
                    else:
                        logger.warning("Single record error on %s id=%s: %s", table, single.get("id"), r_single.text[:200])

        return total_upserted

    def run_migration(self) -> Dict[str, int]:
        """Execute end-to-end migration in topological dependency order."""
        self.init_firestore()
        self.init_supabase()
        self.fetch_all_firestore_data()

        # Topological table order
        ordered_tables = [
            "users",
            "profiles",
            "candidate_preferences",
            "notification_preferences",
            "privacy_preferences",
            "jobs",
            "saved_jobs",
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
            "ats_evidence",
            "resume_improvement_runs",
            "resume_suggestions",
            "resume_exports",
            "interview_sessions",
            "interview_questions",
            "interview_responses",
            "interview_reports",
            "learning_paths",
            "learning_items",
            "learning_resources",
            "job_recommendations",
            "activity_events",
            "user_notifications",
        ]

        results: Dict[str, int] = {}
        logger.info("\n========== STARTING MIGRATION ==========")

        for table in ordered_tables:
            raw_docs = self.all_fs_docs.get(table, [])
            if table == "users":
                raw_docs = self.link_supabase_auth_users(raw_docs)

            transformed_rows: List[dict] = []
            for d in raw_docs:
                row = self.transform_row(table, d)
                if row:
                    transformed_rows.append(row)

            # Filter foreign keys
            valid_rows = self.filter_foreign_keys(table, transformed_rows)

            count = self.upsert_batch(table, valid_rows)
            results[table] = count
            logger.info("Table '%s': %d of %d documents migrated.", table, count, len(raw_docs))

            # Record IDs for child table FK validation
            if table in self.valid_ids:
                for r in valid_rows:
                    if r.get("id"):
                        self.valid_ids[table].add(str(r["id"]))

        logger.info("\n========== MIGRATION COMPLETE ==========")
        total_migrated = sum(results.values())
        logger.info("Total records successfully migrated to Supabase: %d", total_migrated)
        return results


def main() -> None:
    parser = argparse.ArgumentParser(description="Migrate Firestore database to Supabase PostgreSQL.")
    parser.add_argument("--dry-run", action="store_true", help="Simulate migration without modifying Supabase.")
    args = parser.parse_args()

    migrator = FirestoreToSupabaseMigrator(dry_run=args.dry_run)
    migrator.run_migration()


if __name__ == "__main__":
    main()

