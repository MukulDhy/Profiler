"""Grounded chat over a candidate's analysed profile.

The backend sends the full structured profile plus the text extracted from the
resume. There is intentionally no vector store / retrieval step: resumes are
small enough that the complete context fits comfortably in the prompt, and
full context avoids the failure mode where a retriever silently drops the one
project a recruiter is asking about.
"""

from __future__ import annotations

import json
import logging
from typing import Any

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage

from app.llm_router import LLMRouter, ProviderConfig, get_router
from app.prompts import CHAT_SYSTEM_PROMPT, build_chat_prompt
from app.schemas import ChatMessage, ChatRequest, ChatResponse

logger = logging.getLogger(__name__)

MAX_HISTORY_MESSAGES = 14
MAX_EXTRACTED_CHARS = 24_000


def _profile_json(profile: dict[str, Any]) -> str:
    try:
        return json.dumps(profile or {}, ensure_ascii=False)
    except (TypeError, ValueError):
        return "{}"


def _history(payload: ChatRequest) -> list[ChatMessage]:
    messages = [
        message
        for message in payload.messages
        if message.content and message.role in {"user", "assistant"}
    ]
    return messages[-MAX_HISTORY_MESSAGES:]


def _invoke(
    router: LLMRouter,
    cfg: ProviderConfig,
    payload: ChatRequest,
    errors: list[str],
) -> ChatResponse:
    llm = router.build(cfg, model=payload.model)
    messages: list[Any] = [SystemMessage(content=CHAT_SYSTEM_PROMPT)]

    for message in _history(payload):
        if message.role == "assistant":
            messages.append(AIMessage(content=message.content))
        else:
            messages.append(HumanMessage(content=message.content))

    messages.append(
        HumanMessage(
            content=build_chat_prompt(
                profile_json=_profile_json(payload.profile),
                extracted_text=(payload.extracted_text or "")[:MAX_EXTRACTED_CHARS],
                question=payload.question,
            )
        )
    )

    try:
        response = llm.invoke(messages)
        answer = getattr(response, "content", "")
        if isinstance(answer, list):
            # Some providers return content blocks instead of a string.
            answer = "\n".join(
                str(block.get("text", block)) if isinstance(block, dict) else str(block)
                for block in answer
            )
        answer = str(answer).strip()
        if not answer:
            raise ValueError("The provider returned an empty answer.")
        return ChatResponse(
            answer=answer,
            suggestions=_suggestions(payload.profile, payload.question),
            provider=cfg.name,
            model=payload.model or cfg.model,
        )
    except Exception as exc:  # noqa: BLE001 - provider fallback is intentional
        errors.append(f"{cfg.name}: {exc}")
        logger.warning("Chat provider %s failed: %s", cfg.name, exc)
        raise


def _fallback_answer(payload: ChatRequest) -> ChatResponse:
    """Deterministic answer used when no LLM provider is configured/reachable.

    It only states facts present in the structured profile, so it can never
    hallucinate. It is deliberately narrow: for anything it cannot answer it
    says the AI provider is unavailable.
    """
    profile = payload.profile or {}
    candidate = profile.get("candidate") or {}
    analysis = profile.get("analysis") or {}
    skills = [s.get("name", "") for s in profile.get("skills") or [] if s.get("name")]
    projects = profile.get("projects") or []
    timeline = profile.get("timeline") or []

    question = payload.question.lower()
    name = candidate.get("name") or "The candidate"
    lines: list[str] = []

    if any(word in question for word in ("skill", "stack", "technolog", "tech")):
        if skills:
            lines.append(f"{name}'s strongest skills include {', '.join(skills[:12])}.")
        else:
            lines.append("No skills were extracted from this resume.")

    if any(word in question for word in ("project", "built", "work on")):
        if projects:
            for project in projects[:4]:
                tech = ", ".join(project.get("tech") or [])
                lines.append(
                    f"- {project.get('name') or 'Project'}: "
                    f"{project.get('tagline') or project.get('summary') or 'No summary.'}"
                    + (f" (Tech: {tech})" if tech else "")
                )
        else:
            lines.append("No projects were extracted from this resume.")

    if any(word in question for word in ("experience", "year", "senior", "background")):
        years = candidate.get("experienceYears")
        if years is not None:
            lines.append(f"{name} has approximately {years} years of experience.")
        for item in timeline[:4]:
            lines.append(
                f"- {item.get('role') or 'Role'} at {item.get('org') or 'Organization'} "
                f"({item.get('year') or 'dates not listed'})."
            )

    if any(word in question for word in ("fit", "hire", "role", "recruit", "ats")):
        score = analysis.get("atsScore")
        impression = analysis.get("recruiterImpression")
        if score is not None:
            lines.append(f"ATS score: {score}/100.")
        if impression:
            lines.append(impression)
        fits = (profile.get("recruiterInsights") or {}).get("roleFits") or []
        for fit in fits[:3]:
            lines.append(
                f"- {fit.get('role')}: {fit.get('score')}% ({fit.get('verdict')})."
            )

    if not lines:
        lines.append(
            "The AI provider is not configured right now, so I can only answer "
            "basic questions from the structured profile. Try asking about "
            "skills, projects, experience, or role fit."
        )
        summary = candidate.get("summary")
        if summary:
            lines.append(summary)

    return ChatResponse(
        answer="\n".join(lines),
        suggestions=_suggestions(payload.profile, payload.question),
        provider="fallback",
        model="profile-summary",
    )


def _suggestions(profile: dict[str, Any], question: str) -> list[str]:
    candidate = (profile or {}).get("candidate") or {}
    name = candidate.get("name") or "the candidate"
    projects = (profile or {}).get("projects") or []
    first_project = projects[0].get("name") if projects else None

    suggestions = [
        f"Summarise {name}'s experience in 3 bullets",
        "What are their strongest technical skills?",
        "Which role are they the best fit for?",
    ]
    if first_project:
        suggestions.insert(1, f"Walk me through the {first_project} project")
    return suggestions


def answer_chat(payload: ChatRequest) -> ChatResponse:
    router = get_router()
    errors: list[str] = []

    for cfg in router.order(payload.provider):
        try:
            return _invoke(router, cfg, payload, errors)
        except Exception:  # noqa: BLE001 - try the next provider
            continue

    if errors:
        logger.warning("All chat providers failed: %s", " | ".join(errors))

    return _fallback_answer(payload)
