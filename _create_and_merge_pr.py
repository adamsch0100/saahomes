#!/usr/bin/env python3
import json, urllib.request, urllib.error, os, sys

token = os.environ.get('GITHUB_TOKEN', '')
if not token:
    print("GITHUB_TOKEN not found", file=sys.stderr)
    sys.exit(1)

headers = {
    'Authorization': f'token {token}',
    'Accept': 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
}

# Create PR
pr_data = json.dumps({
    'title': 'Add Greeley Seller Guide -- selling your home in Greeley Colorado blog post',
    'head': 'hermes/seo-2026-07-01-greeley-seller-guide',
    'base': 'main',
    'body': (
        '## Content: Greeley Seller Guide\n\n'
        '**Brand checklist:**\n'
        '- Northern Colorado / Greeley / Weld County focused\n'
        '- Schwartz and Associates / SAA Homes named\n'
        '- Phone (970) 999-1407 present in CTA and contact links\n'
        '- CHFA claims cite sources + 2026 context\n'
        '- No Fair Housing violations\n'
        '- No copied competitor text -- original content\n'
        '- Unique Greeley-specific content (not a template)\n\n'
        '**Target queries:**\n'
        '- sell my home greeley colorado\n'
        '- greeley co real estate agent\n'
        '- greeley colorado homes for sale\n'
        '- greeley home selling guide\n'
        '- greeley co home value\n'
    ),
}).encode()

req = urllib.request.Request(
    'https://api.github.com/repos/adamsch0100/saahomes/pulls',
    data=pr_data, headers=headers
)

try:
    resp = urllib.request.urlopen(req, timeout=15)
    pr = json.loads(resp.read())
    pr_num = pr['number']
    pr_url = pr['html_url']
    print(f'PR created: #{pr_num} - {pr_url}')
    
    # Merge immediately with PUT
    merge_data = json.dumps({
        'commit_title': 'content: add Greeley seller guide blog post targeting sell my home greeley queries',
        'merge_method': 'squash',
    }).encode()
    
    req2 = urllib.request.Request(
        f'https://api.github.com/repos/adamsch0100/saahomes/pulls/{pr_num}/merge',
        data=merge_data, headers=headers,
        method='PUT'
    )
    
    merge_resp = json.loads(urllib.request.urlopen(req2, timeout=15).read())
    if merge_resp.get('merged'):
        print(f'MERGED: SHA {merge_resp.get("sha", "?")}')
        print(f'Message: {merge_resp.get("message", "")}')
        print(f'PR url: {pr_url}')
    else:
        print(f'Merge response: {json.dumps(merge_resp, indent=2)}')
        
except urllib.error.HTTPError as e:
    body = e.read().decode()
    print(f'HTTP {e.code}: {body[:600]}')
except Exception as e:
    print(f'Error: {e}')
