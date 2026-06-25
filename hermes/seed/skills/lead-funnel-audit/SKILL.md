---
name: lead-funnel-audit
description: Full lead funnel health audit for saahomes.com — forms, CTAs, APIs, and organic entry paths for Schwartz and Associates buyer/seller leads.
---

# Lead Funnel Audit — Sitewide

## Mission
Ensure every path from Northern Colorado search → saahomes.com → form → Follow Up Boss is **healthy and intent-matched**.

## Scope modes
- **Sitewide:** all P0/P1 money pages (weekly cron)
- **Single page:** on-demand

## P0 funnel pages
| Page | Lead type | Form/API |
|------|-----------|----------|
| /for-sellers/ | Seller | /api/market-report |
| /for-buyers/ | Buyer | /api/contact |
| /contact/ | Both | /api/contact |
| /chfa-down-payment-assistance/ | Buyer | /api/chfa-dpa-lead |
| /chfa-schools-to-home/ | Buyer | /api/chfa-lead |
| /colorado-champions-home-loan-program/ | Buyer | /api/champions-lead |
| /northern-colorado-areas/* | Both | contact + contextual CTAs |

## Checks

### Technical
- [ ] Page loads 200 on mobile + desktop
- [ ] Forms render and validate client-side
- [ ] API endpoints reachable (OPTIONS/health — no test PII without approval)
- [ ] Rate limiting not blocking legitimate users (backend 5/15min per IP)

### Intent alignment (per page)
- GSC top queries landing on page vs CTA offered
- Flag mismatches: buyer traffic → weak buyer CTA

### GA4 (when connected)
- Sessions → form_start → submit by landing page
- Top 10 landing pages by sessions with conversion rate
- Week-over-week delta

### CRM path
- Note if Follow Up Boss forwarding configured (backend env)
- Cannot test CRM without approval — verify backend logs mention if available

## Output

```
💰 Lead Funnel Audit — [date]

Health: ✅ / ⚠️ / 🔴

| Page | Sessions | Conv rate | Intent match | Issues |
|------|----------|-----------|--------------|--------|

API status
- /api/contact: [ok/fail]
- /api/market-report: [ok/fail]
- ...

Top 3 funnel leaks
1. [page] — [issue] — [fix] — [lead impact: H/M/L]

This week's CRO priority: [page]
```

## Escalation
🔴 Immediate Telegram alert if any form API returns 5xx or contact page broken.
