from __future__ import annotations

import io
from html import escape
from typing import Any

from reportlab.lib.colors import HexColor, black
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4, LETTER
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    KeepTogether,
    ListFlowable,
    ListItem,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    HRFlowable,
)

from app.features.resume_studio.schema import (
    PresentationSettings,
    ResumeContent,
    StudioDocument,
    parse_studio_document,
)

FONT_MAP = {
    "calibri": ("Helvetica", "Helvetica-Bold"),
    "arial": ("Helvetica", "Helvetica-Bold"),
    "georgia": ("Times-Roman", "Times-Bold"),
    "garamond": ("Times-Roman", "Times-Bold"),
    "palatino": ("Times-Roman", "Times-Bold"),
}

ALIGN_MAP = {"left": TA_LEFT, "center": TA_CENTER, "right": TA_RIGHT}


def _mm(value: float) -> float:
    return float(value) * mm


def _page_size(presentation: PresentationSettings) -> tuple[float, float]:
    return LETTER if presentation.page_size == "letter" else A4


def _fonts(presentation: PresentationSettings) -> tuple[str, str]:
    return FONT_MAP.get(presentation.font_family, FONT_MAP["calibri"])


def _styles(presentation: PresentationSettings) -> dict[str, ParagraphStyle]:
    body_font, heading_font = _fonts(presentation)
    accent = HexColor(presentation.accent_color)
    header_align = ALIGN_MAP.get(presentation.header_alignment, TA_CENTER)
    heading_align = ALIGN_MAP.get(presentation.heading_alignment, TA_LEFT)
    leading = presentation.font_size * presentation.line_height
    return {
        "name": ParagraphStyle(
            "StudioName",
            fontName=heading_font,
            fontSize=presentation.heading_size + 4,
            leading=(presentation.heading_size + 4) * 1.15,
            textColor=accent if presentation.template != "classic" else black,
            alignment=header_align,
            spaceAfter=2,
        ),
        "contact": ParagraphStyle(
            "StudioContact",
            fontName=body_font,
            fontSize=max(8.5, presentation.font_size - 0.5),
            leading=max(11, leading - 1),
            textColor=black,
            alignment=header_align,
            spaceAfter=presentation.section_spacing * 0.4,
        ),
        "heading": ParagraphStyle(
            "StudioHeading",
            fontName=heading_font,
            fontSize=presentation.heading_size,
            leading=presentation.heading_size * 1.2,
            textColor=accent if presentation.template == "modern" else black,
            alignment=heading_align,
            spaceBefore=presentation.section_spacing * 0.35,
            spaceAfter=presentation.heading_spacing,
        ),
        "body": ParagraphStyle(
            "StudioBody",
            fontName=body_font,
            fontSize=presentation.font_size,
            leading=leading,
            textColor=black,
            alignment=TA_LEFT,
            spaceAfter=presentation.paragraph_spacing,
        ),
        "meta": ParagraphStyle(
            "StudioMeta",
            fontName=body_font,
            fontSize=presentation.font_size,
            leading=leading,
            textColor=black,
            alignment=TA_LEFT,
            spaceAfter=1,
        ),
        "bullet": ParagraphStyle(
            "StudioBullet",
            fontName=body_font,
            fontSize=presentation.font_size,
            leading=leading,
            textColor=black,
            leftIndent=0,
            spaceAfter=presentation.bullet_spacing,
        ),
    }


def _p(text: str, style: ParagraphStyle) -> Paragraph:
    return Paragraph(escape(text).replace("\n", "<br/>"), style)


def _section_heading(title: str, presentation: PresentationSettings, styles: dict[str, ParagraphStyle]) -> list[Any]:
    bits: list[Any] = [_p(title, styles["heading"])]
    if presentation.divider == "line":
        bits.append(
            HRFlowable(
                width="100%",
                thickness=0.6,
                color=HexColor(presentation.accent_color)
                if presentation.template == "modern"
                else HexColor("#333333"),
                spaceBefore=0,
                spaceAfter=presentation.heading_spacing,
            )
        )
    elif presentation.divider == "space":
        bits.append(Spacer(1, presentation.heading_spacing))
    return bits


def _visible(content: ResumeContent, key: str) -> bool:
    return key not in set(content.hidden_sections or [])


def _header_flow(content: ResumeContent, presentation: PresentationSettings, styles: dict[str, ParagraphStyle]) -> list[Any]:
    personal = content.personal
    flow: list[Any] = []
    if personal.name.strip():
        flow.append(_p(personal.name.strip(), styles["name"]))
    contact_parts = [
        part.strip()
        for part in (personal.email, personal.phone, personal.location)
        if part and part.strip()
    ]
    links = [
        part.strip()
        for part in (personal.linkedin, personal.github, personal.portfolio, personal.website)
        if part and part.strip()
    ]
    line = " · ".join(contact_parts + links)
    if line:
        flow.append(_p(line, styles["contact"]))
    if presentation.template == "modern":
        flow.append(
            HRFlowable(
                width="100%",
                thickness=1.2,
                color=HexColor(presentation.accent_color),
                spaceBefore=2,
                spaceAfter=presentation.section_spacing * 0.5,
            )
        )
    return flow


def _bullets(texts: list[str], presentation: PresentationSettings, styles: dict[str, ParagraphStyle]) -> ListFlowable:
    items = [
        ListItem(_p(text, styles["bullet"]), leftIndent=presentation.bullet_indent, bulletColor=black)
        for text in texts
        if text.strip()
    ]
    return ListFlowable(
        items,
        bulletType="bullet",
        start="•",
        leftIndent=presentation.bullet_indent,
        bulletFontName=_fonts(presentation)[0],
        bulletFontSize=presentation.font_size,
        spaceBefore=0,
        spaceAfter=presentation.paragraph_spacing,
    )


def _experience_block(entry, presentation, styles) -> KeepTogether:
    parts: list[Any] = []
    title_bits = [bit for bit in (entry.title.strip(), entry.employer.strip()) if bit]
    title = " · ".join(title_bits)
    dates = " – ".join(bit for bit in (entry.start_date.strip(), "Present" if entry.is_current else entry.end_date.strip()) if bit)
    meta = " · ".join(bit for bit in (entry.location.strip(), dates, entry.employment_type.strip()) if bit)
    if title:
        parts.append(_p(title, styles["meta"]))
    if meta:
        parts.append(_p(meta, styles["body"]))
    bullets = [row.text.strip() for row in entry.bullets if row.text.strip()]
    if bullets:
        parts.append(_bullets(bullets, presentation, styles))
    return KeepTogether(parts)


def _project_block(entry, presentation, styles) -> KeepTogether:
    parts: list[Any] = []
    name = entry.name.strip()
    if entry.url.strip():
        name = f"{name} — {entry.url.strip()}".strip(" —")
    if name:
        parts.append(_p(name, styles["meta"]))
    if entry.description.strip():
        parts.append(_p(entry.description.strip(), styles["body"]))
    if entry.technologies:
        tech = ", ".join(item.strip() for item in entry.technologies if item.strip())
        if tech:
            parts.append(_p(tech, styles["body"]))
    bullets = [row.text.strip() for row in entry.bullets if row.text.strip()]
    if bullets:
        parts.append(_bullets(bullets, presentation, styles))
    return KeepTogether(parts)


def build_story(document: StudioDocument) -> list[Any]:
    content = document.content
    presentation = document.presentation
    styles = _styles(presentation)
    story: list[Any] = []
    order = content.section_order or [
        "personal",
        "summary",
        "skills",
        "experience",
        "projects",
        "education",
        "certifications",
        "achievements",
        "languages",
        "links",
    ]
    extra_by_id = {item.id: item for item in content.additional}

    if _visible(content, "personal"):
        story.extend(_header_flow(content, presentation, styles))

    for key in order:
        if key == "personal" or not _visible(content, key):
            continue
        if key == "summary" and content.summary.strip():
            story.extend(_section_heading("Professional Summary", presentation, styles))
            story.append(_p(content.summary.strip(), styles["body"]))
        elif key == "skills":
            lines = []
            for group in content.skill_groups:
                names = [item.name.strip() for item in group.items if item.name.strip()]
                if not names:
                    continue
                lines.append(f"{group.name.strip()}: {', '.join(names)}" if group.name.strip() else ", ".join(names))
            if lines:
                story.extend(_section_heading("Skills", presentation, styles))
                joined = " · ".join(lines) if presentation.template == "minimal" else "\n".join(lines)
                story.append(_p(joined, styles["body"]))
        elif key == "experience" and content.experience:
            story.extend(_section_heading("Experience", presentation, styles))
            for entry in content.experience:
                story.append(_experience_block(entry, presentation, styles))
        elif key == "projects" and content.projects:
            story.extend(_section_heading("Projects", presentation, styles))
            for entry in content.projects:
                story.append(_project_block(entry, presentation, styles))
        elif key == "education" and content.education:
            story.extend(_section_heading("Education", presentation, styles))
            for entry in content.education:
                bits = [entry.degree.strip(), entry.institution.strip(), entry.specialization.strip()]
                line = " · ".join(bit for bit in bits if bit)
                meta = " · ".join(
                    bit
                    for bit in (
                        entry.location.strip(),
                        " – ".join(bit for bit in (entry.start_date.strip(), entry.end_date.strip()) if bit),
                        f"GPA {entry.gpa.strip()}" if entry.gpa.strip() else "",
                    )
                    if bit
                )
                block = []
                if line:
                    block.append(_p(line, styles["meta"]))
                if meta:
                    block.append(_p(meta, styles["body"]))
                if entry.details.strip():
                    block.append(_p(entry.details.strip(), styles["body"]))
                if block:
                    story.append(KeepTogether(block))
        elif key == "certifications" and content.certifications:
            story.extend(_section_heading("Certifications", presentation, styles))
            for entry in content.certifications:
                line = " · ".join(bit for bit in (entry.name.strip(), entry.issuer.strip(), entry.date.strip()) if bit)
                if line:
                    story.append(_p(line, styles["body"]))
        elif key == "achievements" and content.achievements:
            texts = [row.text.strip() for row in content.achievements if row.text.strip()]
            if texts:
                story.extend(_section_heading("Achievements", presentation, styles))
                story.append(_bullets(texts, presentation, styles))
        elif key == "languages" and content.languages:
            line = " · ".join(
                f"{row.language.strip()}" + (f" ({row.proficiency.strip()})" if row.proficiency.strip() else "")
                for row in content.languages
                if row.language.strip()
            )
            if line:
                story.extend(_section_heading("Languages", presentation, styles))
                story.append(_p(line, styles["body"]))
        elif key == "links":
            lines = [f"{link.label.strip()}: {link.url.strip()}".strip(": ") for link in content.links if link.url.strip()]
            if lines:
                story.extend(_section_heading("Links", presentation, styles))
                story.append(_p(" · ".join(lines), styles["body"]))
        elif key.startswith("additional:"):
            extra_id = key.split(":", 1)[1]
            extra = extra_by_id.get(extra_id)
            if not extra:
                continue
            texts = [row.text.strip() for row in extra.entries if row.text.strip()]
            if not texts:
                continue
            story.extend(_section_heading(extra.title.strip() or "Additional", presentation, styles))
            story.append(_bullets(texts, presentation, styles))
    return story


def render_studio_pdf(structured: dict[str, Any]) -> bytes | None:
    document = parse_studio_document(structured)
    if document is None:
        return None
    presentation = document.presentation
    output = io.BytesIO()
    page = _page_size(presentation)
    doc = SimpleDocTemplate(
        output,
        pagesize=page,
        leftMargin=_mm(presentation.margin_left),
        rightMargin=_mm(presentation.margin_right),
        topMargin=_mm(presentation.margin_top),
        bottomMargin=_mm(presentation.margin_bottom),
        title=(document.content.personal.name or "Resume").strip() or "Resume",
        author="",
    )
    story = build_story(document)
    if not story:
        story = [Paragraph(" ", ParagraphStyle("Empty", fontName="Helvetica", fontSize=10))]
    doc.build(story)
    return output.getvalue()
