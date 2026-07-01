# Automation Registry — Install on first boot

Hermes: **install every job below** using `cronjob` tool or `/cron add`.  
Pin `provider: opencode-go` and appropriate model on each job.  
Set `workdir: /opt/data/workspace/saahomes` on all jobs.  
Deliver results to Telegram (or configured platform).

Timezone: **America/Denver** (Mountain Time)

---

## Daily jobs (weekdays)

### 1. `daily-ranking-strike`
```
Schedule: 0 7 * * 1-5  (7:00 AM MT Mon–Fri)
Skill: daily-ranking-strike
Model: deepseek-v4-flash
Provider: opencode-go
Prompt: Run daily ranking strike for saahomes.com. Flag P0 regressions. Send brief to operator.
```

### 2. `indexation-patrol`
```
Schedule: 30 7 * * 1-5  (7:30 AM MT Mon–Fri)
Skill: indexation-rescue
Model: deepseek-v4-flash
Provider: opencode-go
Prompt: Spot-check indexation on P0 money pages and 3 rotating area pages. Alert if any dropped from index.
```

### 3. `form-pipeline-health`
```
Schedule: 0 8 * * *  (8:00 AM MT daily)
Model: deepseek-v4-flash
Provider: opencode-go
Prompt: Verify saahomes.com is reachable, /health OK if backend URL known, and contact page loads. Report only on failure.
```

### 4. `seo-execute-queue`
```
Schedule: 0 14 * * 1-5  (2:00 PM MT Mon–Fri)
Skills: autonomous-execute, content-gap-review
Model: kimi-k2.6
Provider: opencode-go
Prompt: Execute top SEO/content fix from this week's priorities. Ship via PR merge deploy. Notify Adam with ✅ DONE + live links. Do NOT ask permission first. Verify live with fetch-page-audit.py only — never curl|python pipes. See automation-policy.md.
```

### 5. `daily-done-digest`
```
Schedule: 30 7 * * 1-5  (7:30 AM MT Mon–Fri)
Model: deepseek-v4-flash
Provider: opencode-go
Prompt: If any actions were executed yesterday, send Adam a digest of completed work with links. Skip if nothing shipped.
```

---

## Weekly jobs

### 6. `weekly-war-room`
```
Schedule: 0 8 * * 1  (Monday 8:00 AM MT)
Skills: weekly-seo-brief, lead-funnel-audit, lead-attribution-brief
Model: kimi-k2.6
Provider: opencode-go
Prompt: Full weekly war room report — rankings, leads, funnel, lead attribution (GSC query → landing page → GA4 generate_lead), top 5 actions for Schwartz and Associates this week.
```

### 7. `geo-citation-audit`
```
Schedule: 0 9 * * 4  (Thursday 9:00 AM MT)
Skills: geo-citation-audit, autonomous-execute
Model: kimi-k2.6
Provider: opencode-go
Prompt: Run GEO audit on 10 rotating AI questions for Northern Colorado real estate. Ship FAQ/schema/content fixes. Notify Adam with ✅ DONE + URLs. Log scorecard in MEMORY.
```

### 8. `competitor-content-watch`
```
Schedule: 0 8 * * 3  (Wednesday 8:00 AM MT)
Skill: competitor-content-watch
Model: deepseek-v4-pro
Provider: opencode-go
Prompt: Scan top local competitor sites for new Northern Colorado real estate content. Flag threats to our city rankings.
```

### 9. `conversion-surge`
```
Schedule: 0 8 * * 5  (Friday 8:00 AM MT)
Skill: conversion-surge
Model: kimi-k2.6
Provider: opencode-go
Prompt: CRO pass on top 5 organic landing pages. Implement fixes via autonomous-execute. Notify Adam with live URLs.
```

### 10. `city-deep-dive-rotation`
```
Schedule: 0 9 * * 2  (Tuesday 9:00 AM MT)
Skill: local-market-audit
Model: deepseek-v4-pro
Provider: opencode-go
Prompt: Deep audit for this week's rotation city (rotate through 19 cities, track in MEMORY.md). Full SERP + content + schema report.
```

---

## Bi-weekly

### 11. `content-gap-offense`
```
Schedule: 0 30 11 1,15 * *  (1st and 15th, 11:30 AM MT — staggered vs Wed social + monthly link audit)
Skills: content-gap-review, autonomous-execute
Model: kimi-k2.6
Provider: opencode-go
Prompt: Run content gap on 3 Tier S queries we don't rank top 5 for. Execute best fix (blog or area expansion). Ship and notify Adam with live links. Verify live pages with fetch-page-audit.py only — never curl|python pipes.
```

### 12. `backlink-outreach-research`
```
Schedule: 0 10 * * 4  (Thursday 10:00 AM MT)
Skill: backlink-outreach
Model: kimi-k2.6
Provider: opencode-go
Prompt: Research 1-2 ethical backlink opportunities for Northern Colorado real estate. Draft outreach emails. Send OUTREACH REVIEW to Adam. Do NOT send without approved reply.
```

---

## Monthly

### 13. `schema-technical-audit`
```
Schedule: 0 9 1 * *  (1st of month, 9:00 AM MT)
Skill: schema-technical-audit
Model: deepseek-v4-flash
Provider: opencode-go
Prompt: Full schema + technical SEO audit. JSON-LD, canonicals, sitemap, robots, prerender coverage. Use fetch-page-audit.py for live checks — never curl|python pipes.
```

### 14. `internal-link-architecture`
```
Schedule: 30 10 1 * *  (1st of month, 10:30 AM MT — after Wed social when both fall on the 1st)
Skill: internal-link-architecture
Model: kimi-k2.6
Provider: opencode-go
Prompt: Map internal link equity flow to money pages. Implement link additions via autonomous-execute. Notify Adam with PR + live URLs. Verify with fetch-page-audit.py — never curl|python pipes.
```

### 15. `gbp-local-pack-audit`
```
Schedule: 0 11 1 * *  (1st of month, 11:00 AM MT)
Skill: local-pack-gbp-audit
Model: kimi-k2.6
Provider: opencode-go
Prompt: GBP/NAP/local pack audit. Draft GBP post, build social-post-pack JSON, email Adam via send-social-post-pack.py. Notify on Telegram when email sent.
```

### 16. `blog-content-calendar`
```
Schedule: 0 9 15 * *  (15th of month, 9:00 AM MT)
Skill: blog-pipeline
Model: kimi-k2.6
Provider: opencode-go
Prompt: Generate and publish next month's blog posts (2-4) from keyword gaps. Use autonomous-execute to ship. Notify Adam with each live URL.
```

### 17. `nineteen-city-scorecard`
```
Schedule: 0 8 1 * *  (1st of month, 8:00 AM MT)
Skill: local-market-audit
Model: deepseek-v4-pro
Provider: opencode-go
Prompt: Spawn subagents to audit 5 cities in parallel (batch 1 of 4). Update MEMORY scorecard. Repeat batches on 8th, 15th, 22nd via separate jobs or combined delegation.
```

---

## Quarterly

### 18. `market-dominance-review`
```
Schedule: 15 9 1 1,4,7,10 *  (1st of Jan/Apr/Jul/Oct, 9:15 AM MT — staggered vs other 9 AM jobs)
Model: kimi-k2.6
Provider: opencode-go
Prompt: Quarterly market dominance review vs market-dominance-strategy.md success metrics. Reset 90-day priorities. Report to Adam.
```

---

### 19. `social-weekly-content`
```
Schedule: 0 10 * * 3  (Wed 10:00 AM MT — runs first on 1st-of-month Wednesdays)
Skills: social-post-pack
Model: deepseek-v4-flash
Provider: opencode-go
Prompt: Read context/content-calendar.md, context/holiday-calendar.md, and context/social-channels.md. Follow Wednesday rotation (market pulse / tip / community / seasonal). If an approved holiday is within 7 days, use holiday-calendar rules instead of generic seasonal. If new blog or area page shipped this week, prioritize that in the pack. Always email Adam via send-social-post-pack.py (GBP + FB + IG + X). Update MEMORY ## Content calendar state. Never use Browserbase for social. Complete even if other crons ran earlier today — do not skip for gateway restarts.
```

### 20. `monthly-market-blog`
```
Schedule: 0 9 3 * *  (3rd of month, 9:00 AM MT)
Skills: blog-pipeline, autonomous-execute, social-post-pack
Model: kimi-k2.6
Provider: opencode-go
Prompt: Read context/content-calendar.md and context/repo-maintenance-checklist.md section B. Publish Northern Colorado Market Update blog for current month (if not already live). Update LATEST_MARKET_UPDATE_SLUG + supersededBy on prior market posts. Ship via PR/deploy. Email social-post-pack same day with operator_schedule. Log monthly_market_blog_url + latest_market_update_slug in MEMORY.
```

### 21. `weekly-operator-schedule`
```
Schedule: 15 7 * * 1  (Mon 7:15 AM MT)
Skills: operator-weekly-email
Model: deepseek-v4-flash
Provider: opencode-go
Prompt: Read context/operator-playbook.md, context/content-calendar.md, and MEMORY ## Content calendar state. Build day-by-day operator schedule JSON for Adam (social Wed, outreach Thu, FUB leads daily). Include any pending social packs from last week. Email via send-operator-weekly-email.py. Telegram: "Weekly operator schedule emailed."
```

### 22. `local-events-monthly`
```
Schedule: 30 9 1 * *  (1st of month, 9:30 AM MT — staggered vs schema audit on the 1st)
Skills: local-events-curation, social-post-pack
Model: deepseek-v4-flash
Provider: opencode-go
Prompt: Run monthly local events check per context/local-events-sources.md. Scan Tier S cities for flagship events in next 30 days. If notable, email social-post-pack (community). Update MEMORY last_events_check_date. Skip email if nothing notable.
```

### 23. `local-events-quarterly`
```
Schedule: 0 10 1 1,4,7,10 *  (1st of Jan/Apr/Jul/Oct, 10:00 AM MT)
Skills: local-events-curation, autonomous-execute, social-post-pack
Model: kimi-k2.6
Provider: opencode-go
Prompt: Quarterly refresh per local-events-sources.md. Update src/data/localEvents.js + events guide in blogPosts.js. Set EVENTS_DATA_LAST_REVIEWED. Ship via PR/deploy. Email social-post-pack. Update MEMORY events_guide_last_refresh. Notify Adam with ✅ DONE + blog URL.
```

### 24. `lead-attribution-brief`
```
Schedule: 30 8 * * 1  (Monday 8:30 AM MT)
Skill: lead-attribution-brief
Model: kimi-k2.6
Provider: opencode-go
Prompt: Run weekly lead attribution brief — connect GSC top queries and landing pages to GA4 generate_lead events. Flag high-impression/low-lead pages for CRO. Append summary to MEMORY ## Lead attribution log. Telegram brief to Adam.
```

---

## Install verification

After creating all jobs, run:
```
/cron list
```

Confirm **24 jobs** active. Log completion in MEMORY.md under "Automation installed: [date]".

If GSC/GA4 not yet connected, jobs still run public-only checks and note missing integrations in every report.
