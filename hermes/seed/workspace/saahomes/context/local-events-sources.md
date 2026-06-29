# Local Events — Sources, Curation & SEO (SAA Homes)

**Goal:** Be the realtor who knows Northern Colorado community life — for relocators, buyers, and local trust — without running a stale scraped calendar.

**Data files (saahomes repo):**
- `src/data/localEvents.js` — flagship events per city + `LATEST_EVENTS_GUIDE_SLUG`
- `src/data/blogPosts.js` — events guide blog (refreshed quarterly or annually)
- `src/components/AreaEventsSection.jsx` — renders on all area pages (auto)

**Skill:** `local-events-curation` · Read with: `content-calendar.md`, `social-post-pack`, `repo-maintenance-checklist.md`

---

## Philosophy

| DO | DO NOT |
|----|--------|
| Curate 5–8 **flagship annual events** per major city | Scrape Eventbrite or copy full calendars |
| Refresh **monthly** (social) + **quarterly** (site data/blog) | Promise live “what’s happening tonight” |
| Link to **official sources** for dates | Invent dates or times |
| Tie events to **relocating / lifestyle** intent | Hard-sell listings in event posts |
| Social when a major event is **within 30 days** | Post every bar trivia night |

**SEO targets:** `Northern Colorado events`, `Fort Collins festivals`, `things to do Fort Collins`, `moving to Loveland`, `Greeley Stampede`, `{city} community events`

---

## Official sources (Hermes research — browse.sh / web)

| Source | URL | Use for |
|--------|-----|---------|
| Visit Fort Collins | https://www.visitftcollins.com/events/ | FoCo community events |
| City of Fort Collins | https://www.fortcollins.gov/Events/Event-Calendar | City programs |
| City of Loveland | https://www.lovgov.org/community/events-calendar | Loveland, Rialto, museum |
| Visit Greeley / City of Greeley | https://www.greeleygov.com/ | Stampede, downtown |
| Longmont | https://www.longmontcolorado.gov/ | Farmers market, Rhythm on the River |
| This is NOCO | https://www.thisisnoco.com/communityhappenings | Regional cross-check |
| Boulder | https://bouldercolorado.gov/ | Boulder Creek Fest, county events |
| CSU / UNC | Campus calendars | Lagoon series, university events |

No public unified API — Hermes **curates manually** from these sources.

---

## Repo constants (update when guide refreshes)

```javascript
// src/data/localEvents.js
export const LATEST_EVENTS_GUIDE_SLUG = 'northern-colorado-events-guide-2026';
export const EVENTS_DATA_LAST_REVIEWED = 'YYYY-MM-DD';
```

When publishing a **new year guide** (e.g. 2027):
1. New blog slug in `blogPosts.js`
2. Update `LATEST_EVENTS_GUIDE_SLUG`
3. Update `EVENTS_DATA_LAST_REVIEWED`
4. Refresh `cityEvents` entries if flagship events changed
5. Area pages auto-update via `AreaEventsSection`

---

## Monthly workflow (1st of month — cron `local-events-monthly`)

**Time budget:** ~15 min Hermes autonomous

1. Check official sources for **next 30 days** across Tier S cities (Fort Collins, Loveland, Windsor, Greeley)
2. Flag **1 notable upcoming event** (Stampede, Beer Week, Sculpture in the Park, etc.)
3. If notable event within 30 days → run **`social-post-pack`**
   - `content_type: community`
   - Link to events guide blog OR relevant area page
   - Angle: “Great week to explore {city} if you’re house hunting” — soft CTA
4. If nothing notable → skip social (Wed rotation handles community week)
5. Update MEMORY:
   ```
   last_events_check_date:
   next_notable_event:
   ```

---

## Quarterly workflow (1st of Jan/Apr/Jul/Oct — cron `local-events-quarterly`)

**Time budget:** ~45 min Hermes autonomous

1. Re-read official sources for all **19 cities**
2. Update `src/data/localEvents.js`:
   - Add/remove flagship events
   - Update descriptions if venues/names changed
   - Set `EVENTS_DATA_LAST_REVIEWED` to today
3. Refresh events guide blog in `blogPosts.js`:
   - Same slug until year change; update `date` and content sections
   - OR new slug `northern-colorado-events-guide-{year}` each January
4. Ship via `autonomous-execute` → deploy
5. Email **`social-post-pack`** — “Updated NOCO events guide”
6. Update MEMORY:
   ```
   events_guide_last_refresh:
   latest_events_guide_slug:
   ```

---

## Social post angles (examples)

**Greeley Stampede (June):**
> Greeley Stampede season is here — one of Colorado's biggest community celebrations. If you're exploring Weld County or considering a move to Greeley, it's a perfect time to feel the energy of Northern Colorado. 🇺🇸🎸

**Sculpture in the Park (August):**
> Sculpture in the Park returns to Loveland — one of the largest outdoor sculpture shows in the country. Relocating to Larimer County? Events like this are why buyers fall in love with the Sweetheart City.

**FoCo Beer Week (June):**
> FoCo Beer Week kicks off in Fort Collins — craft beer, Old Town, and community at its best. Thinking about moving to Northern Colorado? Fort Collins lifestyle is a big part of the draw.

Always link: `https://saahomes.com/blog/{LATEST_EVENTS_GUIDE_SLUG}/` or area page.

---

## Fair Housing & brand

- Never tie events to demographics or “who should live where”
- No political events or controversial rallies
- Flagship family/community festivals only
- Sign: Schwartz and Associates · (970) 999-1407

---

## MEMORY template (add to Content calendar state)

```
last_events_check_date:
next_notable_event:
events_guide_last_refresh:
latest_events_guide_slug: northern-colorado-events-guide-2026
events_social_packs_this_quarter:
```

---

## Tier S flagship events (maintain in localEvents.js)

**Fort Collins:** FoCo Beer Week, Taste of Fort Collins, NewWestFest/Bohemian Nights, CSU Lagoon Series, Farmers Market  
**Loveland:** Sculpture in the Park, Corn Roast, Valentine re-mailing, Rhythm on the River, Larimer County Fair  
**Windsor:** Harvest Festival, Windsor Lake summer programming  
**Greeley:** Greeley Stampede, Arts Picnic, Friday Fest  
**Longmont:** Farmers Market, Rhythm on the River, Oktoberfest  
**Boulder/Niwot:** Boulder Creek Fest, Shakespeare Festival, Niwot Jazz Festival  

Smaller cities: town days (Berthoud Day, Eaton Days, Johnstown BBQ Day) + nearby metro events.
