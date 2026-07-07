# Social & Local Channels — Email Post Pack (Adam publishes manually)

Hermes **drafts** GBP + social content and **emails Adam** a ready-to-publish pack (captions, links, images attached).  
Adam copies into **Meta Business Suite** (FB + IG) and **Google Business Profile**. No Browserbase, no platform API keys.

Use skill: **`social-post-pack`** · script: `send-social-post-pack.py`

---

## Channels (from site `seoConstants.js`)

| Channel | Handle | Priority | Adam publishes via |
|---------|--------|----------|-------------------|
| **Google Business Profile** | Schwartz and Associates listing | P0 | business.google.com or GBP app |
| **Facebook** | facebook.com/schwartzandassociateshomes | P0 | Meta Business Suite |
| **Instagram** | @saa_homes | P0 | Meta Business Suite (same post as FB) |
| **YouTube** | @SAAHomes | P1 | Hermes uploads via Data API (`article-youtube-video`); OAuth on Railway volume |
| **X** | @saahomes | P0 | x.com — every post pack |

Post on **GBP + Facebook + Instagram + X** every pack. YouTube description when related video exists.

**Strategy:** `context/content-calendar.md`

---

## Media rules

| Platform | Image | Video |
|----------|-------|-------|
| GBP | Recommended — attached in email | No |
| Facebook | Optional — attached or link preview | No |
| Instagram | **Required** — attached in email | Reels only if Adam supplies source file |
| YouTube | N/A | Hermes remux + API upload — approved music only (`youtube-music-policy.md`) |
| X | Optional | No |

Reuse blog/area hero from `public/images/` → live URL `https://saahomes.com/images/...`  
Never AI-fake listing photos. Fair Housing safe copy only.

---

## Post triggers

See **`content-calendar.md`** for pillars, Wed rotation, holidays.

1. New blog live → email pack same week
2. New/updated area page → email pack
3. **Every Wednesday** → weekly rotation (market / tip / community / seasonal)
4. **Monthly market blog** (3rd of month) → email pack
5. CHFA/program + **approved holidays only** (`holiday-calendar.md`) → seasonal packs
6. YouTube description block when related @SAAHomes video exists

---

## Workflow

1. Hermes drafts captions + picks image(s)
2. Saves JSON pack → `outreach/pending/social-{date}-{slug}.json`
3. Runs `send-social-post-pack.py` → **email to Adam** (HTML + image attachments)
4. Short **Telegram** notice: “📧 Social post pack sent — check email”
5. Adam publishes manually (5 min)
6. Optional: Adam replies `posted` on Telegram
7. Log in MEMORY.md

**No Browserbase. No auto-publish. No `approved` gate required** — email is the handoff.

---

## Email setup (Railway)

Same SMTP as outreach (already configured):

```
OUTREACH_SMTP_HOST=smtp.gmail.com
OUTREACH_SMTP_USER=adam@saahomes.com
OUTREACH_SMTP_PASSWORD=<app password>
SOCIAL_POST_EMAIL_TO=adam@saahomes.com
```

Optional: `SOCIAL_POST_EMAIL_TO` for a different inbox (defaults to SMTP user).

---

## What the email contains

- Subject: `SAA Homes — Social posts | [page title]`
- Promoted page link
- Section per platform with caption (copy-paste ready)
- Image preview in HTML + **image file attached** when available
- YouTube description / X caption blocks when included
- Note if no video this cycle

---

## Browserbase (optional — market intel only)

Keep `BROWSERBASE_API_KEY` + `BROWSERBASE_PROJECT_ID` configured for browse.sh skills (Zillow, Realtor, Walk Score). **Not used for social posting.** See `operator-playbook.md` Layer 4.
