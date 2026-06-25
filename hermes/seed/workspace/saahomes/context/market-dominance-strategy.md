# Market Dominance Strategy — Schwartz and Associates

## The goal

**Be the name Northern Colorado thinks of when buying or selling a home online.**

Not "rank for some keywords." **Own the full demand capture system** for Larimer, Weld, and Boulder county real estate search.

---

## Four pillars

### Pillar 1 — Local organic search (primary)
- **19 city hub pages** at `/northern-colorado-areas/{slug}/` — each must rank for buyer AND seller intent in that city
- **Hub-and-spoke internal linking:** every blog post, program page, and area page links to `/for-buyers/`, `/for-sellers/`, or `/contact/`
- **Program cluster dominance:** CHFA DPA, Schools to Home, Champions — capture first-time and niche buyer searches nationally unique to Colorado
- **Long-tail blog offense:** 2–4 posts/month targeting queries competitors rank for that we don't

### Pillar 2 — Google Business Profile + local pack
- NAP consistency with `seoConstants.js` everywhere (site, GBP, directories)
- GBP categories: Real Estate Agent, Real Estate Agency
- Review velocity + response (Adam/Mandi — Hermes monitors and prompts)
- GBP posts when content ships — Hermes emails post pack; Adam publishes manually
- Photos tied to site/blog heroes + YouTube @SAAHomes

### Pillar 3 — On-site conversion (where traffic becomes leads)
- Every high-intent page has **above-the-fold CTA** matched to intent:
  - Buyer pages → search properties + contact + CHFA where relevant
  - Seller pages → **free market report** (highest-value seller lead magnet)
  - Area pages → dual CTA (buying here? / selling here?)
- Mobile-first: FloatingContactBar, click-to-call (970) 999-1407
- Form → PostgreSQL → Follow Up Boss pipeline must never break (daily health check)

### Pillar 4 — Entity + trust (E-E-A-T for YMYL real estate)
- RealEstateAgent schema on site + per-area pages
- Adam & Mandi bios, testimonials, Coldwell Banker affiliation visible
- Consistent brand: "Schwartz and Associates" + "SAA Homes" + local phone
- No anonymous AI content — expert local voice, dated updates, cite CHFA/HUD for programs

---

## Query tiers (prioritize effort)

### Tier S — Must win (weekly monitoring)
| Pattern | Example | Money page |
|---------|---------|------------|
| `{city} realtor` | Fort Collins realtor | Area page |
| `{city} real estate agent` | Loveland real estate agent | Area page |
| `{city} homes for sale` | Windsor homes for sale | Area page + /properties/ |
| `sell my home {city}` | sell my home Fort Collins | Area page + /for-sellers/ |
| `{city} CO real estate` | Greeley CO real estate | Area page |

### Tier A — High value (bi-weekly)
| Pattern | Example | Money page |
|---------|---------|------------|
| CHFA + location | CHFA down payment assistance Fort Collins | CHFA pages |
| Moving to {city} | moving to Timnath Colorado | Area page |
| Best realtor {city} | best realtor Fort Collins | Area page + testimonials |
| {city} home values | Windsor home values | /for-sellers/ + area |

### Tier B — Growth (monthly content)
| Pattern | Example |
|---------|---------|
| Neighborhood long-tail | Old Town Fort Collins homes |
| New construction | Timnath new construction homes |
| Compare cities | Fort Collins vs Loveland cost of living |
| Program niches | teacher home loan Colorado |

### Tier C — Feed the cluster (blog pipeline)
Informational queries that internal-link to Tier S/A pages.

---

## Competitive moat (why we win vs portals and other brokers)

| Competitor type | Their weakness | Our angle |
|-----------------|----------------|-----------|
| Zillow/Realtor.com | No local expert, lead reselling | Named agents, local guides, direct contact |
| National franchises | Generic content | 19 hyper-local area pages + video |
| Solo agents with weak SEO | Thin sites | Full program cluster + prerender + schema |
| Teams without CHFA depth | Miss program traffic | Dedicated CHFA hub (already built) |

---

## 90-day execution phases

### Days 1–14: Instrument + baseline
- Install all cron jobs
- GSC + GA4 connected
- Baseline scorecard for 19 cities
- Fix any indexation blockers on P0 pages
- Form API health verified

### Days 15–45: Quick strikes
- Title/meta CTR optimization on top 20 GSC queries (impressions >100, CTR below benchmark)
- Internal link injection: every blog → 2 area pages + 1 money page
- Expand thin area pages (Berthoud, Firestone, Frederick, Evans, Severance, Niwot have rich content — match that depth on thinner pages)
- 4 new blog posts targeting Tier B gaps

### Days 46–90: Compound
- Monthly city rotation deep audits (delegation)
- Schema enrichment where missing
- GBP optimization pass
- Conversion tests on /for-sellers/ and top 5 area pages
- Competitor content response within 7 days of their new publish

---

## Anti-patterns (never do)

- Mass-generate 100 near-duplicate city/neighborhood pages
- Keyword stuff meta tags or H1s
- Fake urgency on market stats
- Steer by protected class (Fair Housing)
- Auto-publish outreach without Adam `approved`
- Use Browserbase for social posting (email post packs only)
- Buy links or use PBNs

---

## Success metrics (report monthly)

| Metric | Target direction |
|--------|------------------|
| Tier S queries in top 10 | ↑ count across 19 cities |
| Organic leads (forms) | ↑ MoM |
| GSC impressions (non-branded) | ↑ |
| Indexed money pages | 100% of sitemap P0/P1 |
| Area page avg position (buyer+seller query) | ↓ (better rank) |
| Mobile CWV pass rate | ↑ |
| GBP actions (calls, directions) | ↑ |
