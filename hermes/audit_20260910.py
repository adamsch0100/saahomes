#!/usr/bin/env python3
"""
Final audit: re-fetch every row logged as 'built' TODAY and confirm the target
URL is actually present on the stated source page. Prints pass/fail per row.
"""
import csv, urllib.request, urllib.error, sys
from datetime import date

LOG_CSV = '/opt/data/workspace/saahomes-repo/hermes/backlinks-log.csv'
UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
TODAY = date.today().isoformat()

def http_get(url, timeout=90):
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, r.read().decode('utf-8', 'replace')
    except urllib.error.HTTPError as e:
        return e.code, (e.read().decode('utf-8', 'replace') if e.fp else '')
    except Exception as e:
        return None, str(e)

rows = list(csv.reader(open(LOG_CSV)))
hdr = rows[0]
idx = {h: i for i, h in enumerate(hdr)}
built_today = [r for r in rows[1:] if len(r) > idx['status'] and r[idx['date']] == TODAY and r[idx['status']].strip() in ('built', 'verified')]

print(f"Rows with status=built on {TODAY}: {len(built_today)}")
print("-" * 90)
pass_count, fail_count = 0, 0
seen_pages = {}
for r in built_today:
    method = r[idx['method']].strip()
    src = r[idx['url']].strip()
    target = r[idx['target_page']].strip()
    anchor = r[idx['anchor_text']].strip()
    if not src.startswith('http'):
        print(f"  SKIP (no url) {method} | {anchor} -> {target}")
        continue
    # normalize GitHub blob URL to raw for content check (blob page may lazy-load)
    fetch_url = src.replace('https://github.com/', 'https://raw.githubusercontent.com/', 1).replace('/blob/', '/', 1) if 'github.com/' in src and '/blob/' in src else src
    code, html = http_get(fetch_url)
    needle = "saahomes.com" + target
    ok = code == 200 and needle.lower() in html.lower()
    print(f"  {'✅' if ok else '❌'} [{code}] {method:16s} -> {target:55s} ({anchor[:42]})")
    if ok:
        pass_count += 1
    else:
        fail_count += 1
    seen_pages.setdefault(method + '|' + src, 0)
    seen_pages[method + '|' + src] += 1

print("-" * 90)
print(f"VERIFIED: {pass_count} | FAILED: {fail_count}")
print(f"Distinct referring pages today: {len(seen_pages)}")
for k, v in seen_pages.items():
    method, src = k.split('|', 1)
    print(f"  {method:16s} {src}  ({v} anchors)")
sys.exit(1 if fail_count else 0)