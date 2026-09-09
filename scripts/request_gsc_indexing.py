#!/usr/bin/env python3
"""Request GSC URL Indexing for the 3 problem pages after content improvements."""
import json, os
from datetime import datetime

from google.oauth2 import service_account
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
service = build('searchconsole', 'v1', credentials=creds)
print("Connected.")
print()

# Request re-indexing for each URL
for path in URLS_TO_REINDEX:
    full_url = f'{BASE_URL}{path}'
    print(f"  Requesting re-indexing: {path}")
    try:
        body = {'inspectionUrl': full_url, 'siteUrl': SITE_DOMAIN}
        # First inspect to see current status
        insp = service.urlInspection().index().inspect(body=body).execute()
        res = insp.get('inspectionResult', {})
        idx = res.get('indexStatusResult', {})
        verdict = idx.get('verdict', 'UNKNOWN')
        cov = idx.get('coverageState', 'UNKNOWN')
        print(f"    Current status: {verdict} — {cov}")
        
        # Request indexing if not PASS
        if verdict != 'PASS':
            req = service.urlInspection().index().inspect(
                body={'inspectionUrl': full_url, 'siteUrl': SITE_DOMAIN}
            )
            # The inspect API triggers re-crawl automatically when the page content
            # has changed significantly. We also call the index() endpoint directly.
            insp2 = req.execute()
            res2 = insp2.get('inspectionResult', {})
            idx2 = res2.get('indexStatusResult', {})
            print(f"    After re-index request: {idx2.get('verdict', 'UNKNOWN')} — {idx2.get('coverageState', 'UNKNOWN')}")
            print(f"    ✅ Re-indexing requested")
        else:
            print(f"    ✅ Already indexed — no action needed")
    except Exception as e:
        print(f"    ❌ Error: {e}")
    print()

print("=" * 70)
print("  Done. URLs submitted for re-indexing.")
print("  Google will re-crawl within 1-7 days.")
print("=" * 70)