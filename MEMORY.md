# MEMORY — saahomes.com GSC Monitor


## Daily Ranking Strike — 2026-06-26

✅ No regressions detected.

*Report generated: 2026-06-26T13:04:22.503909*

## Daily Ranking Strike — 2026-07-02

✅ No regressions detected.

*Report generated: 2026-07-02T13:03:30.863529*

## Content calendar state

last_social_pack_date: 2026-08-01
last_social_pillar: community
rotation_week_index: 1
last_3_social_hooks: ["Sculpture in the Park returns to Loveland Aug 7–9 — one of the largest outdoor sculpture shows in the country. Great weekend to explore the Sweetheart City."]
monthly_market_blog_url: https://saahomes.com/blog/northern-colorado-market-update-july-2026/
blogs_published_this_month: 0
pending_social_packs: []
latest_market_update_slug: northern-colorado-market-update-july-2026
last_events_check_date: 2026-08-01
next_notable_event: Sculpture in the Park — Loveland, Aug 7–9, 2026
events_guide_last_refresh: 2026-06-29
latest_events_guide_slug: northern-colorado-events-guide-2026
events_social_packs_this_quarter: 1

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
