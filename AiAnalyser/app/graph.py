"""LangGraph pipeline: extract → clean → structure → validate → (repair) → finalize."""

from __future__ import annotations

import logging
import time
from functools import lru_cache
from typing import Any

from langgraph.graph import END, START, StateGraph

from app.nodes.clean import clean_node
from app.nodes.extract import extract_node
from app.nodes.finalize import finalize_node
from app.nodes.repair import repair_node
from app.nodes.structure import make_structure_node
from app.nodes.validate import validate_node
from app.state import AnalysisState
from config.settings import get_settings

logger = logging.getLogger(__name__)

# Retrying cannot fix these: the provider rejected the credentials, has no
# credit, or the model does not exist. Fail fast instead of burning repair
# attempts (and, on metered providers, more tokens).
_NON_RETRYABLE_MARKERS = (
    "No LLM provider is configured",
    "Error code: 401",
    "Error code: 402",
    "Error code: 403",
    "Error code: 404",
)


def _route_after_validation(state: AnalysisState) -> str:
    if state.get("profile"):
        return "finalize"

    llm_error = str(state.get("llm_error") or "")
    if any(marker in llm_error for marker in _NON_RETRYABLE_MARKERS):
        return "failed"

    if int(state.get("attempts") or 0) >= int(state.get("max_repairs") or 0):
        return "failed"

    return "repair"


@lru_cache(maxsize=1)
def build_graph():
    graph = StateGraph(AnalysisState)

    graph.add_node("extract", extract_node)
    graph.add_node("clean", clean_node)
    graph.add_node("structure", make_structure_node())
    graph.add_node("validate", validate_node)
    graph.add_node("repair", repair_node)
    graph.add_node("finalize", finalize_node)

    graph.add_edge(START, "extract")
    graph.add_edge("extract", "clean")
    graph.add_edge("clean", "structure")
    graph.add_edge("structure", "validate")
    graph.add_edge("repair", "structure")
    graph.add_edge("finalize", END)

    graph.add_conditional_edges(
        "validate",
        _route_after_validation,
        {
            "finalize": "finalize",
            "repair": "repair",
            "failed": END,
        },
    )

    return graph.compile()


def run_analysis(
    *,
    file_path: str | None = None,
    text: str | None = None,
    file_name: str = "resume",
    preferred_provider: str | None = None,
    model_override: str | None = None,
) -> dict[str, Any]:
    """Execute the graph and return the final state plus timing metadata.

    Supply either ``file_path`` (Docling extraction) or ``text`` (already
    extracted Markdown, used by the re-analysis endpoint).
    """
    settings = get_settings()
    compiled = build_graph()

    initial_state: AnalysisState = {
        "file_name": file_name,
        "preferred_provider": preferred_provider,
        "model_override": model_override,
        "provider_trail": [],
        "warnings": [],
        "errors": [],
        "attempts": 0,
        "max_repairs": settings.max_repair_attempts,
    }

    if file_path:
        initial_state["file_path"] = file_path
    if text:
        initial_state["markdown"] = text

    started = time.perf_counter()
    final_state = compiled.invoke(initial_state, config={"recursion_limit": 25})
    duration_ms = int((time.perf_counter() - started) * 1000)

    final_state["durationMs"] = duration_ms
    logger.info(
        "Analysis finished in %sms (provider=%s attempts=%s)",
        duration_ms,
        final_state.get("provider"),
        final_state.get("attempts"),
    )
    return final_state
