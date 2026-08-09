# ListLogic

**Data-driven custom pricing strategy** — https://listlogic.homes (attach DNS to Railway when ready).

## Local

```powershell
cd marketvista
python -m venv .venv
.\.venv\Scripts\pip.exe install -r requirements.txt
$env:ADMIN_BOOTSTRAP_EMAIL = "adam@saahomes.com"
$env:ADMIN_BOOTSTRAP_PASSWORD = "changeme-local"
$env:SESSION_SECRET = "dev-session-secret"
.\.venv\Scripts\python.exe -m uvicorn server:app --host 127.0.0.1 --port 8787
```

Open http://127.0.0.1:8787/saas/

- **Try sample:** http://127.0.0.1:8787/demo (no login)
- **Sign up / trial:** `/saas/signup.html` — 3 presentations or 60 days, whichever first
- **Admin:** `/saas/admin.html` (bootstrap admin email)

SQLite DB is created at `output/listlogic.db` when `DATABASE_URL` is unset.

## Production (Railway)

- Project was named **MarketVista** — rename project + service to **ListLogic** in the Railway UI
- Live fallback URL: https://marketvista-production.up.railway.app
- **Primary domain:** `listlogic.homes` — add Custom Domain in Railway, then set registrar DNS (CNAME/ALIAS as Railway shows)
- Optional: redirect `listlogic.saahomes.com` → `listlogic.homes`
- Add **Postgres** plugin → sets `DATABASE_URL`
- Env (see `.env.example`):
  - `SESSION_SECRET` (long random)
  - `ADMIN_BOOTSTRAP_EMAIL` / `ADMIN_BOOTSTRAP_PASSWORD`
  - `APP_BASE_URL=https://listlogic.homes`
  - `FEEDBACK_TO=adam@saahomes.com`
  - SMTP: `GMAIL_USER` + `GMAIL_APP_PASSWORD` (or `SMTP_*`)
  - Optional: `CRON_SECRET` for `POST /api/internal/trial-reminders`
- Legacy `ACCESS_CODES` / shared access-code login is **retired** (promo codes live in the DB / admin UI)

## Key routes

| Path | Purpose |
|------|---------|
| `/saas/` | Marketing |
| `/demo` | Public sample listing (no IRES) |
| `/saas/signup.html` | Free trial signup (+ optional promo / invite) |
| `/saas/login.html` | Email/password sign-in |
| `/saas/app.html` | Generate UI (authed) |
| `/saas/admin.html` | Users, promos, invites, feedback |
| `/api/assistant/chat` | Logged-in AI help bot (OpenCode / `deepseek-v4-flash`) |
| `/api/generate` | Upload → engine → presentation (trial-gated) |
| `/runs/{id}/` | Interactive presentation |

## Trial policy

**3 presentations OR 60 days — whichever comes first.** Editable per promo code / invite in admin. Default promo seed: `COLDWELL-NOCO`.
