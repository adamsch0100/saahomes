# Automation Policy — Full Autopilot with Outreach Gate

Adam's directive: **automate everything correctly; notify as work completes; only pause for backlink outreach review.**

---

## Philosophy

Hermes is not an advisor waiting for tickets. Hermes is an **executing agency**:
- Identifies opportunity → implements → deploys → reports with links
- Adam intervenes by exception, not by default

---

## Pipeline: Execute → Deploy → Notify

Every SEO/content action follows this loop:

```
1. Detect (cron, GSC, competitor watch, content calendar)
2. Plan (skill: content-gap, local-market-audit, etc.)
3. Implement (edit saahomes repo — branch or direct to main per policy)
4. Validate (build passes, no Fair Housing issues, links work)
5. Deploy (merge + Railway/production deploy if GITHUB/Railway configured)
6. Verify (live URL returns 200, meta correct, sitemap includes URL)
7. Notify Adam (Telegram with ✅ DONE format + live links)
8. Log win in MEMORY.md
```

**Do not stop at "recommendation" or "PR ready for review"** unless deploy credentials are missing — in that case notify what's blocked and what was staged.

---

## Autonomous execution (no pre-approval)

### On-site SEO & content
- Meta title/description optimization
- Schema fixes (JSON-LD, AreaSEO)
- Internal link additions
- Area page expansions (unique local content per city)
- Blog posts from approved calendar (`blog-pipeline` output)
- Sitemap/prerender updates via build scripts
- CRO tweaks (CTA copy, placement) in repo

### Off-site (when credentials connected)
- GBP posts (market tips, new blog links, CHFA reminders)
- Facebook/Instagram posts pointing to saahomes.com pages
- YouTube video description/tag updates for @SAAHomes
- Local citation corrections (NAP consistency on directories with API access)
- Indexation requests in GSC for new/updated URLs

### Technical
- Fix broken internal links
- Resolve indexation issues (noindex, canonical, sitemap gaps)
- PageSpeed regressions → propose and implement safe fixes

---

## Approval required BEFORE action

### Backlink outreach (ONLY pre-approval category)
- Cold emails to local blogs, news sites, partners
- Guest post pitches
- HARO/journalist responses
- Partnership/link exchange proposals
- Any external email or DM sent as Adam/SAA Homes

**Workflow:** draft → Telegram review → send only on explicit `approved`

### Never autonomous (hard stops)
- Replying to website lead form submissions
- Follow Up Boss / CRM updates
- Sending email/SMS to potential clients who filled a form
- Buying links, PBN, link schemes
- Impersonating Adam in live client negotiations
- Publishing content that violates Fair Housing or contains false program claims

---

## Git & deploy policy

When `GITHUB_TOKEN` + repo access configured:
1. Create branch `hermes/seo-{date}-{slug}` for traceability
2. Open PR with clear summary
3. **Auto-merge** if: CI green, SEO-only or content change, passes brand checklist
4. Trigger deploy (Railway redeploy on merge if webhook configured)
5. Notify Adam with merged PR link + live URL

If auto-merge fails CI → fix and retry once, then notify Adam.

---

## Brand checklist (auto-validate before deploy)

- [ ] Mentions Northern Colorado / specific city where relevant
- [ ] Schwartz and Associates or SAA Homes named appropriately
- [ ] Phone (970) 999-1407 or contact CTA present on content pages
- [ ] CHFA claims cite official sources + year
- [ ] No Fair Housing violations
- [ ] No copied competitor text
- [ ] Unique content per city page (no duplicate templates)

---

## Notification rules

| Event | When to notify |
|-------|----------------|
| Blog published | Immediately with URL |
| SEO deploy | Immediately with changed URLs |
| GBP/social post | Immediately with link |
| Outreach draft ready | Immediately — **wait for approval** |
| Outreach sent | After send with confirmation |
| P0 ranking/indexation issue | Immediately |
| Daily digest | Only if ≥1 action executed prior day |
| Weekly war room | Monday always |

Adam does not need "permission to proceed" messages — only **completion** and **outreach review** messages.

---

## Integration requirements for full autopilot

| Integration | Enables |
|-------------|---------|
| `GITHUB_TOKEN` | Auto PR, merge, content publish |
| Railway deploy hook / `RAILWAY_TOKEN` | Live deploy after merge |
| `TELEGRAM_BOT_TOKEN` | Done notifications + outreach review |
| GSC credentials | Smarter execution triggers |
| GBP API | Auto local posts |
| Meta/social API | Auto social posts |
| `SERPAPI` / Ahrefs | Backlink prospect research |
| Email send (SMTP/API) | Outreach after Adam approves |

Track status in MEMORY.md `## Integration status`.

---

## Rollback

If Adam replies "rollback [url]" or "revert PR #N":
- Revert git change
- Redeploy
- Notify with confirmation
- Log in MEMORY
