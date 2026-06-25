# Skills Registry — Hermes + browse.sh + Skills Hub

Hermes can use **three skill sources**. Our custom SAA Homes skills live in the repo seed; extend with community skills when needed.

---

## Sources

| Source | URL | Hermes CLI |
|--------|-----|------------|
| **Skills Hub** (official + community) | [hermes-agent.nousresearch.com/docs/skills](https://hermes-agent.nousresearch.com/docs/skills) | `hermes skills browse` |
| **browse.sh** (Browserbase web automation) | [browse.sh](https://browse.sh/) | `--source browse-sh` |
| **Custom (repo seed)** | `hermes/seed/skills/*` | Bundled on first boot |

---

## Hermes CLI cheat sheet

```bash
# Browse all registries (official skills first)
hermes skills browse

# Search Skills Hub
hermes skills search seo
hermes skills search research

# Search browse.sh catalog (200+ site-specific browser skills)
hermes skills search zillow --source browse-sh
hermes skills search realtor --source browse-sh

# Preview before install
hermes skills inspect browse-sh/zillow.com/extract-listings-zw43tv

# Install
hermes skills install browse-sh/realtor.com/extract-listings-9v0y4r

# List installed
hermes skills list

# In chat
/skills
/skills search market
/skills install browse-sh/walkscore.com/get-score-...
```

Installed skills land in `/opt/data/skills/` (Railway volume) and become slash commands.

Docs: [Hermes Skills System](https://hermes-agent.nousresearch.com/docs/user-guide/features/skills) · [Working with Skills](https://hermes-agent.nousresearch.com/docs/guides/work-with-skills)

---

## browse.sh — when we use it

[browse.sh](https://browse.sh/) is Browserbase's **free skill catalog** — pre-built playbooks for Zillow, Realtor.com, Redfin, Walk Score, YouTube, etc. Hermes installs via `--source browse-sh`.

**browse.sh is not a separate subscription.** It is skill files only. **Browserbase** is the cloud browser engine that runs them on Railway (and for GBP/social posting). Same env vars for both.

**Use browse.sh for:**
- Competitor/market data (listings, comps, days on market) to enrich area pages + seller content
- School ratings for area guide FAQs (GEO + local authority)
- Walk Score / neighborhood data for city pages
- YouTube transcript extraction for @SAAHomes → blog/GEO repurposing

**Use Hermes browser tools (Browserbase) for:**
- browse.sh market intel — Zillow, Realtor, Walk Score, YouTube transcripts → area pages & blogs
- Read-only competitor/market data when public API or web_extract is insufficient

**Do NOT use Browserbase for:**
- GBP, Facebook, Instagram, YouTube, or X posting (use `social-post-pack` email workflow)
- Logging into Google/Meta as Adam

**Required env (Railway Hermes service):**
```
BROWSERBASE_API_KEY=
BROWSERBASE_PROJECT_ID=
```

Optional: `BROWSER_INACTIVITY_TIMEOUT=300`

Free tier: ~1 browser hour/month, 15 min max per session. See [Browserbase plans](https://docs.browserbase.com/account/plans).

**Install CLI (optional, on Adam's PC for cookie-sync):**
```bash
npm i -g browse
browse skills add zillow.com
```

On Railway, Hermes uses Browserbase for **browse.sh market intel only** when `BROWSERBASE_*` is set. Social posting uses SMTP email packs — see `operator-playbook.md`.

---

## Recommended browse.sh installs for SAA Homes

Install on first boot after Hermes is live (`hermes skills install ...`):

| Skill | browse-sh slug (search to confirm exact slug) | Use case |
|-------|-----------------------------------------------|----------|
| Zillow listings | `browse-sh search zillow --source browse-sh` | Market snapshot data for blog/area pages |
| Realtor.com listings | `realtor.com/extract-listings-*` | Comp portal SERP content gaps |
| Realtor.com schools | `realtor.com/get-school-rating-*` | Area page FAQ: "schools in {city}" |
| Redfin comps | `redfin.com/get-comparable-sales-*` | Seller content / market report angles |
| Walk Score | `walkscore.com/get-score-*` | Neighborhood sections on area pages |
| YouTube transcript | `youtube.com/extract-transcript-*` | Repurpose @SAAHomes video → GEO content |
| Google Patents | `patents.google.com/search-patents-*` | Niche — skip unless needed |

**Do not use browse.sh for:**
- Scraping lead PII
- Posting on Zillow/Realtor as SAA Homes (read-only intel only)
- Anything that violates site ToS at scale

---

## Custom SAA Homes skills (repo seed — always active)

| Skill | Purpose |
|-------|---------|
| `daily-ranking-strike` | GSC ranking deltas |
| `geo-citation-audit` | AI answer visibility (GEO) |
| `autonomous-execute` | Ship + notify |
| `backlink-outreach` | Draft emails → Adam approves |
| `local-market-audit` | Per-city deep audit |
| `content-gap-review` | SERP content offense |
| `blog-pipeline` | Content calendar |
| `conversion-surge` | CRO |
| `weekly-seo-brief` | Monday war room |
| `lead-funnel-audit` | Form/funnel health |
| `competitor-content-watch` | Competitor new content |
| `schema-technical-audit` | Technical SEO |
| `internal-link-architecture` | Link equity |
| `local-pack-gbp-audit` | GBP/local pack |
| `social-post-pack` | Email GBP + social captions/images to Adam |
| `indexation-rescue` | Indexation patrol |

---

## First-boot skill install (add to checklist)

After cron jobs installed, run:

```
/skills search zillow --source browse-sh
/skills install browse-sh/[zillow-listings-slug]

/skills search realtor --source browse-sh
/skills install browse-sh/[realtor-listings-slug]
/skills install browse-sh/[realtor-schools-slug]

/skills search walkscore --source browse-sh
/skills install browse-sh/[walkscore-slug]

/skills search youtube transcript --source browse-sh
/skills install browse-sh/[youtube-transcript-slug]
```

Log installed slugs in MEMORY.md.

---

## When to add NEW skills

| Need | Action |
|------|--------|
| New city data source | Search browse.sh for domain |
| New SEO workflow | Add custom skill to `hermes/seed/skills/` + redeploy seed |
| Official Hermes skill | [Skills Hub](https://hermes-agent.nousresearch.com/docs/skills) → `hermes skills install official/...` |
| One-off site automation | `hermes skills search [domain] --source browse-sh` |

Community skills are `trust: community` — inspect with `hermes skills inspect` before install.

---

## GEO note

GEO audits (ChatGPT/Perplexity/Google AI visibility) use Hermes **web search + web_extract + our geo-citation-audit skill** — not a browse.sh skill today. browse.sh helps gather **market/competitor facts** that make our content cite-worthy in AI answers.
