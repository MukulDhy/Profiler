"""Pydantic contract shared by the LLM, the validator and the Node backend.

The shape mirrors exactly what the dashboard / recruiter / projects pages
consume, so the backend can persist the payload as-is.
"""

from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="ignore")


class LinkSet(StrictModel):
    github: Optional[str] = None
    linkedin: Optional[str] = None
    leetcode: Optional[str] = None
    portfolio: Optional[str] = None


class Candidate(StrictModel):
    name: str = ""
    title: str = ""
    initials: str = ""
    uuid: Optional[str] = None
    location: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    links: LinkSet = Field(default_factory=LinkSet)
    experienceYears: float = Field(default=0, ge=0, le=80)
    summary: str = ""


class KeywordMatch(StrictModel):
    matched: int = Field(default=0, ge=0)
    total: int = Field(default=0, ge=0)


class Analysis(StrictModel):
    score: float = Field(default=0, ge=0, le=100)
    atsScore: float = Field(default=0, ge=0, le=100)
    keywordMatch: KeywordMatch = Field(default_factory=KeywordMatch)
    formatting: str = "Not evaluated"
    missingKeywords: list[str] = Field(default_factory=list)
    strengths: list[str] = Field(default_factory=list)
    weaknesses: list[str] = Field(default_factory=list)
    suggestions: list[str] = Field(default_factory=list)
    recruiterImpression: str = ""


class Skill(StrictModel):
    name: str = ""
    level: int = Field(default=0, ge=0, le=100)
    group: str = "Other"


class RadarSkill(StrictModel):
    axis: str = ""
    value: int = Field(default=0, ge=0, le=100)


class TimelineItem(StrictModel):
    year: str = ""
    role: str = ""
    org: str = ""
    blurb: str = ""

    @field_validator("year", mode="before")
    @classmethod
    def _stringify_year(cls, value: Any) -> str:
        if value is None:
            return ""
        return str(value).strip()


class Project(StrictModel):
    id: str = ""
    name: str = ""
    tagline: str = ""
    tech: list[str] = Field(default_factory=list)
    metrics: dict[str, Any] = Field(default_factory=dict)
    summary: str = ""
    links: dict[str, str] = Field(default_factory=dict)


class Platform(StrictModel):
    name: str = ""
    handle: str = ""
    stat: str = ""


class RoleFit(StrictModel):
    role: str = ""
    score: int = Field(default=0, ge=0, le=100)
    verdict: str = ""


class RecruiterInsights(StrictModel):
    roleFits: list[RoleFit] = Field(default_factory=list)
    interviewQuestions: list[str] = Field(default_factory=list)


class CodingActivity(StrictModel):
    month: str = ""
    commits: int = Field(default=0, ge=0)


class ResumeProfile(StrictModel):
    candidate: Candidate = Field(default_factory=Candidate)
    analysis: Analysis = Field(default_factory=Analysis)
    skills: list[Skill] = Field(default_factory=list)
    radarSkills: list[RadarSkill] = Field(default_factory=list)
    timeline: list[TimelineItem] = Field(default_factory=list)
    projects: list[Project] = Field(default_factory=list)
    platforms: list[Platform] = Field(default_factory=list)
    recruiterInsights: RecruiterInsights = Field(default_factory=RecruiterInsights)
    codingActivity: list[CodingActivity] = Field(default_factory=list)


# ─── Chat ────────────────────────────────────────────────────────────────────


class ChatMessage(StrictModel):
    role: str = Field(default="user")
    content: str = ""


class ChatRequest(StrictModel):
    profile: dict[str, Any] = Field(default_factory=dict)
    extracted_text: str = ""
    messages: list[ChatMessage] = Field(default_factory=list)
    question: str = Field(min_length=1, max_length=4000)
    provider: Optional[str] = None
    model: Optional[str] = None


class ChatResponse(StrictModel):
    answer: str = ""
    suggestions: list[str] = Field(default_factory=list)
    provider: Optional[str] = None
    model: Optional[str] = None


# ─── Job description matching ────────────────────────────────────────────────


class JobMatchRequest(StrictModel):
    profile: dict[str, Any] = Field(default_factory=dict)
    job_description: str = Field(min_length=20, max_length=20000)
    provider: Optional[str] = None
    model: Optional[str] = None


class JobMatchResponse(StrictModel):
    score: int = Field(default=0, ge=0, le=100)
    matchedKeywords: list[str] = Field(default_factory=list)
    missingKeywords: list[str] = Field(default_factory=list)
    strengths: list[str] = Field(default_factory=list)
    gaps: list[str] = Field(default_factory=list)
    suggestions: list[str] = Field(default_factory=list)
    verdict: str = ""
    provider: Optional[str] = None
    model: Optional[str] = None
