---
name: autonomous-execute
description: Execute approved SEO/content work end-to-end — implement, deploy, verify live, notify Adam with links. Do not stop at recommendations.
---

# Autonomous Execute — Ship & Notify

## When to use

Any time Hermes identifies an SEO, content, or CRO fix that passes the brand checklist in `automation-policy.md`.

Adam's rule: **execute and notify; don't ask permission first** (except backlink outreach).

---

## Execution steps

### 1. Scope the change
- Files to edit in saahomes repo
- Expected live URL(s) after deploy
- Lead/SEO impact (1 sentence)

### 2. Implement
- Clone/pull saahomes repo (or edit via GitHub API)
- Branch: `hermes/seo-{YYYYMMDD}-{short-slug}`
- Make minimal, focused diff
- Run build if possible: `npm run build` (verify sitemap + prerender)

### 3. Ship
- Open PR with summary: what, why, URLs affected
- Auto-merge if CI green and change type is allowed (SEO/content/CRO)
- Trigger production deploy if Railway/webhook configured
- If no deploy access: merge to main and notify Adam deploy may be pending

### 4. Verify live

**Cron-safe verification (required in cron / unattended runs)**

Hermes `security.command_approval` + tirith scan **blocks** shell pipes like `curl | python3` or `curl | bash`. In cron there is no user to approve → process dies with `RuntimeError: [Errno 32] Broken pipe`.

| DO | DO NOT |
|----|--------|
| `python3 /usr/local/bin/fetch-page-audit.py https://saahomes.com/...` | `curl ... \| python3 -c "..."` |
| Read repo source (`src/components/SEO.jsx`, prerender output) before deploy | Pipe downloaded HTML into an interpreter |
| Built-in `web_fetch` / fetch tool when available | `curl \| jq`, `curl \| grep`, `wget -O- \| python` |

Example (status, title, meta, JSON-LD types):

```bash
python3 /usr/local/bin/fetch-page-audit.py https://saahomes.com/for-sellers/ --pretty
```

Checks:
- Live URL returns 200
- Title/meta correct in HTML source
- New blog in sitemap.xml if applicable
- Request GSC indexing if credentials available

### 5. Notify Adam (required)

```
✅ DONE — [title]
What: [implemented change]
Links: [live URL(s)]
PR: [github PR link if applicable]
Impact: [expected SEO/lead effect]
Next: [optional — e.g. monitor ranking in 2 weeks]
```

### 6. Log
Append to MEMORY.md wins log with date + URL.

### 7. Post-ship maintenance (blog / market / nav)

If the change was a **blog post**, **market update**, or **nav link**, follow `context/repo-maintenance-checklist.md`:

| Ship type | Hermes must also |
|-----------|------------------|
| Any blog | Email social post pack same day |
| Market Update | Update `LATEST_MARKET_UPDATE_SLUG` + `supersededBy` on old market posts |
| Any deploy Adam should share | Include `operator_schedule` in social pack JSON |

Do not ask Adam to update repo files manually.

---

## Change types & auto-ship rules

| Type | Auto-ship? |
|------|------------|
| Meta title/description | ✅ |
| Internal links in JSX/content | ✅ |
| Area page copy expansion | ✅ |
| New blog post (from calendar) | ✅ |
| Schema JSON-LD | ✅ |
| CTA copy/placement | ✅ |
| New city page (19-city matrix only) | ✅ if unique content |
| Backend/API changes | ⛔ notify Adam — needs review |
| Dependency upgrades | ⛔ notify Adam |
| Outreach email | ⛔ use backlink-outreach skill |

---

## If blocked

Notify Adam once with exact fix:

```
⚠️ BLOCKED — [action attempted]
Reason: [missing GITHUB_TOKEN / deploy failed / etc.]
Staged: [branch name or draft location]
Fix: [what Adam or Hermes needs to unblock]
```

Do not retry silently more than twice.

---

## Rollback

On Adam request: revert PR/commit, redeploy, notify confirmation.
