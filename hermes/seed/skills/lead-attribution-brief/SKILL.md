---
name: lead-attribution-brief
description: Weekly report connecting GSC queries and landing pages to GA4 generate_lead form events — closes the SEO-to-lead loop for Schwartz and Associates.
---

# Lead Attribution Brief — SEO → Leads

## When
Every Monday 8:30 AM MT (paired with weekly-war-room, or standalone).

## Purpose
Answer: **Which organic queries and pages are actually producing form leads?** Rankings alone are not enough — this brief ties demand capture to conversion.

## Data sources (use what's connected)

### Required when available
- **GSC** (last 7 days): top queries by impressions, top landing pages by clicks
- **GA4** (last 7 days): `generate_lead` and `saa_lead_submit` events by:
  - `page_location` (landing URL)
  - `lead_type` (market-report, contact, chfa, etc.) if present
  - `form_name` / event params if present

### Public fallback (no GA4/GSC)
- Crawl money pages: `/for-sellers/`, `/for-buyers/`, top 5 area pages from keyword-universe Tier 1
- Note integration gap; recommend Adam connect GA4 service account

## Report sections

### 1. Lead summary (7 days)
- Total `generate_lead` events (vs prior 7 days ▲▼)
- Breakdown by lead_type: market-report, contact, chfa-*, other
- Top 3 landing URLs by lead count

### 2. Query → page → lead chain
Table (top 10 rows where data allows):

| GSC query | Landing page | Impressions | Clicks | Leads (GA4) | Notes |
|-----------|--------------|-------------|--------|-------------|-------|

If query-level lead attribution isn't available in GA4, use landing page only and note the gap.

### 3. High-impression / low-lead pages
Pages with GSC impressions >100 and zero or low leads — CRO candidates for `conversion-surge`.

### 4. High-lead / low-rank opportunities
Pages getting leads but ranking position >10 on related Tier S query — content/internal link priority.

### 5. Recommended actions (max 5, lead-weighted)
Each: specific URL + query + fix (Hermes executes vs Adam manual).

## Output
- Telegram brief (400–600 words)
- Append summary row to MEMORY.md `## Lead attribution log` with date + top query + top lead page

## Combine with
Run in same week as `weekly-seo-brief` and `lead-funnel-audit`. Do not duplicate funnel health checks — focus on attribution.
