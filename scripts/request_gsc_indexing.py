#!/usr/bin/env python3
"""Trigger Google re-crawl of problem pages via sitemap PUT (real crawl prompt) + inspection.

IMPORTANT (fixed 2026-09-10): The Search Console URL Inspection API (urlInspection.index.inspect)
is READ-ONLY — calling it does NOT trigger a crawl or request indexing. The only API-accessible
mechanism that prompts Google to re-process a site is submitting the sitemap (PUT to the
Webmasters sitemaps endpoint), which makes Google re-fetch sitemap.xml and see fresh <lastmod>
values for changed pages. This script now does the sitemap PUT FIRST (the actual crawl trigger),
then inspects the URLs to report status.
"""
import json, os, sys, urllib.request, urllib.parse
from datetime import datetime

from google.oauth2 import service_account
from google.auth.transport.requests import Request as AuthRequest
from googleapiclient.discovery import build

CREDENTIALS_PATH = '/opt/data/credentials/gsc-key.json'
SITE_DOMAIN = 'sc-domain:saahomes.com'
BASE_URL = 'https://saahomes.com'

URLS_TO_REINDEX = [
    '/properties/',
    '/northern-colorado-areas/fort-collins/',
    '/northern-colorado-areas/greeley/',
]

print("=" * 70)
print("  GSC RE-INDEXING REQUEST — saahomes.com")
print(f"  {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
print("=" * 70)
print()

# Authenticate
print("Authenticating to Google Search Console...")
creds = service_account.Credentials.from_service_account_file(
    CREDENTIALS_PATH,
    scopes=['https://www.googleapis.com/auth/webmasters']
)
auth_req = AuthRequest()
creds.refresh(auth_req)
token = creds.token
service = build('searchconsole', 'v1', credentials=creds)
print("Connected.")
print()

# STEP 1: PUT the sitemap — this is the ONLY real crawl-prompt available via API.
# Re-fetching sitemap.xml lets Google see fresh <lastmod> values (set by generate-sitemap.mjs)
# for the problem pages, which is what triggers re-crawl of changed URLs.
print("STEP 1: Re-submitting sitemap (the actual crawl trigger)...")
sitemap_url = 'https://saahomes.com/sitemap.xml'
req = urllib.request.Request(
    f'https://www.googleapis.com/webmasters/v3/sites/{SITE_DOMAIN}/sitemaps/{urllib.parse.quote(sitemap_url, safe="")}',
    method='PUT',
    headers={'Authorization': f'Bearer {token}', 'Content-Length': '0'}
)
with urllib.request.urlopen(req, timeout=15) as resp:
    print(f"  Sitemap PUT: HTTP {resp.status}")
print("  Google will re-process sitemap.xml within hours; fresh lastmods prompt re-crawl of changed pages.")
print()

# STEP 2: Inspect each URL (read-only status check — does NOT trigger crawl, reports state)
print("STEP 2: Inspecting target URLs (status check only)...")
for path in URLS_TO_REINDEX:
    full_url = f'{BASE_URL}{path}'
    print(f"  {path}")
    try:
        insp = service.urlInspection().index().inspect(
            body={'inspectionUrl': full_url, 'siteUrl': SITE_DOMAIN}
        ).execute()
        res = insp.get('inspectionResult', {})
        idx = res.get('indexStatusResult', {})
        verdict = idx.get('verdict', 'UNKNOWN')
        cov = idx.get('coverageState', 'UNKNOWN')
        print(f"    Status: {verdict} — {cov}")
        print(f"    Note: inspection is read-only; re-crawl triggered by sitemap PUT above.")
    except Exception as e:
        print(f"    ERROR: {e}")
    print()

print("=" * 70)
print("  Done. Sitemap submitted for re-processing; statuses reported above.")
print("  Expect re-crawl within 1-7 days. Re-run indexation patrol to confirm.")
print("=" * 70)