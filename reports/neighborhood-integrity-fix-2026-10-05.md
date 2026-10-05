# Neighborhood name-integrity fix — 2026-10-05

**Engine:** neighborhood-seo-expansion (weekly audit, job cacaa7f4ab75)
**Status:** build verified green; shipped to origin/main via PR (squash merge)
**Files:** `src/data/neighborhoods.js`, `scripts/neighborhood-name-integrity.py` (new), this report

---

## What the weekly audit surfaced

The discovery report showed every city above its coverage target (386 entries / 27 cities,
0 underserved), so the run pivoted to the accuracy audit — and the accuracy layer was the
real problem.

Cross-checking every entry against **authoritative subdivision records**:

- Weld County Assessor subdivision plats, queried inside each town's official city-limits
  polygon (Weld "City Limits as of May 2 2025" layer → `Subdivisions_open_data`, layer 30)
- Larimer County Assessor `Subdivisions` layer keyed on `MUNICIPALITY`
- live IRES subdivision names and price/year data from the site's own listings API

…found **53 entries whose names do not exist in county plat records** and whose text is
town-level boilerplate (e.g. "La Salle Residential", "Severance Green", "Eaton Foothills",
"Niwot Views", "Frederick Meadows"). These were the visible output of an early generated
batch, still live:

| Check | Result |
|---|---|
| Live page status (sample) | `HTTP 200` — `/la-salle/la-salle-heights/`, `/eaton/eaton-commons/`, `/severance/severance-green/` |
| In sitemap | yes (408 neighborhood URLs) |
| Stories on the page | invented subdivision name + town-level description, no long description, no walk score |

Two further defects were found in the same area:

1. **Wrong school district published.** All seven La Salle pages listed *Greeley-Evans
   District 6*. La Salle is in **Weld County RE-1 (Valley RE-1)** — Pete Mirich Elementary
   (La Salle), Valley Middle School, Valley High School (Gilcrest). CDE SchoolView and the
   district's own school list both confirm it.
2. **One jurisdiction error.** Windsor carried a "Hidden Valley Farm" page describing a
   1990s east-Windsor subdivision. The recorded **Hidden Valley Farm** plats (1st–6th
   Filings, built 2015–2025) are inside **Severance** town limits.

---

## What shipped

**Removed 24 entries** whose names match no plat, no IRES subdivision and no legitimate
neighborhood designation:

- La Salle (all 7): `la-salle-residential`, `la-salle-village`, `la-salle-meadows`,
  `la-salle-heights`, `la-salle-park`, `sunset-ridge-la-salle`, `riverstone-la-salle`
- Eaton (7): `eaton-foothills`, `eaton-gardens`, `eaton-village`, `eaton-park`,
  `eaton-estates`, `glenwood-eaton`, `heather-place-eaton`
- Severance (10): `severance-commons`, `bluesky-severance`, `severance-farms`,
  `severance-village`, `severance-green`, `severance-ranch`, `buffalo-ridge-severance`,
  `prairie-meadows-severance`, `severance-heights`, `castle-rock-severance`

**Added 16 entries**, every one built on a recorded plat with real geography:

| City | New entries | Evidence |
|---|---|---|
| La Salle (4) | Historic La Salle, Sunset Heights, Dove Hill Estates, Ley Addition | Connell / Ellis / McCutcheon / Ley / Sunset Heights 1st–6th FG / Dove Hill Estates plats; live listings $269,999–$519,000 |
| Eaton (6) | Historic Eaton, Governors Ranch, Hawkstone, Homes at Aspen Meadows, Centennial, Gilbaughs Appaloosa Acres | Eaton townsite + North/East/West Side Adds, Governors Ranch 1st–3rd FG, Hawkstone + Cottages + Retreat, Homes at Aspen Meadows PUD, Centennial Sub, Appaloosa Acres 1st/2nd Rplt; live listings $295,000–$1.1M |
| Severance (6) | Hunters Crossing, Overlook, Sunset Ridge, Severance Shores, Timber Ridge, Historic Severance | Hunters Crossing FG 1, Overlook FG 1, Sunset Ridge filings, Severance Shores, Timber Ridge PUD, Severance / Severance Add / Franklins plats; live listings $420,000–$755,000 |

**Corrected in place (no URL churn):** `hidden-valley-severance` — name now **Hidden Valley
Farm** (alsoKnownAs keeps "Hidden Valley"), coordinates moved from 40.537/-104.845 to the
real plat centroid 40.5045/-104.8645, boundaries rewritten to the six Hidden Valley Farm
filings, price band restated from live listings ($452K–$648K), and the placeholder
`rating: 'New school'` removed.

Entry count 386 → **378**; every city still has coverage (La Salle 4, Eaton 7, Severance 11).

---

## How the numbers in the new pages were sourced

- **Price ranges** = actual active-listing ranges for that subdivision or town from the
  site's own IRES-backed listings API, pulled 2026-10-05 (e.g. Hawkstone $499,900–$689,000
  across 7 active listings; Governors Ranch 3rd Filing $635,000–$679,900). Entries without
  active listings state the town-level active range and say so.
- **Year built ranges** = actual `year_built` values on those listings (e.g. Tailholt
  2018–2026, Hidden Valley Farm 2015–2025).
- **Coordinates / boundaries** = plat centroids and filings from the county layer.
- **Parks** = named town parks (Eaton: City Park, Town Square, Hawkstone Park, Eaton
  Commons Park, Benjamin Eaton Memorial Park, Great Western Trail; La Salle: Main Park,
  Memorial Park, Wayne Norman Park).
- **School ratings were deliberately omitted** on all new entries — no GreatSchools lookup
  was made in this run, and an unverified rating is worse than none.
- **Walk scores** are estimates in the documented bands (10–25 acreage/suburban edge,
  30–50 small-town grid).

## Verification

- `node --check src/data/neighborhoods.js` — clean; no `,,` sequences (`grep -n ",," ` → 0)
- `npm run build` — exit 0, `Prerendered 584 routes with full schema + OG + Twitter`
- `dist/sitemap.xml` — 407 neighborhood URLs; all 17 new slug targets present, all 24
  removed slugs absent
- `dist/northern-colorado-areas/{la-salle,eaton,severance}/` — prerendered HTML directory
  for every new entry
- Module-level check: 378 entries, no duplicate slugs, all 27 cities present, every new
  entry has all 22 fields with ≥3 highlights and ≥2 parks

## Remaining backlog (verified names ready to use)

The same screen still flags **45 further entries** in other cities. Verified real plat
names for the worst three, straight from the county layer:

- **Frederick** (6 flagged): real — Carriage Hills 1st/2nd FG, Del Camino South, Coalridge
  Estates, Eagle Valley, Clearview Villages, Countryside, Dreamers Ridge, Angel View Estates
- **Firestone** (5): real — Cimarron Pointe, Cottonwood Hollow, Booth Farms, Oak Meadows
  Village, Ridge Crest PUD, Buffalo Acres, Casagrande Estates, Baldridge PUD
- **Evans** (4): real — Chappelow Village, Chappelow Commons, Country Meadows (Evans),
  Centennial Pines, Carriage Estates, Country View Acres, Bella Vista, Alta Vista, Arlington Gardens

Also outstanding:

1. Windsor's `hidden-valley-farm` entry (wrong jurisdiction, and now a name collision with
   the corrected Severance page — it also carries a YouTube embed, so the video needs a
   decision before the page changes).
2. **94 entries still missing `longDescription` and/or `walkScore`** — the same generated
   batch. Structural completeness is now part of the weekly screen so this cannot grow.
3. Boulder County has no plat layer wired into the screen yet (Niwot, Boulder, Longmont,
   Lyons, Erie-west) — the screen skips those cities rather than guessing.

## New reusable tooling

`scripts/neighborhood-name-integrity.py`

- fetches Weld + Larimer plat records into `reports/neighborhood-plat-cache.json`
  (`--refresh-cache` to refetch), then
- reports every entry whose name matches no plat and no neighborhood designation, plus
  every entry missing `longDescription` / `walkScore` (`--no-network` for structure only).
- It is a screen, not a gate: it never edits content. County layers occasionally miss real
  plats, so each flag is confirmed against the county portal or town plans before changes.
