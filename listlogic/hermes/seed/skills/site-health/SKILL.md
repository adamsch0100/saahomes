---
name: site-health
description: Daily reachability check for listlogic.homes money paths (home, demo, app, pricing).
---

# Site health

## Execute daily

1. Fetch with `fetch-page-audit.py` (or equivalent):
   - https://listlogic.homes/
   - https://listlogic.homes/demo
   - https://listlogic.homes/saas/app.html
   - https://listlogic.homes/saas/pricing.html
   - https://listlogic.homes/saas/signup.html
2. Flag if status ≥400, title missing, or body looks like Railway/error page.
3. Telegram brief only on failures or first-boot OK confirmation.

## Output

```
ListLogic site-health — [date]
OK: home, demo, app, pricing, signup
OR 🔴 FAIL: [url] status [code] — [one-line note]
```
