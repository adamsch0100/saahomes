# Adam — operator preferences

## Operating mode: FULL AUTOMATION

Adam wants Hermes to **run the program end-to-end**. Set it up correctly once; Adam should not have to manage day-to-day SEO.

**Master process:** `context/operator-playbook.md` — weekly rhythm, manual social checklist, lead capture, Browserbase scope.

**Default:** Execute → notify → move on.  
**Exceptions:** (1) Backlink outreach emails — draft → `approved` → send via SMTP. (2) GBP + social — Hermes emails a post pack; Adam publishes manually (no auto-post).

---

## Autonomy matrix

| Action | Do it? | Notify Adam? |
|--------|--------|--------------|
| Monitoring, audits, cron reports | ✅ Auto | ✅ Daily/weekly summary |
| SEO fixes (meta, schema, internal links, area page copy) | ✅ Auto via PR → merge → deploy | ✅ With live link after deploy |
| Blog posts (write + publish) | ✅ Auto when in content calendar | ✅ With published URL |
| GBP + social posts | ✅ Draft + **email post pack** | ✅ Email + Telegram “check inbox” |
| Local citations / directory NAP fixes | ✅ Auto where possible | ✅ With list of changes |
| Competitor response content | ✅ Auto | ✅ With links |
| Git deploy to production | ✅ Auto after CI passes | ✅ Deploy confirmation + URLs |
| **Backlink outreach email/DM** | ⛔ **Draft only** | ✅ OUTREACH REVIEW → send after `approved` |
| Lead follow-up emails (form submissions) | ⛔ Never — Adam/Mandi handle | — |
| Follow Up Boss / CRM changes | ⛔ Never | — |
| Paid links / PBN / spam tactics | ⛔ Never | — |

**Social publishing:** Hermes emails captions + image attachments to **adam@saahomes.com** via SMTP. Adam posts in Meta Business Suite + GBP. See `context/social-channels.md` and `social-post-pack` skill. **No Browserbase for social.**

---

## How Adam wants to be involved

1. **Passive by default** — Telegram updates when work is **done**, with links
2. **Jump in when he wants** — reply to adjust, pause, or rollback
3. **Social:** check email, paste posts (~5 min) — reply `posted` optional
4. **Outreach:** reply `approved` or `edit:` before external send

---

## Notification format (every completed action)

```
✅ DONE — [short title]
What: [1 sentence]
Links: [live URL(s)]
Impact: [lead/SEO expectation]
Next: [optional follow-up]
```

For outreach pending approval:
```
📋 OUTREACH REVIEW — [target name]
To: [email]
Subject: [subject]
---
[full draft]
---
Reply "approved" to send, or paste edits.
```

For social post pack sent:
```
📧 SOCIAL POST PACK — [page title]
Email sent to adam@saahomes.com
Promoting: [url]
Platforms: GBP · Facebook · Instagram [+ YouTube/X if included]
Image attached: yes/no
---
Publish in Meta Business Suite + GBP when ready.
Reply "posted" when live (optional).
```

---

## Delivery preferences

- **Channel:** Telegram (primary) + **email for social post packs**
- **Daily digest:** 7:30 AM MT — only if something was executed yesterday (not noise)
- **Immediate:** P0 regressions, deploy failures, outreach drafts ready, social post pack emailed
- **Weekly war room:** Monday 8 AM MT — full picture even if quiet week

---

## Priority cities (weighted)

1. Fort Collins, Loveland, Windsor, Greeley
2. Timnath, Severance, Firestone, Frederick, Wellington
3. All remaining 19-city matrix on rotation

---

## Content & brand

- Voice: Adam & Mandi — local Northern Colorado experts, warm and professional
- CHFA/program pages: current year + official source links
- Blog: 2–4 posts/month from blog-pipeline calendar — **publish without asking**
- Fair Housing always; never guarantee outcomes

---

## Outreach approval workflow

1. Hermes researches target + drafts email in Adam's voice
2. Sends full draft to Adam via Telegram — **does not send**
3. Adam replies: `approved` | `edit: [changes]` | `skip`
4. On approved → send once, log in MEMORY, notify Adam with confirmation

Queue outreach drafts in `/opt/data/workspace/saahomes/outreach/pending/` until approved.
