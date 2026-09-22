#!/usr/bin/env python3
"""
Build + VERIFY backlinks for saahomes.com (Sep 22 2026 run).

Gap focus (cron directive + Aug 7 SEO gap review): money pages, NOT homepage.
  * Tier S: fort-collins, loveland, windsor, greeley.
  * Kittle-farmed I-25 trio: timnath, johnstown, berthoud.
  * 8 corridor pages: erie, brighton, estes-park, red-feather-lakes,
    fort-lupton, lyons, bellvue, carbon-valley.

New angles this run (distinct from all prior runs):
  * GH Page A — Home values & 2026 market report by city (seller + buyer intent).
  * GH Page B — Best neighborhoods & communities by city (buyer intent).
  * Telegraph 1 — VA loans & veteran homebuying (distinct niche, 0.5% pledge).
  * Telegraph 2 — Renting vs. buying by city (buyer intent).

Methods: GitHub Pages (DOFOLLOW plain <a href>) + Telegraph (nofollow).
VERIFY-ONLY KPI: status=built logged ONLY after HTTP fetch confirms the
exact "saahomes.com{target}" href is present on the live referring page.
"""
import base64, csv, json, time, urllib.request, urllib.error
from datetime import date

LOG_CSV = '/data/workspaces/saa-homes/hermes/backlinks-log.csv'
ENV = '/data/hermes-homes/saa-homes/.env'
UA = ('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 '
      '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
TELEGRAPH_TOKEN = "a1058edfc9bc701ba31df73ad2f8c07af8a365054056d8ceafda01748e87"
BASE = "https://saahomes.com"
REPO = "adamsch0100/northern-colorado-real-estate-areas"
PAGES_URL = "https://adamsch0100.github.io/northern-colorado-real-estate-areas/"


def load_gh_token():
    with open(ENV) as f:
        for line in f:
            line = line.strip()
            if line.startswith('GITHUB_TOKEN='):
                return line.split('=', 1)[1].strip().strip('"').strip("'")


GH = load_gh_token()


def log_result(method, url, anchor, target, keyword, status):
    with open(LOG_CSV, 'a', newline='') as f:
        csv.writer(f).writerow([date.today().isoformat(), method, url,
                                anchor, target, keyword, status])
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


def http_json(url, data=None, timeout=60, method='POST', headers=None):
    h = {'Content-Type': 'application/json', 'User-Agent': UA}
    if headers:
        h.update(headers)
    body = json.dumps(data).encode() if data is not None else None
    req = urllib.request.Request(url, data=body, headers=h, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            txt = r.read().decode('utf-8', 'replace')
            try:
                return r.status, json.loads(txt)
            except Exception:
                return r.status, txt
    except urllib.error.HTTPError as e:
        txt = e.read().decode('utf-8', 'replace') if e.fp else ''
        try:
            return e.code, json.loads(txt)
        except Exception:
            return e.code, txt
    except Exception as e:
        return None, {'error': str(e)}


def verify_target_href(source_url, target_path):
    code, html = http_get(source_url)
    if code != 200:
        return False, code
    needle = "saahomes.com" + target_path
    return needle in html.lower(), code


results = []


def record(method, source_url, anchor, target, keyword, ok, extra=""):
    status = "built" if ok else (extra or "failed_verify")
    log_result(method, source_url, anchor, target, keyword, status)
    results.append((method, source_url, anchor, target, keyword, ok))


def push_gh_page(path, content, msg):
    code, put = http_json(
        f"https://api.github.com/repos/{REPO}/contents/{path}",
        {"message": msg, "content": base64.b64encode(content.encode()).decode(),
         "branch": "main"},
        method='PUT', headers={'Authorization': f'token {GH}'})
    ok = isinstance(put, dict) and put.get('content')
    print(f"  GH push {path}: {'OK sha ' + put['content']['sha'][:7] if ok else str(put)[:200]}")
    return ok


def wait_live(url, tries=12):
    for _ in range(tries):
        c, _ = http_get(url)
        if c == 200:
            return True
        time.sleep(6)
    return False


def p(children): return {"tag": "p", "children": children}
def h3(text): return {"tag": "h3", "children": [text]}
def a(href, anchor_text): return {"tag": "a", "attrs": {"href": href}, "children": [anchor_text]}


def build_telegraph(title, content_list):
    code, data = http_json("https://api.telegra.ph/createPage",
                           {"access_token": TELEGRAPH_TOKEN, "title": title,
                            "author_name": "Schwartz and Associates",
                            "author_url": BASE + "/", "content": content_list,
                            "return_content": False})
    if isinstance(data, dict) and data.get('ok'):
        return data['result']['url']
    print("    telegraph err:", str(data)[:200])
    return None


# ══════════════════════════════════════════════════════════════
# PHASE 1 — GitHub Pages (DOFOLLOW): home values + neighborhoods
# ══════════════════════════════════════════════════════════════
print("=" * 70)
print("PHASE 1 — GitHub Pages (DOFOLLOW) home values + neighborhoods")
print("=" * 70)

gh_pages = [
    ("home-values-market-report.html",
     "/data/workspaces/saa-homes/hermes/ghpages_home_values_market_report.html",
     "Add Northern Colorado home values & market report by city", [
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
    ("neighborhoods-communities-guide.html",
     "/data/workspaces/saa-homes/hermes/ghpages_neighborhoods_communities.html",
     "Add Northern Colorado neighborhoods & communities guide", [
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

for path, fpath, msg, targets in gh_pages:
    with open(fpath) as f:
        content = f.read()
    if push_gh_page(path, content, msg):
        live_url = PAGES_URL + path
        if wait_live(live_url):
            print(f"  live: HTTP 200 {live_url}")
            for anchor, target, kw in targets:
                ok, cc = verify_target_href(live_url, target)
                record("GitHub Pages", live_url, anchor, target, kw, ok,
                       "" if ok else f"failed_verify_http{cc}")
                time.sleep(0.3)
        else:
            print(f"  NEVER WENT LIVE: {live_url}")
    time.sleep(3)

# ══════════════════════════════════════════════════════════════
# PHASE 2 — Telegraph (nofollow): VA loans + rent vs buy
# ══════════════════════════════════════════════════════════════
print("\n" + "=" * 70)
print("PHASE 2 — Telegraph (nofollow) VA loans + rent vs buy")
print("=" * 70)

# Post 1: VA loans & veteran homebuying (distinct niche, 0.5% pledge)
t1 = build_telegraph(
    "VA Loans & Veteran Homebuying in Northern Colorado (2026)",
    [
        p(["VA loans remain one of the most affordable ways for veterans and active-duty service members to buy in Northern Colorado, offering zero-down financing on qualifying purchases. Here is how the program maps to each local market."]),
        h3("Where a VA loan goes furthest"),
        p(["A zero-down VA loan stretches furthest in the region's value markets, so buyers often compare ",
           a(BASE + "/northern-colorado-areas/greeley/", "Greeley CO homes for sale"),
           " and ",
           a(BASE + "/northern-colorado-areas/fort-lupton/", "Fort Lupton CO homes for sale"),
           " against pricier ",
           a(BASE + "/northern-colorado-areas/fort-collins/", "Fort Collins real estate agents"),
           " and ",
           a(BASE + "/northern-colorado-areas/loveland/", "Loveland CO homes for sale"),
           " markets."]),
        h3("Newer communities and corridor towns"),
        p(["Newer build-out often meets VA appraisal standards more easily. Compare ",
           a(BASE + "/northern-colorado-areas/windsor/", "Windsor CO homes for sale"),
           ", ",
           a(BASE + "/northern-colorado-areas/timnath/", "Timnath CO new construction"),
           ", and ",
           a(BASE + "/northern-colorado-areas/carbon-valley/", "Carbon Valley CO new homes"),
           " for newer inventory, plus ",
           a(BASE + "/northern-colorado-areas/johnstown/", "Johnstown CO homes for sale"),
           " and ",
           a(BASE + "/northern-colorado-areas/berthoud/", "Berthoud CO real estate"),
           " along the I-25 corridor."]),
        h3("Mountain and foothills"),
        p(["For veterans seeking acreage or a second foothold, see ",
           a(BASE + "/northern-colorado-areas/red-feather-lakes/", "Red Feather Lakes CO cabins"),
           " and ",
           a(BASE + "/northern-colorado-areas/estes-park/", "Estes Park CO homes for sale"),
           "."]),
        p(["Schwartz and Associates (SAA Homes) is proud to give back 0.5% of the purchase price to veterans at closing (disclosed at closing). Start with ",
           a(BASE + "/for-buyers/", "Northern Colorado buyer resources"),
           ". Call (970) 999-1407 or visit ",
           a(BASE + "/", "saahomes.com"), "."]),
    ])
if t1:
    time.sleep(4)
    for anchor, target, kw in [
        ("Greeley CO homes for sale", "/northern-colorado-areas/greeley/", "Greeley CO homes for sale"),
        ("Fort Lupton CO homes for sale", "/northern-colorado-areas/fort-lupton/", "Fort Lupton CO homes for sale"),
        ("Fort Collins real estate agents", "/northern-colorado-areas/fort-collins/", "Fort Collins real estate agents"),
        ("Loveland CO homes for sale", "/northern-colorado-areas/loveland/", "Loveland CO homes for sale"),
        ("Windsor CO homes for sale", "/northern-colorado-areas/windsor/", "Windsor CO homes for sale"),
        ("Timnath CO new construction", "/northern-colorado-areas/timnath/", "Timnath CO new construction"),
        ("Carbon Valley CO new homes", "/northern-colorado-areas/carbon-valley/", "Carbon Valley CO new homes"),
        ("Johnstown CO homes for sale", "/northern-colorado-areas/johnstown/", "Johnstown CO homes for sale"),
        ("Berthoud CO real estate", "/northern-colorado-areas/berthoud/", "Berthoud CO real estate"),
        ("Red Feather Lakes CO cabins", "/northern-colorado-areas/red-feather-lakes/", "Red Feather Lakes CO cabins"),
        ("Estes Park CO homes for sale", "/northern-colorado-areas/estes-park/", "Estes Park CO homes for sale"),
        ("Northern Colorado buyer resources", "/for-buyers/", "Northern Colorado home buyer resources"),
    ]:
        ok, cc = verify_target_href(t1, target)
        record("Telegraph Blog", t1, anchor, target, kw, ok,
               "" if ok else f"failed_verify_http{cc}")
        time.sleep(0.4)

time.sleep(5)

# Post 2: renting vs buying by city (buyer intent)
t2 = build_telegraph(
    "Renting vs. Buying a Home in Northern Colorado (2026)",
    [
        p(["The rent-versus-buy decision in Northern Colorado changes from one town to the next, because rents and purchase prices do not move in lockstep. Here is how to think about it market by market."]),
        h3("Core markets"),
        p(["In Larimer County core markets the math usually favors buying over a long horizon — compare ",
           a(BASE + "/northern-colorado-areas/fort-collins/", "Fort Collins homes for sale"),
           ", ",
           a(BASE + "/northern-colorado-areas/loveland/", "Loveland CO homes for sale"),
           ", and ",
           a(BASE + "/northern-colorado-areas/windsor/", "Windsor CO real estate"),
           " against current rents."]),
        h3("Value markets"),
        p(["Where entry prices are lower, the gap between a mortgage and rent narrows quickly — see ",
           a(BASE + "/northern-colorado-areas/greeley/", "Greeley CO homes for sale"),
           " and ",
           a(BASE + "/northern-colorado-areas/fort-lupton/", "Fort Lupton CO homes for sale"),
           ", plus ",
           a(BASE + "/northern-colorado-areas/brighton/", "Brighton CO homes for sale"),
           " on the Denver metro edge."]),
        h3("Corridor and foothills"),
        p(["Commuter towns add a rent premium for location — compare ",
           a(BASE + "/northern-colorado-areas/erie/", "Erie CO real estate agents"),
           ", ",
           a(BASE + "/northern-colorado-areas/lyons/", "Lyons CO real estate"),
           ", and ",
           a(BASE + "/northern-colorado-areas/bellvue/", "Bellvue CO acreage"),
           " when weighing the commute."]),
        p(["Run the numbers with a local agent who can compare your target payment to real rents in the same neighborhood. Schwartz and Associates (SAA Homes), Coldwell Banker Realty — start with ",
           a(BASE + "/for-buyers/", "Northern Colorado buyer resources"),
           ". Call (970) 999-1407 or visit ",
           a(BASE + "/", "saahomes.com"), "."]),
    ])
if t2:
    time.sleep(4)
    for anchor, target, kw in [
        ("Fort Collins homes for sale", "/northern-colorado-areas/fort-collins/", "Fort Collins homes for sale"),
        ("Loveland CO homes for sale", "/northern-colorado-areas/loveland/", "Loveland CO homes for sale"),
        ("Windsor CO real estate", "/northern-colorado-areas/windsor/", "Windsor CO real estate"),
        ("Greeley CO homes for sale", "/northern-colorado-areas/greeley/", "Greeley CO homes for sale"),
        ("Fort Lupton CO homes for sale", "/northern-colorado-areas/fort-lupton/", "Fort Lupton CO homes for sale"),
        ("Brighton CO homes for sale", "/northern-colorado-areas/brighton/", "Brighton CO homes for sale"),
        ("Erie CO real estate agents", "/northern-colorado-areas/erie/", "Erie CO real estate agents"),
        ("Lyons CO real estate", "/northern-colorado-areas/lyons/", "Lyons CO real estate"),
        ("Bellvue CO acreage", "/northern-colorado-areas/bellvue/", "Bellvue CO acreage"),
        ("Northern Colorado buyer resources", "/for-buyers/", "Northern Colorado home buyer resources"),
    ]:
        ok, cc = verify_target_href(t2, target)
        record("Telegraph Blog", t2, anchor, target, kw, ok,
               "" if ok else f"failed_verify_http{cc}")
        time.sleep(0.4)

# ══════════════════════════════════════════════════════════════
# REPORT
# ══════════════════════════════════════════════════════════════
print("\n" + "=" * 70)
print("BUILD COMPLETE — Sep 22 2026")
print("=" * 70)
verified = [r for r in results if r[5]]
failed = [r for r in results if not r[5]]
distinct_sources = {}
for m, s, a, t, k, ok in verified:
    distinct_sources.setdefault(s, set()).add(t)
targets_hit = sorted({r[3] for r in verified})
print(f"Links verified (status=built): {len(verified)}")
print(f"Failed:                        {len(failed)}")
print(f"Distinct referring pages:      {len(distinct_sources)}")
print(f"Distinct money targets hit:    {len(targets_hit)}")
print("\nReferring pages (verified):")
for s, tgts in sorted(distinct_sources.items()):
    print(f"  {s}  -> {len(tgts)} targets")
print("\nMoney targets hit:")
for t in targets_hit:
    print(f"  [OK] {t}")
if failed:
    print("\nFailed rows:")
    for m, s, a, t, k, ok in failed:
        print(f"  [X] {m} | {a} -> {t}")
print("=" * 70)
