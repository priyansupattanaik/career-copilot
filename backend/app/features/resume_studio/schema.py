from __future__ import annotations

import uuid
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

STUDIO_SCHEMA_VERSION = "resume-studio-v1"
SOURCE_TYPE_STUDIO = "studio"

TemplateId = Literal["classic", "modern", "minimal"]
PageSize = Literal["a4", "letter"]
FontId = Literal["calibri", "arial", "georgia", "garamond", "palatino"]
Alignment = Literal["left", "center", "right"]
DividerStyle = Literal["none", "line", "space"]
HeadingWeight = Literal[600, 700]
SuggestAction = Literal[
    "improve_summary",
    "improve_bullet",
    "make_concise",
    "make_achievement_oriented",
    "improve_ats_relevance",
    "suggest_stronger_wording",
    "explain_recommendation",
    "suggest_supported_skills",
]


def new_id(prefix: str = "item") -> str:
    return f"{prefix}-{uuid.uuid4().hex[:12]}"


class StudioLink(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str = Field(default_factory=lambda: new_id("link"), max_length=80)
    label: str = Field(default="", max_length=80)
    url: str = Field(default="", max_length=500)


class PersonalInfo(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(default="", max_length=160)
    email: str = Field(default="", max_length=320)
    phone: str = Field(default="", max_length=40)
    location: str = Field(default="", max_length=160)
    linkedin: str = Field(default="", max_length=500)
    github: str = Field(default="", max_length=500)
    portfolio: str = Field(default="", max_length=500)
    website: str = Field(default="", max_length=500)
    other_links: list[StudioLink] = Field(default_factory=list, max_length=8)


class SkillItem(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str = Field(default_factory=lambda: new_id("skill"), max_length=80)
    name: str = Field(default="", max_length=80)


class SkillGroup(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str = Field(default_factory=lambda: new_id("sg"), max_length=80)
    name: str = Field(default="", max_length=80)
    items: list[SkillItem] = Field(default_factory=list, max_length=40)


class Bullet(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str = Field(default_factory=lambda: new_id("b"), max_length=80)
    text: str = Field(default="", max_length=600)


class ExperienceEntry(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str = Field(default_factory=lambda: new_id("exp"), max_length=80)
    employer: str = Field(default="", max_length=200)
    title: str = Field(default="", max_length=200)
    location: str = Field(default="", max_length=160)
    start_date: str = Field(default="", max_length=40)
    end_date: str = Field(default="", max_length=40)
    is_current: bool = False
    employment_type: str = Field(default="", max_length=80)
    bullets: list[Bullet] = Field(default_factory=list, max_length=20)


class ProjectEntry(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str = Field(default_factory=lambda: new_id("proj"), max_length=80)
    name: str = Field(default="", max_length=200)
    description: str = Field(default="", max_length=2000)
    technologies: list[str] = Field(default_factory=list, max_length=30)
    url: str = Field(default="", max_length=500)
    bullets: list[Bullet] = Field(default_factory=list, max_length=16)


class EducationEntry(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str = Field(default_factory=lambda: new_id("edu"), max_length=80)
    institution: str = Field(default="", max_length=200)
    degree: str = Field(default="", max_length=160)
    specialization: str = Field(default="", max_length=160)
    location: str = Field(default="", max_length=160)
    start_date: str = Field(default="", max_length=40)
    end_date: str = Field(default="", max_length=40)
    gpa: str = Field(default="", max_length=40)
    details: str = Field(default="", max_length=1000)


class CertificationEntry(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str = Field(default_factory=lambda: new_id("cert"), max_length=80)
    name: str = Field(default="", max_length=200)
    issuer: str = Field(default="", max_length=160)
    date: str = Field(default="", max_length=40)
    credential_id: str = Field(default="", max_length=120)
    credential_url: str = Field(default="", max_length=500)


class AchievementEntry(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str = Field(default_factory=lambda: new_id("ach"), max_length=80)
    text: str = Field(default="", max_length=400)


class LanguageEntry(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str = Field(default_factory=lambda: new_id("lang"), max_length=80)
    language: str = Field(default="", max_length=80)
    proficiency: str = Field(default="", max_length=80)


class AdditionalEntry(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str = Field(default_factory=lambda: new_id("line"), max_length=80)
    text: str = Field(default="", max_length=600)


class AdditionalSection(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str = Field(default_factory=lambda: new_id("add"), max_length=80)
    title: str = Field(default="Additional", max_length=80)
    entries: list[AdditionalEntry] = Field(default_factory=list, max_length=40)


class SectionTypography(BaseModel):
    model_config = ConfigDict(extra="forbid")
    font_size: float | None = Field(default=None, ge=8, le=14)
    heading_size: float | None = Field(default=None, ge=9, le=18)


class PresentationSettings(BaseModel):
    model_config = ConfigDict(extra="forbid")
    template: TemplateId = "classic"
    page_size: PageSize = "a4"
    font_family: FontId = "calibri"
    font_size: float = Field(default=10.5, ge=9, le=12.5)
    heading_size: float = Field(default=12.5, ge=10, le=16)
    heading_weight: HeadingWeight = 700
    line_height: float = Field(default=1.28, ge=1.1, le=1.6)
    paragraph_spacing: float = Field(default=4, ge=0, le=14)
    section_spacing: float = Field(default=12, ge=4, le=28)
    heading_spacing: float = Field(default=4, ge=1, le=14)
    bullet_spacing: float = Field(default=2, ge=0, le=10)
    bullet_indent: float = Field(default=14, ge=8, le=32)
    margin_top: float = Field(default=16, ge=10, le=28)
    margin_right: float = Field(default=16, ge=10, le=28)
    margin_bottom: float = Field(default=16, ge=10, le=28)
    margin_left: float = Field(default=16, ge=10, le=28)
    header_alignment: Alignment = "center"
    heading_alignment: Literal["left", "center"] = "left"
    accent_color: str = Field(default="#1e3a5f", max_length=16)
    divider: DividerStyle = "line"
    section_overrides: dict[str, SectionTypography] = Field(default_factory=dict)

    @field_validator("accent_color")
    @classmethod
    def _hex_color(cls, value: str) -> str:
        raw = (value or "").strip()
        if not raw:
            return "#1e3a5f"
        if raw[0] != "#":
            raw = f"#{raw}"
        if len(raw) not in {4, 7} or any(ch not in "0123456789abcdefABCDEF#" for ch in raw):
            return "#1e3a5f"
        return raw.lower()


class ResumeContent(BaseModel):
    model_config = ConfigDict(extra="forbid")
    personal: PersonalInfo = Field(default_factory=PersonalInfo)
    summary: str = Field(default="", max_length=4000)
    skill_groups: list[SkillGroup] = Field(default_factory=list, max_length=12)
    experience: list[ExperienceEntry] = Field(default_factory=list, max_length=20)
    projects: list[ProjectEntry] = Field(default_factory=list, max_length=16)
    education: list[EducationEntry] = Field(default_factory=list, max_length=12)
    certifications: list[CertificationEntry] = Field(default_factory=list, max_length=20)
    achievements: list[AchievementEntry] = Field(default_factory=list, max_length=20)
    links: list[StudioLink] = Field(default_factory=list, max_length=12)
    languages: list[LanguageEntry] = Field(default_factory=list, max_length=16)
    additional: list[AdditionalSection] = Field(default_factory=list, max_length=8)
    section_order: list[str] = Field(default_factory=list, max_length=24)
    hidden_sections: list[str] = Field(default_factory=list, max_length=24)


class StudioDocument(BaseModel):
    model_config = ConfigDict(extra="forbid")
    schema_version: str = STUDIO_SCHEMA_VERSION
    source_version_id: str = Field(min_length=8, max_length=80)
    ats_analysis_id: str | None = Field(default=None, max_length=80)
    content: ResumeContent = Field(default_factory=ResumeContent)
    presentation: PresentationSettings = Field(default_factory=PresentationSettings)


class StudioSessionOpen(BaseModel):
    model_config = ConfigDict(extra="forbid")
    source_version_id: str | None = Field(default=None, max_length=80)
    ats_analysis_id: str | None = Field(default=None, max_length=80)
    resume_id: str | None = Field(default=None, max_length=80)


class StudioSessionSave(BaseModel):
    model_config = ConfigDict(extra="forbid")
    content: ResumeContent
    presentation: PresentationSettings


class StudioSuggestRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    action: SuggestAction
    section_key: str = Field(min_length=1, max_length=80)
    entry_id: str | None = Field(default=None, max_length=80)
    bullet_id: str | None = Field(default=None, max_length=80)
    selected_text: str = Field(min_length=1, max_length=4000)
    ats_issue: str | None = Field(default=None, max_length=400)

    @model_validator(mode="after")
    def _text_present(self) -> "StudioSuggestRequest":
        if not self.selected_text.strip():
            raise ValueError("selected_text is required")
        return self


class StudioSuggestion(BaseModel):
    model_config = ConfigDict(extra="forbid")
    proposed_text: str = Field(default="", max_length=4000)
    reason: str = Field(default="", max_length=1000)
    addresses: str = Field(default="", max_length=400)
    needs_candidate_input: bool = False
    missing_facts: list[str] = Field(default_factory=list, max_length=8)
    requires_confirmation: bool = False
    unsupported_claims: list[str] = Field(default_factory=list, max_length=12)


def default_section_order(content: ResumeContent) -> list[str]:
    order: list[str] = []
    if _personal_present(content.personal):
        order.append("personal")
    if content.summary.strip():
        order.append("summary")
    if any(item.name.strip() for group in content.skill_groups for item in group.items):
        order.append("skills")
    if content.experience:
        order.append("experience")
    if content.projects:
        order.append("projects")
    if content.education:
        order.append("education")
    if content.certifications:
        order.append("certifications")
    if content.achievements:
        order.append("achievements")
    if content.languages:
        order.append("languages")
    if content.links or _personal_links(content.personal):
        order.append("links")
    for extra in content.additional:
        if extra.title.strip() or any(row.text.strip() for row in extra.entries):
            order.append(f"additional:{extra.id}")
    return order or ["personal"]


def _personal_present(personal: PersonalInfo) -> bool:
    return any(
        [
            personal.name.strip(),
            personal.email.strip(),
            personal.phone.strip(),
            personal.location.strip(),
            personal.linkedin.strip(),
            personal.github.strip(),
            personal.portfolio.strip(),
            personal.website.strip(),
        ]
    )


def _personal_links(personal: PersonalInfo) -> bool:
    return any(
        [
            personal.linkedin.strip(),
            personal.github.strip(),
            personal.portfolio.strip(),
            personal.website.strip(),
            any(link.url.strip() for link in personal.other_links),
        ]
    )


def studio_payload(document: StudioDocument, sections: dict[str, list[str]]) -> dict[str, Any]:
    return {
        "schema_version": STUDIO_SCHEMA_VERSION,
        "sections": sections,
        "unclassified_blocks": [],
        "warnings": [],
        "studio": document.model_dump(),
    }


def parse_studio_document(structured: dict[str, Any] | None) -> StudioDocument | None:
    if not isinstance(structured, dict):
        return None
    raw = structured.get("studio")
    if not isinstance(raw, dict):
        return None
    try:
        return StudioDocument.model_validate(raw)
    except Exception:
        return None
