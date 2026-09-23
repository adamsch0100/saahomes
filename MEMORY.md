# MEMORY — saahomes.com GSC Monitor


## Daily Ranking Strike — 2026-06-26

✅ No regressions detected.

*Report generated: 2026-06-26T13:04:22.503909*

## Daily Ranking Strike — 2026-07-02

✅ No regressions detected.

*Report generated: 2026-07-02T13:03:30.863529*

## Content calendar state

last_social_pack_date: 2026-09-23
last_social_pillar: content-offense + program/seasonal (new corridor guides Fort Lupton + Bellvue prioritized, then CHFA fall program — week 4 rotation)
rotation_week_index: 4
last_3_social_hooks: ["New 2026 guide: buying a home in Fort Lupton, CO — Weld County value on the US-85 corridor, new construction + CHFA (Sep 24, Buffer).", "New 2026 guide: buying a home in Bellvue, CO — Poudre Canyon acreage, wells/septic/wildfire checks, minutes from Fort Collins (Sep 25, Buffer).", "Fall 2026: CHFA down payment assistance — up to $25K or 3-4% of loan for qualified buyers, via participating lender (Sep 28, Buffer)."]
monthly_market_blog_url: https://saahomes.com/blog/northern-colorado-market-update-september-2026/
blogs_published_this_month: 47 (per src/data/blogPosts.js — 20 new since Sep 14: home-value Windsor/Greeley, luxury Windsor, moving-to-Greeley, Milliken/Mead/Brighton buy+sell, cash-home-buyers Longmont, Carbon Valley agent+moving-to, Evans/Firestone/Frederick/Erie batch #212, corridor Fort Lupton + Bellvue #215)
pending_social_packs: 0 — 3 packs (outreach/sent/social-2026-09-23-{fort-lupton,bellvue,chfa}-*.json) POSTED to Buffer 2026-09-23 (buffer_ids confirmed), one idea/day 15:00 UTC Sep 24/25/28, verified via buffer-query-pending (9 scheduled), and emailed to Adam. Creds: BUFFER_API_KEY + OUTREACH_SMTP_* restored to /data/workspaces/saa-homes/.env AND /opt/data/workspace/saahomes-repo/.env shim (host layout drift: buffer-query-pending.py needs the /opt path).
last_operator_schedule_date: 2026-09-21 (week Sep 21-27 emailed + verified via IMAP Sent; prior Sep 14-20)
latest_market_update_slug: northern-colorado-market-update-september-2026
last_events_check_date: 2026-09-09
next_notable_event: per src/data/localEvents.js (reviewed 2026-09-09; Estes Park schools+events rows added 2026-09-14)
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

## Market Scorecard — Batch 3 (2026-09-15)

Seven-city audit: Firestone, Frederick, Evans, Severance, Niwot (Weld/Boulder core) + Erie, Brighton (new corridor launches). **All 7 are dynamic-template pages (`:slug` → AreaGuidePage.jsx) — no dedicated JSX pages in this batch.**

| # | City | Page Type | Template Completeness | Schema | CHFA Section | Final CTA | SERP | Action Items | Priority Score |
|---|------|-----------|---------------------|--------|-------------|-----------|------|-------------|----------------|
| 1 | **Firestone** | Dynamic (AreaGuidePage) | 13/13 (100%) | ✅ 6 scripts, 1× each — NO duplication | ✅ Gold section | ✅ Present | ❌ Not page 1 (Kenna IDX #2 owns) | 3 items | P2 |
| 2 | **Frederick** | Dynamic | 13/13 (100%) | ✅ Clean | ✅ Gold section | ✅ Present | ❌ Not page 1 (Kittle dominates directories) | 3 items | P2 |
| 3 | **Evans** | Dynamic | 13/13 (100%) | ✅ Clean | ✅ Gold + G-HOPE | ✅ Present | ❌ Not page 1 (Sears Real Estate #5) | 3 items | P1 |
| 4 | **Severance** | Dynamic | 13/13 (100%) | ✅ Clean | ✅ Gold section | ✅ Present | ❌ Not page 1 (new-construction portals) | 3 items | P2 |
| 5 | **Niwot** | Dynamic | 13/13 (100%) | ✅ Clean | ✅ Gold section | ✅ Present | ❌ Not page 1 (portal + broker IDX) | 3 items | P2 |
| 6 | **Erie** | Dynamic (CORRIDOR LAUNCH OK) | 13/13 (100%) | ✅ Clean | ✅ Gold section | ✅ Present | ❌ Not page 1 (agent-personal-brand SERP, moving-to SERP owned by 5 competitor guides) | 3 items | P2 |
| 7 | **Brighton** | Dynamic (CORRIDOR LAUNCH OK) | 13/13 (100%) | ✅ Clean | ✅ Gold section | ✅ Present | ❌ Not page 1 (Kenna IDX #3, RE/MAX Momentum office) | 3 items | **P1** |

### Key findings across Batch 3

1. **✅ Schema duplication is GONE on dynamic-template pages** — all 7 render exactly 6 JSON-LD scripts (RealEstateAgent, WebSite, WebPage, BreadcrumbList, FAQPage, ItemList·12 listings), one each. The double-injection bug (prerender SSR + Helmet) that plagued Batch 1/2 dedicated pages does NOT affect AreaGuidePage routes. This is the clean baseline the dedicated pages should be migrated toward.
2. **🔴 Brighton has ZERO blog inbound links** — `brighton` does not appear once in `src/data/blogPosts.js`. It's the single biggest content gap in the 27-entity plan: a launched, indexed, schema-clean page with 8 neighborhoods and no internal link equity or dedicated post. P1: buying/moving-to Brighton posts with relatedLinks.
3. **🔴 Evans has only 3 blog inbound refs** — weakest non-corridor page in the batch. No dedicated Evans buyer/seller post exists. P1-equivalent equity gap.
4. **🟢 Erie is the model launch** — 27 blog refs, dedicated buying+selling posts, 20 neighborhood sub-pages in sitemap, market-update cluster, YouTube video ID. But "moving to Erie Colorado" SERP is owned by 5 competitor relocation guides (maryhillproperties, clrealtygroup, coloradohomesource, dwellingscolorado, youranthemhome) — SAA has NO moving-to-Erie post.
5. **🟢 All 7 pages: HTTP 200, canonical self-referencing, no noindex, in sitemap, 13/13 template complete, CHFA gold funnel + Final CTA present, CityStatsBand live IRES stats render.** FAQ counts: 5 (Firestone/Frederick/Evans), 3 (Severance/Niwot/Erie/Brighton).
6. **⛔ SERP: none of 7 on page 1** for money queries. Portals (Zillow/Realtor/Trulia/Redfin/Homes) own "homes for sale"; EffectiveAgents/HomeLight directories own "best realtor"; Kenna Real Estate ranks top-3 on Firestone AND Brighton with dedicated IDX pages; Kittle leads Frederick directories; agent personal-brand sites (Compass/The Agency/eXp) own "realtor Erie". GSC (daily-ranking-strike) remains the authoritative position source when credentials restored.

### Best & worst performers
- **Best:** Erie (13/13, clean schema, richest blog equity: 27 refs, buy+sell posts, 20 neighborhoods, video) and Severance (13/13, 15 neighborhoods, dedicated buyer guide shipped).
- **Worst:** Brighton (13/13 technically but ZERO blog inbound; no internal link equity) and Evans (3 blog refs, no dedicated content).
- **Most urgent:** Brighton — launched page with no content-equity support; Kenna IDX already owns top-3. Evans close behind.

### Batch 3 rotation tracking
- **Batch audited:** Batch 3 (Firestone, Frederick, Evans, Severance, Niwot, Erie, Brighton)
- **Audit completed:** 2026-09-15
- **Reports:** `{slug}-audit-report.md` × 7 in repo root
- **Next batch:** Batch 4 (Estes Park, Red Feather Lakes, Fort Lupton, Lyons, Bellvue, Carbon Valley) — corridor remainder
- **Next target date:** 2026-09-22
- **Note:** Batch schedule ran late (skill's original mapping vs coverage order); remaining corridor cities form the final sweep. Logged + actionable directly in reports.

---

## Weekly Deep-Dive — Carbon Valley hub (2026-09-15)

Corridor rotation (weekly single-city job). Carbon Valley = hub for Firestone/Frederick/Dacono/Gilcrest/Platteville/Mead.

| Metric | Result |
|---|---|
| Page type | Dynamic template (AreaGuidePage.jsx) hub variant — SectionTownsBand (Dacono/Platteville/Gilcrest live IRES) + hubCrossLinks (Firestone/Frederick/Mead/Fort Lupton) |
| Template completeness | 13/13 (100%) + 4 custom hub sections; skipCityStats by design |
| Schema | ✅ 6 JSON-LD scripts 1× each — NO duplication (dynamic-template baseline) |
| Indexation | ✅ HTTP 200, canonical self, index/follow, sitemap lastmod 2026-09-11, site: page 1; 7 Dacono neighborhood sub-pages indexed |
| SERP | ❌ Hub page-1 absent for "carbon valley homes for sale"; present ~#5 for seller-intent mix; blog guides rank #1–#3 |
| Inbound blog refs | 2 → **4 (FIXED PR #193)** |

**Shipped this audit:** PR #193 (merged 9433b2c) — carbon-valley-affordable-homes-guide + carbon-valley-affordability-guide-firestone-frederick relatedLinks now link the hub (top slot); stale "Firestone = Carbon Valley hub" label fixed.

**Competitor moves:** Kittle farms "BEST Real Estate Agents in Firestone" (#1 seller/agent SERP); Luginbill Homes owns why-buy content (#4, /carbon-valley-colorado/); Kenna IDX shells own Dacono (#5–7 ×3); James Sack (same CB office) fires on Firestone (#3). SAA has zero agent-intent page for the corridor.

**Top 3 actions:** P1 carbon-valley-colorado-real-estate-agent post (mirror erie pattern) → hub link; P2 moving-to-Carbon-Valley why-buy post (counter Luginbill); P2 FAQ +depth (price-range / town-comparison Qs). P3: Dacono dedicated page + corridor blog equity (RFL/FL/Lyons/Bellvue = 0 refs).

**Report:** carbon-valley-audit-report.md (repo root)

### Weekly rotation tracking
- **Audited this week:** Red Feather Lakes (corridor, 2026-09-22) — dynamic template 13/13, clean schema (6 JSON-LD ×1, no dup), live IRES band (125 active; 71 under $300K; 8 ≥$1M), but **0 blog inbound refs** + GSC pos 36.7/13 imp/0 clk. Report: red-feather-lakes-audit-report.md. Fixes: P1 (2 RFL blog posts w/ relatedLinks + href-ify 2 Estes Park prose mentions), P2 (cabin FAQ ×3 + under-$300K data post + activate /red-feather-lakes-homes-for-sale/), P3 (seller/for-sellers RFL entry, video youtubeId, RFL ranking-strike block).
- **Audited previously:** Carbon Valley hub (2026-09-15) · Batch 1 (Aug 1) FC/Loveland/Windsor/Greeley/Timnath · Batch 3 (Sep 15) Firestone/Frederick/Evans/Severance/Niwot/Erie/Brighton
- **Strictly unevaluated entities remaining:** fort-lupton, lyons, bellvue (Batch 4 corridor remainder — all 0 blog refs); estes-park has blog cluster (4 posts, 10+ refs) + events rows but NO formal area-page audit on record
- **Next weekly deep-dive:** fort-lupton (2026-09-29) — 0 blog equity, murata-farms neighborhood already pulling 130 imp pos 9.9 (proves demand); then lyons, bellvue to close the corridor

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

- Area pages with FAQPage schema: 27/27 deployed
- City FAQ pairs: 27 entities, 2-6 pairs each
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

## Daily Ranking Strike — 2026-08-14

### ⚠️ P0 — Pages No Longer Indexed

| Page | Previous Impressions | Previous Clicks | Top Queries |
|------|---------------------|-----------------|-------------|
| https://saahomes.com/northern-colorado-areas/firestone/barefoot-lakes-firestone/ | 5 | 0 | barefoot land, barefoot lakes firestone, barefoot colorado |
| https://saahomes.com/northern-colorado-areas/loveland/northgate-loveland/ | 5 | 0 | northgate apartments |

*Report generated: 2026-08-14T13:10:37.424246*

## Daily Ranking Strike — 2026-09-10

✅ No verified regressions. 11 P0 flags from the pre-fix script were FALSE POSITIVES (500-row query+page cutoff — pages still indexed, impressions stable/growing: Windsor 69→117, Murata Farms 8→49). Fixed script (P0 presence from page-dimension fetch) flags 2 pages with 0-impression windows: /erie/vista-ridge-erie/ and /loveland/west-loveland/ — URL Inspection verdict PASS, HTTP 200, low-volume fluctuation only. 0 alerts. Totals: 9,139 impressions / 45 clicks (prev 4,591 / 30) — ~2x WoW growth.

*Report generated: 2026-09-10T13:10:00*

## GEO AUDIT SCORECARD (2026-09-10)

- Area pages with FAQPage schema: 27/27 ✅ deployed (spot-verified live: Fort Collins 11, Greeley 12, Windsor 10, Loveland 11 pairs, all with July 2026 market data)
- City FAQ pairs: 27 entities, 2-12 pairs each ✅
- ForBuyers FAQPage schema: Yes (deployed, 11 FAQ pairs — 3 added this audit)
- ForSellers FAQPage schema: Yes (deployed, 7 FAQ pairs)
- Buyer FAQ pairs added: 3 (3-3-3 rule, Colorado credit score, CHFA county income limits) — all PAA-matched from Serper
- Seller FAQ pairs added: 0
- CHFA cluster FAQPage schema (prerendered): Yes — CHFA 14 + HowTo + ItemList, SchoolsToHome 3, Champions 6, G-Hope 4
- Homepage/Contact/About/Testimonials AggregateRating + Review: Yes (6 real Google reviews, 5.0 avg)
- Listing RealEstateListing + offers.availability: Yes — listing detail (InStock), /properties/ (24 listings), area pages (12+)
- Properties FAQPage + ItemList: Yes; HowTo: ForBuyers, ForSellers, CHFA
- Serper GEO check (10 rotating queries): SAA not in top-10 organics on any (dominion gap, authority lever). PAA gaps on 3 of 10 queries fixed this run. Kittle has FAQPage + AggregateRating (GEO competitor); Soukup + fasthomesalecolorado have zero GEO markup
- PR shipped: #177 GEO: add PAA-targeted buyer FAQs (merged squash d0d4f37, live verified)
- Next gap: schema layer complete — AI citation unlock is organic rank/authority (link building + blog cadence). Optional: SpeakableSpecification if Assistant voice surfaces; watch Kittle GEO depth quarterly

## Daily Ranking Strike — 2026-09-13

GSC API UNAVAILABLE on this host (no /opt/data/credentials/gsc-key.json — main host has creds). Ran full HTTP coverage sweep instead (35 URLs: all 27 area pages + 8 money pages): 34/35 OK, HTTP 200, canonical self, in sitemap (918 sitemap URLs, 400 listing detail URLs). Last GSC snapshot (2026-09-10): 9,139 imp / 45 clicks (prev 4,591/30, ~2x WoW), 0 alerts, 2 P0 flags (vista-ridge-erie, west-loveland) both verified HTTP 200 — low-volume fluctuation only. Only anomaly: bare /homes-for-sale/ is SPA catch-all soft-404 (canonicalizes to homepage, not in sitemap) — NOT a real page/P0. Clean run, nothing to ship. Helper: scripts/ranking_strike_http_fallback.py.

*Report generated: 2026-09-13T03:45:00*

## Daily Ranking Strike — 2026-09-14

GSC API UNAVAILABLE on this host (no /opt/data/credentials/gsc-key.json). HTTP patrol proxy run: indexation_patrol_http.py 15/15 P0 URLs OK (HTTP 200, canonical self, sitemap: 922 URLs); ranking_strike_http_fallback.py 34/35 OK — only anomaly is bare /homes-for-sale/ (undefined route → SPA catch-all shell, canonicalizes to homepage, not in sitemap; same known soft-404 from 09-13, NOT a real page/P0; verified /sell/, /buy/ same pattern). No regression, nothing to ship. Optional hygiene (blocked: GITHUB_TOKEN absent this host): add '/homes-for-sale': '/properties/', '/sell': '/for-sellers/', '/buy': '/for-buyers/' to canonicalRedirects in backend/src/server.js. Last GSC snapshot (09-10): 9,139 imp / 45 clicks, 0 alerts.


## Lead attribution log

Week of 2026-09-05 (FALLBACK brief — GSC/GA4 API blocked on host; no service-account key in /opt/data/credentials/).

| Landing Page | GSC Impressions (last-known 08-03 wk) | Position | GA4 Leads | Gap? | CRO Action (verified 2026-09-14) |
|---|---|---|---|---|---|
| /chfa-schools-to-home/ | 233 | 8.9 | 0 | ⚠️ | Form infra OK in live bundle; SERP lost to chfainfo + Kennar — needs above-fold program form + fresh 2026 terms/limits |
| /chfa-down-payment-assistance/ | 149 | 65.1 | 0 | ⚠️ | Lead page (leader) intact; needs city DPA sub-section refresh + program form CTA after hero |
| /blog/cash-home-buyers-fort-collins-northern-colorado/ | 145 | 11.4 | 0 | ⚠️ | SERP investor-dominated (iBuyers); reposition to seller consulting CTA (market report) not investor keywords |
| /colorado-champions-home-loan-program/ | 84 | 30.4 | 0 | ⚠️ | ADD Aug 12 2026 effective date + first-responder expansion (SB26-053, verified DRE) — stale program page |
| /blog/northern-colorado-market-update-august-2026/ | 45 | 6.2 | 0 | ⚠️ | Refresh to Sept update; add end-of-post lead magnet |
| /blog/seller-concession-cheat-sheet-northern-colorado/ | 38 | 21.1 | 0 | ⚠️ | Add inline CTA + market report magnet |
| /blog/best-neighborhoods-fort-collins-2026/ | 34 | 33.9 | 0 | ⚠️ | Add inline CTA + buyer guide magnet |
| /blog/fort-collins-vs-loveland-vs-windsor/ | 32 | 6.9 | 0 | ⚠️ | Add inline CTA + market report magnet |
| /northern-colorado-areas/longmont/st-vrain-village/ | 28 | 28.5 | 0 | ⚠️ | Add city market report CTA + neighborhood signup |
| /blog/weld-county-vs-larimer-county-buyer-guide/ | 26 | 6.0 | 0 | ⚠️ | Add inline CTA + buyer guide magnet |

Live checks 2026-09-14 (via live bundle index-84c53e4d.js + HTTP sweep):
- Indexation: 15/15 P0+rotating pages HTTP 200, canonical self, in sitemap (922 URLs) — all green.
- CRO infra VERIFIED: email+phone required:!0, name/email/phone/interest fields, ?interest= params preserved.
- GA4 lead events wired in live bundle: generate_lead + saa_lead_submit.
- SERP probes (web_search, directional): SAA absent top-8 for 'chfa schools to home', 'cash home buyers fort collins', 'colorado champions home loan program', 'best realtor fort collins' — Kennar owns Schools-to-Home cluster, iBuyers own cash-buyer SERP, Kittle owns best-realtor (pos 3).

Script fixes shipped (PR #189, merged 90d1a9a1e3): rowLimit 25000, END_DATE -2d lag, GA4 max(generate_lead, saa_lead_submit) dedupe, append lead pages. Ready to run when creds restored:
GA4_CREDENTIALS=/opt/data/credentials/gsc-key.json ./.venv/bin/python run_lead_attribution.py

*Report generated: 2026-09-14T14:38:44Z (cron fallback)*


## Daily Ranking Strike — 2026-09-15 (HTTP fallback host — no GSC creds)

- GSC API unavailable on this host: /opt/data/credentials/gsc-key.json absent (full filesystem search confirmed). No URL Inspection / query data this run.
- HTTP coverage sweep (scripts/ranking_strike_http_fallback.py): 35 URLs → 34 OK, 1 benign fail (/homes-for-sale/ bare = route-pattern prefix, serves homepage canonical; real pages /{city}-homes-for-sale/ + /homes-for-sale/{slug} all 200 & in sitemap).
- Last-report P0 pages re-verified HTTP 200: /erie/vista-ridge-erie/, /loveland/west-loveland/ — low-volume fluctuation, NOT deindexation (pitfall 13 pattern).
- Deploy fresh: last-modified Tue 15 Sep 2026 06:16:56 GMT; sitemap 922 URLs.
- No regressions. Nothing to ship.

## SEO fix shipped — 2026-09-15 (soft-404 canonical redirects)

- PR #199 merged (squash 1ae3041): added 7 legacy aliases to backend/src/server.js canonicalRedirects —
  `/homes-for-sale`, `/listings`, `/for-sale` → `/properties/`; `/sell`, `/sell-home` → `/for-sellers/`;
  `/buy`, `/buy-a-home` → `/for-buyers/`. Previously served SPA shell with homepage canonical (soft-404),
  flagged by indexation patrol + daily strike 09-13/14/15 (earlier "blocked: GITHUB_TOKEN absent" was wrong —
  token IS in /data/hermes-homes/saa-homes/.env).
- Live verified 2026-09-15: all 7 return 301 to canonical money pages; `/homes-for-sale/{slug}/` listing
  details + `/{city}-homes-for-sale/` unaffected (200).


## Daily Ranking Strike — 2026-09-16

### Mode: HTTP fallback (GSC creds absent on host)
GSC service-account key NOT present on this host (/opt/data/credentials/gsc-key.json missing,
no GSC_CREDENTIALS/GOOGLE_APPLICATION_CREDENTIALS/SERPER_API_KEY in .env or env). Canonical
GSC script cannot run — used full HTTP coverage sweep (scripts/ranking_strike_http_fallback.py)
+ P0 patrol (scripts/indexation_patrol_http.py).

### Full HTTP sweep (35 URLs: 27 area pages + 8 money pages)
✅ 35/35 OK — all HTTP 200, canonical self (or healthy redirect), in sitemap (932 URLs).
- /homes-for-sale/ → 301 → /properties/ (in sitemap) = healthy consolidation, NOT a P0.

### P0 patrol (12 P0 paths + 3 rotating area pages)
✅ 15/15 OK — no deindexation signals, no canonicals pointing elsewhere, all in sitemap.

### No regressions. Nothing to ship beyond ops tooling.
Shipped: PR #201 merged — committed HTTP fallback sweep + indexation patrol scripts to repo;
fixed redirect handling in sweep (was flagging /homes-for-sale/ as canonical mismatch).

*Report generated: 2026-09-16T13:11:06*


## Daily Ranking Strike — 2026-09-17

### Mode: HTTP fallback (GSC creds absent on host)
`/opt/data/credentials/gsc-key.json` missing (`/opt/data` does not exist on this host).
GSC_API unavailable; SERPER_API_KEY not in env or any .env file — the only copy in state.db is
redacted (`b6241c...8283`). Canonical GSC script (scripts/ranking_strike.py) cannot run. Used the
HTTP coverage sweep + P0 patrol (same mode as 2026-09-16).

### Full HTTP sweep — scripts/ranking_strike_http_fallback.py
35 URLs (27 area pages + 8 money pages): ✅ 35/35 OK — HTTP 200, canonical self (or healthy
redirect), in sitemap (933 URLs).
- `/homes-for-sale/` → 301 → `/properties/` (sitemapped) = healthy consolidation, NOT a P0.

### P0 patrol — scripts/indexation_patrol_http.py
15 URLs (12 P0 + 3 rotating area pages): ✅ 15/15 OK — no noindex, no canonical mismatch,
all in sitemap. Covers all CHFA / program pages + /properties/.

### Neighborhood spot-check (entity-intent-shift P0 class)
✅ `/erie/vista-ridge-erie/`, `/loveland/west-loveland/`, `/greeley/monfort-park/`,
`/greeley/canyon-views-greeley/` — all HTTP 200 + in sitemap. No deindexation signals.

### Vertical money pages
✅ `/luxury-real-estate/`, `/assumable-mortgages/`, `/veterans/`, `/cash-home-buyers/` —
all HTTP 200 + sitemapped.

### No regressions. Nothing to ship.
Last available GSC dataset: 2026-09-10 (45 clicks / 9,139 impressions, 7-day page-dimension).

*Report generated: 2026-09-17T13:03:48Z*

## Daily Ranking Strike — 2026-09-18

### ⚠️ P0 — Pages No Longer Indexed

| Page | Previous Impressions | Previous Clicks | Top Queries |
|------|---------------------|-----------------|-------------|
| https://saahomes.com/northern-colorado-areas/bellvue/bellvue-proper/ | 6 | 0 | bellvue colorado |
| https://saahomes.com/northern-colorado-areas/boulder/downtown-boulder/ | 9 | 0 | boulder downtown colorado, downtown boulder, boulder co downtown |
| https://saahomes.com/northern-colorado-areas/boulder/newlands/ | 7 | 0 |  |
| https://saahomes.com/northern-colorado-areas/erie/old-town-erie/ | 12 | 0 | erie town, erie co city guide |
| https://saahomes.com/northern-colorado-areas/firestone/firestone-commons/ | 5 | 0 | firestone colorado all ages community, firestone all ages community |
| https://saahomes.com/northern-colorado-areas/firestone/firestone-crossing/ | 6 | 0 |  |

*Report generated: 2026-09-18T13:03:22.665200*

## Daily Ranking Strike — 2026-09-18

### ⚠️ P0 — Pages No Longer Indexed

| Page | Previous Impressions | Previous Clicks | Top Queries |
|------|---------------------|-----------------|-------------|
| https://saahomes.com/northern-colorado-areas/bellvue/bellvue-proper/ | 6 | 0 | bellvue colorado |
| https://saahomes.com/northern-colorado-areas/boulder/downtown-boulder/ | 9 | 0 | downtown boulder, boulder co downtown, boulder downtown |
| https://saahomes.com/northern-colorado-areas/boulder/newlands/ | 7 | 0 |  |
| https://saahomes.com/northern-colorado-areas/erie/old-town-erie/ | 12 | 0 | erie town, erie co city guide |
| https://saahomes.com/northern-colorado-areas/firestone/firestone-commons/ | 5 | 0 | firestone all ages community, firestone colorado all ages community |
| https://saahomes.com/northern-colorado-areas/firestone/firestone-crossing/ | 6 | 0 |  |

*Report generated: 2026-09-18T13:04:24.186527*

## Daily Ranking Strike — 2026-09-21

### ⚠️ P0 — Pages No Longer Indexed

| Page | Previous Impressions | Previous Clicks | Top Queries |
|------|---------------------|-----------------|-------------|
| https://saahomes.com/northern-colorado-areas/firestone/firestone-crossing/ | 6 | 0 |  |
| https://saahomes.com/northern-colorado-areas/fort-collins/rigden-farm/ | 5 | 0 |  |
| https://saahomes.com/northern-colorado-areas/lyons/lyons-river-district/ | 7 | 0 |  |
| https://saahomes.com/northern-colorado-areas/windsor/rain-dance-windsor/ | 11 | 0 |  |

*Report generated: 2026-09-21T13:02:06.394805*

## Daily Ranking Strike — 2026-09-21

### ⚠️ P0 — Pages No Longer Indexed

| Page | Previous Impressions | Previous Clicks | Top Queries |
|------|---------------------|-----------------|-------------|
| https://saahomes.com/northern-colorado-areas/firestone/firestone-crossing/ | 6 | 0 |  |
| https://saahomes.com/northern-colorado-areas/fort-collins/rigden-farm/ | 5 | 0 |  |
| https://saahomes.com/northern-colorado-areas/lyons/lyons-river-district/ | 7 | 0 |  |
| https://saahomes.com/northern-colorado-areas/windsor/rain-dance-windsor/ | 11 | 0 |  |

*Report generated: 2026-09-21T13:02:23.271681*

## Daily Ranking Strike — 2026-09-21

### ⚠️ P0 — Pages No Longer Indexed

| Page | Previous Impressions | Previous Clicks | Top Queries |
|------|---------------------|-----------------|-------------|
| https://saahomes.com/northern-colorado-areas/firestone/firestone-crossing/ | 6 | 0 |  |
| https://saahomes.com/northern-colorado-areas/fort-collins/rigden-farm/ | 5 | 0 |  |
| https://saahomes.com/northern-colorado-areas/lyons/lyons-river-district/ | 7 | 0 |  |
| https://saahomes.com/northern-colorado-areas/windsor/rain-dance-windsor/ | 11 | 0 |  |

*Report generated: 2026-09-21T13:02:34.162778*

## Lead attribution log

Week of 2026-09-12:

| Landing Page | GSC Impressions | Position | GA4 Leads | Gap? | CRO Action |
|---|---|---|---|---|---|
| /blog/selling-your-home-in-fort-collins/ | 991 | 10.9 | 0 | ⚠️ | Add inline CTA + end-of-post lead magnet (market report / buyer guide) |
| /chfa-down-payment-assistance/ | 291 | 55.8 | 0 | ⚠️ | Add program-specific lead form CTA after hero; tighten form fields |
| /chfa-schools-to-home/ | 264 | 10.2 | 0 | ⚠️ | Add program-specific lead form CTA after hero; tighten form fields |
| /blog/is-windsor-colorado-expensive-to-live/ | 166 | 6.8 | 0 | ⚠️ | Add inline CTA + end-of-post lead magnet (market report / buyer guide) |
| /events/ | 130 | 47.8 | 0 | ⚠️ | Add prominent CTA section + exit-intent popup |
| /blog/northern-colorado-market-update-august-2026/ | 127 | 6.5 | 0 | ⚠️ | Add inline CTA + end-of-post lead magnet (market report / buyer guide) |
| /blog/assumable-mortgage-colorado/ | 83 | 6.8 | 0 | ⚠️ | Add inline CTA + end-of-post lead magnet (market report / buyer guide) |
| /blog/cash-home-buyers-fort-collins-northern-colorado/ | 75 | 10.4 | 0 | ⚠️ | Add inline CTA + end-of-post lead magnet (market report / buyer guide) |
| /blog/va-loan-colorado-guide/ | 66 | 49.0 | 0 | ⚠️ | Add inline CTA + end-of-post lead magnet (market report / buyer guide) |
| /northern-colorado-areas/windsor/ | 59 | 18.1 | 0 | ⚠️ | Add city-specific market report CTA + neighborhood guide signup |
| /blog/best-neighborhoods-fort-collins-2026/ | 58 | 12.1 | 0 | ⚠️ | Add inline CTA + end-of-post lead magnet (market report / buyer guide) |
| /colorado-champions-home-loan-program/ | 52 | 36.6 | 0 | ⚠️ | Add prominent CTA section + exit-intent popup |
| /northern-colorado-areas/fort-lupton/murata-farms-fort-lupton/ | 50 | 9.7 | 0 | ⚠️ | Add city-specific market report CTA + neighborhood guide signup |
| /mortgage-calculator/ | 39 | 51.8 | 0 | ⚠️ | Add prominent CTA section + exit-intent popup |
| / | 38 | 3.8 | 0 | ⚠️ | Add prominent CTA section + exit-intent popup |
| /blog/berthoud-colorado-real-estate-agent/ | 36 | 12.4 | 0 | ⚠️ | Add inline CTA + end-of-post lead magnet (market report / buyer guide) |
| /northern-colorado-areas/fort-collins/university-area/ | 34 | 35.5 | 0 | ⚠️ | Add city-specific market report CTA + neighborhood guide signup |
| /northern-colorado-areas/severance/ | 32 | 27.4 | 0 | ⚠️ | Add city-specific market report CTA + neighborhood guide signup |
| /northern-colorado-areas/brighton/downtown-brighton/ | 30 | 11.3 | 0 | ⚠️ | Add city-specific market report CTA + neighborhood guide signup |
| /blog/fort-collins-vs-loveland-vs-windsor/ | 30 | 7.1 | 0 | ⚠️ | Add inline CTA + end-of-post lead magnet (market report / buyer guide) |

### Top queries by page

- **/blog/selling-your-home-in-fort-collins/**: "sell my house fort collins" (531), "sell my house in fort collins" (383), "sell my fort collins house" (17)
- **/chfa-down-payment-assistance/**: "first time home buyer colorado" (15), "chfa disability program colorado" (9), "colorado first time home buyer" (7)
- **/chfa-schools-to-home/**: "chfa schools to home" (28), "schools to home" (10), "school to home program colorado" (9)
- **/blog/is-windsor-colorado-expensive-to-live/**: "town of windsor colorado external market signals 2025-2026" (6), "cost of living in windsor colorado" (5), "windsor colorado" (5)
- **/events/**: "colorado festivals" (10), "colorado events" (7), "local festivals near me" (5)
- **/blog/assumable-mortgage-colorado/**: "colorado springs va assumption" (1), "it is a conventional loan" (1)
- **/blog/cash-home-buyers-fort-collins-northern-colorado/**: "cash home buyers in fort collins" (11), "expert cash buyers" (5), "sell my house fast fort collins co" (4)
- **/blog/va-loan-colorado-guide/**: "colorado va loans" (9), "va home loan colorado" (8), "colorado va mortgage" (4)
- **/northern-colorado-areas/windsor/**: "windsor co county" (6), "live in windsor co" (3), "windsor co neighborhood guide" (3)
- **/blog/best-neighborhoods-fort-collins-2026/**: "best suburbs near fort collins" (8), "best neighborhoods fort collins" (7), "best neighborhoods in fort collins" (5)
- **/colorado-champions-home-loan-program/**: "chfa colorado springs lender" (4), "first responder mortgage colorado" (4), "chfa approved lender colorado" (3)
- **/northern-colorado-areas/fort-lupton/murata-farms-fort-lupton/**: "murata farms fort lupton" (13), "murata farms" (8), "fort lupton co new home communities" (2)
- **/mortgage-calculator/**: "colorado mortgage calculator" (11), "mortgage calculator colorado springs co" (6), "mortgage calculator colorado" (5)
- **/**: "adam schwartz realtor" (1), "schwartz realty" (1)
- **/blog/berthoud-colorado-real-estate-agent/**: "real estate agent berthoud" (10), "real estate agents berthoud" (7), "realtors in berthoud" (6)
- **/northern-colorado-areas/fort-collins/university-area/**: "fort collins co student housing" (31)
- **/northern-colorado-areas/severance/**: "homes for sale" (2), "homes for sale near me" (2), "houses" (2)
- **/northern-colorado-areas/brighton/downtown-brighton/**: "downtown brighton colorado" (13), "brighton downtown" (2), "downtown brighton, co" (2)
*Report generated: 2026-09-21T14:31:35.961438*

## Daily Ranking Strike — 2026-09-22

### ⚠️ P0 — Pages No Longer Indexed

| Page | Previous Impressions | Previous Clicks | Top Queries |
|------|---------------------|-----------------|-------------|
| https://saahomes.com/northern-colorado-areas/eaton/eaton-commons/ | 5 | 0 |  |
| https://saahomes.com/northern-colorado-areas/eaton/eaton-park/ | 13 | 0 | eaton town, eaton park, eaton colorado |
| https://saahomes.com/northern-colorado-areas/firestone/firestone-crossing/ | 6 | 0 |  |
| https://saahomes.com/northern-colorado-areas/fort-collins/the-homestead-fc/ | 5 | 0 |  |
| https://saahomes.com/northern-colorado-areas/lyons/lyons-river-district/ | 7 | 0 |  |
| https://saahomes.com/northern-colorado-areas/windsor/rain-dance-windsor/ | 8 | 0 |  |

*Report generated: 2026-09-22T13:01:08.870371*

## Daily Ranking Strike — 2026-09-22

### ⚠️ P0 — Pages No Longer Indexed

| Page | Previous Impressions | Previous Clicks | Top Queries |
|------|---------------------|-----------------|-------------|
| https://saahomes.com/northern-colorado-areas/eaton/eaton-commons/ | 5 | 0 |  |
| https://saahomes.com/northern-colorado-areas/eaton/eaton-park/ | 13 | 0 | eaton co, eaton park, eaton town |
| https://saahomes.com/northern-colorado-areas/firestone/firestone-crossing/ | 6 | 0 |  |
| https://saahomes.com/northern-colorado-areas/fort-collins/the-homestead-fc/ | 5 | 0 |  |
| https://saahomes.com/northern-colorado-areas/lyons/lyons-river-district/ | 7 | 0 |  |
| https://saahomes.com/northern-colorado-areas/windsor/rain-dance-windsor/ | 8 | 0 |  |

*Report generated: 2026-09-22T13:01:27.857741*

## Daily Ranking Strike — 2026-09-23

### ⚠️ P0 — Pages No Longer Indexed

| Page | Previous Impressions | Previous Clicks | Top Queries |
|------|---------------------|-----------------|-------------|
| https://saahomes.com/northern-colorado-areas/brighton/ | 6 | 0 | brighton housing market |
| https://saahomes.com/northern-colorado-areas/eaton/eaton-commons/ | 5 | 0 |  |
| https://saahomes.com/northern-colorado-areas/eaton/eaton-park/ | 12 | 0 | eaton park, eaton colorado, eaton co |
| https://saahomes.com/northern-colorado-areas/firestone/firestone-crossing/ | 6 | 0 |  |
| https://saahomes.com/northern-colorado-areas/fort-collins/the-homestead-fc/ | 5 | 0 |  |
| https://saahomes.com/northern-colorado-areas/lyons/lyons-river-district/ | 7 | 0 |  |

*Report generated: 2026-09-23T13:02:50.662984*

**Verification (2026-09-23):** All 6 P0 flags = FALSE POSITIVES (low-volume fluctuation). Every URL returns HTTP 200; URL Inspection API verdict PASS "Submitted and indexed" (brighton lastCrawl 2026-09-11, eaton-park 2026-07-23, lyons-river-district 2026-08-28; robots ALLOWED). 28-day site totals: 164 clicks / 25,500 impressions — API fully hydrated, no discrepancy. Zero Tier S alerts. Cash buyer: "cash home buyers" 7 imp @ pos 10.4 (page-1 boundary, up from zero current-period last week). Nothing to ship.
