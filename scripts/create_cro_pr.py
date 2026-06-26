import urllib.request
import json
import os

token = os.environ.get('GITHUB_TOKEN', '')
if not token:
    print('GITHUB_TOKEN not found')
    exit(1)

owner = 'adamsch0100'
repo = 'saahomes'
branch = 'hermes/seo-20260626-cro-surge'

pr_data = json.dumps({
    'title': 'CRO surge: hero CTAs, brand-consistent buttons, phone visibility',
    'head': branch,
    'base': 'main',
    'body': '''## CRO Surge — High-Impact Conversion Fixes

### Changes

**Fix 1: Hero CTAs added to 4 landing pages**
- /for-buyers/ — Search Homes + Get Free Buyer Consultation buttons above the fold
- /for-sellers/ — Get Your Home Value + Contact Us buttons in hero (kept scroll-down indicator)
- /contact/ — Call (970) 999-1407 + Send a Message buttons in hero
- /fort-collins/ — Search Fort Collins Homes + Talk to an Agent buttons in hero

**Fix 2: Brand-consistent button styling**
- Replaced blue-600 button with brand black on Fort Collins page

**Fix 3: Phone number (970) 999-1407 as visible trust signal**
- For Buyers: Added to Get Pre-Approved gold section
- For Sellers: Added to Sell With The Best Team section
- Fort Collins: Added to Market Report section

### CRO Audit Summary
4/5 audited pages had ZERO above-the-fold CTAs. Only CHFA pages were optimized.
'''
}).encode()

req = urllib.request.Request(
    f'https://api.github.com/repos/{owner}/{repo}/pulls',
    data=pr_data,
    headers={
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github.v3+json',
    },
    method='POST'
)

try:
    resp = urllib.request.urlopen(req)
    result = json.loads(resp.read())
    print(f'PR created: {result["html_url"]}')
    print(f'PR number: {result["number"]}')
except urllib.error.HTTPError as e:
    error_body = e.read().decode()
    print(f'Error {e.code}: {error_body}')
