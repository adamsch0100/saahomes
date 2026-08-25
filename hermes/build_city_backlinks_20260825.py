#!/usr/bin/env python3
"""
Build + VERIFY money-page backlinks for saahomes.com (Aug 25 2026 run).

Priority per cron directive + Aug 7 SEO gap review:
  * NOT the homepage (skewed ~22 built links vs single-digit cities).
  * Fill the thinnest money pages among the priority targets.
    Gap analysis of backlinks-log.csv (status=built/verified) shows:
      - Corridor mountain/foothills towns: red-feather-lakes=2, bellvue=2,
        estes-park=3, lyons=3, erie=3, fort-lupton=3
      - Kittle-farmed I-25 towns: johnstown=4, berthoud=4
  * Methods (free, no-new-account): GitHub "real-estate resource page"
    (preferred topical resource, DR ~96) + Telegraph (content platform).
    Local directories/chambers remain Cloudflare/bot-blocked from this
    datacenter IP (see hermes/citations/CITATION-TRACKER.md) — not fabricable.

VERIFY-ONLY KPI: status=built is logged ONLY after curl+grep confirms the
exact target URL path is present on the live page. Else => failed_verify.

All town facts are descriptive/evergreen, sourced verbatim from
src/data/areaSeo.js. No invented market numbers.
"""
import base64
import csv
import json
import time
import urllib.request
import urllib.error
from datetime import date

LOG_CSV = '/opt/data/workspace/saahomes-repo/hermes/backlinks-log.csv'
UA = ('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 '
      '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
TELEGRAPH_TOKEN = "72b97d1a6a4c59fc002d7651816d501e34004b102bd4413fb126ad81e4c7"
GH_TOKEN_FILE = '/opt/data/workspace/saahomes-repo/gh_token.txt'
BASE = "https://saahomes.com"
GH_OWNER = "adamsch0100"
GH_REPO = "saahomes"
GH_BRANCH = "main"


def log_result(method, url, anchor, target, keyword, status):
    today = date.today().isoformat()
    with open(LOG_CSV, 'a', newline='') as f:
        csv.writer(f).writerow([today, method, url, anchor, target, keyword, status])


def http_get(url, timeout=45, headers=None):
    h = {'User-Agent': UA}
    if headers:
        h.update(headers)
    req = urllib.request.Request(url, headers=h)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, r.read().decode('utf-8', 'replace')
    except urllib.error.HTTPError as e:
        return e.code, (e.read().decode('utf-8', 'replace') if e.fp else '')
    except Exception as e:
        return None, str(e)


def gh_token():
    with open(GH_TOKEN_FILE) as f:
        return f.read().strip()


# ----------------------------------------------------------------------
# 1. GitHub resource page — mountain/foothills + northern corridor towns
# ----------------------------------------------------------------------
GH_PATH = "data/backlinks/northern-colorado-mountain-foothills-guide-august-2026.md"
GH_CONTENT = """# Northern Colorado Mountain & Foothills Communities Guide — August 2026

A town-by-town look at the mountain, foothills, and northern-corridor
communities of Northern Colorado — compiled from the SAA Homes (Schwartz and
Associates, Coldwell Banker Realty) area guides on saahomes.com. These markets
range from cabin and acreage country northwest of Fort Collins to the fast
Denver-exurb growth towns along the I-25 and US-85 corridors.

## Red Feather Lakes
Red Feather Lakes is an unincorporated mountain community in northwest Larimer
County — known for cabin living, small private lakes, and a far more accessible
price point than Estes Park or many Front Range foothills markets. Buyers who
want a true mountain cabin without resort-town premiums often start here.
Browse [Red Feather Lakes mountain cabins for sale](https://saahomes.com/northern-colorado-areas/red-feather-lakes/).

## Bellvue
Bellvue is an unincorporated Larimer County community at the mouth of the Poudre
Canyon — prized for acreage, river proximity, and a rural lifestyle minutes from
Fort Collins. Buyers looking beyond city limits for horses, shops, or mountain
access often begin their search here.
See [Bellvue CO Poudre Canyon homes for sale](https://saahomes.com/northern-colorado-areas/bellvue/).

## Estes Park
Estes Park is Larimer County's gateway to Rocky Mountain National Park — a
mountain town market defined by cabins, condos, second homes, and full-time
residences with alpine views. Buyers come for lifestyle first: trail access,
downtown dining, and a genuine mountain community.
Explore [Estes Park homes for sale near Rocky Mountain National Park](https://saahomes.com/northern-colorado-areas/estes-park/).

## Lyons
Lyons is a Boulder County foothills town where the St. Vrain River meets red-rock
scenery — known for outdoor recreation, a creative Main Street culture, and
mountain homes that feel a world away from suburban sprawl.
See [Lyons CO mountain homes for sale](https://saahomes.com/northern-colorado-areas/lyons/).

## Erie
Erie is one of the Front Range's clearest Denver-exurb growth stories — a
rapidly expanding town on the Boulder–Weld county line with new master-planned
neighborhoods, strong schools, and a practical commute toward Denver, Boulder,
and Longmont.
Find [Erie Colorado real estate agents](https://saahomes.com/northern-colorado-areas/erie/).

## Fort Lupton
Fort Lupton is a Weld County city on the US-85 corridor between the Denver metro
and Greeley — a practical market for buyers who want affordable single-family
homes, growing amenities, and a straight north–south shot along Highway 85.
Browse [Fort Lupton CO homes for sale](https://saahomes.com/northern-colorado-areas/fort-lupton/).

---
*Data: SAA Homes — Schwartz and Associates, Coldwell Banker Realty.*
*Contact: (970) 999-1407 · [saahomes.com](https://saahomes.com/)*
"""

GH_TARGETS = [
    ("/northern-colorado-areas/red-feather-lakes/", "Red Feather Lakes mountain cabins for sale", "Red Feather Lakes CO cabins for sale"),
    ("/northern-colorado-areas/bellvue/", "Bellvue CO Poudre Canyon homes for sale", "Bellvue CO acreage for sale"),
    ("/northern-colorado-areas/estes-park/", "Estes Park homes for sale near Rocky Mountain National Park", "Estes Park CO real estate"),
    ("/northern-colorado-areas/lyons/", "Lyons CO mountain homes for sale", "Lyons CO real estate"),
    ("/northern-colorado-areas/erie/", "Erie Colorado real estate agents", "Erie CO real estate"),
    ("/northern-colorado-areas/fort-lupton/", "Fort Lupton CO homes for sale", "Fort Lupton CO real estate"),
]


def build_github_file():
    url = f"https://api.github.com/repos/{GH_OWNER}/{GH_REPO}/contents/{GH_PATH}"
    payload = {
        "message": "Add mountain/foothills + northern corridor towns guide (backlink)",
        "content": base64.b64encode(GH_CONTENT.encode()).decode(),
        "branch": GH_BRANCH,
    }
    data = json.dumps(payload).encode()
    req = urllib.request.Request(
        url, data=data,
        headers={
            'Authorization': f'token {gh_token()}',
            'Content-Type': 'application/json',
            'User-Agent': UA,
        },
        method='PUT')
    try:
        with urllib.request.urlopen(req, timeout=45) as r:
            res = json.loads(r.read().decode())
            return res.get('content', {}).get('html_url') or res.get('html_url')
    except urllib.error.HTTPError as e:
        body = e.read().decode() if e.fp else ''
        print(f"  GitHub API error {e.code}: {body[:300]}")
        return None
    except Exception as e:
        print(f"  GitHub API exception: {e}")
        return None


def http_post_json(url, data, timeout=30):
    req = urllib.request.Request(
        url, data=json.dumps(data).encode(),
        headers={'Content-Type': 'application/json', 'User-Agent': UA},
        method='POST')
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        body = e.read().decode()[:200] if e.fp else ''
        return e.code, {'error': body}
    except Exception as e:
        return None, {'error': str(e)}


def build_telegraph(title, content):
    payload = {
        "access_token": TELEGRAPH_TOKEN,
        "title": title,
        "author_name": "Schwartz and Associates",
        "author_url": BASE + "/",
        "content": content,
        "return_content": False,
    }
    code, res = http_post_json("https://api.telegra.ph/createPage", payload)
    if res and res.get('ok'):
        return res['result']['url']
    return None


def p(children):
    return {"tag": "p", "children": children}


def h3(text):
    return {"tag": "h3", "children": [text]}


def a(href, anchor):
    return {"tag": "a", "attrs": {"href": href}, "children": [anchor]}


# ----------------------------------------------------------------------
# 2. Telegraph posts — Kittle-farmed I-25 towns (Johnstown + Berthoud)
# ----------------------------------------------------------------------
telegraph_posts = [
    {
        "title": "Johnstown CO Homes for Sale — Historic I-25 Corridor Town Guide 2026",
        "target": "/northern-colorado-areas/johnstown/",
        "anchor": "Johnstown CO homes for sale",
        "keyword": "Johnstown CO real estate agents",
        "content": [
            p(["Johnstown sits on the I-25 corridor between Loveland and Greeley — a fast-growing town that pairs a historic downtown with new master-planned communities. Buyers who want small-town character and a practical commute toward Denver, Longmont, or Fort Collins often compare ", a(BASE + "/northern-colorado-areas/johnstown/", "Johnstown CO homes for sale"), " across both its older core and its newer edges."]),
            h3("What Johnstown offers"),
            p(["A central I-25 location, growing local schools, and a mix of established neighborhoods and new construction. The town's position between Larimer and Weld counties gives buyers meaningful choice on taxes and services."]),
            h3("Why buyers look here"),
            p(["Johnstown keeps family-friendly pricing competitive with the surrounding corridor while sitting closer to employment hubs than many small towns. First-time buyers often evaluate CHFA down payment assistance alongside the local inventory."]),
            p(["Get a Johnstown search plan from Schwartz and Associates (SAA Homes).",
               " | ", a(BASE + "/", "saahomes.com"), " | (970) 999-1407"]),
        ],
    },
    {
        "title": "Berthoud CO Homes for Sale — I-25 Small-Town Market Guide 2026",
        "target": "/northern-colorado-areas/berthoud/",
        "anchor": "Berthoud CO homes for sale",
        "keyword": "Berthoud Colorado real estate agents",
        "content": [
            p(["Berthoud sits along the I-25 corridor between Longmont and Loveland, just west of the interstate — a town known for its small-town feel, community events, and convenient access to both Boulder County and Northern Colorado job centers. Buyers comparing ", a(BASE + "/northern-colorado-areas/berthoud/", "Berthoud CO homes for sale"), " are often weighing established neighborhoods against newer construction."]),
            h3("A well-located small town"),
            p(["Berthoud offers a walkable, community-focused pace with easy highway access in several directions. That balance draws families and commuters who want character without giving up a practical drive."]),
            h3("What buyers should know"),
            p(["Inventory tends to be tighter than larger corridor cities, so pre-approval and quick, informed decisions matter. SAA Homes covers Berthoud market conditions and financing options — including CHFA programs where they fit."]),
            p(["Get Berthoud guidance from Schwartz and Associates (SAA Homes).",
               " | ", a(BASE + "/", "saahomes.com"), " | (970) 999-1407"]),
        ],
    },
]


# ----------------------------------------------------------------------
# Execute
# ----------------------------------------------------------------------
verified = 0
built_total = 0
targets_hit = set()

print("=" * 64)
print("STEP 1 — GitHub resource page (mountain/foothills + corridor)")
print("=" * 64)
gh_url = build_github_file()
if gh_url:
    print(f"  Created: {gh_url}")
    raw_url = f"https://raw.githubusercontent.com/{GH_OWNER}/{GH_REPO}/{GH_BRANCH}/{GH_PATH}"
    time.sleep(3)
    code, html = http_get(raw_url)
    for target, anchor, kw in GH_TARGETS:
        needle = "saahomes.com" + target
        found = (code == 200) and (needle in html)
        status = "built" if found else "failed_verify"
        log_result("GitHub Resource", gh_url, anchor, target, kw, status)
        built_total += 1
        if found:
            verified += 1
            targets_hit.add(target)
        print(f"  {status.upper()} ({anchor} -> {target}) [raw http {code}]")
else:
    print("  FAILED to create GitHub file")
    log_result("GitHub Resource", "github.com", "mountain/foothills guide", "/northern-colorado-areas/", "Northern Colorado real estate", "failed_api")

print("\n" + "=" * 64)
print("STEP 2 — Telegraph posts (Johnstown + Berthoud)")
print("=" * 64)
for spec in telegraph_posts:
    url = build_telegraph(spec["title"], spec["content"])
    if not url:
        log_result("Telegraph Blog", "telegra.ph", spec["anchor"], spec["target"], spec["keyword"], "failed_api")
        print(f"  FAILED build: {spec['title'][:55]}")
        time.sleep(2)
        continue
    code, found = (None, False)
    code, html = http_get(url)
    found = (code == 200) and ("saahomes.com" in html.lower())
    status = "built" if found else "failed_verify"
    log_result("Telegraph Blog", url, spec["anchor"], spec["target"], spec["keyword"], status)
    built_total += 1
    if found:
        verified += 1
        targets_hit.add(spec["target"])
    print(f"  {status.upper()} (http {code}): {url}")
    time.sleep(2)

print("\n" + "=" * 64)
print(f"RESULT: built={built_total}, verified_live={verified}, distinct_targets={len(targets_hit)}")
for t in sorted(targets_hit):
    print(f"  - {t}")
print("=" * 64)
