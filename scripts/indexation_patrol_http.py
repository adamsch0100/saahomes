#!/usr/bin/env python3
"""Standalone HTTP indexation check for SAA Homes P0 + rotating area pages.
Replicates indexation_patrol.py's non-Google checks (HTTP status, meta robots,
canonical, sitemap inclusion) since GSC creds are absent on this host.
"""
import json
import re
import urllib.request
import urllib.error
from datetime import datetime, date

BASE_URL = 'https://saahomes.com'

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
ROTATING = [
    '/northern-colorado-areas/timnath/',
    '/northern-colorado-areas/berthoud/',
    '/northern-colorado-areas/severance/',
]
ALL = P0_PATHS + ROTATING


def fetch_sitemap():
    try:
        req = urllib.request.Request(f'{BASE_URL}/sitemap.xml',
                                     headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=20) as r:
            body = r.read().decode('utf-8', errors='replace')
        return set(re.findall(r'<loc>\s*(.*?)\s*</loc>', body, re.IGNORECASE))
    except Exception as e:
        return set()


def check(path, sitemap_norm):
    url = f'{BASE_URL}{path}'
    res = {'path': path, 'url': url}
    try:
        req = urllib.request.Request(url, headers={
            'User-Agent': 'Mozilla/5.0 (compatible; IndexationPatrol/1.0)'})
        with urllib.request.urlopen(req, timeout=20) as r:
            res['http_status'] = r.status
            body = r.read().decode('utf-8', errors='replace')
    except urllib.error.HTTPError as e:
        res['http_status'] = e.code
        res['http_error'] = str(e.code)
        return res
    except Exception as e:
        res['error'] = str(e)
        return res

    if res['http_status'] >= 400:
        return res

    m = re.search(r'<meta\s+name=["\']robots["\']\s+content=["\']([^"\']*)["\']',
                  body, re.IGNORECASE)
    res['meta_noindex'] = bool(m and 'noindex' in m.group(1).lower())

    c = re.search(r'<link\s+rel=["\']canonical["\']\s+href=["\']([^"\']*)["\']',
                  body, re.IGNORECASE)
    res['canonical'] = c.group(1) if c else None
    expected = url.rstrip('/')
    res['canonical_mismatch'] = bool(c and c.group(1).rstrip('/') != expected)
    res['in_sitemap'] = url.rstrip('/') in sitemap_norm

    res['issues'] = []
    if res['meta_noindex']:
        res['issues'].append('META ROBOTS NOINDEX')
    if res.get('canonical_mismatch'):
        res['issues'].append(f"CANONICAL MISMATCH -> {res['canonical']}")
    if not res['in_sitemap']:
        res['issues'].append('NOT IN SITEMAP')
    res['ok'] = len(res['issues']) == 0
    return res


def main():
    sm = fetch_sitemap()
    sitemap_norm = {u.rstrip('/') for u in sm}
    print(f"Sitemap has {len(sm)} URLs.\n")
    results = []
    for p in ALL:
        r = check(p, sitemap_norm)
        results.append(r)
        status = r.get('http_status')
        flag = 'OK' if r.get('ok') else 'ISSUE'
        print(f"[{flag}] {p} -> HTTP {status}"
              + (f" | {', '.join(r['issues'])}" if r.get('issues') else "")
              + (f" | noindex={r.get('meta_noindex')} canon={r.get('canonical')}" if r.get('canonical') and not r.get('ok') else ""))
    print()
    problems = [r for r in results if not r.get('ok')]
    print(f"TOTAL {len(results)} | OK {len(results)-len(problems)} | PROBLEMS {len(problems)}")
    print(f"Report date: {date.today().isoformat()}")
    out = {
        'date': date.today().isoformat(),
        'gsc': 'UNAVAILABLE - no service account key on host',
        'total_urls': len(results),
        'problems': len(problems),
        'results': results,
    }
    with open('.hermes/indexation-patrol-http.json', 'w') as f:
        json.dump(out, f, indent=2)
    print("\nSaved: .hermes/indexation-patrol-http.json")


if __name__ == '__main__':
    main()