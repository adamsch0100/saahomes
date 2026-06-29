# Content Calendar — Blog + Social (World-Class NOCO Agent)

**Brand:** Schwartz and Associates · SAA Homes · Adam & Mandi · 20+ years Northern Colorado  
**Rule:** saahomes.com owns **depth** (SEO). Social owns **reach + trust + local presence**. Every piece ties to a lead path when possible.

Read with: `social-channels.md`, `social-post-pack` skill, `blog-pipeline` skill, `market-dominance-strategy.md`.

---

## Content pillars (what world-class local agents post)

| Pillar | Purpose | Primary format | Lead path |
|--------|---------|----------------|-----------|
| **Market intelligence** | Expert authority | Blog monthly + social weekly | Market report · area pages |
| **Seller education** | Capture listing intent | Blog + social teaser | `/for-sellers/` |
| **Buyer education** | Capture search intent | Blog + area pages + social | `/for-buyers/` · areas |
| **Programs (CHFA, etc.)** | Unique Colorado moat | Blog/area updates + seasonal social | CHFA forms |
| **City / neighborhood** | Local pack + long-tail | Area page (site) + social spotlight | Area URLs |
| **Local community** | Trust, not spam | Social-first | Soft CTA contact |
| **Seasonal / holidays** | Stay top-of-mind | Social-first | Relevant money page |
| **News & rate context** | Timely expert takes | Social-first; blog if major | Contact · market report |
| **Social proof** | E-E-A-T | Social; site testimonials | Contact |
| **Video repurposing** | YouTube ↔ site | Blog from transcript + social clip text | @SAAHomes |

**Fair Housing:** Never steer by protected class. Stats must be sourced (GSC, public market data, cite year). No guaranteed sale prices or approval claims.

---

## Blog vs social — when to build what

| Category | Blog on saahomes.com? | Social post pack email? | Notes |
|----------|----------------------|-------------------------|-------|
| New **blog** published | ✅ (the blog) | ✅ **Always** same week | Full article on site; social = teaser + link |
| New/updated **area page** | ✅ (the page) | ✅ **Always** | Social highlights city + dual buyer/seller CTA |
| **Monthly market snapshot** | ✅ 1×/month (1,200–2,000 words) | ✅ + weekly stat snippets | Anchor post for the month |
| **Seller / buyer guides** | ✅ 1–2×/month | ✅ on publish | Deep SEO; social pulls one insight |
| **CHFA / program changes** | ✅ when material | ✅ seasonal reminders | Cite official sources + year |
| **Weekly market pulse** | ❌ | ✅ Wed cron | 2–3 sentences + one stat + link to for-sellers or latest market blog |
| **Local events** (FoCo parade, farmers market, CSU, etc.) | ✅ quarterly guide refresh | ✅ 1×/month if notable event | `local-events-curation` skill · see `local-events-sources.md` |
| **Holidays** (see **`holiday-calendar.md`** — approved list only) | ❌ | ✅ 7–8/year max | Gratitude/patriotic; no sales pitch on military holidays |
| **Rate / news react** | ⚠️ only if major | ✅ same week | Social hot take; blog optional 800-word explainer |
| **Quick tips** (staging, inspection, winter prep) | ❌ | ✅ weekly rotation | Link to relevant blog or money page if exists |
| **Testimonials / wins** | ❌ | ✅ 1×/month max | Use real review language; no fabricated stories |

**Default:** If it can rank on Google and drive leads for months → **blog**. If it’s timely, community, or promotional → **social only**. **Both** when a blog ships.

---

## Weekly rhythm (Hermes automated)

| Day | Job | Action |
|-----|-----|--------|
| **On blog/area deploy** | `autonomous-execute` / deploy notify | Build social-post-pack JSON → **email Adam immediately** |
| **Wednesday 10 AM MT** | `social-weekly-content` (cron #18) | Follow **weekly rotation** below → email post pack even if no new blog |
| **Thursday** | `backlink-outreach-research` | Outreach drafts only |
| **15th monthly** | `blog-content-calendar` | Plan + publish 2–4 blogs next 30 days |
| **1st monthly** | `gbp-local-pack-audit` + scorecard | GBP draft in email pack if not sent that week |

Track last published types in MEMORY.md under `## Content calendar state`.

---

## Wednesday rotation (4-week cycle)

Use `week_of_month = (day_of_month - 1) // 7 + 1` or track index in MEMORY.

| Week | Theme | Social content | Link target |
|------|-------|----------------|-------------|
| **1** | Market pulse | One local stat or trend (Larimer/Weld) + “questions? call us” | Latest market blog or `/for-sellers/` |
| **2** | Seller OR buyer tip | One actionable tip (pricing, prep, first-time buyer step) | `/for-sellers/` or `/for-buyers/` or area page |
| **3** | Community / city | Local event, neighborhood shoutout, or city spotlight | Relevant `/northern-colorado-areas/{city}/` |
| **4** | Program / seasonal | CHFA reminder, season (spring market, winter prep), or holiday tie-in | Program page or seasonal blog |

**Also check each Wednesday:** Any **approved** holiday within 7 days? → see **`holiday-calendar.md`** (replace rotation opener or email Mon/Tue if holiday is not Wed).

**If new blog/area shipped since last Wednesday:** prioritize **that** in the pack; still include rotation item if not redundant.

---

## Seasonal & holidays (social-first)

**Holiday posts:** Full rules + approved list in **`holiday-calendar.md`**. Only: New Year's, Memorial Day, July 4, Labor Day, Veterans Day, Thanksgiving, Christmas.

| When | Angle | CTA |
|------|-------|-----|
| Jan | New year (if on approved list) + spring market preview in rotation | Market report |
| Feb–Mar | Spring prep for sellers, buyer tax timing | for-sellers / for-buyers |
| Memorial Day / July 4 / Labor Day | Per holiday-calendar — patriotic, community | contact (optional) |
| Aug–Sep | Back to school (Weld/Larimer schools link to area FAQs) | area pages |
| Oct | Fall market, winterization tips | for-sellers |
| Veterans Day / Thanksgiving / Christmas | Per holiday-calendar — gratitude, no hard sell | optional soft |

Never exploit tragedy or disasters for leads. **Never post DEI, political, or awareness-day content** — see holiday-calendar do-not list.

---

## Monthly market report (flagship content)

**Blog (1st week of month):** `Northern Colorado Market Update — [Month Year]`
- Larimer + Weld snapshot (inventory, median trend direction, days on market — source data, cite month)
- 2–3 city callouts (Fort Collins, Loveland, Windsor, Greeley rotation)
- Seller vs buyer one-paragraph each
- CTA: free market report + contact
- Internal links: 3 area pages + for-sellers + for-buyers

**Social:** Same week email pack + week-1 Wed pulse uses one stat from the post.

Hermes: coordinate `blog-content-calendar` (15th plans ahead) and publish market post **first week of each month** (add to blog-pipeline backlog execution or week-1 Wed job).

---

## World-class quality bar (every piece)

### Blog
- [ ] Targets one primary query from `keyword-universe.md` or GSC gap
- [ ] 1,200–2,000 words; unique local detail (not generic US advice)
- [ ] 2+ internal links to area pages + 1 money page
- [ ] CHFA/program claims cited with year + official link
- [ ] Hero image from site assets or licensed; alt text
- [ ] CTA above fold and end
- [ ] Fair Housing safe

### Social (email pack)
- [ ] **GBP + Facebook + Instagram + X** captions every pack
- [ ] Instagram: image attached (hero from blog/area or branded graphic path)
- [ ] First line hooks locally (“Northern Colorado sellers…” not “Hey guys”)
- [ ] One clear CTA + one link (saahomes.com)
- [ ] Optional: LinkedIn / Nextdoor / Pinterest blocks (see operator-playbook)
- [ ] 150–300 words max per platform (GBP shorter)
- [ ] No duplicate spam — vary opening vs last 3 posts in MEMORY

---

## Hermes execution checklist

### When shipping blog or area page
1. Publish + deploy → ✅ DONE Telegram
2. Run **`social-post-pack`** → JSON → `send-social-post-pack.py`
3. Log in MEMORY: date, URL, pillar, platforms emailed

### Every Wednesday (`social-weekly-content`)
1. Read `## Content calendar state` in MEMORY
2. Apply rotation week + holiday check
3. If no fresh site content, **still email** social-only pack
4. Update MEMORY rotation index

### Monthly (15th)
1. **`blog-pipeline`** → 2–4 posts including market snapshot for next month
2. Publish via autonomous-execute per USER.md
3. When market post ships: update `LATEST_MARKET_UPDATE_SLUG` per **`repo-maintenance-checklist.md` section B**

### Hermes post-ship reference
All blog, market, nav, and email maintenance steps: **`context/repo-maintenance-checklist.md`**

### Data sources for market content
- GSC, public listing trends, browse.sh Zillow/Realtor **intel** (Browserbase optional)
- Never invent statistics

---

## Content calendar state (MEMORY template)

```
## Content calendar state
last_social_pack_date:
last_social_pillar:
rotation_week_index: 1-4
last_3_social_hooks: []
monthly_market_blog_url:
latest_market_update_slug: northern-colorado-market-update-june-2026
blogs_published_this_month:
pending_social_packs: []
```

Hermes maintains this section. **`latest_market_update_slug` must match `LATEST_MARKET_UPDATE_SLUG` in `src/data/blogPosts.js`** after every market update ship.

---

## Adam's manual role

- Paste email packs to Meta + GBP + X (~5 min)
- Market report **leads** from form — you close in FUB
- Optional: LinkedIn / Nextdoor / Pinterest from extra email blocks

No Browserbase for social. See `hard-rules.md`.
