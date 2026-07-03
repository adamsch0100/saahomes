#!/usr/bin/env python3
"""Check whether branch content is already on main despite squash-merge SHA mismatch."""
import json, urllib.request, urllib.error, os, subprocess, sys

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
        branch = line.replace('origin/', '', 1).strip()
        if branch:
            branches.append(branch)

headers = {
    'Authorization': f'token {token}',
    'Accept': 'application/vnd.github.v3+json'
}

# Get the list of files changed in each branch vs main
for branch in sorted(set(branches)):
    try:
        # Compare to see actual content diff
        url = f'https://api.github.com/repos/adamsch0100/saahomes/compare/main...{branch}'
        req = urllib.request.Request(url, headers=headers)
        comp = json.loads(urllib.request.urlopen(req, timeout=15).read())
        ahead = comp.get('ahead_by', 0)
        behind = comp.get('behind_by', 0)
        status = comp.get('status', '?')
        
        if ahead == 0:
            print(f'✅ MERGED (behind {behind}): {branch}')
            continue
            
        # Check files changed
        files = comp.get('files', [])
        # Look at the commits that only exist on the branch
        commits = comp.get('commits', [])
        branch_commits = [c for c in commits if c.get('sha', '') != '']
        
        print(f'📂 AHEAD {ahead} behind {behind} | {branch}')
        for c in branch_commits:
            msg = c['commit']['message'].split('\n')[0][:100]
            print(f'   Commit: {c["sha"][:8]} {msg}')
        for f in files[:5]:
            print(f'   File: {f.get("status","?")} {f.get("filename","")}')
        if len(files) > 5:
            print(f'   ... and {len(files)-5} more files')
            
    except urllib.error.HTTPError as e:
        if e.code == 404:
            print(f'⚠️  GONE (404): {branch}')
        else:
            print(f'⚠️  HTTP {e.code}: {branch}')
    except Exception as e:
        print(f'❌ ERROR {branch}: {e}')
