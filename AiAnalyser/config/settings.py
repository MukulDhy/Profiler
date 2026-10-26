"""Environment-backed settings for the AI Analyser service."""

from __future__ import annotations

import sys
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent

# PyInstaller builds unpack bundled data (models.yaml etc.) into `_MEIPASS`,
# while writable state (temp files, .env) belongs next to the executable.
_FROZEN = bool(getattr(sys, "frozen", False))
BUNDLE_DIR = Path(getattr(sys, "_MEIPASS", BASE_DIR))
APP_DIR = Path(sys.executable).resolve().parent if _FROZEN else BASE_DIR

ENV_FILE = APP_DIR / ".env"

# pydantic-settings parses .env into the Settings object, but provider keys are
# resolved through os.environ by the LLM router. Load the file into the process
# environment so keys declared only in .env are visible everywhere.
# `override=False` keeps real environment variables (CI / production) winning.
load_dotenv(ENV_FILE, override=False)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(ENV_FILE),
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # Service
    app_name: str = "ProfileGPT AI Analyser"
    host: str = "0.0.0.0"
    port: int = 8000
    service_token: str = ""  # optional shared secret, sent as X-Service-Token

    # Limits
    max_file_mb: int = 5
    max_input_chars: int = 40_000
    max_repair_attempts: int = 2
    temp_dir: str = str(APP_DIR / "tmp")

    # LLM defaults (provider keys are read from the env vars named in models.yaml)
    llm_temperature: float = 0.1
    llm_max_retries: int = 1

    # Routing table (bundled alongside the executable when frozen)
    models_config: str = str(BUNDLE_DIR / "config" / "models.yaml")

    @property
    def max_file_bytes(self) -> int:
        return self.max_file_mb * 1024 * 1024


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    settings = Settings()
    Path(settings.temp_dir).mkdir(parents=True, exist_ok=True)
    return settings
