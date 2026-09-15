# Carbon Valley Area Page - Local Market Audit Report

**Audit date:** 2026-09-15
**URL audited:** https://saahomes.com/northern-colorado-areas/carbon-valley/
**Slug:** carbon-valley
**City:** Carbon Valley, CO (hub — Firestone / Frederick / Dacono / Gilcrest / Platteville / Mead)
**County:** Weld County
**Page type:** Dynamic template (AreaGuidePage.jsx) — hub variant (`hubSections` + `hubCrossLinks`, `skipCityStats: true`)

---

## 1. SERP Analysis

*Method: live web search (2026-09-15). Bot-detection limited; GSC (daily-ranking-strike) remains the authoritative position source.*

### Query: "carbon valley homes for sale" / "carbon valley colorado real estate"
- **SAA Homes position:** ❌ NOT on page 1 (hub absent)
- **Top competitors:** Zillow, Realtor.com, Homes.com (/firestone-co/), RE/MAX (neighborhood page), Trulia, Redfin, Homes.com local-guide "Firestone, CO City Guide" (#4 for guide intent), Longmont Times-Call "Carbon Valley boom" article (#2 for quoted phrase), firestoneco.gov
- **Notes:** The exact "Carbon Valley" phrase is muddled by the search backend (Carbondale/Divide results) — no owned "Carbon Valley homes for sale" page exists anywhere, opportunity is wide open. SAA hub DID surface on page 1 (pos ~5) for the broader "sell my home firestone frederick carbon valley colorado" query, and the two Carbon Valley blog posts rank #1–#3 under site: and topic queries.

### Query: "sell my home firestone frederick carbon valley colorado" (seller)
- **SAA Homes position:** ⚠️ /blog/carbon-valley-affordability-guide-firestone-frederick/ at #2, hub area page at #5 (page 1)
- **Top competitors:** Kittle "BEST Real Estate Agents in Firestone" (`/communities/move-to-firestone-co/`) #1; Luginbill Homes "Why More and More Homebuyers Are Choosing Carbon Valley" #4; Zillow Firestone #6

### Query: "best realtor / real estate agent carbon valley, firestone"
- **SAA Homes position:** ❌ NOT on page 1 — no dedicated agent-intent page for Carbon Valley/Firestone
- **Top competitors:** realestateagents.com (Jenny Hart, 1st Realty), Kittle homepage, **jamessack.com/firestone (same Coldwell Banker office, 3665 JFK Pkwy Suite 210)**, HomeLight, patrickseaneverett.com (eXp), US News agent directory
- **Notes:** Kittle is farming "best realtor {firestone}" — the exact pattern flagged in AGENTS.md. SAA's sibling agent in the same CB office already owns a Firestone page; SAA has none.

### Query: "dacono co homes for sale" (hub section town)
- **SAA Homes position:** ❌ NOT on page 1 — Dacono is only a hub SECTION + 7 neighborhood sub-pages; no "Dacono homes for sale" page
- **Top competitors:** Coldwell Banker city page (#1), Zillow, Trulia, Kentwood, **Kenna Real Estate ×3** (/dacono, /dacono/private, /dacono/estate-sale — IDX shells)
- **Notes:** Kenna's IDX-shell pattern is dominant in the sub-market; Dacono has ~49 active listings.

---

## 2. Content Review

Dynamic template (AreaGuidePage.jsx). Checklist per skill; hub variant adds SectionTownsBand + hubCrossLinks bonus sections.

| # | Section | Status | Notes |
|---|---------|--------|-------|
| 1 | Hero section (county, city, tagline) | ✓ | "One hub for Firestone, Frederick, Dacono, Gilcrest, Platteville & Mead" — matches areaSeo.js |
| 2 | Intro paragraphs (3) | ✓ | All 3 render |
| 3 | LatestMarketUpdateBanner | ✓ | Compact variant |
| 4 | Quick info cards | ✓ | County / Homes for sale / Expert agents |
| 5 | Search Homes (search + Talk to Agent) | ✓ | RealScout link via /properties/?location=Firestone, CO + agent CTA |
| 6 | Why Buy cards (4) | ✓ | Regional value / I-25 growth / Connected towns / First-time friendly |
| 7 | CHFA gold section with CTA | ✓ | $25K DPA + Free CHFA Consultation + program guide links |
| 8 | Free market report form | ✓ | MarketReportForm Carbon Valley, CO |
| 9 | AreaEventsSection | ✓ | Renders via events data |
| 10 | Popular Areas list | ✓ | Highlights neighborhoods |
| 11 | Local Highlights list | ✓ | Attractions |
| 12 | FAQ section | ✓ | 3 questions (AREA_FAQS['carbon-valley']) — no import bug (dynamic template) |
| 13 | Final CTA (Ready to buy or sell?) | ✓ | Black section + Contact + Call |

**Bonus (hub variant):** SectionTownsBand with live IRES data for **Dacono, Platteville, Gilcrest** (skipCityStats:true suppresses single-city stats band by design); **hubCrossLinks** cards → Firestone, Frederick, Mead, Fort Lupton; TopRatedSchools; Nearby Communities (6 links incl. Fort Lupton + Erie); RecentlySoldSection.

**Score: 13/13 base template components (100%)** — hub adds 4+ custom sections.

---

## 3. Schema Check

| Schema Type | Present? | Duplicated? | Details |
|-------------|----------|-------------|---------|
| RealEstateAgent | ✓ | ✓ No | areaServed: Carbon Valley, CO; name Schwartz and Associates |
| WebPage with Place | ✓ | ✓ No | GeoCoordinates 40.1100 / -104.9400 |
| BreadcrumbList | ✓ | ✓ No | 3 items |
| FAQPage | ✓ | ✓ No | 3 questions |
| WebSite | ✓ | ✓ No | SearchAction |

**6 JSON-LD scripts total, 1 each (incl. ItemList·12 live listings)** — clean, no prerender/Helmet duplication (consistent with Batch 3 dynamic-template baseline). All corridor pages (red-feather-lakes, fort-lupton, lyons, bellvue) verified identical: 6 scripts, no dup.

---

## 4. Internal Links

### Inbound from blog — FIXED THIS AUDIT (PR #193, merged 9433b2c)
- Before: **2 inbound blog refs** (both from Erie posts: erie-co new construction buyer guide + erie fall 2026 market update relatedLinks). The two Carbon Valley posts themselves linked only Firestone/Frederick — they shipped before the hub existed.
- After: **4 refs**. Added hub to top slot of `relatedLinks` in:
  - `/blog/carbon-valley-affordable-homes-guide/` (Jul 9)
  - `/blog/carbon-valley-affordability-guide-firestone-frederick/` (Jun 29) — also fixed stale Firestone label "Carbon Valley hub" → correct Firestone description
- Corridor inbound equity still weak: red-feather-lakes 0 refs, fort-lupton 0, lyons 0, bellvue 0 (Batch 4 + weekly rotation targets).

### Outbound to money pages (absolute URLs verified in static HTML)
- /for-buyers/ ✓ · /for-sellers/ ✓ · /contact/ ✓ (×2) · /chfa-down-payment-assistance/ ✓ · /properties/ ✓ · plus all 27 area pages in footer "Cities We Serve", /cash-home-buyers/ + cash-guide in selling section, /for-sellers/#home-valuation hero CTA.

### Neighborhood sub-pages (indexed, 200 OK)
- 7 Dacono pages (downtown-dacono, legacy-park-dacono, sweetgrass-dacono, autumn-valley-dacono, glens-of-dacono, sharpe-farms-dacono, sundance-dacono) — verified live, sitemap present, site:saahomes shows them indexed.

---

## 5. Competitor Pages

| Competitor | Page | What they have | SAA gap |
|---|---|---|---|
| **Kittle** | kittlerealestate.com/communities/move-to-firestone-co/ | "BEST Real Estate Agents in Firestone" — ranks #1 for seller/agent intent, Vrain Valley school rundown, agent farm | No SAA agent-intent page for Carbon Valley/Firestone |
| **Luginbill Homes** | luginbillhomes.com/carbon-valley-colorado/ | "Why... Choosing Carbon Valley Over Boulder and Loveland" — relocation/why-buy content, ranks #4 | SAA hub has this thesis but no equivalent dedicated WHY-buy post; hub thesis lives only in intro copy |
| **Kenna Real Estate** | kennarealestate.com/dacono (+/private, /estate-sale) | IDX shell pages ranking for every Dacono segment | No dedicated Dacono page (SAA has hub section + neighborhoods only) |
| **James Sack (same CB office)** | jamessack.com/firestone | Individual agent Firestone page at 3665 JFK Pkwy — ranks #3 agent intent | SAA brand page absent from agent SERP |
| **Homes.com** | homes.com/local-guide/firestone-co | City guide with relo + agent cards | Direct guide-format competitor, ranks #4 for "carbon valley colorado real estate" |
| **BizWest/Times-Call** | timescall.com Carbon Valley boom | News authority on growth | SAA can't beat news for stats; can cite/link in content |

---

## 6. Action Plan

### P1 — Critical (fix immediately)
1. **✅ SHIPPED (PR #193): Carbon Valley blog posts now link back to the hub** — /blog/carbon-valley-affordable-homes-guide/ + /blog/carbon-valley-affordability-guide-firestone-frederick/ relatedLinks → uplift for queries "carbon valley homes for sale", "carbon valley colorado real estate" (hub inbound refs 2→4).
2. **Create agent-intent post `carbon-valley-colorado-real-estate-agent`** (mirror erie-colorado-real-estate-agent pattern that shipped this month) linking to the hub — Kittle #1 and James Sack #3 prove the SERP converts; SAA has zero owned page for "carbon valley realtor" / "firestone real estate agent". Model: `src/data/blogPosts.js` entry + relatedLinks → /northern-colorado-areas/carbon-valley/, /for-buyers/, /for-sellers/.

### P2 — Important (this rotation)
3. **Create "moving to Carbon Valley" (why-buy) blog post targeting Luginbill's query** — "Why buy Carbon Valley over Boulder/Longmont" with CHFA + commute + new-construction depth, linking hub + Firestone/Frederick. Counter the competitor content play on the hub's own thesis.
4. **Strengthen hub FAQ + schema for the gap queries**: FAQ currently 3 (towns / first-time buyers / which town). Add Q's for "Carbon Valley homes for sale price range" (~$450K–$650K Firestone / $400K–$575K Frederick, consistent with live blog data) and "Dacono vs Firestone vs Frederick" to capture long-tail; deploy via confirmed-not-shown FAQ section (prerendered, matches "world class" depth).

### P3 — Enhancement (next batch/rotation)
5. **Dedicated Dacono area page** — Kenna owns the Dacono SERP with shells; SAA already has 7 Dacono neighborhood pages + a writeup section. A full `/northern-colorado-areas/dacono/` page (or promote the hub section with anchor targeting) would compete for "dacono co homes for sale" without a new shell. Evaluate after Batch 4's corridor sweep (Dacono sits mid-corridor; avoid duplicate-thin content per strategy).
6. **Corridor blog equity**: red-feather-lakes, fort-lupton, lyons, bellvue remain 0 blog inbound refs — queue dedicated buyer/seller posts (or a corridor blog linking all four) as their pages index.

---

Report generated by Hermes Agent - Local Market Audit