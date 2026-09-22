#!/usr/bin/env python3
"""Inspect ALL /northern-colorado-areas/{slug}/ URLs via GSC URL Inspection API.
Read-only. Reports coverage state for each; flags anything not indexed.
Rotation misses stuck pages (boulder was stuck 60 days outside rotation, 2026-09-21),
so run this alongside the patrol. Requires /opt/data/credentials/gsc-key.json.
Usage: /usr/local/lib/hermes-agent/venv/bin/python3 scripts/inspect_all_area_pages.py
"""
import json, re, urllib.request

from google.oauth2 import service_account
from googleapiclient.discovery import build

CREDENTIALS_PATH = '/opt/data/credentials/gsc-key.json'
SITE_DOMAIN = 'sc-domain:saahomes.com'

req = urllib.request.Request('https://saahomes.com/sitemap.xml',
                             headers={'User-Agent': 'Mozilla/5.0 indexation-patrol'})
sitemap = urllib.request.urlopen(req, timeout=30).read().decode('utf-8', 'ignore')
urls = re.findall(r'<loc>(https://saahomes\.com/northern-colorado-areas/[a-z0-9-]+/)</loc>', sitemap)
slugs = sorted(set(u.rstrip('/').split('/')[-1] for u in urls))
print(f'Area pages found in sitemap: {len(slugs)}')

creds = service_account.Credentials.from_service_account_file(
    CREDENTIALS_PATH, scopes=['https://www.googleapis.com/auth/webmasters'])
service = build('searchconsole', 'v1', credentials=creds)

results = []
for slug in slugs:
    url = f'https://saahomes.com/northern-colorado-areas/{slug}/'
    try:
        resp = service.urlInspection().index().inspect(
            body={'inspectionUrl': url, 'siteUrl': SITE_DOMAIN}).execute()
        res = resp.get('inspectionResult', {})
        idx = res.get('indexStatusResult', {})
        cov = idx.get('coverageState', 'UNKNOWN')
        verdict = idx.get('verdict', 'UNKNOWN')
        crawl = idx.get('lastCrawlTime', None)
        results.append({'slug': slug, 'verdict': verdict, 'coverage': cov, 'last_crawl': crawl})
        flag = ' <-- NOT INDEXED' if 'not indexed' in cov.lower() else ''
        print(f'{slug:20s} {verdict:10s} {cov:45s} crawl={crawl}{flag}')
    except Exception as e:
        print(f'{slug:20s} ERROR: {e}')
        results.append({'slug': slug, 'error': str(e)})

with open('.hermes/area-inspection-all.json', 'w') as f:
    json.dump(results, f, indent=2)
print(f'\nSaved .hermes/area-inspection-all.json ({len(results)} results)')
