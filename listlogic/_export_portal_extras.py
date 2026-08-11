"""Export portal-only extras (vs Matrix) for Adam to review design filters."""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

import pandas as pd
from scipy.spatial import ConvexHull

sys.stdout.reconfigure(encoding="utf-8")

from core import load_export
from portal_market import DWELLING_DETACHED, build_portal_market, classify_dwelling

ROOT = Path(__file__).resolve().parent
OUT_CSV = ROOT / "output" / "portal_extras_review.csv"
OUT_JSON = ROOT / "output" / "portal_extras_review.json"
OUT_SUMMARY = ROOT / "output" / "portal_extras_summary.txt"


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


def apply_band(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    out = out[pd.to_numeric(out["Bdrm"], errors="coerce") >= 3]
    out = out[pd.to_numeric(out["Bath"], errors="coerce") >= 2]
    la = pd.to_numeric(out["LivingArea"], errors="coerce")
    return out[(la >= 1600) & (la <= 2800)].reset_index(drop=True)


def main() -> None:
    matrix_raw = load_export(str(ROOT / "data" / "export-71.txt"))
    pad = 0.0015
    bounds = {
        "west": float(matrix_raw["Longitude"].min()) - pad,
        "east": float(matrix_raw["Longitude"].max()) + pad,
        "south": float(matrix_raw["Latitude"].min()) - pad,
        "north": float(matrix_raw["Latitude"].max()) + pad,
    }
    pts = matrix_raw[["Longitude", "Latitude"]].drop_duplicates().values
    hull = ConvexHull(pts)
    ring = pts[hull.vertices].tolist()
    ring.append(ring[0])
    sold_min = matrix_raw.loc[matrix_raw["StatusNorm"] == "Sold", "SoldDate"].min()
    lookback = max(730, int((pd.Timestamp.now() - pd.Timestamp(sold_min)).days) + 14)

    matrix = apply_band(matrix_raw)
    matrix = matrix[
        matrix.apply(lambda r: classify_dwelling(r) == DWELLING_DETACHED, axis=1)
    ].reset_index(drop=True)

    portal = build_portal_market(
        "Greeley, CO",
        lookback_days=lookback,
        min_sqft=1600,
        max_sqft=2800,
        min_beds=3,
        max_beds=6,
        min_baths=2.0,
        max_baths=4.0,
        dwelling="detached",
        map_bounds=bounds,
        polygon_ring=ring,
    )
    portal = apply_band(portal)

    ms = matrix[matrix["StatusNorm"] == "Sold"].copy()
    ps = portal[portal["StatusNorm"] == "Sold"].copy()
    ms["_k"] = ms["Address"].astype(str).map(norm_addr)
    ps["_k"] = ps["Address"].astype(str).map(norm_addr)

    matched = set(ms["_k"]) & set(ps["_k"])
    only_p = set(ps["_k"]) - set(ms["_k"])
    only_m = set(ms["_k"]) - set(ps["_k"])

    extras = ps[ps["_k"].isin(only_p)].copy()
    matched_p = ps[ps["_k"].isin(matched)].copy()
    missing = ms[ms["_k"].isin(only_m)].copy()

    # Enrich extras with flags Adam can scan
    extras["gar_missing"] = pd.to_numeric(extras["GarSpaces"], errors="coerce").isna() | (
        pd.to_numeric(extras["GarSpaces"], errors="coerce").fillna(0) == 0
    )
    extras["lot_lt_5000"] = pd.to_numeric(extras["LotSize"], errors="coerce") < 5000
    extras["sqft_lt_1800"] = pd.to_numeric(extras["LivingArea"], errors="coerce") < 1800
    extras["sqft_lt_2000"] = pd.to_numeric(extras["LivingArea"], errors="coerce") < 2000
    extras["price_lt_350k"] = pd.to_numeric(extras["SoldPrice"], errors="coerce") < 350000
    extras["year_lt_1960"] = pd.to_numeric(extras["YearBuilt"], errors="coerce") < 1960
    extras["year_gte_2000"] = pd.to_numeric(extras["YearBuilt"], errors="coerce") >= 2000

    cols = [
        c for c in [
            "Address", "City", "ZipCode", "Subdivision", "StatusNorm",
            "Bdrm", "Bath", "LivingArea", "SoldPrice", "SoldDate", "YearBuilt",
            "GarSpaces", "LotSize", "PropertyType", "DwellingClass",
            "Latitude", "Longitude", "_url",
            "gar_missing", "lot_lt_5000", "sqft_lt_1800", "sqft_lt_2000",
            "price_lt_350k", "year_lt_1960", "year_gte_2000",
        ]
        if c in extras.columns
    ]
    extras_out = extras[cols].sort_values(["SoldPrice", "Address"]).reset_index(drop=True)
    extras_out.to_csv(OUT_CSV, index=False)

    def med(s):
        s = pd.to_numeric(s, errors="coerce").dropna()
        return float(s.median()) if len(s) else None

    lines = []
    lines.append("PORTAL EXTRAS REVIEW (House/detached, 3+/2+, 1600-2800, same map hull)")
    lines.append(f"Matrix solds in band: {len(ms)}")
    lines.append(f"Portal solds in band: {len(ps)}")
    lines.append(f"Matched: {len(matched)}")
    lines.append(f"PORTAL ONLY (extras): {len(only_p)}")
    lines.append(f"MATRIX ONLY (portal missed): {len(only_m)}")
    lines.append("")
    lines.append("--- EXTRAS vs MATCHED medians ---")
    for label, df in [("extras", extras), ("matched", matched_p)]:
        lines.append(
            f"{label}: n={len(df)} med_price={med(df['SoldPrice'])} "
            f"med_sqft={med(df['LivingArea'])} med_year={med(df['YearBuilt'])} "
            f"med_lot={med(df['LotSize'])} med_gar={med(df['GarSpaces'])}"
        )
    lines.append("")
    lines.append("--- EXTRAS flag counts ---")
    for f in ["gar_missing", "lot_lt_5000", "sqft_lt_1800", "sqft_lt_2000", "price_lt_350k", "year_lt_1960", "year_gte_2000"]:
        lines.append(f"{f}: {int(extras[f].sum())} / {len(extras)}")
    lines.append("")
    lines.append("--- EXTRAS beds/baths ---")
    lines.append(f"beds: {extras['Bdrm'].value_counts().sort_index().to_dict()}")
    lines.append(f"baths: {extras['Bath'].value_counts().sort_index().to_dict()}")
    lines.append("")
    lines.append("--- EXTRAS subdivisions (top) ---")
    if "Subdivision" in extras.columns:
        lines.append(str(extras["Subdivision"].fillna("(blank)").value_counts().head(20).to_dict()))
    lines.append("")
    lines.append("--- MATRIX-ONLY subdivisions (top) ---")
    if "Subdivision" in missing.columns:
        lines.append(str(missing["Subdivision"].fillna("(blank)").value_counts().head(15).to_dict()))
    lines.append("")
    lines.append(f"CSV: {OUT_CSV}")
    text = "\n".join(lines)
    OUT_SUMMARY.write_text(text, encoding="utf-8")
    print(text)

    # JSON for canvas / UI
    payload = {
        "filters": {
            "dwelling": "detached (House)",
            "beds": "3+",
            "baths": "2+",
            "sqft": "1600-2800",
            "map": "Matrix convex hull",
        },
        "counts": {
            "matrix_sold": int(len(ms)),
            "portal_sold": int(len(ps)),
            "matched": int(len(matched)),
            "portal_only": int(len(only_p)),
            "matrix_only": int(len(only_m)),
        },
        "extras_medians": {
            "price": med(extras["SoldPrice"]),
            "sqft": med(extras["LivingArea"]),
            "year": med(extras["YearBuilt"]),
            "lot": med(extras["LotSize"]),
        },
        "matched_medians": {
            "price": med(matched_p["SoldPrice"]),
            "sqft": med(matched_p["LivingArea"]),
            "year": med(matched_p["YearBuilt"]),
            "lot": med(matched_p["LotSize"]),
        },
        "extras": json.loads(extras_out.to_json(orient="records", date_format="iso")),
        "matrix_only_sample": json.loads(
            missing[
                [c for c in ["Address", "Bdrm", "Bath", "LivingArea", "SoldPrice", "SoldDate", "YearBuilt", "GarSpaces", "GarType", "Style", "Subdivision", "Type"] if c in missing.columns]
            ].sort_values("SoldPrice").head(40).to_json(orient="records", date_format="iso")
        ),
    }
    OUT_JSON.write_text(json.dumps(payload, indent=2, default=str), encoding="utf-8")
    print(f"\nWrote {OUT_JSON}")


if __name__ == "__main__":
    main()
