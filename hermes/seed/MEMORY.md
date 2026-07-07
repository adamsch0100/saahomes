# Strategic memory — Hermes updates this as the program compounds

## Operator mode
**Full automation** — execute, deploy, notify. Adam: outreach `approved` before send · social paste from email packs · FUB lead follow-up. Master process: `context/operator-playbook.md`.

## Current strategic priorities (Q2 2026)
1. Defend and grow **seller intent** — `/for-sellers/` + market report funnel + `{city} sell home` queries
2. Expand **buyer intent** — area guides + CHFA program cluster + `{city} homes for sale`
3. Win **Carbon Valley growth corridor** — Firestone, Frederick, Severance, Timnath (high growth, rising search volume)
4. Protect **Fort Collins + Loveland** — highest volume, most competitor pressure
5. Feed **YouTube @SAAHomes** and GBP into on-site CTAs (entity consistency)

## Market scorecard template
Maintain per city (update weekly):
- Primary buyer query: position, impressions, URL
- Primary seller query: position, impressions, URL
- Last content refresh date
- Top local competitor in SERP
- Open action items

## Wins log
(Hermes: append dated wins here — ranking improvements, new indexation, PRs merged, lead page CRO fixes)

## Content calendar state
(Hermes: maintain per content-calendar.md — rotation_week_index, last_social_pillar, last_3_social_hooks, monthly_market_blog_url, latest_market_update_slug. See repo-maintenance-checklist.md when shipping market updates.)

## Open blockers
(Hermes: list integration gaps preventing full automation — do NOT list Browserbase missing as blocker for social; social uses SMTP email packs)

## Integration status (canonical — update when changes)

### Readiness checklist (Adam confirms in Railway / Telegram)

| # | Item | Status | Blocks |
|---|------|--------|--------|
| 1 | Hermes Railway service deployed (root `hermes`, volume `/opt/data`, port 9119) | ❓ verify | Everything |
| 2 | `OPENCODE_GO_API_KEY` | ❓ verify | Agent brain |
| 3 | `TELEGRAM_BOT_TOKEN` + `TELEGRAM_ALLOWED_USERS` | ❓ verify | Notifications + outreach review |
| 4 | Dashboard auth vars (`HERMES_DASHBOARD_*`) | ❓ verify | Public URL works |
| 5 | `API_SERVER_KEY` | ❓ verify | Dashboard API |
| 6 | 24 cron jobs installed (first-boot prompt) | ❓ verify | Autonomous monitoring + shipping |
| 7 | `GITHUB_TOKEN` + `GITHUB_REPO=adamsch0100/saahomes` | ❓ verify | Auto PR + merge SEO/content |
| 8 | `RAILWAY_TOKEN` + `RAILWAY_SERVICE_ID` (**website** service, not Hermes) | ❓ verify | Live deploy after merge |
| 9 | GSC service account (`GSC_SERVICE_ACCOUNT_JSON_B64` or JSON file) | ❓ verify | Precise keyword ranking data |
| 10 | GA4 service account for Hermes read access | ❓ verify | Lead-optimized weekly reports |
| 11 | `OUTREACH_SMTP_*` + `SOCIAL_POST_EMAIL_TO` | ❓ verify | Social packs + outreach emails |
| 12 | Follow Up Boss on **backend** service (`FOLLOW_UP_BOSS_API_KEY`) | ❓ verify | Leads reach CRM |
| 13 | `generate_lead` marked key event in GA4 Admin | ❓ verify | Conversion tracking |
| 14 | Browserbase (optional) | optional | browse.sh market intel only |
| 15 | SerpAPI (optional) | optional | Deeper SERP intel |

**Site-side (repo — done):** GA4 Google tag `G-CB5GL0P3EZ` (stream `G-BVWCZE025P`) + form `generate_lead` events · 19 area pages · lead APIs · keyword universe · **24 cron definitions** · skills bundled · `public/llms.txt` · FAQ schema on `/for-sellers/` + `/for-buyers/` · Person schema on `/about-us/` · FUB tags (`saahomes-organic`, `market-report`, `chfa`) · 6 keyword-gap blog posts queued in repo · Carbon Valley area depth (Firestone/Frederick).

**Adam manual (ongoing):** paste social packs · approve outreach · FUB speed-to-lead when Conversion Hermes hands off.

**Demand Hermes repo work: COMPLETE (2026-06-30).** Remaining: Railway `/cron list` → 24 jobs after redeploy; Adam confirms integration checklist rows in table below.

## Lead attribution log
(Hermes: append weekly summaries from `lead-attribution-brief` cron — GSC query → landing page → GA4 generate_lead)

## Content backlog (shipped in repo)
- [x] Windsor seller guide — `/blog/selling-a-home-in-windsor-colorado/`
- [x] Loveland seller guide — `/blog/selling-a-home-in-loveland-colorado/`
- [x] Greeley seller guide — `/blog/selling-a-home-in-greeley-colorado/`
- [x] Timnath + Severance new construction buyer guide
- [x] Carbon Valley affordability guide (Firestone/Frederick)
- [x] Fort Collins vs Loveland vs Windsor comparison
- [x] Weld County vs Larimer County buyer guide
- [ ] Monthly market snapshot — recurring via `blog-pipeline` cron (template exists)

- **Social posting:** SMTP email packs via `social-post-pack` skill → adam@saahomes.com. Adam publishes GBP/Meta manually. **Never Browserbase for social.**
- **YouTube uploads:** `article-youtube-video` skill + `upload-youtube-video.py` (Data API). OAuth on `/opt/data/credentials/` or `YOUTUBE_*` env.
- **Browserbase:** Optional. browse.sh market intel only (Zillow, Realtor, Walk Score).
- **Outreach:** SMTP; Adam `approved` before send.

## Competitor watch
(Hermes: top 3 local broker competitors per major city — update monthly)
