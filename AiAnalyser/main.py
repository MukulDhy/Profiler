"""Entry point for the ProfileGPT AI Analyser service.

Run with:
    uv run python main.py
    # or
    uv run uvicorn app.api:app --host 0.0.0.0 --port 8000
"""

from __future__ import annotations

import uvicorn

from app.api import app
from config.settings import get_settings


def main() -> None:
    settings = get_settings()
    uvicorn.run(app, host=settings.host, port=settings.port, log_level="info")


if __name__ == "__main__":
    main()
