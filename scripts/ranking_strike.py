#!/usr/bin/env python3
"""
Daily Ranking Strike — GSC ranking delta monitor for saahomes.com.
Tier S cities: fort collins, loveland, greeley, windsor, johnstown, berthoud, timnath, 
                wellington, severance, evans, milliken, laporte, ault, frederick,
                firestone, fort lupton, placerville, estero park, broomfield
Checks query categories: "{city} realtor", "{city} homes for sale", "{city} CO real estate", "sell my home {city}"
"""

import json
import os
import sys
from datetime import datetime, timedelta, date
from google.oauth2 import service_account
from googleapiclient.discovery import build

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
WORKSPACE = os.path.abspath(os.path.join(SCRIPT_DIR, '..'))
CREDENTIALS_PATH = '/opt/data/credentials/gsc-key.json'
MEMORY_PATH = os.path.join(SCRIPT_DIR, '..', 'MEMORY.md')

TIER_S_CITIES = [
    "fort collins", "loveland", "greeley", "windsor", "johnstown",
    "berthoud", "timnath", "wellington", "severance", "evans",
    "milliken", "laporte", "ault", "frederick", "firestone",
    "fort lupton", "placerville", "estero park", "broomfield"
]

QUERY_TEMPLATES = [
    "{city} realtor",
    "{city} homes for sale",
    "{city} CO real estate",
    "sell my home {city}",
]

ALERT_THRESHOLD_POSITION_DROP = 8
ALERT_THRESHOLD_IMPRESSIONS = 10

def get_gsc_service():
    """Authenticate and return GSC service using service account."""
    creds = service_account.Credentials.from_service_account_file(
        CREDENTIALS_PATH,
        scopes=['https://www.googleapis.com/auth/webmasters.readonly']
    )
    return build('searchconsole', 'v1', credentials=creds)

def fetch_gsc_data(service, start_date, end_date, row_limit=500):
    """Fetch GSC performance data for sc-domain:saahomes.com."""
    site_url = 'sc-domain:saahomes.com'
    request = {
        'startDate': start_date,
        'endDate': end_date,
        'dimensions': ['query', 'page'],
        'rowLimit': row_limit,
    }
    response = service.searchanalytics().query(siteUrl=site_url, body=request).execute()
    return response.get('rows', [])

def fetch_gsc_query_aggregate(service, start_date, end_date, row_limit=500):
    """Fetch query-level aggregate data (no page dimension)."""
    site_url = 'sc-domain:saahomes.com'
    request = {
        'startDate': start_date,
        'endDate': end_date,
        'dimensions': ['query'],
        'rowLimit': row_limit,
    }
    response = service.searchanalytics().query(siteUrl=site_url, body=request).execute()
    return response.get('rows', [])

def fetch_current_vs_previous(service, days=7):
    """Fetch current period and previous period data."""
    today = date.today()
    current_end = today - timedelta(days=2)  # GSC is ~48h behind
    current_start = current_end - timedelta(days=days - 1)
    previous_end = current_start - timedelta(days=1)
    previous_start = previous_end - timedelta(days=days - 1)
    
    print(f"Current period: {current_start} to {current_end}")
    print(f"Previous period: {previous_start} to {previous_end}")
    print()
    
    current_rows = fetch_gsc_data(service, str(current_start), str(current_end))
    previous_rows = fetch_gsc_data(service, str(previous_start), str(previous_end))
    
    return current_rows, previous_rows, current_start, current_end, previous_start, previous_end

def build_key_map(rows):
    """Build a lookup map from the GSC rows."""
    key_map = {}
    for row in rows:
        query = row['keys'][0].lower()
        page = row['keys'][1].lower()
        key = (query, page)
        key_map[key] = {
            'clicks': row['clicks'],
            'impressions': row['impressions'],
            'position': row['position'],
            'ctr': row['ctr'],
        }
    return key_map

def check_tier_s_queries(current_rows, previous_rows, cities, templates):
    """Check Tier S city queries for regressions."""
    current_map = build_key_map(current_rows)
    previous_map = build_key_map(previous_rows)
    
    alerts = []
    
    # Generate all query variants
    all_queries = set()
    for city in cities:
        for template in templates:
            all_queries.add(template.format(city=city))
    
    # Check each query against the data
    for query in sorted(all_queries):
        ql = query.lower()
        
        # Find matching rows (any page)
        cur_matches = {k: v for k, v in current_map.items() if k[0] == ql}
        prev_matches = {k: v for k, v in previous_map.items() if k[0] == ql}
        
        # Aggregate position and impressions per query
        if cur_matches:
            cur_imp = sum(m['impressions'] for m in cur_matches.values())
            cur_pos = sum(m['impressions'] * m['position'] for m in cur_matches.values()) / max(cur_imp, 1)
        else:
            cur_imp = 0
            cur_pos = None
        
        if prev_matches:
            prev_imp = sum(m['impressions'] for m in prev_matches.values())
            prev_pos = sum(m['impressions'] * m['position'] for m in prev_matches.values()) / max(prev_imp, 1)
        else:
            prev_imp = 0
            prev_pos = None
        
        # Check position drop alert
        if prev_pos is not None and cur_pos is not None:
            drop = prev_pos - cur_pos
            if drop >= ALERT_THRESHOLD_POSITION_DROP and cur_imp >= ALERT_THRESHOLD_IMPRESSIONS:
                alerts.append({
                    'type': 'rank_drop',
                    'query': query,
                    'previous_position': round(prev_pos, 1),
                    'current_position': round(cur_pos, 1),
                    'drop': round(drop, 1),
                    'current_impressions': cur_imp,
                    'previous_impressions': prev_imp,
                })
        
        # Check query going from indexed to not indexed
        if prev_imp > 0 and cur_imp == 0:
            if prev_pos is not None and prev_pos <= 20:  # Was ranking decently
                alerts.append({
                    'type': 'disappeared',
                    'query': query,
                    'previous_position': round(prev_pos, 1),
                    'previous_impressions': prev_imp,
                    'current_impressions': 0,
                })
    
    return alerts

def check_page_drops(current_rows, previous_rows):
    """Check for pages that dropped from indexed to not indexed (P0)."""
    current_pages = set()
    previous_pages = {}
    
    for row in current_rows:
        page = row['keys'][1].lower()
        current_pages.add(page)
    
    for row in previous_rows:
        page = row['keys'][1].lower()
        query = row['keys'][0].lower()
        if page not in previous_pages:
            previous_pages[page] = {
                'impressions': 0,
                'clicks': 0,
                'queries': []
            }
        previous_pages[page]['impressions'] += row['impressions']
        previous_pages[page]['clicks'] += row['clicks']
        previous_pages[page]['queries'].append(query)
    
    # P0: pages in previous period that are gone now
    disappeared_pages = []
    for page, info in previous_pages.items():
        # Focus on money pages (northern-colorado-areas)
        if '/northern-colorado-areas/' in page and info['impressions'] >= 5:
            if page not in current_pages:
                disappeared_pages.append({
                    'page': page,
                    'previous_impressions': info['impressions'],
                    'previous_clicks': info['clicks'],
                    'top_queries': list(set(info['queries']))[:5],
                })
    
    return disappeared_pages

def log_to_memory(alerts, disappeared_pages):
    """Append alerts to MEMORY.md."""
    today = date.today().isoformat()
    entry = f"\n## Daily Ranking Strike — {today}\n\n"
    
    if not alerts and not disappeared_pages:
        entry += "✅ No regressions detected.\n\n"
    else:
        if alerts:
            entry += "### Rank Drop Alerts\n\n"
            entry += "| Query | Previous Pos | Current Pos | Drop | Impressions |\n"
            entry += "|-------|-------------|-------------|------|-------------|\n"
            for a in alerts:
                entry += f"| {a['query']} | {a['previous_position']} | {a['current_position']} | {a['drop']} | {a['current_impressions']} |\n"
            entry += "\n"
        
        if disappeared_pages:
            entry += "### ⚠️ P0 — Pages No Longer Indexed\n\n"
            entry += "| Page | Previous Impressions | Previous Clicks | Top Queries |\n"
            entry += "|------|---------------------|-----------------|-------------|\n"
            for p in disappeared_pages:
                queries_str = ", ".join(p['top_queries'][:3])
                entry += f"| {p['page']} | {p['previous_impressions']} | {p['previous_clicks']} | {queries_str} |\n"
            entry += "\n"
    
    entry += f"*Report generated: {datetime.now().isoformat()}*\n"
    
    # Check if MEMORY.md exists
    if os.path.exists(MEMORY_PATH):
        with open(MEMORY_PATH, 'a') as f:
            f.write(entry)
    else:
        with open(MEMORY_PATH, 'w') as f:
            f.write(f"# MEMORY — saahomes.com GSC Monitor\n\n{entry}")
    
    return entry

def print_summary(current_rows, previous_rows, alerts, disappeared_pages, 
                  current_start, current_end, previous_start, previous_end):
    """Print a human-readable summary."""
    print("=" * 70)
    print(f"  DAILY RANKING STRIKE — saahomes.com")
    print(f"  Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 70)
    print()
    
    print(f"Current period:  {current_start} to {current_end}")
    print(f"Previous period: {previous_start} to {previous_end}")
    print()
    
    print(f"Rows in current period:  {len(current_rows)}")
    print(f"Rows in previous period: {len(previous_rows)}")
    print()
    
    # Compute aggregates
    total_cur_imp = sum(r['impressions'] for r in current_rows)
    total_cur_clicks = sum(r['clicks'] for r in current_rows)
    total_prev_imp = sum(r['impressions'] for r in previous_rows)
    total_prev_clicks = sum(r['clicks'] for r in previous_rows)
    
    print(f"Impressions:     {total_cur_imp:>6} (prev: {total_prev_imp})")
    print(f"Clicks:          {total_cur_clicks:>6} (prev: {total_prev_clicks})")
    print()
    
    if not alerts and not disappeared_pages:
        print("✅ No regressions detected across Tier S queries.")
        print()
    else:
        if alerts:
            print("⚠️  TIER S QUERY ALERTS")
            print("-" * 60)
            for a in alerts:
                print(f"  {a['query']}")
                print(f"    Position: {a['previous_position']} → {a['current_position']} (drop: {a['drop']})")
                print(f"    Impressions: {a['current_impressions']} (prev: {a['previous_impressions']})")
                print()
        
        if disappeared_pages:
            print("🔴 P0 REGRESSIONS — PAGES GONE FROM INDEX")
            print("-" * 60)
            for p in disappeared_pages:
                print(f"  {p['page']}")
                print(f"    Was getting {p['previous_impressions']} impressions, {p['previous_clicks']} clicks")
                print(f"    Top queries: {', '.join(p['top_queries'][:3])}")
                print()
    
    # Show top queries for context
    print("TOP QUERIES BY IMPRESSIONS (current period)")
    print("-" * 60)
    
    # Aggregate by query
    query_agg = {}
    for row in current_rows:
        q = row['keys'][0]
        if q not in query_agg:
            query_agg[q] = {'impressions': 0, 'clicks': 0, 'position_sum': 0, 'count': 0}
        query_agg[q]['impressions'] += row['impressions']
        query_agg[q]['clicks'] += row['clicks']
        query_agg[q]['position_sum'] += row['position'] * row['impressions']
        query_agg[q]['count'] += row['impressions']
    
    sorted_queries = sorted(query_agg.items(), key=lambda x: -x[1]['impressions'])[:20]
    
    print(f"{'Query':<40} {'Impr':>6} {'Clicks':>6} {'Pos':>6}")
    print("-" * 60)
    for q, data in sorted_queries:
        avg_pos = data['position_sum'] / max(data['count'], 1)
        print(f"{q:<40} {data['impressions']:>6} {data['clicks']:>6} {avg_pos:>6.1f}")
    
    print()

def main():
    if not os.path.exists(CREDENTIALS_PATH):
        print(f"ERROR: GSC credentials not found at {CREDENTIALS_PATH}")
        sys.exit(1)
    
    print("Authenticating to GSC...")
    service = get_gsc_service()
    print("Connected.")
    print()
    
    # Fetch 7-day windows (week over week comparison)
    current_rows, previous_rows, current_start, current_end, previous_start, previous_end = \
        fetch_current_vs_previous(service, days=7)
    
    # Check Tier S queries
    alerts = check_tier_s_queries(current_rows, previous_rows, TIER_S_CITIES, QUERY_TEMPLATES)
    
    # Check P0 page drops
    disappeared_pages = check_page_drops(current_rows, previous_rows)
    
    # Print summary
    print_summary(current_rows, previous_rows, alerts, disappeared_pages,
                  current_start, current_end, previous_start, previous_end)
    
    # Log to MEMORY.md
    log_entry = log_to_memory(alerts, disappeared_pages)
    
    # Determine if anything needs attention
    has_issues = bool(alerts) or bool(disappeared_pages)
    
    # JSON output for automation
    report = {
        'date': str(date.today()),
        'current_period': {'start': str(current_start), 'end': str(current_end)},
        'previous_period': {'start': str(previous_start), 'end': str(previous_end)},
        'current_rows': len(current_rows),
        'previous_rows': len(previous_rows),
        'alerts': alerts,
        'p0_regressions': disappeared_pages,
        'has_issues': has_issues,
        'total_current_impressions': sum(r['impressions'] for r in current_rows),
        'total_current_clicks': sum(r['clicks'] for r in current_rows),
        'total_previous_impressions': sum(r['impressions'] for r in previous_rows),
        'total_previous_clicks': sum(r['clicks'] for r in previous_rows),
    }
    
    print("\n--- JSON REPORT ---")
    print(json.dumps(report, indent=2))
    print("--- END JSON ---")
    
    # Store report for downstream
    report_path = os.path.join(SCRIPT_DIR, '..', '.hermes', 'daily-ranking-strike.json')
    os.makedirs(os.path.dirname(report_path), exist_ok=True)
    with open(report_path, 'w') as f:
        json.dump(report, f, indent=2)
    
    print(f"\nReport saved to: {report_path}")
    
    if has_issues:
        sys.exit(2)  # Non-zero but specific exit code for issues found
    else:
        sys.exit(0)

if __name__ == '__main__':
    main()
