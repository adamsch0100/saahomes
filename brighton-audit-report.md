# Brighton Area Page - Local Market Audit Report

**Audit date:** 2026-09-15
**URL audited:** https://saahomes.com/northern-colorado-areas/brighton/
**Slug:** brighton
**City:** Brighton, CO
**County:** Adams County
**Page type:** Dynamic template (AreaGuidePage.jsx via :slug route)

---

## 1. SERP Analysis

*Note: SERP checks via web_search (2026-09-15); live crawl not used. GSC creds absent on host — authoritative positions from daily-ranking-strike when GSC restored.*

### Query: "brighton homes for sale"
- **SAA Homes position:** NOT FOUND — Trulia #1 (297 homes, mobile/manufactured subquery #1), Kenna Real Estate #3 (dedicated Brighton IDX, 475 props, $611K median), sellmyhousetosmith #4 (cash buyer), Redfin cheap-homes #5.

### Query: "sell my home Brighton"
- **SAA Homes position:** NOT FOUND — sellmyhousetosmith.com (CO cash buyer) ranks #4 on homes-for-sale variant; cash-buyer sites own seller terms.

### Query: "best realtor Brighton"
- **SAA Homes position:** NOT FOUND — Zillow profile page #1 (Eduardo Dominguez), RE/MAX directory #2 (119 results), city govt page #3, Realtor.com agent #4, Redfin agents #5. SAA absent.

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

- **0 references** to `/northern-colorado-areas/brighton/` in `src/data/blogPosts.js`
- Dedicated blog coverage: ZERO inbound blog links — brighton not mentioned once in blogPosts.js. NO buying/selling/moving-to Brighton post. Biggest content gap in the 27-entity plan. Area guide data + 8 neighborhoods exist but get no blog equity.

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

Kenna Real Estate (dedicated Brighton IDX ranking top 3), RE/MAX Momentum (local office dominates agent directory), cash buyers for seller terms.

Our advantages: live IRES market stats (CityStatsBand), clean single-injection schema, 13/13 template completeness, CHFA gold funnel. Their advantages: dedicated IDX listing pages with instant inventory (Kenna), direct agent personal-brand SERP assets (Erie/Brighton), directory listings (EffectiveAgents/HomeLight).

---

## 6. Action Plan

### P1 — Critical (fix immediately)
1. ZERO blog inbound. Create dedicated blog posts (buying-a-home-in-brighton / moving-to-brighton, ideally I-76 commute angle) with relatedLinks to the area guide. This is the single biggest content gap in the 27-entity plan.

### P2 — Important (fix this batch)
2. Add Brighton links into corridor/Denver-exurb posts (Erie posts, I-76/corridor guide); currently 0 mentions anywhere in blogPosts.js.

### P3 — Enhancement (next batch)
3. Verify builder-heavy new-construction SERP coverage (Kenna Brighton ranks top 3 with IDX); ensure area guide links to neighborhoods for crawl depth.

---

## Indexation / launch status

- **HTTP status:** 200
- **Canonical:** self-referencing https://saahomes.com/northern-colorado-areas/brighton/ (no mismatch)
- **Meta robots:** no noindex
- **Sitemap:** included in /sitemap.xml
- **Neighborhood sub-pages:** 8 neighborhood sub-pages in sitemap (downtown-brighton, prairie-center-brighton, bromley-park-brighton, cherry-meadows-brighton, indigo-trails-brighton, sugar-creek-brighton, todd-creek-brighton, brighton-crossing); spot-checked 200 OK.

Report generated by Hermes Agent - Local Market Audit (Batch 3)