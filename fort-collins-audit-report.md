# Fort Collins Area Page - Local Market Audit Report

**Audit date:** 2026-08-01
**URL audited:** https://saahomes.com/northern-colorado-areas/fort-collins/
**Slug:** fort-collins
**City:** Fort Collins, CO
**County:** Larimer County
**Page type:** Dedicated page (FortCollinsPage.jsx) — Tier S editorial template, explicit route in src/App.jsx lines 120-121

---

## 1. SERP Analysis

*Note: All SERP endpoints served bot-blocking. DuckDuckGo HTML returned a CAPTCHA challenge (checkbox form, no results), DuckDuckGo Lite returned the same CAPTCHA, and Bing returned a degraded/empty result set (query tokenized to "fort" — returned Fortnite/forts results for query 1; empty body for query 2). No usable organic results were retrievable. GSC data (daily-ranking-strike) is the authoritative position source and was not available in this session.*

### Query: "fort collins homes for sale"
- **SAA Homes position:** BOT BLOCKED — no SERP data
- **Expected competitors (from prior audit + market knowledge):** Zillow, Realtor.com, Redfin, Trulia, Homes.com, local agencies (The Group Inc., Kittle Real Estate, All Avenue Real Estate), agent pages (Angie Spangler RE/MAX, NoCo Home Team)
- July 2026 baseline: NOT on page 1

### Query: "sell my home fort collins"
- **SAA Homes position:** BOT BLOCKED — no SERP data
- **Expected competitors:** cash-buyer/ibuyer pages (Orchard, We Buy Homes 365, Offerpad-style), national portals
- July 2026 baseline: NOT on page 1

### Query: "best realtor fort collins"
- **SAA Homes position:** BOT BLOCKED — no SERP data
- **Expected competitors:** directory/aggregator pages (Agent Pronto, FastExpert), local agent brand pages
- July 2026 baseline: NOT on page 1

---

## 2. Content Review

**Page type confirmed:** Dedicated page — live page has **18 h2 headings** (≥17 = dedicated editorial template) with editorial sections (Economy, Culture, Education, Location, 10 Facts, Schools, Around The Area). Source-code analysis IS content review; live page verified as hydrated (root children > 0, 74 total headings) and matches source.

| # | Section | Status | Notes |
|---|---------|--------|-------|
| 1 | Hero section (county, city, tagline) | ✓ | h1 "Fort Collins, CO" + tagline + hero image. County appears in breadcrumb (Northern Colorado Communities) and FAQ, not in hero text. **Tagline divergence:** JSX hero = "A vibrant city with CSU, craft breweries, and stunning mountain views" vs areaSeo.js tagline = "CSU, craft breweries, and Front Range living" — schema/prerender uses areaSeo.js version. |
| 2 | Intro paragraphs (2) | ✓ | "Fort Collins, CO Area Guide" section, 2 paragraphs (lines 39-44). |
| 3 | LatestMarketUpdateBanner | ✗ | 0 references. Component exists (LatestMarketUpdateBanner.jsx) and LATEST_MARKET_UPDATE_SLUG = 'northern-colorado-market-update-august-2026' is set — banner simply not included on this page. |
| 4 | Quick info cards | ✗ | "Area Highlights" section (lines 224-234) is prose (173,211 residents, 55% homeowners, avg age 31, 155 homes sold/6mo, avg sold $636,292). No card/stat-grid layout. |
| 5 | Search Homes (RealScout + Talk to Agent) | ✓ | Present but dispersed: main search sections link to `/properties/?location=Fort Collins, CO` (hero button bg-white, section button bg-black — NOT the blue-600 pattern). RealScout external links ×2 (Realtor section line 367, Final CTA line 387) and Talk-to-Agent CTAs to /contact/ ×2 present. Two-button pattern not co-located in one search section. |
| 6 | Why Buy cards (4) | ✗ | No "Why Buy" heading. "Your Trusted Fort Collins Realtors" section (lines 330-377) has 2 cards (For Buyers / For Sellers) — agent-focused, not the 4-card city lifestyle grid. |
| 7 | CHFA gold section with CTA | ✓ | Gold (#CFB36E) banner "First-time buyer in Fort Collins?" (lines 194-218): $25K DPA copy + 2 CTAs (Free CHFA Consultation → /chfa-down-payment-assistance/#chfa-dpa-lead-form, CHFA program guide →). 6 CHFA mentions in JSX (incl. Realtor section + buyer card). **Improvement over July baseline** (was footer/FAQ-only). |
| 8 | Free market report form | ✓ | MarketReportForm with areaName="Fort Collins, CO", id="market-report" (lines 180-192), phone fallback (970) 999-1407. |
| 9 | AreaEventsSection | ✗ | No events section and no link to /blog/northern-colorado-events-guide-2026/. Events (Taste of Fort Collins, Bohemian Nights, Peach Festival) mentioned only inline in Culture prose. AreaEventsSection.jsx component exists but is unused here. |
| 10 | Popular Areas list | ✓ | NeighborhoodLinks (line 221) renders full Fort Collins neighborhood grid (Old Town, Midtown, South Fort Collins, Northwest, University Area/CSU, Ridgewood Hills, Fossil Creek, + more from neighborhoods.js) + "Nearby Northern Colorado Communities" grid (6 cities). **Improvement over July baseline** (was "neighborhoods only in FAQ schema"). |
| 11 | Local Highlights list | ✓ | Area Highlights stats + "10 Facts About Fort Collins" + "Around The Area" (10 restaurants). |
| 12 | FAQ section | ✓ | AreaFAQSection with 7 FAQs from areaFaqs.js ('fort-collins' key). Imports correct (AreaFAQSection + AREA_FAQS both imported — no missing-import bug). Live: "Frequently asked questions about Fort Collins, CO real estate". |
| 13 | Final CTA (Ready to buy or sell?) | ✓ | "Ready to Explore Fort Collins?" (lines 379-401): RealScout search + Contact Us. 1 reference. |

**Score: 9/13 base template components present (69%)**

**Important:** This page uses a dedicated editorial template (Tier S). The score above reflects standard template alignment only. The page has 12 custom editorial sections not in the dynamic template:
- Moving to Fort Collins
- Fort Collins Economy
- Culture and Activities in Fort Collins
- Education in Fort Collins
- Location and Climate of Fort Collins
- 10 Facts About Fort Collins
- Fort Collins Neighborhoods & Subdivisions (NeighborhoodLinks)
- Area Highlights
- Around The Area (restaurants)
- Schools In The Area
- Nearby Northern Colorado Communities
- Your Trusted Fort Collins Realtors (agent-focused buyer/seller section)

**Live page verification (browser_console):** title "Fort Collins Realtor | Fort Collins Real Estate Agents & Homes for Sale | SAA Homes", canonical OK, meta description = areaSeo.js description, schemaCount 9, rootChildren 1 (hydrated), headingCount 74, h1 "Fort Collins, CO", 18 h2s. **Title note:** live title comes from a city-specific override in `getAreaExactTitle()` (areaSeo.js line 625) — NOT the `exactTitle` field ("Fort Collins CO Real Estate | Homes for Sale & Neighborhood Guide | SAA Homes"). Intentional Tier S keyword targeting, but data field is now stale/duplicated source of truth.

---

## 3. Schema Check

Live extraction: 9 JSON-LD scripts — all 5 expected types present, **4 of 5 duplicated** (known prerender-SSR + React Helmet double-injection bug).

| Schema Type | Present? | Duplicated? | Details |
|-------------|----------|-------------|---------|
| RealEstateAgent | ✓ | ✓ (×2) | name "Schwartz and Associates", areaServed "Fort Collins, CO" |
| WebPage with Place | ✓ | ✓ (×2) | about.geo = GeoCoordinates lat 40.5853 / lon -105.0844 ✓ |
| BreadcrumbList | ✓ | ✓ (×2) | 3 items: Home > Northern Colorado Communities > Fort Collins, CO ✓ |
| FAQPage | ✓ | ✓ (×2) | 7 questions (price, quality of life, neighborhoods, first-time buyer/CHFA, commute, why SAA, FC vs Loveland) ✓ |
| WebSite | ✓ | ✗ (×1) | only type that dedupes correctly (SearchAction) |

**Total: 9 scripts** (`["RealEstateAgent","WebSite","WebPage","BreadcrumbList","FAQPage","WebPage","BreadcrumbList","RealEstateAgent","FAQPage"]`). Content of all types is correct; duplication is the issue. July baseline had 4/4 types present — duplication status confirmed unchanged (now 5 types, 4 duplicated).

---

## 4. Internal Links

### Inbound from blog
**75 references** to `/northern-colorado-areas/fort-collins/` in src/data/blogPosts.js (unchanged from July baseline). Patterns: "Jump to program guides"/relatedLinks lists with "Fort Collins homes for sale" anchor + section-level relatedLinks.

Key posts verified (each meets ≥1-link minimum):
| Blog post | Links to area page | Min. check |
|-----------|--------------------|------------|
| buying-a-home-in-fort-collins ("Your Complete Guide to Buying a Home in Fort Collins") | 2 (top relatedLinks + section relatedLinks, lines 16, 39) | ✓ ≥1 |
| selling-your-home-in-fort-collins ("Selling Your Home in Fort Collins: A Complete 2026 Guide") | 1 (line 813) | ✓ ≥1 |
| fort-collins-realtor ("Fort Collins Realtor: Your Trusted Real Estate Team…") | 2 (lines 1021, 1054) | ✓ ≥2 |
| chfa-down-payment-assistance-colorado-2026 | 1 (line 198) | ✓ |
| chfa-first-time-homebuyer-northern-colorado | 1 (line 288) | ✓ |
| chfa-schools-to-home-colorado-teachers | 1 (line 361) | ✓ |
| northern-colorado-events-guide-2026 | 1 (line 698) | ✓ |
| Market updates + ~30 more posts (incl. 12 neighborhood sub-page guides: old-town, midtown, waterglen-fc, tapestry, horsetooth-west, university-area, city-park-fc, rigden-farm, buckingham-fc, collindale-fc, horsetooth) | 1+ each | ✓ |

### Outbound to money pages
All 5 core transactional pages linked — verified in-body AND via nav/footer (Header.jsx contact, Footer.jsx for-buyers/for-sellers/chfa/properties):

| Money page | In-body links (live) | Nav/Footer |
|------------|---------------------|------------|
| /for-buyers/ | 4 | ✓ (Footer) |
| /for-sellers/ | 4 | ✓ (Footer) |
| /contact/ | 7 | ✓ (Header) |
| /chfa-down-payment-assistance/ | 4 | ✓ (Footer) |
| /properties/ | 7 | ✓ (Footer + Header "Properties") |

---

## 5. Competitor Pages

SERP was bot-blocked, so live competitor capture was not possible. Based on July 2026 baseline and market knowledge, expected top competitors and their feature depth:

| Competitor | Type | Typical depth/features |
|------------|------|----------------------|
| Zillow / Realtor.com / Redfin | National portals | Live MLS listing embeds, interactive map search, price trends, agent reviews |
| The Group Inc. | Large local brokerage | Neighborhood microsites, market reports, agent roster pages |
| Kittle Real Estate | Local brokerage | Neighborhood content, listings, team bios |
| All Avenue Real Estate | Local brokerage | Area pages, listings search |
| Angie Spangler (RE/MAX) | Individual agent | Hyperlocal domain, active blog, testimonials, MLS search |
| NoCo Home Team | Local team | Team brand, testimonial carousel, email capture |

**SAA Homes advantages (from July):** content depth (12 editorial sections), schema completeness (all 5 types), strong blog cross-linking (75 inbound refs), CHFA funnel.
**Competitor advantages SAA lacks:** scannable stat cards, live listing embed on the area page (SAA links out to /properties/ and RealScout instead), events/community calendar section, visible social proof (reviews/testimonials).

---

## 6. Action Plan

### P1 — Critical (fix immediately)
1. **Fix schema duplication** — 9 JSON-LD scripts instead of 5 (4 types ×2). Root cause: prerender/SSR script + React Helmet double-injection. Dedupe in the prerender layer (strip schemas from prerendered HTML before React mounts, or unique-id dedup in schema generation). Site-wide issue, but Fort Collins is a Tier S priority page.
2. **Add LatestMarketUpdateBanner** — component exists (LatestMarketUpdateBanner.jsx) and LATEST_MARKET_UPDATE_SLUG already points to the August 2026 market update. Insert into FortCollinsPage.jsx (after intro, before Search Homes) for fresh-content signal and internal linking to the newest market post.

### P2 — Important (fix this rotation)
3. **Add "Why Buy in Fort Collins" 4-card section** — convert dense prose into 4 scannable cards (Mountain Lifestyle / Top Schools / Thriving Economy / Neighborhoods) per dynamic template. Keeps editorial depth while adding the standard conversion component.
4. **Add AreaEventsSection or events-guide link** — component exists; events guide blog post (northern-colorado-events-guide-2026) already links in. Add the section (or at minimum an inline CTA card to the events guide) to capture event-intent queries.

### P3 — Enhancement (next batch)
5. **Convert Area Highlights to quick-info stat cards** (population, % homeowners, median age, homes sold, avg sold price) — matches competitor scannability and standard template item #4. Also fix hero tagline divergence (JSX vs areaSeo.js) and the duplicated intro paragraph between "Area Guide" and "Moving to Fort Collins" sections.

---

Report generated by Hermes Agent - Local Market Audit
