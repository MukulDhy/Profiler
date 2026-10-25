# ProfileGPT — AI Analyser

Resume → dashboard-ready structured JSON.

Pipeline: **Docling** (PDF/DOCX → Markdown) → **LangGraph** (extract → clean →
structure → validate → repair → finalize) → **LLM** (OpenRouter / OpenAI /
Google Gemini) → Pydantic-validated profile.

The Node backend calls this service at `POST /api/v1/analyze`. You normally do
not call it directly from the browser.

---

## Quick start

```bash
cd AiAnalyser

# 1. Configure at least one provider key
copy .env.example .env
#    then edit .env and fill in ONE of:
#    OPENROUTER_API_KEY / GOOGLE_API_KEY / OPENAI_API_KEY

# 2. Install dependencies
uv sync

# 3. Run
uv run python main.py
#    → http://localhost:8000/docs
```

Check what the router can actually use:

```bash
curl http://localhost:8000/health
curl http://localhost:8000/api/v1/providers
```

`ready: false` means no API key is configured.

---

## Model routing

`config/models.yaml` defines the provider chain:

```yaml
routing:
  primary: openrouter
  fallback: [google, openai]
```

* Providers without a key are skipped automatically.
* If a provider errors, the next one is tried.
* Each repair attempt rotates to the next provider.
* Auth/credit errors (`401`, `402`, `403`, `404`) are **not** retried — the
  graph fails fast instead of burning repair attempts.
* `POST /api/v1/analyze` accepts `provider` and `model` form fields to override
  the route for a single request.

Provider keys are read from `AiAnalyser/.env`. The file is loaded into the
process environment at startup, so a key added there is visible to the router
after a restart.

Each provider sets `max_tokens` explicitly. This matters on OpenRouter: without
a cap it reserves credit for the model's full output window (e.g. 65k tokens)
and returns `402` on low balances even though the real response is only a few
thousand tokens.

Supported provider types:

| type                | SDK                         |
| ------------------- | --------------------------- |
| `openai`            | `langchain-openai`          |
| `openai_compatible` | `langchain-openai` + base URL (OpenRouter) |
| `google_genai`      | `langchain-google-genai`    |

---

## API

### `POST /api/v1/analyze`

`multipart/form-data`:

| field      | type   | notes                        |
| ---------- | ------ | ---------------------------- |
| `file`     | file   | PDF or DOCX, max 5 MB        |
| `provider` | string | optional routing override    |
| `model`    | string | optional model override      |

Response:

```json
{
  "status": "success",
  "data": {
    "profile": { "candidate": {}, "analysis": {}, "skills": [], "...": "..." },
    "extractedText": "markdown…",
    "meta": {
      "provider": "google",
      "model": "gemini-2.5-flash",
      "durationMs": 18432,
      "attempts": 0,
      "providerTrail": [],
      "warnings": [],
      "textChars": 7753
    }
  }
}
```

On failure the service returns `4xx/5xx` with `{ "detail": { "status": "error",
"message": "…", "errors": [...], "meta": {...} } }`.

### `POST /api/v1/analyze/url`

JSON body: `{ "file_url": "https://…", "file_name": "resume.pdf" }`.

### `POST /api/v1/analyze/text`

JSON body: `{ "text": "…", "file_name": "resume.txt" }`. Re-runs the LLM stage
against previously extracted Markdown, skipping Docling. The backend uses this
for re-analysis so it does not need to download the original file again.

### `GET /health`, `GET /api/v1/providers`

Service and routing introspection.

---

## Profile contract

The payload mirrors the `/dashboard` UI exactly:

| Key                  | Contents                                             |
| -------------------- | ---------------------------------------------------- |
| `candidate`          | name, title, initials, uuid, links, years, summary    |
| `analysis`           | score, atsScore, keywordMatch, strengths, weaknesses  |
| `skills`             | `{ name, level, group }`                              |
| `radarSkills`        | `{ axis, value }`                                     |
| `timeline`           | `{ year, role, org, blurb }`                          |
| `projects`           | `{ id, name, tagline, tech, metrics, summary }`       |
| `platforms`          | `{ name, handle, stat }`                              |
| `recruiterInsights`  | `{ roleFits, interviewQuestions }`                    |
| `codingActivity`     | always `[]` — a resume has no commit history           |

Scores and skill levels are LLM judgements constrained to `0–100` by Pydantic.
Missing facts are returned as `null` / `0` / `[]`; the prompt forbids invention.

---

## Environment variables

| Variable             | Default        | Purpose                                  |
| -------------------- | -------------- | ---------------------------------------- |
| `OPENROUTER_API_KEY` | —              | OpenRouter key                           |
| `GOOGLE_API_KEY`     | —              | Gemini key                               |
| `OPENAI_API_KEY`     | —              | OpenAI key                               |
| `SERVICE_TOKEN`      | empty          | require `X-Service-Token` from the backend |
| `HOST` / `PORT`      | `0.0.0.0:8000` | bind address                             |
| `MAX_FILE_MB`        | `5`            | upload cap                               |
| `MAX_INPUT_CHARS`    | `40000`        | resume truncation limit                  |
| `MAX_REPAIR_ATTEMPTS`| `2`            | corrective LLM retries                   |

---

## Standalone extraction

```bash
uv run python -c "from document_extraction import document_extraction; document_extraction()"
```

Writes `output/resume_mukul_dahiya.md` and `.json` for debugging.

---

## Troubleshooting

| Symptom | Cause / fix |
| ------- | ----------- |
| `/health` says `ready: false` although `.env` has a key | The service was started before the key was added, or the variable name differs from `api_key_env` in `models.yaml`. Restart the service. |
| `402 ... requires more credits, or fewer max_tokens` | OpenRouter reserves credit for the full output window. Lower `max_tokens` for the provider in `config/models.yaml` (4096 is the default here). |
| `401` / `403` | Invalid or revoked key. |
| `404` on a model | The model id is wrong or unavailable to your account; change `model` in `models.yaml`. |
| `No LLM provider is configured` | No key was found in the environment or `.env`. |

