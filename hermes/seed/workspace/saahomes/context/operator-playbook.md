# Operator Playbook — Adam + Hermes

**One-page mental model:** Hermes runs the SEO/content machine 24/7. Adam handles **human-only** work: lead follow-up, outreach approval, and **~5 min social paste** from email packs. Everything else ships autonomously.

Read weekly. Hermes reads this every Monday war room.

---

## The machine (four layers)

```
┌─────────────────────────────────────────────────────────────┐
│  LAYER 1 — DEMAND CAPTURE (Hermes autopilot)                │
│  SEO · GEO · area pages · blog · schema · indexation · CRO  │
│  → merges PRs · deploys saahomes.com · reports ✅ DONE       │
└─────────────────────────────────────────────────────────────┘
                              ↓ traffic
┌─────────────────────────────────────────────────────────────┐
│  LAYER 2 — CONVERSION (Hermes monitors · Adam/Mandi close)  │
│  Forms → PostgreSQL → Follow Up Boss · GA4 generate_lead    │
│  Hermes NEVER emails/texts leads as Adam                    │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  LAYER 3 — AUTHORITY (split)                                │
│  Hermes: content + citations research + outreach DRAFTS     │
│  Adam: approve outreach · paste social · respond reviews    │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  LAYER 4 — INTEL (optional Browserbase + browse.sh)         │
│  Zillow/Realtor/Walk Score data for area pages & blogs      │
│  NOT for GBP/Meta login or social posting                   │
└─────────────────────────────────────────────────────────────┘
```

Full strategy: `market-dominance-strategy.md` · Autopilot rules: `automation-policy.md`

---

## Adam's weekly rhythm (~30 min total)

| When | What | Time |
|------|------|------|
| **Monday email** | Hermes sends **weekly operator schedule** — day-by-day checklist for the week | 1 min read |
| **Daily** | Skim Telegram only if digest or ✅ DONE | 0–2 min |
| **When email arrives** | Social post pack → Meta + GBP + X (within 48h) | 5 min |
| **Every Wednesday** | Weekly social post pack email — **post same day if possible** | 5 min |
| **Thursday** | Approve 0–2 outreach drafts (`approved` / `edit:` / `skip`) | 5–10 min |
| **Monday (optional)** | Read weekly war room on Telegram — rankings, leads, blockers | 10 min |
| **Ongoing** | Follow Up Boss — call/text **form leads** (Hermes does not) | Your core job |

**Two email types from Hermes:**
1. **Monday — "Your week"** schedule (when to do what)
2. **On deploy + Wednesday — "Social posts"** pack (copy-paste captions + images)

If you're spending more than ~30 min/week on Hermes ops, something is wrong — tell Hermes to fix the process.

---

## Manual social — doing it correctly

Hermes emails **adam@saahomes.com** a post pack when content ships or on weekly cron.

### When you get the email

1. **Read the promoted URL** — open it, confirm page looks good live
2. **Meta Business Suite** (business.facebook.com or app)
   - Create post → select **Facebook + Instagram**
   - Paste **Instagram caption** (image required — use attached file)
   - Paste **Facebook caption** (can match IG or use FB-specific block from email)
   - Upload **attached hero image** (same as site — never swap for random stock)
   - Schedule or publish now
3. **Google Business Profile** (app or business.google.com)
   - New update → paste **GBP caption**
   - Add **same image**
   - Button/link → saahomes.com page from email
4. **YouTube / X** — only if included in email; paste description or tweet text
5. **Optional:** reply `posted` on Telegram so Hermes logs it

### Social quality checklist (you)

- [ ] Link goes to correct saahomes.com page (not homepage unless intended)
- [ ] Image matches real site content (no AI fake homes)
- [ ] No guaranteed outcomes or Fair Housing issues
- [ ] Phone/brand consistent: Schwartz and Associates · (970) 999-1407
- [ ] IG has an image; GBP has image when possible

### Do NOT

- Use Browserbase to post (deprecated for social — email only)
- Skip posting for 2+ weeks when Hermes sends packs (local pack + social signals decay)
- Post identical spam across 10 groups — GBP + Meta only

---

## Outreach — doing it correctly

Hermes sends **OUTREACH REVIEW** on Telegram (cold emails to blogs, HARO, partners).

| Reply | Meaning |
|-------|---------|
| `approved` | Hermes sends once via SMTP |
| `edit: [changes]` | Hermes revises and re-submits |
| `skip` | Archive — no send |

You are the quality gate for **external email as Adam**. Hermes never sends without `approved`.

---

## Lead capture — doing it correctly (Adam/Mandi only)

This is the revenue layer. Hermes optimizes pages; **you close leads**.

| Lead source | Your action |
|-------------|-------------|
| Contact form | FUB notification → call/text within business hours |
| Market report | High-intent seller — prioritize same day |
| CHFA / program forms | Buyer nurture — program accuracy matters |
| Phone (970) 999-1407 | Always answer or callback fast |

**Verify once (you):** GA4 Admin → `generate_lead` marked as **key event**. Check Realtime after a test form submit.

Hermes crons watch form API health — if you see a Telegram alert, treat as P0.

---

## Browserbase + browse.sh — when to use

| Tool | Use for | Do NOT use for |
|------|---------|----------------|
| **browse.sh skills** | Zillow/Realtor listings, Walk Score, school data, YouTube transcripts → enrich area pages & blogs | Posting social · scraping PII |
| **Browserbase** | Running browse.sh on Railway when sites block headless IP | GBP/Meta login · social publish |

Hermes installs browse.sh skills on first boot (`skills-registry.md`). Browserbase free tier (~1 hr/mo) is enough for occasional market intel — not daily scraping.

**No action required from you** unless Hermes reports Browserbase blocked or out of minutes.

---

## Hermes autopilot (no Adam action needed)

- Meta titles, schema, internal links, area page expansions
- Blog posts from content calendar (publish + deploy)
- GSC-driven fixes, indexation rescue, competitor content response
- Daily/weekly SEO reports, GEO citation audits
- Social post pack **draft + email** (your paste is the only manual step)
- GBP/NAP audit drafts (included in email pack)

---

## Integration health (set once, forget)

| Integration | Status check |
|-------------|--------------|
| OpenCode Go | Hermes responds on Telegram |
| Telegram | ✅ DONE messages arrive |
| GitHub + Railway | SEO PRs merge → saahomes.com updates |
| GSC service account | Hermes ranking reports mention GSC data |
| GA4 `G-CB5GL0P3EZ` (stream `G-BVWCZE025P`) | Realtime + generate_lead events |
| SMTP `OUTREACH_SMTP_*` | Outreach + social post pack emails arrive |
| Browserbase (optional) | Boot log or `repair-browserbase.sh` OK |
| Follow Up Boss | Backend env — form test hits FUB |

Log status in MEMORY.md `## Integration status`. Hermes updates when things break.

---

## Am I doing this right? (monthly self-check)

| Question | Good sign |
|----------|-----------|
| Is organic traffic trending up in GA4? | Sessions to area pages + for-sellers/up |
| Are we getting form leads from SEO pages? | generate_lead events by lead_type |
| Are Tier S cities climbing in GSC? | Hermes weekly war room shows ↑ top 10 count |
| Am I pasting social packs within 48h? | GBP + Meta stay active |
| Am I approving outreach promptly? | Thursday review takes <10 min |
| Am I calling market report leads fast? | FUB speed-to-lead |
| Is Hermes shipping without me asking? | Regular ✅ DONE on Telegram |

If 5+ are yes → system is working. If leads flat but rankings up → CRO pass (Hermes `conversion-surge`). If rankings flat → content/indexation pass (Hermes `content-gap-review`).

---

## Tell Hermes (copy/paste after redeploy)

```
Read context/operator-playbook.md and context/repo-maintenance-checklist.md. This is our master process.

Social: email post packs only — no Browserbase for GBP/Meta. Include post_by + operator_schedule in every pack.
Weekly: email operator schedule every Monday via send-operator-weekly-email.py.
Market updates: update LATEST_MARKET_UPDATE_SLUG + supersededBy on old posts every month.
Browserbase + browse.sh: market intel for content only.
Outreach: OUTREACH REVIEW → I reply approved before send.
Leads: I handle FUB — you never contact form submitters.

Install all 21 cron jobs from automation-registry.md. Execute the machine. Notify on ✅ DONE.
```

---

## Success = best-in-class local lead machine

**Not** vanity rankings alone. Win when:

1. **Non-branded** Northern Colorado buyer/seller queries → saahomes.com top 10
2. **Local pack** presence for Fort Collins, Loveland, Windsor, Greeley
3. **Form leads** from `/for-sellers/`, area pages, CHFA cluster ↑ MoM
4. **AI/GEO** citations for Tier S questions (Hermes `geo-citation-audit`)
5. **Authority** — ethical backlinks from Adam-approved outreach compounding

Hermes owns 1, 3 (site side), 4, and research for 5. Adam owns lead close, outreach approval, social paste, reviews/reputation.
