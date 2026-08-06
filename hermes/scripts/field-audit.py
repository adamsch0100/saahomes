#!/usr/bin/env python3
"""Rate-limit-aware MLS Grid $select validation: remove invalid fields one at a time."""
import json
import time
import urllib.error
import urllib.request

TOK = None
for line in open("/opt/data/workspace/saahomes-repo/.env"):
    line = line.strip()
    if line.startswith("IRES_ACCESS_TOKEN="):
        TOK = line.split("=", 1)[1].strip().strip('"').strip("'")
        break

# Pull the exact field list from iresSync.js so the audit always matches the sync
import re as _re
_src = open("/opt/data/workspace/saahomes-repo/backend/src/services/iresSync.js").read()
_m = _re.search(r"const MLS_FIELDS = \[(.*?)\];", _src, _re.S)
FIELDS = _re.findall(r"'([^']+)'", _m.group(1)) if _m else []
print(f"auditing {len(FIELDS)} fields from iresSync.js")


def fetch(sel):
    url = f"https://api.mlsgrid.com/v2/Property?$top=1&$select={','.join(sel)}"
    req = urllib.request.Request(url, headers={
        "Authorization": f"Bearer {TOK}", "Accept": "application/json",
        "Accept-Encoding": "gzip", "User-Agent": "saahomes-idx/1.0",
    })
    with urllib.request.urlopen(req, timeout=15) as r:
        return json.loads(r.read().decode())


def invalid_from_error(e):
    """Parse the invalid $select field(s) out of an HTTP 400 body."""
    try:
        body = json.loads(e.read().decode())
        bad = []
        for x in body.get("error", {}).get("details") or []:
            msg = x.get("message", "")
            if "'" in msg:
                bad.append(msg.split("'")[1])
        return bad
    except Exception:
        return []


remaining = list(FIELDS)
removed = []
for attempt in range(15):
    try:
        d = fetch(remaining)
    except urllib.error.HTTPError as e:
        bad = invalid_from_error(e)
        if not bad:
            print(f"attempt {attempt + 1}: HTTP {e.code}, unparseable body — stopping")
            break
        for b in bad:
            if b in remaining:
                remaining.remove(b)
                removed.append(b)
        print(f"removed: {bad}")
        time.sleep(1.5)
        continue
    except Exception as e:
        print(f"attempt {attempt + 1}: fetch error {e} — sleeping 15s")
        time.sleep(15)
        continue
    break

print("\nVALID FIELDS (%d):" % len(remaining))
print(", ".join(remaining))
if removed:
    print("\nREMOVED INVALID (%d): %s" % (len(removed), ", ".join(removed)))

# sample values
try:
    d = fetch(remaining)
    v = d.get("value", [{}])[0]
    print("\nSAMPLE (schools/features):")
    for k in ["ListingKey", "ElementarySchool", "MiddleOrJuniorSchool", "HighSchool",
              "DaysOnMarket", "ArchitecturalStyle", "Basement", "FireplacesTotal",
              "GarageYN", "ParkingFeatures", "PoolYN", "View", "WaterfrontYN",
              "CoolingYN", "HeatingYN", "SubdivisionName", "TaxAnnualAmount",
              "NewConstructionYN", "ShowingInstructions"]:
        if k in v:
            print(f"  {k}: {str(v[k])[:60]}")
except Exception as e:
    print("sample fetch error:", e)
