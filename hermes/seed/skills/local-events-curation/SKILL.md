---
name: local-events-curation
description: Monthly check and quarterly refresh of Northern Colorado curated events for SEO, area pages, social posts, and events guide blog.
---

# Local Events Curation — Northern Colorado

## Goal
Curate flagship community events to support **relocating buyers**, **local E-E-A-T**, and **area page SEO** — without maintaining a live scraped calendar.

**Master doc:** `context/local-events-sources.md`

---

## When to run

| Trigger | Job | Action |
|---------|-----|--------|
| **1st of month** | `local-events-monthly` cron | Check next 30 days → social pack if notable event |
| **1st of Jan/Apr/Jul/Oct** | `local-events-quarterly` cron | Refresh `localEvents.js` + events guide blog → deploy |
| New blog/area deploy week | Optional | Cross-link events guide in relatedLinks |
| Adam asks | Manual | Full refresh |

---

## Monthly check (light)

1. Read `context/local-events-sources.md` official URLs
2. Use web search or browse.sh for Tier S cities: Fort Collins, Loveland, Windsor, Greeley
3. Identify **one** flagship event in the next 30 days worth a social post
4. If found:
   - `social-post-pack` JSON with `content_type: community`
   - Promote: `https://saahomes.com/blog/{LATEST_EVENTS_GUIDE_SLUG}/` or `/northern-colorado-areas/{city}/`
   - Include `post_by` + `operator_schedule`
   - `send-social-post-pack.py`
5. Update MEMORY `last_events_check_date`, `next_notable_event`
6. If nothing notable → log "no event social this month" in Telegram (brief, no email spam)

---

## Quarterly refresh (deep)

1. Review all entries in `src/data/localEvents.js` against official sources
2. Update `cityEvents` for all 19 city slugs (add/remove/edit flagship events)
3. Set `EVENTS_DATA_LAST_REVIEWED = 'YYYY-MM-DD'`
4. Update events guide in `src/data/blogPosts.js`:
   - Refresh section copy with current year references
   - Update `date` field on existing slug, OR create new year slug and update `LATEST_EVENTS_GUIDE_SLUG`
5. Verify internal links: guide → area pages; area pages use `AreaEventsSection` (no manual edit)
6. `npm run build` → ship via `autonomous-execute`
7. Email social post pack: "Updated Northern Colorado events guide"
8. Update MEMORY `events_guide_last_refresh`, `latest_events_guide_slug`
9. Telegram ✅ DONE with blog URL + area page example

---

## Files Hermes owns (never ask Adam)

| File | Purpose |
|------|---------|
| `src/data/localEvents.js` | Curated per-city events |
| `src/data/blogPosts.js` | Events guide blog post |
| `blogPosts` slug constant sync | Must match `LATEST_EVENTS_GUIDE_SLUG` |

**Do not edit** `AreaEventsSection.jsx` unless UI bug — it reads from `localEvents.js`.

---

## New year rollover (each January quarterly run)

1. New slug: `northern-colorado-events-guide-{year}`
2. Update `LATEST_EVENTS_GUIDE_SLUG` in `localEvents.js`
3. Add new blog post; keep old guide live with note linking to new guide (optional `supersededBy` pattern like market updates)
4. Redirect strategy: old slug stays indexed; new slug is canonical in `LATEST_EVENTS_GUIDE_SLUG`

---

## Output templates

**Monthly (if social sent):**
```
✅ DONE — Local events social | [Event name]
Promoting: [url]
Next check: [1st next month]
```

**Quarterly:**
```
✅ DONE — NOCO events guide refreshed
Blog: https://saahomes.com/blog/{slug}/
Data reviewed: [date]
Cities updated: [count]
Social pack emailed: yes
```

---

## Constraints

- Official source links only for event URLs — no Eventbrite scrape
- Fair Housing safe — community tone, no steering
- Max 1 event-focused social pack per month (avoid noise)
- Do not duplicate Wednesday community rotation in same week unless blog also shipped
