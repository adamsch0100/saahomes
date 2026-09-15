# Erie Area Page - Local Market Audit Report

**Audit date:** 2026-09-15
**URL audited:** https://saahomes.com/northern-colorado-areas/erie/
**Slug:** erie
**City:** Erie, CO
**County:** Weld & Boulder Counties
**Page type:** Dynamic template (AreaGuidePage.jsx via :slug route)

---

## 1. SERP Analysis

*Note: SERP checks via web_search (2026-09-15); live crawl not used. GSC creds absent on host — authoritative positions from daily-ranking-strike when GSC restored.*

### Query: "erie homes for sale"
- **SAA Homes position:** NOT FOUND — Realtor.com #1 (417 homes, $699K median), Zillow #2, Redfin #3, Trulia #4, Homes.com #5. SAA not on page 1.

### Query: "sell my home Erie"
- **SAA Homes position:** NOT FOUND — portal pattern.

### Query: "best realtor Erie"
- **SAA Homes position:** NOT FOUND — individual agent pages own query: #1 Brandy Unruh (Compass), #2 Brie Fowler (The Agency — Rate My Agent Awards, 5280 Top Producer), #3 Cameron Howard (luxury, $1M+), #4 Lindsey Sampier Baker, #5 Luginbill Homes. SAA absent.

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
| FAQPage | ✓ | ✓ NO (1×) | 3 questions |
| ItemList (RealEstateListing ×12) | ✓ | ✓ NO (1×) | Recent-sold/listing cluster with Offers |

**6 JSON-LD scripts total, one of each type — NO schema duplication.** This is a clean-health improvement vs Batch 1/2 dedicated pages where 4/5 types appeared twice (prerender SSR + Helmet double-injection).

---

## 4. Internal Links

### Inbound from blog

- **27 references** to `/northern-colorado-areas/erie/` in `src/data/blogPosts.js`
- Dedicated blog coverage: STRONG: buying-a-home-in-erie + selling-your-home-in-erie exist; 27 blog refs (highest in batch); market update + neighborhood blog cluster links. Neighborhood sub-pages cross-link from posts (old-town-erie, vista-ridge-erie, colliers-hill-erie, erie-commons, flatiron-meadows-erie, erie-highlands, compass-erie, creekside-erie).

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

Individual Erie agents with polished personal sites (Compass/The Agency/eXp) own 'erie realtor'. Moving-to-Erie SERP: competitor relocation guides (youranthemhome, maryhillproperties, clrealtygroup, coloradohomesource, dwellingscolorado) — SAA has no moving-to-Erie post.

Our advantages: live IRES market stats (CityStatsBand), clean single-injection schema, 13/13 template completeness, CHFA gold funnel. Their advantages: dedicated IDX listing pages with instant inventory (Kenna), direct agent personal-brand SERP assets (Erie/Brighton), directory listings (EffectiveAgents/HomeLight).

---

## 6. Action Plan

### P1 — Critical (fix immediately)
1. Create 'moving-to-erie-colorado' blog post — moving-to-Erie SERP owned by 5 competitor relocation guides; SAA absent with no dedicated post despite 27 refs.

### P2 — Important (fix this batch)
2. No structural fixes — launch is healthy. Consider an Erie market update post cadence to compete with individual-agent content farms.

### P3 — Enhancement (next batch)
3. Push personal-brand/social proof for Erie query (testimonials, reviews) — 'best realtor Erie' is dominated by individual agent sites with reviews/awards.

---

## Indexation / launch status

- **HTTP status:** 200
- **Canonical:** self-referencing https://saahomes.com/northern-colorado-areas/erie/ (no mismatch)
- **Meta robots:** no noindex
- **Sitemap:** included in /sitemap.xml
- **Neighborhood sub-pages:** 20 neighborhood sub-pages in sitemap (old-town-erie, vista-ridge-erie, colliers-hill-erie, wildgrass-erie, westerly-erie etc.); spot-checked 200 OK.

Report generated by Hermes Agent - Local Market Audit (Batch 3)