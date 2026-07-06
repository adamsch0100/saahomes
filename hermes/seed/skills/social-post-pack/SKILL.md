---
name: social-post-pack
description: Draft GBP + social posts and email Adam a ready-to-publish pack (captions, links, images). Adam publishes manually — no Browserbase or platform APIs.
---

# Social Post Pack — Email to Adam

## CRITICAL RULES
- **Never publish** to GBP, Facebook, Instagram, YouTube, or X automatically.
- **Never use Browserbase** for social posting (draft-only workflow).
- After drafting, **email Adam the full pack** using `send-social-post-pack.py`.
- Also send a short **Telegram** summary with subject line + “check your email”.

Adam publishes manually in Meta Business Suite + GBP (phone or desktop).

---

## When to run
- New blog or area page shipped (**always** same week)
- Weekly **`social-weekly-content`** cron (Wed) — even without new blog
- Monthly market blog published
- CHFA/program updates (seasonal)
- After Adam requests a post pack

**Calendar:** `context/content-calendar.md` + **`context/holiday-calendar.md`** (approved holidays only)

---

## Content types (set `"content_type"` in JSON subject line)

| Type | Example subject prefix |
|------|------------------------|
| `new-content` | New blog/area live |
| `market-pulse` | Weekly stat / trend |
| `seller-tip` / `buyer-tip` | Actionable advice |
| `community` | Local event, city spotlight |
| `seasonal` / `holiday` | Approved holidays only — see `holiday-calendar.md` |
| `program` | CHFA reminder |
| `news-react` | Rates, Colorado housing news |

**Always include X block.** Vary hooks vs last 3 in MEMORY `## Content calendar state`.

---

## Draft steps

1. Identify promoted URL on https://saahomes.com
2. Pick hero/OG image from `public/images/` in the repo (or live `https://saahomes.com/...` URL)
3. Write platform-specific captions: **GBP, Facebook, Instagram, X** (required every pack)
4. Instagram **must** include an image URL
5. **No new video production** in social packs — video upload is handled by `article-youtube-video` skill separately. If no video, omit or set `video_note: "No video — image + link post only"`
6. Set **`post_by`** (e.g. `"Wednesday — within 48 hours"`) and **`operator_schedule`** step list so Adam knows exactly what to do when he opens the email

---

## Save pack JSON

Save to `outreach/pending/social-{date}-{slug}.json`:

```json
{
  "subject": "SAA Homes — Social posts | [page title]",
  "intro": "New content is live. Copy each block into Meta Business Suite (FB+IG) and GBP.",
  "post_by": "Today or Wednesday — within 48 hours",
  "operator_schedule": [
    "Open the promoted URL below and confirm the page looks good live",
    "Meta Business Suite: create post for Facebook + @saa_homes Instagram — upload attached image, paste IG caption, add link",
    "Google Business Profile: new update — paste GBP caption, add same image, set link button to promoted URL",
    "X (@saahomes): paste X caption with link",
    "Optional: reply posted on Telegram"
  ],
  "promoting": {
    "title": "Page title",
    "url": "https://saahomes.com/..."
  },
  "platforms": [
    {
      "name": "Google Business Profile",
      "caption": "...",
      "image_url": "https://saahomes.com/images/....jpg",
      "image_path": "public/images/....jpg"
    },
    {
      "name": "Facebook",
      "caption": "...",
      "image_url": "https://saahomes.com/images/....jpg"
    },
    {
      "name": "Instagram (@saa_homes)",
      "caption": "...",
      "image_url": "https://saahomes.com/images/....jpg",
      "notes": "Image required for IG feed"
    }
  ],
  "youtube": {
    "video_title": "Optional — existing @SAAHomes video",
    "description": "Updated description + tags + saahomes.com link"
  },
  "x": {
    "caption": "Short text + link"
  },
  "video_note": "No new video — reuse hero image only"
}
```

Use `image_path` when the file exists in the cloned workspace (enables email attachment). Always include `image_url` for preview in the email body.

---

## Send email

Requires `OUTREACH_SMTP_*` (same Gmail app password as outreach). Optional `SOCIAL_POST_EMAIL_TO` (defaults to SMTP user / adam@saahomes.com).

```bash
python3 /usr/local/bin/send-social-post-pack.py outreach/pending/social-{date}-{slug}.json
```

**Cron note:** This command is safe unattended (no shell pipes). If SMTP env is missing, still write the JSON pack and Telegram the error — do not abort before saving captions.

On success:
1. Move JSON to `outreach/sent/` or note `emailed` in filename
2. Telegram Adam:

```
📧 SOCIAL POST PACK — [page title]
Email sent to [SOCIAL_POST_EMAIL_TO or adam@saahomes.com]
Promoting: [url]
Platforms: GBP · Facebook · Instagram [+ YouTube/X if included]
Image attached: yes/no
---
Publish in Meta Business Suite + GBP when ready.
Reply "posted" on Telegram when live (optional).
```

3. Log in MEMORY.md `## Content calendar state`

---

## On failure
- If SMTP missing → Telegram error + save JSON to `outreach/pending/` with caption text for manual forward
- If image download fails → still send email with URL links in HTML body

---

## Constraints
- No AI-fake listing photos; Fair Housing safe copy only
- No impersonation of live client negotiations
- Do not email leads or form submitters — Adam/Mandi only
