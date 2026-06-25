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
