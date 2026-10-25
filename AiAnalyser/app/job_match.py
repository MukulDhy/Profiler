"""Job-description matching for a structured candidate profile."""

from __future__ import annotations

import json
import logging
import re
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage

from app.llm_router import LLMRouter, ProviderConfig, get_router
from app.prompts import JOB_MATCH_SYSTEM_PROMPT, build_job_match_prompt
from app.schemas import JobMatchRequest, JobMatchResponse

logger = logging.getLogger(__name__)

STOP_WORDS = {
    "and",
    "the",
    "for",
    "with",
    "you",
    "your",
    "our",
    "are",
    "will",
    "have",
    "has",
    "this",
    "that",
    "from",
    "into",
    "about",
    "their",
    "they",
    "who",
    "what",
    "when",
    "where",
    "which",
    "role",
    "work",
    "team",
    "teams",
    "years",
    "year",
    "experience",
    "strong",
    "ability",
    "skills",
    "knowledge",
    "using",
    "build",
    "building",
    "develop",
    "developing",
    "design",
    "designing",
    "plus",
    "preferred",
    "required",
    "requirements",
    "responsibilities",
    "candidate",
    "candidates",
    "job",
    "position",
    "company",
    "including",
    "etc",
}


def _profile_json(profile: dict[str, Any]) -> str:
    try:
        return json.dumps(profile or {}, ensure_ascii=False)
    except (TypeError, ValueError):
        return "{}"


def _invoke(
    router: LLMRouter,
    cfg: ProviderConfig,
    payload: JobMatchRequest,
    errors: list[str],
) -> JobMatchResponse:
    llm = router.build(cfg, model=payload.model, temperature=0.1)
    messages = [
        SystemMessage(content=JOB_MATCH_SYSTEM_PROMPT),
        HumanMessage(
            content=build_job_match_prompt(
                profile_json=_profile_json(payload.profile),
                job_description=payload.job_description,
            )
        ),
    ]

    try:
        structured = llm.with_structured_output(
            JobMatchResponse, method=cfg.structured_method
        )
    except (TypeError, ValueError):
        structured = llm.with_structured_output(JobMatchResponse)

    result = structured.invoke(messages)
    if isinstance(result, dict):
        result = JobMatchResponse(**result)

    result.provider = cfg.name
    result.model = payload.model or cfg.model
    return result


def _keywords(text: str) -> set[str]:
    tokens = re.findall(r"[a-zA-Z][a-zA-Z0-9+#.\-]{1,30}", text.lower())
    return {
        token.strip(".-")
        for token in tokens
        if len(token) > 2 and token not in STOP_WORDS
    }


def _candidate_terms(profile: dict[str, Any]) -> set[str]:
    terms: set[str] = set()

    for skill in profile.get("skills") or []:
        if skill.get("name"):
            terms.add(str(skill["name"]).lower())

    for project in profile.get("projects") or []:
        for tech in project.get("tech") or []:
            terms.add(str(tech).lower())
        if project.get("name"):
            terms.add(str(project["name"]).lower())

    for item in profile.get("timeline") or []:
        for key in ("role", "org", "blurb"):
            if item.get(key):
                terms.update(_keywords(str(item[key])))

    analysis = profile.get("analysis") or {}
    for key in ("strengths", "suggestions"):
        for line in analysis.get(key) or []:
            terms.update(_keywords(str(line)))

    candidate = profile.get("candidate") or {}
    if candidate.get("summary"):
        terms.update(_keywords(str(candidate["summary"])))

    return terms


def _fallback_match(payload: JobMatchRequest) -> JobMatchResponse:
    profile = payload.profile or {}
    jd_terms = _keywords(payload.job_description)
    candidate_terms = _candidate_terms(profile)
    skills = [
        str(skill.get("name"))
        for skill in profile.get("skills") or []
        if skill.get("name")
    ]

    matched = sorted(term for term in jd_terms if term in candidate_terms)
    missing = sorted(term for term in jd_terms if term not in candidate_terms)

    # Reward direct skill hits more than incidental keyword overlap.
    direct_hits = [
        skill for skill in skills if skill.lower() in payload.job_description.lower()
    ]
    coverage = len(matched) / len(jd_terms) if jd_terms else 0.0
    score = int(round(min(100, coverage * 70 + (len(direct_hits) / max(1, len(skills))) * 30)))

    candidate = profile.get("candidate") or {}
    name = candidate.get("name") or "The candidate"
    years = candidate.get("experienceYears") or 0

    strengths: list[str] = []
    if direct_hits:
        strengths.append(
            f"Direct overlap with {', '.join(direct_hits[:8])} from the job description."
        )
    if years:
        strengths.append(f"{years} years of relevant experience.")
    if not strengths:
        strengths.append("Some transferable keywords overlap with the role.")

    gaps = [
        f"No explicit evidence of {term}." for term in missing[:6]
    ] or ["No obvious keyword gaps detected."]

    suggestions = [
        "Add measurable outcomes for the most relevant projects.",
        "Mirror the job description's core technologies in the resume's skills section.",
        "Call out production ownership and scale where possible.",
    ]

    verdict = (
        "Strong match"
        if score >= 80
        else "Good match"
        if score >= 65
        else "Partial match"
        if score >= 45
        else "Weak match"
    )

    return JobMatchResponse(
        score=score,
        matchedKeywords=matched[:25],
        missingKeywords=missing[:25],
        strengths=strengths,
        gaps=gaps,
        suggestions=suggestions,
        verdict=f"{verdict} for {name}.",
        provider="fallback",
        model="keyword-overlap",
    )


def match_job(payload: JobMatchRequest) -> JobMatchResponse:
    router = get_router()
    errors: list[str] = []

    for cfg in router.order(payload.provider):
        try:
            return _invoke(router, cfg, payload, errors)
        except Exception as exc:  # noqa: BLE001 - try the next provider
            errors.append(f"{cfg.name}: {exc}")
            logger.warning("Job-match provider %s failed: %s", cfg.name, exc)

    if errors:
        logger.warning("All job-match providers failed: %s", " | ".join(errors))

    return _fallback_match(payload)
