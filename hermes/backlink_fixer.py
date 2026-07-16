#!/usr/bin/env python3
"""Fix Rentry (form-urlencoded) and Write.as (no crosspost field) backlinks."""
import urllib.request, urllib.parse, json, csv
from datetime import date

LOG_CSV = '/opt/data/workspace/saahomes-repo/hermes/backlinks-log.csv'
USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36'

def log_result(method, url, anchor_text, target_page, keyword, status):
    today = date.today().isoformat()
    row = [today, method, url, anchor_text, target_page, keyword, status]
    with open(LOG_CSV, 'a', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(row)
    print(f'  [LOGGED] {method}: {status}')

# ============================================================
# FIXED Rentry (form-urlencoded)
# ============================================================
print('=' * 60)
print('METHOD: Rentry Pastebins (3 posts, form-urlencoded)')
print('=' * 60)

rentry_posts = [
    ('''# Northern Colorado Property Tax Guide 2026

## Larimer and Weld County Tax Overview for Homeowners

### Key Facts:
- **Assessment Rate**: 6.95% of actual value for residential (2026)
- **Larimer County Mill Levy**: ~72 mills
- **Weld County Mill Levy**: ~68 mills
- **Effective Tax Rate**: ~0.50-0.55% of market value

### Example Tax Calculation:
On a $600,000 home in Fort Collins:
1. Actual value: $600,000
2. Assessed value: $600,000 x 6.95% = $41,700
3. Tax: $41,700 x 0.072 = ~$3,002/year

### Senior Property Tax Exemption:
- Available for seniors 65+ who've owned for 10+ years
- Exempts 50% of first $200,000 of actual value

[Full Northern Colorado Area Guides](https://saahomes.com/northern-colorado-areas/)
[Search Homes for Sale](https://saahomes.com/properties/)

---
**SAA Homes | Schwartz and Associates** | (970) 999-1407
[saahomes.com](https://saahomes.com/)''', 'property tax Northern Colorado 2026'),

    ('''# Best Northern Colorado School Districts for Homebuyers 2026

## Top-Rated Districts by Area

### Poudre School District (Fort Collins, Timnath, Wellington)
- 50+ schools, ~30,000 students
- Fossil Ridge High: 9/10 GreatSchools
- Rocky Mountain High: 8/10 GreatSchools
- 85% graduation rate

### Thompson School District (Loveland, Berthoud)
- 30+ schools, ~15,000 students
- Berthoud High: 8/10
- Mountain View High: IB program available

### Weld RE-4 (Windsor, Severance)
- Growing district with excellent reputation
- Windsor High: 8/10 GreatSchools

### Greeley-Evans School District 6
- Largest in Weld County
- Early College Academy: top-rated program
- Union Colony: charter alternative

### Charter and Private Options
- Ridgeview Classical (Fort Collins): K-12 charter
- Liberty Common: top-ranked statewide
- Resurrection Christian (Loveland): private K-12

[Search Homes by School District](https://saahomes.com/properties/)
[All Area Guides](https://saahomes.com/northern-colorado-areas/)

---
**SAA Homes** | (970) 999-1407 | [saahomes.com](https://saahomes.com/)''', 'Northern Colorado school districts homebuyers 2026'),

    ('''# Northern Colorado Condo and Townhome Buying Guide 2026

## Low-Maintenance Living Across NoCo

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
- Main Park area: newer complexes

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
[saahomes.com](https://saahomes.com/)''', 'Northern Colorado condos townhomes 2026'),
]

rentry_count = 0
for i, (text, keyword) in enumerate(rentry_posts):
    print(f'\n--- Rentry Post {i+1} ---')
    data = urllib.parse.urlencode({'text': text, 'url': ''}).encode()
    req = urllib.request.Request('https://rentry.co/api/new', data=data,
        headers={'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': USER_AGENT}, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            result = json.loads(resp.read().decode())
            if result.get('status') == '200':
                url = result.get('url', 'unknown')
                print(f'  SUCCESS: {url}')
                log_result('Pastebin (Rentry)', url, 'SAA Homes', '/', keyword, 'built')
                rentry_count += 1
            else:
                print(f'  FAILED: {result}')
                log_result('Pastebin (Rentry)', 'rentry.co', 'SAA Homes', '/', keyword, 'failed_api')
    except Exception as e:
        print(f'  Error: {e}')
        log_result('Pastebin (Rentry)', 'rentry.co', 'SAA Homes', '/', keyword, 'failed_error')

print(f'\nRentry built: {rentry_count}/3')

# ============================================================
# FIXED Write.as (no crosspost field)
# ============================================================
print('\n' + '=' * 60)
print('METHOD: Write.as Posts (2 posts)')
print('=' * 60)

writeas_posts = [
    ('''# Northern Colorado Real Estate Investing 2026

Greeley, Fort Collins, and Loveland offer strong rental markets driven by university demand and growing employment. Entry prices range from $350K-$550K for single-family rentals.

**Best Markets:**
- Greeley: highest cap rates (5-6.5%), UNC student demand
- Fort Collins: CSU proximity, long-term appreciation
- Windsor/Severance: growing employer base

**Key Metrics:**
- Cap rates: 4.5-6.5%
- Vacancy rates: 2-4%
- Annual rent growth: 3-5%

**Strategies:** Buy-and-hold SFR, multi-family near CSU, new construction pre-sales, house hacking with FHA/VA loans.

[Explore Investment Properties at SAA Homes](https://saahomes.com/for-buyers/)
[CHFA Programs for Owner-Occupied](https://saahomes.com/chfa-down-payment-assistance/)

---
SAA Homes | (970) 999-1407 | [saahomes.com](https://saahomes.com/)''', 'Northern Colorado real estate investing 2026'),

    ('''# Property Tax Guide for Northern Colorado Homeowners 2026

Colorado residential assessment rate is 6.95% for 2026. Larimer County effective tax rate averages 0.52%, Weld County 0.55%.

**Example:** $600K home in Fort Collins = ~$3,002/year in property taxes.

**Senior Exemption:** Available for homeowners 65+ who have owned for 10+ years. Exempts 50% of first $200K of actual value.

**Tax Calendar:**
- Jan 1: Assessment date
- May 1: Valuation notices mailed
- June 1: Protest deadline
- Jan (next year): Tax bills due

[Complete Northern Colorado Community Guides](https://saahomes.com/northern-colorado-areas/)
[Search Properties](https://saahomes.com/properties/)

---
SAA Homes | (970) 999-1407 | [saahomes.com](https://saahomes.com/)''', 'Northern Colorado property taxes 2026'),
]

writeas_count = 0
for i, (body, keyword) in enumerate(writeas_posts):
    print(f'\n--- Write.as Post {i+1} ---')
    title = f'Northern Colorado {"Real Estate Investing" if i == 0 else "Property Tax"} Guide 2026 — SAA Homes'
    payload = json.dumps({'title': title, 'body': body}).encode()
    req = urllib.request.Request('https://write.as/api/posts', data=payload,
        headers={'Content-Type': 'application/json', 'User-Agent': USER_AGENT}, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            result = json.loads(resp.read().decode())
            if result.get('code') == 201:
                slug = result['data'].get('slug', result['data'].get('id', 'unknown'))
                url = f'https://write.as/{slug}.md'
                print(f'  SUCCESS: {url}')
                log_result('Write.as Blog', url, 'SAA Homes', '/', keyword, 'built')
                writeas_count += 1
            else:
                print(f'  FAILED: {result}')
                log_result('Write.as Blog', 'write.as', 'SAA Homes', '/', keyword, 'failed_api')
    except Exception as e:
        print(f'  Error: {e}')
        log_result('Write.as Blog', 'write.as', 'SAA Homes', '/', keyword, 'failed_error')

print(f'\nWrite.as built: {writeas_count}/2')

total = rentry_count + writeas_count
print(f'\n{"=" * 60}')
print(f'Additional backlinks built: {total}')
print(f'  Rentry: {rentry_count}')
print(f'  Write.as: {writeas_count}')
