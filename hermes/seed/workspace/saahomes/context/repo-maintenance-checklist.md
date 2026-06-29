# Repo Maintenance Checklist — Hermes must follow after every ship

**Read before:** any blog publish, market update, nav change, or operator-email workflow update.

Adam does not maintain these files — **Hermes owns all updates going forward.**

---

## File map (what Hermes updates when)

| Change type | Files Hermes edits | Auto-updates on build |
|-------------|-------------------|------------------------|
| New blog post | `src/data/blogPosts.js` | sitemap, prerender via `siteRoutes.js` |
| New monthly market report | `blogPosts.js` + **`LATEST_MARKET_UPDATE_SLUG`** + **`supersededBy`** on prior market posts | Homepage, for-sellers, area pages via `LatestMarketUpdateBanner` |
| Nav / footer link | `src/components/Header.jsx`, `Footer.jsx` | — |
| Area page content | `src/data/areaSeo.js`, `AreaGuidePage.jsx` | sitemap |
| Social email to Adam | JSON pack → `send-social-post-pack.py` | — |
| Weekly Adam schedule | JSON → `send-operator-weekly-email.py` | — |
| Operator state | `MEMORY.md` → `## Content calendar state` | — |

**Do not edit `LatestMarketUpdateBanner.jsx` for new market posts** — it reads `getLatestMarketUpdatePost()` from `blogPosts.js`. Only update the slug constant.

---

## A. Publishing ANY new blog post

1. Add entry to `src/data/blogPosts.js` (match existing shape: slug, title, excerpt, date, category, image, sections, relatedLinks, cta)
2. Include **2+ area page links** + **1 money page** (`/for-sellers/`, `/for-buyers/`, or `/contact/`)
3. Run `npm run build` — confirm sitemap includes `/blog/{slug}/`
4. Ship via `autonomous-execute` (PR → merge → deploy)
5. **Same day:** `social-post-pack` → `send-social-post-pack.py` with `post_by` + `operator_schedule`
6. Update MEMORY:
   ```
   blogs_published_this_month: +1
   last_social_pack_date: [date]
   last_social_pillar: [pillar]
   ```
7. Telegram ✅ DONE with live URL

---

## B. Publishing a NEW monthly market update (required 1×/month)

**Slug pattern:** `northern-colorado-market-update-{month}-{year}`  
Example: `northern-colorado-market-update-june-2026`

### Required edits in `src/data/blogPosts.js`

```javascript
// 1. Update the canonical pointer (top of file)
export const LATEST_MARKET_UPDATE_SLUG = 'northern-colorado-market-update-july-2026';

// 2. Add new post object (category: 'Market Update', 1200–2000 words)
//    Must include relatedLinks to 3–4 area pages + CHFA or for-sellers
//    Must include cta with primaryHref /contact/ and secondaryHref /for-sellers/

// 3. On EVERY prior Market Update post still indexed:
//    - Add or update: supersededBy: LATEST_MARKET_UPDATE_SLUG
//    - Add relatedLinks entry pointing to the new post
```

**Do NOT remove old market posts** — they may have backlinks. The `supersededBy` field triggers an on-page banner in `BlogPostPage.jsx` automatically.

### Site surfaces that auto-point to latest (no extra edits if slug constant updated)

- Homepage (`LatestMarketUpdateBanner`)
- `/for-sellers/`
- All 19 `/northern-colorado-areas/{city}/` pages (compact banner)
- Desktop + mobile nav already link to `/blog/`

### After deploy

1. `social-post-pack` — promote the new market URL; set `content_type: new-content`
2. `send-social-post-pack.py`
3. Update MEMORY:
   ```
   monthly_market_blog_url: https://saahomes.com/blog/{slug}/
   last_social_pillar: market-intelligence
   ```
4. Request GSC indexing for new URL if credentials available
5. Next Monday `weekly-operator-schedule` cron will reference the new URL in pending packs

---

## C. Social post pack JSON (every deploy + Wednesday)

Save to `outreach/pending/social-{date}-{slug}.json`.

**Required fields Hermes must always include:**

```json
{
  "subject": "SAA Homes — Social posts | [page title]",
  "post_by": "Today — within 48 hours",
  "operator_schedule": [
    "Open promoted URL and confirm page looks good live",
    "Meta Business Suite: Facebook + @saa_homes — image + IG caption + link",
    "Google Business Profile: GBP caption + same image + link button",
    "X (@saahomes): paste X caption + link",
    "Optional: reply posted on Telegram"
  ],
  "promoting": { "title": "...", "url": "https://saahomes.com/..." },
  "platforms": [ "...GBP, Facebook, Instagram — all required..." ],
  "x": { "caption": "..." }
}
```

Send:
```bash
python3 /usr/local/bin/send-social-post-pack.py outreach/pending/social-{date}-{slug}.json
```

Move to `outreach/sent/` on success.

---

## D. Weekly operator schedule email (every Monday)

Skill: `operator-weekly-email` · Cron: `weekly-operator-schedule` (Mon 7:15 AM MT)

1. Read MEMORY `## Content calendar state`
2. Build `outreach/pending/operator-week-{YYYY-MM-DD}.json` with day-by-day tasks
3. Include `pending_social_packs` for anything Adam hasn't been reminded to post
4. Send:
   ```bash
   python3 /usr/local/bin/send-operator-weekly-email.py outreach/pending/operator-week-{date}.json
   ```
5. Telegram: "Weekly operator schedule emailed"

**Adam's two email types — Hermes sends both:**
| Email | Script |
|-------|--------|
| Monday schedule | `send-operator-weekly-email.py` |
| Social captions | `send-social-post-pack.py` |

---

## E. Header / nav conventions (do not regress)

| Location | Label | URL |
|----------|-------|-----|
| Desktop header (right nav) | Real Estate Guides | `/blog/` |
| Mobile hamburger | Real Estate Guides | `/blog/` |
| Footer Resources | Real Estate Guides | `/blog/` |
| Legacy redirect | `/helpful-guides/` → 301 → `/blog/` | server.js |

If adding new resource hubs, link from footer + relevant money pages — not every item needs header placement.

---

## F. Internal linking rules (ongoing)

When shipping any content, verify:

- [ ] New blog links to 2+ area pages + 1 money page
- [ ] `LATEST_MARKET_UPDATE_SLUG` matches newest Market Update post
- [ ] Prior market posts have `supersededBy` set
- [ ] CHFA blog posts cross-link program landing pages (see `ChfaResourceHub.jsx`)
- [ ] Area pages do NOT need manual market links — `LatestMarketUpdateBanner` handles it

Run `internal-link-architecture` skill monthly for orphan/gap detection.

---

## G. MEMORY template (Hermes maintains)

```
## Content calendar state
last_social_pack_date:
last_social_pillar:
rotation_week_index: 1-4
last_3_social_hooks: []
monthly_market_blog_url:
blogs_published_this_month:
pending_social_packs: []
latest_market_update_slug:
```

Set `latest_market_update_slug` whenever `LATEST_MARKET_UPDATE_SLUG` changes in repo.

---

## H. Cron jobs Hermes must keep installed

From `automation-registry.md` — **23 jobs**, including:

| Job | Purpose |
|-----|---------|
| `social-weekly-content` | Wed 10 AM — social post pack email |
| `weekly-operator-schedule` | Mon 7:15 AM — Adam's week schedule email |
| `monthly-market-blog` | 3rd of month — publish market update if missing |
| `blog-content-calendar` | 15th — plan next month's posts |
| `local-events-monthly` | 1st of month — upcoming events check + social |
| `local-events-quarterly` | Jan/Apr/Jul/Oct 1st — refresh events data + guide blog |

After Hermes redeploy, verify `/cron list` shows all 23 jobs.

---

## I. Local events curation (monthly + quarterly)

Skill: `local-events-curation` · Doc: `context/local-events-sources.md`

| When | Hermes updates |
|------|----------------|
| **Monthly (1st)** | Check next 30 days → social pack if flagship event upcoming |
| **Quarterly** | `src/data/localEvents.js` + events guide in `blogPosts.js` + deploy |

Keep in sync: `LATEST_EVENTS_GUIDE_SLUG` + `EVENTS_DATA_LAST_REVIEWED` in `localEvents.js`. Area pages auto-update via `AreaEventsSection.jsx`.

---

## J. If Adam says "update Hermes" or "make sure going forward works"

Re-read this file + `operator-playbook.md` + `content-calendar.md`. Confirm:

1. Cron jobs installed
2. SMTP env vars set (`OUTREACH_SMTP_*`, `SOCIAL_POST_EMAIL_TO`)
3. Latest market slug in repo matches MEMORY
4. No pending social packs older than 7 days without a reminder email
