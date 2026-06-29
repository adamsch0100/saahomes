# SAA Homes site reference

**Canonical URL:** https://saahomes.com  
**Brand:** SAA Homes · Schwartz and Associates, Coldwell Banker Realty  
**Market:** Northern Colorado — **mission: own buyer + seller search demand in all 19 cities**

See also: `market-dominance-strategy.md`, `keyword-universe.md`

## Service area cities (19 area guide pages)

Fort Collins, Loveland, Windsor, Greeley, Timnath, Wellington, Johnstown, Eaton, Milliken, La Salle, Mead, Longmont, Boulder, Berthoud, Firestone, Frederick, Evans, Severance, Niwot

URL: `https://saahomes.com/northern-colorado-areas/{slug}/`

## Primary keyword themes

### Buyer intent → area page + /for-buyers/ + /properties/
- `{city} homes for sale`, `{city} realtor`, `moving to {city} Colorado`
- CHFA program queries → program hub pages

### Seller intent → area page + /for-sellers/ + market report
- `sell my home {city}`, `{city} home value`, `{city} housing market`

## Technical SEO stack

- React SPA + build-time prerender (`prerender-meta.mjs`)
- Sitemap from `siteRoutes.js` + `areaSeo.js` + `blogPosts.js`
- JSON-LD: RealEstateAgent, WebSite, WebPage, Place, BreadcrumbList
- Trailing-slash URLs

## Competitive moat on-site

- 19 hyper-local area pages (most competitors: 0–3)
- CHFA program cluster (3 dedicated landing pages + blog support)
- Named agents + video + testimonials (E-E-A-T)
- Lead forms → PostgreSQL → Follow Up Boss

## Content guardrails

- Year on CHFA/program pages · official source links · Fair Housing · no thin AI city spam

## Blog & content hub

**Hub URL:** https://saahomes.com/blog/ (UI label: "Real Estate Guides")

| Path | Role |
|------|------|
| `src/data/blogPosts.js` | All blog content + `LATEST_MARKET_UPDATE_SLUG` |
| `src/components/LatestMarketUpdateBanner.jsx` | Auto-links homepage, for-sellers, area pages to latest market post |
| `src/pages/BlogPostPage.jsx` | Renders `supersededBy` banner on outdated market posts |
| `src/components/Header.jsx` | Desktop + mobile nav → `/blog/` |

**Hermes maintenance:** See `context/repo-maintenance-checklist.md` — required reading after every blog/market ship.

When publishing a new **monthly market update**, Hermes MUST:
1. Update `LATEST_MARKET_UPDATE_SLUG` in `blogPosts.js`
2. Set `supersededBy` on all prior Market Update posts
3. Email social post pack same day
4. Update MEMORY `monthly_market_blog_url` + `latest_market_update_slug`

## Operator email scripts (Railway)

| Script | Purpose |
|--------|---------|
| `send-social-post-pack.py` | Captions + images for Meta, GBP, X |
| `send-operator-weekly-email.py` | Monday day-by-day schedule for Adam |

Skills: `social-post-pack`, `operator-weekly-email`, `local-events-curation`

## Local events hub

| URL | Role |
|-----|------|
| `/blog/northern-colorado-events-guide-2026/` | Flagship events guide (SEO) |
| `/northern-colorado-areas/{city}/` | Per-city events section via `AreaEventsSection` |
| `src/data/localEvents.js` | Hermes-maintained curated data |

Hermes: monthly check + quarterly refresh — `context/local-events-sources.md`
