#!/usr/bin/env python3
"""Query Serper API for multiple search queries and output structured results."""
import json
import os
import urllib.request
import urllib.error

QUERIES = [
    "fort collins realtor",
    "loveland homes for sale",
    "windsor real estate"
]

api_key = os.environ.get('SERPER_API_KEY')
if not api_key:
    print("ERROR: SERPER_API_KEY not set")
    exit(1)

for query in QUERIES:
    print(f"\n{'='*80}")
    print(f"QUERY: {query}")
    print(f"{'='*80}")
    
    data = json.dumps({"q": query, "num": 10}).encode()
    req = urllib.request.Request(
        "https://google.serper.dev/search",
        data=data,
        headers={
            "X-API-KEY": api_key,
            "Content-Type": "application/json"
        }
    )
    
    try:
        result = json.loads(urllib.request.urlopen(req, timeout=15).read())
    except urllib.error.HTTPError as e:
        print(f"  HTTP Error {e.code}: {e.read().decode()}")
        continue
    except Exception as e:
        print(f"  Error: {e}")
        continue
    
    print(f"\n  Top 10 results:")
    for r in result.get('organic', []):
        pos = r.get('position', '?')
        title = r.get('title', '')
        url = r.get('link', '')
        snippet = r.get('snippet', '')[:150]
        print(f"\n  #{pos}: {title}")
        print(f"  URL: {url}")
        print(f"  Snippet: {snippet}")
    
    # Check if saahomes.com is on the page
    saahomes_present = any('saahomes.com' in r.get('link', '') for r in result.get('organic', []))
    print(f"\n  ---> saahomes.com on page: {'YES' if saahomes_present else 'NO'}")
    
    # Check for features
    if 'peopleAlsoAsk' in result:
        print(f"\n  People Also Ask ({len(result['peopleAlsoAsk'])} questions):")
        for qa in result['peopleAlsoAsk'][:5]:
            print(f"  • {qa['question']}")
    
    # Knowledge graph
    if 'knowledgeGraph' in result:
        kg = result['knowledgeGraph']
        print(f"\n  Knowledge Graph: {kg.get('title', '')} - {kg.get('type', '')}")
    
    print()
