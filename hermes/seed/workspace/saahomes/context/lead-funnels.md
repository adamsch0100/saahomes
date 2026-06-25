# Lead funnels — SAA Homes

**Mission:** Every Northern Colorado buyer/seller who lands on saahomes.com should have a clear, frictionless path to contact Schwartz and Associates.

See `market-dominance-strategy.md` Pillar 3.

## Funnel map

```
Search (Google organic / local pack / brand)
        ↓
Landing page matched to intent
        ↓
CTA: market report (seller) | contact/search (buyer) | program form (CHFA)
        ↓
POST /api/* → PostgreSQL → email → Follow Up Boss
        ↓
Adam/Mandi — human follow-up (Hermes never impersonates)
```

## P0 conversion paths

| Intent | Entry queries | Landing | Primary CTA | API |
|--------|---------------|---------|-------------|-----|
| Seller | sell home {city}, home value | /for-sellers/ + area | Free market report | /api/market-report |
| Buyer | {city} homes for sale | area + /for-buyers/ | Search + contact | /api/contact |
| CHFA buyer | CHFA assistance CO | /chfa-* | Program form | /api/chfa-* |
| Direct | branded | /contact/ | Contact form | /api/contact |

## Weekly metrics (when GA4 connected)

- Organic sessions to P0 pages
- Form submissions by type
- Landing page conversion rate
- Intent mismatch flags (buyer query → seller-only CTA)

## Hermes automation

- **Daily:** form-pipeline-health cron
- **Weekly:** lead-funnel-audit + conversion-surge
- **Alert immediately:** any API 5xx or contact page down

## Do not

- Store lead PII in agent memory
- Auto-email leads as Adam/Mandi
- Promise commissions, sale prices, or loan approval
