# Profiler — AI Resume Intelligence

Upload a resume → get a dashboard-ready, LLM-analysed candidate profile.

```
┌──────────────┐   POST /api/resume    ┌─────────────────┐
│   Frontend   │ ────────────────────► │  Node backend   │
│ React + Vite │ ◄──────────────────── │  Express + Mongo│
└──────────────┘   poll /profile       └────────┬────────┘
                                                │ POST /api/v1/analyze
                                                ▼
                                       ┌─────────────────┐
                                       │   AiAnalyser    │
                                       │ FastAPI+LangGraph│
                                       │  Docling + LLM  │
                                       └─────────────────┘
```

The upload endpoint responds immediately with `processingStatus: "processing"`.
The backend analyses the file in the background and the frontend polls
`GET /api/resume/:id/profile` until the profile is ready.

## Repository layout

| Path          | What it is                                                        |
| ------------- | ----------------------------------------------------------------- |
| `AiAnalyser/` | Python microservice: Docling extraction, LangGraph pipeline, LLM routing |
| `backend/`    | Express API: uploads, auth, MongoDB persistence, orchestration     |
| `frontend/`   | TanStack Start + React dashboard and upload UI                     |

## 1. AI Analyser (port 8000)

```bash
cd AiAnalyser
copy .env.example .env      # then add ONE provider key
uv sync
uv run python main.py
```

`.env` needs at least one of `OPENROUTER_API_KEY`, `GOOGLE_API_KEY`,
`OPENAI_API_KEY`. The router skips providers without a key.

Pipeline: `extract (Docling) → clean → structure (LLM) → validate →
repair (max 2) → finalize`. Provider routing lives in `config/models.yaml`
(primary `openrouter`, fallback `google`, then `openai`).

Check readiness:

```bash
curl http://localhost:8000/health
```

`"ready": true` means at least one provider key was found.

## 2. Backend (port 5001)

```bash
cd backend
npm install
copy .env.example .env
npm start
```

Required `.env` values:

| Variable        | Purpose                                              |
| --------------- | ---------------------------------------------------- |
| `MONGO_URI`     | MongoDB connection string (Atlas or local)           |
| `JWT_SECRET`    | Token signing secret                                 |
| `CLOUDINARY_*`  | Resume storage (cloud name, key, secret)             |
| `AI_ANALYSER_URL` | Defaults to `http://localhost:8000`                |
| `DEMO_MODE`     | `true` uses a shared demo user when no JWT is sent   |

With `DEMO_MODE=true` no login is needed — the API falls back to
`demo@profilegpt.local` (created on first use).

### Resume endpoints

| Method | Route                       | Purpose                                  |
| ------ | --------------------------- | ---------------------------------------- |
| POST   | `/api/resume`               | Upload PDF/DOCX (≤5 MB), starts analysis |
| GET    | `/api/resume`               | List uploads                             |
| GET    | `/api/resume/latest/profile`| Latest profile (dashboard default)       |
| GET    | `/api/resume/:id/profile`   | Profile + `processingStatus` (poll this) |
| POST   | `/api/resume/:id/reanalyze` | Re-run analysis from stored text         |
| DELETE | `/api/resume/:id`           | Soft delete                              |

## 3. Frontend (port 5173)

```bash
cd frontend
npm install
copy .env.example .env      # VITE_API_URL=http://localhost:5001/api
npm run dev
```

* `/upload` — real upload with live pipeline stages and retry on failure.
* `/dashboard` — renders the analysed profile. Without a live profile it falls
  back to the bundled demo data.

## Pipeline details

1. **Docling** converts the PDF/DOCX to Markdown (~60–90 s on CPU the first time
   while models load).
2. **Clean** normalises whitespace and truncates to `MAX_INPUT_CHARS`.
3. **Structure** asks the routed LLM for the `ResumeProfile` schema.
4. **Validate** enforces the schema plus semantic requirements (name, summary,
   skills, timeline/projects, role fits).
5. **Repair** re-prompts with the validation errors, rotating providers.
6. **Finalize** derives initials, experience years, radar axes and platform
   links, and normalises every list.

`codingActivity` is always `[]` because a resume has no commit history; the
dashboard shows an empty state for it.

## Troubleshooting

| Symptom | Fix |
| ------- | --- |
| `querySrv ENOTFOUND` on startup | The `MONGO_URI` host is wrong or the cluster is deleted. Use a valid Atlas URI or `mongodb://127.0.0.1:27017/profilegpt`. |
| `/health` returns `ready: false` | No provider API key in `AiAnalyser/.env` (restart the service after adding it). |
| OpenRouter `402 requires more credits` | OpenRouter reserves credit for the full output window. Lower `max_tokens` in `AiAnalyser/config/models.yaml` (defaults to 4096). |
| Upload stuck on `processing` | Check the AiAnalyser console; Docling takes ~1–2 min on first run. |
| `AI Analyser is not reachable` | Start it with `uv run python main.py` inside `AiAnalyser/`. |
| Re-analysis returns 502 | Older records have no stored text and Cloudinary raw delivery is blocked — upload the file again. |
