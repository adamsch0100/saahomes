#!/usr/bin/env python3
"""Delete the GBP post that published with the black default image and
recreate it with the real branded hero, scheduled for tomorrow morning."""
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

OLD_GBP_POST = "6a736272739261512b3307d0"
GBP_CHANNEL = "6a662faf4b2d03035f44203f"
IMG = "https://saahomes.com/images/buyer-concession-cheat-sheet-northern-colorado.jpg"
LINK = "https://saahomes.com/blog/buyer-concession-cheat-sheet-northern-colorado/"
DUE = "2026-08-06T14:00:00.000Z"  # tomorrow 8:00 AM MT

CAPTION = (
    "Northern Colorado's market is shifting — and it's buyer-friendly. 🏡\n\n"
    "With more inventory and steady rates, sellers are offering concessions again: "
    "covering closing costs, rate buydowns, and more.\n\n"
    "Our new Buyer Concession Cheat Sheet breaks down exactly how much sellers can "
    "contribute by loan type (conventional, FHA, VA), how to ask for closing-cost help, "
    "and how to stack concessions with CHFA down payment assistance in Fort Collins, "
    "Loveland, Windsor, and Greeley.\n\n"
    "Learn more at the link below."
)

# 1. Delete the published black-image post
del_q = """mutation($input: DeletePostInput!) {
  deletePost(input: $input) { ... on DeletePostSuccess { id } ... on MutationError { message } }
}"""
res = graphql(del_q, {"input": {"id": OLD_GBP_POST}})
d = res.get("data", {}).get("deletePost", {})
print("DELETE:", d if d else res.get("errors"))

# 2. Recreate with real image, scheduled for tomorrow 8 AM MT
create_q = """mutation($input: CreatePostInput!) {
  createPost(input: $input) {
    ... on PostActionSuccess { post { id status dueAt } }
    ... on MutationError { message }
  }
}"""
res2 = graphql(create_q, {"input": {
    "channelId": GBP_CHANNEL,
    "text": CAPTION,
    "mode": "customScheduled",
    "dueAt": DUE,
    "schedulingType": "automatic",
    "assets": [{"image": {"url": IMG}}],
    "metadata": {"google": {"type": "whats_new", "detailsWhatsNew": {"button": "learn_more", "link": LINK}}},
}})
r = res2.get("data", {}).get("createPost", {})
if "post" in r:
    p = r["post"]
    print(f"REPOSTED: id={p['id']} status={p['status']} due={p['dueAt']}")
    print(f"IMAGE: {IMG}")
else:
    print("REPOST FAIL:", r.get("message") or res2.get("errors"))
