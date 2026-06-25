---
name: blog-pipeline
description: Generate monthly content calendar and outlines for SAA Homes blog targeting Northern Colorado buyer/seller keyword gaps.
---

# Blog Content Pipeline

## Goal
2–4 posts/month that capture Tier B/C queries and internal-link to area pages + money pages.

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
- Monthly Northern Colorado market snapshot (recurring)

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

Repo action: Add to blogPosts.js on approved branch
```

## Constraints
- Fair Housing compliant
- Cite CHFA/HUD for program claims with year
- No publish without Adam approval — deliver outlines/PRs only
