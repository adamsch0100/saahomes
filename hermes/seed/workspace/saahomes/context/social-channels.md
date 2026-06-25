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
| **YouTube** | @SAAHomes | P1 | Studio — description/tags only; no new videos |
| **X** | @saahomes | P2 | x.com — optional |

Post on **GBP + Facebook + Instagram** every cycle. YouTube + X when relevant.

---

## Media rules

| Platform | Image | Video |
|----------|-------|-------|
| GBP | Recommended — attached in email | No |
| Facebook | Optional — attached or link preview | No |
| Instagram | **Required** — attached in email | Reels only if Adam supplies source file |
| YouTube | N/A | **Do not create new videos** — description text only |
| X | Optional | No |

Reuse blog/area hero from `public/images/` → live URL `https://saahomes.com/images/...`  
Never AI-fake listing photos. Fair Housing safe copy only.

---

## Post triggers

1. New blog live → GBP + FB + IG (+ YouTube/X if relevant)
2. New/updated area page → GBP + FB + IG
3. CHFA/program updates → GBP + FB (seasonal)
4. Weekly market tip → GBP + FB text post
5. YouTube: include description/tag block in email when related @SAAHomes video exists

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

## Browserbase (optional — not for social)

Browserbase + browse.sh remain **optional** for market intel (Zillow, Realtor) only. Do not use for GBP/Meta login or posting.
