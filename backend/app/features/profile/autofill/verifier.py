from __future__ import annotations

import re
import unicodedata
from urllib.parse import urlparse

from app.features.profile.autofill.schema import (
    CertificationItem,
    EducationItem,
    EvidenceSpan,
    ExperienceItem,
    LinkItem,
    LocationEvidence,
    ProjectItem,
    ResumeAutofillExtraction,
)

BULLET_CHARS = "•–—-*·●○◦▪▸\u2022\u25cf\u25cb\u25e6\u25aa\u25b8"
ZERO_WIDTH_CHARS = "\u200b\u200c\u200d\ufeff\u00ad"

VALID_EMPLOYMENT_TYPES = {
    "full_time",
    "part_time",
    "contract",
    "internship",
    "freelance",
}

VALID_LINK_TYPES = {"linkedin", "github", "portfolio", "website", "other"}


def normalize_text(text: str | None) -> str:
    """Normalize text using Unicode NFKC, lowercase, stripped zero-width chars and single spaces."""
    if not text:
        return ""
    # Unicode NFKC
    res = unicodedata.normalize("NFKC", str(text))
    # Remove zero-width characters and soft hyphens
    for ch in ZERO_WIDTH_CHARS:
        res = res.replace(ch, "")
    # Lowercase
    res = res.lower()
    # Strip leading bullet characters from lines/segments
    res = re.sub(f"^[\\s{re.escape(BULLET_CHARS)}]+", "", res)
    # Collapse whitespace runs to one space
    res = re.sub(r"\s+", " ", res).strip()
    return res


def extract_alphanumeric_tokens(text: str) -> set[str]:
    """Extract set of lowercase alphanumeric tokens."""
    norm = normalize_text(text)
    return set(re.findall(r"\b[a-z0-9]+\b", norm))


def is_substring_in_haystack(needle: str | None, haystack_norm: str, haystack_compact: str) -> bool:
    """Check if normalized needle is a substring of haystack, tolerating line-breaks and hyphenations."""
    if not needle:
        return True
    n_norm = normalize_text(needle)
    if not n_norm:
        return True
    if n_norm in haystack_norm:
        return True
    # Also test collapsed/compact text (stripping spaces around hyphens or between words)
    n_compact = re.sub(r"[\s\-_/]+", "", n_norm)
    if n_compact and n_compact in haystack_compact:
        return True
    return False


def verify_evidence(evidence: str | None, haystack_norm: str, haystack_compact: str) -> bool:
    """Evidence must be a contiguous span between 3 and 160 characters in resume text."""
    if not evidence or not isinstance(evidence, str):
        return False
    e_str = evidence.strip()
    if len(e_str) < 3 or len(e_str) > 160:
        return False
    return is_substring_in_haystack(e_str, haystack_norm, haystack_compact)


def verify_date(
    date_str: str | None,
    tokens: set[str],
) -> str | None:
    """Keep date only if its 4-digit year appears as a token in the resume text."""
    if not date_str or not isinstance(date_str, str):
        return None
    d = date_str.strip()
    match = re.search(r"\b(\d{4})\b", d)
    if not match:
        return None
    year = match.group(1)
    if year not in tokens:
        return None
    # Validate format: YYYY or YYYY-MM
    if re.fullmatch(r"\d{4}", d):
        return d
    if re.fullmatch(r"\d{4}-\d{2}", d):
        parts = d.split("-")
        month = int(parts[1])
        if 1 <= month <= 12:
            return d
    return year


class VerificationResult:
    def __init__(
        self,
        extraction: ResumeAutofillExtraction,
        quality: str,
        total_returned: int,
        kept_count: int,
        dropped_count: int,
    ):
        self.extraction = extraction
        self.quality = quality
        self.total_returned = total_returned
        self.kept_count = kept_count
        self.dropped_count = dropped_count


def verify_and_sanitize(
    raw_extraction: ResumeAutofillExtraction,
    source_resume_text: str,
) -> VerificationResult:
    haystack_norm = normalize_text(source_resume_text)
    haystack_compact = re.sub(r"[\s\-_/]+", "", haystack_norm)
    tokens = extract_alphanumeric_tokens(source_resume_text)

    total_returned = 0
    dropped_count = 0
    kept_count = 0

    # 1. Full name
    full_name_out: EvidenceSpan | None = None
    if raw_extraction.full_name and raw_extraction.full_name.value:
        total_returned += 1
        name_val = raw_extraction.full_name.value.strip()
        ev = raw_extraction.full_name.evidence
        if verify_evidence(ev, haystack_norm, haystack_compact) and is_substring_in_haystack(
            name_val, haystack_norm, haystack_compact
        ):
            full_name_out = EvidenceSpan(value=name_val, evidence=ev)
            kept_count += 1
        else:
            dropped_count += 1

    # 2. Headline
    headline_out: EvidenceSpan | None = None
    if raw_extraction.headline and raw_extraction.headline.value:
        total_returned += 1
        head_val = raw_extraction.headline.value.strip()
        ev = raw_extraction.headline.evidence
        if verify_evidence(ev, haystack_norm, haystack_compact) and is_substring_in_haystack(
            head_val, haystack_norm, haystack_compact
        ):
            headline_out = EvidenceSpan(value=head_val, evidence=ev)
            kept_count += 1
        else:
            dropped_count += 1

    # 3. Summary text / bio
    summary_out: EvidenceSpan | None = None
    if raw_extraction.summary_text and raw_extraction.summary_text.value:
        total_returned += 1
        sum_val = raw_extraction.summary_text.value.strip()[:600]
        ev = raw_extraction.summary_text.evidence
        if verify_evidence(ev, haystack_norm, haystack_compact) and is_substring_in_haystack(
            sum_val, haystack_norm, haystack_compact
        ):
            summary_out = EvidenceSpan(value=sum_val, evidence=ev)
            kept_count += 1
        else:
            dropped_count += 1

    # 4. Location
    location_out: LocationEvidence | None = None
    if raw_extraction.location:
        total_returned += 1
        ev = raw_extraction.location.evidence
        if verify_evidence(ev, haystack_norm, haystack_compact):
            city = raw_extraction.location.city
            region = raw_extraction.location.region
            country = raw_extraction.location.country
            if city and not is_substring_in_haystack(city, haystack_norm, haystack_compact):
                city = None
            if region and not is_substring_in_haystack(region, haystack_norm, haystack_compact):
                region = None
            if country and not is_substring_in_haystack(country, haystack_norm, haystack_compact):
                country = None
            if city or region or country:
                location_out = LocationEvidence(
                    city=city,
                    region=region,
                    country=country,
                    evidence=ev,
                )
                kept_count += 1
            else:
                dropped_count += 1
        else:
            dropped_count += 1

    # 5. Skills
    skills_out: list[str] = []
    seen_skills: set[str] = set()
    raw_skills = raw_extraction.skills or []
    for s in raw_skills:
        if not s or not isinstance(s, str):
            continue
        total_returned += 1
        s_clean = s.strip()
        s_norm = normalize_text(s_clean)
        if not s_norm or s_norm in seen_skills:
            dropped_count += 1
            continue
        if is_substring_in_haystack(s_clean, haystack_norm, haystack_compact):
            seen_skills.add(s_norm)
            skills_out.append(s_clean)
            kept_count += 1
        else:
            dropped_count += 1
    # Cap at 60
    if len(skills_out) > 60:
        dropped_count += len(skills_out) - 60
        skills_out = skills_out[:60]

    # 6. Experience
    exp_out: list[ExperienceItem] = []
    for item in raw_extraction.experience or []:
        total_returned += 1
        if not verify_evidence(item.evidence, haystack_norm, haystack_compact):
            dropped_count += 1
            continue
        company = item.company.strip() if item.company else None
        title = item.title.strip() if item.title else None
        comp_ok = is_substring_in_haystack(company, haystack_norm, haystack_compact) if company else False
        title_ok = is_substring_in_haystack(title, haystack_norm, haystack_compact) if title else False

        # Key fields rule: Experience needs company or title. Drop ONLY when BOTH fail.
        if not comp_ok and not title_ok:
            dropped_count += 1
            continue

        company = company if comp_ok else None
        title = title if title_ok else None

        # Employment type
        emp_type = item.employment_type if item.employment_type in VALID_EMPLOYMENT_TYPES else None

        # Dates
        start = verify_date(item.start, tokens)
        end = verify_date(item.end, tokens)
        if start and end and end < start:
            end = None

        # Summary token check: every alphanumeric token must exist in tokens
        summary = item.summary
        if summary:
            sum_tokens = extract_alphanumeric_tokens(summary)
            if not sum_tokens.issubset(tokens):
                summary = None
            else:
                summary = summary[:800]

        exp_out.append(
            ExperienceItem(
                company=company,
                title=title,
                employment_type=emp_type,
                location_text=item.location_text,
                start=start,
                end=end,
                is_current=bool(item.is_current),
                summary=summary,
                evidence=item.evidence,
            )
        )
        kept_count += 1
    # Cap at 15
    if len(exp_out) > 15:
        dropped_count += len(exp_out) - 15
        exp_out = exp_out[:15]

    # 7. Education
    edu_out: list[EducationItem] = []
    for item in raw_extraction.education or []:
        total_returned += 1
        if not verify_evidence(item.evidence, haystack_norm, haystack_compact):
            dropped_count += 1
            continue
        institution = item.institution.strip() if item.institution else None
        # Key field: Education needs institution
        if not institution or not is_substring_in_haystack(institution, haystack_norm, haystack_compact):
            dropped_count += 1
            continue

        degree = item.degree.strip() if item.degree else None
        if degree and not is_substring_in_haystack(degree, haystack_norm, haystack_compact):
            degree = None

        field_of_study = item.field_of_study.strip() if item.field_of_study else None
        if field_of_study and not is_substring_in_haystack(field_of_study, haystack_norm, haystack_compact):
            field_of_study = None

        start_year = verify_date(item.start_year, tokens)
        end_year = verify_date(item.end_year, tokens)
        if start_year and end_year and end_year < start_year:
            end_year = None

        edu_out.append(
            EducationItem(
                institution=institution,
                degree=degree,
                field_of_study=field_of_study,
                start_year=start_year,
                end_year=end_year,
                grade_text=item.grade_text,
                evidence=item.evidence,
            )
        )
        kept_count += 1
    # Cap at 6
    if len(edu_out) > 6:
        dropped_count += len(edu_out) - 6
        edu_out = edu_out[:6]

    # 8. Projects
    proj_out: list[ProjectItem] = []
    for item in raw_extraction.projects or []:
        total_returned += 1
        if not verify_evidence(item.evidence, haystack_norm, haystack_compact):
            dropped_count += 1
            continue
        name = item.name.strip() if item.name else None
        if not name or not is_substring_in_haystack(name, haystack_norm, haystack_compact):
            dropped_count += 1
            continue
        summary = item.summary[:400] if item.summary else None
        proj_out.append(
            ProjectItem(
                name=name,
                summary=summary,
                technologies=item.technologies or [],
                url=item.url,
                evidence=item.evidence,
            )
        )
        kept_count += 1
    if len(proj_out) > 12:
        dropped_count += len(proj_out) - 12
        proj_out = proj_out[:12]

    # 9. Certifications
    cert_out: list[CertificationItem] = []
    for item in raw_extraction.certifications or []:
        total_returned += 1
        if not verify_evidence(item.evidence, haystack_norm, haystack_compact):
            dropped_count += 1
            continue
        name = item.name.strip() if item.name else None
        if not name or not is_substring_in_haystack(name, haystack_norm, haystack_compact):
            dropped_count += 1
            continue
        issuer = item.issuer.strip() if item.issuer else None
        if issuer and not is_substring_in_haystack(issuer, haystack_norm, haystack_compact):
            issuer = None
        year = verify_date(item.year, tokens)
        cert_out.append(
            CertificationItem(
                name=name,
                issuer=issuer,
                year=year,
                evidence=item.evidence,
            )
        )
        kept_count += 1
    if len(cert_out) > 12:
        dropped_count += len(cert_out) - 12
        cert_out = cert_out[:12]

    # 10. Links
    links_out: list[LinkItem] = []
    for item in raw_extraction.links or []:
        total_returned += 1
        if not verify_evidence(item.evidence, haystack_norm, haystack_compact):
            dropped_count += 1
            continue
        url_val = item.url.strip() if item.url else ""
        parsed = urlparse(url_val)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            dropped_count += 1
            continue
        if not is_substring_in_haystack(url_val, haystack_norm, haystack_compact):
            dropped_count += 1
            continue
        l_type = item.type if item.type in VALID_LINK_TYPES else "other"
        links_out.append(
            LinkItem(
                type=l_type,
                url=url_val,
                evidence=item.evidence,
            )
        )
        kept_count += 1
    if len(links_out) > 10:
        dropped_count += len(links_out) - 10
        links_out = links_out[:10]

    # Quality determination
    # "empty" when nothing survives
    total_surviving = (
        (1 if full_name_out else 0)
        + (1 if headline_out else 0)
        + (1 if summary_out else 0)
        + (1 if location_out else 0)
        + len(skills_out)
        + len(exp_out)
        + len(edu_out)
        + len(proj_out)
        + len(cert_out)
        + len(links_out)
    )

    if total_surviving == 0:
        quality = "empty"
    elif (
        len(source_resume_text.strip()) < 200
        or (total_returned > 0 and (dropped_count / total_returned) > 0.30)
    ):
        quality = "partial"
    else:
        quality = "ok"

    sanitized = ResumeAutofillExtraction(
        schema_version="1",
        full_name=full_name_out,
        headline=headline_out,
        summary_text=summary_out,
        location=location_out,
        skills=skills_out,
        experience=exp_out,
        education=edu_out,
        projects=proj_out,
        certifications=cert_out,
        links=links_out,
    )

    return VerificationResult(
        extraction=sanitized,
        quality=quality,
        total_returned=total_returned,
        kept_count=kept_count,
        dropped_count=dropped_count,
    )
