#!/usr/bin/env python3
"""Quarterly GSC data extraction for market-dominance-review."""
from google.oauth2 import service_account
from googleapiclient.discovery import build

creds = service_account.Credentials.from_service_account_file(
    '/opt/data/credentials/gsc-key.json',
    scopes=['https://www.googleapis.com/auth/webmasters.readonly']
)
service = build('searchconsole', 'v1', credentials=creds)

SITE_URL = 'sc-domain:saahomes.com'

# Quarterly data: Apr 1 - Jun 30, 2026
body_q = {'startDate': '2026-04-01', 'endDate': '2026-06-30', 'dimensions': ['query', 'page'], 'rowLimit': 5000}
rq = service.searchanalytics().query(siteUrl=SITE_URL, body=body_q).execute()
rows_q = rq.get('rows', [])
total_q_imp = sum(r['impressions'] for r in rows_q)
total_q_clk = sum(r['clicks'] for r in rows_q)

print(f"=== Q2 2026 (Apr 1 - Jun 30) Summary ===")
print(f"Total Impressions: {total_q_imp:,}")
print(f"Total Clicks: {total_q_clk:,}")
print(f"Total Unique Query-Page Pairs: {len(rows_q)}")

# Branded vs non-branded
branded = ['schwartz', 'saa', 'saahomes', 'hermes', 'adam']
branded_rows = [r for r in rows_q if any(b in r['keys'][0].lower() for b in branded)]
nonbranded_rows = [r for r in rows_q if not any(b in r['keys'][0].lower() for b in branded)]
print(f"\nBranded queries: {sum(r['impressions'] for r in branded_rows)} imp, {sum(r['clicks'] for r in branded_rows)} clk")
print(f"Non-branded queries: {sum(r['impressions'] for r in nonbranded_rows)} imp, {sum(r['clicks'] for r in nonbranded_rows)} clk")

# Top 25 non-branded queries
nonbranded_rows.sort(key=lambda x: -x['impressions'])
print(f"\nTop 25 non-branded queries (Q2):")
print(f"{'Query':<55} {'Imp':>6} {'Clk':>4} {'Pos':>5} {'Page':<45}")
print("-"*120)
for r in nonbranded_rows[:25]:
    q = r['keys'][0][:54]
    imp = r['impressions']
    clk = r['clicks']
    pos = round(r['position'], 1)
    page = r['keys'][1][:44] if len(r['keys']) > 1 else ''
    print(f"{q:<55} {imp:>6} {clk:>4} {pos:>5} {page:<45}")

# Tier S queries
tier_s_cities = ['fort collins', 'loveland', 'windsor', 'greeley', 'timnath', 'wellington', 
                 'johnstown', 'eaton', 'milliken', 'la salle', 'mead', 'longmont', 
                 'boulder', 'berthoud', 'firestone', 'frederick', 'evans', 'severance', 'niwot']
tier_s_patterns = ['realtor', 'real estate agent', 'homes for sale', 'sell my home', 'co real estate']

print(f"\n\n=== Tier S Query Performance ===")
city_hits = {}
for r in rows_q:
    q = r['keys'][0].lower()
    for city in tier_s_cities:
        if city in q:
            for pat in tier_s_patterns:
                if pat in q:
                    key = f"{city} - {q}"
                    city_hits[key] = r
                    break

if city_hits:
    print(f"{'City-Query':<40} {'Imp':>5} {'Clk':>3} {'Pos':>5}")
    print("-"*60)
    for k, r in sorted(city_hits.items()):
        print(f"{k[:39]:<40} {r['impressions']:>5} {r['clicks']:>3} {round(r['position'],1):>5}")
else:
    print("NO Tier S queries found with impressions in Q2")

# Pages with clicks
print(f"\n\n=== Pages Receiving Clicks (all queries, Q2) ===")
pages_with_clicks = {}
for r in rows_q:
    if r['clicks'] > 0:
        page = r['keys'][1]
        pages_with_clicks[page] = pages_with_clicks.get(page, 0) + r['clicks']

for page, clk in sorted(pages_with_clicks.items(), key=lambda x: -x[1]):
    print(f"  {page:<70} clk={clk}")

# Monthly breakdown
print(f"\n\n=== Monthly Trend ===")
for month_name, sd, ed in [("April", "2026-04-01", "2026-04-30"), 
                            ("May", "2026-05-01", "2026-05-31"), 
                            ("June", "2026-06-01", "2026-06-30")]:
    bm = {'startDate': sd, 'endDate': ed, 'dimensions': ['query'], 'rowLimit': 5000}
    rm = service.searchanalytics().query(siteUrl=SITE_URL, body=bm).execute()
    rows_m = rm.get('rows', [])
    imp = sum(r['impressions'] for r in rows_m)
    clk = sum(r['clicks'] for r in rows_m)
    print(f"  {month_name}: {imp:>6,} imp, {clk:>3} clk")

# 90-day trailing
body90 = {'startDate': '2026-04-02', 'endDate': '2026-06-30', 'dimensions': ['query'], 'rowLimit': 5000}
r90 = service.searchanalytics().query(siteUrl=SITE_URL, body=body90).execute()
rows90 = r90.get('rows', [])
print(f"\n  Trailing 90 days: {sum(r['impressions'] for r in rows90):>6,} imp, {sum(r['clicks'] for r in rows90):>3} clk")

# Program pages (CHFA) performance
print(f"\n\n=== CHFA Program Page Performance ===")
for r in sorted(rows_q, key=lambda x: -x['impressions']):
    page = r['keys'][1].lower() if len(r['keys']) > 1 else ''
    if 'chfa' in page or 'champions' in page:
        print(f"  {r['keys'][0][:35]:<35} imp={r['impressions']:>4} clk={r['clicks']:>2} pos={round(r['position'],1):>5} page={page[:50]}")

print(f"\n\n=== Area Page Performance ===")
for r in sorted(rows_q, key=lambda x: -x['impressions']):
    page = r['keys'][1].lower() if len(r['keys']) > 1 else ''
    if 'northern-colorado-areas' in page:
        print(f"  {r['keys'][0][:35]:<35} imp={r['impressions']:>4} clk={r['clicks']:>2} pos={round(r['position'],1):>5} page={page[:50]}")
