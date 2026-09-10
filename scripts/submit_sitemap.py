#!/usr/bin/env python3
"""Re-submit sitemap via GSC API to trigger re-crawl."""
import json, sys, urllib.request, urllib.parse
from google.oauth2 import service_account
from google.auth.transport.requests import Request as AuthRequest

CREDENTIALS_PATH = '/opt/data/credentials/gsc-key.json'
SITE_DOMAIN = 'sc-domain:saahomes.com'

try:
    creds = service_account.Credentials.from_service_account_file(
        CREDENTIALS_PATH,
        scopes=['https://www.googleapis.com/auth/webmasters']
    )
    auth_req = AuthRequest()
    creds.refresh(auth_req)
    token = creds.token

    # 1. List existing sitemaps
    print("Listing existing sitemaps...")
    req = urllib.request.Request(
        f'https://www.googleapis.com/webmasters/v3/sites/{SITE_DOMAIN}/sitemaps',
        headers={'Authorization': f'Bearer {token}'}
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        sitemaps = json.loads(resp.read())
    for s in sitemaps.get('sitemap', []):
        print(f"  {s.get('path')} — {s.get('isPending', '?')} pending, {s.get('isSitemapsIndex', '?')} index, submitted {s.get('lastSubmitted', '')}")

    # 2. Submit the sitemap (PUT creates/updates)
    print("\nSubmitting sitemap...")
    sitemap_url = 'https://saahomes.com/sitemap.xml'
    req = urllib.request.Request(
        f'https://www.googleapis.com/webmasters/v3/sites/{SITE_DOMAIN}/sitemaps/{urllib.parse.quote(sitemap_url, safe="")}',
        method='PUT',
        headers={'Authorization': f'Bearer {token}', 'Content-Length': '0'}
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        print(f"  Sitemap submitted: HTTP {resp.status}")

    # 3. Verify submission
    print("\nVerifying sitemap submission...")
    req = urllib.request.Request(
        f'https://www.googleapis.com/webmasters/v3/sites/{SITE_DOMAIN}/sitemaps/{urllib.parse.quote(sitemap_url, safe="")}',
        headers={'Authorization': f'Bearer {token}'}
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        result = json.loads(resp.read())
        print(f"  Path: {result.get('path')}")
        print(f"  Last submitted: {result.get('lastSubmitted')}")
        print(f"  Last downloaded: {result.get('lastDownloaded')}")
        print(f"  Pending: {result.get('isPending')}")
        print(f"  Warnings: {result.get('warnings')}")
        print(f"  Errors: {result.get('errors')}")
        print(f"  Contents: {result.get('contents', [{}])[0].get('submitted', 0)} URLs")

    print("\n✅ Sitemap re-submitted. Google will re-process it within hours.")
    
except Exception as e:
    print(f"ERROR: {e}", file=sys.stderr)
    import traceback
    traceback.print_exc()
    sys.exit(1)