#!/usr/bin/env python3
"""SERP gap analysis for 3 Tier S queries."""
import os, json, urllib.request, ssl

key = os.environ.get('SERPER_API_KEY', '')
ctx = ssl.create_default_context()

queries = [
    "fort collins realtor",
    "loveland homes for sale",
    "windsor colorado homes for sale",
]

for q in queries:
    data = json.dumps({"q": q, "num": 5, "gl": "us"}).encode()
    req = urllib.request.Request(
        "https://google.serper.dev/search",
        data=data,
        headers={"X-API-KEY": key, "Content-Type": "application/json"}
    )
    try:
        resp = urllib.request.urlopen(req, timeout=15, context=ctx)
        result = json.loads(resp.read())
        print(f"\n=== {q} ===")
        for item in result.get("organic", []):
            print(f"  #{item.get('position')}: {item.get('title')}")
            print(f"  URL: {item.get('link')}")
            print(f"  Snippet: {item.get('snippet', '')[:250]}")
            print()
        saahomes_found = any("saahomes.com" in (item.get("link") or "") for item in result.get("organic", []))
        print(f"  SAA Homes on page: {saahomes_found}")
        # Check PAA questions
        if "peopleAlsoAsk" in result:
            print(f"  People Also Ask:")
            for qa in result["peopleAlsoAsk"]:
                print(f"    - {qa['question']}")
        print()
    except Exception as e:
        print(f"Error for {q}: {e}")
        print()
