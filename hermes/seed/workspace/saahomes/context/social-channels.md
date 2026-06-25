# Social & Local Channels — Browserbase Posting (No Meta/GBP API Keys)

Hermes publishes via **Browserbase cloud browser** + Hermes browser tools.  
No Meta/GBP API tokens. No passwords in env vars or Google Docs.

**browse.sh** = free skill playbooks (Zillow, Realtor, etc.). **Browserbase** = cloud browser runtime. Both use the same `BROWSERBASE_*` env vars.

Adam approves **every external post** (GBP + social) before publish — reply `approved`.

---

## Channels (from site `seoConstants.js`)

| Channel | URL / handle | Priority | Post via browser |
|---------|----------------|----------|------------------|
| **Google Business Profile** | [GBP listing](https://www.google.com/maps/place/Schwartz+and+Associates,+Coldwell+Banker+Realty/@40.5377165,-105.0741491,17z) | P0 | business.google.com |
| **Facebook** | facebook.com/schwartzandassociateshomes | P0 | Meta Business Suite |
| **Instagram** | @saa_homes | P0 | Meta Business Suite (linked to FB) |
| **YouTube** | @SAAHomes | P1 | Studio — descriptions/tags/Community; not new video production |
| **X (Twitter)** | @saahomes | P2 | x.com — text + link when active |

Post on **GBP + Facebook + Instagram** every cycle. YouTube + X on rotation when there is new site content to promote.

---

## Media rules (what to attach)

| Platform | Image required? | Video required? | Source |
|----------|-----------------|-----------------|--------|
| GBP Update | Recommended | No | Blog hero, area page image, or branded link card |
| Facebook | Optional (link preview often enough) | No | Same as GBP |
| Instagram feed | **Yes** | Reels optional P2 | Reuse blog/area hero from `public/images/` — never AI-fake homes |
| YouTube | N/A for posts | **Do not create new videos** | Update descriptions/tags on existing @SAAHomes uploads |
| X | Optional | No | Text + saahomes.com link |

**Default:** When a blog or area page ships, attach its existing OG/hero image. No synthetic listing photos. No Fair Housing violations.

**Videos:** Hermes does not film or generate video. Repurpose existing @SAAHomes content (transcripts → blog/GEO). Short-form Reels only if Adam provides source video.

---

## Post triggers (what to promote)

1. New blog live → all P0 channels
2. New/updated area page → GBP + FB + IG
3. CHFA/program page updates → GBP + FB (seasonal)
4. Weekly market tip (no new page) → GBP + FB text post
5. YouTube: refresh description + tags + link when related blog publishes

---

## Approval workflow

1. Draft caption + target URL + chosen image path
2. Telegram **POST REVIEW** (see USER.md)
3. Adam: `approved` | `edit: …` | `skip`
4. Browserbase publish → ✅ DONE with live post link
5. Log in MEMORY.md

---

## Browserbase setup (Adam one-time)

### Railway env vars (required)

```
BROWSERBASE_API_KEY=<from browserbase.com → Settings → API Keys>
BROWSERBASE_PROJECT_ID=<from browserbase.com → Settings → Project ID>
```

Optional (recommended):

```
BROWSER_INACTIVITY_TIMEOUT=300
```

Get keys at [browserbase.com](https://www.browserbase.com) → **Settings**. Free tier: ~1 browser hour/month, 15 min max per session — enough for one-time logins + a few posts/week. Close sessions when done.

### One-time login (per platform)

There is **no browser panel in the Hermes dashboard**. Use Browserbase live view:

1. Message Hermes on Telegram:

```
Browserbase is configured. Set up authenticated sessions for:
1) Google Business Profile (business.google.com)
2) Meta Business Suite — FB + IG (business.facebook.com)
3) YouTube Studio (studio.youtube.com)
4) X (x.com)

For each: open a Browserbase session, send me the live view / debug URL, wait while I log in with 2FA, then save the session/context for reuse. Stay within 15 min per session (free tier).
```

2. Hermes opens a Browserbase session and sends you a **live view link** (or link to the session in [Browserbase dashboard](https://www.browserbase.com/sessions)).
3. You log in manually (2FA on your phone).
4. Reply `done` when finished on that platform.
5. Repeat for each platform. Meta Business Suite covers both Facebook and Instagram.

### Cookie refresh (when sessions expire)

Option A — ask Hermes to open a new Browserbase live view and log in again.

Option B — **cookie-sync** from home Chrome (run on your PC, not Railway):

```bash
npm install -g browse
export BROWSERBASE_API_KEY=your_key
# Install cookie-sync skill from browserbase/skills, then:
node path/to/cookie-sync.mjs --domains google.com,facebook.com,youtube.com,x.com
```

Save the context ID Hermes prints; reuse with `browse open --context-id <id> --persist`.

Log context IDs in MEMORY.md under `## Browserbase contexts`.

---

## Free tier budget tips

- One login session per platform (~5–10 min each) = ~30–40 min once
- Each approved post = ~2–5 min — batch GBP + FB + IG in one Meta session when possible
- Close browser sessions immediately after posting
- Do not leave sessions idle — free tier counts browser minutes

---

## SMTP (separate)

Backlink outreach email uses `OUTREACH_SMTP_*` — not used for social posting.
