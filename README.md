# ProfileGPT — your resume can finally talk

ProfileGPT turns a static PDF/DOCX resume into a queryable professional profile.
Upload a resume, get an LLM-analysed dashboard, chat with it, share a read-only
profile with recruiters, match it against a job description, and track GitHub
activity. Everything is free — there are no plans, seats or billing code.

```
┌───────────────┐   POST /api/resume   ┌────────────────┐
│   Frontend    │ ───────────────────► │  Node backend  │
│ React + Vite  │ ◄─────────────────── │ Express + Mongo│
└───────────────┘   poll /profile      └───────┬────────┘
                                               │ POST /api/v1/analyze
                                               ▼
                                       ┌────────────────┐
                                       │   AiAnalyser   │
                                       │ FastAPI+LangGraph│
                                       │  Docling + LLM │
                                       └────────────────┘
```

The upload endpoint responds immediately with `processingStatus: "processing"`.
The backend analyses the file in the background and the frontend polls
`GET /api/resume/:id/profile` until the profile is ready.

## Repository layout

| Path          | What it is                                                              |
| ------------- | ----------------------------------------------------------------------- |
| `AiAnalyser/` | Python microservice: Docling extraction, LangGraph pipeline, LLM routing, chat and job matching |
| `backend/`    | Express API: auth, uploads, chat, notes, sharing, GitHub, MongoDB        |
| `frontend/`   | TanStack Start + React app: landing, auth, dashboard, chat, settings      |

## Features

- **Authentication** — email/password with verification codes, password reset,
  Google sign-in (optional), JWT access/refresh cookies, profile + avatar
  management, account deactivation.
- **Resume analysis** — PDF/DOCX upload, Docling extraction, schema-validated
  LLM profile with projects, skills, timeline, role fits and ATS scoring.
- **Grounded AI chat** — conversations persisted per resume. The model receives
  the full structured profile plus extracted resume text; there is no
  vector store or RAG step.
- **Public sharing** — per-resume share links with a read-only profile and a
  rate-limited recruiter chat. Revoke at any time.
- **Resume history** — paginated list with processing status, re-analysis,
  sharing and delete.
- **Recruiter workspace** — role-fit breakdown, job-description matching, and
  persistent notes per resume.
- **GitHub activity** — live repos, stars, languages and commit activity, with
  an optional token for a higher rate limit.
- **Free forever** — no billing, payment or subscription code anywhere.

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
npm run dev
```

Required `.env` values:

| Variable          | Purpose                                                        |
| ----------------- | -------------------------------------------------------------- |
| `MONGO_URI`       | MongoDB connection string (Atlas or local)                     |
| `JWT_SECRET`      | Access token signing secret                                    |
| `JWT_REFRESH_SECRET` | Refresh token signing secret                                |
| `CLOUDINARY_*`    | Resume and avatar storage                                      |
| `SMTP_*`          | Verification codes, password resets and welcome email          |
| `AI_ANALYSER_URL` | Defaults to `http://localhost:8000`                            |
| `GOOGLE_CLIENT_ID`| Optional — enables Google sign-in                              |
| `GITHUB_TOKEN`    | Optional — raises the GitHub API rate limit                    |
| `REQUIRE_EMAIL_VERIFICATION` | `true` blocks unverified accounts in production    |
| `DEMO_MODE`       | `true` allows a shared demo account when no JWT is sent        |

`DEMO_MODE=true` creates `demo@profilegpt.local` on first use so the pipeline can
be tried before signing up. Set it to `false` in production.

### API overview

| Method | Route                                  | Purpose                              |
| ------ | -------------------------------------- | ------------------------------------ |
| GET    | `/api/health`                          | Server, database and AI status       |
| POST   | `/api/auth/register`                   | Create an account                    |
| POST   | `/api/auth/login`                      | Email/password sign-in               |
| POST   | `/api/auth/google`                     | Google ID-token sign-in              |
| POST   | `/api/auth/refresh`                    | Rotate the access token              |
| POST   | `/api/auth/logout`                     | Clear cookies                       |
| GET    | `/api/auth/me`                         | Current user                         |
| PUT    | `/api/auth/profile`                    | Update profile fields                |
| POST   | `/api/auth/avatar`                     | Upload an avatar                     |
| DELETE | `/api/auth/avatar`                     | Remove the avatar                    |
| PUT    | `/api/auth/change-password`            | Change password                      |
| POST   | `/api/auth/verify-email`               | Verify with a 6-digit code           |
| POST   | `/api/auth/forgot-password`            | Email a reset link                   |
| PUT    | `/api/auth/reset-password/:token`      | Reset with a token                   |
| DELETE | `/api/auth/account`                    | Deactivate the account               |
| POST   | `/api/resume`                          | Upload PDF/DOCX (≤ 5 MB), start analysis |
| GET    | `/api/resume`                          | Paginated resume history             |
| GET    | `/api/resume/latest/profile`           | Latest analysed profile              |
| GET    | `/api/resume/:id/profile`              | Profile + `processingStatus` (poll)  |
| POST   | `/api/resume/:id/reanalyze`            | Re-run analysis                      |
| POST   | `/api/resume/:id/share`                | Create/refresh a public link         |
| DELETE | `/api/resume/:id/share`                | Revoke the public link               |
| DELETE | `/api/resume/:id`                      | Soft delete                          |
| GET    | `/api/chat/conversations`              | List conversations for a resume      |
| POST   | `/api/chat/conversations`              | Create a conversation                |
| POST   | `/api/chat/conversations/:id/messages` | Send a message                       |
| GET    | `/api/notes?resumeId=`                 | List recruiter notes                 |
| POST   | `/api/notes`                           | Create a note                        |
| DELETE | `/api/notes/:id`                       | Delete a note                        |
| POST   | `/api/ai/job-match`                    | Score a job description              |
| GET    | `/api/github/activity?username=`       | Live GitHub activity                 |
| GET    | `/api/public/profile/:token`           | Public read-only profile             |
| POST   | `/api/public/profile/:token/chat`      | Rate-limited public chat             |

### Tests

```bash
cd backend
npm test
```

The Jest suite boots `mongodb-memory-server`, stubs outbound mail and the AI
service, and covers auth, sharing, public chat, conversations, notes, job
matching and GitHub validation.

## 3. Frontend (port 8080)

```bash
cd frontend
npm install
copy .env.example .env      # VITE_API_URL=http://localhost:5001/api
npm run dev
```

Routes:

- `/` — landing page with the free-forever section.
- `/login`, `/signup`, `/forgot-password`, `/reset-password/$token` — auth.
- `/upload` — real upload with live pipeline stages and retry.
- `/dashboard` — analysed profile, search, sharing, GitHub activity.
- `/projects`, `/recruiter`, `/chat` — live views over the analysed profile.
- `/resumes` — paginated history with share/re-analyse/delete.
- `/settings` — profile, avatar, password, verification and deactivation.
- `/share/$token` — public read-only profile plus recruiter chat.

`VITE_GOOGLE_CLIENT_ID` must match the backend `GOOGLE_CLIENT_ID`; when blank
the Google button is hidden.

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

`codingActivity` from the resume is always empty because a resume has no commit
history; the dashboard uses live GitHub data instead.

## Troubleshooting

| Symptom | Fix |
| ------- | --- |
| `querySrv ENOTFOUND` on startup | The `MONGO_URI` host is wrong or the cluster is deleted. Use a valid Atlas URI or `mongodb://127.0.0.1:27017/profilegpt`. |
| `/health` returns `ready: false` | No provider API key in `AiAnalyser/.env` (restart the service after adding it). |
| OpenRouter `402 requires more credits` | OpenRouter reserves credit for the full output window. Lower `max_tokens` in `AiAnalyser/config/models.yaml` (defaults to 4096). |
| Upload stuck on `processing` | Check the AiAnalyser console; Docling takes ~1–2 min on first run. |
| `AI Analyser is not reachable` | Start it with `uv run python main.py` inside `AiAnalyser/`. |
| Re-analysis returns 502 | Older records have no stored text and Cloudinary raw delivery is blocked — upload the file again. |
| Google button missing | Set both `GOOGLE_CLIENT_ID` and `VITE_GOOGLE_CLIENT_ID`, then restart both servers. |
| Verification code never arrives | Check `SMTP_*` credentials; in development the OTP is also printed in the backend log. |
