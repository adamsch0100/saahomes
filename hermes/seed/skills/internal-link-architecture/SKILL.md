---
name: internal-link-architecture
description: Map and optimize internal link equity flow to Schwartz and Associates money pages for Northern Colorado SEO.
---

# Internal Link Architecture

## Goal
Every page should link to money pages within 3 clicks. Area pages, blog, and program pages feed `/for-sellers/`, `/for-buyers/`, `/contact/`.

## Steps

1. **Inventory** (from sitemap + repo)
   - List all indexable URLs by type: area, blog, program, static
   - Identify orphan pages (no internal links in)

2. **Equity map**
   - Homepage → should link to: top 6 cities, /for-sellers/, /for-buyers/, CHFA hub
   - Each area page → should link to: /for-buyers/, /for-sellers/, 2–3 nearby cities
   - Each blog → should link to: 1 relevant area page + 1 money page minimum
   - CHFA cluster → cross-link each program + link to Fort Collins/Windsor area pages

3. **Anchor text plan**
   - Use natural varied anchors: "{city} homes for sale", "sell your home in {city}", "Northern Colorado buyer guide"
   - Avoid exact-match spam patterns

4. **Gap analysis**
   - Blog posts with zero area page links
   - Area pages missing nearby city cross-links
   - Program pages not linking to high-growth cities (Timnath, Severance, Carbon Valley)

5. **PR proposal**
   - Specific file edits in saahomes repo with anchor text + target URL

## Output

```
🔗 Internal Link Plan — [date]

Orphans found: [list]

Priority link additions (top 10)
| Source page | Target | Anchor | File to edit |

Hub pages needing more inbound links
- /for-sellers/: [count] — need +X from blog/areas
```

## Constraints
- Max 8–12 internal links added per page (don't overload)
- User approval before PR merge
