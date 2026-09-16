#!/usr/bin/env python3
"""Create a PR via GitHub API (urllib — avoids curl shell quoting bugs).

Usage: python3 scripts/create_pr.py <branch> <title> [body]

Reads GITHUB_TOKEN from the environment (source the .env file first).
"""
import json
import os
import sys
import urllib.request
import urllib.error

TOKEN = os.environ.get('GITHUB_TOKEN')
if not TOKEN:
    sys.exit('GITHUB_TOKEN not set')

owner, repo = 'adamsch0100', 'saahomes'
branch = sys.argv[1]
title = sys.argv[2]
body = sys.argv[3] if len(sys.argv) > 3 else ''

payload = json.dumps({
    'title': title,
    'head': branch,
    'base': 'main',
    'body': body,
}).encode()

req = urllib.request.Request(
    f'https://api.github.com/repos/{owner}/{repo}/pulls',
    data=payload,
    headers={
        'Authorization': f'token {TOKEN}',
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
    },
    method='POST',
)
try:
    resp = json.loads(urllib.request.urlopen(req, timeout=30).read())
    print(json.dumps({'number': resp.get('number'), 'url': resp.get('html_url'),
                      'head_ref': resp.get('head', {}).get('ref'),
                      'state': resp.get('state')}, indent=2))
except urllib.error.HTTPError as e:
    print(f'HTTP {e.code}: {e.read().decode("utf-8")}')
    sys.exit(1)