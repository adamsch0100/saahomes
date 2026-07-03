import os, json, urllib.request, ssl

key = os.environ.get('SERPER_API_KEY', '')
ctx = ssl.create_default_context()

queries = [
    "northern colorado housing market june 2026",
    "fort collins home prices june 2026",
    "loveland colorado real estate market 2026",
    "windsor colorado housing market 2026",
    "greeley colorado real estate trends 2026",
]

for q in queries:
    data = json.dumps({"q": q, "num": 3, "gl": "us"}).encode()
    req = urllib.request.Request(
        "https://google.serper.dev/search",
        data=data,
        headers={"X-API-KEY": key, "Content-Type": "application/json"}
    )
    try:
        resp = urllib.request.urlopen(req, timeout=15, context=ctx)
        result = json.loads(resp.read())
        print(f"\n=== {q} ===")
        for item in result.get('organic', []):
            print(f"  [{item.get('position')}] {item.get('title')}")
            print(f"  {item.get('snippet', '')[:300]}")
            print(f"  {item.get('link')}")
    except Exception as e:
        print(f"Error for {q}: {e}")
