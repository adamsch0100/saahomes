---
name: blog-pipeline
description: Generate monthly content calendar and outlines for SAA Homes blog targeting Northern Colorado buyer/seller keyword gaps.
---

# Blog Content Pipeline

## Goal
2–4 posts/month that capture Tier B/C queries and internal-link to area pages + money pages.

**Master calendar:** `context/content-calendar.md` — pillars, blog vs social matrix, monthly market snapshot spec.

## Step 1 — Gap identification
Sources:
- GSC queries with impressions >50, position >10, no dedicated page
- competitor-content-watch findings
- keyword-universe.md gap topics
- Cities lacking seller-specific or buyer-specific guide

## Step 2 — Prioritize topics
Score each idea:
- Lead potential (buyer/seller intent) ×3
- Ranking feasibility ×2
- Internal link value to area pages ×2
- Uniqueness (CHFA, local expertise) ×1

## Step 3 — Calendar (next 30 days)

For each post provide:
- **Title** (SEO, includes city or "Northern Colorado" where relevant)
- **Primary query** target
- **Slug** suggestion (match blogPosts.js pattern)
- **Outline** (H2s with local specifics required)
- **Internal links:** 2 area pages + 1 money page + 1 program page if relevant
- **CTA:** contact / market report / CHFA form
- **Word count target:** 1200–2000 (comprehensive, not thin)
- **Publish date** suggestion

## Backlog topics (maintain rolling list)

### Seller guides (→ /for-sellers/)
- How to sell your home in Windsor CO (2026)
- Loveland seller's guide: pricing + timing
- Greeley/Weld County seller market update template

### Buyer guides (→ /for-buyers/ + areas)
- First-time buyer guide: Timnath & Severance new construction
- Carbon Valley buyer guide: Firestone vs Frederick
- Fort Collins vs Loveland: where to buy in 2026

### Program + local
- CHFA eligibility by Weld vs Larimer income limits
- **Monthly Northern Colorado market snapshot** (required 1×/month — see content-calendar.md)

### Social-only topics (do NOT blog unless major news)
- Local events, holidays, weekly market pulse one-liners → `social-post-pack` on Wed cron only

### Comparison / long-tail
- Wellington vs Fort Collins affordability
- Boulder County vs Weld County: where your money goes further

## Output

```
📅 Content Calendar — [month year]

Week 1: [title] — target: [query] — links: [urls]
Outline: ...

Week 2: ...

Backlog: [5 ideas]

Repo action: Add to blogPosts.js, ship via autonomous-execute, notify Adam with live URL, then **email social-post-pack** same week.
```

## After publish

**Full checklist:** `context/repo-maintenance-checklist.md` sections A + B (market) + C (social).

### All blog posts
1. ✅ DONE Telegram with URL
2. `social-post-pack` → include `post_by` + `operator_schedule` → `send-social-post-pack.py`
3. Update MEMORY `## Content calendar state` (dates, pillar, hooks)

### Monthly market update posts (category: Market Update)
4. Set `export const LATEST_MARKET_UPDATE_SLUG = '{new-slug}'` at top of `blogPosts.js`
5. Add `supersededBy: LATEST_MARKET_UPDATE_SLUG` to **every** older Market Update post
6. Add `relatedLinks` on superseded posts pointing to the new URL
7. Update MEMORY: `monthly_market_blog_url`, `latest_market_update_slug`
8. No edits needed to `LatestMarketUpdateBanner.jsx` — it reads the slug constant automatically

### Slug naming for market posts
`northern-colorado-market-update-{month}-{year}` (e.g. `northern-colorado-market-update-july-2026`)

## Constraints
- Fair Housing compliant
- Cite CHFA/HUD for program claims with year
- Publish per USER.md (autonomous when in calendar) — no thin posts
