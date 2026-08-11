---
name: prospect-harvest
description: Harvest listing-agent prospects from public brokerage directories into prospects CRM CSV.
---

# Prospect harvest

## Rules

- Public pages only. No login walls, no scraping behind auth.
- Prefer listing / seller / team-lead titles. Skip buyer-only when clear.
- Write to workspace `prospects/agents.csv` (see prospects README columns).
- Never email/SMS from this skill — harvest only.

## Execute

1. Read `context/prospect-sources.md` for source URLs / batch plan.
2. Run harvest script when available:
   `python3 scripts/harvest_prospects.py --urls-file prospects/sources.txt --out prospects/agents.csv`
   Or equivalent Browserbase/browse for JS-heavy directories.
3. Dedupe by email; set `icp_score`, `source_url`, leave `consent_sms=0`, `dnc=0`.
4. Telegram: count added + sample 5 rows (name, brokerage, city).

## ICP score

- Listing / Seller Specialist / Team Lead / Managing Broker → high
- General agent unknown → medium
- Buyer-only → skip or low
