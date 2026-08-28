#!/usr/bin/env python3
"""Hermes — 2026-08-28 backlink build. VERIFIED-ONLY KPI.

Targets Tier S money-page city URLs (NOT homepage) with city-intent anchor text.
Methods: Telegraph, Rentry, Write.as, Paste.rs (free, no-account-needed).
Each link is verified LIVE via curl + grep for the target path before logging
status='built'. Unverified creations are logged 'created_unverified' (NOT built).
"""
import csv
import json
import subprocess
import urllib.request
import urllib.error
from datetime import date

LOG_CSV = '/opt/data/workspace/saahomes-repo/hermes/backlinks-log.csv'
USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
TELEGRAPH_TOKEN = "ea7f7430fe31e7bd9454f6fabc52194a1e946efe4811d60e1051cec8b6cd"

TODAY = date.today().isoformat()

results = []


def log_result(method, url, anchor_text, target_page, keyword, status):
    results.append((method, url, anchor_text, target_page, keyword, status))
    with open(LOG_CSV, 'a', newline='') as f:
        w = csv.writer(f)
        w.writerow([TODAY, method, url, anchor_text, target_page, keyword, status])
    print(f"  [LOGGED] {method} -> {status}: {url}")


def curl_grep(url, needle):
    """Verify a URL is live AND contains the target path (deep link)."""
    try:
        out = subprocess.run(
            ['curl', '-sS', '-L', '--max-time', '30', '-A', USER_AGENT, url],
            capture_output=True, text=True, timeout=45
        )
        html = out.stdout
        if not html:
            return False, 'empty_body'
        if needle in html:
            return True, 'verified'
        return False, 'needle_missing'
    except Exception as e:
        return False, f'curl_error:{type(e).__name__}'


def http_post_json(api_url, data, headers=None):
    headers = dict(headers or {})
    headers.setdefault('Content-Type', 'application/json')
    headers.setdefault('User-Agent', USER_AGENT)
    req = urllib.request.Request(api_url, data=json.dumps(data).encode(), headers=headers, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        body = e.read().decode()[:200] if e.fp else ''
        print(f"  HTTP {e.code}: {body[:150]}")
        return None
    except Exception as e:
        print(f"  Error: {e}")
        return None


def a(href, text):
    return {"tag": "a", "attrs": {"href": href}, "children": [text]}


def p(*children):
    return {"tag": "p", "children": list(children)}


def h3(text):
    return {"tag": "h3", "children": [text]}


# ============================================================
# METHOD 1: Telegraph (highest reliability, external domain)
# ============================================================
telegraph_posts = [
    {
        "title": "How to Choose a Fort Collins Real Estate Agent: 7 Questions to Ask (2026)",
        "target": "/northern-colorado-areas/fort-collins/",
        "anchor": "Fort Collins real estate agents",
        "keyword": "Fort Collins real estate agents",
        "content": [
            p("Choosing the right agent shapes everything about your home search in Fort Collins — from which neighborhoods you see first to how your offer is positioned in a competitive market."),
            h3("Questions to ask before you sign"),
            {"tag": "ul", "children": [
                "How many Fort Collins closings did you complete last year?",
                "Which neighborhoods do you actually specialize in?",
                "How do you handle multiple-offer situations?",
                "Do you work with first-time buyers and CHFA programs?",
                "What's your communication style and response time?",
                "Can you connect me with local lenders, inspectors, and title contacts?",
                "What's your strategy when a home appraises under contract price?",
            ]},
            h3("Why local experience matters"),
            p("Fort Collins spans Old Town condos, Midtown, and newer southeast communities. An agent who only knows one pocket of town can cost you weeks and misread values across CSU, Harmony Corridor, and Horsetooth-area micro-markets."),
            p("SAA Homes' team lives and works in Northern Colorado. If you're ready to compare agents or just talk neighborhoods, start with our ",
              a("https://saahomes.com/northern-colorado-areas/fort-collins/", "Fort Collins real estate agents"),
              " guide, then reach us at (970) 999-1407."),
        ],
    },
    {
        "title": "Loveland CO Real Estate: A Homebuyer's Guide to the Sweetheart City (2026)",
        "target": "/northern-colorado-areas/loveland/",
        "anchor": "Loveland CO real estate",
        "keyword": "Loveland CO real estate",
        "content": [
            p("Loveland offers a blend of arts-district charm, strong schools, and easy access to both Fort Collins and Denver that keeps buyers coming back year after year."),
            h3("What defines the Loveland market"),
            p("From historic downtown near the Foundry to the Centerra corridor and newer northwest subdivisions, Loveland gives buyers distinct choices at different price points. Commuters value the quick I-25 and US-34 access."),
            h3("Neighborhoods buyers ask about most"),
            {"tag": "ul", "children": [
                "Downtown / Old Town Loveland — walkable, arts-focused",
                "Centerra / I-25 corridor — retail, newer construction",
                "Northwest Loveland — foothills views and larger lots",
                "Mariana Butte and west-side golf communities",
            ]},
            p("Whether you're buying your first home or upgrading, understanding Loveland's micro-markets is the fastest way to a smart decision. Review our ",
              a("https://saahomes.com/northern-colorado-areas/loveland/", "Loveland CO real estate"),
              " guide for a full neighborhood breakdown — or call (970) 999-1407 to talk through your timeline."),
        ],
    },
    {
        "title": "Windsor CO Homes for Sale: What to Know Before You Buy (2026)",
        "target": "/northern-colorado-areas/windsor/",
        "anchor": "Windsor CO homes for sale",
        "keyword": "Windsor CO homes for sale",
        "content": [
            p("Windsor has grown from a quiet farm town into one of Northern Colorado's most sought-after communities — driven by strong schools, newer housing stock, and lakeside lifestyle amenities."),
            h3("Why buyers choose Windsor"),
            {"tag": "ul", "children": [
                "Weld RE-4 schools with a strong regional reputation",
                "Water Valley, RainDance, and Pelican Lakes communities",
                "New construction alongside established neighborhoods",
                "Quick access to I-25 for Fort Collins and Denver commutes",
            ]},
            h3("Know the neighborhoods before you offer"),
            p("Windsor's neighborhoods vary widely in age, HOA structure, and price. Metro districts can affect your effective cost, so it pays to have someone who can explain the differences line by line."),
            p("Start your search with our ",
              a("https://saahomes.com/northern-colorado-areas/windsor/", "Windsor CO homes for sale"),
              " guide, and contact SAA Homes at (970) 999-1407 for current listings and neighborhood comparisons."),
        ],
    },
    {
        "title": "Selling a Home in Greeley, Colorado: A Weld County Seller's Checklist (2026)",
        "target": "/northern-colorado-areas/greeley/",
        "anchor": "sell your home in Greeley",
        "keyword": "sell my home Greeley CO",
        "content": [
            p("Greeley's seller market rewards preparation. With UNC, a growing employment base, and steady demand across Weld County, the right positioning can shorten your days on market and strengthen your final price."),
            h3("The pre-listing checklist"),
            {"tag": "ul", "children": [
                "Deep clean, declutter, and stage high-traffic rooms",
                "Order a pre-listing inspection to fix issues early",
                "Price against true comparables — not the listing next door",
                "Declutter landscaping and boost curb appeal",
                "Prepare disclosures and gather maintenance records",
            ]},
            h3("Pricing strategy in Weld County"),
            p("Greeley spans established central neighborhoods and newer west-side developments. Buyers compare on price-per-square-foot within their target pocket, so an accurate local comp analysis is essential."),
            p("If you're weighing whether to list, get a no-obligation market read from a ",
              a("https://saahomes.com/northern-colorado-areas/greeley/", "sell your home in Greeley"),
              " resource page — or call SAA Homes at (970) 999-1407 to request a free valuation."),
        ],
    },
    {
        "title": "Timnath CO Homes for Sale: New Construction and Community Guide (2026)",
        "target": "/northern-colorado-areas/timnath/",
        "anchor": "Timnath CO homes for sale",
        "keyword": "Timnath CO homes for sale",
        "content": [
            p("Timnath has emerged as one of the fastest-growing towns in Northern Colorado, pairing small-town governance with easy access to Fort Collins, Windsor, and I-25."),
            h3("What's driving Timnath's growth"),
            {"tag": "ul", "children": [
                "Master-planned communities with new construction",
                "Open space, trail systems, and family-oriented design",
                "Short commutes to Fort Collins employment centers",
                "Poudre School District access for many neighborhoods",
            ]},
            h3("New construction vs. resale"),
            p("Timnath offers both brand-new builds and a growing resale market. Builders' incentives and metro districts mean the true monthly cost isn't always obvious from the list price — a buyer's agent can help you compare apples to apples."),
            p("Explore current ",
              a("https://saahomes.com/northern-colorado-areas/timnath/", "Timnath CO homes for sale"),
              " with SAA Homes, or call (970) 999-1407 to schedule a tour of Timnath's communities."),
        ],
    },
    {
        "title": "Johnstown CO Homes for Sale: I-25 Corridor Growth Guide (2026)",
        "target": "/northern-colorado-areas/johnstown/",
        "anchor": "Johnstown CO homes for sale",
        "keyword": "Johnstown CO homes for sale",
        "content": [
            p("Johnstown sits at the crossroads of Larimer and Weld counties, offering commuters a strategic midpoint between Fort Collins, Loveland, and Greeley along the I-25 corridor."),
            h3("Why Johnstown keeps growing"),
            {"tag": "ul", "children": [
                "Thompson River Ranch and newer master-planned communities",
                "Strong I-25 access for regional commuters",
                "A blend of new construction and established homes",
                "Lower density and open-space feel vs. larger cities",
            ]},
            h3("Two counties, one home search"),
            p("Because Johnstown spans two counties, school districts and tax rates can vary from street to street. Buyers should confirm both before writing an offer — a detail that routinely trips up out-of-town agents."),
            p("See what's available with our ",
              a("https://saahomes.com/northern-colorado-areas/johnstown/", "Johnstown CO homes for sale"),
              " guide, or call SAA Homes at (970) 999-1407 for a tailored search."),
        ],
    },
    {
        "title": "Berthoud Colorado Real Estate: Small-Town Living on the I-25 Corridor (2026)",
        "target": "/northern-colorado-areas/berthoud/",
        "anchor": "Berthoud Colorado real estate",
        "keyword": "Berthoud Colorado real estate agents",
        "content": [
            p("Berthoud keeps its small-town character while sitting minutes from Loveland, Longmont, and the I-25 corridor — a combination that continues to attract buyers looking for space without isolation."),
            h3("The Berthoud appeal"),
            {"tag": "ul", "children": [
                "Tree-lined historic downtown and community events",
                "Thompson School District access",
                "Larger lots and open-space adjacency",
                "Easy commutes to Loveland and Longmont employment",
            ]},
            h3("A market of limited inventory"),
            p("Berthoud's smaller housing stock means well-priced homes move quickly and buyers benefit from acting fast with a pre-approval in hand."),
            p("For a current look at ",
              a("https://saahomes.com/northern-colorado-areas/berthoud/", "Berthoud Colorado real estate"),
              ", visit our Berthoud guide or call SAA Homes at (970) 999-1407."),
        ],
    },
    {
        "title": "Erie CO Homes for Sale: A Guide to Boulder County's Fast-Growing Front-Range Town (2026)",
        "target": "/northern-colorado-areas/erie/",
        "anchor": "Erie CO homes for sale",
        "keyword": "Erie CO homes for sale",
        "content": [
            p("Erie blends small-town roots with rapid Front-Range growth, appealing to buyers who want newer communities and easy access to Boulder, Longmont, and the Denver metro."),
            h3("What to know about Erie"),
            {"tag": "ul", "children": [
                "Master-planned neighborhoods like Erie Village and Colliers Hill",
                "Boulder Valley and St. Vrain Valley school options",
                "Historic Old Town charm alongside new construction",
                "Positioning between Boulder, Longmont, and I-25",
            ]},
            h3("Navigating a two-county town"),
            p("Erie straddles Boulder and Weld counties, so taxes, metro districts, and school boundaries can shift by neighborhood. Local expertise is the difference between an informed offer and an expensive surprise."),
            p("Browse ",
              a("https://saahomes.com/northern-colorado-areas/erie/", "Erie CO homes for sale"),
              " with SAA Homes, or call (970) 999-1407 to connect with our team."),
        ],
    },
]

# ============================================================
# METHOD 2: Rentry pastebins (corridor towns)
# ============================================================
rentry_posts = [
    {
        "title": "Brighton Colorado Real Estate Agents — North Denver Corridor Guide",
        "target": "/northern-colorado-areas/brighton/",
        "anchor": "Brighton Colorado real estate agents",
        "keyword": "Brighton Colorado real estate",
        "text": """# Brighton Colorado Real Estate — North Denver Corridor

Brighton offers North Denver proximity with a lower entry point than Boulder or central Denver. The I-76/US-85 corridor connects Brighton to downtown Denver, DIA, and the growing Commerce City and Thornton employment base.

## What buyers should know
- Mix of established neighborhoods and new subdivisions
- 27J (School District 27J) serves Brighton and surrounding areas
- Strong value relative to nearby Boulder County markets

## Selling in Brighton
Well-priced homes attract both first-time buyers and Denver commuters seeking space. Accurate comps and professional staging move the needle here.

[Browse Brighton Colorado real estate agents at SAA Homes](https://saahomes.com/northern-colorado-areas/brighton/)

---
SAA Homes | Schwartz and Associates | (970) 999-1407 | [saahomes.com](https://saahomes.com/)
""",
    },
    {
        "title": "Carbon Valley CO Homes for Sale — Firestone, Frederick, Dacono Guide",
        "target": "/northern-colorado-areas/carbon-valley/",
        "anchor": "Carbon Valley CO homes for sale",
        "keyword": "Carbon Valley CO homes for sale",
        "text": """# Carbon Valley CO Homes for Sale — Firestone, Frederick, Dacono

The Carbon Valley (Firestone, Frederick, and Dacono) is one of Weld County's fastest-growing corridors, offering new construction and relative affordability along the I-25 frontage between Longmont and Fort Collins.

## Communities at a glance
- **Firestone** — master-planned neighborhoods, newer schools
- **Frederick** — historic core plus new subdivisions
- **Dacono** — entry-level pricing, quick I-25 access

## Buyer tips
Metro districts are common in new-build areas — confirm the full monthly cost before comparing list prices.

[Explore Carbon Valley CO homes for sale with SAA Homes](https://saahomes.com/northern-colorado-areas/carbon-valley/)

---
SAA Homes | Schwartz and Associates | (970) 999-1407 | [saahomes.com](https://saahomes.com/)
""",
    },
    {
        "title": "Estes Park CO Real Estate — Rocky Mountain National Park Gateway Guide",
        "target": "/northern-colorado-areas/estes-park/",
        "anchor": "Estes Park CO real estate",
        "keyword": "Estes Park CO real estate",
        "text": """# Estes Park CO Real Estate — Rocky Mountain Gateway

Estes Park is defined by Rocky Mountain National Park, drawing buyers seeking cabins, second homes, and primary residences with mountain access.

## What buyers should know
- Seasonal vacation-rental dynamics affect some areas
- Water, septic, and fire-mitigation due diligence is essential
- Elevation and access change property character

## Buying vs. investing
Whether for full-time mountain living or a second home, local expertise on HOA rules, short-term rental ordinances, and mountain utilities is critical.

[Explore Estes Park CO real estate with SAA Homes](https://saahomes.com/northern-colorado-areas/estes-park/)

---
SAA Homes | Schwartz and Associates | (970) 999-1407 | [saahomes.com](https://saahomes.com/)
""",
    },
]

# ============================================================
# METHOD 3: Write.as posts (mountain/foothills corridor)
# ============================================================
writeas_posts = [
    {
        "title": "Red Feather Lakes CO Cabins for Sale — Mountain Retreat Guide (2026)",
        "target": "/northern-colorado-areas/red-feather-lakes/",
        "anchor": "Red Feather Lakes CO cabins for sale",
        "keyword": "Red Feather Lakes CO cabins for sale",
        "body": """# Red Feather Lakes CO Cabins for Sale

Red Feather Lakes offers mountain cabins and retreat properties northwest of Fort Collins, prized for fishing, forest access, and quiet seclusion.

## Buyer considerations
- Well and septic systems need careful inspection
- Fire mitigation and access are key diligence items
- Many properties are seasonal or second-home oriented

[Browse Red Feather Lakes CO cabins for sale at SAA Homes](https://saahomes.com/northern-colorado-areas/red-feather-lakes/)

---
SAA Homes | Schwartz and Associates | (970) 999-1407 | https://saahomes.com/
""",
    },
    {
        "title": "Fort Lupton CO Homes for Sale — Weld County US-85 Corridor (2026)",
        "target": "/northern-colorado-areas/fort-lupton/",
        "anchor": "Fort Lupton CO homes for sale",
        "keyword": "Fort Lupton CO homes for sale",
        "body": """# Fort Lupton CO Homes for Sale

Fort Lupton sits along the US-85 corridor in southern Weld County, offering value-minded buyers access to the greater Denver and Northern Colorado employment markets.

## Why buyers look here
- Lower entry prices than Boulder and Longmont
- Commuter access via US-85 and nearby I-25/I-76
- A growing mix of established and new housing

[Explore Fort Lupton CO homes for sale with SAA Homes](https://saahomes.com/northern-colorado-areas/fort-lupton/)

---
SAA Homes | Schwartz and Associates | (970) 999-1407 | https://saahomes.com/
""",
    },
]

# ============================================================
# METHOD 4: Paste.rs (foothills towns)
# ============================================================
pasters_posts = [
    {
        "title": "Lyons CO Mountain Homes — Boulder Foothills Guide",
        "target": "/northern-colorado-areas/lyons/",
        "anchor": "Lyons CO mountain homes",
        "keyword": "Lyons CO real estate",
        "text": """# Lyons CO Mountain Homes — Boulder Foothills

Lyons pairs Boulder-foothills scenery with an arts-and-outdoors community known for its music scene and trail access.

## Buyer notes
- River, hillside, and wildfire-mitigation factors vary by lot
- Limited inventory keeps the market competitive
- Proximity to Boulder and Longmont adds commuter appeal

[Browse Lyons CO mountain homes at SAA Homes](https://saahomes.com/northern-colorado-areas/lyons/)

---
SAA Homes | Schwartz and Associates | (970) 999-1407 | saahomes.com
""",
    },
    {
        "title": "Bellvue CO Acreage for Sale — Poudre Canyon Guide",
        "target": "/northern-colorado-areas/bellvue/",
        "anchor": "Bellvue CO acreage for sale",
        "keyword": "Bellvue CO acreage for sale",
        "text": """# Bellvue CO Acreage for Sale — Poudre Canyon

Bellvue, at the mouth of the Poudre Canyon northwest of Fort Collins, offers acreage and foothills properties for buyers seeking space and river access.

## Acreage buyer tips
- Verify water rights, septic, and access easements early
- Fire mitigation and insurance are critical for foothills lots
- Survey and well/septic records save time in closing

[Explore Bellvue CO acreage for sale with SAA Homes](https://saahomes.com/northern-colorado-areas/bellvue/)

---
SAA Homes | Schwartz and Associates | (970) 999-1407 | saahomes.com
""",
    },
]


def run_telegraph():
    print("=" * 60)
    print("METHOD 1: Telegraph posts")
    print("=" * 60)
    built = 0
    for i, post in enumerate(telegraph_posts):
        print(f"\n--- Telegraph {i+1}: {post['title'][:60]} ---")
        payload = {
            "access_token": TELEGRAPH_TOKEN,
            "title": post["title"],
            "author_name": "SAA Homes",
            "author_url": "https://saahomes.com/",
            "content": post["content"],
            "return_content": False,
        }
        r = http_post_json("https://api.telegra.ph/createPage", payload)
        if r and r.get('ok'):
            url = r['result']['url']
            ok, why = curl_grep(url, post["target"])
            status = 'built' if ok else 'created_unverified'
            if ok:
                built += 1
            print(f"  {'VERIFIED' if ok else 'UNVERIFIED'} ({why}): {url}")
            log_result("Telegraph Blog", url, post["anchor"], post["target"], post["keyword"], status)
        else:
            err = r.get('error', 'no_response') if r else 'no_response'
            print(f"  FAILED: {err}")
            log_result("Telegraph Blog", "telegra.ph", post["anchor"], post["target"], post["keyword"], f"failed_{err}")
    print(f"\nTelegraph verified: {built}/{len(telegraph_posts)}")
    return built


def run_rentry():
    print("\n" + "=" * 60)
    print("METHOD 2: Rentry pastebins")
    print("=" * 60)
    built = 0
    for i, post in enumerate(rentry_posts):
        print(f"\n--- Rentry {i+1}: {post['title'][:60]} ---")
        payload = {"text": post["text"], "edit_code": "", "url": ""}
        r = http_post_json("https://rentry.co/api/new", payload)
        if r and r.get('status') == '200':
            url = r.get('url', '')
            if url and not url.startswith('http'):
                url = 'https://rentry.co/' + url.lstrip('/')
            ok, why = curl_grep(url, post["target"])
            status = 'built' if ok else 'created_unverified'
            if ok:
                built += 1
            print(f"  {'VERIFIED' if ok else 'UNVERIFIED'} ({why}): {url}")
            log_result("Pastebin (Rentry)", url, post["anchor"], post["target"], post["keyword"], status)
        else:
            print(f"  FAILED: {r}")
            log_result("Pastebin (Rentry)", "rentry.co", post["anchor"], post["target"], post["keyword"], "failed_api")
    print(f"\nRentry verified: {built}/{len(rentry_posts)}")
    return built


def run_writeas():
    print("\n" + "=" * 60)
    print("METHOD 3: Write.as posts")
    print("=" * 60)
    built = 0
    for i, post in enumerate(writeas_posts):
        print(f"\n--- Write.as {i+1}: {post['title'][:60]} ---")
        payload = {"title": post["title"], "body": post["body"], "crosspost": ""}
        r = http_post_json("https://write.as/api/posts", payload)
        if r and r.get('data') and r['data'].get('slug'):
            slug = r['data']['slug']
            url = f"https://write.as/{slug}.md"
            ok, why = curl_grep(url, post["target"])
            status = 'built' if ok else 'created_unverified'
            if ok:
                built += 1
            print(f"  {'VERIFIED' if ok else 'UNVERIFIED'} ({why}): {url}")
            log_result("Write.as Blog", url, post["anchor"], post["target"], post["keyword"], status)
        else:
            err = r.get('error_msg', 'no_response') if r else 'no_response'
            print(f"  FAILED: {err}")
            log_result("Write.as Blog", "write.as", post["anchor"], post["target"], post["keyword"], f"failed_{err}")
    print(f"\nWrite.as verified: {built}/{len(writeas_posts)}")
    return built


def run_pasters():
    print("\n" + "=" * 60)
    print("METHOD 4: Paste.rs pastes")
    print("=" * 60)
    built = 0
    for i, post in enumerate(pasters_posts):
        print(f"\n--- Paste.rs {i+1}: {post['title'][:60]} ---")
        req = urllib.request.Request(
            "https://paste.rs/",
            data=post["text"].encode('utf-8'),
            headers={'User-Agent': USER_AGENT, 'Content-Type': 'text/plain'},
            method='POST',
        )
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                url = resp.read().decode().strip()
            ok, why = curl_grep(url, post["target"])
            status = 'built' if ok else 'created_unverified'
            if ok:
                built += 1
            print(f"  {'VERIFIED' if ok else 'UNVERIFIED'} ({why}): {url}")
            log_result("Paste.rs", url, post["anchor"], post["target"], post["keyword"], status)
        except urllib.error.HTTPError as e:
            print(f"  HTTP {e.code}")
            log_result("Paste.rs", "paste.rs", post["anchor"], post["target"], post["keyword"], f"failed_http{e.code}")
        except Exception as e:
            print(f"  Error: {e}")
            log_result("Paste.rs", "paste.rs", post["anchor"], post["target"], post["keyword"], f"failed_error")
    print(f"\nPaste.rs verified: {built}/{len(pasters_posts)}")
    return built


if __name__ == '__main__':
    t_cnt = run_telegraph()
    rentry_cnt = run_rentry()
    was_cnt = run_writeas()
    pst_cnt = run_pasters()
    total = t_cnt + rentry_cnt + was_cnt + pst_cnt
    print("\n" + "=" * 60)
    print(f"TOTAL VERIFIED BUILT: {total}")
    print(f"  Telegraph: {t_cnt}")
    print(f"  Rentry:    {rentry_cnt}")
    print(f"  Write.as:  {was_cnt}")
    print(f"  Paste.rs:  {pst_cnt}")
    print("=" * 60)
