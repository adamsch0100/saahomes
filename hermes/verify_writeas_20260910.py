#!/usr/bin/env python3
"""Verify + log the two Write.as posts that were created (live at /{id})."""
import csv, json, time, urllib.request, urllib.error
from datetime import date

LOG_CSV = '/opt/data/workspace/saahomes-repo/hermes/backlinks-log.csv'
UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

def log_result(method, url, anchor, target, keyword, status):
    with open(LOG_CSV, 'a', newline='') as f:
        csv.writer(f).writerow([date.today().isoformat(), method, url, anchor, target, keyword, status])
    print(f"  LOG: {method} | {status} | {anchor} -> {target}")

def http_get(url, timeout=60):
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, r.read().decode('utf-8', 'replace')
    except urllib.error.HTTPError as e:
        return e.code, (e.read().decode('utf-8', 'replace') if e.fp else '')
    except Exception as e:
        return None, str(e)

posts = [
    ("https://write.as/70lhmu13p9fe7", [
        ("Fort Lupton CO homes for sale", "/northern-colorado-areas/fort-lupton/", "Fort Lupton CO real estate"),
        ("Brighton CO homes for sale", "/northern-colorado-areas/brighton/", "Brighton CO homes for sale"),
        ("Carbon Valley CO homes for sale", "/northern-colorado-areas/carbon-valley/", "Carbon Valley CO real estate"),
    ]),
    ("https://write.as/9agthg2x2q8fz", [
        ("Timnath CO homes for sale", "/northern-colorado-areas/timnath/", "Timnath CO real estate"),
        ("Johnstown CO homes for sale", "/northern-colorado-areas/johnstown/", "Johnstown CO real estate"),
    ]),
]
for url, triples in posts:
    code, html = http_get(url)
    print(f"\n{url} -> HTTP {code}")
    for anchor, target, kw in triples:
        needle = "saahomes.com" + target
        ok = (code == 200 and needle.lower() in html.lower())
        log_result("Write.as Blog", url, anchor, target, kw, "built" if ok else "failed_verify")
        time.sleep(0.4)
print("\nDONE")