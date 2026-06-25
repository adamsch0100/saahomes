---
name: backlink-outreach
description: Research backlink opportunities and draft outreach emails for Adam approval BEFORE sending. Never send without explicit approved reply.
---

# Backlink Outreach — Draft & Approve Gate

## CRITICAL RULE
**Never send outreach email, DM, or submission without Adam replying `approved`.**  
Draft → Telegram review → wait → send once approved.

---

## Target types (ethical only)

| Type | Example | Priority |
|------|---------|----------|
| Local news / lifestyle | Coloradoan, Greeley Tribune, local blogs | High |
| Community orgs | Chambers, CSU/UNC housing resources | Medium |
| Real estate adjacent | Mortgage brokers (non-competing), home inspectors | Medium |
| Local directories | NAP citations missing or wrong | High (often fixable without email) |
| HARO / journalist queries | Expert quotes on Northern Colorado market | High |
| Partner content | Cross-link with complementary local businesses | Medium |

**Never pursue:** PBN, paid links, link farms, irrelevant national directories, spammy guest post networks.

---

## Research steps

1. Identify gap: competitor has link we lack (Ahrefs/SerpAPI/manual)
2. Vet target: real site, relevant audience, not spam
3. Find contact: editor email, contact form, or HARO query
4. Check if relationship already exists in MEMORY

---

## Draft email (Adam's voice)

- From perspective: Adam Schwartz, Schwartz and Associates / SAA Homes
- Tone: professional, local expert, helpful — not salesy
- Offer value first: local market data, expert quote, useful resource link
- Include link to relevant saahomes.com page (area guide, blog, CHFA resource)
- Keep under 200 words
- Subject line: specific, not clickbait

### Template structure
```
Subject: [specific, local angle]

Hi [Name],

[1 sentence — why reaching out, show you read their site]

[1-2 sentences — value offer: data, quote, resource for their readers]

[Optional: brief local credential — 20+ years Northern Colorado, Coldwell Banker team]

[Soft ask: link, guest contribution, or quote attribution]

Best,
Adam Schwartz
Schwartz and Associates | SAA Homes
(970) 999-1407 | saahomes.com
```

---

## Approval workflow

1. Save draft to `outreach/pending/{date}-{target-slug}.md`
2. Send Telegram message using OUTREACH REVIEW format from USER.md
3. Set status: `pending_approval`
4. On `approved` from Adam:
   - Send via configured email/API
   - Move to `outreach/sent/`
   - Notify: ✅ OUTREACH SENT with copy + target
   - Log in MEMORY wins
5. On `edit: ...` → revise draft, resubmit for approval
6. On `skip` → archive to `outreach/skipped/`

---

## Follow-up (autonomous AFTER initial send)

- If no reply in 7 days: draft ONE polite follow-up → **still requires approval**
- Max 2 touches total per target per quarter

---

## Output when researching (no send)

```
📋 OUTREACH REVIEW — [Target Name]
Why: [link gap / opportunity]
Domain authority: [if known]
To: [email]
Subject: [subject]

---
[full email body]
---

Reply "approved" to send.
Saved: outreach/pending/[filename]
```
