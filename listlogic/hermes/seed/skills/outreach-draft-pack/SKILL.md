---
name: outreach-draft-pack
description: Draft email + SMS outreach packs for ListLogic prospects; Adam approves before any send.
---

# Outreach draft pack

## Hard rules

- `OUTREACH_APPROVAL_REQUIRED=true` — never send without Adam `approved`.
- Cold SMS: draft only for personal/broker-forward use; do not claim TCPA consent from site opt-out.
- Email: CAN-SPAM (physical address, unsubscribe). Templates in `prospects/outreach/`.
- Product wedge: soft market / overpricing / interactive price×odds×supply — not "another CMA PDF".

## Steps

1. Pull high-ICP rows from `prospects/agents.csv` not touched recently.
2. Generate pack (10–25) using templates:
   - `agent_email.md`
   - `brokerage_email.md`
   - `agent_sms.md` (optional, consented/warm only)
3. Save under `outreach/pending/YYYY-MM-DD-pack.md`.
4. Email or Telegram Adam the pack summary + ask for approve / edit / skip.

## After approval

Send only via configured SMTP for email; SMS only if Adam confirms channel + consent path.
Move pack to `outreach/sent/`.
