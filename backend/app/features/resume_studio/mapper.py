from __future__ import annotations

import re
from typing import Any

from app.features.document_parsing.parsing.sections import canonical_section_key
from app.features.resume_studio.schema import (
    AchievementEntry,
    AdditionalEntry,
    AdditionalSection,
    Bullet,
    CertificationEntry,
    EducationEntry,
    ExperienceEntry,
    LanguageEntry,
    PersonalInfo,
    PresentationSettings,
    ProjectEntry,
    ResumeContent,
    SkillGroup,
    SkillItem,
    StudioDocument,
    StudioLink,
    default_section_order,
    parse_studio_document,
)

EMAIL_RE = re.compile(r"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}")
URL_RE = re.compile(r"(https?://[^\s,;|]+|www\.[^\s,;|]+)", re.I)
PHONE_RE = re.compile(
    r"(?:\+\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?){1,3}\d{3,4}"
)
DATE_SPAN_RE = re.compile(
    r"((?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+)?"
    r"(?:19|20)\d{2}|\d{1,2}/\d{4})"
    r"(?:\s*[-–—to]+\s*"
    r"(present|current|now|(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+)?"
    r"(?:19|20)\d{2}|\d{1,2}/\d{4}))?",
    re.I,
)
BULLET_RE = re.compile(r"^[\u2022\u2023\u25e6•●○▪▸►\-\*]+\s*")
PLACEHOLDER_RE = re.compile(
    r"^\s*(not found|n/?a|none|unknown|placeholder|tbd)\s*$",
    re.I,
)
INTERNAL_KEYS = {
    "warnings",
    "confidence",
    "extraction_method",
    "corrections",
    "detected_headings",
    "schema_version",
    "unclassified_blocks",
    "studio",
}


def _clean_line(value: Any) -> str:
    text = re.sub(r"\s+", " ", str(value or "")).strip()
    if not text or PLACEHOLDER_RE.match(text):
        return ""
    lowered = text.casefold()
    if lowered.startswith("warning:") or lowered.startswith("confidence:"):
        return ""
    return text


def _section_lines(structured: dict[str, Any], *keys: str) -> list[str]:
    sections = structured.get("sections") if isinstance(structured.get("sections"), dict) else {}
    lines: list[str] = []
    wanted = {canonical_section_key(key) for key in keys}
    for raw_key, value in sections.items():
        if canonical_section_key(str(raw_key)) not in wanted:
            continue
        items = value if isinstance(value, list) else [value]
        for item in items:
            line = _clean_line(item)
            if line:
                lines.append(line)
    return lines


def _strip_bullet(line: str) -> str:
    return BULLET_RE.sub("", line).strip()


def _is_bullet(line: str) -> bool:
    return bool(BULLET_RE.match(line))


def _looks_like_name(line: str) -> bool:
    if EMAIL_RE.search(line) or URL_RE.search(line) or PHONE_RE.search(line):
        return False
    words = [part for part in re.split(r"\s+", line) if part]
    if not (1 <= len(words) <= 6):
        return False
    letters = re.sub(r"[^A-Za-z]", "", line)
    return len(letters) >= 2 and len(letters) / max(1, len(re.sub(r"\s+", "", line))) > 0.6


def _looks_like_location(line: str) -> bool:
    if EMAIL_RE.search(line) or URL_RE.search(line):
        return False
    if len(line) > 80:
        return False
    return "," in line or bool(
        re.search(r"\b(remote|india|usa|uk|canada|germany|hybrid)\b", line, re.I)
    )


def _assign_url(personal: PersonalInfo, url: str) -> None:
    value = url.strip()
    if value.lower().startswith("www."):
        value = f"https://{value}"
    lowered = value.casefold()
    if "linkedin.com" in lowered and not personal.linkedin:
        personal.linkedin = value
    elif "github.com" in lowered and not personal.github:
        personal.github = value
    elif any(token in lowered for token in ("behance", "dribbble", "portfolio")) and not personal.portfolio:
        personal.portfolio = value
    elif not personal.website:
        personal.website = value
    else:
        personal.other_links.append(StudioLink(label="Link", url=value))


def _parse_personal(structured: dict[str, Any]) -> PersonalInfo:
    personal = PersonalInfo()
    unclassified = [
        _clean_line(item) for item in (structured.get("unclassified_blocks") or []) if _clean_line(item)
    ]
    contact = _section_lines(structured, "contact", "personal", "links")
    pool = unclassified + contact
    leftover: list[str] = []
    for line in pool:
        emails = EMAIL_RE.findall(line)
        if emails and not personal.email:
            personal.email = emails[0]
            line = EMAIL_RE.sub(" ", line)
        for match in URL_RE.findall(line):
            _assign_url(personal, match)
            line = line.replace(match, " ")
        phone_match = PHONE_RE.search(line)
        if phone_match and not personal.phone:
            candidate = phone_match.group(0).strip()
            digits = re.sub(r"\D", "", candidate)
            if 8 <= len(digits) <= 15:
                personal.phone = candidate
                line = line[: phone_match.start()] + " " + line[phone_match.end() :]
        line = _clean_line(line)
        if not line:
            continue
        leftover.append(line)
    for line in leftover:
        if not personal.name and _looks_like_name(line):
            personal.name = line
        elif not personal.location and _looks_like_location(line):
            personal.location = line
        elif not personal.name:
            personal.name = line
    return personal


def _split_skills(lines: list[str]) -> list[SkillGroup]:
    groups: list[SkillGroup] = []
    ungrouped: list[SkillItem] = []
    for line in lines:
        if ":" in line and len(line.split(":", 1)[0]) <= 40:
            name, rest = line.split(":", 1)
            items = [_clean_line(part) for part in re.split(r"[,;/|]", rest)]
            items = [part for part in items if part]
            if items:
                groups.append(
                    SkillGroup(
                        name=_clean_line(name),
                        items=[SkillItem(name=item) for item in items],
                    )
                )
                continue
        parts = [_clean_line(part) for part in re.split(r"[,;/|]", line)]
        parts = [part for part in parts if part]
        if len(parts) > 1:
            ungrouped.extend(SkillItem(name=part) for part in parts)
        elif line:
            ungrouped.append(SkillItem(name=line))
    if ungrouped:
        groups.insert(0, SkillGroup(name="", items=ungrouped))
    return groups


def _split_entries(lines: list[str]) -> list[list[str]]:
    blocks: list[list[str]] = []
    current: list[str] = []
    for line in lines:
        headerish = (not _is_bullet(line)) and bool(DATE_SPAN_RE.search(line) or " at " in line.casefold() or "|" in line)
        if current and headerish and not _is_bullet(current[-1]):
            blocks.append(current)
            current = [line]
        elif current and headerish and _is_bullet(current[-1]):
            blocks.append(current)
            current = [line]
        else:
            current.append(line)
    if current:
        blocks.append(current)
    return blocks


def _split_header_fields(header: str) -> dict[str, str]:
    text = header.strip(" -–—|,")
    start = ""
    end = ""
    is_current = False
    span = DATE_SPAN_RE.search(text)
    if span:
        start = (span.group(1) or "").strip()
        end_raw = (span.group(2) or "").strip()
        if end_raw.casefold() in {"present", "current", "now"}:
            is_current = True
            end = ""
        else:
            end = end_raw
        text = (text[: span.start()] + " " + text[span.end() :]).strip(" -–—|,")
    parts = [part.strip() for part in re.split(r"\s*[|–—•]\s*|\s+[-–]\s+", text) if part.strip()]
    if len(parts) == 1 and re.search(r"\s+at\s+", parts[0], re.I):
        title, employer = re.split(r"\s+at\s+", parts[0], maxsplit=1, flags=re.I)
        parts = [title, employer]
    title = parts[0] if parts else text
    employer = parts[1] if len(parts) > 1 else ""
    location = ""
    extra = parts[2:] if len(parts) > 2 else []
    for item in extra:
        if re.search(r"full[- ]time|part[- ]time|intern|contract|freelance", item, re.I):
            continue
        if not location:
            location = item
    employment_type = next(
        (
            item
            for item in extra
            if re.search(r"full[- ]time|part[- ]time|intern|contract|freelance", item, re.I)
        ),
        "",
    )
    return {
        "title": title,
        "employer": employer,
        "location": location,
        "start_date": start,
        "end_date": end,
        "employment_type": employment_type,
        "is_current": is_current,
    }


def _parse_experience(lines: list[str]) -> list[ExperienceEntry]:
    entries: list[ExperienceEntry] = []
    for block in _split_entries(lines):
        if not block:
            continue
        header = _strip_bullet(block[0])
        fields = _split_header_fields(header)
        bullets = [Bullet(text=_strip_bullet(line)) for line in block[1:] if _strip_bullet(line)]
        if not fields["title"] and not fields["employer"] and not bullets:
            continue
        entries.append(
            ExperienceEntry(
                employer=str(fields["employer"]),
                title=str(fields["title"]),
                location=str(fields["location"]),
                start_date=str(fields["start_date"]),
                end_date=str(fields["end_date"]),
                is_current=bool(fields["is_current"]),
                employment_type=str(fields["employment_type"]),
                bullets=bullets,
            )
        )
    return entries


def _parse_projects(lines: list[str]) -> list[ProjectEntry]:
    entries: list[ProjectEntry] = []
    for block in _split_entries(lines):
        if not block:
            continue
        header = _strip_bullet(block[0])
        url = ""
        match = URL_RE.search(header)
        if match:
            url = match.group(0)
            header = header.replace(url, " ").strip(" -–—|,")
        tech: list[str] = []
        bullets: list[Bullet] = []
        description = ""
        for line in block[1:]:
            cleaned = _strip_bullet(line)
            if cleaned.casefold().startswith("tech"):
                _, rest = cleaned.split(":", 1) if ":" in cleaned else ("", cleaned)
                tech = [part for part in (_clean_line(item) for item in re.split(r"[,;/|]", rest)) if part]
            elif _is_bullet(line) or len(block) > 2:
                bullets.append(Bullet(text=cleaned))
            elif not description:
                description = cleaned
            else:
                bullets.append(Bullet(text=cleaned))
        entries.append(
            ProjectEntry(name=header, description=description, technologies=tech, url=url, bullets=bullets)
        )
    return entries


def _parse_education(lines: list[str]) -> list[EducationEntry]:
    entries: list[EducationEntry] = []
    for block in _split_entries(lines):
        if not block:
            continue
        header = _strip_bullet(block[0])
        fields = _split_header_fields(header)
        gpa = ""
        specialization = ""
        details = []
        for line in block[1:]:
            text = _strip_bullet(line)
            gpa_match = re.search(r"(?:gpa|cgpa)\s*[:\-]?\s*([0-9]+(?:\.[0-9]+)?(?:\s*/\s*[0-9]+)?)", text, re.I)
            if gpa_match and not gpa:
                gpa = gpa_match.group(1).strip()
                continue
            if re.search(r"major|speciali[sz]ation|field", text, re.I) and not specialization:
                specialization = re.sub(r"^[^:]{0,24}:\s*", "", text).strip()
                continue
            details.append(text)
        entries.append(
            EducationEntry(
                institution=str(fields["employer"] or fields["title"]),
                degree="" if fields["employer"] else "",
                specialization=specialization,
                location=str(fields["location"]),
                start_date=str(fields["start_date"]),
                end_date=str(fields["end_date"]),
                gpa=gpa,
                details=" ".join(details),
            )
        )
        if fields["employer"] and fields["title"]:
            entries[-1].institution = str(fields["employer"])
            entries[-1].degree = str(fields["title"])
        elif fields["title"]:
            entries[-1].institution = str(fields["title"])
    return entries


def _parse_certifications(lines: list[str]) -> list[CertificationEntry]:
    entries: list[CertificationEntry] = []
    for line in lines:
        text = _strip_bullet(line)
        url = ""
        match = URL_RE.search(text)
        if match:
            url = match.group(0)
            text = text.replace(url, " ").strip(" -–—|,")
        date = ""
        span = DATE_SPAN_RE.search(text)
        if span:
            date = span.group(0)
            text = (text[: span.start()] + " " + text[span.end() :]).strip(" -–—|,")
        parts = [part.strip() for part in re.split(r"\s*[|–—•]\s*|\s+[-–]\s+", text) if part.strip()]
        name = parts[0] if parts else text
        issuer = parts[1] if len(parts) > 1 else ""
        credential_id = ""
        for part in parts[2:]:
            if re.search(r"id|credential", part, re.I):
                credential_id = re.sub(r"^[^:]{0,20}:\s*", "", part).strip()
            elif not issuer:
                issuer = part
        entries.append(
            CertificationEntry(
                name=name,
                issuer=issuer,
                date=date,
                credential_id=credential_id,
                credential_url=url,
            )
        )
    return entries


def _parse_languages(lines: list[str]) -> list[LanguageEntry]:
    entries: list[LanguageEntry] = []
    for line in lines:
        for part in re.split(r"[,;/|]", line):
            text = _clean_line(part)
            if not text:
                continue
            if ":" in text:
                language, proficiency = text.split(":", 1)
            elif "(" in text and text.endswith(")"):
                language, proficiency = text[:-1].split("(", 1)
            else:
                language, proficiency = text, ""
            entries.append(LanguageEntry(language=language.strip(), proficiency=proficiency.strip()))
    return entries


def _known_section_keys() -> set[str]:
    return {
        "contact",
        "personal",
        "summary",
        "skills",
        "experience",
        "projects",
        "education",
        "certifications",
        "achievements",
        "awards",
        "languages",
        "links",
        "profile",
        "objective",
    }


def document_from_structured(
    structured: dict[str, Any] | None,
    *,
    source_version_id: str,
    ats_analysis_id: str | None = None,
    presentation: PresentationSettings | None = None,
) -> StudioDocument:
    existing = parse_studio_document(structured if isinstance(structured, dict) else None)
    if existing:
        existing.source_version_id = existing.source_version_id or source_version_id
        if ats_analysis_id:
            existing.ats_analysis_id = ats_analysis_id
        if not existing.content.section_order:
            existing.content.section_order = default_section_order(existing.content)
        return existing

    data = structured if isinstance(structured, dict) else {}
    content = ResumeContent(
        personal=_parse_personal(data),
        summary=" ".join(_section_lines(data, "summary", "profile", "objective")),
        skill_groups=_split_skills(_section_lines(data, "skills")),
        experience=_parse_experience(_section_lines(data, "experience")),
        projects=_parse_projects(_section_lines(data, "projects")),
        education=_parse_education(_section_lines(data, "education")),
        certifications=_parse_certifications(_section_lines(data, "certifications")),
        achievements=[
            AchievementEntry(text=_strip_bullet(line))
            for line in _section_lines(data, "achievements", "awards")
            if _strip_bullet(line)
        ],
        languages=_parse_languages(_section_lines(data, "languages")),
    )
    link_lines = _section_lines(data, "links")
    for line in link_lines:
        for match in URL_RE.findall(line):
            _assign_url(content.personal, match)
    if content.personal.linkedin:
        content.links.append(StudioLink(label="LinkedIn", url=content.personal.linkedin))
    if content.personal.github:
        content.links.append(StudioLink(label="GitHub", url=content.personal.github))
    if content.personal.portfolio:
        content.links.append(StudioLink(label="Portfolio", url=content.personal.portfolio))
    if content.personal.website:
        content.links.append(StudioLink(label="Website", url=content.personal.website))
    for extra in content.personal.other_links:
        content.links.append(extra)

    sections = data.get("sections") if isinstance(data.get("sections"), dict) else {}
    known = _known_section_keys()
    for raw_key, value in sections.items():
        key = canonical_section_key(str(raw_key))
        if key in known or key in INTERNAL_KEYS:
            continue
        lines = [_clean_line(item) for item in (value if isinstance(value, list) else [value])]
        lines = [line for line in lines if line]
        if not lines:
            continue
        extra = AdditionalSection(
            title=str(raw_key).replace("_", " ").strip().title() or "Additional",
            entries=[AdditionalEntry(text=line) for line in lines],
        )
        content.additional.append(extra)
    content.section_order = default_section_order(content)
    return StudioDocument(
        source_version_id=source_version_id,
        ats_analysis_id=ats_analysis_id,
        content=content,
        presentation=presentation or PresentationSettings(),
    )


def _date_range(start: str, end: str, is_current: bool = False) -> str:
    if start and (is_current or not end):
        return f"{start} – Present" if is_current or not end else start
    if start and end:
        return f"{start} – {end}"
    return end or start


def flatten_content(content: ResumeContent) -> dict[str, list[str]]:
    sections: dict[str, list[str]] = {}
    personal = content.personal
    contact: list[str] = []
    if personal.name.strip():
        contact.append(personal.name.strip())
    identity = [
        part
        for part in (personal.email, personal.phone, personal.location)
        if part and part.strip()
    ]
    if identity:
        contact.append(" · ".join(identity))
    for url in (personal.linkedin, personal.github, personal.portfolio, personal.website):
        if url.strip():
            contact.append(url.strip())
    if contact:
        sections["contact"] = contact
    if content.summary.strip():
        sections["summary"] = [content.summary.strip()]
    skill_lines: list[str] = []
    for group in content.skill_groups:
        names = [item.name.strip() for item in group.items if item.name.strip()]
        if not names:
            continue
        if group.name.strip():
            skill_lines.append(f"{group.name.strip()}: {', '.join(names)}")
        else:
            skill_lines.append(", ".join(names))
    if skill_lines:
        sections["skills"] = skill_lines
    experience_lines: list[str] = []
    for entry in content.experience:
        header_parts = [part for part in (entry.title.strip(), entry.employer.strip()) if part]
        header = " at ".join(header_parts) if len(header_parts) == 2 else (header_parts[0] if header_parts else "")
        meta = [
            part
            for part in (
                entry.location.strip(),
                _date_range(entry.start_date, entry.end_date, entry.is_current),
                entry.employment_type.strip(),
            )
            if part
        ]
        if header:
            experience_lines.append(" · ".join([header, *meta]) if meta else header)
        elif meta:
            experience_lines.append(" · ".join(meta))
        for bullet in entry.bullets:
            if bullet.text.strip():
                experience_lines.append(bullet.text.strip())
    if experience_lines:
        sections["experience"] = experience_lines
    project_lines: list[str] = []
    for entry in content.projects:
        head = entry.name.strip()
        if entry.url.strip():
            head = f"{head} {entry.url.strip()}".strip()
        if head:
            project_lines.append(head)
        if entry.description.strip():
            project_lines.append(entry.description.strip())
        if entry.technologies:
            project_lines.append("Technologies: " + ", ".join(t.strip() for t in entry.technologies if t.strip()))
        for bullet in entry.bullets:
            if bullet.text.strip():
                project_lines.append(bullet.text.strip())
    if project_lines:
        sections["projects"] = project_lines
    education_lines: list[str] = []
    for entry in content.education:
        head = " · ".join(
            part
            for part in (
                entry.degree.strip(),
                entry.institution.strip(),
                entry.specialization.strip(),
                entry.location.strip(),
                _date_range(entry.start_date, entry.end_date),
            )
            if part
        )
        if head:
            education_lines.append(head)
        if entry.gpa.strip():
            education_lines.append(f"GPA: {entry.gpa.strip()}")
        if entry.details.strip():
            education_lines.append(entry.details.strip())
    if education_lines:
        sections["education"] = education_lines
    cert_lines: list[str] = []
    for entry in content.certifications:
        head = " · ".join(part for part in (entry.name.strip(), entry.issuer.strip(), entry.date.strip()) if part)
        if entry.credential_id.strip():
            head = f"{head} ({entry.credential_id.strip()})" if head else entry.credential_id.strip()
        if entry.credential_url.strip():
            head = f"{head} {entry.credential_url.strip()}".strip()
        if head:
            cert_lines.append(head)
    if cert_lines:
        sections["certifications"] = cert_lines
    if content.achievements:
        sections["achievements"] = [row.text.strip() for row in content.achievements if row.text.strip()]
    if content.languages:
        sections["languages"] = [
            f"{row.language.strip()}" + (f" ({row.proficiency.strip()})" if row.proficiency.strip() else "")
            for row in content.languages
            if row.language.strip()
        ]
    link_lines = [f"{link.label.strip()}: {link.url.strip()}".strip(": ") for link in content.links if link.url.strip()]
    if link_lines:
        sections["links"] = link_lines
    for extra in content.additional:
        key = canonical_section_key(extra.title) or extra.id
        values = [row.text.strip() for row in extra.entries if row.text.strip()]
        if values:
            sections[key] = values
    return sections


def flatten_plain_text(content: ResumeContent) -> str:
    parts: list[str] = []
    for key, lines in flatten_content(content).items():
        heading = key.replace("_", " ").title()
        parts.append(heading)
        parts.extend(lines)
    return "\n".join(parts).strip()


def visible_text_blob(content: ResumeContent) -> str:
    return flatten_plain_text(content)
