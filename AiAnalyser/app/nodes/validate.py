"""Node 4 — schema + semantic validation."""

from __future__ import annotations

import logging
from typing import Any

from pydantic import ValidationError

from app.schemas import ResumeProfile

logger = logging.getLogger(__name__)


def _format_pydantic_error(error: ValidationError) -> list[str]:
    messages: list[str] = []
    for item in error.errors()[:10]:
        location = ".".join(str(part) for part in item.get("loc", ())) or "root"
        messages.append(f"{location}: {item.get('msg', 'invalid value')}")
    return messages


def validate_node(state: dict[str, Any]) -> dict[str, Any]:
    raw = state.get("raw_profile")
    warnings = list(state.get("warnings") or [])

    if not raw:
        return {
            "profile": None,
            "errors": [state.get("llm_error") or "The model returned no profile."],
            "warnings": warnings,
        }

    try:
        profile = ResumeProfile.model_validate(raw)
    except ValidationError as error:
        logger.warning("Structured output failed validation: %s", error)
        return {
            "profile": None,
            "errors": _format_pydantic_error(error),
            "warnings": warnings,
        }

    errors: list[str] = []

    if not profile.candidate.name.strip():
        errors.append("candidate.name: a candidate name is required.")
    if not profile.candidate.summary.strip():
        errors.append(
            "candidate.summary: write a 2-3 sentence summary grounded in the resume."
        )
    if len(profile.skills) < 3:
        errors.append("skills: list at least 3 distinct skills found in the resume.")
    if not profile.timeline and not profile.projects:
        errors.append(
            "timeline/projects: extract at least one role or one project from the resume."
        )
    if not profile.analysis.recruiterImpression.strip():
        errors.append("analysis.recruiterImpression: required.")
    if not profile.recruiterInsights.roleFits:
        errors.append("recruiterInsights.roleFits: provide at least 3 target roles.")

    # Non-blocking quality warnings
    if profile.analysis.atsScore <= 0:
        warnings.append("ATS score was not produced by the model.")
    if not profile.candidate.email:
        warnings.append("No email address was found in the resume.")
    links = profile.candidate.links
    has_links = any(
        [
            links.github,
            links.linkedin,
            links.leetcode,
            links.portfolio,
        ]
    )
    if not profile.platforms and not has_links:
        warnings.append("No public platform links were found in the resume.")
    if profile.analysis.keywordMatch.total < profile.analysis.keywordMatch.matched:
        warnings.append("Keyword match totals were inconsistent and were corrected.")

    if errors:
        logger.info("Validation produced %s error(s)", len(errors))
        return {"profile": None, "errors": errors, "warnings": warnings}

    return {
        "profile": profile.model_dump(),
        "errors": [],
        "warnings": warnings,
    }
