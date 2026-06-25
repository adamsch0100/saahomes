# Workspace — SAA Homes Market Dominance Program

**Scope:** https://saahomes.com only. **Goal:** Own Northern Colorado buyer + seller search demand for Schwartz and Associates.

Read these context files every week:
- `context/automation-policy.md` — **full autopilot rules (read first)**
- `context/skills-registry.md` — **Skills Hub + browse.sh catalog reference**
- `context/keyword-universe.md` — every city × intent we must win
- `context/automation-registry.md` — cron jobs that must stay running
- `context/competitor-intel.md` — who we're beating and how
- `context/lead-funnels.md` — conversion paths
- `context/saahomes-site.md` — technical stack

---

## First-boot checklist (run once after deploy)

When integrations are available, execute in order:

1. **Install all cron jobs** from `context/automation-registry.md` (use `/cron` or `cronjob` tool)
2. **Verify skills** are loaded: `/skills` should list all `seed/skills/*` entries
3. **Pin cron models** to `opencode-go/deepseek-v4-flash` for monitoring jobs and `opencode-go/kimi-k2.6` for strategy jobs
4. **Set delivery** to Telegram (or Slack) for all cron outputs
5. **Run baseline audit** — spawn 4 parallel subagents (delegation) for Fort Collins, Loveland, Windsor, Greeley using `/local-market-audit` skill
6. **Save baseline** to memory: current top queries, indexation status, competitor top 3 per city
7. **Install browse.sh skills** from `context/skills-registry.md` (Zillow, Realtor, Walk Score, YouTube transcript)
8. **Report readiness** to Adam: what's automated, what's blocked, top 5 immediate wins

Re-run checklist item 5 monthly (full 19-city rotation via delegation batches of 4–5).

---

## Repository map (saahomes git)

| Path | SEO / lead role |
|------|-----------------|
| `src/data/areaSeo.js` | 19 city landing pages — primary local SEO weapon |
| `src/data/siteRoutes.js` | Sitemap + prerender registry |
| `src/data/blogPosts.js` | Topical authority + long-tail |
| `src/utils/seoConstants.js` | NAP, schema, business entity |
| `src/components/SEO.jsx` | Meta + JSON-LD |
| `src/components/AreaSEO.jsx` | Per-city schema |
| `scripts/generate-sitemap.mjs` | Sitemap at build |
| `scripts/prerender-meta.mjs` | Crawler-visible meta |
| `backend/src/routes/api.js` | Lead capture APIs |

---

## Money pages (protect and grow daily)

| URL | Lead type | Priority |
|-----|-----------|----------|
| `/for-sellers/` | Seller — market report | P0 |
| `/for-buyers/` | Buyer — search + contact | P0 |
| `/contact/` | Both | P0 |
| `/northern-colorado-areas/{city}/` | Both — local intent | P0 per city |
| `/chfa-down-payment-assistance/` | Buyer — program | P0 |
| `/chfa-schools-to-home/` | Buyer — educators | P1 |
| `/colorado-champions-home-loan-program/` | Buyer — first responders | P1 |
| `/properties/` | Buyer — listing search | P1 |
| `/blog/{slug}/` | Both — long-tail feeder | P2 |

---

## 19-city coverage matrix

Each city MUST have an active row in the market scorecard (maintain in memory or weekly report):

`fort-collins`, `loveland`, `windsor`, `greeley`, `timnath`, `wellington`, `johnstown`, `eaton`, `milliken`, `la-salle`, `mead`, `longmont`, `boulder`, `berthoud`, `firestone`, `frederick`, `evans`, `severance`, `niwot`

URL pattern: `https://saahomes.com/northern-colorado-areas/{slug}/`

---

## Lead APIs (production)

- `POST /api/contact`
- `POST /api/market-report`
- `POST /api/chfa-lead`
- `POST /api/champions-lead`
- `POST /api/chfa-dpa-lead`

CRM: Follow Up Boss (when `FOLLOW_UP_BOSS_API_KEY` configured on backend)

---

## Agency execution loops

### Loop A — Daily strike (automated)
GSC ranking deltas → indexation spot-check → alert on P0 regressions → Telegram brief

### Loop B — Weekly war room (automated)
Full SEO brief + lead funnel audit + competitor content watch + top 5 actions for the week

### Loop C — Content offense (fully automated)
Content gap → outline → draft → merge → deploy → notify Adam with live URL. Use `autonomous-execute` skill.

### Loop F — Backlink outreach (approval gate)
Research → draft email → Telegram review → send only on Adam `approved`. Use `backlink-outreach` skill.

### Loop D — Monthly deep audit (automated + delegation)
Schema audit + internal links + GBP/NAP + 19-city rotation + next-month content calendar

### Loop E — Conversion optimization (ongoing)
GA4 landing page × form data → CTA tests proposed → mobile UX fixes → PageSpeed regressions

---

## Tooling tiers

| Tier | Tools | Actions |
|------|-------|---------|
| **Public** | Site crawl, sitemap, PSI, CrUX, web search | Read-only audits |
| **Analytics** | GSC, GA4, GBP (when credentialed) | Performance + conversion |
| **SEO intel** | SerpAPI / Ahrefs MCP (optional) | SERP, backlinks, gaps |
| **Dev** | GitHub repo access | Auto PR, merge, deploy, publish |
| **Production** | Railway deploy hook | Auto after merge + CI |
| **Outreach** | Email API (after approval) | Backlink pitches only |

---

## Model routing (OpenCode Go)

| Workload | Model | Why |
|----------|-------|-----|
| Cron monitoring jobs | `deepseek-v4-flash` | Cheap, fast, high volume |
| Strategy + briefs | `kimi-k2.6` | Strong reasoning |
| Multi-city SERP deep dives | `deepseek-v4-pro` | Long context |
| Parallel subagents | `deepseek-v4-pro` | Isolated city audits |
| Compression / web extract aux | `deepseek-v4-flash` | Cost control |

**Always pin provider/model on cron jobs** so unattended runs don't fail closed after default changes.

---

## Integration status (update as connected)

- [ ] `OPENCODE_GO_API_KEY`
- [ ] Telegram or Slack delivery
- [ ] Google Search Console
- [ ] GA4 read access
- [ ] Google Business Profile
- [ ] GitHub repo (read/write + auto-merge for SEO PRs)
- [ ] Railway deploy on merge (or manual deploy notification)
- [ ] Outreach email send (SMTP/API — drafts only until Adam approves)
- [ ] SerpAPI or Ahrefs MCP (optional)
- [ ] PageSpeed Insights API (optional)

---

## When Adam asks for "more leads"

Default response framework:
1. Which cities/queries are we losing vs winning (data)
2. Fastest 3 fixes this week (specific pages + actions)
3. Content gaps competitors exploit (with outlines)
4. Conversion leaks on money pages (CTA/intent mismatch)
5. What cron/automation will handle vs what needs his approval

Never answer with generic SEO advice. Always tie to Northern Colorado + Schwartz and Associates + a specific URL or query.
