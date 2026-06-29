# Keyword Universe — Northern Colorado

Complete query map for Schwartz and Associates market ownership.  
**Use this for:** cron monitoring, content gap analysis, scorecard updates, delegation briefs.

---

## 19 cities (slug → display name)

| Slug | City | County | Area URL |
|------|------|--------|----------|
| fort-collins | Fort Collins | Larimer | /northern-colorado-areas/fort-collins/ |
| loveland | Loveland | Larimer | /northern-colorado-areas/loveland/ |
| windsor | Windsor | Weld/Larimer | /northern-colorado-areas/windsor/ |
| greeley | Greeley | Weld | /northern-colorado-areas/greeley/ |
| timnath | Timnath | Larimer/Weld | /northern-colorado-areas/timnath/ |
| wellington | Wellington | Larimer | /northern-colorado-areas/wellington/ |
| johnstown | Johnstown | Weld/Larimer | /northern-colorado-areas/johnstown/ |
| eaton | Eaton | Weld | /northern-colorado-areas/eaton/ |
| milliken | Milliken | Weld | /northern-colorado-areas/milliken/ |
| la-salle | La Salle | Weld | /northern-colorado-areas/la-salle/ |
| mead | Mead | Weld | /northern-colorado-areas/mead/ |
| longmont | Longmont | Boulder/Weld | /northern-colorado-areas/longmont/ |
| boulder | Boulder | Boulder | /northern-colorado-areas/boulder/ |
| berthoud | Berthoud | Larimer/Weld | /northern-colorado-areas/berthoud/ |
| firestone | Firestone | Weld | /northern-colorado-areas/firestone/ |
| frederick | Frederick | Weld | /northern-colorado-areas/frederick/ |
| evans | Evans | Weld | /northern-colorado-areas/evans/ |
| severance | Severance | Weld | /northern-colorado-areas/severance/ |
| niwot | Niwot | Boulder | /northern-colorado-areas/niwot/ |

---

## Lifestyle / community queries (→ events guide + area pages)

| Query cluster | Target |
|---------------|--------|
| Northern Colorado events | /blog/northern-colorado-events-guide-2026/ |
| Fort Collins events / festivals | Events guide + /northern-colorado-areas/fort-collins/ |
| things to do Fort Collins | Events guide + Fort Collins area |
| Greeley Stampede | Events guide + Greeley area |
| moving to {city} things to do | Area page + events guide |
| Loveland events / Sculpture in the Park | Events guide + Loveland area |

Hermes refreshes via `local-events-curation` skill — not live calendar SEO.

---

## Per-city query templates (track in GSC)

For each `{city}` above, monitor these query patterns:

### Buyer (→ area page + /for-buyers/ + /properties/)
1. `{city} homes for sale`
2. `{city} CO homes for sale`
3. `{city} real estate`
4. `{city} CO real estate`
5. `{city} realtor`
6. `{city} real estate agent`
7. `homes for sale in {city} Colorado`
8. `moving to {city} Colorado`
9. `best realtor in {city}`
10. `{city} neighborhoods`

### Seller (→ area page + /for-sellers/ + market report)
1. `sell my home {city}`
2. `sell house {city} CO`
3. `{city} home value`
4. `{city} housing market`
5. `how much is my home worth {city}`
6. `listing agent {city}`
7. `best listing agent {city}`

---

## Regional / brand queries

| Query cluster | Target page |
|---------------|-------------|
| Northern Colorado real estate | / + /northern-colorado-areas/ |
| Northern Colorado homes for sale | /properties/ |
| Fort Collins Loveland Windsor realtor | /about-us/ + area pages |
| Schwartz and Associates | / (brand) |
| SAA Homes | / (brand) |
| Coldwell Banker Fort Collins | /about-us/ |

---

## Program queries (Tier A — high conversion)

| Query | Target |
|-------|--------|
| CHFA down payment assistance Colorado | /chfa-down-payment-assistance/ |
| CHFA down payment assistance {city} | CHFA page + area internal links |
| Colorado first time homebuyer programs 2026 | /chfa-down-payment-assistance/ |
| CHFA Schools to Home | /chfa-schools-to-home/ |
| Colorado teacher home loan | /chfa-schools-to-home/ |
| Colorado Champions home loan | /colorado-champions-home-loan-program/ |
| first responder home loan Colorado | /colorado-champions-home-loan-program/ |

---

## Growth corridor cluster (prioritize content + links)

**Carbon Valley:** Firestone, Frederick, (+ Dacono if we add later)  
**I-25 north growth:** Timnath, Severance, Wellington, Berthoud  
**Greeley metro:** Greeley, Evans, Milliken, La Salle, Eaton

Cross-link these cities in blog posts and area page "Nearby communities" sections.

---

## Existing blog slugs (extend with internal links)

- `buying-a-home-in-fort-collins`
- `northern-colorado-market-update`
- `how-to-sell-your-home-fast`
- `chfa-down-payment-assistance-colorado-2026`
- `chfa-first-time-homebuyer-northern-colorado`
- `chfa-schools-to-home-colorado-teachers`
- `northern-colorado-events-guide-2026` — **events hub; link from area pages**
- `northern-colorado-market-update-june-2026`

**Gap topics to pipeline** (blog-pipeline skill):
- Selling in Windsor / Loveland / Greeley (city-specific seller guides)
- Timnath + Severance new construction buyer guide
- Carbon Valley (Firestone/Frederick) affordability guide
- Fort Collins vs Loveland vs Windsor comparison
- Weld County vs Larimer County buyer guide
- Monthly market snapshot (recurring template)

---

## GSC monitoring filters (cron)

When GSC connected, pull weekly for property `https://saahomes.com/`:
- Queries containing: `fort collins`, `loveland`, `windsor`, `greeley`, `weld`, `larimer`, `northern colorado`, `chfa`, `schwartz`, `saa homes`
- Pages under `/northern-colorado-areas/`, `/for-sellers/`, `/for-buyers/`, `/chfa-`, `/blog/`
- Alert: position drop ≥8 positions AND impressions ≥10 (week over week)
- Alert: page indexed → not indexed on any P0 URL
