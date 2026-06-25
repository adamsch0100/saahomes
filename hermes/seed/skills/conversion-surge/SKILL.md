---
name: conversion-surge
description: Conversion rate optimization pass on saahomes.com high-traffic pages — intent-matched CTAs for buyer and seller leads.
---

# Conversion Surge — CRO for Leads

## Goal
Turn Northern Colorado search traffic into Schwartz and Associates form submissions.

## Target pages (prioritize by traffic when GA4 connected, else P0 list)
1. /for-sellers/
2. /for-buyers/
3. Top 3 area pages by GSC impressions
4. /chfa-down-payment-assistance/

## Audit per page

### Intent match
| Traffic intent | Required CTA |
|----------------|----------------|
| Seller | Free market report — above fold |
| Buyer | Search properties + contact + CHFA if program traffic |
| Program | Program-specific lead form |
| Area (mixed) | Dual CTA: "Buying in {city}" / "Selling in {city}" |

### Mobile UX (375px viewport)
- [ ] Primary CTA visible without scroll?
- [ ] Click-to-call (970) 999-1407 present?
- [ ] Form fields ≤5 on first step?
- [ ] FloatingContactBar not obscuring CTA?

### Trust signals
- [ ] Testimonials or reviews visible?
- [ ] Adam/Mandi photo or video?
- [ ] Coldwell Banker affiliation?
- [ ] Local proof ("20+ years Northern Colorado")

### Friction
- [ ] Page speed blocking interaction?
- [ ] Broken form endpoints?
- [ ] Confusing headline (ranking for buyer query but seller CTA dominant)?

## Deliverable

```
⚡ Conversion Surge — [date]

| Page | Intent match | Mobile CTA | Trust | Score /10 |
|------|--------------|------------|-------|-----------|

Top 5 CRO fixes (estimated lead impact)
1. /for-sellers/ — Move market report form above fold — HIGH
2. ...

A/B ideas for Adam
- Headline variant A/B for [page]

Repo changes (PR-ready)
- [file]: [change description]
```

## Constraints
- No dark patterns or fake urgency
- Form test submissions only with approval
