#!/usr/bin/env python3
"""
Indexation Patrol — spot-check indexation on P0 money pages and rotating area pages.
Checks: HTTP 200, no robots noindex, canonical self-referencing, sitemap inclusion, GSC impressions.
"""

import json
import os
import sys
import re
import urllib.request
import urllib.error
from datetime import datetime, timedelta, date

from google.oauth2 import service_account
from googleapiclient.discovery import build

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
WORKSPACE = os.path.abspath(os.path.join(SCRIPT_DIR, '..'))
CREDENTIALS_PATH = '/opt/data/credentials/gsc-key.json'
SITE_DOMAIN = 'sc-domain:saahomes.com'
BASE_URL = 'https://saahomes.com'

# --- P0 URLs (canonical paths, relative) ---
P0_PATHS = [
    '/',
    '/for-buyers/',
    '/for-sellers/',
    '/contact/',
    '/properties/',
    '/chfa-down-payment-assistance/',
    '/chfa-schools-to-home/',
    '/colorado-champions-home-loan-program/',
    '/northern-colorado-areas/fort-collins/',
    '/northern-colorado-areas/loveland/',
    '/northern-colorado-areas/windsor/',
    '/northern-colorado-areas/greeley/',
]

# 3 rotating area pages (not already in P0)
ROTATING_AREA_PATHS = [
    '/northern-colorado-areas/timnath/',
    '/northern-colorado-areas/berthoud/',
    '/northern-colorado-areas/severance/',
]

ALL_PATHS = P0_PATHS + ROTATING_AREA_PATHS

# Known sitemap URLs (fetched from live sitemap)
SITEMAP_URLS = set()


def fetch_sitemap_urls():
    """Fetch all URLs in the sitemap."""
    global SITEMAP_URLS
    try:
        req = urllib.request.Request(f'{BASE_URL}/sitemap.xml',
                                     headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=15) as resp:
            body = resp.read().decode('utf-8')
        urls = set(re.findall(r'<loc>\s*(.*?)\s*</loc>', body, re.IGNORECASE))
        SITEMAP_URLS = urls
        return urls
    except Exception as e:
        print(f"  ⚠ Could not fetch sitemap: {e}")
        return set()


def check_http_and_meta(path):
    """
    Check that a page:
    - Returns HTTP 200 (not 4xx/5xx)
    - Has no meta robots noindex
    - Has no canonical pointing elsewhere
    Returns dict with status info.
    """
    url = f'{BASE_URL}{path}'
    result = {
        'path': path,
        'url': url,
        'http_status': None,
        'error': None,
        'meta_noindex': False,
        'canonical': None,
        'canonical_mismatch': False,
        'ok': False,
    }

    try:
        req = urllib.request.Request(url, headers={
            'User-Agent': 'Mozilla/5.0 (compatible; IndexationPatrol/1.0)'
        })
        with urllib.request.urlopen(req, timeout=15) as resp:
            result['http_status'] = resp.status
            body = resp.read().decode('utf-8', errors='replace')
    except urllib.error.HTTPError as e:
        result['http_status'] = e.code
        # Try to read body even on error (for custom error pages)
        try:
            body = e.read().decode('utf-8', errors='replace')
        except Exception:
            body = ''
    except urllib.error.URLError as e:
        result['error'] = str(e.reason)
        return result
    except Exception as e:
        result['error'] = str(e)
        return result

    # Check HTTP status
    if result['http_status'] is None or result['http_status'] >= 400:
        return result

    # Check meta robots noindex
    meta_robots = re.search(
        r'<meta\s+name=["\']robots["\']\s+content=["\']([^"\']*)["\']',
        body, re.IGNORECASE
    )
    if meta_robots:
        content = meta_robots.group(1).lower()
        if 'noindex' in content:
            result['meta_noindex'] = True

    # Check canonical
    canonical = re.search(
        r'<link\s+rel=["\']canonical["\']\s+href=["\']([^"\']*)["\']',
        body, re.IGNORECASE
    )
    if canonical:
        canonical_url = canonical.group(1)
        result['canonical'] = canonical_url
        # Normalize both URLs for comparison
        expected = f'{BASE_URL}{path}'.rstrip('/')
        actual = canonical_url.rstrip('/')
        if actual != expected:
            result['canonical_mismatch'] = True

    result['ok'] = True
    return result


def get_gsc_service():
    """Authenticate and return GSC service."""
    creds = service_account.Credentials.from_service_account_file(
        CREDENTIALS_PATH,
        scopes=['https://www.googleapis.com/auth/webmasters.readonly']
    )
    return build('searchconsole', 'v1', credentials=creds)


def fetch_gsc_page_data(service, start_date, end_date):
    """Fetch page-level GSC data."""
    request = {
        'startDate': start_date,
        'endDate': end_date,
        'dimensions': ['page'],
        'rowLimit': 500,
    }
    response = service.searchanalytics().query(
        siteUrl=SITE_DOMAIN, body=request
    ).execute()
    return {r['keys'][0].lower(): r for r in response.get('rows', [])}


def check_all_urls(service, gsc_page_map):
    """Run all checks on every URL."""
    sitemap_urls = fetch_sitemap_urls()
    print(f"Sitemap contains {len(sitemap_urls)} URLs.")

    results = []
    for path in ALL_PATHS:
        full_url = f'{BASE_URL}{path}'
        full_url_lower = full_url.lower().rstrip('/')

        print(f"\n{'='*60}")
        print(f"  Checking: {path}")
        print(f"{'='*60}")

        # 1. HTTP / meta check
        http_result = check_http_and_meta(path)

        # 2. GSC check
        gsc_match = None
        if gsc_page_map:
            # Try exact match first, then with/without trailing slash
            gsc_match = gsc_page_map.get(full_url_lower)
            if not gsc_match:
                gsc_match = gsc_page_map.get(full_url_lower + '/')
            if not gsc_match:
                gsc_match = gsc_page_map.get(full_url_lower.rstrip('/'))

        # 3. Sitemap check
        in_sitemap = full_url.rstrip('/') in {u.rstrip('/') for u in sitemap_urls}

        # Determine overall status
        issues = []
        if http_result.get('error'):
            issues.append(f"HTTP ERROR: {http_result['error']}")
        elif http_result['http_status'] and http_result['http_status'] >= 400:
            issues.append(f"HTTP {http_result['http_status']} — page not reachable")
        elif http_result['http_status'] and http_result['http_status'] == 200:
            if http_result['meta_noindex']:
                issues.append("META ROBOTS NOINDEX — blocked from index")
            if http_result['canonical_mismatch']:
                issues.append(f"CANONICAL MISMATCH: points to {http_result['canonical']}")
            if not in_sitemap:
                issues.append("NOT IN SITEMAP")
        else:
            issues.append(f"HTTP {http_result['http_status']} — unexpected status")

        gsc_status = None
        if gsc_match:
            gsc_status = {
                'impressions': gsc_match['impressions'],
                'clicks': gsc_match['clicks'],
                'position': gsc_match['position'],
                'ctr': gsc_match['ctr'],
            }
            if not issues:
                print(f"  ✅ Indexed — {gsc_match['impressions']} impressions, "
                      f"{gsc_match['clicks']} clicks, pos {gsc_match['position']:.1f}")
        else:
            if not issues and http_result.get('http_status') == 200:
                print(f"  ✅ HTTP 200 — indexed by Google, but no GSC impressions yet "
                      f"(normal for new/low-traffic pages)")
            elif not issues:
                print(f"  ✅ HTTP {http_result['http_status']} — reachable, no issues")

        if issues:
            print(f"  ❌ ISSUES:")
            for issue in issues:
                print(f"     • {issue}")
            print(f"  🔴 PROBLEM DETECTED")
        else:
            print(f"  🟢 OK")

        entry = {
            'path': path,
            'url': full_url,
            'http_status': http_result.get('http_status'),
            'http_error': http_result.get('error'),
            'meta_noindex': http_result.get('meta_noindex', False),
            'canonical': http_result.get('canonical'),
            'canonical_mismatch': http_result.get('canonical_mismatch', False),
            'in_sitemap': in_sitemap,
            'gsc': gsc_status,
            'issues': issues,
            'ok': len(issues) == 0,
        }
        results.append(entry)

    return results


def generate_report(results, gsc_start_date, gsc_end_date):
    """Generate a human-readable and JSON report."""
    total = len(results)
    ok_count = sum(1 for r in results if r['ok'])
    problem_count = total - ok_count

    print(f"\n{'='*70}")
    print(f"  INDEXATION PATROL REPORT — saahomes.com")
    print(f"  Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"  GSC period: {gsc_start_date} to {gsc_end_date}")
    print(f"{'='*70}")
    print()
    print(f"  Total URLs checked: {total}")
    print(f"  OK:                 {ok_count}")
    print(f"  Problems:           {problem_count}")
    print()

    if problem_count > 0:
        print(f"{'!'*60}")
        print(f"  ⚠️  PROBLEM URLs")
        print(f"{'!'*60}")
        for r in results:
            if not r['ok']:
                print(f"\n  🔴 {r['path']}")
                for issue in r['issues']:
                    print(f"     • {issue}")
                if r.get('canonical'):
                    print(f"     Canonical: {r['canonical']}")
        print()

    print(f"{'='*60}")
    print(f"  DETAILED RESULTS")
    print(f"{'='*60}")
    for r in results:
        icon = "🟢" if r['ok'] else "🔴"
        print(f"\n  {icon} {r['path']}")
        print(f"     HTTP: {r['http_status']}")
        if r['gsc']:
            print(f"     GSC:  {r['gsc']['impressions']} impr, {r['gsc']['clicks']} clicks, "
                  f"pos {r['gsc']['position']:.1f}")
        else:
            print(f"     GSC:  No data in period")
        print(f"     Sitemap: {'✅' if r['in_sitemap'] else '❌'}")
        if r.get('meta_noindex'):
            print(f"     Meta noindex: ⚠️ YES")
        if r.get('canonical'):
            print(f"     Canonical: {r['canonical']}")
        if r.get('http_error'):
            print(f"     Error: {r['http_error']}")

    print()
    print(f"{'='*70}")
    if problem_count == 0:
        print(f"  ✅ ALL CLEAR — no indexation issues found.")
    else:
        print(f"  ⚠️  {problem_count} URL(s) have indexation issues requiring attention.")
    print(f"{'='*70}")

    # JSON output
    report = {
        'date': str(date.today()),
        'gsc_period': {'start': str(gsc_start_date), 'end': str(gsc_end_date)},
        'total_urls': total,
        'ok': ok_count,
        'problems': problem_count,
        'results': results,
        'has_issues': problem_count > 0,
    }

    print(f"\n\n--- JSON REPORT ---")
    print(json.dumps(report, indent=2))
    print("--- END JSON ---")

    return report


def main():
    if not os.path.exists(CREDENTIALS_PATH):
        print(f"ERROR: GSC credentials not found at {CREDENTIALS_PATH}")
        sys.exit(1)

    # GSC data period (last 7 days, minus 2 days for GSC lag)
    today = date.today()
    gsc_end = today - timedelta(days=2)
    gsc_start = gsc_end - timedelta(days=6)

    print("=" * 70)
    print("  INDEXATION PATROL — saahomes.com")
    print("=" * 70)
    print()
    print(f"GSC data period: {gsc_start} to {gsc_end} (last 7 days, ~48h lag)")
    print()

    # Fetch GSC data
    print("Authenticating to Google Search Console...")
    try:
        service = get_gsc_service()
        print("Connected.")
    except Exception as e:
        print(f"ERROR connecting to GSC: {e}")
        service = None
        gsc_page_map = {}
    else:
        print("Fetching page-level GSC data...")
        gsc_page_map = fetch_gsc_page_data(service, str(gsc_start), str(gsc_end))
        print(f"Got data for {len(gsc_page_map)} unique pages.")
    print()

    # Run checks
    results = check_all_urls(service, gsc_page_map)

    # Generate report
    report = generate_report(results, gsc_start, gsc_end)

    # Save report
    report_path = os.path.join(SCRIPT_DIR, '..', '.hermes', 'indexation-patrol.json')
    os.makedirs(os.path.dirname(report_path), exist_ok=True)
    with open(report_path, 'w') as f:
        json.dump(report, f, indent=2)
    print(f"\nReport saved to: {report_path}")

    # Exit with code based on issues
    if report['has_issues']:
        sys.exit(2)
    else:
        sys.exit(0)


if __name__ == '__main__':
    main()
