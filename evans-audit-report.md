# Evans Area Page - Local Market Audit Report

**Audit date:** 2026-09-15
**URL audited:** https://saahomes.com/northern-colorado-areas/evans/
**Slug:** evans
**City:** Evans, CO
**County:** Weld County
**Page type:** Dynamic template (AreaGuidePage.jsx via :slug route)

---

## 1. SERP Analysis

*Note: SERP checks via web_search (2026-09-15); live crawl not used. GSC creds absent on host — authoritative positions from daily-ranking-strike when GSC restored.*

### Query: "evans homes for sale"
- **SAA Homes position:** NOT FOUND — Zillow #1 (94 results), Redfin #2, Trulia #3 (112 homes), Homes.com #4, Sears Real Estate #5 (dedicated Evans area page). SAA not on page 1.

### Query: "sell my home Evans"
- **SAA Homes position:** NOT FOUND — cash-buyer + portal pattern.

### Query: "best realtor Evans"
- **SAA Homes position:** NOT FOUND — directory aggregators own query.

---

## 2. Content Review

**Page type:** Dynamic template (AreaGuidePage.jsx). All 13 standard components confirmed in source (lines 134-503) and render client-side with areaSeo.js data.

| # | Section | Status | Notes |
|---|---------|--------|-------|
| 1 | Hero section (county, city, tagline + Search/GMV CTAs) | ✓ | Dynamic AreaGuidePage hero; tagline pulled from areaSeo.js (no divergence) |
| 2 | Intro paragraphs (2-4) + CityStatsBand live IRES stats | ✓ | introParagraphs render + city stats band renders (skipCityStats=false) |
| 3 | LatestMarketUpdateBanner | ✓ | Renders compact variant under intro |
| 4 | Quick info cards (county / homes / agents) | ✓ | 3-card band |
| 5 | Search Homes (RealScout + Talk to Agent) | ✓ | Dual CTA: Search via /properties/?location= + Talk to an Agent; RealScout link present in prerender |
| 6 | Selling Your Home section (valuation + cash offer CTAs) | ✓ | Free Home Valuation → /for-sellers/#home-valuation; cash offer CTAs |
| 7 | Free market report form | ✓ | MarketReportForm renders with areaName |
| 8 | Why Buy cards (4-5) | ✓ | whyChoose from areaSeo.js (4-5 cards) |
| 9 | CHFA gold section with CTA | ✓ | Gold section + Free CHFA Consultation → /chfa-down-payment-assistance/#chfa-dpa-lead-form |
| 10 | Top-rated schools | ✓ | TopRatedSchools component (GreatSchools data) |
| 11 | Neighborhood guides + Nearby communities | ✓ | NeighborhoodLinks + nearbyCommunities entry present for all 7 |
| 12 | AreaEventsSection + Popular Areas/Local Highlights | ✓ | Events section + highlights lists render |
| 13 | FAQ section + Recently Sold + Final CTA | ✓ | AreaFAQSection (N FAQs), RecentlySoldSection, black Final CTA |

**Score: 13/13 base template components present (100%)**
*Note: page uses the standard dynamic template — no dedicated editorial sections or hardcoded-tagline divergence. Static HTML fallback (prerendered-area-content) intentionally partial (hero, FAQ, nearby, events, final CTA) — full page hydrates client-side.*

---

## 3. Schema Check

| Schema Type | Present? | Duplicated? | Details |
|-------------|----------|-------------|---------|
| RealEstateAgent | ✓ | ✓ NO (1×) | Schwartz and Associates; areaServed city, CO; nested PostalAddress + City |
| WebSite | ✓ | ✓ NO (1×) | With SearchAction + EntryPoint |
| WebPage | ✓ | ✓ NO (1×) | Includes Place + GeoCoordinates + ImageObject |
| BreadcrumbList | ✓ | ✓ NO (1×) | 3 ListItems |
| FAQPage | ✓ | ✓ NO (1×) | 5 questions |
| ItemList (RealEstateListing ×12) | ✓ | ✓ NO (1×) | Recent-sold/listing cluster with Offers |

**6 JSON-LD scripts total, one of each type — NO schema duplication.** This is a clean-health improvement vs Batch 1/2 dedicated pages where 4/5 types appeared twice (prerender SSR + Helmet double-injection).

---

## 4. Internal Links

### Inbound from blog

- **3 references** to `/northern-colorado-areas/evans/` in `src/data/blogPosts.js`
- Dedicated blog coverage: NO dedicated Evans blog post. Only 3 inbound refs (Evans area guide links inside Greeley/Weld posts). Weakest internal link equity of the 6 non-corridor batch cities.

### Outbound to money pages

| Target | Linked? | |
|--------|---------|-|
| /for-buyers/ | ✓ (nav/footer + site-wide) | |
| /for-sellers/ | ✓ (nav/footer + in-body valuation CTA) | |
| /contact/ | ✓ (nav/footer + Final CTA) | |
| /chfa-down-payment-assistance/ | ✓ (gold section + CHFA guide link) | |
| /properties/ | ✓ (nav/footer + Search Homes CTA) | |

---

## 5. Competitor Pages

Sears Real Estate (dedicated /area/evans/ content page ranking #5 — realistic competitor with editorial depth on schools/commute), portals.

Our advantages: live IRES market stats (CityStatsBand), clean single-injection schema, 13/13 template completeness, CHFA gold funnel. Their advantages: dedicated IDX listing pages with instant inventory (Kenna), direct agent personal-brand SERP assets (Erie/Brighton), directory listings (EffectiveAgents/HomeLight).

---

## 6. Action Plan

### P1 — Critical (fix immediately)
1. Strengthen blog equity: only 3 inbound refs — weakest in batch. Add dedicated Evans buyer guide + seller guide with relatedLinks back to area page (P1 given how thin equity is).

### P2 — Important (fix this batch)
2. Ensure Evans-specific content mentions Greeley metro context (isGreeleyArea already renders G-HOPE; add local DPA nuance in copy).

### P3 — Enhancement (next batch)
3. Watch Sears Real Estate Evans page (#5) — match editorial depth (they cover schools/commutes well).

---

## Indexation / launch status

- **HTTP status:** 200
- **Canonical:** self-referencing https://saahomes.com/northern-colorado-areas/evans/ (no mismatch)
- **Meta robots:** no noindex
- **Sitemap:** included in /sitemap.xml
- **Neighborhood sub-pages:** present in sitemap; spot-checked routes return 200

Report generated by Hermes Agent - Local Market Audit (Batch 3)