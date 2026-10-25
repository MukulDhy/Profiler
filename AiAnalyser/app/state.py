"""Typed state passed between LangGraph nodes."""

from __future__ import annotations

from typing import Any, TypedDict


class AnalysisState(TypedDict, total=False):
    # input
    file_path: str
    file_name: str
    preferred_provider: str | None
    model_override: str | None

    # extraction
    markdown: str
    cleaned: str

    # generation
    raw_profile: dict[str, Any] | None
    profile: dict[str, Any] | None
    provider: str | None
    model: str | None
    provider_trail: list[dict[str, Any]]

    # validation
    errors: list[str]
    warnings: list[str]
    attempts: int
    max_repairs: int
    llm_error: str | None
