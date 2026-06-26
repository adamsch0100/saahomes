import urllib.request, json, subprocess

# Get token via subprocess
result = subprocess.run(['bash', '-c', 'source /opt/data/.env 2>/dev/null; echo $GITHUB_TOKEN'], capture_output=True, text=True)
token = result.stdout.strip()

headers = {
    'Authorization': f'token {token}',
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'hermes'
}

# Check PR #2
req = urllib.request.Request('https://api.github.com/repos/adamsch0100/saahomes/pulls/2', headers=headers)
pr = json.loads(urllib.request.urlopen(req).read())
print(f"PR #2 state: {pr.get('state')}")
print(f"Merged: {pr.get('merged')}")
print(f"Merge commit SHA: {pr.get('merge_commit_sha')}")
print(f"Head SHA: {pr['head']['sha']}")
print(f"Base SHA: {pr['base']['sha']}")

# Check merge commit
mc = pr.get('merge_commit_sha')
if mc:
    req2 = urllib.request.Request(f'https://api.github.com/repos/adamsch0100/saahomes/git/commits/{mc}', headers=headers)
    try:
        mc_data = json.loads(urllib.request.urlopen(req2).read())
        print(f"Merge commit exists: YES - {mc_data.get('message', '')[:80]}")
    except Exception as e:
        print(f"Merge commit NOT found: {e}")

# Check latest commits on main
req3 = urllib.request.Request('https://api.github.com/repos/adamsch0100/saahomes/commits?per_page=5', headers=headers)
commits = json.loads(urllib.request.urlopen(req3).read())
print(f"\nLatest commits on main:")
for c in commits:
    print(f"  {c['sha'][:8]}: {c['commit']['message'][:70]}")
