#!/usr/bin/env python3
"""Verify + log the 2 GitHub Pages pages that went live after the build window."""
import csv, urllib.request, urllib.error
from datetime import date

LOG_CSV = '/data/workspaces/saa-homes/hermes/backlinks-log.csv'
UA = ('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 '
      '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')

pages = [
    ("https://adamsch0100.github.io/northern-colorado-real-estate-areas/home-values-market-report.html", [
        ("Fort Collins home values", "/northern-colorado-areas/fort-collins/", "Fort Collins home values"),
        ("Loveland CO home values", "/northern-colorado-areas/loveland/", "Loveland CO home values"),
        ("Windsor CO home values", "/northern-colorado-areas/windsor/", "Windsor CO home values"),
        ("Greeley CO home values", "/northern-colorado-areas/greeley/", "Greeley CO home values"),
        ("Fort Lupton CO home values", "/northern-colorado-areas/fort-lupton/", "Fort Lupton CO home values"),
        ("Johnstown CO home values", "/northern-colorado-areas/johnstown/", "Johnstown CO home values"),
        ("Timnath CO home values", "/northern-colorado-areas/timnath/", "Timnath CO home values"),
        ("Erie CO home values", "/northern-colorado-areas/erie/", "Erie CO home values"),
        ("Carbon Valley CO home values", "/northern-colorado-areas/carbon-valley/", "Carbon Valley CO home values"),
        ("Brighton CO home values", "/northern-colorado-areas/brighton/", "Brighton CO home values"),
        ("Berthoud CO home values", "/northern-colorado-areas/berthoud/", "Berthoud CO home values"),
        ("Estes Park CO home values", "/northern-colorado-areas/estes-park/", "Estes Park CO home values"),
        ("Red Feather Lakes CO home values", "/northern-colorado-areas/red-feather-lakes/", "Red Feather Lakes CO home values"),
        ("Lyons CO home values", "/northern-colorado-areas/lyons/", "Lyons CO home values"),
        ("Bellvue CO home values", "/northern-colorado-areas/bellvue/", "Bellvue CO home values"),
        ("free Northern Colorado home value report", "/for-sellers/", "sell my home Northern Colorado"),
        ("the SAA Homes buyer resource hub", "/for-buyers/", "Northern Colorado home buyer resources"),
    ]),
    ("https://adamsch0100.github.io/northern-colorado-real-estate-areas/neighborhoods-communities-guide.html", [
        ("Fort Collins neighborhoods", "/northern-colorado-areas/fort-collins/", "Fort Collins neighborhoods"),
        ("Loveland CO neighborhoods", "/northern-colorado-areas/loveland/", "Loveland CO neighborhoods"),
        ("Windsor CO neighborhoods", "/northern-colorado-areas/windsor/", "Windsor CO neighborhoods"),
        ("Greeley CO neighborhoods", "/northern-colorado-areas/greeley/", "Greeley CO neighborhoods"),
        ("Fort Lupton CO neighborhoods", "/northern-colorado-areas/fort-lupton/", "Fort Lupton CO neighborhoods"),
        ("Johnstown CO neighborhoods", "/northern-colorado-areas/johnstown/", "Johnstown CO neighborhoods"),
        ("Timnath CO neighborhoods", "/northern-colorado-areas/timnath/", "Timnath CO neighborhoods"),
        ("Erie CO neighborhoods", "/northern-colorado-areas/erie/", "Erie CO neighborhoods"),
        ("Carbon Valley CO neighborhoods", "/northern-colorado-areas/carbon-valley/", "Carbon Valley CO neighborhoods"),
        ("Brighton CO neighborhoods", "/northern-colorado-areas/brighton/", "Brighton CO neighborhoods"),
        ("Berthoud CO neighborhoods", "/northern-colorado-areas/berthoud/", "Berthoud CO neighborhoods"),
        ("Estes Park CO neighborhoods", "/northern-colorado-areas/estes-park/", "Estes Park CO neighborhoods"),
        ("Red Feather Lakes CO neighborhoods", "/northern-colorado-areas/red-feather-lakes/", "Red Feather Lakes CO neighborhoods"),
        ("Lyons CO neighborhoods", "/northern-colorado-areas/lyons/", "Lyons CO neighborhoods"),
        ("Bellvue CO neighborhoods", "/northern-colorado-areas/bellvue/", "Bellvue CO neighborhoods"),
        ("the SAA Homes buyer resource hub", "/for-buyers/", "Northern Colorado home buyer resources"),
    ]),
]


def http_get(url):
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.status, r.read().decode('utf-8', 'replace')
    except urllib.error.HTTPError as e:
        return e.code, ''
    except Exception as e:
        return None, str(e)


built = 0
for url, targets in pages:
    code, html = http_get(url)
    if code != 200:
        print(f"  [X] {url} HTTP {code}")
        continue
    hl = html.lower()
    for anchor, target, kw in targets:
        needle = "saahomes.com" + target
        ok = needle in hl
        status = "built" if ok else "failed_verify"
        with open(LOG_CSV, 'a', newline='') as f:
            csv.writer(f).writerow([date.today().isoformat(), "GitHub Pages", url,
                                    anchor, target, kw, status])
        if ok:
            built += 1
            print(f"  [OK] {anchor} -> {target}")
        else:
            print(f"  [X] {anchor} -> {target}  (MISSING)")
print(f"\nVerified+logged on GH Pages: {built}")
