#!/usr/bin/env python3
"""Neighborhood name-integrity screen.

Checks every entry in src/data/neighborhoods.js against authoritative subdivision
records so invented ("composite") neighborhood names cannot be published silently:

  1. Weld County Assessor subdivision plats, queried inside each town's official
     city-limits polygon (City Limits as of May 2 2025 layer).
  2. Larimer County Assessor Subdivisions layer, by MUNICIPALITY.
  3. Structural completeness (longDescription, walkScore).

Names that match neither a plat nor a known neighborhood designation (downtown /
old town / midtown / "<X> Area" / historic wording) are reported as UNVERIFIED for
review — never edited automatically. This is a screen, not a gate: county layers
occasionally miss real plats, so confirm against the county property portal or the
town's own plans before changing content.

Usage:
    python3 scripts/neighborhood-name-integrity.py
    python3 scripts/neighborhood-name-integrity.py --no-network     # structure only
    python3 scripts/neighborhood-name-integrity.py --json reports/x.json
    python3 scripts/neighborhood-name-integrity.py --refresh-cache

Cache: reports/neighborhood-plat-cache.json
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import urllib.parse
import urllib.request
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
NEIGHBORHOODS = REPO / "src/data/neighborhoods.js"
CACHE = REPO / "reports/neighborhood-plat-cache.json"
UA = {"User-Agent": "saahomes-neighborhood-integrity/1.0"}

WELD_LIMITS = ("https://services.arcgis.com/ewjSqmSyHJnkfBLL/arcgis/rest/services/"
               "City_Limits_as_of_May_2_2025/FeatureServer/0/query")
WELD_SUB = ("https://services.arcgis.com/ewjSqmSyHJnkfBLL/arcgis/rest/services/"
            "Subdivisions_open_data/FeatureServer/30/query")
LARIMER_SUB = "https://maps1.larimer.org/arcgis/rest/services/MapServices/Parcels/MapServer/1/query"

CITY_SOURCE = {
    "la-salle": ("weld", "LA SALLE"), "eaton": ("weld", "EATON"),
    "severance": ("weld", "SEVERANCE"), "milliken": ("weld", "MILLIKEN"),
    "mead": ("weld", "MEAD"), "evans": ("weld", "EVANS"),
    "firestone": ("weld", "FIRESTONE"), "frederick": ("weld", "FREDERICK"),
    "johnstown": ("weld", "JOHNSTOWN"), "windsor": ("weld", "WINDSOR"),
    "timnath": ("weld", "TIMNATH"), "fort-lupton": ("weld", "FORT LUPTON"),
    "greeley": ("weld", "GREELEY"), "carbon-valley": ("weld", "DACONO"),
    "brighton": ("weld", "BRIGHTON"), "berthoud": ("larimer", "BERTHOUD"),
    "wellington": ("larimer", "WELLINGTON"), "fort-collins": ("larimer", "FORT COLLINS"),
    "loveland": ("larimer", "LOVELAND"), "estes-park": ("larimer", "ESTES PARK"),
}

STOP = {"at", "the", "of", "and", "add", "addition", "additions", "fg", "sub", "pud",
        "rplt", "no", "minor", "plat", "corr", "amd", "revised", "first", "second",
        "third", "fourth", "fifth", "sixth", "town", "townsite", "estate", "estates",
        "park", "place", "village", "heights", "hills", "meadows", "ridge", "crossing",
        "greens", "green", "farm", "farms", "ranch"}

DESIGNATION = re.compile(
    r"\b(downtown|old town|midtown|historic|university|area|district|proper|"
    r"airpark|csu|corridor|valley|lake area)\b", re.I)


def fetch(url: str, params: dict, tries: int = 3, timeout: int = 90):
    data = urllib.parse.urlencode(params).encode()
    last = None
    for _ in range(tries):
        try:
            req = urllib.request.Request(url, data=data, headers=UA)
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return json.loads(resp.read().decode("utf-8", "replace"))
        except Exception as exc:  # noqa: BLE001
            last = exc
    raise last  # type: ignore[misc]


def build_cache() -> dict:
    out: dict = {"weld": {}, "larimer": {}}
    print("Fetching Weld city-limits subdivisions...", file=sys.stderr)
    towns = fetch(WELD_LIMITS, {"where": "1=1", "outFields": "TOWNNAME",
                                "returnGeometry": "false", "returnDistinctValues": "true",
                                "f": "json", "resultRecordCount": 200})
    names = sorted({(f["attributes"].get("TOWNNAME") or "").strip()
                    for f in towns.get("features", []) if f["attributes"].get("TOWNNAME")})
    for town in names:
        try:
            geo = fetch(WELD_LIMITS, {"where": f"TOWNNAME = '{town}'", "outFields": "TOWNNAME",
                                      "returnGeometry": "true", "outSR": "4326",
                                      "maxAllowableOffset": "0.0005", "f": "json"})
            feats = geo.get("features", [])
            if not feats:
                continue
            d = fetch(WELD_SUB, {"where": "1=1", "geometry": json.dumps(feats[0]["geometry"]),
                                 "geometryType": "esriGeometryPolygon", "inSR": "4326",
                                 "spatialRel": "esriSpatialRelIntersects",
                                 "outFields": "SUBNAME,COMMONNAME", "returnGeometry": "false",
                                 "f": "json", "resultRecordCount": 8000})
            out["weld"][town] = sorted({((f["attributes"].get("SUBNAME") or
                                          f["attributes"].get("COMMONNAME")) or "").strip()
                                        for f in d.get("features", [])
                                        if (f["attributes"].get("SUBNAME") or
                                            f["attributes"].get("COMMONNAME"))})
        except Exception as exc:  # noqa: BLE001
            print(f"  ! weld {town}: {exc}", file=sys.stderr)
    print("Fetching Larimer subdivisions...", file=sys.stderr)
    for town in ["FORT COLLINS", "LOVELAND", "BERTHOUD", "WELLINGTON", "TIMNATH",
                 "ESTES PARK", "JOHNSTOWN", "WINDSOR", "ERIE", "LONGMONT", "LARIMER COUNTY"]:
        try:
            d = fetch(LARIMER_SUB, {"where": f"MUNICIPALITY = '{town}'", "outFields": "SUBNAME",
                                    "returnGeometry": "false", "f": "json",
                                    "resultRecordCount": 6000})
            out["larimer"][town] = sorted({(f["attributes"].get("SUBNAME") or "").strip()
                                           for f in d.get("features", [])
                                           if f["attributes"].get("SUBNAME")})
        except Exception as exc:  # noqa: BLE001
            print(f"  ! larimer {town}: {exc}", file=sys.stderr)
    CACHE.parent.mkdir(parents=True, exist_ok=True)
    CACHE.write_text(json.dumps(out, indent=2))
    return out


def load_cache(refresh: bool) -> dict:
    if not refresh and CACHE.exists():
        try:
            return json.loads(CACHE.read_text())
        except Exception:  # noqa: BLE001
            pass
    return build_cache()


def parse_entries(text: str) -> list:
    """Depth-based parse: robust to any entry formatting/terminator shape."""
    entries, lines = [], text.splitlines(keepends=True)
    in_array, i = False, 0
    strip_str = re.compile(r"'(?:\\.|[^'\\])*'")
    while i < len(lines):
        line = lines[i]
        if line.startswith("export const neighborhoods = ["):
            in_array = True
            i += 1
            continue
        if in_array and line.rstrip("\n") == "]":
            break
        if in_array and line.strip() == "{":
            body, j = [], i + 1
            while j < len(lines) and not lines[j].startswith("  }"):
                body.append(lines[j])
                j += 1
            blob = "".join(body)

            def field(key: str, blob: str = blob) -> str:
                m = re.search(rf"{key}: '((?:[^'\\]|\\.)*)'", blob)
                return m.group(1).replace("\\'", "'") if m else ""

            entries.append({
                "slug": field("slug"), "citySlug": field("citySlug"),
                "cityDisplay": field("cityDisplay"), "name": field("name"),
                "has_long": "longDescription:" in blob,
                "has_walk": "walkScore:" in blob,
            })
            i = j + 1
            continue
        i += 1
    return entries


def tokens(value: str) -> list:
    value = re.sub(r"[^a-z0-9 ]", " ", value.lower())
    return [t for t in value.split() if t and t not in STOP and not t.isdigit()]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--no-network", action="store_true")
    ap.add_argument("--refresh-cache", action="store_true")
    ap.add_argument("--json")
    args = ap.parse_args()

    entries = parse_entries(NEIGHBORHOODS.read_text())
    if not entries:
        print("No entries parsed — check file structure.", file=sys.stderr)
        return 2
    print(f"Entries: {len(entries)}")

    structural = [e for e in entries if not (e["has_long"] and e["has_walk"])]
    print(f"\n-- Structural gaps (no longDescription and/or walkScore): {len(structural)}")
    for e in structural[:40]:
        missing = ", ".join(k for k, ok in (("longDescription", e["has_long"]),
                                            ("walkScore", e["has_walk"])) if not ok)
        print(f"   {e['citySlug']:16s} {e['slug']:34s} missing {missing}")
    if len(structural) > 40:
        print(f"   ... and {len(structural) - 40} more")

    unverified = []
    if not args.no_network:
        cache = load_cache(args.refresh_cache)
        for e in entries:
            src_key = CITY_SOURCE.get(e["citySlug"])
            if not src_key:
                continue
            plats = cache.get(src_key[0], {}).get(src_key[1], [])
            if not plats:
                continue
            city_words = set(tokens(e["cityDisplay"]))
            name_tokens = [t for t in tokens(e["name"]) if t not in city_words] or tokens(e["name"])
            best = 0.0
            for plat in plats:
                ptoks = set(tokens(plat)) - city_words
                if not ptoks:
                    continue
                overlap = set(name_tokens) & ptoks
                if overlap and max(name_tokens, key=len) in ptoks:
                    best = max(best, len(overlap) / len(set(name_tokens)))
            if best >= 0.6 or DESIGNATION.search(e["name"]):
                continue
            unverified.append({"slug": e["slug"], "citySlug": e["citySlug"],
                               "name": e["name"], "best_plat_score": round(best, 2)})
        print(f"\n-- Names with no plat match in county records: {len(unverified)}")
        per_city: dict = {}
        for u in unverified:
            per_city[u["citySlug"]] = per_city.get(u["citySlug"], 0) + 1
        for city, count in sorted(per_city.items(), key=lambda kv: -kv[1]):
            print(f"   {city:18s} {count}")
        print("   Review each against the county property portal — some are real plats")
        print("   missing from county layers, others are genuine neighborhood names.")

    payload = {"entries": len(entries), "structural_gaps": structural,
               "unverified_names": unverified}
    if args.json:
        Path(args.json).write_text(json.dumps(payload, indent=2))
        print(f"\nSaved {args.json}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
