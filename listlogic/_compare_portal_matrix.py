"""Apples-to-apples: Matrix export-71 vs Realtor portal inside the SAME map box."""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

import numpy as np
import pandas as pd

sys.stdout.reconfigure(encoding="utf-8")

from core import load_export
from portal_market import build_portal_market, bounds_from_ring, point_in_ring
from subject import SUBJECT_2845_DEFAULTS, resolve_subject

ROOT = Path(__file__).resolve().parent
EXPORT = ROOT / "data" / "export-71.txt"
OUT = ROOT / "output" / "portal_vs_matrix_compare.json"


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
    # drop city/state/zip tails
    a = re.sub(r"\b(GREELEY|CO|COLORADO|80634|80631)\b", " ", a)
    a = re.sub(r"\s+", " ", a).strip()
    return a


def main() -> None:
    matrix = load_export(str(EXPORT))
    g = matrix[
        matrix["Latitude"].notna()
        & matrix["Longitude"].notna()
        & (matrix["Latitude"] != 0)
        & (matrix["Longitude"] != 0)
    ].copy()

    pad = 0.0015
    bounds = {
        "west": float(g["Longitude"].min()) - pad,
        "east": float(g["Longitude"].max()) + pad,
        "south": float(g["Latitude"].min()) - pad,
        "north": float(g["Latitude"].max()) + pad,
    }
    # Convex-ish ring from extremes (bbox corners) — also build hull from points
    hull_pts = g[["Longitude", "Latitude"]].drop_duplicates().values
    # Use bbox ring for API; hull clip after for tighter farm shape
    # Simple convex hull via scipy if available; else bbox only
    try:
        from scipy.spatial import ConvexHull

        hull = ConvexHull(hull_pts)
        ring = hull_pts[hull.vertices].tolist()
        ring.append(ring[0])
    except Exception:
        ring = [
            [bounds["west"], bounds["south"]],
            [bounds["east"], bounds["south"]],
            [bounds["east"], bounds["north"]],
            [bounds["west"], bounds["north"]],
            [bounds["west"], bounds["south"]],
        ]

    sqft_min = float(g["LivingArea"].min())
    sqft_max = float(g["LivingArea"].max())
    sold_min = g.loc[g["StatusNorm"] == "Sold", "SoldDate"].min()
    sold_max = g.loc[g["StatusNorm"] == "Sold", "SoldDate"].max()
    lookback = max(730, int((pd.Timestamp.now() - pd.Timestamp(sold_min)).days) + 14)

    print("=== MATRIX FARM ===")
    print(f"n={len(matrix)} geo={len(g)} bounds={bounds}")
    print(f"sqft {sqft_min:.0f}-{sqft_max:.0f} solds {sold_min.date()}..{sold_max.date()} lookback_days={lookback}")
    print(f"status={matrix['StatusNorm'].value_counts().to_dict()}")
    print(f"hull_vertices={len(ring)}")

    print("\n=== PORTAL PULL (Realtor, same bounds + sqft) ===")
    portal = build_portal_market(
        "Greeley, CO",
        lookback_days=lookback,
        min_sqft=int(sqft_min),
        max_sqft=int(sqft_max),
        map_bounds=bounds,
        polygon_ring=ring,
    )
    print(f"portal n={len(portal)} status={portal['StatusNorm'].value_counts().to_dict() if len(portal) else {}}")

    # Also keep unclipped bbox pull stats for context
    portal_box = build_portal_market(
        "Greeley, CO",
        lookback_days=lookback,
        min_sqft=int(sqft_min),
        max_sqft=int(sqft_max),
        map_bounds=bounds,
        polygon_ring=None,
    )
    print(f"portal_bbox_only n={len(portal_box)}")

    def sold(df):
        return df[df["StatusNorm"] == "Sold"] if len(df) else df

    def active(df):
        return df[df["StatusNorm"] == "Active"] if len(df) else df

    ms, ps = sold(matrix), sold(portal)
    ma, pa = active(matrix), active(portal)

    def med(s):
        s = pd.to_numeric(s, errors="coerce").dropna()
        return float(s.median()) if len(s) else None

    def ppsf(df):
        if not len(df) or "SoldPrice" not in df.columns:
            return None
        x = df[(df["SoldPrice"] > 0) & (df["LivingArea"] > 0)]
        if not len(x):
            return None
        return float((x["SoldPrice"] / x["LivingArea"]).median())

    # Address overlap among solds
    m_addrs = {norm_addr(a): a for a in ms["Address"].astype(str)}
    p_addrs = {norm_addr(a): a for a in ps["Address"].astype(str)}
    overlap_keys = set(m_addrs) & set(p_addrs)
    only_m = set(m_addrs) - set(p_addrs)
    only_p = set(p_addrs) - set(m_addrs)

    # Price compare on overlap
    price_deltas = []
    for k in list(overlap_keys)[:500]:
        mr = ms[ms["Address"].astype(str).map(norm_addr) == k]
        pr = ps[ps["Address"].astype(str).map(norm_addr) == k]
        if mr.empty or pr.empty:
            continue
        mp = float(mr.iloc[0]["SoldPrice"] or 0)
        pp = float(pr.iloc[0]["SoldPrice"] or 0)
        if mp and pp:
            price_deltas.append({"addr": k, "matrix": mp, "portal": pp, "delta": pp - mp, "pct": (pp - mp) / mp})

    avg_pct = float(np.mean([d["pct"] for d in price_deltas])) if price_deltas else None

    # Engine path — compute market stats both ways
    from core import compute_market_stats, SubjectProperty
    from presentation import build_presentation

    subject = resolve_subject(
        str(EXPORT),
        address="2845 W 13th Street Greeley 80634",
        defaults=SUBJECT_2845_DEFAULTS,
    )
    # build_presentation expects a path or we need another entry — check API
    # Use compute pieces available
    m_stats = compute_market_stats(matrix, area_name="Matrix West Greeley")
    # portal frame needs same helper
    p_stats = compute_market_stats(portal, area_name="Portal same map") if len(portal) else None

    report = {
        "matrix": {
            "n": len(matrix),
            "sold": int(len(ms)),
            "active": int(len(ma)),
            "pending": int((matrix["StatusNorm"] == "Pending").sum()),
            "expired": int((matrix["StatusNorm"] == "Expired").sum()),
            "withdrawn": int((matrix["StatusNorm"] == "Withdrawn").sum()),
            "median_sold": med(ms["SoldPrice"]),
            "median_ppsf": ppsf(ms),
            "median_sqft": med(ms["LivingArea"]),
            "sold_date_min": str(ms["SoldDate"].min()) if len(ms) else None,
            "sold_date_max": str(ms["SoldDate"].max()) if len(ms) else None,
            "bounds": bounds,
            "sqft_range": [sqft_min, sqft_max],
            "stats": {
                "moi": float(m_stats.months_of_inventory) if m_stats else None,
                "absorption": float(m_stats.absorption_rate) if m_stats else None,
                "odds": float(m_stats.odds_of_selling) if m_stats else None,
                "median_sold": float(m_stats.median_sold_price) if m_stats else None,
                "median_ppsf": float(m_stats.median_price_per_sqft) if m_stats else None,
            },
        },
        "portal_hull": {
            "n": len(portal),
            "sold": int(len(ps)),
            "active": int(len(pa)),
            "pending": int((portal["StatusNorm"] == "Pending").sum()) if len(portal) else 0,
            "median_sold": med(ps["SoldPrice"]) if len(ps) else None,
            "median_ppsf": ppsf(ps),
            "median_sqft": med(ps["LivingArea"]) if len(ps) else None,
            "sold_date_min": str(ps["SoldDate"].min()) if len(ps) else None,
            "sold_date_max": str(ps["SoldDate"].max()) if len(ps) else None,
            "bbox_uncipped_n": len(portal_box),
            "stats": {
                "moi": float(p_stats.months_of_inventory) if p_stats else None,
                "absorption": float(p_stats.absorption_rate) if p_stats else None,
                "odds": float(p_stats.odds_of_selling) if p_stats else None,
                "median_sold": float(p_stats.median_sold_price) if p_stats else None,
                "median_ppsf": float(p_stats.median_price_per_sqft) if p_stats else None,
            } if p_stats else None,
        },
        "overlap": {
            "sold_matrix": int(len(ms)),
            "sold_portal": int(len(ps)),
            "matched_addrs": int(len(overlap_keys)),
            "only_matrix": int(len(only_m)),
            "only_portal": int(len(only_p)),
            "match_rate_of_matrix": round(len(overlap_keys) / max(1, len(m_addrs)), 3),
            "match_rate_of_portal": round(len(overlap_keys) / max(1, len(p_addrs)), 3),
            "price_pairs": len(price_deltas),
            "avg_portal_vs_matrix_pct": round(avg_pct, 4) if avg_pct is not None else None,
            "sample_only_matrix": sorted(list(only_m))[:15],
            "sample_only_portal": sorted(list(only_p))[:15],
            "sample_price_deltas": sorted(price_deltas, key=lambda d: abs(d["pct"]), reverse=True)[:10],
        },
        "why": [
            "Same map box + convex hull of Matrix listings used for Realtor pull",
            "Same living-area min/max as Matrix file",
            "Lookback covers Matrix sold date span (min 730d)",
            "Portal lacks Expired/Withdrawn/Backup — those only exist in MLS",
            "Sqft definitions can differ (finished vs total) → some address misses",
            "Address string normalization imperfect (Ct vs Court, Ave Ct, etc.)",
            "Portal may include sales not in agent's Matrix search criteria (style/garage/etc.)",
        ],
    }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(report, indent=2, default=str), encoding="utf-8")
    print("\n=== SCORECARD ===")
    print(json.dumps(report, indent=2, default=str))
    print(f"\nWrote {OUT}")


if __name__ == "__main__":
    main()
