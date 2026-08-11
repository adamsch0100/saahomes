---
name: autonomous-execute
description: Execute approved ListLogic SEO/content changes via git PR in the monorepo listlogic/ path; merge when AUTO_MERGE_SEO_PRS=true.
---

# Autonomous execute

## Scope

Only `listlogic/` product + marketing files unless Adam expands. Never touch SAA Homes money pages without explicit ask.

## Steps

1. Branch `ll/hermes-YYYYMMDD-short-slug`
2. Implement change
3. PR with summary + test notes
4. If `AUTO_MERGE_SEO_PRS=true`, merge when CI green
5. Trigger website redeploy via `RAILWAY_SERVICE_ID` (website, not Hermes)
6. Telegram Adam with URL
