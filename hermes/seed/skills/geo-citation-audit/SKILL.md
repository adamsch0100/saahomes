---
name: geo-citation-audit
description: Audit SAA Homes visibility in AI-generated answers (GEO) for Northern Colorado buyer/seller questions. Identify gaps and execute FAQ/schema/content fixes.
---

# GEO Citation Audit — SAA Homes

## Mission
Ensure Schwartz and Associates appears when people ask AI assistants about Northern Colorado real estate.

Read `context/geo-strategy.md` for full playbook.

---

## Step 1 — Test question set (rotate 10/week from pools)

### Pool A — City realtor (pick 3 cities)
- "Who is the best realtor in {city} Colorado?"
- "Recommend a real estate agent in {city} CO"

### Pool B — Buyer intent (pick 2)
- "How do I buy a home in Northern Colorado?"
- "CHFA down payment assistance Colorado 2026 — how does it work?"

### Pool C — Seller intent (pick 2)
- "How do I sell my home in {city}?"
- "What is my home worth in Fort Collins?"

### Pool D — Program niche (pick 1)
- "CHFA Schools to Home Colorado teachers"
- "Colorado Champions home loan first responders"

### Pool E — Branded (always)
- "Schwartz and Associates Fort Collins"
- "SAA Homes Northern Colorado"

---

## Step 2 — Check AI surfaces

For each question, research via:
- Web search (Perplexity-style results, Google AI overview snippets if visible)
- Note: who is cited, linked, or recommended
- Is saahomes.com or Schwartz and Associates mentioned?
- If yes: accurate? prominent?
- If no: why? (competitor content deeper? missing FAQ? weak entity signals?)

Log in MEMORY.md `## GEO scorecard`.

---

## Step 3 — Gap analysis

For questions where we're absent or weak:
1. Does saahomes.com have a page that **directly answers** this?
2. Does that page have FAQ + schema?
3. Is the answer in the **first paragraph**?
4. Are Adam/Mandi named as local experts?
5. Is content fresher than competitors?

---

## Step 4 — Execute fixes (autonomous)

Use `autonomous-execute` to ship:
- FAQ sections + FAQPage JSON-LD
- Title/H1 aligned to question phrasing
- `llms.txt` update if new key pages added
- Internal links from blog to money pages
- Area page expansion with Q&A format

Notify Adam:
```
✅ DONE — GEO fix: [question cluster]
What: Added FAQ + schema on [URL]
Links: [live URL]
AI gap closed: [brief]
```

---

## Step 5 — Weekly report section

```
🤖 GEO Pulse — Week of [date]

Cited: X/10 test questions
Gaps found: [list]
Shipped this week: [URLs]
Still losing to: [competitor] on [query]
Next: [action]
```

---

## Do not
- Claim false "#1 in AI" rankings — report observations honestly
- Fabricate reviews or credentials
- Copy competitor FAQ text verbatim
