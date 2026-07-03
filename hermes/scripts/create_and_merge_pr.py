#!/usr/bin/env python3
"""Create and merge a PR for the fort collins realtor content fix."""
import json
import os
import sys
import urllib.request

TOKEN = os.environ.get('GITHUB_TOKEN', '')
OWNER = 'adamsch0100'
REPO = 'saahomes'
BRANCH = 'hermes/seo-20260701-fort-collins-realtor-content'
BASE = 'main'

headers = {
    'Authorization': f'token {TOKEN}',
    'Accept': 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
}

# Step 1: Create PR
pr_data = {
    'title': 'Fort Collins area page: add realtor content for "fort collins realtor" query',
    'body': (
        '## Content Gap Fix\n\n'
        '**Tier S query:** `fort collins realtor` — SAA Homes was not appearing in top 10 SERP results.\n\n'
        '### Changes:\n'
        '- Added "Your Trusted Fort Collins Realtors" section to FortCollinsPage.jsx with buyer/seller service descriptions\n'
        '- Extended keywords: added "Fort Collins real estate agent" and "best realtor in Fort Collins"\n'
        '- Added FAQ: "Why choose Schwartz and Associates as your Fort Collins realtor?"\n'
        '- Updated prerender to include Fort Collins Realtor Guide link in city guides\n\n'
        '### Brand checklist:\n'
        '- ✅ Mentions Northern Colorado / Fort Collins throughout\n'
        '- ✅ SAA Homes / Schwartz and Associates named\n'
        '- ✅ Phone (970) 999-1407 present\n'
        '- ✅ CHFA references include programs\n'
        '- ✅ No Fair Housing violations\n'
        '- ✅ Unique content per city\n\n'
        '### Prerender audit (20.8KB):\n'
        '- ✅ FAQPage schema present\n'
        '- ✅ Area body content injected\n'
        '- ✅ Cross-links to nearby communities\n'
        '- ✅ Fort Collins Realtor Guide blog link injected'
    ),
    'head': BRANCH,
    'base': BASE,
}

req = urllib.request.Request(
    f'https://api.github.com/repos/{OWNER}/{REPO}/pulls',
    data=json.dumps(pr_data).encode(),
    headers=headers,
    method='POST',
)

try:
    resp = json.loads(urllib.request.urlopen(req, timeout=15).read())
    pr_num = resp.get('number')
    pr_url = resp.get('html_url', '')
    print(f'PR #{pr_num} created: {pr_url}')
except urllib.error.HTTPError as e:
    err_body = e.read().decode()
    print(f'ERROR creating PR: {e.code} {err_body}')
    sys.exit(1)

# Step 2: Merge immediately (AUTO_MERGE_SEO_PRS=true)
merge_data = {
    'commit_title': f'Fort Collins area page: add realtor content (#{pr_num})',
    'merge_method': 'squash',
}

req2 = urllib.request.Request(
    f'https://api.github.com/repos/{OWNER}/{REPO}/pulls/{pr_num}/merge',
    data=json.dumps(merge_data).encode(),
    headers=headers,
    method='PUT',
)

try:
    resp2 = json.loads(urllib.request.urlopen(req2, timeout=15).read())
    merged = resp2.get('merged', False)
    print(f'Merged: {merged}')
    print(f'Response: {json.dumps(resp2, indent=2)}')
except urllib.error.HTTPError as e:
    err_body = e.read().decode()
    print(f'ERROR merging PR: {e.code} {err_body}')
    sys.exit(1)
