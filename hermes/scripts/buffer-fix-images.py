#!/usr/bin/env python3
"""Swap the real buyer-concession hero image into scheduled Buffer posts.
editPost requires schedulingType — pass automatic + customScheduled with the
existing dueAt so the scheduled time is preserved exactly."""
import json, sys
from pathlib import Path
from urllib.request import Request, urlopen

API_URL = "https://api.buffer.com/graphql"
env_path = Path("/opt/data/workspace/saahomes-repo/.env")
token = None
for line in env_path.read_text().splitlines():
    line = line.strip()
    if line.startswith("BUFFER_API_KEY="):
        token = line.split("=", 1)[1].strip().strip('"').strip("'").replace(" ", "")
        break
if not token:
    print("NO TOKEN"); sys.exit(1)

def graphql(query, variables=None):
    req = Request(API_URL, data=json.dumps({"query": query, "variables": variables or {}}).encode(), method="POST")
    req.add_header("Authorization", f"Bearer {token}")
    req.add_header("Content-Type", "application/json")
    with urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode())

NEW_IMG = "https://saahomes.com/images/buyer-concession-cheat-sheet-northern-colorado.jpg"
TARGETS = [
    # (label, post_id, due_at)
    ("Facebook", "6a736273b92f0ee1d1f52591", "2026-08-06T14:07:00.000Z"),
]

edit_q = """
mutation($input: EditPostInput!) {
  editPost(input: $input) {
    ... on PostActionSuccess {
      post { id status dueAt text assets { ... on ImageAsset { source thumbnail } } }
    }
    ... on MutationError { message }
  }
}
"""

for label, pid, due in TARGETS:
    res = graphql(edit_q, {"input": {
        "id": pid,
        "assets": [{"image": {"url": NEW_IMG}}],
        "schedulingType": "automatic",
        "mode": "customScheduled",
        "dueAt": due,
        "metadata": {"facebook": {"type": "post"}},
    }})
    r = res.get("data", {}).get("editPost", {})
    if "post" in r:
        p = r["post"]
        assets = p.get("assets") or []
        urls = [a.get("image", {}).get("url") for a in assets if isinstance(a, dict)]
        print(f"{label}: OK id={p['id']} status={p['status']} due={p['dueAt']} img={urls}")
    else:
        err = r.get("message") or json.dumps(res.get("errors", ""))[:300]
        print(f"{label}: FAIL {err}")
