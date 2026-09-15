# Firestone Area Page - Local Market Audit Report

**Audit date:** 2026-09-15
**URL audited:** https://saahomes.com/northern-colorado-areas/firestone/
**Slug:** firestone
**City:** Firestone, CO
**County:** Weld County
**Page type:** Dynamic template (AreaGuidePage.jsx via :slug route)

---

## 1. SERP Analysis

*Note: SERP checks via web_search (2026-09-15); live crawl not used. GSC creds absent on host — authoritative positions from daily-ranking-strike when GSC restored.*

### Query: "firestone homes for sale"
- **SAA Homes position:** NOT FOUND — #1 Zillow, #2 Kenna Real Estate (dedicated Firestone IDX page + market snapshot), #3 RE/MAX Carbon Valley, #4 Homes4NoCo, #5 Coldwell Banker listing page. SAA not on page 1. Kittle absent here but leads Frederick directories.

### Query: "sell my home Firestone"
- **SAA Homes position:** NOT FOUND — search returned listings/SERP shell; cash-buyer + portal pattern like Batch 1. SAA /cash-home-buyers/ not ranking.

### Query: "best realtor Firestone"
- **SAA Homes position:** NOT FOUND — directory aggregators (EffectiveAgents/HomeLight) + Kittle Real Estate dominate; individual agent pages rank.

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

- **9 references** to `/northern-colorado-areas/firestone/` in `src/data/blogPosts.js`
- Dedicated blog coverage: No dedicated 'buying/selling a home in Firestone' blog post. Covered indirectly by Carbon Valley affordability guide + area guide links (9 refs).

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

Kenna Real Estate (dedicated /firestone IDX with live market stats, neighborhood list, district notes) and Kittle Real Estate (Weld volume leader, 27 yrs, 680+ sales listed on EffectiveAgents 12-mo).

Our advantages: live IRES market stats (CityStatsBand), clean single-injection schema, 13/13 template completeness, CHFA gold funnel. Their advantages: dedicated IDX listing pages with instant inventory (Kenna), direct agent personal-brand SERP assets (Erie/Brighton), directory listings (EffectiveAgents/HomeLight).

---

## 6. Action Plan

### P1 — Critical (fix immediately)
1. None — healthy page. SERP: not page 1 for money queries (portals + Kenna). Keep area guide equity flowing; no dedicated Firestone blog post.

### P2 — Important (fix this batch)
2. Create dedicated 'buying-a-home-in-firestone-colorado' blog post (Carbon Valley hub gets only indirect elinks; 9 refs but no own post) → area guide relatedLinks.

### P3 — Enhancement (next batch)
3. Refresh intro median range ($450K–$650K is a static claim; city stats band already live) and cross-link carbon-valley hub in more posts.

---

## Indexation / launch status

- **HTTP status:** 200
- **Canonical:** self-referencing https://saahomes.com/northern-colorado-areas/firestone/ (no mismatch)
- **Meta robots:** no noindex
- **Sitemap:** included in /sitemap.xml
- **Neighborhood sub-pages:** present in sitemap; spot-checked routes return 200

Report generated by Hermes Agent - Local Market Audit (Batch 3)