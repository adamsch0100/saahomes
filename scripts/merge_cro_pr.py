import urllib.request
import json
import os

token = os.environ.get('GITHUB_TOKEN', '')
if not token:
    print('GITHUB_TOKEN not found')
    exit(1)

owner = 'adamsch0100'
repo = 'saahomes'
pr_num = 3

merge_data = json.dumps({
    'commit_title': 'CRO surge: hero CTAs, brand-consistent buttons, phone visibility',
    'merge_method': 'merge'
}).encode()

req = urllib.request.Request(
    f'https://api.github.com/repos/{owner}/{repo}/pulls/{pr_num}/merge',
    data=merge_data,
    headers={
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github.v3+json',
    },
    method='PUT'
)

try:
    resp = urllib.request.urlopen(req)
    result = json.loads(resp.read())
    print(f'Merge result: {json.dumps(result, indent=2)}')
except urllib.error.HTTPError as e:
    error_body = e.read().decode()
    print(f'Error {e.code}: {error_body}')
