#!/usr/bin/env python3
"""Broad indexation sweep: all city-level area pages + pillar/top-level pages.

Compensates for absent GSC creds by checking the whole key-URL surface
(HTTP status, meta robots noindex, canonical self-reference, sitemap inclusion).
Cron-safe: pure urllib, no shell pipes.
"""
import json
import re
import sys
import urllib.request
import urllib.error
from datetime import date

BASE = 'https://saahomes.com'
UA = {'User-Agent': 'Mozilla/5.0 (compatible; IndexationSweep/1.0)'}


def get(url, timeout=20):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.status, r.read().decode('utf-8', errors='replace')


def sitemap():
    try:
        _, body = get(f'{BASE}/sitemap.xml')
        return re.findall(r'<loc>\s*(.*?)\s*</loc>', body, re.IGNORECASE)
    except Exception as e:
        print(f'SITEMAP FETCH FAILED: {e}')
        return []


def check(path, sm_norm):
    url = f'{BASE}{path}'
    res = {'path': path, 'url': url, 'issues': []}
    try:
        status, body = get(url)
    except urllib.error.HTTPError as e:
        res['http_status'] = e.code
        res['issues'].append(f'HTTP {e.code}')
        return res
    except Exception as e:
        res['error'] = str(e)
        res['issues'].append(f'FETCH ERROR {e}')
        return res

    res['http_status'] = status
    if status >= 400:
        res['issues'].append(f'HTTP {status}')
        return res

    m = re.search(r'<meta\s+name=["\']robots["\']\s+content=["\']([^"\']*)["\']',
                  body, re.IGNORECASE)
    res['meta_noindex'] = bool(m and 'noindex' in m.group(1).lower())

    c = re.search(r'<link\s+rel=["\']canonical["\']\s+href=["\']([^"\']*)["\']',
                  body, re.IGNORECASE)
    res['canonical'] = c.group(1) if c else None
    if c:
        if c.group(1).rstrip('/') != url.rstrip('/'):
            res['issues'].append(f'CANONICAL -> {c.group(1)}')
    else:
        res['issues'].append('NO CANONICAL')

    res['in_sitemap'] = url.rstrip('/') in sm_norm
    if not res['in_sitemap']:
        res['issues'].append('NOT IN SITEMAP')

    if res['meta_noindex']:
        res['issues'].append('META NOINDEX')

    # thin prerender body check (crawler-visible text)
    m2 = re.search(r'<body[^>]*>(.*?)</body>', body, re.DOTALL | re.IGNORECASE)
    if m2:
        txt = re.sub(r'<script.*?</script>', ' ', m2.group(1), flags=re.DOTALL | re.IGNORECASE)
        txt = re.sub(r'<[^>]+>', ' ', txt)
        txt = re.sub(r'\s+', ' ', txt).strip()
        res['body_chars'] = len(txt)
        if len(txt) < 500:
            res['issues'].append(f'THIN PRERENDER ({len(txt)} chars)')

    res['ok'] = len(res['issues']) == 0
    return res


def main():
    locs = sitemap()
    sm_norm = {u.rstrip('/') for u in locs}
    print(f'Sitemap URLs: {len(locs)}')

    paths = set()
    # all city-level area pages (depth == 3)
    for u in locs:
        p = u.replace(BASE, '')
        if p.startswith('/northern-colorado-areas/'):
            parts = [x for x in p.strip('/').split('/') if x]
            if len(parts) == 2:          # /northern-colorado-areas/{city}/
                paths.add('/' + '/'.join(parts) + '/')
    # top-level pillar pages (depth 1)
    for u in locs:
        p = u.replace(BASE, '')
        parts = [x for x in p.strip('/').split('/') if x]
        if len(parts) == 1:
            paths.add('/' + parts[0] + '/')
    paths.add('/')

    paths = sorted(paths)
    print(f'Checking {len(paths)} key URLs...\n')
    results = []
    for i, p in enumerate(paths, 1):
        r = check(p, sm_norm)
        results.append(r)
        if not r.get('ok'):
            print(f'  [{i}/{len(paths)}] ISSUE {p} -> {"; ".join(r["issues"])}')
        sys.stdout.flush()

    problems = [r for r in results if not r.get('ok')]
    print(f'\nTOTAL {len(results)} | OK {len(results)-len(problems)} | PROBLEMS {len(problems)}')
    body = {
        'date': date.today().isoformat(),
        'gsc': 'UNAVAILABLE - no service account key on host',
        'total_urls': len(results),
        'problems': len(problems),
        'problem_list': problems,
        'results': results,
    }
    with open('.hermes/indexation-sweep.json', 'w') as f:
        json.dump(body, f, indent=2)
    print('Saved: .hermes/indexation-sweep.json')


if __name__ == '__main__':
    main()
