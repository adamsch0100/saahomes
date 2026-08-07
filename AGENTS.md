# AGENTS.md — SAA Homes / saahomes.com

## THE GOAL (read first, always)

**Be the name Northern Colorado thinks of when buying or selling a home online.**
Own the full demand capture system for Larimer, Weld, and Boulder county real estate search.

**Every decision, every task, every line of code ships against this.**
Full strategy: `context/market-dominance-strategy.md` — READ IT before executing any SEO/content/conversion/backlink work. When in doubt, ask: *does this make saahomes.com the go-to place for people exploring, buying, or selling in Northern Colorado?*

## Four pillars (the how)

1. **Local organic search** — 27 city/region hub pages at `/northern-colorado-areas/{slug}/` (core 19 + corridor expansion) ranking for buyer AND seller intent; hub-and-spoke internal linking; CHFA program cluster dominance; 2–4 long-tail blogs/month
2. **GBP + local pack** — NAP consistency (`src/utils/seoConstants.js`), reviews, GBP posts
3. **On-site conversion** — every high-intent page has an intent-matched above-the-fold CTA; seller pages → free market report; form → PostgreSQL → Follow Up Boss pipeline never breaks
4. **Entity + trust (E-E-A-T)** — RealEstateAgent schema, Adam & Mandi bios, dated expert content, NO anonymous AI content

## Query tiers (priority order)

- **Tier S (weekly):** `{city} realtor` · `{city} real estate agent` · `{city} homes for sale` · `sell my home {city}` · `{city} CO real estate`
- **Tier A (bi-weekly):** CHFA + location · moving to {city} · best realtor {city} · {city} home values
- **Tier B/C (monthly):** neighborhoods, new construction, city comparisons, program niches → feed the cluster

## Hard rules

- **Data quality is non-negotiable** — never editorialize market data; only verifiable numbers from the live site
- **No mass-generated duplicate pages** (anti-pattern), no keyword stuffing, no fake urgency, Fair Housing compliance
- **No paid links/PBNs** — free/white-hat only
- **Conversation = conversion** — lead with conversational capture (chat, qualify CTAs); get them talking, get their info
- **Competitors:** Kittle (volume: IDX shells + aggressive blog cadence, farming "best realtor {city}") and All Avenue (content cadence). Beat them with depth, verified data, and testimonials — never by copying shells

## Reference files

- `context/market-dominance-strategy.md` — THE strategy
- `context/content-calendar.md` — blog + social pillars, weekly rotation
- `context/keyword-universe.md` — every city × intent we must win
- `src/data/areaSeo.js` — 19 city landing pages (primary local SEO weapon)
- `src/utils/seoConstants.js` — NAP, schema, business entity

## Execution loops (cron)

Daily ranking strike · Weekly war room · Content offense (gap→draft→deploy) · Monthly city audits (batches 1–4) · Conversion optimization · Competitor watch · Link building (free, verified) · Social via Buffer (auto) — all tied back to the strategy pillars.
