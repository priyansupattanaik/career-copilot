#!/usr/bin/env python3
"""Evaluation script for LLM resume autofill parsing.

Compares parser extractions against ground-truth synthetic fixtures in
backend/tests/fixtures/resumes/ to measure latency, quality rating,
and field-level precision/recall.

Usage:
    python scripts/eval-resume-parse.py [--provider nvidia|groq|both] [--fixture all|fresher|experienced] [--offline]
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
import time
from pathlib import Path
from typing import Any

# Ensure backend package is in python path
REPO_ROOT = Path(__file__).resolve().parent.parent
BACKEND_DIR = REPO_ROOT / "backend"
FIXTURES_DIR = BACKEND_DIR / "tests" / "fixtures" / "resumes"
sys.path.insert(0, str(BACKEND_DIR))

# Load .env if present
env_file = REPO_ROOT / ".env"
if env_file.exists():
    with open(env_file, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                k = k.strip()
                v = v.strip().strip("'\"")
                if k not in os.environ:
                    os.environ[k] = v

try:
    from app.agents.providers.reliable import generate_structured_with_failover
    from app.core.config import get_settings
    from app.features.profile.autofill.prompts import build_system_prompt, build_user_message
    from app.features.profile.autofill.schema import ResumeAutofillExtraction
    from app.features.profile.autofill.service import normalize_source_text_for_llm
    from app.features.profile.autofill.verifier import verify_and_sanitize
except ImportError as exc:
    print(f"Error importing backend modules: {exc}", file=sys.stderr)
    sys.exit(1)


def compute_set_metrics(extracted: list[str], truth: list[str]) -> tuple[float, float, float]:
    ext_set = {s.lower().strip() for s in extracted if s}
    tru_set = {s.lower().strip() for s in truth if s}
    if not tru_set and not ext_set:
        return 1.0, 1.0, 1.0
    if not ext_set or not tru_set:
        return 0.0, 0.0, 0.0
    tp = len(ext_set & tru_set)
    precision = tp / len(ext_set) if ext_set else 0.0
    recall = tp / len(tru_set) if tru_set else 0.0
    f1 = (2 * precision * recall / (precision + recall)) if (precision + recall) > 0 else 0.0
    return precision, recall, f1


def evaluate_extraction(
    extracted: ResumeAutofillExtraction,
    truth_dict: dict[str, Any],
) -> dict[str, Any]:
    # Name match
    tru_name = ((truth_dict.get("full_name") or {}).get("value") or "").strip().lower()
    ext_name = (extracted.full_name.value.strip().lower() if extracted.full_name else "")
    name_ok = bool(tru_name and tru_name in ext_name or ext_name in tru_name) if (tru_name or ext_name) else True

    # Headline match
    tru_head = ((truth_dict.get("headline") or {}).get("value") or "").strip().lower()
    ext_head = (extracted.headline.value.strip().lower() if extracted.headline else "")
    head_ok = bool(tru_head and (tru_head in ext_head or ext_head in tru_head)) if (tru_head or ext_head) else True

    # Skills precision / recall / F1
    tru_skills = truth_dict.get("skills") or []
    ext_skills = extracted.skills or []
    s_prec, s_rec, s_f1 = compute_set_metrics(ext_skills, tru_skills)

    # Experience companies
    tru_exp_comps = [e.get("company", "").lower() for e in (truth_dict.get("experience") or []) if e.get("company")]
    ext_exp_comps = [e.company.lower() for e in (extracted.experience or []) if e.company]
    e_prec, e_rec, e_f1 = compute_set_metrics(ext_exp_comps, tru_exp_comps)

    # Education institutions
    tru_edu = [e.get("institution", "").lower() for e in (truth_dict.get("education") or []) if e.get("institution")]
    ext_edu = [e.institution.lower() for e in (extracted.education or []) if e.institution]
    ed_prec, ed_rec, ed_f1 = compute_set_metrics(ext_edu, tru_edu)

    # Links
    tru_links = [l.get("url", "").lower() for l in (truth_dict.get("links") or []) if l.get("url")]
    ext_links = [l.url.lower() for l in (extracted.links or []) if l.url]
    l_prec, l_rec, l_f1 = compute_set_metrics(ext_links, tru_links)

    return {
        "name_match": name_ok,
        "headline_match": head_ok,
        "skills_f1": s_f1,
        "skills_count": f"{len(ext_skills)}/{len(tru_skills)}",
        "experience_f1": e_f1,
        "experience_count": f"{len(ext_exp_comps)}/{len(tru_exp_comps)}",
        "education_f1": ed_f1,
        "education_count": f"{len(ext_edu)}/{len(tru_edu)}",
        "links_f1": l_f1,
    }


async def run_single_eval(
    fixture_stem: str,
    provider: str,
    settings: Any,
    offline: bool = False,
) -> dict[str, Any]:
    txt_path = FIXTURES_DIR / f"{fixture_stem}.txt"
    json_path = FIXTURES_DIR / f"{fixture_stem}.json"
    if not txt_path.exists() or not json_path.exists():
        raise FileNotFoundError(f"Fixture {fixture_stem} missing .txt or .json in {FIXTURES_DIR}")

    resume_text = txt_path.read_text(encoding="utf-8")
    with open(json_path, encoding="utf-8") as f:
        truth_dict = json.load(f)

    if offline:
        extraction = ResumeAutofillExtraction.model_validate(truth_dict)
        used_provider = "offline"
        latency = 0.0
    else:
        import secrets
        start_time = time.monotonic()
        settings.llm_provider = provider
        nonce = secrets.token_hex(8)
        clean_text = normalize_source_text_for_llm(resume_text)
        sys_p = build_system_prompt(nonce)
        usr_m = build_user_message(nonce, clean_text)
        extraction, used_provider = await generate_structured_with_failover(
            settings,
            system_prompt=sys_p,
            user_payload={"resume_text": usr_m},
            schema_model=ResumeAutofillExtraction,
            temperature_overrides={"groq": 0.0},
            max_output_tokens=getattr(settings, "resume_parse_max_output_tokens", 8000),
            strict_schema=True,
            allow_repair=True,
            timeout_seconds=65.0,
        )
        latency = time.monotonic() - start_time

    # Verification pass
    v_result = verify_and_sanitize(extraction, resume_text)
    metrics = evaluate_extraction(v_result.extraction, truth_dict)

    return {
        "fixture": fixture_stem,
        "provider": used_provider,
        "quality": v_result.quality,
        "latency_s": round(latency, 2),
        "kept_fields": v_result.kept_count,
        "dropped_fields": v_result.dropped_count,
        **metrics,
    }


def print_table(results: list[dict[str, Any]]):
    headers = [
        "Fixture", "Provider", "Quality", "Latency(s)",
        "Name", "Headline", "Skills F1", "Exp F1", "Edu F1", "Links F1",
    ]
    col_widths = [16, 10, 10, 11, 6, 9, 10, 8, 8, 9]

    header_row = " | ".join(h.ljust(w) for h, w in zip(headers, col_widths))
    sep_row = "-+-".join("-" * w for w in col_widths)

    print("\n" + "=" * len(header_row))
    print(header_row)
    print(sep_row)

    for r in results:
        row_vals = [
            r["fixture"][:16],
            r["provider"][:10],
            r["quality"][:10],
            f"{r['latency_s']}s",
            "YES" if r["name_match"] else "NO",
            "YES" if r["headline_match"] else "NO",
            f"{r['skills_f1']:.2f}",
            f"{r['experience_f1']:.2f}",
            f"{r['education_f1']:.2f}",
            f"{r['links_f1']:.2f}",
        ]
        row_str = " | ".join(v.ljust(w) for v, w in zip(row_vals, col_widths))
        print(row_str)
    print("=" * len(header_row) + "\n")


async def main():
    parser = argparse.ArgumentParser(description="Evaluate resume autofill extraction")
    parser.add_argument("--provider", choices=["nvidia", "groq", "both"], default="nvidia")
    parser.add_argument("--fixture", choices=["all", "fresher", "experienced"], default="all")
    parser.add_argument("--offline", action="store_true", help="Run against local fixtures without LLM calls")
    args = parser.parse_args()

    settings = get_settings()

    fixtures = []
    if args.fixture in ("all", "fresher"):
        fixtures.append("synthetic_fresher")
    if args.fixture in ("all", "experienced"):
        fixtures.append("synthetic_experienced")

    providers = []
    if args.offline:
        providers = ["offline"]
    elif args.provider == "both":
        providers = ["nvidia", "groq"]
    else:
        providers = [args.provider]

    results = []
    for fix in fixtures:
        for prov in providers:
            print(f"Evaluating {fix} with provider={prov}...")
            try:
                res = await run_single_eval(fix, prov, settings, offline=args.offline)
                results.append(res)
            except Exception as exc:
                print(f"Error evaluating {fix} with {prov}: {exc}", file=sys.stderr)
                results.append({
                    "fixture": fix,
                    "provider": prov,
                    "quality": "error",
                    "latency_s": 0.0,
                    "kept_fields": 0,
                    "dropped_fields": 0,
                    "name_match": False,
                    "headline_match": False,
                    "skills_f1": 0.0,
                    "skills_count": "0/0",
                    "experience_f1": 0.0,
                    "experience_count": "0/0",
                    "education_f1": 0.0,
                    "education_count": "0/0",
                    "links_f1": 0.0,
                })

    print_table(results)


if __name__ == "__main__":
    asyncio.run(main())
