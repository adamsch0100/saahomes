---
name: content-gap-review
description: SERP content gap analysis for a SAA Homes target query — out-depth competitors to capture Northern Colorado buyer/seller leads.
---

# Content Gap Review — Market Offense

## Mission
Find exactly why competitors outrank Schwartz and Associates — and specify how to beat them with **deeper local expertise**, not spam.

## Input
- Target query (Tier S or A from keyword-universe.md)
- Our URL (or proposed slug)
- Optional: competitor URL from SERP

## Steps

1. **SERP landscape** — top 10 results: domain type (portal, local broker, Zillow, etc.)
2. **Intent classification** — buyer, seller, or mixed?
3. **Our page audit** — content depth, headings, entities, FAQs, media, CTAs, schema
4. **Winner analysis** — what do top 3 **local** results (non-portal) include that we lack?
5. **Gap list** — specific sections, data, FAQs, internal links missing
6. **Outline to win** — H1 + H2 structure with **Colorado-specific** requirements per section
7. **Lead capture plan** — which CTA, where, matched to intent
8. **Internal link plan** — 3+ links to related area/money pages

## Output

```
🎯 Content Gap: "[query]"
Our URL: [url] — Current position: [#]

Why we're losing
1. ...

Winning outline
# H1: ...
## H2: [must include local fact requirement]
...

Schema to add: FAQPage / ...

CTA: [specific]

Estimated effort: [S/M/L] — PR to [file]
```

## Quality bar (agency standard)
- Must pass "would a Fort Collins homeowner learn something new?" test
- Minimum 800 words equivalent depth for area page expansions
- No duplicate content across cities — unique local facts per slug

## Constraints
- Fair Housing compliant
- Do not copy competitor prose
- Live page checks in cron: use `python3 /usr/local/bin/fetch-page-audit.py URL` — never `curl | python3` (tirith security block → Broken pipe)
