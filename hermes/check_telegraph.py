#!/usr/bin/env python3
"""Quick check: Telegraph API token validity."""
import json, urllib.request

TOKEN = "a1058edfc9bc701ba31df73ad2f8c07af8a365054056d8ceafda01748e87"
req = urllib.request.Request(
    "https://api.telegra.ph/getAccountInfo",
    data=json.dumps({"access_token": TOKEN}).encode(),
    headers={"Content-Type": "application/json", "User-Agent": "Mozilla/5.0"},
    method="POST",
)
try:
    with urllib.request.urlopen(req, timeout=30) as r:
        print("TELEGRAPH:", r.status, json.loads(r.read().decode()))
except Exception as e:
    print("TELEGRAPH ERR:", e)