#!/usr/bin/env python3
import json, os, sys, urllib.request, urllib.error

env_path = '/opt/data/.env'
if os.path.exists(env_path):
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if '=' in line and not line.startswith('#'):
                idx = line.find('=')
                k = line[:idx].strip()
                v = line[idx+1:].strip().strip("'\"")
                os.environ[k] = v

token = os.environ.get('GITHUB_TOKEN', '')
if not token:
    print("ERROR: GITHUB_TOKEN not found")
    sys.exit(1)

owner = "adamsch0100"
repo = "saahomes"
branch = "hermes/seo-2026-07-01-internal-links"

pr_data = {
    "title": "Internal Link Architecture: Strengthen link flow to money & area pages",
    "body": "## Internal Link Architecture Optimization\n\nStrengthened internal link equity flow per the internal-link-architecture skill pattern (every blog post -> 2+ area pages + 1 money page).\n\n### Blog Posts -> Area Pages + Money Pages\n- How to Sell Your Home Fast: /for-sellers/, Fort Collins + Loveland area guides (was: zero links)\n- Buying a Home in Fort Collins: Fort Collins area guide (inline), /for-buyers/\n- CHFA DPA Colorado 2026: Fort Collins + Greeley area guides, /for-buyers/\n- CHFA First-Time Homebuyer NOCO: /for-buyers/\n- CHFA Schools To Home: Fort Collins + Loveland area guides, /for-buyers/\n- Champions Home Loan: Fort Collins + Greeley area guides, /for-buyers/\n- Market Update July 2026: /for-buyers/, /for-sellers/\n- Market Update June 2026: /for-buyers/, /for-sellers/\n- Events Guide 2026: /for-buyers/\n\n### Area Pages -> Nearby Community Cross-Links\nAll 11 dedicated area pages + 6 dynamic AreaGuidePage pages now have Nearby Northern Colorado Communities sections with contextual cross-links to 6 nearby cities each.\n\n### Orphan Pages Addressed\n- G-HOPE page: inbound links via area page CHFA CTA sections\n- Smaller area pages (Milliken, La Salle, Mead, Eaton): cross-linked from larger nearby pages\n- /for-buyers/ and /for-sellers/: now linked from all blog posts\n\n### Brand Checklist\n- Northern Colorado cities referenced\n- SAA Homes named\n- Phone (970) 999-1407 present\n- CHFA claims cite 2026 guidelines\n- No Fair Housing violations\n",
    "head": branch,
    "base": "main"
}

data = json.dumps(pr_data).encode('utf-8')

req = urllib.request.Request(
    f"https://api.github.com/repos/{owner}/{repo}/pulls",
    data=data,
    headers={
        "Authorization": f"token {token}",
        "Accept": "application/vnd.github.v3+json",
        "Content-Type": "application/json",
    }
)

try:
    resp = urllib.request.urlopen(req, timeout=30)
    result = json.loads(resp.read().decode('utf-8'))
    pr_number = result['number']
    pr_url = result['html_url']
    print(f"PR #{pr_number} created: {pr_url}")
except urllib.error.HTTPError as e:
    error_body = e.read().decode('utf-8')
    print(f"HTTP {e.code}: {error_body}")
    sys.exit(1)
