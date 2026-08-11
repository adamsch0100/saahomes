"""Diagnose why portal actives << Matrix actives under exact criteria."""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

import pandas as pd
from scipy.spatial import ConvexHull

sys.stdout.reconfigure(encoding="utf-8")

from core import load_export
from portal_market import (
    build_portal_market,
    fetch_realtor_actives,
    point_in_ring,
    reef_call,
)

ROOT = Path(__file__).resolve().parent
EXPORT = ROOT / "data" / "export-71-criteria.txt"


def norm_addr(a: str) -> str:
    a = (a or "").upper().strip()
    a = re.sub(r"[.,#]", " ", a)
    a = re.sub(r"\s+", " ", a)
    reps = {
        " STREET": " ST", " AVENUE": " AVE", " COURT": " CT", " DRIVE": " DR",
        " LANE": " LN", " ROAD": " RD", " PLACE": " PL", " CIRCLE": " CIR",
        " WEST ": " W ", " EAST ": " E ", " NORTH ": " N ", " SOUTH ": " S ",
    }
    for k, v in reps.items():
        a = a.replace(k, v)
    a = re.sub(r"\b(GREELEY|CO|COLORADO|80634|80631)\b", " ", a)
    a = re.sub(r"\bUNIT\s*\w+\b", " ", a)
    a = re.sub(r"\s+", " ", a).strip()
    return a


def main() -> None:
    matrix = load_export(str(EXPORT))
    pad = 0.0015
    bounds = {
        "west": float(matrix["Longitude"].min()) - pad,
        "east": float(matrix["Longitude"].max()) + pad,
        "south": float(matrix["Latitude"].min()) - pad,
        "north": float(matrix["Latitude"].max()) + pad,
    }
    pts = matrix[["Longitude", "Latitude"]].drop_duplicates().values
    hull = ConvexHull(pts)
    ring = pts[hull.vertices].tolist()
    ring.append(ring[0])

    actives = matrix[matrix["StatusNorm"] == "Active"].copy()
    print(f"Matrix actives: {len(actives)}")
    print(f"bounds: {bounds}")

    # Stage funnel: how many Realtor for_sale survive each filter layer
    print("\n=== FUNNEL: Realtor for_sale raw → filters ===")
    stages = [
        ("A bbox only, house, no other filters", dict(home_type="single_family")),
        ("B + price 300-450k", dict(home_type="single_family", price_min=300000, price_max=450000)),
        ("C + beds3 baths2", dict(home_type="single_family", price_min=300000, price_max=450000, beds_min=3, baths_min=2)),
        ("D + sqft 1700-2900", dict(home_type="single_family", price_min=300000, price_max=450000, beds_min=3, baths_min=2, sqft_min=1700, sqft_max=2900)),
    ]
    for label, extra in stages:
        all_items = []
        for offset in range(0, 600, 200):
            params = {
                "location": "Greeley, CO",
                "status": "for_sale",
                "sort": "newest",
                "limit": 200,
                "offset": offset,
                "map_bounds": bounds,
                **extra,
            }
            r = reef_call("realtor", "search", params)
            items = (r.get("data") or {}).get("results") or []
            total = (r.get("data") or {}).get("total")
            all_items.extend(items)
            if offset == 0:
                print(f"  {label}: API total={total}, page0={len(items)}")
            if len(items) < 200:
                break
        # polygon clip
        in_poly = []
        for it in all_items:
            lat, lng = it.get("latitude"), it.get("longitude")
            if lat is None or lng is None:
                continue
            if point_in_ring(float(lng), float(lat), ring):
                in_poly.append(it)
        pending = sum(1 for it in in_poly if (it.get("flags") or {}).get("is_pending") or (it.get("flags") or {}).get("is_contingent"))
        with_gar = sum(1 for it in in_poly if it.get("garage") not in (None, "", 0))
        print(f"    fetched={len(all_items)} in_hull={len(in_poly)} pending_flags={pending} garage_present={with_gar}")

    # Our build_portal_market actives path
    print("\n=== build_portal_market (exact criteria, strict garage) ===")
    portal = build_portal_market(
        "Greeley, CO",
        lookback_days=730,
        min_sqft=1700,
        max_sqft=2900,
        min_beds=3,
        max_beds=6,
        min_baths=2.0,
        price_min=300000,
        price_max=450000,
        min_garage=1,
        require_garage_known=True,
        dwelling="detached",
        map_bounds=bounds,
        polygon_ring=ring,
    )
    pa = portal[portal["StatusNorm"] == "Active"]
    pp = portal[portal["StatusNorm"] == "Pending"]
    print("portal active", len(pa), "pending", len(pp))
    print("portal active addrs:", pa["Address"].tolist())

    # Without require_garage_known
    print("\n=== actives fetch allow unknown garage ===")
    raw = fetch_realtor_actives(
        "Greeley, CO",
        min_sqft=1700,
        max_sqft=2900,
        min_beds=3,
        max_beds=6,
        min_baths=2.0,
        price_min=300000,
        price_max=450000,
        min_garage=1,
        require_garage_known=False,
        dwelling="detached",
        map_bounds=bounds,
        max_pages=5,
    )
    print("fetch_realtor_actives (allow unknown gar) n=", len(raw))
    in_h = [it for it in raw if it.get("latitude") is not None and point_in_ring(float(it["longitude"]), float(it["latitude"]), ring)]
    print("in hull", len(in_h))
    for it in in_h:
        flags = it.get("flags") or {}
        print(
            " ",
            it.get("address_line"),
            "price",
            it.get("list_price_usd"),
            "gar",
            it.get("garage"),
            "pending",
            flags.get("is_pending"),
            "contingent",
            flags.get("is_contingent"),
            "sqft",
            it.get("sqft"),
        )

    # Check each Matrix active: inside hull? find on Realtor by address search?
    print("\n=== MATRIX ACTIVE → Realtor lookup ===")
    # Pull broad for_sale in bbox and match addresses
    broad = []
    for offset in range(0, 800, 200):
        r = reef_call(
            "realtor",
            "search",
            {
                "location": "Greeley, CO",
                "status": "for_sale",
                "sort": "newest",
                "limit": 200,
                "offset": offset,
                "map_bounds": bounds,
                "home_type": "single_family",
                "price_min": 250000,
                "price_max": 500000,
                "beds_min": 2,
                "baths_min": 1,
                "sqft_min": 1400,
                "sqft_max": 3200,
            },
        )
        items = (r.get("data") or {}).get("results") or []
        broad.extend(items)
        if len(items) < 200:
            break
    print(f"broad for_sale fetched {len(broad)} total_hint={(r.get('data') or {}).get('total')}")

    by_key = {}
    for it in broad:
        k = norm_addr(str(it.get("address_line") or ""))
        by_key.setdefault(k, []).append(it)

    found = 0
    missing = []
    for _, row in actives.iterrows():
        k = norm_addr(str(row["Address"]))
        hits = by_key.get(k) or []
        # fuzzy: number match
        if not hits:
            num = str(row.get("StNumber") or "")
            for bk, items in by_key.items():
                if num and num in bk and (str(row.get("StName") or "").upper()[:4] in bk):
                    hits = items
                    break
        in_poly = bool(
            pd.notna(row.get("Latitude"))
            and pd.notna(row.get("Longitude"))
            and point_in_ring(float(row["Longitude"]), float(row["Latitude"]), ring)
        )
        if hits:
            found += 1
            it = hits[0]
            flags = it.get("flags") or {}
            reasons = []
            price = it.get("list_price_usd")
            sqft = it.get("sqft")
            beds = it.get("beds")
            baths = it.get("baths")
            gar = it.get("garage")
            if price is not None and (price < 300000 or price > 450000):
                reasons.append(f"price={price}")
            if sqft is not None and (sqft < 1700 or sqft > 2900):
                reasons.append(f"sqft={sqft}")
            if beds is not None and beds < 3:
                reasons.append(f"beds={beds}")
            if baths is not None and baths < 2:
                reasons.append(f"baths={baths}")
            if gar is None:
                reasons.append("garage=missing")
            elif gar < 1:
                reasons.append(f"garage={gar}")
            if flags.get("is_pending") or flags.get("is_contingent"):
                reasons.append("portal_pending")
            if not in_poly:
                reasons.append("outside_hull")
            print(
                f"  FOUND {row['Address']} | MLS price {row['Price']} sqftTot {row['TotalSqFt']} finished {row['LivingArea']} "
                f"| portal price {price} sqft {sqft} gar {gar} | drop_if: {reasons or 'WOULD KEEP'}"
            )
        else:
            missing.append(row["Address"])
            print(
                f"  MISSING on Realtor for_sale {row['Address']} | price {row['Price']} totSF {row['TotalSqFt']} "
                f"finished {row['LivingArea']} gar {row['GarSpaces']} in_hull={in_poly}"
            )

    print(f"\nSummary: Matrix actives {len(actives)} found_on_realtor_forsale={found} missing={len(missing)}")
    print("Missing addresses:", missing)


if __name__ == "__main__":
    main()
