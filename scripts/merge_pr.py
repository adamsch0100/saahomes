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
pr_number = sys.argv[1] if len(sys.argv) > 1 else "11"

merge_data = {
    "commit_title": "Internal link architecture: strengthen link equity flow to money pages and area pages",
    "commit_message": "Blog posts now link to 2+ area pages + 1 money page. Area pages cross-link to nearby communities.",
    "merge_method": "squash"
}

data = json.dumps(merge_data).encode('utf-8')

# Use PUT as per skill documentation (POST returns 404)
req = urllib.request.Request(
    f"https://api.github.com/repos/{owner}/{repo}/pulls/{pr_number}/merge",
    data=data,
    method='PUT',
    headers={
        "Authorization": f"token {token}",
        "Accept": "application/vnd.github.v3+json",
        "Content-Type": "application/json",
    }
)

try:
    resp = urllib.request.urlopen(req, timeout=30)
    result = json.loads(resp.read().decode('utf-8'))
    print(f"Merge result: {result.get('message', 'unknown')}")
    print(f"Merged: {result.get('merged', False)}")
except urllib.error.HTTPError as e:
    error_body = e.read().decode('utf-8')
    print(f"HTTP {e.code}: {error_body}")
    sys.exit(1)
