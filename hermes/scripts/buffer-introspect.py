#!/usr/bin/env python3
"""Introspect Buffer mutations: deletePost, editPost, createPost inputs."""
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

def graphql(query):
    req = Request(API_URL, data=json.dumps({"query": query}).encode(), method="POST")
    req.add_header("Authorization", f"Bearer {token}")
    req.add_header("Content-Type", "application/json")
    with urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode())

q = """
{
  __schema {
    mutationType { fields { name args { name type { name kind ofType { name kind ofType { name } } } } } }
    types {
      ... on __Type {
        name
        inputFields { name type { name kind ofType { name kind ofType { name } } } }
      }
    }
  }
}
"""
res = graphql(q)
schema = res["data"]["__schema"]
print("== MUTATIONS ==")
for f in schema["mutationType"]["fields"]:
    if any(k in f["name"].lower() for k in ("post", "delete", "edit", "update")):
        args = ", ".join(f"{a['name']}:{a['type'].get('name') or (a['type'].get('ofType') or {}).get('name')}" for a in f.get("args", []))
        print(f"  {f['name']}({args})")

print("\n== INPUT TYPES ==")
for t in schema["types"]:
    name = t.get("name") or ""
    if name in ("DeletePostInput", "EditPostInput", "CreatePostInput", "PostAssetInput", "ImageAssetInput"):
        fields = t.get("inputFields") or []
        print(f"  {name}:")
        for f in fields:
            tp = f["type"]
            tn = tp.get("name") or (tp.get("ofType") or {}).get("name") or ""
            print(f"    {f['name']}: {tn}")
