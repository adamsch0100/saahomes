#!/usr/bin/env python3
import json, urllib.request, urllib.error, os, subprocess, sys

# Get GITHUB_TOKEN from env
token = os.environ.get('GITHUB_TOKEN', '')
if not token:
    print("GITHUB_TOKEN not found", file=sys.stderr)
    sys.exit(1)

# Get remote branches
result = subprocess.run(
    ['git', 'branch', '-r'],
    capture_output=True, text=True, cwd='/opt/data/workspace/saahomes-repo'
)
branches = []
for line in result.stdout.split('\n'):
    line = line.strip()
    if 'hermes/seo' in line and 'origin/HEAD' not in line:
        branch = line.replace('origin/', '', 1)
        branches.append(branch)

headers = {
    'Authorization': f'token {token}',
    'Accept': 'application/vnd.github.v3+json'
}

for branch in sorted(set(branches)):
    try:
        url = f'https://api.github.com/repos/adamsch0100/saahomes/compare/main...{branch}'
        req = urllib.request.Request(url, headers=headers)
        comp = json.loads(urllib.request.urlopen(req, timeout=15).read())
        ahead = comp.get('ahead_by', 0)
        behind = comp.get('behind_by', 0)
        status = comp.get('status', '?')
        if ahead > 0:
            print(f'🆕 AHEAD {ahead} behind {behind} | {branch}')
        else:
            print(f'✅ MERGED (behind {behind}) | {branch}')
    except urllib.error.HTTPError as e:
        print(f'⚠️  HTTP {e.code} | {branch}')
        if e.code == 404:
            # Check if branch exists at all via git/refs
            try:
                url2 = f'https://api.github.com/repos/adamsch0100/saahomes/git/refs/heads/{branch}'
                req2 = urllib.request.Request(url2, headers=headers)
                ref = json.loads(urllib.request.urlopen(req2, timeout=10).read())
                print(f'   Branch exists (ref: {ref.get("object",{}).get("sha","?")[:8]})')
            except:
                print(f'   Branch may have been deleted from remote')
    except Exception as e:
        print(f'❌ ERROR {branch}: {e}')
