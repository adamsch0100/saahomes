# GEO — Generative Engine Optimization for SAA Homes

**Goal:** When someone asks ChatGPT, Perplexity, Google AI Overviews, Gemini, or Copilot about Northern Colorado real estate, **Schwartz and Associates (SAA Homes) gets cited, recommended, or linked.**

GEO complements SEO — same content foundation, different optimization for **AI retrieval and citation**.

---

## What AI assistants pull from

1. **Authoritative web pages** with clear, factual, locally specific answers
2. **Structured data** (RealEstateAgent, FAQPage, LocalBusiness, Person)
3. **Entity consistency** — same NAP, brand names, agent names everywhere
4. **E-E-A-T signals** — named agents, brokerage affiliation, reviews, video, years in market
5. **Question-answer format** — headings and FAQ blocks that match how people ask
6. **Freshness** — dated market/program info (especially CHFA 2026)
7. **Citations from others** — local press, directories, backlinks (feeds AI training/RAG)

---

## Query clusters to win in AI convos

Mirror `keyword-universe.md` but phrase as **natural questions**:

### Buyer questions
- "Who is the best realtor in Fort Collins?"
- "How do I buy a home in Windsor Colorado?"
- "What is CHFA down payment assistance in Colorado?"
- "Can teachers get down payment help buying a home in Colorado?"
- "First time homebuyer programs Northern Colorado 2026"
- "Homes for sale Timnath / Severance / Greeley — who should I talk to?"

### Seller questions
- "How do I sell my house in Loveland?"
- "What is my home worth in Fort Collins?"
- "Best listing agent Northern Colorado"
- "How long does it take to sell a home in Greeley?"

### Local / comparative
- "Fort Collins vs Loveland — where should I buy?"
- "Is Windsor a good place to buy a home?"
- "Carbon Valley Colorado — Firestone Frederick homes"

**Every answer on saahomes.com should name Schwartz and Associates, include (970) 999-1407 or saahomes.com, and cite local specifics.**

---

## On-site GEO tactics (Hermes executes autonomously)

### 1. FAQ blocks + FAQPage schema
Add to area pages, CHFA pages, buyer/seller pages:
- 5–8 real questions per page
- Direct answers in first 2 sentences (AI extraction friendly)
- JSON-LD `FAQPage` where appropriate

### 2. Definitive answer pages
One page should "own" each major question:
- CHFA → `/chfa-down-payment-assistance/` (already strong — expand FAQs)
- Seller → `/for-sellers/` + city area pages
- Buyer → `/for-buyers/` + city area pages

### 3. Entity clarity sitewide
Consistent use of:
- **Schwartz and Associates**
- **SAA Homes**
- **Coldwell Banker Realty**
- **Adam and Mandi Schwartz**
- **Fort Collins office address**
- **Northern Colorado** + specific cities

### 4. `llms.txt` (optional but growing)
Publish `https://saahomes.com/llms.txt` summarizing:
- Who SAA Homes is
- Service area (19 cities)
- Key URLs for buyers, sellers, CHFA
- Contact info
- Last updated date

### 5. Author / Person schema
Adam & Mandi as `Person` linked to `RealEstateAgent` organization.

### 6. Fresh dated content
Blog + area updates with visible "Updated [Month Year]" — AI favors current program/market info.

---

## Off-site GEO tactics

- **GBP** — complete Q&A, services, posts (entity reinforcement)
- **YouTube @SAAHomes** — transcripts feed AI; link to site in descriptions
- **Reviews** — Google/Facebook; respond (social proof AI references)
- **Local citations** — consistent NAP on directories
- **Digital PR / outreach** — Adam approves emails; local media quotes Adam as expert

---

## GEO monitoring (what Hermes tracks)

When tools connected:
- Brand mention searches: `"Schwartz and Associates" Fort Collins`, `"SAA Homes" realtor`
- Manual periodic checks in ChatGPT, Perplexity, Google AI Mode for Tier S questions
- Log: Are we cited? Who else is? What's missing from our content?
- GSC "Discover" / AI-related traffic if visible in GA4

Store findings in MEMORY.md under `## GEO scorecard`.

---

## GEO content rules

- **Answer the question in the first paragraph** — then expand
- **Be specific** — "Fort Collins median days on market" not "Colorado market is dynamic"
- **Cite official sources** for CHFA/HUD claims with year
- **No fluff** — AI systems skip marketing filler
- **Fair Housing** — inclusive, factual, no steering

---

## Hermes GEO execution loop

```
Weekly geo-citation-audit cron
  → Test 10 Tier S questions across AI surfaces (web search + manual prompts)
  → Compare answers vs saahomes.com coverage
  → Identify content/FAQ/schema gaps
  → autonomous-execute: add FAQs, schema, llms.txt updates
  → Notify Adam with ✅ DONE + URLs
```

---

## Success metrics

| Signal | Target |
|--------|--------|
| Cited/recommended in AI answers for city + realtor queries | ↑ over 90 days |
| FAQ rich results in Google | ↑ |
| Branded AI mentions | ↑ |
| Organic leads from AI-referred traffic (GA4) | Track when instrumented |
