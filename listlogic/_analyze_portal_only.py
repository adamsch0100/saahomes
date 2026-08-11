"""Diff portal-only solds vs Matrix-matched solds."""
from __future__ import annotations

import re
import sys
from pathlib import Path

import pandas as pd
from scipy.spatial import ConvexHull

sys.stdout.reconfigure(encoding="utf-8")

from core import load_export
from portal_market import build_portal_market

ROOT = Path(__file__).resolve().parent


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


def sales_per_month(df: pd.DataFrame) -> float | None:
    s = df.dropna(subset=["SoldDate"])
    if len(s) < 2:
        return None
    months = max((s["SoldDate"].max() - s["SoldDate"].min()).days / 30.44, 1.0)
    return len(s) / months


def profile(df: pd.DataFrame, label: str) -> None:
    print(f"\n=== {label} n={len(df)} ===")
    if not len(df):
        return
    if "PropertyType" in df.columns:
        print(
            "PropertyType:",
            df["PropertyType"].fillna("(blank)").astype(str).str.lower().value_counts().head(15).to_dict(),
        )
    addr = df["Address"].astype(str)
    condoish = addr.str.contains(
        r"\bUNIT\b|\bAPT\b|#\s*\d+|TOWNHOME|TOWNHOUSE|CONDO",
        case=False,
        regex=True,
    )
    print("addr condo-like", int(condoish.sum()))
    for c in ["Bdrm", "Bath", "LivingArea", "SoldPrice", "YearBuilt", "GarSpaces", "LotSize"]:
        if c not in df.columns:
            continue
        s = pd.to_numeric(df[c], errors="coerce")
        print(
            f"{c}: min={s.min()} p25={s.quantile(0.25)} med={s.median()} "
            f"p75={s.quantile(0.75)} max={s.max()} nulls={int(s.isna().sum())}"
        )
    if "GarSpaces" in df.columns:
        g = pd.to_numeric(df["GarSpaces"], errors="coerce")
        print("GarSpaces==0 or null", int((g.fillna(0) == 0).sum()), "of", len(df))
        print("GarSpaces dist", g.fillna(-1).value_counts().sort_index().to_dict())
    pps = pd.to_numeric(df["SoldPrice"], errors="coerce") / pd.to_numeric(df["LivingArea"], errors="coerce")
    print("$/sqft med", float(pps.median()))
    print("sample low:")
    cols = ["Address", "PropertyType", "Bdrm", "Bath", "LivingArea", "GarSpaces", "SoldPrice", "YearBuilt"]
    for _, r in df.sort_values("SoldPrice").head(8).iterrows():
        bits = " | ".join(f"{c}={r.get(c)}" for c in cols)
        print(" ", bits)
    print("sample high:")
    for _, r in df.sort_values("SoldPrice", ascending=False).head(5).iterrows():
        bits = " | ".join(f"{c}={r.get(c)}" for c in cols)
        print(" ", bits)


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

    portal = build_portal_market(
        location="Greeley, CO 80634",
        map_bounds=bounds,
        polygon_ring=ring,
        min_sqft=946,
        max_sqft=2798,
        min_beds=2,
        max_beds=6,
        min_baths=1.0,
        max_baths=4.0,
        home_type="single_family",
        lookback_days=lookback,
    )

    ms = matrix[matrix["StatusNorm"] == "Sold"].copy()
    ps = portal[portal["StatusNorm"] == "Sold"].copy()
    ms["_k"] = ms["Address"].astype(str).map(norm_addr)
    ps["_k"] = ps["Address"].astype(str).map(norm_addr)
    matched = set(ms["_k"]) & set(ps["_k"])
    only_p = set(ps["_k"]) - set(ms["_k"])
    only_m = set(ms["_k"]) - set(ps["_k"])

    op = ps[ps["_k"].isin(only_p)].copy()
    mt = ps[ps["_k"].isin(matched)].copy()

    print("=== COUNTS ===")
    print(
        "matrix sold", len(ms),
        "portal sold", len(ps),
        "matched", len(matched),
        "only_portal", len(only_p),
        "only_matrix", len(only_m),
    )

    profile(op, "PORTAL ONLY SOLDS")
    profile(mt, "MATCHED PORTAL SOLDS")

    print("\n=== DISTRIBUTION SHIFT (only_portal vs matched) ===")
    for c in ["Bdrm", "Bath", "LivingArea", "SoldPrice", "YearBuilt", "GarSpaces", "LotSize"]:
        if c not in op.columns:
            continue
        a = pd.to_numeric(op[c], errors="coerce")
        b = pd.to_numeric(mt[c], errors="coerce")
        print(
            f"{c}: only_p med={a.median()} matched med={b.median()} "
            f"only_p mean={a.mean():.0f} matched mean={b.mean():.0f}"
        )

    print("\n=== HEURISTICS ===")
    print("matrix YearBuilt range", matrix["YearBuilt"].min(), matrix["YearBuilt"].max())
    yb = pd.to_numeric(op["YearBuilt"], errors="coerce")
    print("only_p YearBuilt > matrix max", int((yb > matrix["YearBuilt"].max()).sum()))
    print("only_p YearBuilt < matrix min", int((yb < matrix["YearBuilt"].min()).sum()))
    print("only_p under 1600 sqft", int((pd.to_numeric(op["LivingArea"], errors="coerce") < 1600).sum()))
    print("matched under 1600", int((pd.to_numeric(mt["LivingArea"], errors="coerce") < 1600).sum()))
    print("only_p no garage", int((pd.to_numeric(op["GarSpaces"], errors="coerce").fillna(0) == 0).sum()))
    print("matched no garage", int((pd.to_numeric(mt["GarSpaces"], errors="coerce").fillna(0) == 0).sum()))
    print("only_p beds==2", int((pd.to_numeric(op["Bdrm"], errors="coerce") == 2).sum()))
    print("matched beds==2", int((pd.to_numeric(mt["Bdrm"], errors="coerce") == 2).sum()))
    print("only_p baths==1", int((pd.to_numeric(op["Bath"], errors="coerce") == 1).sum()))
    print("matched baths==1", int((pd.to_numeric(mt["Bath"], errors="coerce") == 1).sum()))

    # Lot size: Matrix attached mostly on larger lots — patio/zero-lot often smaller
    if "LotSize" in op.columns:
        lot_op = pd.to_numeric(op["LotSize"], errors="coerce")
        lot_mt = pd.to_numeric(mt["LotSize"], errors="coerce")
        print("only_p lot < 5000", int((lot_op < 5000).sum()), "nulls", int(lot_op.isna().sum()))
        print("matched lot < 5000", int((lot_mt < 5000).sum()), "nulls", int(lot_mt.isna().sum()))

    print("\n=== SALES / MONTH ===")
    for label, df in [
        ("only_portal", op),
        ("matched", mt),
        ("all_portal", ps),
        ("matrix", ms),
    ]:
        spm = sales_per_month(df)
        print(label, "spm", round(spm, 2) if spm else None, "span", df["SoldDate"].min(), "->", df["SoldDate"].max())

    out_cols = [
        c for c in [
            "Address", "PropertyType", "Bdrm", "Bath", "LivingArea", "GarSpaces",
            "LotSize", "SoldPrice", "SoldDate", "YearBuilt", "_url",
        ]
        if c in op.columns
    ]
    out_path = ROOT / "output" / "portal_only_solds.csv"
    op[out_cols].sort_values("SoldPrice").to_csv(out_path, index=False)
    print("\nWrote", out_path, len(op))


if __name__ == "__main__":
    main()
