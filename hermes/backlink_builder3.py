#!/usr/bin/env python3
"""Build 5-10 fresh backlinks for saahomes.com - Round 3 with new topics."""
import json
import urllib.request
import urllib.error
import csv
from datetime import date

LOG_CSV = '/opt/data/workspace/saahomes-repo/hermes/backlinks-log.csv'
USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
TELEGRAPH_TOKEN = "ea7f7430fe31e7bd9454f6fabc52194a1e946efe4811d60e1051cec8b6cd"

def log_result(method, url, anchor_text, target_page, keyword, status):
    today = date.today().isoformat()
    row = [today, method, url, anchor_text, target_page, keyword, status]
    with open(LOG_CSV, 'a', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(row)
    print(f"  [LOGGED] {method}: {status}")

def http_post_json(api_url, data, headers=None):
    if headers is None:
        headers = {}
    headers.setdefault('Content-Type', 'application/json')
    headers.setdefault('User-Agent', USER_AGENT)
    req = urllib.request.Request(api_url, data=json.dumps(data).encode(), headers=headers, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        body = e.read().decode()[:300] if e.fp else ''
        print(f"  HTTP {e.code}: {body[:200]}")
        return None
    except Exception as e:
        print(f"  Error: {e}")
        return None

def http_get_json(url):
    req = urllib.request.Request(url, headers={'User-Agent': USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode())
    except Exception as e:
        print(f"  GET Error: {e}")
        return None

# ============================================================
# METHOD 1: Telegraph Posts (reliable, high DA)
# ============================================================
print("=" * 60)
print("METHOD 1: Telegraph Posts (5 fresh topics)")
print("=" * 60)

telegraph_posts = [
    {
        "title": "Cost of Living Comparison — Northern Colorado Cities 2026",
        "target": "/northern-colorado-areas/",
        "keyword": "cost of living Northern Colorado cities comparison 2026",
        "content": [
            {"tag": "p", "children": ["Northern Colorado offers diverse communities at different price points. SAA Homes breaks down cost of living across Fort Collins, Loveland, Windsor, Greeley, and surrounding towns for 2026."]},
            {"tag": "h3", "children": ["Housing Costs by City"]},
            {"tag": "p", "children": ["Fort Collins: median home ~$612K, rent ~$1,900/mo for 2BR. Loveland: median ~$530K, rent ~$1,700/mo. Windsor: median ~$585K, rent ~$1,800/mo. Greeley: median ~$420K, rent ~$1,400/mo — the most affordable option."]},
            {"tag": "h3", "children": ["Small Towns: Best Value"]},
            {"tag": "p", "children": ["Eaton, La Salle, Milliken, and Johnstown offer median homes in the $400K-$480K range with easy commutes to Fort Collins and Greeley. Severance and Timnath provide newer construction at mid-range prices."]},
            {"tag": "h3", "children": ["Property Taxes Comparison"]},
            {"tag": "p", "children": ["Larimer County (Fort Collins, Loveland): ~0.52% effective rate. Weld County (Greeley, Windsor, Eaton): ~0.55%. Colorado's residential assessment rate is 6.95% for 2026, keeping taxes manageable."]},
            {"tag": "h3", "children": ["Utilities, Transportation, Lifestyle"]},
            {"tag": "p", "children": ["Monthly utilities average $180-250 depending on home size. Commute costs vary — Fort Collins to Denver is ~65 miles. Many residents work locally in tech, education, healthcare, and agriculture."]},
            {"tag": "p", "children": [
                {"tag": "a", "attrs": {"href": "https://saahomes.com/northern-colorado-areas/"}, "children": ["Explore All Northern Colorado Area Guides"]},
                " | ",
                {"tag": "a", "attrs": {"href": "https://saahomes.com/"}, "children": ["saahomes.com"]},
                " | (970) 999-1407"]}
        ]
    },
    {
        "title": "Northern Colorado New Construction Communities — 2026 Homebuyer Guide",
        "target": "/for-buyers/",
        "keyword": "Northern Colorado new construction homes 2026",
        "content": [
            {"tag": "p", "children": ["New construction is booming across Northern Colorado. SAA Homes tracks builder communities in Fort Collins, Timnath, Windsor, Johnstown, and beyond to help buyers find the right fit."]},
            {"tag": "h3", "children": ["New Construction Hotspots"]},
            {"tag": "p", "children": ["Timnath: multiple builders with single-family homes from $550K. Windsor: Water Valley and RainDance communities. Johnstown: Thompson River Ranch and new developments along I-25. Wellington: Sage Meadows and The Knolls offering entry-level options."]},
            {"tag": "h3", "children": ["Major Builders in Northern Colorado"]},
            {"tag": "ul", "children": [
                "Richmond American Homes — Fort Collins, Timnath, Windsor",
                "D.R. Horton — Greeley, Johnstown, Wellington",
                "Lennar — Timnath, Windsor, Severance",
                "Toll Brothers — higher-end communities in Fort Collins and Windsor",
                "Dream Finders Homes — expanding in Johnstown and Milliken"
            ]},
            {"tag": "h3", "children": ["New Construction Pros and Cons"]},
            {"tag": "p", "children": ["Pros: modern floor plans, energy efficiency, builder warranties, minimal maintenance. Cons: HOA fees, construction timelines, landscaping costs, potential Mello-Roos/special district taxes."]},
            {"tag": "h3", "children": ["Why Work with a Buyer's Agent for New Construction"]},
            {"tag": "p", "children": ["Builders' sales agents represent the builder. Having your own representation costs nothing extra and provides negotiation leverage, inspections guidance, and contract protection."]},
            {"tag": "p", "children": [
                {"tag": "a", "attrs": {"href": "https://saahomes.com/for-buyers/"}, "children": ["SAA Homes Buyer Resources"]},
                " | ",
                {"tag": "a", "attrs": {"href": "https://saahomes.com/properties/"}, "children": ["Search Listings"]},
                " | (970) 999-1407"]}
        ]
    },
    {
        "title": "VA Home Loan Guide for Northern Colorado Veterans and Military 2026",
        "target": "/for-buyers/",
        "keyword": "VA home loan Northern Colorado 2026 guide",
        "content": [
            {"tag": "p", "children": ["Northern Colorado's military community — including service members at FE Warren AFB, the Cheyenne VA, and area reserve units — can access VA home loans with zero down payment and no PMI. SAA Homes helps veterans navigate VA benefits."]},
            {"tag": "h3", "children": ["VA Loan Benefits"]},
            {"tag": "ul", "children": [
                "Zero down payment required",
                "No private mortgage insurance (PMI)",
                "Competitive interest rates",
                "Limited closing costs",
                "No prepayment penalty",
                "VA streamline refinance (IRRRL) available"
            ]},
            {"tag": "h3", "children": ["Eligibility Requirements"]},
            {"tag": "p", "children": ["Veterans with 90+ days active duty during wartime or 181+ days during peacetime. Active duty with 90+ continuous days. National Guard/Reserves with 6+ years. Surviving spouses of service members. Certificate of Eligibility (COE) required."]},
            {"tag": "h3", "children": ["Northern Colorado VA Loan Limits 2026"]},
            {"tag": "p", "children": ["Larimer and Weld County VA loan limits: $766,550 for zero-down. Above that, a down payment may apply. VA loans can be used for single-family homes, condos, townhomes, and new construction."]},
            {"tag": "h3", "children": ["Combining VA with CHFA"]},
            {"tag": "p", "children": ["Colorado CHFA programs can complement VA loans for qualified borrowers needing closing cost assistance. SAA Homes connects veterans with lenders experienced in combining these benefits."]},
            {"tag": "p", "children": [
                {"tag": "a", "attrs": {"href": "https://saahomes.com/for-buyers/"}, "children": ["VA & First-Time Buyer Resources at SAA Homes"]},
                " | (970) 999-1407"]}
        ]
    },
    {
        "title": "Moving from Denver to Northern Colorado — Complete Relocation Guide 2026",
        "target": "/northern-colorado-areas/",
        "keyword": "moving from Denver to Northern Colorado relocation guide",
        "content": [
            {"tag": "p", "children": ["Denver residents increasingly look north for more space, lower prices, and outdoor access. SAA Homes helps Denver-to-NoCo transplants find their ideal Northern Colorado community."]},
            {"tag": "h3", "children": ["Why Move North?"]},
            {"tag": "ul", "children": [
                "Lower home prices: save $100K-$200K vs Denver metro",
                "More square footage for your budget",
                "Less traffic congestion",
                "Access to hiking, biking, and open spaces",
                "Strong schools and family-friendly communities",
                "Growing tech and healthcare job markets"
            ]},
            {"tag": "h3", "children": ["Commute Considerations"]},
            {"tag": "p", "children": ["Fort Collins to Denver: ~65 miles (1-1.5 hours). Loveland to Denver: ~55 miles. Many residents commute 2-3 days per week with hybrid work. Bustang regional bus service connects Fort Collins to Denver Union Station."]},
            {"tag": "h3", "children": ["Best Cities for Denver Transplants"]},
            {"tag": "p", "children": ["Fort Collins: most similar to Denver's urban-suburban mix with Old Town dining scene. Loveland: arts-focused with excellent value. Longmont: closest to Denver, tech hub. Windsor and Timnath: newer communities, family-oriented. Berthoud: small-town charm with easy I-25 access."]},
            {"tag": "h3", "children": ["The Relocation Process"]},
            {"tag": "p", "children": ["SAA Homes coordinates virtual tours, weekend visit schedules, and neighborhood comparisons. We help Denver buyers understand market differences and craft competitive offers."]},
            {"tag": "p", "children": [
                {"tag": "a", "attrs": {"href": "https://saahomes.com/northern-colorado-areas/"}, "children": ["Compare All 19 Northern Colorado Communities"]},
                " | ",
                {"tag": "a", "attrs": {"href": "https://saahomes.com/"}, "children": ["saahomes.com"]},
                " | (970) 999-1407"]}
        ]
    },
    {
        "title": "Northern Colorado Real Estate Investing — Rental Property Guide 2026",
        "target": "/for-buyers/",
        "keyword": "Northern Colorado real estate investing rental property 2026",
        "content": [
            {"tag": "p", "children": ["Northern Colorado's growing population, strong job market, and Colorado State University presence create steady rental demand. SAA Homes helps investors identify cash-flowing opportunities across Fort Collins, Greeley, Loveland, and beyond."]},
            {"tag": "h3", "children": ["Best Markets for Rental Investment"]},
            {"tag": "p", "children": ["Greeley: lower entry prices ($350K-$450K), strong rental demand from UNC students and JBS workforce. Fort Collins: CSU student rental market, higher appreciation potential. Loveland: balanced owner-occupied and rental mix. Windsor/Severance: growing employer base with new developments attracting tenants."]},
            {"tag": "h3", "children": ["Key Metrics for Northern Colorado"]},
            {"tag": "ul", "children": [
                "Average cap rate: 4.5-6.5% depending on city",
                "Vacancy rates: 2-4% across NoCo",
                "Year-over-year rent growth: 3-5%",
                "Property appreciation: 6-9% annually (5-year avg)",
                "Property tax: ~0.52-0.55% effective rate"
            ]},
            {"tag": "h3", "children": ["Investment Strategies"]},
            {"tag": "p", "children": ["Buy-and-hold single-family homes in Greeley and east Loveland. Multi-family in Fort Collins near CSU. New construction pre-sale discounts in Timnath and Johnstown. Owner-occupied house hacking with FHA or VA loans."]},
            {"tag": "h3", "children": ["Colorado Landlord-Tenant Basics"]},
            {"tag": "p", "children": ["Security deposits limited to 2 months rent. 10-day notice required for entry. Warranty of habitability applies. Eviction process is relatively landlord-friendly. No statewide rent control."]},
            {"tag": "p", "children": [
                {"tag": "a", "attrs": {"href": "https://saahomes.com/for-buyers/"}, "children": ["Investment Property Search — SAA Homes"]},
                " | ",
                {"tag": "a", "attrs": {"href": "https://saahomes.com/chfa-down-payment-assistance/"}, "children": ["CHFA Programs for Owner-Occupied Investing"]},
                " | (970) 999-1407"]}
        ]
    }
]

telegraph_count = 0
for i, post in enumerate(telegraph_posts):
    print(f"\n--- Telegraph Post {i+1}: {post['title'][:70]}... ---")
    payload = {
        "access_token": TELEGRAPH_TOKEN,
        "title": post["title"],
        "author_name": "SAA Homes",
        "author_url": "https://saahomes.com/",
        "content": post["content"],
        "return_content": False
    }
    result = http_post_json("https://api.telegra.ph/createPage", payload)
    if result and result.get('ok'):
        url = result['result']['url']
        print(f"  SUCCESS: {url}")
        log_result("Telegraph Blog", url, "SAA Homes", post["target"], post["keyword"], "built")
        telegraph_count += 1
    else:
        err = result.get('error', 'unknown') if result else 'no_response'
        print(f"  FAILED: {err}")
        log_result("Telegraph Blog", "telegra.ph", "SAA Homes", post["target"], post["keyword"], f"failed_{err}")

print(f"\nTelegraph posts built: {telegraph_count}/{len(telegraph_posts)}")

# ============================================================
# METHOD 2: Rentry Pastebins (reliable)
# ============================================================
print("\n" + "=" * 60)
print("METHOD 2: Rentry Pastebins (3 fresh topics)")
print("=" * 60)

rentry_posts = [
    {
        "text": """# Northern Colorado Property Tax Guide 2026

## Larimer and Weld County Tax Overview for Homeowners

### Key Facts:
- **Assessment Rate**: 6.95% of actual value for residential (2026)
- **Larimer County Mill Levy**: ~72 mills (varies by taxing district)
- **Weld County Mill Levy**: ~68 mills (varies by taxing district)
- **Effective Tax Rate**: ~0.50-0.55% of market value

### Example Tax Calculation:
On a $600,000 home in Fort Collins:
1. Actual value: $600,000
2. Assessed value: $600,000 × 6.95% = $41,700
3. Tax: $41,700 × 0.072 = ~$3,002/year

### Senior Property Tax Exemption:
- Available for seniors 65+ who've owned for 10+ years
- Exempts 50% of first $200,000 of actual value
- Apply through county assessor

### Tax Calendar:
- January 1: Assessment date
- May 1: Notices of valuation mailed
- June 1: Protest deadline
- January (next year): Tax bills due

[Full Northern Colorado Area Guides](https://saahomes.com/northern-colorado-areas/)
[Search Homes for Sale](https://saahomes.com/properties/)

---
**SAA Homes | Schwartz and Associates** | (970) 999-1407
[saahomes.com](https://saahomes.com/)""",
    },
    {
        "text": """# Best Northern Colorado School Districts for Homebuyers 2026

## Top-Rated Districts by Area

### Poudre School District (Fort Collins, Timnath, Wellington)
- 50+ schools, ~30,000 students
- Fort Collins High: 8/10 GreatSchools
- Fossil Ridge High: 9/10 GreatSchools
- Rocky Mountain High: 8/10 GreatSchools
- Timnath Elementary: 9/10
- 85% graduation rate

### Thompson School District (Loveland, Berthoud)
- 30+ schools, ~15,000 students
- Loveland High: 7/10
- Berthoud High: 8/10
- Conrad Ball Middle School: Highly rated STEM
- Mountain View High: IB program available

### Weld RE-4 (Windsor, Severance)
- Growing district with excellent reputation
- Windsor High: 8/10 GreatSchools
- Windsor Middle: 7/10
- New schools under construction for growing communities

### Greeley-Evans School District 6
- Largest in Weld County
- Early College Academy: top-rated program
- Union Colony: charter alternative
- Significant recent investment in facilities

### Charter and Private Options
- Ridgeview Classical (Fort Collins): K-12 charter
- Liberty Common: K-12 charter, top-ranked statewide
- Resurrection Christian (Loveland): private K-12
- St. Mary Catholic School (Greeley): private K-8

[Search Homes by School District](https://saahomes.com/properties/)
[All Area Guides](https://saahomes.com/northern-colorado-areas/)

---
**SAA Homes** | (970) 999-1407 | [saahomes.com](https://saahomes.com/)""",
    },
    {
        "text": """# Northern Colorado Condo and Townhome Buying Guide 2026

## Low-Maintenance Living Across NoCo

### Why Choose a Condo or Townhome?
- Lower purchase price than single-family
- No exterior maintenance
- Community amenities (pools, gyms, clubhouses)
- Often closer to downtown areas
- Great for first-time buyers and downsizers

### Fort Collins Condo Market
- Old Town condos: $350K-$550K
- Midtown/Mulberry corridor: $280K-$400K
- South Fort Collins townhomes: $380K-$520K
- HOA fees: $200-$450/month typical

### Loveland Townhome Options
- Downtown Loveland: $320K-$450K
- Centerra area: $350K-$480K
- New construction townhomes in Northwest Loveland
- HOA fees: $150-$350/month

### Windsor Condos
- Water Valley condos: $375K-$525K
- Pelican Lakes townhomes: $400K-$550K
- Main Park area: newer complexes with amenities

### Greeley Affordable Options
- UNC area condos: $180K-$280K
- West Greeley townhomes: $250K-$380K
- New construction duplexes in East Greeley
- Lowest HOA fees in region: $100-$250/month

### What to Check Before Buying:
1. HOA financial reserves and special assessments
2. Rental restrictions (important for investors)
3. Pet policies
4. Parking and storage availability
5. Insurance requirements

[Search Condos & Townhomes](https://saahomes.com/properties/)
[CHFA Down Payment Help](https://saahomes.com/chfa-down-payment-assistance/)

---
**SAA Homes | Schwartz and Associates** | (970) 999-1407
[saahomes.com](https://saahomes.com/)""",
    }
]

rentry_count = 0
for i, post in enumerate(rentry_posts):
    print(f"\n--- Rentry Post {i+1} ---")
    payload = {
        "text": post["text"],
        "edit_code": "",
        "url": ""
    }
    result = http_post_json("https://rentry.co/api/new", payload)
    if result and result.get('status') == '200':
        url = result.get('url', 'unknown')
        print(f"  SUCCESS: {url}")
        log_result("Pastebin (Rentry)", url, "SAA Homes", "/", "Northern Colorado real estate", "built")
        rentry_count += 1
    else:
        print(f"  FAILED: {result}")
        log_result("Pastebin (Rentry)", "rentry.co", "SAA Homes", "/", "Northern Colorado real estate", "failed_api")

print(f"\nRentry pastebins built: {rentry_count}/{len(rentry_posts)}")

# ============================================================
# METHOD 3: Write.as Posts (try 2)
# ============================================================
print("\n" + "=" * 60)
print("METHOD 3: Write.as Posts (2 attempts)")
print("=" * 60)

writeas_posts = [
    {
        "title": "Northern Colorado Real Estate Investing Guide 2026 — SAA Homes",
        "body": """# Northern Colorado Real Estate Investing 2026

Greeley, Fort Collins, and Loveland offer strong rental markets driven by university demand and growing employment. Entry prices range from $350K-$550K for single-family rentals.

**Best Markets:**
- Greeley: highest cap rates (5-6.5%), UNC student demand
- Fort Collins: CSU proximity, long-term appreciation
- Windsor/Severance: growing employer base

[Explore Northern Colorado Investment Properties at SAA Homes](https://saahomes.com/for-buyers/)

---
SAA Homes | (970) 999-1407 | [saahomes.com](https://saahomes.com/)"""
    },
    {
        "title": "Property Tax Guide for Northern Colorado Homeowners 2026 — SAA Homes",
        "body": """# Northern Colorado Property Tax Guide 2026

Colorado's residential assessment rate is 6.95% for 2026. Larimer County effective tax rate averages 0.52%, Weld County 0.55%.

**Example:** $600K home in Fort Collins = ~$3,002/year in property taxes.

Senior exemption available for homeowners 65+ who've owned for 10+ years.

[Complete Northern Colorado Community Guides](https://saahomes.com/northern-colorado-areas/)

---
SAA Homes | (970) 999-1407 | [saahomes.com](https://saahomes.com/)"""
    }
]

writeas_count = 0
for i, post in enumerate(writeas_posts):
    print(f"\n--- Write.as Post {i+1}: {post['title'][:60]}... ---")
    payload = {
        "title": post["title"],
        "body": post["body"],
        "crosspost": ""
    }
    result = http_post_json("https://write.as/api/posts", payload)
    if result and result.get('data') and result['data'].get('slug'):
        slug = result['data']['slug']
        url = f"https://write.as/{slug}.md"
        print(f"  SUCCESS: {url}")
        log_result("Write.as Blog", url, "SAA Homes", "/", "Northern Colorado real estate", "built")
        writeas_count += 1
    else:
        err = result.get('error_msg', 'unknown') if result else 'no_response'
        print(f"  FAILED: {err}")
        log_result("Write.as Blog", "write.as", "SAA Homes", "/", "Northern Colorado real estate", f"failed_{err}")

print(f"\nWrite.as posts built: {writeas_count}/{len(writeas_posts)}")

# ============================================================
# METHOD 4: Archive.org saves (try 3)
# ============================================================
print("\n" + "=" * 60)
print("METHOD 4: Archive.org Saves (3 pages)")
print("=" * 60)

archive_pages = [
    ("https://saahomes.com/for-buyers/", "SAA Homes buyer resources", "/for-buyers/", "Northern Colorado home buying"),
    ("https://saahomes.com/northern-colorado-areas/", "SAA Homes area guides", "/northern-colorado-areas/", "Northern Colorado communities"),
    ("https://saahomes.com/northern-colorado-areas/loveland/", "Loveland area guide", "/northern-colorado-areas/loveland/", "Loveland Colorado real estate"),
]

archive_count = 0
for url, anchor, target, keyword in archive_pages:
    print(f"\n--- Archive: {url} ---")
    save_url = f"https://web.archive.org/save/{url}"
    try:
        req = urllib.request.Request(save_url, headers={'User-Agent': USER_AGENT})
        with urllib.request.urlopen(req, timeout=60) as resp:
            final_url = resp.geturl()
            if 'web.archive.org' in final_url:
                print(f"  SUCCESS: {final_url}")
                log_result("Archive.org", final_url, anchor, target, keyword, "built")
                archive_count += 1
            else:
                print(f"  UNEXPECTED: {final_url}")
    except urllib.error.HTTPError as e:
        print(f"  HTTP {e.code}")
        log_result("Archive.org", "web.archive.org", anchor, target, keyword, f"failed_http{e.code}")
    except Exception as e:
        print(f"  Error: {e}")
        log_result("Archive.org", "web.archive.org", anchor, target, keyword, f"failed_error")

print(f"\nArchive.org pages saved: {archive_count}/{len(archive_pages)}")

# ============================================================
# METHOD 5: Paste.rs (try 2)
# ============================================================
print("\n" + "=" * 60)
print("METHOD 5: Paste.rs (2 attempts)")
print("=" * 60)

pasters_posts = [
    """# Northern Colorado vs Denver Metro — Cost Comparison 2026

Housing: Save $100K-$200K on median home price moving from Denver to NoCo.
Commute: Fort Collins to Denver is ~65 miles. Windsor/Loveland even closer.
Lifestyle: Access to Horsetooth Reservoir, Poudre Canyon, Rocky Mountain National Park.
Schools: Poudre, Thompson, and Weld RE-4 districts rated among Colorado's best.

[Compare All 19 Northern Colorado Communities](https://saahomes.com/northern-colorado-areas/)
[Search Properties](https://saahomes.com/properties/)

SAA Homes | (970) 999-1407 | saahomes.com""",
    """# The Home Buying Process in Northern Colorado — Step by Step 2026

1. Get Pre-Approved — choose a local lender who knows CHFA and VA programs
2. Define Your Search — pick 2-3 target cities/neighborhoods
3. Tour Homes — SAA Homes coordinates efficient viewing tours
4. Make an Offer — competitive based on recent comparable sales
5. Inspection & Appraisal — protect your investment
6. Close & Get Keys — typically 30-45 days from offer

CHFA down payment grants up to $25,000 available for qualified buyers.

[Start Your Home Search](https://saahomes.com/for-buyers/)
[CHFA Programs Guide](https://saahomes.com/chfa-down-payment-assistance/)

SAA Homes | (970) 999-1407 | saahomes.com"""
]

pasters_count = 0
for i, text in enumerate(pasters_posts):
    print(f"\n--- Paste.rs Post {i+1} ---")
    req = urllib.request.Request(
        "https://paste.rs/",
        data=text.encode('utf-8'),
        headers={'User-Agent': USER_AGENT, 'Content-Type': 'text/plain'},
        method='POST'
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            url = resp.read().decode().strip()
            print(f"  SUCCESS: {url}")
            log_result("Paste.rs", url, "SAA Homes", "/", "Northern Colorado real estate", "built")
            pasters_count += 1
    except urllib.error.HTTPError as e:
        print(f"  HTTP {e.code}")
        log_result("Paste.rs", "paste.rs", "SAA Homes", "/", "Northern Colorado real estate", f"failed_http{e.code}")
    except Exception as e:
        print(f"  Error: {e}")
        log_result("Paste.rs", "paste.rs", "SAA Homes", "/", "Northern Colorado real estate", f"failed_error")

print(f"\nPaste.rs built: {pasters_count}/{len(pasters_posts)}")

# ============================================================
# SUMMARY
# ============================================================
total = telegraph_count + rentry_count + writeas_count + archive_count + pasters_count
print("\n" + "=" * 60)
print(f"SUMMARY: {total} backlinks built this run")
print(f"  Telegraph: {telegraph_count}")
print(f"  Rentry: {rentry_count}")
print(f"  Write.as: {writeas_count}")
print(f"  Archive.org: {archive_count}")
print(f"  Paste.rs: {pasters_count}")
print("=" * 60)
