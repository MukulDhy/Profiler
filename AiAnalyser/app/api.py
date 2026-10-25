"""FastAPI surface for the ProfileGPT AI Analyser."""

from __future__ import annotations

import logging
import tempfile
from pathlib import Path
from typing import Any

import httpx
from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from app.chat import answer_chat
from app.graph import run_analysis
from app.job_match import match_job
from app.llm_router import get_router
from app.schemas import ChatRequest, JobMatchRequest
from config.settings import get_settings

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)
logger = logging.getLogger(__name__)

settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    description="Resume → dashboard-ready structured profile (Docling + LangGraph + LLM).",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

SUPPORTED_SUFFIXES = {".pdf", ".docx"}


class AnalyzeUrlRequest(BaseModel):
    file_url: str
    file_name: str | None = None
    provider: str | None = None
    model: str | None = None


class AnalyzeTextRequest(BaseModel):
    text: str = Field(min_length=50)
    file_name: str | None = None
    provider: str | None = None
    model: str | None = None


def _verify_service_token(token: str | None) -> None:
    expected = settings.service_token.strip()
    if expected and token != expected:
        raise HTTPException(status_code=401, detail="Invalid or missing service token.")


def _suffix_for(filename: str | None) -> str:
    suffix = Path(filename or "").suffix.lower()
    if suffix not in SUPPORTED_SUFFIXES:
        raise HTTPException(
            status_code=415,
            detail=(
                f"Unsupported document format '{suffix or 'unknown'}'. "
                "Only PDF and DOCX are supported."
            ),
        )
    return suffix


def _persist_temp(content: bytes, suffix: str) -> str:
    handle = tempfile.NamedTemporaryFile(
        delete=False,
        suffix=suffix,
        dir=settings.temp_dir,
    )
    handle.write(content)
    handle.close()
    return handle.name


def _cleanup(path: str) -> None:
    try:
        Path(path).unlink(missing_ok=True)
    except OSError:  # pragma: no cover - best effort
        logger.warning("Could not remove temp file %s", path)


def _meta_from_state(state: dict[str, Any]) -> dict[str, Any]:
    return {
        "provider": state.get("provider"),
        "model": state.get("model"),
        "durationMs": state.get("durationMs"),
        "attempts": state.get("attempts", 0),
        "providerTrail": state.get("provider_trail", []),
        "warnings": state.get("warnings", []),
        "errors": state.get("errors", []),
        "textChars": len(state.get("cleaned") or ""),
    }


def _failure_detail(state: dict[str, Any]) -> dict[str, Any]:
    message = (
        state.get("llm_error")
        or "; ".join(state.get("errors") or [])
        or "The document could not be analysed."
    )
    return {
        "status": "error",
        "message": message,
        "errors": state.get("errors", []),
        "meta": _meta_from_state(state),
    }


def _execute_pipeline(
    *,
    file_name: str,
    file_path: str | None = None,
    text: str | None = None,
    provider: str | None = None,
    model: str | None = None,
) -> dict[str, Any]:
    try:
        state = run_analysis(
            file_path=file_path,
            text=text,
            file_name=file_name,
            preferred_provider=provider,
            model_override=model,
        )
    except FileNotFoundError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001 - surfaced to the backend
        logger.exception("Analysis pipeline crashed")
        raise HTTPException(
            status_code=500, detail=f"Analysis pipeline failed: {exc}"
        ) from exc

    profile = state.get("profile")
    if not profile:
        raise HTTPException(status_code=422, detail=_failure_detail(state))

    return {
        "status": "success",
        "message": "Resume analysed successfully.",
        "data": {
            "profile": profile,
            "extractedText": state.get("cleaned", ""),
            "meta": _meta_from_state(state),
        },
    }


@app.get("/health")
def health() -> dict[str, Any]:
    router = get_router()
    configured = router.configured_names
    return {
        "status": "ok",
        "service": settings.app_name,
        "providersConfigured": configured,
        "ready": bool(configured),
        "limits": {
            "maxFileMb": settings.max_file_mb,
            "maxInputChars": settings.max_input_chars,
            "maxRepairAttempts": settings.max_repair_attempts,
        },
    }


@app.get("/api/v1/providers")
def providers() -> dict[str, Any]:
    return {"status": "success", "data": get_router().public_info()}


@app.post("/api/v1/analyze")
def analyze(
    file: UploadFile = File(...),
    provider: str | None = Form(default=None),
    model: str | None = Form(default=None),
    x_service_token: str | None = Header(default=None),
) -> dict[str, Any]:
    _verify_service_token(x_service_token)

    suffix = _suffix_for(file.filename)
    content = file.file.read()
    if not content:
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")
    if len(content) > settings.max_file_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"File is larger than {settings.max_file_mb} MB.",
        )

    path = _persist_temp(content, suffix)
    try:
        return _execute_pipeline(
            file_path=path,
            file_name=file.filename or f"resume{suffix}",
            provider=provider,
            model=model,
        )
    finally:
        _cleanup(path)


@app.post("/api/v1/analyze/text")
def analyze_text(
    payload: AnalyzeTextRequest,
    x_service_token: str | None = Header(default=None),
) -> dict[str, Any]:
    """Re-run the LLM analysis against text extracted earlier (no Docling)."""
    _verify_service_token(x_service_token)

    text = payload.text.strip()
    if len(text) < 50:
        raise HTTPException(
            status_code=400,
            detail="Not enough extracted text to analyse. Upload the resume again.",
        )

    return _execute_pipeline(
        text=text,
        file_name=payload.file_name or "resume.txt",
        provider=payload.provider,
        model=payload.model,
    )


@app.post("/api/v1/analyze/url")
def analyze_url(
    payload: AnalyzeUrlRequest,
    x_service_token: str | None = Header(default=None),
) -> dict[str, Any]:
    _verify_service_token(x_service_token)

    try:
        response = httpx.get(payload.file_url, timeout=60, follow_redirects=True)
        response.raise_for_status()
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=400, detail=f"Could not download the document: {exc}"
        ) from exc

    content = response.content
    if not content:
        raise HTTPException(status_code=400, detail="The downloaded file is empty.")
    if len(content) > settings.max_file_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"File is larger than {settings.max_file_mb} MB.",
        )

    file_name = payload.file_name or Path(payload.file_url).name or "resume.pdf"
    suffix = _suffix_for(file_name)
    path = _persist_temp(content, suffix)

    try:
        return _execute_pipeline(
            file_path=path,
            file_name=file_name,
            provider=payload.provider,
            model=payload.model,
        )
    finally:
        _cleanup(path)


@app.post("/api/v1/chat")
def chat(
    payload: ChatRequest,
    x_service_token: str | None = Header(default=None),
) -> dict[str, Any]:
    """Answer a recruiter question grounded in the full candidate profile."""
    _verify_service_token(x_service_token)

    question = payload.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Question is required.")

    try:
        result = answer_chat(payload)
    except Exception as exc:  # noqa: BLE001 - surfaced to the backend
        logger.exception("Chat failed")
        raise HTTPException(status_code=500, detail=f"Chat failed: {exc}") from exc

    return {
        "status": "success",
        "message": "Answer generated.",
        "data": result.model_dump(),
    }


@app.post("/api/v1/job-match")
def job_match(
    payload: JobMatchRequest,
    x_service_token: str | None = Header(default=None),
) -> dict[str, Any]:
    """Score a candidate profile against a job description."""
    _verify_service_token(x_service_token)

    try:
        result = match_job(payload)
    except Exception as exc:  # noqa: BLE001 - surfaced to the backend
        logger.exception("Job match failed")
        raise HTTPException(
            status_code=500, detail=f"Job match failed: {exc}"
        ) from exc

    return {
        "status": "success",
        "message": "Job match generated.",
        "data": result.model_dump(),
    }

