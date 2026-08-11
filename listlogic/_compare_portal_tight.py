"""Tight re-score: Matrix farm vs Realtor with SFR + beds/baths/sqft + same map + UC flags."""
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
OUT = ROOT / "output" / "portal_vs_matrix_tight.json"


def norm_addr(a: str) -> str:
    a = (a or "").upper().strip()
    a = re.sub(r"[.,#]", " ", a)
    a = re.sub(r"\s+", " ", a)
    reps = {
        " STREET": " ST", " AVENUE": " AVE", " COURT": " CT", " DRIVE": " DR",
        " LANE": " LN", " ROAD": " RD", " PLACE": " PL", " CIRCLE": " CIR",
        " WEST ": " W ", " EAST ": " E ", " NORTH ": " N ", " SOUTH ": " S ",
        " AVE CT": " AVE CT", " ST RD": " ST RD",
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
    flow = compute_listing_flow(
        df,
        sales_per_month=float(stats.absorption_rate or 0),
        recommended_price=rec or 0,
        living_area=float(subject.living_area or 0),
    ) if len(df) else {}
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
        "median_ppsf": ppsf,
        "median_sqft": med(sold["LivingArea"]) if len(sold) else None,
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
    m_keys, p_keys = set(ms["_k"]), set(ps["_k"])
    matched = m_keys & p_keys
    deltas = []
    for k in matched:
        mp = float(ms[ms["_k"] == k].iloc[0]["SoldPrice"] or 0)
        pp = float(ps[ps["_k"] == k].iloc[0]["SoldPrice"] or 0)
        if mp and pp:
            deltas.append((pp - mp) / mp)
    return {
        "matched": len(matched),
        "only_matrix": len(m_keys - p_keys),
        "only_portal": len(p_keys - m_keys),
        "match_rate_matrix": round(len(matched) / max(1, len(m_keys)), 3),
        "avg_price_delta_pct": round(float(np.mean(deltas)), 4) if deltas else None,
        "median_price_delta_pct": round(float(np.median(deltas)), 4) if deltas else None,
        "exact_price_matches": int(sum(1 for d in deltas if abs(d) < 0.001)),
        "price_pairs": len(deltas),
    }


def main() -> None:
    matrix = load_export(str(ROOT / "data" / "export-71.txt"))
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

    sold_min = matrix.loc[matrix["StatusNorm"] == "Sold", "SoldDate"].min()
    lookback = max(730, int((pd.Timestamp.now() - pd.Timestamp(sold_min)).days) + 14)

    # Filters inferred from the Matrix file itself (agent-curated set)
    filters = {
        "home_type": "single_family",
        "min_beds": int(matrix["Bdrm"].min()),
        "max_beds": int(matrix["Bdrm"].max()),
        "min_baths": float(matrix["Bath"].min()),  # includes rare 1-bath
        "max_baths": float(matrix["Bath"].max()),
        "min_sqft": int(matrix["LivingArea"].min()),
        "max_sqft": int(matrix["LivingArea"].max()),
        "lookback_days": lookback,
    }
    # Competitive band agents usually mean (exclude tiny outliers)
    filters_tight = {
        **filters,
        "min_beds": 3,
        "max_beds": 5,
        "min_baths": 2.0,
        "max_baths": 4.0,
        "min_sqft": 1600,
        "max_sqft": 2800,
    }

    subject = resolve_subject(
        str(ROOT / "data" / "export-71.txt"),
        address="2845 W 13th Street Greeley 80634",
        defaults=SUBJECT_2845_DEFAULTS,
    )

    print("=== FILTERS (Matrix-inferred) ===")
    print(json.dumps(filters, indent=2))
    print("=== FILTERS (tight competitive) ===")
    print(json.dumps(filters_tight, indent=2))
    print(f"bounds={bounds} lookback={lookback}")

    results = {"filters_matrix_inferred": filters, "filters_tight": filters_tight, "bounds": bounds}

    print("\n=== MATRIX ===")
    msum = summarize(matrix, "Matrix", subject)
    print(json.dumps(msum, indent=2))
    results["matrix"] = msum

    for name, filt in (("portal_matrix_filters", filters), ("portal_tight", filters_tight)):
        print(f"\n=== {name.upper()} PULL ===")
        portal = build_portal_market(
            "Greeley, CO",
            lookback_days=filt["lookback_days"],
            min_sqft=filt["min_sqft"],
            max_sqft=filt["max_sqft"],
            min_beds=filt["min_beds"],
            max_beds=filt["max_beds"],
            min_baths=filt["min_baths"],
            max_baths=filt["max_baths"],
            home_type=filt["home_type"],
            map_bounds=bounds,
            polygon_ring=ring,
        )
        print("status", portal["StatusNorm"].value_counts().to_dict() if len(portal) else {})
        psum = summarize(portal, name, subject)
        ov = overlap(matrix, portal)
        print(json.dumps({"summary": psum, "overlap": ov}, indent=2))
        results[name] = {"summary": psum, "overlap": ov}

        # Deltas vs matrix
        def pct(a, b):
            if a is None or b is None or a == 0:
                return None
            return round((b - a) / a * 100, 1)

        results[name]["delta_vs_matrix_pct"] = {
            "median_sold": pct(msum["median_sold"], psum["median_sold"]),
            "median_ppsf": pct(msum["median_ppsf"], psum["median_ppsf"]),
            "rec_price": pct(msum["rec"], psum["rec"]),
            "moi": pct(msum["moi"], psum["moi"]),
            "odds": pct(msum["odds"], psum["odds"]),
            "active_count": pct(msum["active"], psum["active"]),
            "sold_count": pct(msum["sold"], psum["sold"]),
            "new_listings_pm": pct(msum["new_listings_pm"], psum["new_listings_pm"]),
        }
        print("DELTA % vs matrix:", json.dumps(results[name]["delta_vs_matrix_pct"], indent=2))

    OUT.write_text(json.dumps(results, indent=2, default=str), encoding="utf-8")
    print(f"\nWrote {OUT}")


if __name__ == "__main__":
    main()
