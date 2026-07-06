# Launch Checklist — Hermes for SAA Homes

What Adam provides → what gets enabled → order of operations.

---

## Phase 1 — Launch Hermes (required)

| # | You provide | Where | Enables |
|---|-------------|-------|---------|
| 1 | **OpenCode Go API key** | [opencode.ai/go](https://opencode.ai/go) → subscribe → copy `sk-` key | Hermes brain ($10/mo) |
| 2 | **Telegram bot token** | Message [@BotFather](https://t.me/BotFather) → `/newbot` → copy token | Done notifications + outreach review |
| 3 | **Your Telegram user ID** | Message [@userinfobot](https://t.me/userinfobot) or approve pairing on first message | Hermes only talks to you |
| 4 | **Railway access** | Existing saahomes.com project | Deploy Hermes as 2nd service |

**Railway Hermes service setup:**
- New service from same GitHub repo
- Root directory: `hermes`
- Add **Volume** mounted at `/opt/data`
- Public port: **9119** (dashboard)
- Env vars from `hermes/.env.example` (minimum: OpenCode key, Telegram, `API_SERVER_KEY`, and **dashboard login** vars below)

**Dashboard login (required for the public URL to work):**
Hermes binds the dashboard to `0.0.0.0` on Railway. Without username/password auth, the dashboard **refuses to start** and the URL shows "Application failed to respond."

```
HERMES_DASHBOARD=1
HERMES_DASHBOARD_HOST=0.0.0.0
HERMES_DASHBOARD_PORT=9119
HERMES_DASHBOARD_BASIC_AUTH_USERNAME=admin
HERMES_DASHBOARD_BASIC_AUTH_PASSWORD=<strong password>
HERMES_DASHBOARD_BASIC_AUTH_SECRET=<openssl rand -base64 32>
```

Networking → Public → port **9119** (not Railway's default `$PORT`).

---

## Phase 2 — Autopilot execution (required for ship-and-notify)

| # | You provide | Enables |
|---|-------------|---------|
| 5 | **GitHub repo URL** | e.g. `github.com/YOURUSER/saahomes` |
| 6 | **GitHub fine-grained PAT** | Scopes: Contents (R/W), Pull requests (R/W). Expiry 90d+ | Auto PR + merge SEO/content |
| 7 | **Confirm merge policy** | Enable auto-merge on repo OR you merge manually at first | Live content changes |

Optional but recommended:
| 8 | **Railway deploy hook** | Redeploy saahomes.com service when main branch updates | Changes go live without you |

---

## Phase 3 — GEO + measurement (your priorities)

| # | You provide | Enables |
|---|-------------|---------|
| 9 | **Google Search Console access** | Add saahomes.com → Settings → Users **or** service account JSON | Ranking data, indexation, smarter fixes |
| 10 | **GA4 Measurement ID** | `G-XXXXXXXXXX` from analytics.google.com | Site tracking (we add to index.html) |
| 11 | **GA4 service account** (optional) | Admin → Property access for Hermes service account email | Hermes reads conversion reports |
| 12 | **List of conversion events you care about** | contact submit, market report, CHFA forms | Hermes optimizes for leads not clicks |

**Note:** Site uses Google tag `G-CB5GL0P3EZ` (stream `G-BVWCZE025P` for saahomes.com) in `index.html` + `generate_lead` on all form submits. Hermes still needs a **GA4 service account** (optional env) to read reports autonomously.

---

## Phase 4 — Browser + outreach (when ready)

| # | You provide | Enables |
|---|-------------|---------|
| 12 | **Browserbase API key + project ID** (optional) | browse.sh market intel only — Zillow, Realtor, Walk Score |
| 13 | **Outreach SMTP** (Gmail app password) | Outreach approval sends + **social post pack emails** |

Social posting uses **SMTP email packs**, not Browserbase. See `context/hard-rules.md`.

## Phase 5 — Later

| Item | When |
|------|------|
| Follow Up Boss + visitor chat AI | After Hermes + GEO running |
| SerpAPI / Serper key | Deeper SERP/competitor intel |

Follow Up Boss is already on your **backend** (`FOLLOW_UP_BOSS_API_KEY`) for form leads — Hermes won't touch CRM until we build visitor chat.

---

## What to send me (copy/paste checklist)

```
LAUNCH PACKAGE:
[ ] OpenCode Go key: sk-... (or say "I'll add to Railway directly")
[ ] Telegram bot token: ...
[ ] Telegram user ID: ...
[ ] GitHub repo: ...
[ ] GitHub PAT: ... (or add to Railway yourself)
[ ] GA4 Measurement ID: G-...
[ ] GSC: service account JSON attached OR invite sent to [email]
[ ] Railway: OK to add Hermes service to existing project? yes/no
[ ] Auto-merge PRs: yes/no (start with no if you prefer)
```

**Never paste secrets in chat if you prefer** — add them directly in Railway env vars and tell me "env vars set."

---

## Launch sequence (what happens after you provide the above)

### Step 1 — Deploy (me or you)
1. Commit + push `hermes/` folder if not on GitHub
2. Add Railway service (root `hermes`, volume `/opt/data`)
3. Set env vars
4. Deploy → open dashboard on port 9119

### Step 2 — First boot (Hermes)
Send to Hermes (dashboard or Telegram once paired):
> Run AGENTS.md first-boot checklist. Read context/repo-maintenance-checklist.md and context/local-events-sources.md. Install all 24 cron jobs from automation-registry.md (including weekly-operator-schedule, local-events-monthly, local-events-quarterly, lead-attribution-brief). Install browse.sh skills from skills-registry.md (Zillow, Realtor, Walk Score). Pin models. Run baseline GEO audit on 5 Tier S questions. Report readiness.

### Step 3 — Conversion instrumentation (me)
1. Add GA4 to `index.html`
2. Fire events on form submits (contact, market report, CHFA forms)
3. Hermes can then tie SEO/GEO work → leads

### Step 4 — GEO content pass (Hermes, autonomous)
1. FAQ + FAQPage schema on top money pages
2. Publish `llms.txt` at saahomes.com/llms.txt
3. Expand area page Q&A blocks for AI extraction
4. Weekly `geo-citation-audit` cron runs ongoing

### Step 5 — Steady state (you)
- **Daily:** skim Telegram only if digest arrives
- **Thursday:** approve 0–2 outreach drafts (`approved`)
- **Monday:** optional war room read
- **Otherwise:** Hermes runs

---

## Realistic timeline

| Milestone | When |
|-----------|------|
| Hermes live + Telegram reporting | Day 1 after credentials |
| Cron automation running | Day 1 (first boot) |
| GA4 + form events live | Day 1–2 after measurement ID |
| First GEO content PR merged | Week 1 |
| GSC-driven ranking reports | Week 1 after GSC connected |
| Measurable GEO citation improvement | 60–90 days (honest) |
| Visitor chat + Follow Up Boss | Phase 2 project |

---

## Minimum to start TODAY

If you want the fastest path, send only these three:

1. **OpenCode Go key**
2. **Telegram bot token**
3. **"Yes, add Hermes to Railway"** (or Railway project access)

Hermes launches in monitoring + report mode. Add GitHub + GA4 + GSC next for full autopilot + GEO + conversion loop.
