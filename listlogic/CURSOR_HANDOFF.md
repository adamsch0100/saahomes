# ListLogic — Cursor Handoff

**Product:** ListLogic — data-driven listing success for real estate agents  
**Origin:** Built with Grok; move to Cursor for app wiring + Railway deploy  
**Owner site:** saahomes.com (SAA Homes / Adam Schwartz)

---

## Cursor starter prompt (copy everything below)

```
You are continuing development of ListLogic, a SaaS tool for real estate agents.

## Product thesis
"Data-driven listing success" — the highest-probability path to selling a home starts before the sign goes up, with pricing and positioning grounded in MLS data. Sellers see market temperature, recommended price, price-strategy trade-offs (DOM + odds), and full transparent comps. Agents keep full edit control and branding.

## What already exists (Python engine + presentation)
- core.py — MLS load (pipe-delimited 71-field style), absorption, months of inventory (Active ONLY), under contract = Pending+Backup, odds, scatter, closest comps, price sensitivity, narratives
- subject.py — resolve subject by address/MLS + overrides
- presentation.py / rebuild_html.py — HTML presentation generator
- llm_narrative.py — optional OpenAI/OpenRouter narratives
- pdf_export.py — basic PDF via reportlab
- presentation.html — full interactive client presentation (charts, Agent Tools panel, full data table with column picker, sort, include/exclude, Z/R/G links)
- saas/index.html, pricing.html, app.html — marketing + app shell

## Critical domain rules
1. Months of inventory = Active listings ÷ sales per month (NOT including Pending/Backup)
2. Under contract = Pending + Backup (+ FirstRight mapped to Pending)
3. Market Odds (KPI) = overall absorption/active; Price Strategy odds are price-adjusted variants
4. Subject living area for demo house 2845 W 13th St Greeley = 2392 total sqft
5. Agent must be able to override recommended price, range, DOM, advantages, risks, bottom line

## Business model to implement
1. Free beta — limited invited agents
2. One-time report purchase
3. Agent monthly subscription
4. Brokerage monthly (multi-seat)

## What to build next (priority order)
1. Minimal web app (Next.js or similar) that:
   - Accepts MLS export upload
   - Accepts subject fields + agent branding
   - Calls the Python engine (API route or worker) and returns/hosted presentation HTML
2. Auth (Clerk/Auth.js) + beta allowlist
3. Agent branding settings (name, phone, email, brokerage, logo, colors)
4. Deploy on Railway (web + worker if needed)
5. Stripe later: one-time + subscriptions

## Sample data
Use export-71.txt (pipe-delimited IRES-style) when provided. Demo subject: 2845 W 13th St, Greeley CO 80634, 4/2, 1969, 2392 sqft, Sherwood Park 1st Add.

## Tone
Professional, clear, seller-friendly. Not hype. Agents look expert; data removes guesswork.
```

---

## Project layout

```
ListLogic/
├── core.py                 # Analysis engine
├── subject.py              # Subject resolver
├── presentation.py         # Report build helpers
├── llm_narrative.py        # Optional LLM layer
├── pdf_export.py           # PDF export
├── rebuild_html.py         # Builds presentation.html from presentation_data.json
├── presentation.html       # Demo output (open in browser)
├── presentation_data.json  # Last analysis payload
├── saas/
│   ├── index.html          # Landing — data-driven listing success
│   ├── pricing.html        # Free beta / one-time / agent / brokerage
│   └── app.html            # Upload shell (not wired to API yet)
├── README.md
└── CURSOR_HANDOFF.md       # This file
```

Also keep your MLS sample: `export-71.txt` (from original attachments).

---

## Railway (you run this on your machine — do not paste tokens into chat)

```bash
# 1. Install CLI: https://docs.railway.com/guides/cli
npm i -g @railway/cli

# 2. Login in YOUR terminal
railway login

# 3. From the app repo (after Cursor scaffolds Next.js + API)
railway init
railway up
```

Suggested Railway services later:
- **web** — Next.js (or FastAPI + static)
- **optional worker** — long MLS jobs
- **Redis/Postgres** — sessions, users, saved reports (when needed)

Env vars (set in Railway dashboard, not in git):
- `OPENAI_API_KEY` or `OPENROUTER_API_KEY` (optional narratives)
- `DATABASE_URL` (when you add auth/storage)
- `STRIPE_SECRET_KEY` (when monetizing)

---

## Security note
Never commit Railway tokens, Stripe keys, or MLS credentials. Use Railway/project env vars only.
