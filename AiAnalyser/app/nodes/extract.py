"""Node 1 — document extraction via Docling."""

from __future__ import annotations

import logging
import threading
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

_SUPPORTED_SUFFIXES = {".pdf", ".docx"}
_converter = None
_converter_lock = threading.Lock()


def _get_converter():
    """Lazily build the Docling converter (model load is expensive)."""
    global _converter
    if _converter is None:
        from docling.document_converter import DocumentConverter

        logger.info("Initialising Docling DocumentConverter")
        _converter = DocumentConverter()
    return _converter


def convert_document(file_path: str | Path):
    """Convert a supported document and return the Docling result object."""
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"Document not found: {path}")

    suffix = path.suffix.lower()
    if suffix not in _SUPPORTED_SUFFIXES:
        raise ValueError(
            f"Unsupported document format '{suffix}'. Supported formats: PDF, DOCX."
        )

    # Docling's converter is not guaranteed to be thread-safe.
    with _converter_lock:
        return _get_converter().convert(str(path))


def extract_markdown(file_path: str | Path) -> str:
    result = convert_document(file_path)
    markdown = result.document.export_to_markdown()

    if not markdown or not markdown.strip():
        raise ValueError(
            "No text could be extracted from the document. It may be scanned or empty."
        )

    return markdown


def extract_node(state: dict[str, Any]) -> dict[str, Any]:
    # Text may already be provided (re-analysis path) — skip Docling entirely.
    if state.get("markdown"):
        logger.info("Using %s characters of pre-extracted text", len(state["markdown"]))
        return {}

    markdown = extract_markdown(state["file_path"])
    logger.info("Extracted %s characters from %s", len(markdown), state.get("file_name"))
    return {"markdown": markdown}
