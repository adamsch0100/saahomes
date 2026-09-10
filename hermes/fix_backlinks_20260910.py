#!/usr/bin/env python3
"""
Follow-up fixes for the Sep 10 2026 backlink run:
  1. Publish the two Write.as drafts (they returned 201 with slug=None + token;
     anonymous posts need an explicit publish call).
  2. Add the missing Estes Park anchor to Telegraph post B via editPage.
  3. Retry 2 Archive.org saves that 429'd, with a longer gap.
Verified-only logging as before.
"""
import csv, json, time, urllib.request, urllib.error, re
from datetime import date

LOG_CSV = '/opt/data/workspace/saahomes-repo/hermes/backlinks-log.csv'
UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
TELEGRAPH_TOKEN = "a1058edfc9bc701ba31df73ad2f8c07af8a365054056d8ceafda01748e87"
BASE = "https://saahomes.com"

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

def http_json(url, data, timeout=45):
    req = urllib.request.Request(url, data=json.dumps(data).encode(),
                                 headers={'Content-Type': 'application/json', 'User-Agent': UA}, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, json.loads(r.read().decode('utf-8', 'replace'))
    except urllib.error.HTTPError as e:
        body = e.read().decode('utf-8', 'replace')[:1200] if e.fp else ''
        try:
            return e.code, json.loads(body)
        except Exception:
            return e.code, {'error': body[:400]}
    except Exception as e:
        return None, {'error': str(e)}

def verify_target_path(source_url, target_path):
    code, html = http_get(source_url)
    needle = "saahomes.com" + target_path
    return (code is not None and code == 200 and needle.lower() in html.lower()), code

def p(children): return {"tag": "p", "children": children}
def h3(text): return {"tag": "h3", "children": [text]}
def a(href, anchor_text): return {"tag": "a", "attrs": {"href": href}, "children": [anchor_text]}

print("=" * 66)
print("FOLLOW-UP — publish Write.as drafts, fix Telegraph B, retry Archive.org")
print("=" * 66)

# ══ 1. Publish Write.as drafts ══
print("\nSTEP 1 — Publish Write.as drafts")
writeas_drafts = [
    ("70lhmu13p9fe7", "4r91BBlaCoqmGBxEQdMyOMMyy19P5852"),
    ("9agthg2x2q8fz", "9HhJ3j8Oo73gLwmfZpPXKUgJjI3JflIc"),
]
writeas_targets = [
    [  # draft A: value corridor guide
        ("Fort Lupton CO homes for sale", "/northern-colorado-areas/fort-lupton/", "Fort Lupton CO real estate"),
        ("Brighton CO homes for sale", "/northern-colorado-areas/brighton/", "Brighton CO homes for sale"),
        ("Carbon Valley CO homes for sale", "/northern-colorado-areas/carbon-valley/", "Carbon Valley CO real estate"),
    ],
    [  # draft B: Timnath + Johnstown I-25 guide
        ("Timnath CO homes for sale", "/northern-colorado-areas/timnath/", "Timnath CO real estate"),
        ("Johnstown CO homes for sale", "/northern-colorado-areas/johnstown/", "Johnstown CO real estate"),
    ],
]
for (pid, token), triples in zip(writeas_drafts, writeas_targets):
    code, data = http_json(f"https://write.as/api/posts/{pid}/publish", {"token": token})
    if isinstance(data, dict) and data.get('code') == 200 and isinstance(data.get('data'), dict):
        slug = (data['data'].get('slug') or '').strip()
        if slug:
            url = f"https://write.as/{slug}"
            print(f"  ✅ Published {pid} -> {url}")
            time.sleep(3)
            for anchor, target, kw in triples:
                ok, _ = verify_target_path(url, target)
                log_result("Write.as Blog", url, anchor, target, kw, "built" if ok else "failed_verify")
                time.sleep(0.6)
        else:
            print(f"  ⚠️ {pid} published but slug empty: {str(data)[:200]}")
    else:
        print(f"  ❌ publish {pid} failed: {str(data)[:250]}")
    time.sleep(45)  # avoid write.as rate limit

# ══ 2. Fix Telegraph B — add Estes Park anchor ══
print("\nSTEP 2 — Telegraph B editPage (add Estes Park anchor)")
path_b = "Timnath-Johnstown-Berthoud-Estes-Park-Red-Feather-Lakes-Lyons-Bellvue-Fort-Lupton--Northern-Colorado-Small-Town-Guide-2026-09-10"
content_b = [
    p(["Northern Colorado's small towns and mountain communities are where savvy buyers find character, space, and value — often minutes from the I-25 corridor or the edge of Rocky Mountain National Park."]),
    h3("Estes Park — Gateway to Rocky Mountain National Park"),
    p(["Estes Park pairs cabin and condo living with world-class outdoor recreation at the park's east entrance. Buyers weigh mountain views, short-term rental potential, and a strong tourism economy. Start with ", a(BASE + "/northern-colorado-areas/estes-park/", "Estes Park CO real estate agents"), " who know the full market from lakefront cabins to mountain-view condos."]),
    h3("Timnath & Johnstown — I-25 Growth Corridor"),
    p([a(BASE + "/northern-colorado-areas/timnath/", "Timnath CO homes for sale"), " center on master-planned new construction along the Larimer-Weld line, while ", a(BASE + "/northern-colorado-areas/johnstown/", "Johnstown CO homes for sale"), " blend historic Main Street charm with I-25/US-34 expansion. Both towns draw families who want new builds without metropolitan pricing."]),
    h3("Berthoud — Small-Town I-25 Appeal"),
    p(["Berthoud sits between Loveland and Longmont with historic charm, farm-to-table dining, and new neighborhoods like Berthoud Highlands and Sierra. ", a(BASE + "/northern-colorado-areas/berthoud/", "Berthoud Colorado real estate agents"), " can walk you through the town's range from $450K entry points to estate properties."]),
    h3("Mountain and Foothills — Red Feather Lakes, Lyons, Bellvue"),
    p(["For quieter price points, ", a(BASE + "/northern-colorado-areas/red-feather-lakes/", "Red Feather Lakes cabins for sale"), " offer alpine lake living in northwest Larimer County, while ", a(BASE + "/northern-colorado-areas/lyons/", "Lyons CO homes for sale"), " and ", a(BASE + "/northern-colorado-areas/bellvue/", "Bellvue CO acreage for sale"), " cover Boulder County foothills and Poudre Canyon living."]),
    h3("Fort Lupton — US-85 Value Corridor"),
    p(["Fort Lupton on the US-85 corridor between Denver and Greeley stays one of the region's most affordable single-family markets. ", a(BASE + "/northern-colorado-areas/fort-lupton/", "Fort Lupton CO homes for sale"), " specialists can connect buyers with Weld County programs, including CHFA and targeted-area assistance."]),
    p(["Schwartz and Associates (SAA Homes), Coldwell Banker Realty — serving Northern Colorado since 2001. Call (970) 999-1407 or visit ", a(BASE + "/", "saahomes.com"), " for area guides, market reports, and buyer/seller resources."]),
]
code, data = http_json("https://api.telegra.ph/editPage", {
    "access_token": TELEGRAPH_TOKEN,
    "path": path_b,
    "title": "Timnath, Johnstown, Berthoud, Estes Park, Red Feather Lakes, Lyons, Bellvue, Fort Lupton — Northern Colorado Small-Town Guide 2026",
    "author_name": "Schwartz and Associates",
    "author_url": BASE + "/",
    "content": content_b,
    "return_content": False,
})
if isinstance(data, dict) and data.get('ok') and data.get('result', {}).get('url'):
    url = data['result']['url']
    print(f"  ✅ Telegraph B edited -> {url}")
    time.sleep(4)
    for anchor, target, kw in [
        ("Estes Park CO real estate agents", "/northern-colorado-areas/estes-park/", "Estes Park CO real estate"),
        ("Timnath CO homes for sale", "/northern-colorado-areas/timnath/", "Timnath CO real estate"),
    ]:
        ok, _ = verify_target_path(url, target)
        log_result("Telegraph Blog", url, anchor, target, kw, "built" if ok else "failed_verify")
        time.sleep(0.5)
else:
    print(f"  ❌ editPage failed: {str(data)[:300]}")

# ══ 3. Retry 2 Archive.org saves that 429'd ══
print("\nSTEP 3 — Retry Archive.org saves (longer gap)")
retries = [
    ("/northern-colorado-areas/red-feather-lakes/", "Red Feather Lakes cabins for sale", "Red Feather Lakes CO real estate"),
    ("/northern-colorado-areas/estes-park/", "Estes Park CO real estate agents", "Estes Park CO real estate"),
]
for target_path, anchor, kw in retries:
    save_url = f"https://web.archive.org/save/{BASE}{target_path}"
    req = urllib.request.Request(save_url, headers={
        'User-Agent': UA, 'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    })
    try:
        with urllib.request.urlopen(req, timeout=150) as r:
            final_url = r.geturl()
            m = re.search(r'/web/(\d+)/', final_url)
            snapshot_id = m.group(1) if m else None
            html = r.read().decode('utf-8', 'replace')
            if snapshot_id and ("saahomes.com" + target_path).lower() in html.lower():
                canonical = f"https://web.archive.org/web/{snapshot_id}/{BASE}{target_path}"
                log_result("Archive.org Save", canonical, anchor, target_path, kw, "built")
                print(f"  ✅ archived {target_path}")
            else:
                log_result("Archive.org Save", save_url, anchor, target_path, kw, "verify_fail")
                print(f"  ❌ verify fail {target_path}")
    except urllib.error.HTTPError as e:
        log_result("Archive.org Save", save_url, anchor, target_path, kw, f"http_{e.code}")
        print(f"  ❌ http {e.code} {target_path}")
    except Exception as e:
        log_result("Archive.org Save", save_url, anchor, target_path, kw, f"failed_{str(e)[:60]}")
        print(f"  ❌ {str(e)[:80]} {target_path}")
    time.sleep(90)

print("\nFOLLOW-UP COMPLETE")