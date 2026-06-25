---
name: local-market-audit
description: Deep local SEO audit for one Northern Colorado city — SERP, area page, schema, competitors, and lead CTA alignment for Schwartz and Associates.
---

# Local Market Audit — Single City

## Input
City slug from keyword-universe.md (e.g. `windsor`) OR city name.

## Steps

1. **Load target URL:** `https://saahomes.com/northern-colorado-areas/{slug}/`

2. **SERP check** (SerpAPI/web search) for:
   - `{city} homes for sale`
   - `{city} realtor`
   - `sell my home {city}`
   Record top 5 domains + our position.

3. **On-page audit**
   - Title, H1, meta description unique and intent-matched?
   - Word count vs top 3 competitors (are we thinner?)
   - Buyer + seller CTAs visible on mobile?
   - Internal links to `/for-buyers/`, `/for-sellers/`, related cities?
   - Schema: WebPage, BreadcrumbList, RealEstateAgent with areaServed?

4. **Technical**
   - Page in sitemap.xml?
   - Canonical correct?
   - PageSpeed mobile score (PSI API if available)
   - Prerender meta present in static HTML?

5. **Competitive gap**
   - What do top 3 local results cover that we don't?
   - Neighborhoods, schools, market stats, FAQs, video?

6. **Lead alignment**
   - Does page match buyer vs seller intent for primary query?
   - Market report CTA for seller-intent traffic?

7. **Scorecard row** (update MEMORY.md)

## Output

```
📍 Local Market Audit: {City}, CO — [date]

SERP snapshot
| Query | Our pos | #1 competitor | Gap |
|-------|---------|---------------|-----|

Page health: [score /10]

Top 3 fixes (lead-weighted)
1. ...
2. ...
3. ...

PR-ready changes (if any)
- [ ] Update areaSeo.js description for ...
- [ ] Add FAQ section targeting ...
```

## Delegation mode
When auditing multiple cities, spawn one subagent per city with this skill. Merge into monthly scorecard.
