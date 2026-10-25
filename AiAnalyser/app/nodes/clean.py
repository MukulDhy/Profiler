"""Node 2 — deterministic cleanup before spending tokens."""

from __future__ import annotations

import re
from typing import Any

from config.settings import get_settings

_HTML_COMMENT = re.compile(r"<!--.*?-->", re.DOTALL)


def clean_markdown(markdown: str, max_chars: int) -> tuple[str, bool]:
    text = markdown.replace("\x00", " ")
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = _HTML_COMMENT.sub("", text)
    text = re.sub(r"[ \t]+\n", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"[ \t]{2,}", " ", text)
    text = text.strip()

    truncated = len(text) > max_chars
    if truncated:
        text = text[:max_chars].rstrip()
        text += "\n\n[... document truncated for analysis ...]"

    return text, truncated


def clean_node(state: dict[str, Any]) -> dict[str, Any]:
    cleaned, truncated = clean_markdown(
        state.get("markdown", ""),
        get_settings().max_input_chars,
    )

    warnings = list(state.get("warnings") or [])
    if truncated:
        warnings.append(
            "Document was longer than the configured limit and was truncated "
            "before analysis."
        )

    return {"cleaned": cleaned, "warnings": warnings}
