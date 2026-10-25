"""Node 3 — structured extraction through the routed LLM."""

from __future__ import annotations

import logging
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage

from app.llm_router import LLMRouter, ProviderConfig, get_router
from app.prompts import SYSTEM_PROMPT, build_structure_prompt
from app.schemas import ResumeProfile

logger = logging.getLogger(__name__)


def _invoke_provider(
    router: LLMRouter,
    cfg: ProviderConfig,
    markdown: str,
    errors: list[str],
    model_override: str | None,
) -> dict[str, Any]:
    llm = router.build(cfg, model=model_override)
    messages = [
        SystemMessage(content=SYSTEM_PROMPT),
        HumanMessage(content=build_structure_prompt(markdown, errors)),
    ]

    try:
        structured = llm.with_structured_output(
            ResumeProfile, method=cfg.structured_method
        )
    except (TypeError, ValueError):
        # Some provider/model combinations reject the requested method.
        structured = llm.with_structured_output(ResumeProfile)

    result = structured.invoke(messages)
    if result is None:
        raise ValueError("The model returned an empty structured response.")

    if isinstance(result, ResumeProfile):
        return result.model_dump()
    if isinstance(result, dict):
        return result

    raise ValueError(f"Unexpected structured response type: {type(result)!r}")


def make_structure_node(router: LLMRouter | None = None):
    active_router = router or get_router()

    def structure_node(state: dict[str, Any]) -> dict[str, Any]:
        markdown = state.get("cleaned", "")
        errors = list(state.get("errors") or [])
        trail = list(state.get("provider_trail") or [])
        attempt = int(state.get("attempts") or 0)

        ordered = active_router.order(state.get("preferred_provider"))
        if not ordered:
            return {
                "raw_profile": None,
                "llm_error": (
                    "No LLM provider is configured. Add OPENROUTER_API_KEY, "
                    "GOOGLE_API_KEY or OPENAI_API_KEY to AiAnalyser/.env."
                ),
                "provider_trail": trail,
            }

        # Rotate providers between repair attempts.
        start = attempt % len(ordered)
        ordered = ordered[start:] + ordered[:start]

        last_error = "Unknown LLM error"
        for cfg in ordered:
            logger.info("Calling provider=%s model=%s", cfg.name, cfg.model)
            try:
                raw = _invoke_provider(
                    active_router,
                    cfg,
                    markdown,
                    errors,
                    state.get("model_override"),
                )
                trail.append(
                    {
                        "provider": cfg.name,
                        "model": cfg.model,
                        "status": "ok",
                    }
                )
                return {
                    "raw_profile": raw,
                    "provider": cfg.name,
                    "model": cfg.model,
                    "provider_trail": trail,
                    "llm_error": None,
                }
            except Exception as exc:  # noqa: BLE001 - fall through the chain
                last_error = f"{cfg.name}: {exc}"
                logger.warning("Provider %s failed: %s", cfg.name, exc)
                trail.append(
                    {
                        "provider": cfg.name,
                        "model": cfg.model,
                        "status": "error",
                        "error": str(exc)[:400],
                    }
                )

        return {
            "raw_profile": None,
            "llm_error": last_error,
            "provider_trail": trail,
        }

    return structure_node
