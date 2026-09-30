# SERP Baseline — 2026-09-28 (listlogic.homes)

**Status: DEGRADED — intended script missing; substitute search backend used.**

## What happened
- `serp_baseline.py` does not exist on this host. The cron job (`serp-rank-baseline-weekly`,
  id `de4e83f4e336`) declares `script: "serp_baseline.py"` but the file is absent from every
  candidate location (`/data/hermes-homes/listlogic/scripts/` is an empty dir;
  `/opt/data/home/.hermes/scripts/` and `/opt/data/scripts/` do not exist).
- No prior `serp-baseline-*.md` exists, so this is the **first** baseline entry (nothing to diff).
- The documented engine (DuckDuckGo HTML) is **blocked from this host** — `html.duckduckgo.com`
  and `lite.duckduckgo.com` both return the bot challenge (HTTP 202 "anomaly").
  No headless browser is installed (Chromium missing) and no SERPER/FIRECRAWL key is present in
  this environment's `.env`.
- Substitute used: the platform `web_search` tool (served by keenable / firecrawl). It returns the
  top 10 organic results only — positions are **not** comparable to the intended DDG top-30 scrape.

## Baseline (Tier S/A sample, 6 keywords)
Rank = position of listlogic.homes in the top 10; "—" = absent from top 10.

| Keyword | listlogic.homes | Top-3 domains | Notes |
|---|---|---|---|
| fort collins homes for sale | — | zillow.com, realtor.com, redfin.com | portal-dominated |
| fort collins real estate | — | dayandco.net, torresgroup.net, symbiohomes.com | broker sites |
| northern colorado real estate | — | kittlerealestate.com, isellnortherncolorado.com, northerncohomesearch.com | **saahomes.com #6** (sibling brand) |
| sell my home fort collins | — | redfin.com, zillow.com, zillow.com | opendoor #9 |
| luxury real estate fort collins | — | zillow.com, sothebysrealty.com, realtor.com | luxurync.com #10 |
| chfa down payment assistance colorado | no data | (backend returned no results) | re-run needed |

## Honest reading
- **Zero listlogic.homes rankings** in the top 10 for any sampled Tier S/A keyword. Expected for a
  brand-new domain.
- The one bright signal: **saahomes.com/properties sits #6 for "northern colorado real estate"** —
  the strongest regional SERP position the portfolio holds.
- "—" here means not in top 10, **not** "not in top 30". No top-30 measurement was possible.

## Fix needed (unblock)
1. Re-provision `serp_baseline.py` (DDG HTML scraper per the growth-ops skill) — file is gone.
2. Give the host a working SERP path: either a SERPER/FIRECRAWL API key in `.env`, or install
   Chromium for the browser backend. DDG HTML scraping from this datacenter IP will keep failing.
3. Correct the paths: this host uses `/data/org/projects/listlogic/work/` as the project tree, not
   `/opt/data/listlogic/`.
