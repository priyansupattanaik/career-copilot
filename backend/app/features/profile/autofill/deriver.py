from __future__ import annotations

import re
import uuid
from datetime import UTC, datetime
from typing import Any
from urllib.parse import urlparse

from app.features.profile.autofill.schema import (
    ExperienceItem,
    ResumeAutofillExtraction,
)
from app.features.profile.autofill.verifier import normalize_text


def parse_year_month(val: str | None) -> tuple[int, int] | None:
    """Parse YYYY-MM string to (year, month). Returns None if format does not match."""
    if not val:
        return None
    match = re.fullmatch(r"(\d{4})-(\d{2})", val.strip())
    if not match:
        return None
    year = int(match.group(1))
    month = int(match.group(2))
    if 1 <= month <= 12:
        return year, month
    return None


def calculate_years_experience(
    experiences: list[ExperienceItem],
) -> tuple[int, list[dict[str, Any]]]:
    """Calculate whole years of experience from non-internship experiences with YYYY-MM dates.

    Merges overlapping intervals, computes total whole months // 12.
    Returns (years, basis).
    """
    now = datetime.now(UTC)
    now_m = now.year * 12 + now.month

    valid_intervals: list[tuple[int, int, ExperienceItem, int]] = []
    basis: list[dict[str, Any]] = []

    for item in experiences:
        emp_type = (item.employment_type or "").lower()
        if "intern" in emp_type:
            continue

        start_ym = parse_year_month(item.start)
        if not start_ym:
            continue
        start_m = start_ym[0] * 12 + start_ym[1]

        if item.is_current:
            end_m = now_m
        else:
            end_ym = parse_year_month(item.end)
            if not end_ym:
                continue
            end_m = end_ym[0] * 12 + end_ym[1]

        if end_m < start_m:
            continue

        months = end_m - start_m + 1
        valid_intervals.append((start_m, end_m, item, months))
        basis.append(
            {
                "company": item.company or "Unknown",
                "title": item.title or "Unknown",
                "months_used": months,
            }
        )

    if not valid_intervals:
        return 0, []

    # Merge overlapping intervals
    sorted_intervals = sorted(valid_intervals, key=lambda x: (x[0], x[1]))
    merged: list[tuple[int, int]] = []
    curr_start, curr_end = sorted_intervals[0][0], sorted_intervals[0][1]

    for start_m, end_m, _, _ in sorted_intervals[1:]:
        if start_m <= curr_end + 1:
            curr_end = max(curr_end, end_m)
        else:
            merged.append((curr_start, curr_end))
            curr_start, curr_end = start_m, end_m
    merged.append((curr_start, curr_end))

    total_months = sum((end_m - start_m + 1) for start_m, end_m in merged)
    years = total_months // 12
    return max(0, years), basis


def normalize_link_url(url: str) -> str:
    """Normalize URL by lowercasing host, removing 'www.' and trailing slash."""
    if not url:
        return ""
    u = url.strip()
    if not u.startswith(("http://", "https://")):
        u = "https://" + u
    parsed = urlparse(u)
    host = (parsed.netloc or "").lower()
    if host.startswith("www."):
        host = host[4:]
    path = parsed.path.rstrip("/")
    return f"{host}{path}"


def build_proposals(
    extraction: ResumeAutofillExtraction,
    current_profile: dict[str, Any],
    candidate_skills: list[dict[str, Any]],
    candidate_experiences: list[dict[str, Any]],
    candidate_education: list[dict[str, Any]],
    candidate_links: list[dict[str, Any]],
    *,
    only_fill_empty: bool = True,
    mapped_location: str | None = None,
) -> dict[str, Any]:
    """Derive fields and compute merge status against current profile."""

    # 1. About section proposals
    about: dict[str, Any] = {}

    # full_name
    if extraction.full_name and extraction.full_name.value:
        fn_val = extraction.full_name.value.strip()
        curr_fn = str(current_profile.get("full_name") or "").strip()
        if not curr_fn:
            status = "new"
        elif normalize_text(curr_fn) == normalize_text(fn_val):
            status = "duplicate"
        else:
            status = "differs"
        about["full_name"] = {
            "id": str(uuid.uuid4()),
            "value": fn_val,
            "evidence": extraction.full_name.evidence,
            "status": status,
            "current": curr_fn or None,
            "selected_by_default": (status == "new") or (status == "differs" and not only_fill_empty),
        }

    # headline
    if extraction.headline and extraction.headline.value:
        hl_val = extraction.headline.value.strip()
        curr_hl = str(current_profile.get("headline") or "").strip()
        if not curr_hl:
            status = "new"
        elif normalize_text(curr_hl) == normalize_text(hl_val):
            status = "duplicate"
        else:
            status = "differs"
        about["headline"] = {
            "id": str(uuid.uuid4()),
            "value": hl_val,
            "evidence": extraction.headline.evidence,
            "status": status,
            "current": curr_hl or None,
            "selected_by_default": (status == "new") or (status == "differs" and not only_fill_empty),
        }

    # bio (from summary_text)
    if extraction.summary_text and extraction.summary_text.value:
        bio_val = extraction.summary_text.value.strip()
        curr_bio = str(current_profile.get("bio") or "").strip()
        if not curr_bio:
            status = "new"
        elif normalize_text(curr_bio) == normalize_text(bio_val):
            status = "duplicate"
        else:
            status = "differs"
        about["bio"] = {
            "id": str(uuid.uuid4()),
            "value": bio_val,
            "evidence": extraction.summary_text.evidence,
            "status": status,
            "current": curr_bio or None,
            "selected_by_default": (status == "new") or (status == "differs" and not only_fill_empty),
        }

    # location
    loc_val = mapped_location
    if not loc_val and extraction.location:
        from app.features.profile.autofill.options_mapper import pick_best_location
        loc_val = pick_best_location(
            extraction.location.city,
            extraction.location.region,
            extraction.location.country,
        )
    if loc_val:
        curr_loc = str(current_profile.get("location") or "").strip()
        if not curr_loc:
            status = "new"
        elif normalize_text(curr_loc) == normalize_text(loc_val):
            status = "duplicate"
        else:
            status = "differs"
        about["location"] = {
            "id": str(uuid.uuid4()),
            "value": loc_val,
            "evidence": extraction.location.evidence if extraction.location else None,
            "status": status,
            "current": curr_loc or None,
            "selected_by_default": (status == "new") or (status == "differs" and not only_fill_empty),
        }

    # current_role: title of the first experience with is_current = True
    curr_role_proposal: str | None = None
    curr_role_evidence: str | None = None
    for exp in extraction.experience or []:
        if exp.is_current and exp.title:
            curr_role_proposal = exp.title.strip()
            curr_role_evidence = exp.evidence
            break
    if curr_role_proposal:
        curr_role_existing = str(current_profile.get("current_role") or "").strip()
        if not curr_role_existing:
            status = "new"
        elif normalize_text(curr_role_existing) == normalize_text(curr_role_proposal):
            status = "duplicate"
        else:
            status = "differs"
        about["current_role"] = {
            "id": str(uuid.uuid4()),
            "value": curr_role_proposal,
            "evidence": curr_role_evidence,
            "status": status,
            "current": curr_role_existing or None,
            "selected_by_default": (status == "new") or (status == "differs" and not only_fill_empty),
        }

    # years_of_experience: derived arithmetic
    years_val, basis = calculate_years_experience(extraction.experience or [])
    curr_years = current_profile.get("years_experience")
    is_unset = curr_years is None or curr_years == ""
    # "Status is 'new' when the current value is null/unset, otherwise always 'differs'."
    status = "new" if is_unset else "differs"
    about["years_of_experience"] = {
        "id": str(uuid.uuid4()),
        "value": years_val,
        "evidence": None,
        "status": status,
        "current": curr_years if not is_unset else None,
        "selected_by_default": (status == "new") or (status == "differs" and not only_fill_empty),
        "basis": basis,
    }

    # 2. Skills proposals
    skills_proposals: list[dict[str, Any]] = []
    existing_skills_norm = {
        normalize_text(str(s.get("name") or s.get("normalized_name") or ""))
        for s in candidate_skills
    }
    for s in extraction.skills or []:
        s_clean = s.strip()
        s_norm = normalize_text(s_clean)
        is_dup = s_norm in existing_skills_norm
        st = "duplicate" if is_dup else "new"
        skills_proposals.append(
            {
                "id": str(uuid.uuid4()),
                "value": s_clean,
                "evidence": None,
                "status": st,
                "current": None,
                "selected_by_default": st == "new",
            }
        )

    # 3. Experience proposals
    exp_proposals: list[dict[str, Any]] = []
    existing_exp_keys = set()
    for row in candidate_experiences:
        c_norm = normalize_text(str(row.get("company") or row.get("company_name") or ""))
        r_norm = normalize_text(str(row.get("role") or row.get("role_title") or ""))
        start_val = str(row.get("start_date") or "")[:7]  # YYYY-MM
        existing_exp_keys.add(f"{c_norm}|{r_norm}|{start_val}")

    for item in extraction.experience or []:
        c_norm = normalize_text(item.company or "")
        t_norm = normalize_text(item.title or "")
        start_val = str(item.start or "")[:7]
        key = f"{c_norm}|{t_norm}|{start_val}"
        is_dup = key in existing_exp_keys
        st = "duplicate" if is_dup else "new"
        exp_proposals.append(
            {
                "id": str(uuid.uuid4()),
                "value": {
                    "company_name": item.company,
                    "role_title": item.title,
                    "employment_type": item.employment_type,
                    "location": item.location_text,
                    "start_date": item.start,
                    "end_date": item.end,
                    "is_current": item.is_current,
                    "summary": item.summary,
                },
                "evidence": item.evidence,
                "status": st,
                "current": None,
                "selected_by_default": st == "new",
            }
        )

    # 4. Education proposals
    edu_proposals: list[dict[str, Any]] = []
    existing_edu_keys = set()
    for row in candidate_education:
        i_norm = normalize_text(str(row.get("institution") or ""))
        d_norm = normalize_text(str(row.get("degree") or ""))
        existing_edu_keys.add(f"{i_norm}|{d_norm}")

    for item in extraction.education or []:
        i_norm = normalize_text(item.institution or "")
        d_norm = normalize_text(item.degree or "")
        key = f"{i_norm}|{d_norm}"
        is_dup = key in existing_edu_keys
        st = "duplicate" if is_dup else "new"
        edu_proposals.append(
            {
                "id": str(uuid.uuid4()),
                "value": {
                    "institution": item.institution,
                    "degree": item.degree,
                    "field_of_study": item.field_of_study,
                    "start_date": item.start_year,
                    "end_date": item.end_year,
                    "grade": item.grade_text,
                },
                "evidence": item.evidence,
                "status": st,
                "current": None,
                "selected_by_default": st == "new",
            }
        )

    # 5. Links proposals
    links_proposals: list[dict[str, Any]] = []
    existing_links_norm = {
        normalize_link_url(str(row.get("url") or "")) for row in candidate_links
    }
    for item in extraction.links or []:
        link_norm = normalize_link_url(item.url)
        is_dup = link_norm in existing_links_norm
        st = "duplicate" if is_dup else "new"
        links_proposals.append(
            {
                "id": str(uuid.uuid4()),
                "value": {
                    "link_type": item.type,
                    "url": item.url,
                },
                "evidence": item.evidence,
                "status": st,
                "current": None,
                "selected_by_default": st == "new",
            }
        )

    return {
        "about": about,
        "skills": skills_proposals,
        "experience": exp_proposals,
        "education": edu_proposals,
        "links": links_proposals,
    }
