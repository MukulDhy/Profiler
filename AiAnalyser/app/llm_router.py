"""Provider-agnostic LLM factory with an ordered fallback chain."""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path
from typing import Any

import yaml
from langchain_core.language_models.chat_models import BaseChatModel

from config.settings import get_settings

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class ProviderConfig:
    name: str
    type: str
    model: str
    api_key_env: str
    base_url: str | None = None
    timeout_s: int = 120
    temperature: float = 0.1
    structured_method: str = "json_schema"
    max_tokens: int | None = None
    headers: dict[str, str] = field(default_factory=dict)

    @property
    def api_key(self) -> str:
        return os.environ.get(self.api_key_env, "").strip()

    @property
    def is_configured(self) -> bool:
        return bool(self.api_key)


class LLMRouter:
    """Loads ``models.yaml`` and builds chat models on demand."""

    def __init__(self, config_path: str | Path | None = None) -> None:
        path = Path(config_path or get_settings().models_config)
        if not path.exists():
            raise FileNotFoundError(f"LLM routing config not found: {path}")

        with path.open("r", encoding="utf-8") as handle:
            raw = yaml.safe_load(handle) or {}

        routing = raw.get("routing") or {}
        self.primary: str = routing.get("primary", "")
        self.fallback: list[str] = list(routing.get("fallback") or [])

        self.providers: dict[str, ProviderConfig] = {}
        for name, entry in (raw.get("providers") or {}).items():
            self.providers[name] = ProviderConfig(
                name=name,
                type=entry.get("type", "openai"),
                model=entry.get("model", ""),
                api_key_env=entry.get("api_key_env", f"{name.upper()}_API_KEY"),
                base_url=entry.get("base_url"),
                timeout_s=int(entry.get("timeout_s", 120)),
                temperature=float(entry.get("temperature", 0.1)),
                structured_method=entry.get("structured_method", "json_schema"),
                max_tokens=(
                    int(entry["max_tokens"]) if entry.get("max_tokens") else None
                ),
                headers=dict(entry.get("headers") or {}),
            )

    # ── introspection ──────────────────────────────────────────────────────
    @property
    def configured_names(self) -> list[str]:
        return [name for name, cfg in self.providers.items() if cfg.is_configured]

    def public_info(self) -> dict[str, Any]:
        return {
            "primary": self.primary,
            "fallback": self.fallback,
            "providers": [
                {
                    "name": name,
                    "type": cfg.type,
                    "model": cfg.model,
                    "configured": cfg.is_configured,
                    "api_key_env": cfg.api_key_env,
                }
                for name, cfg in self.providers.items()
            ],
        }

    def order(self, preferred: str | None = None) -> list[ProviderConfig]:
        """Return configured providers in routing order."""
        names: list[str] = []

        for candidate in [self.primary, *self.fallback, *self.providers.keys()]:
            if candidate and candidate not in names:
                names.append(candidate)

        if preferred and preferred in names:
            names.remove(preferred)
            names.insert(0, preferred)

        ordered = [
            self.providers[name]
            for name in names
            if name in self.providers and self.providers[name].is_configured
        ]
        if not ordered:
            logger.warning("No LLM provider is configured (no API key found in env)")
        return ordered

    # ── construction ───────────────────────────────────────────────────────
    def build(
        self,
        cfg: ProviderConfig,
        model: str | None = None,
        temperature: float | None = None,
    ) -> BaseChatModel:
        settings = get_settings()
        model_name = model or cfg.model
        temp = cfg.temperature if temperature is None else temperature

        if cfg.type == "google_genai":
            from langchain_google_genai import ChatGoogleGenerativeAI

            kwargs: dict[str, Any] = {
                "model": model_name,
                "google_api_key": cfg.api_key,
                "temperature": temp,
                "timeout": cfg.timeout_s,
                "max_retries": settings.llm_max_retries,
            }
            if cfg.max_tokens:
                kwargs["max_output_tokens"] = cfg.max_tokens
            return ChatGoogleGenerativeAI(**kwargs)

        from langchain_openai import ChatOpenAI

        kwargs = {
            "model": model_name,
            "api_key": cfg.api_key,
            "temperature": temp,
            "request_timeout": cfg.timeout_s,
            "max_retries": settings.llm_max_retries,
        }
        if cfg.max_tokens:
            kwargs["max_tokens"] = cfg.max_tokens
        if cfg.base_url:
            kwargs["base_url"] = cfg.base_url
        if cfg.headers:
            kwargs["default_headers"] = cfg.headers

        return ChatOpenAI(**kwargs)


@lru_cache(maxsize=1)
def get_router() -> LLMRouter:
    return LLMRouter()
