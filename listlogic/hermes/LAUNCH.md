# Launch Checklist — Hermes for ListLogic

Separate from SAA Homes Hermes. Deploy as a **second Railway service** on the **ListLogic** project (or same monorepo project, different service).

Root directory: `listlogic/hermes`  
Volume: mount at `/opt/data`  
Public networking: port **9119** (dashboard) + basic auth env vars

---

## What is already built (no credentials needed)

| Piece | Path |
|-------|------|
| Seed personality + workspace | `seed/SOUL.md`, `USER.md`, `AGENTS.md`, `MEMORY.md`, `config.yaml` |
| Growth context | `seed/workspace/listlogic/context/*` |
| Skills (site-health, funnel, harvest, outreach, SEO, MLS…) | `seed/skills/*/SKILL.md` |
| Docker + Railway | `Dockerfile`, `railway.toml` |
| Bootstrap + Telegram repair | `scripts/bootstrap-seed.sh`, `sync-telegram-auth.*`, `repair-telegram.sh` |
| Page audit helper | `scripts/fetch-page-audit.py` |
| Env template | `.env.example` |
| Prospect harvest script | `listlogic/scripts/harvest_prospects.py` |
| Outreach templates | `listlogic/prospects/outreach/*` |

Product side (ListLogic app) already has: Generate paywall, Stripe 7-day trial + $20 one-shot, onboarding listings/year + SMS consent, `/api/public-config` + GA4/UTM helpers.

---

## You provide (credentials only)

### Required to start Hermes

1. **OpenCode Go API key** → `OPENCODE_GO_API_KEY`
2. **New Telegram bot** (prefer separate from SAA) + **your Telegram user ID** → `TELEGRAM_BOT_TOKEN`, `TELEGRAM_ALLOWED_USERS`
3. **Railway service**: create service, root `listlogic/hermes`, volume `/opt/data`, set dashboard auth:
   - `HERMES_DASHBOARD_BASIC_AUTH_USERNAME`
   - `HERMES_DASHBOARD_BASIC_AUTH_PASSWORD`
   - `HERMES_DASHBOARD_BASIC_AUTH_SECRET` (`openssl rand -base64 32`)
4. **API_SERVER_KEY** — long random string

### Strongly recommended

5. **GA4 Measurement ID** for listlogic.homes → set on **ListLogic website** service as `GA4_MEASUREMENT_ID` (and optionally same on Hermes)
6. Stripe live keys already on app — confirm `DEFAULT_TRIAL_DAYS=0`, `DEFAULT_PRESENTATION_LIMIT=0`, `STRIPE_TRIAL_DAYS=7`
7. **GitHub PAT** + `GITHUB_REPO` if Hermes should open PRs
8. **RAILWAY_TOKEN** + **RAILWAY_SERVICE_ID** = ListLogic **website** service (never Hermes)
9. **SMTP** for outreach packs → `OUTREACH_SMTP_*`, `OUTREACH_EMAIL_TO`
10. Optional: GSC service account B64, SerpAPI, Browserbase (intel only)

### Content (you)

11. Record product video → paste embed URL into homepage `#product-video` placeholder
12. Smoke-test Stripe trial + $20 after next website deploy

---

## First boot prompt (paste in Telegram after bot works)

> Run AGENTS.md first-boot checklist. Install crons from context/automation-registry.md. Nationwide ICP for ListLogic. Report readiness + what’s blocked on credentials.

---

## Product monetization (already in app)

Demo free · signup/setup free · Generate wall · Stripe 7-day trial on `agent_monthly` (card required) → $39/mo · or $20 one-shot · no free custom presentations.
