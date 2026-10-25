"""Node 6 — deterministic normalisation + derived dashboard fields."""

from __future__ import annotations

import re
from datetime import datetime
from typing import Any, Iterable

GROUP_ORDER = [
    "Frontend",
    "Backend",
    "Cloud",
    "AI/ML",
    "Systems",
    "Data",
    "DevOps",
    "Mobile",
    "Leadership",
    "Other",
]

_YEAR = re.compile(r"(19|20)\d{2}")


def _text(value: Any) -> str:
    return str(value).strip() if value is not None else ""


def _dedupe(values: Iterable[Any], limit: int | None = None) -> list[str]:
    seen: set[str] = set()
    output: list[str] = []
    for value in values:
        text = _text(value)
        if not text:
            continue
        key = text.lower()
        if key in seen:
            continue
        seen.add(key)
        output.append(text)
        if limit and len(output) >= limit:
            break
    return output


def _clamp(value: Any, low: int = 0, high: int = 100) -> int:
    try:
        number = int(round(float(value)))
    except (TypeError, ValueError):
        return low
    return max(low, min(high, number))


def _initials(name: str) -> str:
    parts = [part for part in re.split(r"\s+", name) if part]
    if not parts:
        return "??"
    if len(parts) == 1:
        return parts[0][:2].upper()
    return (parts[0][0] + parts[-1][0]).upper()


def _derive_experience(timeline: list[dict[str, Any]]) -> float:
    years: list[int] = []
    current_year = datetime.now().year
    for item in timeline:
        for match in _YEAR.finditer(_text(item.get("year"))):
            value = int(match.group(0))
            if 1950 <= value <= current_year:
                years.append(value)
    if not years:
        return 0
    return float(max(0, current_year - min(years)))


def _derive_radar(skills: list[dict[str, Any]]) -> list[dict[str, Any]]:
    buckets: dict[str, list[int]] = {}
    for skill in skills:
        group = _text(skill.get("group")) or "Other"
        buckets.setdefault(group, []).append(int(skill.get("level") or 0))

    def sort_key(item: tuple[str, list[int]]) -> tuple[int, float]:
        group, levels = item
        index = GROUP_ORDER.index(group) if group in GROUP_ORDER else len(GROUP_ORDER)
        return (index, -sum(levels) / len(levels))

    radar = [
        {"axis": group, "value": _clamp(round(sum(levels) / len(levels)))}
        for group, levels in sorted(buckets.items(), key=sort_key)
    ]
    return radar[:6]


def _normalise_skills(raw_skills: list[dict[str, Any]]) -> list[dict[str, Any]]:
    skills: list[dict[str, Any]] = []
    seen: set[str] = set()

    for item in raw_skills:
        name = _text(item.get("name"))
        if not name:
            continue
        key = name.lower()
        if key in seen:
            continue
        seen.add(key)

        group = _text(item.get("group")) or "Other"
        if group not in GROUP_ORDER:
            group = "Other"

        skills.append(
            {
                "name": name,
                "level": _clamp(item.get("level")),
                "group": group,
            }
        )

    skills.sort(key=lambda skill: (-skill["level"], skill["name"].lower()))
    return skills


def _normalise_timeline(raw: list[dict[str, Any]]) -> list[dict[str, Any]]:
    timeline: list[dict[str, Any]] = []
    for item in raw:
        role = _text(item.get("role"))
        org = _text(item.get("org"))
        if not role and not org:
            continue
        timeline.append(
            {
                "year": _text(item.get("year")),
                "role": role or "Engineer",
                "org": org or "Company",
                "blurb": _text(item.get("blurb")),
            }
        )
    return timeline


def _normalise_projects(raw: list[dict[str, Any]]) -> list[dict[str, Any]]:
    projects: list[dict[str, Any]] = []
    for index, item in enumerate(raw[:6], start=1):
        name = _text(item.get("name"))
        if not name:
            continue

        metrics_raw = item.get("metrics") or {}
        metrics = {
            _text(key): _text(value)
            for key, value in metrics_raw.items()
            if _text(key) and _text(value)
        }

        links_raw = item.get("links") or {}
        links = {
            _text(key): _text(value)
            for key, value in links_raw.items()
            if _text(key) and _text(value)
        }

        projects.append(
            {
                "id": _text(item.get("id")) or f"p{index}",
                "name": name,
                "tagline": _text(item.get("tagline")),
                "tech": _dedupe(item.get("tech") or [], limit=12),
                "metrics": metrics,
                "summary": _text(item.get("summary")),
                "links": links,
            }
        )
    return projects


def _platforms_from_links(links: dict[str, Any]) -> list[dict[str, Any]]:
    platforms: list[dict[str, Any]] = []
    labels = {
        "github": "GitHub",
        "linkedin": "LinkedIn",
        "leetcode": "LeetCode",
        "portfolio": "Portfolio",
    }
    for key, label in labels.items():
        value = _text(links.get(key))
        if not value:
            continue
        handle = value.rstrip("/").split("/")[-1] if value.startswith("http") else value
        platforms.append(
            {
                "name": label,
                "handle": handle,
                "stat": "Public profile",
            }
        )
    return platforms


def _normalise_platforms(raw: list[dict[str, Any]]) -> list[dict[str, Any]]:
    platforms: list[dict[str, Any]] = []
    seen: set[str] = set()
    for item in raw:
        name = _text(item.get("name"))
        if not name or name.lower() in seen:
            continue
        seen.add(name.lower())
        platforms.append(
            {
                "name": name,
                "handle": _text(item.get("handle")),
                "stat": _text(item.get("stat")),
            }
        )
    return platforms


def _normalise_role_fits(raw: list[dict[str, Any]]) -> list[dict[str, Any]]:
    fits: list[dict[str, Any]] = []
    for item in raw[:5]:
        role = _text(item.get("role"))
        if not role:
            continue
        fits.append(
            {
                "role": role,
                "score": _clamp(item.get("score")),
                "verdict": _text(item.get("verdict")) or "Evaluate",
            }
        )
    return fits


def finalize_node(state: dict[str, Any]) -> dict[str, Any]:
    profile = dict(state.get("profile") or {})
    warnings = list(state.get("warnings") or [])

    candidate = dict(profile.get("candidate") or {})
    analysis = dict(profile.get("analysis") or {})
    insights = dict(profile.get("recruiterInsights") or {})

    name = _text(candidate.get("name")) or "Unknown Candidate"
    candidate["name"] = name
    candidate["title"] = _text(candidate.get("title")) or "Professional"
    candidate["initials"] = _text(candidate.get("initials")) or _initials(name)
    candidate["location"] = _text(candidate.get("location")) or None
    candidate["email"] = _text(candidate.get("email")) or None
    candidate["phone"] = _text(candidate.get("phone")) or None
    candidate["summary"] = _text(candidate.get("summary"))
    candidate["links"] = {
        key: _text(value) or None
        for key, value in (candidate.get("links") or {}).items()
        if _text(value)
    }

    timeline = _normalise_timeline(profile.get("timeline") or [])
    projects = _normalise_projects(profile.get("projects") or [])
    skills = _normalise_skills(profile.get("skills") or [])

    experience = candidate.get("experienceYears")
    try:
        experience_value = float(experience or 0)
    except (TypeError, ValueError):
        experience_value = 0
    if experience_value <= 0 or experience_value > 50:
        derived = _derive_experience(timeline)
        if derived:
            experience_value = derived
            warnings.append("Experience years were derived from the timeline.")
    candidate["experienceYears"] = round(experience_value, 1)

    # ── analysis ──────────────────────────────────────────────────────────
    keyword_match = dict(analysis.get("keywordMatch") or {})
    matched = max(0, int(keyword_match.get("matched") or 0))
    total = max(matched, int(keyword_match.get("total") or 0))
    analysis["keywordMatch"] = {"matched": matched, "total": total}
    analysis["score"] = round(float(analysis.get("score") or 0), 1)
    analysis["atsScore"] = round(float(analysis.get("atsScore") or 0), 1)
    analysis["formatting"] = _text(analysis.get("formatting")) or "Not evaluated"
    analysis["missingKeywords"] = _dedupe(analysis.get("missingKeywords") or [], limit=8)
    analysis["strengths"] = _dedupe(analysis.get("strengths") or [], limit=6)
    analysis["weaknesses"] = _dedupe(analysis.get("weaknesses") or [], limit=6)
    analysis["suggestions"] = _dedupe(analysis.get("suggestions") or [], limit=6)
    analysis["recruiterImpression"] = _text(analysis.get("recruiterImpression"))

    if not candidate["summary"]:
        candidate["summary"] = analysis["recruiterImpression"] or (
            "Profile generated from the uploaded resume."
        )

    # ── radar ─────────────────────────────────────────────────────────────
    radar = [
        {"axis": _text(item.get("axis")), "value": _clamp(item.get("value"))}
        for item in (profile.get("radarSkills") or [])
        if _text(item.get("axis"))
    ]
    if len(radar) < 3:
        radar = _derive_radar(skills)

    # ── platforms ─────────────────────────────────────────────────────────
    platforms = _normalise_platforms(profile.get("platforms") or [])
    if not platforms:
        platforms = _platforms_from_links(candidate.get("links") or {})

    # ── recruiter insights ────────────────────────────────────────────────
    insights["roleFits"] = _normalise_role_fits(insights.get("roleFits") or [])
    insights["interviewQuestions"] = _dedupe(
        insights.get("interviewQuestions") or [], limit=8
    )

    final = {
        "candidate": candidate,
        "analysis": analysis,
        "skills": skills,
        "radarSkills": radar,
        "timeline": timeline,
        "projects": projects,
        "platforms": platforms,
        "recruiterInsights": insights,
        # A resume cannot supply commit history; the dashboard renders an
        # empty state instead of invented numbers.
        "codingActivity": [],
    }

    return {"profile": final, "warnings": _dedupe(warnings)}
