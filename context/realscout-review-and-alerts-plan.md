# RealScout Review + SAA "Search & Alerts Engine" Build Plan

**Date:** Aug 6, 2026 · **Author:** Hermes (for Adam Schwartz) · **Status:** Proposal for review
**Goal:** Build a RealScout-class saved-search + alert + nurture system for saahomes.com — designed from day one so it can become a **competing product** (white-label engine for other Northern Colorado agents).

---

## PART 1 — RealScout: In-Depth Review

### 1.1 What RealScout is (and where it's going)

RealScout (founded 2014, Y Combinator S14, SF) began as the **AI-powered search platform**: agents gave clients a branded search experience with a "match score" on every home — the engine learned what each buyer actually liked (from saves, clicks, tours) and ranked new listings accordingly. Daily digest emails, co-browsing sessions, mobile apps, 250+ MLS integrations. It was "Zillow, but owned by the agent."

**The pivot (2019→now):** RealScout now markets itself as **"the #1 lead nurture platform — make your database your profit center."** Their funnel is literally printed on the homepage: **Capture → Enrich → Nurture → Convert**. This is the industry's loudest signal: *the search experience is table stakes; the database + automated follow-up is where the money is.* Agents don't lack listings — they lack a system that turns a signup into a closing months later.

Their current pitch deck, in one line: *"Automatically nurture contacts 24/7 to create a steady stream of ready buyers and sellers."* AI follow-up, contact enrichment, engagement tracking, integrations with CRM/website/ad platforms.

### 1.2 Business model

- **SaaS per-seat** — agents/brokerages pay a monthly subscription (historically ~$99–199/agent/mo; teams & brokerage plans scale down per seat)
- **White-label** for large brokerages (their brand, RealScout's engine)
- The moat: **the database** — every saved search, click, save, and tour is structured intent data; switching costs compound monthly
- They sell to **agents**, not consumers — the consumer experience is the *product they sell*, the agent experience is the *product they keep*

### 1.3 Product anatomy (what to copy)

**Client-facing:**
| Feature | What it does | Why it works |
|---|---|---|
| Branded search | Agent's logo/colors on a Zillow-grade search | Agent owns the relationship |
| **Saved searches** | Client saves any filter set, nameable, editable | The core retention loop |
| **Daily digest email** | "3 new homes matched your search" with cards | Push beats pull for re-engagement |
| **Match score** | % match on each home, with "why" | Feels magical, drives clicks |
| Price-drop alerts | Immediate notification on saved criteria | Highest-intent moment in real estate |
| Status-change alerts | Active → Pending → Sold | Client always informed |
| Property saves + notes | Favorites list client can share | Collaboration seed |
| Showing requests / home-value requests | In-app CTAs | Structured lead capture |

**Agent-facing:**
- **Contact database with enrichment** (they auto-append data to thin leads)
- **Engagement analytics** — who opened, clicked, saved, searched what
- **Nurture automations** — drip sequences, follow-up reminders, "hot lead" flags
- **Team management** — brokerages see everyone's pipeline
- **CRM integrations** (Follow Up Boss, kvCORE, etc.)

### 1.4 UX patterns worth stealing

1. **Digest emails with real cards** — photo, price, beds/baths, match score, one click to the listing. Not text blobs.
2. **"Why this home"** — the match engine explains itself (3 reasons). Explains = trusted = clicked.
3. **Zero-friction signup** — email + filters, no password wall. Confirm-by-email later.
4. **Manage alerts in one click** — every email links to pause/edit/unsubscribe. Compliance + trust.
5. **The search URL is the saved search** — their filters serialize into shareable URLs. (We already do this — `/properties/?city=&minPrice=&beds=&type=`.)

### 1.5 Where RealScout is weak (our openings)

1. **Generic national data** — their MLS data is the same 100 fields everyone has. They don't know Fort Collins. We have: 111 fields, schools, floodplain, CHFA, 27-community depth, local market content, actual agents.
2. **Expensive** — $100+/agent/mo. A NoCO agent needs: search + alerts + lead capture. We can undercut dramatically and still win.
3. **Cookie-cutter nurture** — automated drip emails feel robotic. Ours can be genuinely local ("the market moved 2% this month — here's what that means for your search").
4. **No product for the *buyer* beyond the agent's coat-tails** — their consumer is locked to one agent's brand. We can own the consumer search destination itself (saahomes.com) AND sell the engine to other agents.
5. **Lock-in** — clients belong to the agent, but the *platform* owns the relationship. We can be the platform the agent owns (or at least: our engine, their brand, no data hostage).

### 1.6 The strategic read for SAA

RealScout's pivot validates our thesis: **search is the acquisition engine; the alert/nurture system is the money printer.** For SAA it does double duty:
1. **Lead machine** — every alert signup is a lead; every digest email is a touchpoint; price-drop alerts are the highest-intent leads in real estate. This is the "get them talking" pillar automated.
2. **SEO flywheel** — search URLs, alert landing pages, and "new listings in X" pages all index.
3. **Future product** — every NoCO agent uses the same IRES feed. One integration, then white-label the whole engine. RealScout charges $100+/seat for what we can build once and license at a fraction.

---

## PART 2 — Build Plan: SAA Search & Alerts Engine

### 2.1 Vision

> A buyer lands on saahomes.com, searches Fort Collins, saves the search with their email. Every night they get a digest: new homes, price drops, status changes — with photos, prices, and match scores, all linking to our listing pages. Every search, click, and save is visible to Adam (and later, to the agent who owns that client). The system IS the lead pipeline: signup → FUB, digest → touchpoint, price-drop → hot lead.

### 2.2 What we already have (the head start)

- **Live feed + 29K listings, 111 fields** — incl. `original_list_price` + `price_change_timestamp` (price drops!), `days_on_market`, schools, home_type, floodplain
- **URL-param search format** — `?city=&minPrice=&maxPrice=&beds=&baths=&type=&sort=` — the saved-search schema already exists
- **Search UI + listing pages with CTAs** — every alert email links to a conversion-ready page
- **FUB pipeline** — `POST /api/contact` etc. → Follow Up Boss
- **Nightly sync cron** — the diff engine's data source

### 2.3 Architecture

```
Postgres: users · saved_searches · search_snapshots · alerts · email_log · agents (future)
    ▲                                                    │
    │ nightly diff job (node-cron on backend)            ▼
listings (synced nightly) ──► match engine ──► digest builder ──► email API ──► user inbox
                                    │
                                    └── alert events (new/price-drop/status) → FUB lead events
```

- **Backend**: extend the existing Express API (`/api/alerts/*`) + a nightly job (node-cron inside the backend — it lives on Railway with DATABASE_URL; needs `IRES_*` + email creds added to Railway env, one-time)
- **Email**: transactional API (recommend **Resend** — generous free tier, modern; or Postmark/SendGrid). Decision needed: existing SMTP vs dedicated provider. At 1 digest/user/night, even 10K searches/mo is pennies.

### 2.4 Data model

```sql
users              (id, email UNIQUE, name, status, created_at, last_active_at)
saved_searches     (id, user_id FK, name, filters JSONB /* our URL-param shape */,
                    is_active, created_at, last_run_at, last_email_at)
search_snapshots   (id, search_id FK, run_at, result_ids JSONB /* listing_ids matched */)
alert_events       (id, search_id FK, listing_id FK, type /* new|price_drop|status_change */,
                    detail JSONB /* old/new price, old/new status */, created_at)
email_log          (id, user_id, search_id, type, sent_at, opened_at, clicked_at, payload)
agents             (id, name, email, brand_slug, logo_url, tenant_key /* future multi-tenant */)
```

Every column earns its place; `search_snapshots` is what makes the diff engine work (compare today's matches vs yesterday's = "new"). `alert_events` is the audit trail + FUB feed.

### 2.5 Match engine

**Hard filters** (from the saved search): city(ies), min/max price, beds, baths, home_type (detached/attached/land), sqft, year-built, HOA, schools (bonus field — no competitor has school filters).

**Soft ranking + match score (0–100):**
- 40 pts — hard-filter fit (all-or-nothing)
- 20 pts — price proximity (closest to the saved range's sweet spot)
- 15 pts — home_type/subtype exactness
- 10 pts — school match (saved search had a school → matches get more)
- 10 pts — recency (newer = hotter)
- 5 pts — neighborhood signal (subdivision/MLS area proximity)

**"Why this home"** — top 3 reasons rendered in the email + on the listing page ("Matches your Fort Collins search · $8K under your max · New today"). Transparent scoring = trust = clicks. We can even show it on listing pages as a conversion hook ("You're 94% match for this home — save your search to get alerts").

### 2.6 Notification types (the RealScout set)

| Type | Trigger | Cadence |
|---|---|---|
| **New listing** | listing appears in a saved search's results | nightly digest |
| **Price drop** | `original_list_price > list_price` (we already track this!) | **immediate** (within the hour — the lead is hot) |
| **Status change** | Active → Pending/Closed on a saved/favorited listing | immediate or digest |
| **Saved-home update** | any change to a favorited listing | digest |
| **Market nudge** (our differentiator) | "3 homes matched your search this week; median price in Loveland moved -1.2%" | weekly |

Price-drop = **immediate email**. That's the killer feature: "The home you're watching just dropped $25K." Nobody in NoCO does this locally.

### 2.7 Email flow

- **Digest email** (nightly ~6 AM MT): "3 new homes in Fort Collins match your search" — HTML cards: photo (R2-hosted!), price + $/sqft, beds/baths, home_type, match score badge, **"Why this home" line**, button → listing page. Footer: manage alerts · pause · unsubscribe. Branded SAA header.
- **Price-drop alert** (immediate): single listing, before/after price, % off, CTA.
- **Manage page** (`/alerts/manage?token=…`): list all searches, edit filters (reuses the search UI!), pause/resume, delete, change email frequency. Token in the email (no login needed — low friction, still secure enough with unguessable tokens).
- **Unsubscribe**: one-click + link in every email (CAN-SPAM compliant).

### 2.8 Lead engine (the point)

- Signup → `users` row + **FUB lead** (source: "Saved Search Alert", tags: search criteria) — reuse the existing contact pipeline
- Every digest email = a touchpoint; opens/clicks tracked (`email_log`)
- Price-drop alert + open = **hot lead flag** in FUB ("Adam, call now")
- Agent cockpit (Phase 2): Adam sees every user's searches + activity — this is the "which buyers are serious" dashboard

### 2.9 Phases

**Phase 1 — Core (SAA only):** users + saved_searches + nightly diff + digest emails + price-drop immediate alerts + manage/unsubscribe + FUB sync. (~2 weeks)
**Phase 2 — Engagement:** open/click tracking, match scores + "why this home" on listing pages, favorites, sharing links, weekly market nudge email. (~1–2 weeks)
**Phase 3 — Agent cockpit:** dashboard for Adam (users, searches, activity, hot leads), export, notes. (~1 week)
**Phase 4 — Productization (competing product):** `agents` table + tenant branding (logo/subdomain), same engine, per-agent pricing, billing (Stripe), onboarding flow. Sell to NoCO agents at a fraction of RealScout. The IRES integration we already built is the moat — every local agent needs it, none have built it.

### 2.10 Open decisions for Adam

1. **Email provider**: Resend (recommended) vs Postmark vs existing SMTP — I'll set up whichever you prefer
2. **Where the nightly job runs**: on Railway (needs `IRES_ACCESS_TOKEN` + email creds added to Railway env — one-time) vs local cron like the listing sync
3. **Immediate price-drop emails**: yes/no for the first release (I recommend yes — it's the differentiator)
4. **Phase 4 timing**: build the engine with multi-tenant in mind (cheap now) but don't productize until Phases 1–3 are proven with real SAA leads

---

*This document is the blueprint. On approval of the open decisions, Phase 1 starts.*
