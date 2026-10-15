from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class EvidenceSpan(BaseModel):
    model_config = ConfigDict(extra="forbid")
    value: str
    evidence: str


class LocationEvidence(BaseModel):
    model_config = ConfigDict(extra="forbid")
    city: str | None = None
    region: str | None = None
    country: str | None = None
    evidence: str


class ExperienceItem(BaseModel):
    model_config = ConfigDict(extra="forbid")
    company: str | None = None
    title: str | None = None
    employment_type: Literal["full_time", "part_time", "contract", "internship", "freelance"] | None = None
    location_text: str | None = None
    start: str | None = None
    end: str | None = None
    is_current: bool = False
    summary: str | None = Field(default=None, max_length=800)
    evidence: str


class EducationItem(BaseModel):
    model_config = ConfigDict(extra="forbid")
    institution: str | None = None
    degree: str | None = None
    field_of_study: str | None = None
    start_year: str | None = None
    end_year: str | None = None
    grade_text: str | None = None
    evidence: str


class ProjectItem(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str
    summary: str | None = Field(default=None, max_length=400)
    technologies: list[str] = Field(default_factory=list)
    url: str | None = None
    evidence: str


class CertificationItem(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str
    issuer: str | None = None
    year: str | None = None
    evidence: str


class LinkItem(BaseModel):
    model_config = ConfigDict(extra="forbid")
    type: Literal["linkedin", "github", "portfolio", "website", "other"]
    url: str
    evidence: str


class ResumeAutofillExtraction(BaseModel):
    model_config = ConfigDict(extra="forbid")
    schema_version: Literal["1"] = "1"
    full_name: EvidenceSpan | None = None
    headline: EvidenceSpan | None = None
    summary_text: EvidenceSpan | None = None
    location: LocationEvidence | None = None
    skills: list[str] = Field(default_factory=list, max_length=60)
    experience: list[ExperienceItem] = Field(default_factory=list, max_length=15)
    education: list[EducationItem] = Field(default_factory=list, max_length=6)
    projects: list[ProjectItem] = Field(default_factory=list, max_length=12)
    certifications: list[CertificationItem] = Field(default_factory=list, max_length=12)
    links: list[LinkItem] = Field(default_factory=list, max_length=10)
