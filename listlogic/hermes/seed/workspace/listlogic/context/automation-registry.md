# Automation registry — ListLogic Hermes

Timezone: America/Denver. workdir: `/opt/data/workspace/listlogic` (or hermes-owned `/opt/data/listlogic` if perms require). Deliver to Telegram.

## Model routing (locked)

| Tier | Model ID | Use |
|------|----------|-----|
| Daily / default | `opencode-go/deepseek-v4-flash` | site-health, funnel-pulse, harvest, most Telegram turns |
| Next step | `opencode-go/deepseek-v4-pro` | competitor-watch, content drafts, delegation children |
| Super intelligence | `opencode-go/kimi-k3` | weekly-growth-brief hard calls, MLS strategy, high-stakes outreach framing |

Gateway `model.default` = `deepseek-v4-flash`. Pin every cron job explicitly.

## Daily
1. `site-health` — listlogic.homes money paths reachable — **flash**
2. `funnel-pulse` — signups / generate_blocked / checkouts when GA4 wired — **flash**

## Weekly
3. `weekly-growth-brief` — pipeline + SEO + top 5 — **kimi-k3**
4. `prospect-harvest` — public directories → CRM — **flash** (escalate batch to **pro** if JS-heavy)
5. `outreach-draft-pack` — email/SMS for Adam approve — **pro** (use **kimi-k3** only if pack is strategic/brokerage pilot)
6. `competitor-watch` — Cloud CMA / Saleswise / AI CMA — **pro**

## Bi-weekly
7. `content-seo-offense` — comparison/pillar drafts → PR — **pro** (+ execute)
8. `mls-partner-research` — vendor notes — **kimi-k3**

Install on first boot; re-pin if Hermes drifts to unsupported models (never claude-opus on Go).
