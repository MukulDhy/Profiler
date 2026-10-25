"""Node 5 — prepare a corrective re-prompt."""

from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)


def repair_node(state: dict[str, Any]) -> dict[str, Any]:
    attempts = int(state.get("attempts") or 0) + 1
    errors = list(state.get("errors") or [])

    logger.info("Repair attempt %s with %s error(s)", attempts, len(errors))

    # `structure` reads `errors` from state; clearing raw_profile guarantees the
    # next pass cannot be mistaken for a success.
    return {
        "attempts": attempts,
        "raw_profile": None,
        "llm_error": None,
        "errors": errors,
    }
