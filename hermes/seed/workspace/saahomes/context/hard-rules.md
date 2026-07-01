# HARD RULES — read before GBP, social, or browser tasks

**Last policy update:** 2026-06 — supersedes all prior chat memory on this topic.

---

## Social + GBP posting

| DO | DO NOT |
|----|--------|
| Use **`social-post-pack`** skill | Use Browserbase for GBP/Meta/X/YouTube posting |
| Email Adam via **`send-social-post-pack.py`** | `browser_navigate` to business.google.com, facebook.com, instagram.com, x.com to post |
| Include GBP, Facebook, Instagram, X in every pack when content ships | Ask Adam to log in via Browserbase live view |
| Telegram: `📧 SOCIAL POST PACK sent` | Telegram: `POST REVIEW` + "publish via browser" |
| Adam pastes manually in Meta Business Suite + GBP | Wait for Browserbase sessions or API keys |

**SMTP env:** `OUTREACH_SMTP_*` + optional `SOCIAL_POST_EMAIL_TO=adam@saahomes.com`

If Adam asks about social: **email the pack**, not Browserbase.

---

## Browserbase + browse.sh scope

| DO | DO NOT |
|----|--------|
| Zillow / Realtor / Walk Score / YouTube **transcript** intel for content | Social login or publishing |
| browse.sh skills with `BROWSERBASE_*` when scraping blocked | GBP posts, Meta posts, "set up sessions" for Adam |

`browser` toolset + `browser.cloud_provider: browserbase` in config = **market intel only**.

---

## Cron / unattended command safety

| DO | DO NOT |
|----|--------|
| `python3 /usr/local/bin/fetch-page-audit.py https://saahomes.com/...` | `curl ... \| python3` (tirith blocks → Broken pipe in cron) |
| `python3 /usr/local/bin/send-social-post-pack.py pack.json` | Shell pipes from curl/wget into python/bash/jq |
| Read repo files for pre-deploy schema/meta checks | Wait for command approval in cron (no user present) |

See `autonomous-execute` skill § Verify live.

---

## If MEMORY or old messages say otherwise

**This file wins.** Update MEMORY.md `## Integration status` to match and delete stale Browserbase social blockers.

---

## Integration status (canonical)

```
Social posting:     ✅ SMTP email packs (social-post-pack) — Adam publishes manually
Browserbase:        ✅ Optional — browse.sh market intel ONLY
GBP/Meta API keys:  ❌ Not used
Browser social:     ❌ DEPRECATED — never suggest
```
