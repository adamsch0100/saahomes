---
name: schema-technical-audit
description: Monthly technical + schema audit for saahomes.com — JSON-LD, indexation, sitemap, CWV, and crawl hygiene.
---

# Schema & Technical SEO Audit

## Scope
Full site technical health for Schwartz and Associates lead generation.

## Checklist

### Sitemap & indexation
- [ ] Fetch https://saahomes.com/sitemap.xml — count URLs vs expected (~19 areas + static + blog)
- [ ] All P0 URLs present
- [ ] spot-check 10 URLs: return 200, canonical self-referencing
- [ ] robots.txt allows key paths

### Schema (sample 5 area pages + homepage + CHFA page)
- [ ] RealEstateAgent on homepage/local pages
- [ ] WebSite + SearchAction on homepage
- [ ] WebPage + Place + BreadcrumbList on area pages
- [ ] No JSON-LD syntax errors (validate structure)
- [ ] NAP matches seoConstants.js exactly

### Prerender / SPA
- [ ] View source on 3 pages — meta title/description in static HTML (not JS-only)
- [ ] og: tags present

### Performance (PSI or CrUX)
- [ ] Mobile CWV on /for-sellers/, /fort-collins area page, /chfa-down-payment-assistance/
- [ ] Flag LCP >2.5s or CLS >0.1

### Security / hygiene
- [ ] HTTPS everywhere
- [ ] No accidental noindex on money pages
- [ ] No duplicate titles across area pages (check areaSeo.js)

## Output

```
🔧 Technical Audit — [date]

Pass: X/Y checks

Critical fixes
1. ...

Schema improvements
1. ...

Performance
| URL | LCP | CLS | Action |

Repo changes needed
- file:line — description
```
