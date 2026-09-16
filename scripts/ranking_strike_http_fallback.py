#!/usr/bin/env python3
"""Full HTTP coverage sweep — P0 proxy for daily ranking strike on hosts without GSC creds.
Checks: all unique area slugs from areaSeo.js + money pages: HTTP 200, no robots/nofollow
meta, canonical self (after redirects — a 301 to a live, sitemapped page is healthy),
sitemap inclusion.
"""
import json, os, re, sys, urllib.request, urllib.error
from datetime import date

BASE = "https://saahomes.com"
# unique slugs pass in as args file? simpler: hardcode unique list derived below
AREA_SLUGS = [
    "fort-collins","loveland","windsor","greeley","timnath","wellington","johnstown",
    "eaton","milliken","la-salle","mead","longmont","boulder","berthoud","firestone",
    "frederick","evans","severance","niwot","erie","brighton","carbon-valley",
    "fort-lupton","estes-park","red-feather-lakes","lyons","bellvue",
]
MONEY_PAGES = [
    "/cash-home-buyers/","/luxury-real-estate/","/assumable-mortgages/","/veterans/",
    "/for-sellers/","/for-buyers/","/homes-for-sale/","/contact/",
]
URLS = [f"{BASE}/northern-colorado-areas/{s}/" for s in AREA_SLUGS] + [f"{BASE}{p}" for p in MONEY_PAGES]

def fetch(url, timeout=20):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (compatible; SAAHomesBot/1.0)"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.status, r.geturl(), r.read().decode("utf-8", "replace")

# sitemap
try:
    _, _, sm = fetch(f"{BASE}/sitemap.xml")
    sitemap_urls = {u.rstrip("/") for u in re.findall(r"<loc>(.*?)</loc>", sm)}
    print(f"sitemap_urls={len(sitemap_urls)}")
except Exception as e:
    sitemap_urls = set()
    print(f"sitemap_error={e}")

results = []
for u in URLS:
    row = {"url": u, "ok": True, "issues": []}
    try:
        status, final_url, html = fetch(u)
        row["http_status"] = status
        if status != 200:
            row["ok"] = False; row["issues"].append(f"HTTP {status}")
        # redirect handling: urllib follows 3xx; compare canonical against FINAL url
        redirected = final_url.rstrip("/") != u.rstrip("/")
        if redirected:
            row["redirects_to"] = final_url.rstrip("/")
        # canonical
        m = re.search(r'<link rel="canonical" href="([^"]+)"', html)
        canon = m.group(1) if m else ""
        row["canonical"] = canon
        ref = final_url.rstrip("/") if redirected else u.rstrip("/")
        if canon and canon.rstrip("/") != ref:
            row["ok"] = False; row["issues"].append(f"canonical mismatch: {canon} (expected {ref})")
        if not canon:
            row["ok"] = False; row["issues"].append("no canonical")
        # noindex
        if re.search(r'<meta name="robots" content="[^"]*noindex', html):
            row["ok"] = False; row["issues"].append("meta noindex")
        # sitemap — a redirect target that IS in the sitemap satisfies the check
        row["in_sitemap"] = ref in sitemap_urls
        if ref not in sitemap_urls:
            row["ok"] = False; row["issues"].append(f"not in sitemap: {ref}")
    except urllib.error.HTTPError as e:
        row["ok"] = False; row["issues"].append(f"HTTPError {e.code}")
        row["http_status"] = e.code
    except Exception as e:
        row["ok"] = False; row["issues"].append(f"exception: {e}")
        row["http_status"] = None
    results.append(row)

problems = [r for r in results if not r["ok"]]
print(f"total_urls={len(results)} problems={len(problems)}")
for r in results:
    mark = "OK " if r["ok"] else "FAIL"
    extra = f" redirects_to={r.get('redirects_to')}" if r.get("redirects_to") else ""
    print(f"{mark} {r['url']} status={r.get('http_status')} in_sitemap={r.get('in_sitemap')}{extra} issues={r.get('issues')}")

out = {
    "date": date.today().isoformat(),
    "gsc": "UNAVAILABLE - no service account key on host",
    "check": "full-http-coverage",
    "total_urls": len(results),
    "problems": len(problems),
    "results": results,
}
with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".hermes", "ranking-strike-http-coverage.json"), "w") as f:
    json.dump(out, f, indent=2)
print("WROTE .hermes/ranking-strike-http-coverage.json")