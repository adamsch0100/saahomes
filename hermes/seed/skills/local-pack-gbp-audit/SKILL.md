---
name: local-pack-gbp-audit
description: Google Business Profile and local pack audit for Schwartz and Associates Fort Collins — NAP consistency, categories, and local visibility.
---

# Local Pack & GBP Audit

## Business entity
- **Name:** Schwartz and Associates, Coldwell Banker Realty (also SAA Homes)
- **Address:** 3665 John F Kennedy Parkway, Suite 210, Fort Collins, CO 80525
- **Phone:** (970) 999-1407
- **Website:** https://saahomes.com
- **GBP URL:** in seoConstants.js googleBusinessProfile field

## Audit checklist

### NAP consistency
Compare NAP across:
- saahomes.com (footer, contact, schema)
- Google Business Profile (if API/access)
- Facebook, Instagram profiles in sameAs
- Flag any mismatch in name, address, phone, URL

### GBP optimization (when accessible)
- [ ] Primary category: Real Estate Agent or Real Estate Agency
- [ ] Secondary categories appropriate
- [ ] Business description includes Northern Colorado + buyer/seller + CHFA expertise
- [ ] Services listed: Buyer representation, Seller representation, Market analysis
- [ ] Photos: team, office, local landmarks (count vs competitors)
- [ ] Review count and avg rating vs local pack competitors
- [ ] Post frequency (last 30 days)
- [ ] Q&A section populated

### Local pack SERP
Search (or SerpAPI): `realtor fort collins`, `real estate agent fort collins co`
- Who appears in map pack top 3?
- Is Schwartz and Associates present?
- If not: diagnose (NAP, categories, reviews, proximity, website authority)

### Website ↔ GBP alignment
- [ ] Link from site to GBP (sameAs / hasMap in schema)
- [ ] Local landing pages support "Fort Collins realtor" query

## Output

```
📍 Local Pack Audit — [date]

NAP status: ✅ consistent / ❌ issues [list]

Map pack presence
- Query "fort collins realtor": [in pack? position?]

GBP optimization score: X/10

Top 5 recommendations
1. ...

Suggested GBP post draft (for Adam approval)
[2-3 sentences, local market angle, CTA to saahomes.com]
```

## Constraints
- Do not post to GBP without Adam `approved` (POST REVIEW workflow)
- Publish via Browserbase browser session — no GBP API required
- Do not solicit fake reviews
