"""Compare new Matrix export to Realtor using exact Criteria Summary filters."""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from scipy.spatial import ConvexHull

sys.stdout.reconfigure(encoding="utf-8")

from core import compute_listing_flow, compute_market_stats, find_closest_comps, load_export, position_subject
from portal_market import build_portal_market
from subject import SUBJECT_2845_DEFAULTS, resolve_subject

ROOT = Path(__file__).resolve().parent
EXPORT = ROOT / "data" / "export-71-criteria.txt"
OUT = ROOT / "output" / "portal_vs_matrix_exact_criteria.json"
EXTRAS_CSV = ROOT / "output" / "portal_extras_exact_criteria.csv"

# From Matrix Criteria Summary screenshot
CRITERIA = {
    "type": "Residential-Detached",
    "dwelling": "detached",
    "price_min": 300_000,
    "price_max": 450_000,
    "min_beds": 3,
    "min_baths": 2.0,
    "min_sqft": 1700,  # Total SF
    "max_sqft": 2900,
    "min_garage": 1,
    "lookback_days": 730,  # List Date >= 2 Years Ago
}


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


def summarize(df: pd.DataFrame, label: str, subject) -> dict:
    stats = compute_market_stats(df, area_name=label)
    pos = position_subject(df, stats, subject) if len(df) else None
    rec = float(pos.recommended_price) if pos else None
    flow = (
        compute_listing_flow(
            df,
            sales_per_month=float(stats.absorption_rate or 0),
            recommended_price=rec or 0,
            living_area=float(subject.living_area or 0),
        )
        if len(df)
        else {}
    )
    comps = find_closest_comps(df, subject, n=8) if len(df) else []
    sold = df[df["StatusNorm"] == "Sold"] if len(df) else df
    active = df[df["StatusNorm"] == "Active"] if len(df) else df
    pending = df[df["StatusNorm"] == "Pending"] if len(df) else df
    failed = df[df["StatusNorm"].isin(["Expired", "Withdrawn"])] if len(df) else df

    def med(s):
        s = pd.to_numeric(s, errors="coerce").dropna()
        return float(s.median()) if len(s) else None

    ppsf = None
    if len(sold):
        x = sold[(sold["SoldPrice"] > 0) & (sold["LivingArea"] > 0)]
        if len(x):
            ppsf = float((x["SoldPrice"] / x["LivingArea"]).median())

    return {
        "n": int(len(df)),
        "sold": int(len(sold)),
        "active": int(len(active)),
        "pending": int(len(pending)),
        "expired_withdrawn": int(len(failed)),
        "median_sold": med(sold["SoldPrice"]) if len(sold) else None,
        "median_list": med(df["Price"]) if len(df) else None,
        "median_ppsf": ppsf,
        "median_sqft": med(sold["LivingArea"]) if len(sold) else None,
        "median_total_sqft": med(sold["TotalSqFt"]) if len(sold) and "TotalSqFt" in sold.columns else None,
        "moi": float(stats.months_of_inventory),
        "odds": float(stats.odds_of_selling),
        "absorption": float(stats.absorption_rate),
        "rec": rec,
        "range": [float(pos.price_low), float(pos.price_high)] if pos else None,
        "comps": len(comps),
        "new_listings_pm": float(flow.get("new_listings_per_month") or 0),
        "sales_pm": float(flow.get("sales_per_month") or 0),
    }


def overlap(matrix: pd.DataFrame, portal: pd.DataFrame) -> dict:
    ms = matrix[matrix["StatusNorm"] == "Sold"].copy()
    ps = portal[portal["StatusNorm"] == "Sold"].copy()
    ms["_k"] = ms["Address"].astype(str).map(norm_addr)
    ps["_k"] = ps["Address"].astype(str).map(norm_addr)
    matched = set(ms["_k"]) & set(ps["_k"])
    deltas = []
    for k in matched:
        mp = float(ms[ms["_k"] == k].iloc[0]["SoldPrice"] or 0)
        pp = float(ps[ps["_k"] == k].iloc[0]["SoldPrice"] or 0)
        if mp and pp:
            deltas.append((pp - mp) / mp)
    return {
        "matched": len(matched),
        "only_matrix": len(set(ms["_k"]) - set(ps["_k"])),
        "only_portal": len(set(ps["_k"]) - set(ms["_k"])),
        "match_rate_matrix": round(len(matched) / max(1, len(set(ms["_k"]))), 3),
        "avg_price_delta_pct": round(float(np.mean(deltas)), 4) if deltas else None,
        "median_price_delta_pct": round(float(np.median(deltas)), 4) if deltas else None,
        "exact_price_matches": int(sum(1 for d in deltas if abs(d) < 0.001)),
        "price_pairs": len(deltas),
    }


def pct(a, b):
    if a is None or b is None or a == 0:
        return None
    return round((b - a) / a * 100, 1)


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

    subject = resolve_subject(
        str(EXPORT),
        address="2845 W 13th Street Greeley 80634",
        defaults=SUBJECT_2845_DEFAULTS,
    )

    print("=== MATRIX CRITERIA (from screenshot) ===")
    print(json.dumps(CRITERIA, indent=2))
    print("Matrix n=", len(matrix), matrix["StatusNorm"].value_counts().to_dict())
    print("TotalSqFt", matrix["TotalSqFt"].min(), "-", matrix["TotalSqFt"].max())
    print("bounds", bounds)

    msum = summarize(matrix, "Matrix exact criteria export", subject)
    print("\n=== MATRIX ===")
    print(json.dumps(msum, indent=2))

    results = {"criteria": CRITERIA, "bounds": bounds, "matrix": msum, "portal_variants": {}}

    # Variant A: garage known required (strict Matrix parity)
    # Variant B: allow unknown garage (portal often omits)
    for name, require_gar in (
        ("strict_garage_known", True),
        ("garage_1plus_allow_unknown", False),
    ):
        print(f"\n=== PORTAL {name} ===")
        portal = build_portal_market(
            "Greeley, CO",
            lookback_days=CRITERIA["lookback_days"],
            min_sqft=CRITERIA["min_sqft"],
            max_sqft=CRITERIA["max_sqft"],
            min_beds=CRITERIA["min_beds"],
            max_beds=6,
            min_baths=CRITERIA["min_baths"],
            max_baths=4.0,
            price_min=CRITERIA["price_min"],
            price_max=CRITERIA["price_max"],
            min_garage=CRITERIA["min_garage"],
            require_garage_known=require_gar,
            dwelling="detached",
            map_bounds=bounds,
            polygon_ring=ring,
        )
        print("status", portal["StatusNorm"].value_counts().to_dict() if len(portal) else {}, "n=", len(portal))
        psum = summarize(portal, name, subject)
        ov = overlap(matrix, portal)
        deltas = {
            "median_sold": pct(msum["median_sold"], psum["median_sold"]),
            "median_ppsf": pct(msum["median_ppsf"], psum["median_ppsf"]),
            "rec_price": pct(msum["rec"], psum["rec"]),
            "moi": pct(msum["moi"], psum["moi"]),
            "odds": pct(msum["odds"], psum["odds"]),
            "active_count": pct(msum["active"], psum["active"]),
            "sold_count": pct(msum["sold"], psum["sold"]),
            "pending_count": pct(msum["pending"], psum["pending"]),
            "absorption": pct(msum["absorption"], psum["absorption"]),
            "new_listings_pm": pct(msum["new_listings_pm"], psum["new_listings_pm"]),
        }
        print(json.dumps({"summary": psum, "overlap": ov, "delta_pct": deltas}, indent=2))
        results["portal_variants"][name] = {"summary": psum, "overlap": ov, "delta_pct": deltas}

        if name == "strict_garage_known":
            ms = matrix[matrix["StatusNorm"] == "Sold"].copy()
            ps = portal[portal["StatusNorm"] == "Sold"].copy()
            ms["_k"] = ms["Address"].astype(str).map(norm_addr)
            ps["_k"] = ps["Address"].astype(str).map(norm_addr)
            only_p = set(ps["_k"]) - set(ms["_k"])
            extras = ps[ps["_k"].isin(only_p)].copy()
            cols = [
                c for c in [
                    "Address", "Bdrm", "Bath", "LivingArea", "TotalSqFt", "SoldPrice",
                    "SoldDate", "YearBuilt", "GarSpaces", "LotSize", "Price", "_url",
                ]
                if c in extras.columns
            ]
            extras[cols].sort_values("SoldPrice").to_csv(EXTRAS_CSV, index=False)
            print("Wrote extras", EXTRAS_CSV, "n=", len(extras))

    OUT.write_text(json.dumps(results, indent=2, default=str), encoding="utf-8")
    print(f"\nWrote {OUT}")


if __name__ == "__main__":
    main()
