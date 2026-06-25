---
name: indexation-rescue
description: Detect and diagnose indexation loss on Schwartz and Associates money pages and area guides before rankings collapse.
---

# Indexation Rescue

## Daily patrol (rotating checks)

### P0 URLs — check every day (rotate through site: search or GSC URL inspection)
- https://saahomes.com/for-sellers/
- https://saahomes.com/for-buyers/
- https://saahomes.com/contact/
- https://saahomes.com/chfa-down-payment-assistance/
- https://saahomes.com/northern-colorado-areas/fort-collins/
- https://saahomes.com/northern-colorado-areas/loveland/
- https://saahomes.com/northern-colorado-areas/windsor/
- https://saahomes.com/northern-colorado-areas/greeley/

### P1 — rotate 3 area pages per day from remaining 15 cities

## Detection methods (use best available)
1. GSC URL Inspection API — preferred
2. `site:saahomes.com/path` web search
3. Fetch URL — check 200, no noindex meta, canonical correct

## If indexation lost — diagnose
- robots.txt block?
- noindex tag added?
- 404/500?
- Canonical pointing elsewhere?
- Redirect chain?
- Sitemap missing URL?
- Recent deploy regression?

## Response playbook
| Cause | Fix |
|-------|-----|
| noindex on prerender | Fix prerender-meta / SEO component → PR |
| Missing sitemap entry | Add to siteRoutes.js → PR |
| Soft 404 thin content | Expand area page content |
| Canonical error | Fix canonical in SEO.jsx / AreaSEO |
| Crawl budget (rare) | Internal links + request indexing in GSC |

## Output (only on issues or weekly summary)

```
🚨 Indexation Alert — [date]

LOST
- [URL] — was indexed [date] — cause: [X] — fix: [Y]

OK (spot check)
- [X]/[Y] P0 pages indexed
```

Alert immediately on any P0 loss via Telegram.
