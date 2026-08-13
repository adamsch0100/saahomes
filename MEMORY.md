# MEMORY — saahomes.com GSC Monitor


## Daily Ranking Strike — 2026-06-26

✅ No regressions detected.

*Report generated: 2026-06-26T13:04:22.503909*

## Daily Ranking Strike — 2026-07-02

✅ No regressions detected.

*Report generated: 2026-07-02T13:03:30.863529*

## Content calendar state

last_social_pack_date: 2026-08-03
last_social_pillar: market-intelligence
rotation_week_index: 2
last_3_social_hooks: ["Sculpture in the Park returns to Loveland Aug 7–9 — one of the largest outdoor sculpture shows in the country. Great weekend to explore the Sweetheart City."]
monthly_market_blog_url: https://saahomes.com/blog/northern-colorado-market-update-august-2026/
blogs_published_this_month: 1 (windsor-colorado-real-estate-agent)
pending_social_packs: 19 (see operator-week-2026-08-03.json for full list)
latest_market_update_slug: northern-colorado-market-update-august-2026
last_events_check_date: 2026-08-01
next_notable_event: Larimer County Fair (Jul 31-Aug 4) + Sculpture in the Park (Aug 7-9) — both posted to Buffer 2026-08-01
events_guide_last_refresh: 2026-06-29
latest_events_guide_slug: northern-colorado-events-guide-2026
events_social_packs_this_quarter: 2

## Daily Ranking Strike — 2026-08-01

### Rank Drop Alerts

| Query | Previous Pos | Current Pos | Drop | Impressions |
|-------|-------------|-------------|------|-------------|
| johnstown CO real estate | 13.5 | DISAPPEARED | - | 0 |

*Report generated: 2026-08-01T16:43:24.452332*

## Daily Ranking Strike — 2026-08-01

### Rank Drop Alerts

| Query | Previous Pos | Current Pos | Drop | Impressions |
|-------|-------------|-------------|------|-------------|
| johnstown CO real estate | 13.5 | DISAPPEARED | - | 0 |

*Report generated: 2026-08-01T16:44:26.285091*

## Daily Ranking Strike — 2026-08-01

### Rank Drop Alerts

| Query | Previous Pos | Current Pos | Drop | Impressions |
|-------|-------------|-------------|------|-------------|
| johnstown CO real estate | 13.5 | DISAPPEARED | - | 0 |

*Report generated: 2026-08-01T17:27:30.967457*

---

## Market Scorecard — Batch 1 of 4 (2026-08-01)

August 2026 rotation. Batch 1: Fort Collins, Loveland, Windsor, Greeley, Timnath (all Dedicated Tier S editorial pages).

| # | City | Page Type | Template Completeness | Schema | CHFA Section | Final CTA | SERP | Action Items | Priority Score |
|---|------|-----------|---------------------|--------|-------------|-----------|------|-------------|----------------|
| 1 | **Fort Collins** | Dedicated (FortCollinsPage.jsx) | 9/13 (69%) ↑ from 7/13 | ⚠️ 9 scripts, 4/5 duplicated | ✅ Gold section w/ 2 CTAs | ✅ Present | ❌ Not page 1 (blocked) | 5 items | P1 |
| 2 | **Loveland** | Dedicated (LovelandPage.jsx) | 8/13 (62%) | ⚠️ 9 scripts, 4/5 duplicated | ❌ Missing (0 refs) | ✅ Present | ❌ Not page 1 (Bing: Zillow/Realtor/Kittle) | 5 items | P1 |
| 3 | **Windsor** | Dedicated (WindsorPage.jsx) | 7/13 (54%) ↑ from 6/13 | ⚠️ 9 scripts, 4/5 duplicated | ❌ Missing (footer only) | ❌ Missing | ❌ Not page 1 (DDG live) | 9 items | P1 |
| 4 | **Greeley** | Dedicated (GreeleyPage.jsx) | 6/13 (46%) strict | ⚠️ 9 scripts, 4/5 duplicated | ⚠️ G-HOPE only, no generic CHFA | ❌ Missing | ❌ Not page 1 (DDG live) | 6 items | P1 |
| 5 | **Timnath** | Dedicated (TimnathPage.jsx) | 6/13 (46%) — FAQ crashes | ✅ 5/5 unique — NO duplication | ❌ Missing | ❌ Missing | ❌ Not top 8 (DDG live) | 5 items | P1 |

### Key findings across Batch 1 (Aug)

1. **🔴 Schema duplication persists on 4/5 pages** — 9 JSON-LD scripts (RealEstateAgent/WebPage/BreadcrumbList/FAQPage ×2, WebSite ×1) on Fort Collins, Loveland, Windsor, Greeley. Unchanged since July. Root cause: prerender SSR + React Helmet double-injection. Only Timnath clean. Fix in prerender layer (strip schemas before React mounts, or unique-id dedup).
2. **🔴 CHFA funnel missing on 3 of 5 pages** — Loveland, Windsor, Timnath have ZERO in-body CHFA refs (footer-only site-wide link); Greeley has G-HOPE gold section but no generic CHFA callout to /chfa-down-payment-assistance/. Fort Collins is the only page with the standard gold CHFA section. All areaSeo.js intros reference CHFA — the data exists, components just don't render it.
3. **🐛 TimnathPage.jsx missing-imports crash CONFIRMED still live** — `AreaFAQSection` + `AREA_FAQS` used at line ~292 but never imported → ReferenceError at hydration, page body breaks below FAQ. Same one-line fix applies to 5 other dedicated pages (Wellington, Johnstown, Milliken, Eaton, La Salle). P1.
4. **🐛 New: orphaned blog link** — blogPosts.js links to `/northern-colorado-areas/timnath/bridle-ridge-at-timnath/` which has NO route in App.jsx (404 risk). P3.
5. **🐛 Tagline divergence on all 5 pages** — JSX hero taglines differ from areaSeo.js `tagline` (e.g., Windsor "Small Town Charm, Big City Convenience" vs "Family communities between Fort Collins and Greeley"; Timnath "A Rapidly Growing Community" vs "New homes and master-planned communities"). Visible text and schema disagree.
6. **⛔ SERP: none of 5 cities on page 1** for "homes for sale"/"sell my home"/"best realtor" queries. DDG live capture worked for Windsor/Greeley/Timnath this month; Fort Collins blocked; Loveland partial Bing. Portals (Zillow/Realtor.com/Redfin/Trulia/Homes.com) + local Kittle Real Estate dominate money queries; cash-buyer sites own seller queries. GSC (daily-ranking-strike) is the authoritative source.

### Best & worst performers
- **Best:** Fort Collins (9/13, 69%) — only page with CHFA gold section + Final CTA; real improvement from July (7/13); all imports correct; 75 inbound blog refs.
- **Worst:** Greeley & Timnath (6/13, 46%) — Greeley lacks generic CHFA + Final CTA; Timnath's FAQ crashes the page body.
- **Most urgent:** Timnath — page is visibly broken at runtime (missing imports); Windsor — worst historical performer, active 'windsor-realtor' SEO branch being worked 2026-08-01, 4 P1 items queued.

### Batch 1 rotation tracking
- **Batch audited:** Batch 1 of 4 (Fort Collins, Loveland, Windsor, Greeley, Timnath)
- **Audit completed:** 2026-08-01
- **Reports:** `{slug}-audit-report.md` × 5 in repo root (overwrote July files)
- **Next batch:** Batch 2 (Wellington, Johnstown, Eaton, Milliken, La Salle)
- **Next target date:** 2026-08-08
- **⚠️ Cron gap:** No dedicated cron jobs exist for the 8th/15th/22nd batch runs. `nineteen-city-scorecard` fires monthly on the 1st only. `city-deep-dive-rotation` is a WEEKLY single-city job (Tue) that will NOT cover batch rotations. Need: create batch-2 (Aug 8), batch-3 (Aug 15), batch-4 (Aug 22) jobs, or change this job's prompt to handle all 4 batches with combined delegation. No `hermes` CLI available in cron session to create them — flag for interactive session.

---

## Lead attribution log

Week of 2026-07-25:

| Landing Page | GSC Impressions | Position | GA4 Leads | Gap? | CRO Action |
|---|---|---|---|---|---|
| /chfa-schools-to-home/ | 232 | 9.0 | 0 | ⚠️ | Add program-specific lead form CTA after hero; tighten form fields |
| /blog/cash-home-buyers-fort-collins-northern-colorado/ | 111 | 17.6 | 0 | ⚠️ | Add inline CTA + end-of-post lead magnet (market report / buyer guide) |
| /blog/is-windsor-colorado-expensive-to-live/ | 60 | 8.1 | 0 | ⚠️ | Add inline CTA + end-of-post lead magnet (market report / buyer guide) |
| /blog/best-neighborhoods-fort-collins-2026/ | 51 | 32.5 | 0 | ⚠️ | Add inline CTA + end-of-post lead magnet (market report / buyer guide) |
| /colorado-champions-home-loan-program/ | 51 | 30.7 | 0 | ⚠️ | Add prominent CTA section + exit-intent popup |
| /blog/seller-concession-cheat-sheet-northern-colorado/ | 39 | 13.5 | 0 | ⚠️ | Add inline CTA + end-of-post lead magnet (market report / buyer guide) |
| /blog/fort-collins-vs-loveland-vs-windsor/ | 36 | 8.2 | 0 | ⚠️ | Add inline CTA + end-of-post lead magnet (market report / buyer guide) |
| /blog/multigenerational-homes-northern-colorado-guide/ | 27 | 8.9 | 0 | ⚠️ | Add inline CTA + end-of-post lead magnet (market report / buyer guide) |
| /blog/senior-downsizing-northern-colorado-guide/ | 26 | 20.0 | 0 | ⚠️ | Add inline CTA + end-of-post lead magnet (market report / buyer guide) |
| /blog/weld-county-vs-larimer-county-buyer-guide/ | 26 | 8.2 | 0 | ⚠️ | Add inline CTA + end-of-post lead magnet (market report / buyer guide) |
| /chfa-down-payment-assistance/ | 25 | 56.7 | 0 | ⚠️ | Add program-specific lead form CTA after hero; tighten form fields |
| /blog/northern-colorado-market-update-july-2026/ | 20 | 18.0 | 0 | ⚠️ | Add inline CTA + end-of-post lead magnet (market report / buyer guide) |
| /blog/northern-colorado-market-update-august-2026/ | 19 | 10.8 | 0 | ⚠️ | Add inline CTA + end-of-post lead magnet (market report / buyer guide) |
| /northern-colorado-areas/loveland/mariana-butte/ | 19 | 9.8 | 0 | ⚠️ | Add city-specific market report CTA + neighborhood guide signup |
| / | 16 | 5.1 | 0 | ⚠️ | Review content-to-offer match; add contextual CTA |
| /northern-colorado-areas/longmont/st-vrain-village/ | 15 | 8.1 | 0 | ⚠️ | Add city-specific market report CTA + neighborhood guide signup |
| /cash-home-buyers/ | 12 | 69.9 | 0 | ⚠️ | Review content-to-offer match; add contextual CTA |
| /blog/colorado-champions-home-loan-first-responders/ | 12 | 59.8 | 0 | ⚠️ | Add inline CTA + end-of-post lead magnet (market report / buyer guide) |
| /blog/chfa-down-payment-assistance-colorado-2026/ | 12 | 18.9 | 0 | ⚠️ | Add program-specific lead form CTA after hero; tighten form fields |
| /blog/chfa-schools-to-home-colorado-teachers/ | 9 | 37.3 | 0 | 🔶 | Add program-specific lead form CTA after hero; tighten form fields |

### Top queries by page

- **/chfa-schools-to-home/**: "chfa schools to home program" (39), "chfa schools to home" (27), "closing cost help for teachers colorado" (6)
- **/blog/cash-home-buyers-fort-collins-northern-colorado/**: "cash home buyers in fort collins" (6), "cash home buyer" (2), "cash home buyers" (2)
- **/blog/best-neighborhoods-fort-collins-2026/**: "best neighborhoods in fort collins" (7), "best neighborhoods fort collins" (4), "best places to live in fort collins" (4)
- **/colorado-champions-home-loan-program/**: "chfa approved lender colorado" (2)
- **/blog/seller-concession-cheat-sheet-northern-colorado/**: "conventional seller concessions chart" (2)
- **/blog/weld-county-vs-larimer-county-buyer-guide/**: "buyers perspective" (1)
- **/chfa-down-payment-assistance/**: "chfa first-time homebuyer colorado" (7), "chfa program colorado 2025" (5), "chfa disability down payment colorado" (1)
- **/cash-home-buyers/**: "cash offer homes littleton colorado" (3), "cash home buyers in colorado" (1), "colorado cash for keys colorado" (1)
- **/blog/chfa-down-payment-assistance-colorado-2026/**: "chfa first gen grant amount 2025" (2)
- **/blog/chfa-schools-to-home-colorado-teachers/**: "closing cost help for teachers colorado" (4)
*Report generated: 2026-08-01T18:09:09.582765*

## Daily Ranking Strike — 2026-08-03

### Rank Drop Alerts

| Query | Previous Pos | Current Pos | Drop | Impressions |
|-------|-------------|-------------|------|-------------|
| johnstown CO real estate | 13.5 | DISAPPEARED | - | 0 |

### ⚠️ P0 — Pages No Longer Indexed

| Page | Previous Impressions | Previous Clicks | Top Queries |
|------|---------------------|-----------------|-------------|
| https://saahomes.com/northern-colorado-areas/wellington/wellington-village/ | 21 | 1 | sage meadows wellington, wellington village, wellington village home policy |
| https://saahomes.com/northern-colorado-areas/loveland/sculpture-park-loveland/ | 12 | 0 | loveland colorado sculpture park, loveland sculpture park, benson sculpture garden |
| https://saahomes.com/northern-colorado-areas/mead/mead-crossing/ | 8 | 0 | mead crossing homes, mead crossing |

*Report generated: 2026-08-03T13:08:31.283057*

## Daily Ranking Strike — 2026-08-03

### Rank Drop Alerts

| Query | Previous Pos | Current Pos | Drop | Impressions |
|-------|-------------|-------------|------|-------------|
| johnstown CO real estate | 13.5 | DISAPPEARED | - | 0 |

### ⚠️ P0 — Pages No Longer Indexed

| Page | Previous Impressions | Previous Clicks | Top Queries |
|------|---------------------|-----------------|-------------|
| https://saahomes.com/northern-colorado-areas/wellington/wellington-village/ | 21 | 1 | wellington village home policy, wellington heights, wellington village |
| https://saahomes.com/northern-colorado-areas/loveland/sculpture-park-loveland/ | 12 | 0 | loveland colorado sculpture park, loveland sculpture garden, loveland co sculpture park |
| https://saahomes.com/northern-colorado-areas/mead/mead-crossing/ | 8 | 0 | mead crossing homes, mead crossing |

*Report generated: 2026-08-03T13:10:29.946932*

## Lead attribution log

Week of 2026-07-27:

| Landing Page | GSC Impressions | Position | GA4 Leads | Gap? | CRO Action |
|---|---|---|---|---|---|
| /chfa-schools-to-home/ | 268 | 8.9 | 0 | ⚠️ | Add program-specific lead form CTA after hero; tighten form fields |
| /blog/cash-home-buyers-fort-collins-northern-colorado/ | 117 | 18.0 | 0 | ⚠️ | Add inline CTA + end-of-post lead magnet (market report / buyer guide) |
| /colorado-champions-home-loan-program/ | 66 | 34.5 | 0 | ⚠️ | Add prominent CTA section + exit-intent popup |
| /blog/best-neighborhoods-fort-collins-2026/ | 58 | 30.1 | 0 | ⚠️ | Add inline CTA + end-of-post lead magnet (market report / buyer guide) |
| /blog/seller-concession-cheat-sheet-northern-colorado/ | 50 | 13.2 | 0 | ⚠️ | Add inline CTA + end-of-post lead magnet (market report / buyer guide) |
| /blog/fort-collins-vs-loveland-vs-windsor/ | 42 | 9.2 | 0 | ⚠️ | Add inline CTA + end-of-post lead magnet (market report / buyer guide) |
| /blog/fort-collins-housing-market-mid-2026/ | 40 | 8.2 | 0 | ⚠️ | Add inline CTA + end-of-post lead magnet (market report / buyer guide) |
| /blog/multigenerational-homes-northern-colorado-guide/ | 29 | 9.1 | 0 | ⚠️ | Add inline CTA + end-of-post lead magnet (market report / buyer guide) |
| /chfa-down-payment-assistance/ | 26 | 57.2 | 0 | ⚠️ | Add program-specific lead form CTA after hero; tighten form fields |
| /blog/is-windsor-colorado-expensive-to-live/ | 26 | 7.1 | 0 | ⚠️ | Add inline CTA + end-of-post lead magnet (market report / buyer guide) |
| /blog/weld-county-vs-larimer-county-buyer-guide/ | 26 | 9.8 | 0 | ⚠️ | Add inline CTA + end-of-post lead magnet (market report / buyer guide) |
| /blog/northern-colorado-market-update-august-2026/ | 23 | 8.3 | 0 | ⚠️ | Add inline CTA + end-of-post lead magnet (market report / buyer guide) |
| /blog/senior-downsizing-northern-colorado-guide/ | 21 | 16.1 | 0 | ⚠️ | Add inline CTA + end-of-post lead magnet (market report / buyer guide) |
| /blog/loveland-housing-market-mid-2026/ | 20 | 7.0 | 0 | ⚠️ | Add inline CTA + end-of-post lead magnet (market report / buyer guide) |
| /northern-colorado-areas/longmont/st-vrain-village/ | 19 | 12.9 | 0 | ⚠️ | Add city-specific market report CTA + neighborhood guide signup |
| / | 17 | 3.9 | 0 | ⚠️ | Review content-to-offer match; add contextual CTA |
| /northern-colorado-areas/loveland/mariana-butte/ | 16 | 11.4 | 0 | ⚠️ | Add city-specific market report CTA + neighborhood guide signup |
| /blog/chfa-down-payment-assistance-colorado-2026/ | 12 | 19.2 | 0 | ⚠️ | Add program-specific lead form CTA after hero; tighten form fields |
| /cash-home-buyers/ | 10 | 67.8 | 0 | ⚠️ | Review content-to-offer match; add contextual CTA |
| /blog/northern-colorado-19-cities-market-guide/ | 10 | 13.6 | 0 | ⚠️ | Add inline CTA + end-of-post lead magnet (market report / buyer guide) |

### Top queries by page

- **/chfa-schools-to-home/**: "chfa schools to home program" (45), "chfa schools to home" (35), "closing cost help for teachers colorado" (8)
- **/blog/cash-home-buyers-fort-collins-northern-colorado/**: "cash home buyers in fort collins" (4), "cash home buyer" (2), "cash home buyers" (2)
- **/colorado-champions-home-loan-program/**: "chfa approved lender colorado" (4), "chfa first generation program colorado" (2), "colorado champions home loan program" (2)
- **/blog/best-neighborhoods-fort-collins-2026/**: "best neighborhoods in fort collins" (8), "best neighborhoods fort collins" (4), "best places to live in fort collins" (3)
- **/blog/fort-collins-housing-market-mid-2026/**: "colorado" (1)
- **/chfa-down-payment-assistance/**: "chfa program colorado 2025" (8), "chfa first-time homebuyer colorado" (7), "chfa disability down payment colorado" (1)
- **/blog/weld-county-vs-larimer-county-buyer-guide/**: "buyers perspective" (1)
- **/cash-home-buyers/**: "cash offer homes littleton colorado" (3), "cash home buyers in colorado" (1), "colorado cash for keys colorado" (1)
*Report generated: 2026-08-03T14:31:25.426060*

## Lead attribution log

Week of 2026-07-27:

| Landing Page | GSC Impressions | Position | GA4 Leads | Gap? | CRO Action |
|---|---|---|---|---|---|
| /chfa-schools-to-home/ | 268 | 8.9 | 0 | ⚠️ | Add program-specific lead form CTA after hero; tighten form fields |
| /blog/cash-home-buyers-fort-collins-northern-colorado/ | 117 | 18.0 | 0 | ⚠️ | Add inline CTA + end-of-post lead magnet (market report / buyer guide) |
| /colorado-champions-home-loan-program/ | 66 | 34.5 | 0 | ⚠️ | Add prominent CTA section + exit-intent popup |
| /blog/best-neighborhoods-fort-collins-2026/ | 58 | 30.1 | 0 | ⚠️ | Add inline CTA + end-of-post lead magnet (market report / buyer guide) |
| /blog/seller-concession-cheat-sheet-northern-colorado/ | 50 | 13.2 | 0 | ⚠️ | Add inline CTA + end-of-post lead magnet (market report / buyer guide) |
| /blog/fort-collins-vs-loveland-vs-windsor/ | 42 | 9.2 | 0 | ⚠️ | Add inline CTA + end-of-post lead magnet (market report / buyer guide) |
| /blog/fort-collins-housing-market-mid-2026/ | 40 | 8.2 | 0 | ⚠️ | Add inline CTA + end-of-post lead magnet (market report / buyer guide) |
| /blog/multigenerational-homes-northern-colorado-guide/ | 29 | 9.1 | 0 | ⚠️ | Add inline CTA + end-of-post lead magnet (market report / buyer guide) |
| /blog/is-windsor-colorado-expensive-to-live/ | 26 | 7.1 | 0 | ⚠️ | Add inline CTA + end-of-post lead magnet (market report / buyer guide) |
| /blog/weld-county-vs-larimer-county-buyer-guide/ | 26 | 9.8 | 0 | ⚠️ | Add inline CTA + end-of-post lead magnet (market report / buyer guide) |
| /chfa-down-payment-assistance/ | 26 | 57.2 | 0 | ⚠️ | Add program-specific lead form CTA after hero; tighten form fields |
| /blog/northern-colorado-market-update-august-2026/ | 23 | 8.3 | 0 | ⚠️ | Add inline CTA + end-of-post lead magnet (market report / buyer guide) |
| /blog/senior-downsizing-northern-colorado-guide/ | 21 | 16.1 | 0 | ⚠️ | Add inline CTA + end-of-post lead magnet (market report / buyer guide) |
| /blog/loveland-housing-market-mid-2026/ | 20 | 7.0 | 0 | ⚠️ | Add inline CTA + end-of-post lead magnet (market report / buyer guide) |
| /northern-colorado-areas/longmont/st-vrain-village/ | 19 | 12.9 | 0 | ⚠️ | Add city-specific market report CTA + neighborhood guide signup |
| / | 17 | 3.9 | 0 | ⚠️ | Review content-to-offer match; add contextual CTA |
| /northern-colorado-areas/loveland/mariana-butte/ | 16 | 11.4 | 0 | ⚠️ | Add city-specific market report CTA + neighborhood guide signup |
| /blog/chfa-down-payment-assistance-colorado-2026/ | 12 | 19.2 | 0 | ⚠️ | Add program-specific lead form CTA after hero; tighten form fields |
| /cash-home-buyers/ | 10 | 67.8 | 0 | ⚠️ | Review content-to-offer match; add contextual CTA |
| /blog/northern-colorado-19-cities-market-guide/ | 10 | 13.6 | 0 | ⚠️ | Add inline CTA + end-of-post lead magnet (market report / buyer guide) |

### Top queries by page

- **/chfa-schools-to-home/**: "chfa schools to home program" (45), "chfa schools to home" (35), "closing cost help for teachers colorado" (8)
- **/blog/cash-home-buyers-fort-collins-northern-colorado/**: "cash home buyers in fort collins" (4), "cash home buyer" (2), "cash home buyers" (2)
- **/colorado-champions-home-loan-program/**: "chfa approved lender colorado" (4), "chfa first generation program colorado" (2), "colorado champions home loan program" (2)
- **/blog/best-neighborhoods-fort-collins-2026/**: "best neighborhoods in fort collins" (8), "best neighborhoods fort collins" (4), "best places to live in fort collins" (3)
- **/blog/fort-collins-housing-market-mid-2026/**: "colorado" (1)
- **/blog/weld-county-vs-larimer-county-buyer-guide/**: "buyers perspective" (1)
- **/chfa-down-payment-assistance/**: "chfa program colorado 2025" (8), "chfa first-time homebuyer colorado" (7), "chfa disability down payment colorado" (1)
- **/cash-home-buyers/**: "cash offer homes littleton colorado" (3), "cash home buyers in colorado" (1), "colorado cash for keys colorado" (1)
*Report generated: 2026-08-03T18:21:44.244460*

## Lead attribution log

Week of 2026-07-27:

| Landing Page | GSC Impressions | Position | GA4 Leads | Gap? | CRO Action |
|---|---|---|---|---|---|
| /chfa-schools-to-home/ | 268 | 8.9 | 0 | ⚠️ | Add program-specific lead form CTA after hero; tighten form fields |
| /blog/cash-home-buyers-fort-collins-northern-colorado/ | 117 | 18.0 | 0 | ⚠️ | Add inline CTA + end-of-post lead magnet (market report / buyer guide) |
| /colorado-champions-home-loan-program/ | 66 | 34.5 | 0 | ⚠️ | Add prominent CTA section + exit-intent popup |
| /blog/best-neighborhoods-fort-collins-2026/ | 58 | 30.1 | 0 | ⚠️ | Add inline CTA + end-of-post lead magnet (market report / buyer guide) |
| /blog/seller-concession-cheat-sheet-northern-colorado/ | 50 | 13.2 | 0 | ⚠️ | Add inline CTA + end-of-post lead magnet (market report / buyer guide) |
| /blog/fort-collins-vs-loveland-vs-windsor/ | 42 | 9.2 | 0 | ⚠️ | Add inline CTA + end-of-post lead magnet (market report / buyer guide) |
| /blog/fort-collins-housing-market-mid-2026/ | 40 | 8.2 | 0 | ⚠️ | Add inline CTA + end-of-post lead magnet (market report / buyer guide) |
| /blog/multigenerational-homes-northern-colorado-guide/ | 29 | 9.1 | 0 | ⚠️ | Add inline CTA + end-of-post lead magnet (market report / buyer guide) |
| /chfa-down-payment-assistance/ | 26 | 57.2 | 0 | ⚠️ | Add program-specific lead form CTA after hero; tighten form fields |
| /blog/weld-county-vs-larimer-county-buyer-guide/ | 26 | 9.8 | 0 | ⚠️ | Add inline CTA + end-of-post lead magnet (market report / buyer guide) |
| /blog/is-windsor-colorado-expensive-to-live/ | 26 | 7.1 | 0 | ⚠️ | Add inline CTA + end-of-post lead magnet (market report / buyer guide) |
| /blog/northern-colorado-market-update-august-2026/ | 23 | 8.3 | 0 | ⚠️ | Add inline CTA + end-of-post lead magnet (market report / buyer guide) |
| /blog/senior-downsizing-northern-colorado-guide/ | 21 | 16.1 | 0 | ⚠️ | Add inline CTA + end-of-post lead magnet (market report / buyer guide) |
| /blog/loveland-housing-market-mid-2026/ | 20 | 7.0 | 0 | ⚠️ | Add inline CTA + end-of-post lead magnet (market report / buyer guide) |
| /northern-colorado-areas/longmont/st-vrain-village/ | 19 | 12.9 | 0 | ⚠️ | Add city-specific market report CTA + neighborhood guide signup |
| / | 17 | 3.9 | 0 | ⚠️ | Review content-to-offer match; add contextual CTA |
| /northern-colorado-areas/loveland/mariana-butte/ | 16 | 11.4 | 0 | ⚠️ | Add city-specific market report CTA + neighborhood guide signup |
| /blog/chfa-down-payment-assistance-colorado-2026/ | 12 | 19.2 | 0 | ⚠️ | Add program-specific lead form CTA after hero; tighten form fields |
| /blog/northern-colorado-19-cities-market-guide/ | 10 | 13.6 | 0 | ⚠️ | Add inline CTA + end-of-post lead magnet (market report / buyer guide) |
| /cash-home-buyers/ | 10 | 67.8 | 0 | ⚠️ | Review content-to-offer match; add contextual CTA |

### Top queries by page

- **/chfa-schools-to-home/**: "chfa schools to home program" (45), "chfa schools to home" (35), "closing cost help for teachers colorado" (8)
- **/blog/cash-home-buyers-fort-collins-northern-colorado/**: "cash home buyers in fort collins" (4), "cash home buyer" (2), "cash home buyers" (2)
- **/colorado-champions-home-loan-program/**: "chfa approved lender colorado" (4), "chfa first generation program colorado" (2), "colorado champions home loan program" (2)
- **/blog/best-neighborhoods-fort-collins-2026/**: "best neighborhoods in fort collins" (8), "best neighborhoods fort collins" (4), "best places to live in fort collins" (3)
- **/blog/fort-collins-housing-market-mid-2026/**: "colorado" (1)
- **/chfa-down-payment-assistance/**: "chfa program colorado 2025" (8), "chfa first-time homebuyer colorado" (7), "chfa disability down payment colorado" (1)
- **/blog/weld-county-vs-larimer-county-buyer-guide/**: "buyers perspective" (1)
- **/cash-home-buyers/**: "cash offer homes littleton colorado" (3), "cash home buyers in colorado" (1), "colorado cash for keys colorado" (1)
*Report generated: 2026-08-03T18:21:55.584700*

## Lead attribution log

Week of 2026-07-27:

| Landing Page | GSC Impressions | Position | GA4 Leads | Gap? | CRO Action |
|---|---|---|---|---|---|
| /chfa-schools-to-home/ | 268 | 8.9 | 0 | ⚠️ | Add program-specific lead form CTA after hero; tighten form fields |
| /blog/cash-home-buyers-fort-collins-northern-colorado/ | 117 | 18.0 | 0 | ⚠️ | Add inline CTA + end-of-post lead magnet (market report / buyer guide) |
| /colorado-champions-home-loan-program/ | 66 | 34.5 | 0 | ⚠️ | Add prominent CTA section + exit-intent popup |
| /blog/best-neighborhoods-fort-collins-2026/ | 58 | 30.1 | 0 | ⚠️ | Add inline CTA + end-of-post lead magnet (market report / buyer guide) |
| /blog/seller-concession-cheat-sheet-northern-colorado/ | 50 | 13.2 | 0 | ⚠️ | Add inline CTA + end-of-post lead magnet (market report / buyer guide) |
| /blog/fort-collins-vs-loveland-vs-windsor/ | 42 | 9.2 | 0 | ⚠️ | Add inline CTA + end-of-post lead magnet (market report / buyer guide) |
| /blog/fort-collins-housing-market-mid-2026/ | 40 | 8.2 | 0 | ⚠️ | Add inline CTA + end-of-post lead magnet (market report / buyer guide) |
| /blog/multigenerational-homes-northern-colorado-guide/ | 29 | 9.1 | 0 | ⚠️ | Add inline CTA + end-of-post lead magnet (market report / buyer guide) |
| /chfa-down-payment-assistance/ | 26 | 57.2 | 0 | ⚠️ | Add program-specific lead form CTA after hero; tighten form fields |
| /blog/weld-county-vs-larimer-county-buyer-guide/ | 26 | 9.8 | 0 | ⚠️ | Add inline CTA + end-of-post lead magnet (market report / buyer guide) |
| /blog/is-windsor-colorado-expensive-to-live/ | 26 | 7.1 | 0 | ⚠️ | Add inline CTA + end-of-post lead magnet (market report / buyer guide) |
| /blog/northern-colorado-market-update-august-2026/ | 23 | 8.3 | 0 | ⚠️ | Add inline CTA + end-of-post lead magnet (market report / buyer guide) |
| /blog/senior-downsizing-northern-colorado-guide/ | 21 | 16.1 | 0 | ⚠️ | Add inline CTA + end-of-post lead magnet (market report / buyer guide) |
| /blog/loveland-housing-market-mid-2026/ | 20 | 7.0 | 0 | ⚠️ | Add inline CTA + end-of-post lead magnet (market report / buyer guide) |
| /northern-colorado-areas/longmont/st-vrain-village/ | 19 | 12.9 | 0 | ⚠️ | Add city-specific market report CTA + neighborhood guide signup |
| / | 17 | 3.9 | 0 | ⚠️ | Review content-to-offer match; add contextual CTA |
| /northern-colorado-areas/loveland/mariana-butte/ | 16 | 11.4 | 0 | ⚠️ | Add city-specific market report CTA + neighborhood guide signup |
| /blog/chfa-down-payment-assistance-colorado-2026/ | 12 | 19.2 | 0 | ⚠️ | Add program-specific lead form CTA after hero; tighten form fields |
| /blog/northern-colorado-19-cities-market-guide/ | 10 | 13.6 | 0 | ⚠️ | Add inline CTA + end-of-post lead magnet (market report / buyer guide) |
| /cash-home-buyers/ | 10 | 67.8 | 0 | ⚠️ | Review content-to-offer match; add contextual CTA |

### Top queries by page

- **/chfa-schools-to-home/**: "chfa schools to home program" (45), "chfa schools to home" (35), "closing cost help for teachers colorado" (8)
- **/blog/cash-home-buyers-fort-collins-northern-colorado/**: "cash home buyers in fort collins" (4), "cash home buyer" (2), "cash home buyers" (2)
- **/colorado-champions-home-loan-program/**: "chfa approved lender colorado" (4), "chfa first generation program colorado" (2), "colorado champions home loan program" (2)
- **/blog/best-neighborhoods-fort-collins-2026/**: "best neighborhoods in fort collins" (8), "best neighborhoods fort collins" (4), "best places to live in fort collins" (3)
- **/blog/fort-collins-housing-market-mid-2026/**: "colorado" (1)
- **/chfa-down-payment-assistance/**: "chfa program colorado 2025" (8), "chfa first-time homebuyer colorado" (7), "chfa disability down payment colorado" (1)
- **/blog/weld-county-vs-larimer-county-buyer-guide/**: "buyers perspective" (1)
- **/cash-home-buyers/**: "cash offer homes littleton colorado" (3), "cash home buyers in colorado" (1), "colorado cash for keys colorado" (1)
*Report generated: 2026-08-03T18:22:09.559284*

## Lead attribution log

Week of 2026-07-27:

| Landing Page | GSC Impressions | Position | GA4 Leads | Gap? | CRO Action |
|---|---|---|---|---|---|
| /chfa-schools-to-home/ | 268 | 8.9 | 0 | ⚠️ | Add program-specific lead form CTA after hero; tighten form fields |
| /blog/cash-home-buyers-fort-collins-northern-colorado/ | 117 | 18.0 | 0 | ⚠️ | Add inline CTA + end-of-post lead magnet (market report / buyer guide) |
| /colorado-champions-home-loan-program/ | 66 | 34.5 | 0 | ⚠️ | Add prominent CTA section + exit-intent popup |
| /blog/best-neighborhoods-fort-collins-2026/ | 58 | 30.1 | 0 | ⚠️ | Add inline CTA + end-of-post lead magnet (market report / buyer guide) |
| /blog/seller-concession-cheat-sheet-northern-colorado/ | 50 | 13.2 | 0 | ⚠️ | Add inline CTA + end-of-post lead magnet (market report / buyer guide) |
| /blog/fort-collins-vs-loveland-vs-windsor/ | 42 | 9.2 | 0 | ⚠️ | Add inline CTA + end-of-post lead magnet (market report / buyer guide) |
| /blog/fort-collins-housing-market-mid-2026/ | 40 | 8.2 | 0 | ⚠️ | Add inline CTA + end-of-post lead magnet (market report / buyer guide) |
| /blog/multigenerational-homes-northern-colorado-guide/ | 29 | 9.1 | 0 | ⚠️ | Add inline CTA + end-of-post lead magnet (market report / buyer guide) |
| /blog/is-windsor-colorado-expensive-to-live/ | 26 | 7.1 | 0 | ⚠️ | Add inline CTA + end-of-post lead magnet (market report / buyer guide) |
| /blog/weld-county-vs-larimer-county-buyer-guide/ | 26 | 9.8 | 0 | ⚠️ | Add inline CTA + end-of-post lead magnet (market report / buyer guide) |
| /chfa-down-payment-assistance/ | 26 | 57.2 | 0 | ⚠️ | Add program-specific lead form CTA after hero; tighten form fields |
| /blog/northern-colorado-market-update-august-2026/ | 23 | 8.3 | 0 | ⚠️ | Add inline CTA + end-of-post lead magnet (market report / buyer guide) |
| /blog/senior-downsizing-northern-colorado-guide/ | 21 | 16.1 | 0 | ⚠️ | Add inline CTA + end-of-post lead magnet (market report / buyer guide) |
| /blog/loveland-housing-market-mid-2026/ | 20 | 7.0 | 0 | ⚠️ | Add inline CTA + end-of-post lead magnet (market report / buyer guide) |
| /northern-colorado-areas/longmont/st-vrain-village/ | 19 | 12.9 | 0 | ⚠️ | Add city-specific market report CTA + neighborhood guide signup |
| / | 17 | 3.9 | 0 | ⚠️ | Review content-to-offer match; add contextual CTA |
| /northern-colorado-areas/loveland/mariana-butte/ | 16 | 11.4 | 0 | ⚠️ | Add city-specific market report CTA + neighborhood guide signup |
| /blog/chfa-down-payment-assistance-colorado-2026/ | 12 | 19.2 | 0 | ⚠️ | Add program-specific lead form CTA after hero; tighten form fields |
| /blog/northern-colorado-19-cities-market-guide/ | 10 | 13.6 | 0 | ⚠️ | Add inline CTA + end-of-post lead magnet (market report / buyer guide) |
| /cash-home-buyers/ | 10 | 67.8 | 0 | ⚠️ | Review content-to-offer match; add contextual CTA |

### Top queries by page

- **/chfa-schools-to-home/**: "chfa schools to home program" (45), "chfa schools to home" (35), "closing cost help for teachers colorado" (8)
- **/blog/cash-home-buyers-fort-collins-northern-colorado/**: "cash home buyers in fort collins" (4), "cash home buyer" (2), "cash home buyers" (2)
- **/colorado-champions-home-loan-program/**: "chfa approved lender colorado" (4), "chfa first generation program colorado" (2), "colorado champions home loan program" (2)
- **/blog/best-neighborhoods-fort-collins-2026/**: "best neighborhoods in fort collins" (8), "best neighborhoods fort collins" (4), "best places to live in fort collins" (3)
- **/blog/fort-collins-housing-market-mid-2026/**: "colorado" (1)
- **/blog/weld-county-vs-larimer-county-buyer-guide/**: "buyers perspective" (1)
- **/chfa-down-payment-assistance/**: "chfa program colorado 2025" (8), "chfa first-time homebuyer colorado" (7), "chfa disability down payment colorado" (1)
- **/cash-home-buyers/**: "cash offer homes littleton colorado" (3), "cash home buyers in colorado" (1), "colorado cash for keys colorado" (1)
*Report generated: 2026-08-03T18:22:11.477129*

## Daily Ranking Strike — 2026-08-03

### Rank Drop Alerts

| Query | Previous Pos | Current Pos | Drop | Impressions |
|-------|-------------|-------------|------|-------------|
| johnstown CO real estate | 13.5 | DISAPPEARED | - | 0 |

### ⚠️ P0 — Pages No Longer Indexed

| Page | Previous Impressions | Previous Clicks | Top Queries |
|------|---------------------|-----------------|-------------|
| https://saahomes.com/northern-colorado-areas/wellington/wellington-village/ | 21 | 1 | wellington village home coverage, wellington village home policy, wellington village |
| https://saahomes.com/northern-colorado-areas/loveland/sculpture-park-loveland/ | 12 | 0 | benson sculpture garden, garden loveland co, loveland colorado sculpture park |
| https://saahomes.com/northern-colorado-areas/mead/mead-crossing/ | 8 | 0 | mead crossing homes, mead crossing |

*Report generated: 2026-08-03T18:26:00.013084*

---

## Resolved flags (verified 2026-08-03 — DO NOT re-flag)

- ✅ **Schema duplication: FIXED** — live FC page verified 5 JSON-LD blocks / 5 unique types (RealEstateAgent, WebSite, WebPage, BreadcrumbList, FAQPage). Jul 13 fix holds. Only flag if a NEW duplicate appears.
- ✅ **CHFA sections: PRESENT on all cities** — Loveland 15 refs, Windsor 16, Timnath 14 (verified live Aug 3). The Aug 1 scorecard "missing CHFA" flags were stale.
- ✅ **Timnath FAQ crash: FIXED** on main (imports present). Verified live.
- ✅ **Orphaned bridle-ridge link: GONE** — no reference in src/ (verified Aug 3).
- ✅ **Tagline divergence: FIXED** — areaSeo.js synced with live hero taglines for Loveland/Windsor/Greeley (Aug 3).
- ✅ **GSC totals now accurate** — page-dimension query (query+page redacts ~80%). Real numbers: 28-day 6,344 imp / 46 clicks; 90-day 10,264 / 70.
- ✅ **GA4 lead query fixed** — queries both generate_lead + saa_lead_submit.

## Competitor intel (2026-08-03)

- **Kittle Real Estate** = volume threat: 10,246 URLs (~8,900 IDX listing shells + 190 blog posts), ~2 posts/day, farming "best realtor {city}" for Timnath/Johnstown/Berthoud. We lack those pages — content gap to counter. Full profile in competitor-content-watch skill references.
- **All Avenue** = content cadence threat (3-4 posts/mo), publishing Jul 30 Timnath + Jul 28 closing day + Jul 23 school relocation.

## Daily Ranking Strike — 2026-08-10

### ⚠️ P0 — Pages No Longer Indexed

| Page | Previous Impressions | Previous Clicks | Top Queries |
|------|---------------------|-----------------|-------------|
| https://saahomes.com/northern-colorado-areas/firestone/barefoot-lakes-firestone/ | 7 | 0 | barefoot colorado, barefoot land, barefoot lakes park |
| https://saahomes.com/northern-colorado-areas/loveland/northgate-loveland/ | 5 | 0 | northgate apartments |
| https://saahomes.com/northern-colorado-areas/wellington/timber-ridge-wellington/ | 5 | 0 | timber ridge neighborhood, timberidge, timberridge |

*Report generated: 2026-08-10T13:23:08.234592*

## Lead attribution log

Week of 2026-08-03:

| Landing Page | GSC Impressions | Position | GA4 Leads | Gap? | CRO Action |
|---|---|---|---|---|---|
| /chfa-schools-to-home/ | 233 | 8.9 | 0 | ⚠️ | Add program-specific lead form CTA after hero; tighten form fields |
| /chfa-down-payment-assistance/ | 149 | 65.1 | 0 | ⚠️ | Add program-specific lead form CTA after hero; tighten form fields |
| /blog/cash-home-buyers-fort-collins-northern-colorado/ | 145 | 11.4 | 0 | ⚠️ | Add inline CTA + end-of-post lead magnet (market report / buyer guide) |
| /colorado-champions-home-loan-program/ | 84 | 30.4 | 0 | ⚠️ | Add prominent CTA section + exit-intent popup |
| /blog/northern-colorado-market-update-august-2026/ | 45 | 6.2 | 0 | ⚠️ | Add inline CTA + end-of-post lead magnet (market report / buyer guide) |
| /blog/seller-concession-cheat-sheet-northern-colorado/ | 38 | 21.1 | 0 | ⚠️ | Add inline CTA + end-of-post lead magnet (market report / buyer guide) |
| /blog/best-neighborhoods-fort-collins-2026/ | 34 | 33.9 | 0 | ⚠️ | Add inline CTA + end-of-post lead magnet (market report / buyer guide) |
| /blog/fort-collins-vs-loveland-vs-windsor/ | 32 | 6.9 | 0 | ⚠️ | Add inline CTA + end-of-post lead magnet (market report / buyer guide) |
| /northern-colorado-areas/longmont/st-vrain-village/ | 28 | 28.5 | 0 | ⚠️ | Add city-specific market report CTA + neighborhood guide signup |
| /blog/weld-county-vs-larimer-county-buyer-guide/ | 26 | 6.0 | 0 | ⚠️ | Add inline CTA + end-of-post lead magnet (market report / buyer guide) |
| /blog/colorado-champions-home-loan-first-responders/ | 23 | 53.3 | 0 | ⚠️ | Add inline CTA + end-of-post lead magnet (market report / buyer guide) |
| /northern-colorado-areas/loveland/mariana-butte/ | 16 | 6.8 | 0 | ⚠️ | Add city-specific market report CTA + neighborhood guide signup |
| /blog/fort-collins-luxury-neighborhoods-guide/ | 15 | 12.1 | 0 | ⚠️ | Add inline CTA + end-of-post lead magnet (market report / buyer guide) |
| /blog/northern-colorado-events-guide-2026/ | 14 | 11.5 | 0 | ⚠️ | Add inline CTA + end-of-post lead magnet (market report / buyer guide) |
| /blog/is-windsor-colorado-expensive-to-live/ | 12 | 7.2 | 0 | ⚠️ | Add inline CTA + end-of-post lead magnet (market report / buyer guide) |
| /cash-home-buyers/ | 11 | 73.7 | 0 | ⚠️ | Review content-to-offer match; add contextual CTA |
| /blog/chfa-down-payment-assistance-colorado-2026/ | 10 | 14.9 | 0 | ⚠️ | Add program-specific lead form CTA after hero; tighten form fields |
| / | 10 | 6.2 | 0 | ⚠️ | Review content-to-offer match; add contextual CTA |
| /blog/luxury-home-buying-guide-northern-colorado/ | 9 | 9.9 | 0 | 🔶 | Add inline CTA + end-of-post lead magnet (market report / buyer guide) |
| /northern-colorado-areas/ | 7 | 23.6 | 0 | 🔶 | Add city-specific market report CTA + neighborhood guide signup |

### Top queries by page

- **/chfa-schools-to-home/**: "chfa schools to home" (38), "chfa school to home program" (5), "chfa school to home" (1)
- **/chfa-down-payment-assistance/**: "chfa program colorado 2025" (6), "chfa first-time homebuyer colorado" (4), "chfa disability down payment colorado" (3)
- **/blog/cash-home-buyers-fort-collins-northern-colorado/**: "expert cash buyers" (31), "cashforhomesnow.com" (9), "cash home buyers in fort collins" (7)
- **/colorado-champions-home-loan-program/**: "colorado champions home loan program" (6), "chfa approved lender colorado" (6), "chfa first generation program colorado" (2)
- **/blog/best-neighborhoods-fort-collins-2026/**: "best neighborhoods in fort collins" (6), "best neighborhoods fort collins" (2), "best places to live in fort collins" (1)
- **/cash-home-buyers/**: "cash for houses arapahoe county co" (1)
- **/blog/chfa-down-payment-assistance-colorado-2026/**: "chfa first gen grant amount 2025" (1)
*Report generated: 2026-08-10T14:32:30.529664*

## Daily Ranking Strike — 2026-08-13

### ⚠️ P0 — Pages No Longer Indexed

| Page | Previous Impressions | Previous Clicks | Top Queries |
|------|---------------------|-----------------|-------------|
| https://saahomes.com/northern-colorado-areas/firestone/barefoot-lakes-firestone/ | 5 | 0 | barefoot lakes park, barefoot lakes by richmond american homes, barefoot colorado |
| https://saahomes.com/northern-colorado-areas/loveland/northgate-loveland/ | 5 | 0 | northgate apartments |

*Report generated: 2026-08-13T13:10:16.051979*

## Daily Ranking Strike — 2026-08-13

### ⚠️ P0 — Pages No Longer Indexed

| Page | Previous Impressions | Previous Clicks | Top Queries |
|------|---------------------|-----------------|-------------|
| https://saahomes.com/northern-colorado-areas/firestone/barefoot-lakes-firestone/ | 5 | 0 | barefoot colorado, barefoot lakes park, barefoot lakes firestone |
| https://saahomes.com/northern-colorado-areas/loveland/northgate-loveland/ | 5 | 0 | northgate apartments |

*Report generated: 2026-08-13T13:11:22.491499*

## GEO AUDIT SCORECARD (2026-08-13)

- Area pages with FAQPage schema: 19/19 deployed
- City FAQ pairs: 19 cities, 2-6 pairs each
- ForBuyers FAQPage schema: Yes (deployed, 6 FAQ pairs)
- ForSellers FAQPage schema: Yes (deployed, FAQ pairs)
- Properties FAQPage + ItemList: Yes (deployed)
- CHFA page FAQPage + HowTo + ItemList (prerendered): Yes (/chfa-down-payment-assistance/)
- Veterans / Cash Buyers / Luxury FAQPage: Yes (deployed)
- Homepage/About/Contact AggregateRating + Review: Yes (6 real Google reviews, 5.0 avg, prerendered)
- Listing RealEstateListing + availability (MLS status mapping): Yes (InStock/LimitedAvailability/OutOfStock/Discontinued)
- Blog posts with FAQPage schema: 23/64 before audit -> 31/64 after (8 posts + 36 FAQ pairs added)
- PR shipped: hermes/seo-2026-08-13-geo-blog-faqs
- Next gap: 33 blog posts still lack FAQPage schema (older/market-update posts); CHFA SchoolsToHome/Champions/G-Hope FAQPage in prerendered HTML; competitor GEO tracking
