#!/usr/bin/env python3
"""Query Buffer GraphQL: queued posts with dueAt per channel."""
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

# Get org id
res = graphql("query { account { organizations { id name } } }")
orgs = res.get("data", {}).get("account", {}).get("organizations", [])
print("Orgs:", orgs)
if not orgs:
    sys.exit(1)
org_id = orgs[0]["id"]

q = """
query($input: PostsInput!, $first: Int!) {
  posts(first: $first, input: $input) {
    edges { node {
      id status dueAt schedulingType channelId channelService createdAt
      text
    } }
  }
}
"""
res = graphql(q, {"input": {"organizationId": org_id}, "first": 30})
if "errors" in res:
    print("API ERR:", json.dumps(res["errors"])[:400]); sys.exit(1)
edges = res.get("data", {}).get("posts", {}).get("edges", [])
print(f"\n== {len(edges)} posts ==")
for e in edges:
    n = e.get("node", {})
    text = (n.get("text") or "").replace("\n", " ")[:55]
    print(f"id={n.get('id')} svc={n.get('channelService')} status={n.get('status')} sched={n.get('schedulingType')} due={n.get('dueAt')} | {text}")
