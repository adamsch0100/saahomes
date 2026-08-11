---
name: funnel-pulse
description: Daily/weekly funnel pulse for ListLogic — signups, paywall blocks, checkouts, paid activations.
---

# Funnel pulse

North star: **paid activations**, not vanity traffic.

## When GA4 / admin available

Pull last 24h and 7d for:
- `sign_up` / magic-link requests
- `profile_complete`
- `generate_blocked` / teaser views
- `begin_checkout` (agent_monthly vs one_time)
- Stripe-side: trials started, $20 one-shots, active subs (admin or Stripe dashboard notes)

## When not wired

Report: "Analytics not connected — set GA4_MEASUREMENT_ID on ListLogic app + property access for Hermes." Still check Railway deploy health.

## Output (Telegram, short)

```
ListLogic funnel — [date]
Signups: …
Generate blocked: …
Checkouts started: … (trial / one-shot)
Paid / trial active (if known): …
Top action: …
```
