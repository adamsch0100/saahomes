#!/usr/bin/env python3
"""Rentry retry (form-encoded) — corridor towns. Verified-only KPI."""
import csv
import subprocess
import urllib.parse
import urllib.request
import urllib.error
from datetime import date

LOG_CSV = '/opt/data/workspace/saahomes-repo/hermes/backlinks-log.csv'
UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
TODAY = date.today().isoformat()

posts = [
    {
        "anchor": "Brighton Colorado real estate agents",
        "target": "/northern-colorado-areas/brighton/",
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
        "anchor": "Carbon Valley CO homes for sale",
        "target": "/northern-colorado-areas/carbon-valley/",
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
        "anchor": "Estes Park CO real estate",
        "target": "/northern-colorado-areas/estes-park/",
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
    {
        "anchor": "Red Feather Lakes CO cabins for sale",
        "target": "/northern-colorado-areas/red-feather-lakes/",
        "keyword": "Red Feather Lakes CO cabins for sale",
        "text": """# Red Feather Lakes CO Cabins for Sale

Red Feather Lakes offers mountain cabins and retreat properties northwest of Fort Collins, prized for fishing, forest access, and quiet seclusion.

## Buyer considerations
- Well and septic systems need careful inspection
- Fire mitigation and access are key diligence items
- Many properties are seasonal or second-home oriented

[Browse Red Feather Lakes CO cabins for sale at SAA Homes](https://saahomes.com/northern-colorado-areas/red-feather-lakes/)

---
SAA Homes | Schwartz and Associates | (970) 999-1407 | [saahomes.com](https://saahomes.com/)
""",
    },
    {
        "anchor": "Fort Lupton CO homes for sale",
        "target": "/northern-colorado-areas/fort-lupton/",
        "keyword": "Fort Lupton CO homes for sale",
        "text": """# Fort Lupton CO Homes for Sale

Fort Lupton sits along the US-85 corridor in southern Weld County, offering value-minded buyers access to the greater Denver and Northern Colorado employment markets.

## Why buyers look here
- Lower entry prices than Boulder and Longmont
- Commuter access via US-85 and nearby I-25/I-76
- A growing mix of established and new housing

[Explore Fort Lupton CO homes for sale with SAA Homes](https://saahomes.com/northern-colorado-areas/fort-lupton/)

---
SAA Homes | Schwartz and Associates | (970) 999-1407 | [saahomes.com](https://saahomes.com/)
""",
    },
]


def curl_grep(url, needle):
    try:
        out = subprocess.run(['curl', '-sS', '-L', '--max-time', '30', '-A', UA, url],
                             capture_output=True, text=True, timeout=45)
        if not out.stdout:
            return False, 'empty_body'
        return (needle in out.stdout), ('verified' if needle in out.stdout else 'needle_missing')
    except Exception as e:
        return False, f'curl_error:{type(e).__name__}'


def rentry_post(text):
    data = urllib.parse.urlencode({'text': text, 'edit_code': ''}).encode()
    req = urllib.request.Request('https://rentry.co/api/new', data=data,
                                 headers={'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded'})
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            import json
            return json.loads(resp.read().decode())
    except Exception as e:
        print(f"  Error: {e}")
        return None


built = 0
for i, post in enumerate(posts):
    print(f"\n--- Rentry {i+1}: {post['anchor']} ---")
    r = rentry_post(post['text'])
    if r and r.get('status') == '200' and r.get('url'):
        url = r['url']
        ok, why = curl_grep(url, post['target'])
        status = 'built' if ok else 'created_unverified'
        if ok:
            built += 1
        print(f"  {'VERIFIED' if ok else 'UNVERIFIED'} ({why}): {url}")
        with open(LOG_CSV, 'a', newline='') as f:
            csv.writer(f).writerow([TODAY, 'Pastebin (Rentry)', url, post['anchor'], post['target'], post['keyword'], status])
    else:
        print(f"  FAILED: {r}")
        with open(LOG_CSV, 'a', newline='') as f:
            csv.writer(f).writerow([TODAY, 'Pastebin (Rentry)', 'rentry.co', post['anchor'], post['target'], post['keyword'], 'failed_api'])

print(f"\nRentry retry verified built: {built}/{len(posts)}")
