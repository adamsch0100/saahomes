# Prospects CRM

Hermes/scripts own list building. Adam does not build spreadsheets.

## Files
- `agents.csv` — harvested / warm rows (create on first harvest)
- `sources.txt` — copy from `sources.txt.example`; public directory URLs
- `outreach/` — draft packs + templates (`agent_email.md`, `brokerage_email.md`, `agent_sms.md`)

## Harvest

```bash
python listlogic/scripts/harvest_prospects.py --urls-file listlogic/prospects/sources.txt -o listlogic/prospects/agents.csv
```

Inside Hermes container: `harvest_prospects.py --urls-file ...`

## CSV columns
name,email,phone,brokerage,city,state,title,source_url,icp_score,consent_sms,dnc,last_touch,notes

## ICP score hints
- Listing / Seller / Team Lead / Managing Broker in title → high
- Buyer-only → skip or low

## Outreach
Drafts only until Adam approves. Cold SMS is not automatic TCPA consent.
