---
name: daily-ranking-strike
description: Daily GSC ranking delta scan for Northern Colorado real estate queries. Alerts on P0 regressions affecting Schwartz and Associates lead pages.
---

# Daily Ranking Strike

## Execute every weekday morning

### Step 1 — Pull data (GSC if connected, else public signals)
- Last 7 days vs prior 7 days for queries matching: city names, "northern colorado", "chfa", "schwartz", "saa homes", "homes for sale", "realtor", "sell home"
- Pages: `/northern-colorado-areas/*`, `/for-sellers/`, `/for-buyers/`, `/chfa-*`, `/blog/*`

### Step 2 — Flag alerts (🔴 P0)
- Any Tier S query (see keyword-universe.md) drops **≥8 positions** with ≥10 impressions
- Any P0 money page loses >20% clicks week-over-week
- New query competitor appearing above us for `{city} realtor` patterns

### Step 3 — Flag watch (🟡)
- Position drops 4–7 positions
- Rising impressions but flat clicks (CTR opportunity)
- New blog/indexation appearing for competitors (note in competitor-intel.md)

### Step 4 — Note wins (🟢)
- Position gains ≥5 on Tier S queries
- New queries entering top 10

## Output (Telegram brief, <300 words)

```
🎯 SAA Homes Daily Strike — [date]

🔴 ALERTS
1. [query] [city] pos [X→Y] — [URL] — [1-line fix]

🟡 WATCH
- ...

🟢 WINS
- ...

Today's #1 action: [specific]
```

## If GSC unavailable
Run public checks: site:saahomes.com for 3 rotating cities, verify money pages appear. State "GSC not connected — limited visibility."
