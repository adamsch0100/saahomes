"""Canonical ListLogic market frame schema + shared normalize.

Used by MLS uploads (via export_mapper) and portal_market pulls so both
paths feed the same engine columns.
"""
from __future__ import annotations

from typing import Optional

import numpy as np
import pandas as pd

# Internal StatusNorm values the engine understands.
STATUS_SYNONYMS: dict[str, str] = {
    "sold": "Sold",
    "closed": "Sold",
    "sale closed": "Sold",
    "recently sold": "Sold",
    "active": "Active",
    "coming soon": "Active",
    "comingsoon": "Active",
    "for sale": "Active",
    "new": "Active",
    "pending": "Pending",
    "contingent": "Pending",
    "under contract": "Pending",
    "active under contract": "Pending",
    "active/under contract": "Pending",
    "backup": "Pending",
    "active / backup": "Pending",
    "active/backup": "Pending",
    "firstright": "Pending",
    "first right": "Pending",
    "active / first right": "Pending",
    "active/first right": "Pending",
    "expired": "Expired",
    "withdrawn": "Withdrawn",
    "canceled": "Withdrawn",
    "cancelled": "Withdrawn",
    "hold": "Other",
    "incomplete": "Other",
    "delete": "Other",
}

REQUIRED_ENGINE_FIELDS = (
    "StatusNorm",
    "MLSNumber",
    "Price",
    "SoldPrice",
    "LivingArea",
    "Bdrm",
    "Bath",
    "ListDate",
    "SoldDate",
    "Address",
)

NUMERIC_COLS = (
    "Price", "SoldPrice", "TotalSqFt", "FinishedSQFT", "FinishedSQFTincBasement",
    "Bdrm", "Bath", "YearBuilt", "DOM", "GarSpaces", "Acres", "LotSize",
    "FullBaths", "HalfBaths", "ThreeQuarterBaths", "Latitude", "Longitude",
)

DATE_COLS = ("SoldDate", "ListDate", "LastUpdateDate")


def map_status_norm(value) -> str:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return "Other"
    raw = str(value).strip()
    if not raw:
        return "Other"
    # Exact Matrix titles first
    if raw in ("Sold", "Active", "Pending", "Expired", "Withdrawn"):
        return raw
    if raw in ("Backup", "FirstRight"):
        return "Pending"
    key = raw.lower().replace("_", " ").strip()
    key = " ".join(key.split())
    return STATUS_SYNONYMS.get(key, "Other")


def _ensure_col(df: pd.DataFrame, name: str, default=None) -> None:
    if name not in df.columns:
        df[name] = default


def normalize_market_frame(
    df: pd.DataFrame,
    *,
    prefer_total_sqft_for_living: bool = False,
    source: str = "",
) -> pd.DataFrame:
    """Normalize a Matrix-shaped (or mapped) frame for the ListLogic engine.

    prefer_total_sqft_for_living: when True, LivingArea prefers TotalSqFt
    (matches Matrix Total SF search). Default keeps finished-first for MLS comps $/sf.
    """
    if df is None or len(df) == 0:
        return pd.DataFrame()

    out = df.copy()

    # Status
    if "Status" not in out.columns and "StatusNorm" in out.columns:
        out["Status"] = out["StatusNorm"]
    _ensure_col(out, "Status", "")
    computed = out["Status"].map(map_status_norm)
    if "StatusNorm" in df.columns:
        preset = df["StatusNorm"].astype(str)
        valid = preset.isin(["Sold", "Active", "Pending", "Expired", "Withdrawn"])
        out["StatusNorm"] = computed
        out.loc[valid.values, "StatusNorm"] = preset[valid].values
    else:
        out["StatusNorm"] = computed

    for col in DATE_COLS:
        if col in out.columns:
            out[col] = pd.to_datetime(out[col], errors="coerce", utc=True)
            try:
                out[col] = out[col].dt.tz_localize(None)
            except (TypeError, AttributeError):
                out[col] = pd.to_datetime(out[col], errors="coerce")

    for col in NUMERIC_COLS:
        if col in out.columns:
            out[col] = pd.to_numeric(out[col], errors="coerce")

    for c in ("FinishedSQFTincBasement", "FinishedSQFT", "TotalSqFt", "SoldPrice", "Price"):
        _ensure_col(out, c, np.nan)

    fin_inc = pd.to_numeric(out["FinishedSQFTincBasement"], errors="coerce")
    fin = pd.to_numeric(out["FinishedSQFT"], errors="coerce")
    total = pd.to_numeric(out["TotalSqFt"], errors="coerce")
    if prefer_total_sqft_for_living:
        out["LivingArea"] = total.fillna(fin_inc).fillna(fin)
    else:
        out["LivingArea"] = fin_inc.fillna(fin).fillna(total)

    out["PricePerSqFt"] = np.where(
        (out["StatusNorm"] == "Sold")
        & (out["LivingArea"] > 0)
        & out["SoldPrice"].notna(),
        out["SoldPrice"] / out["LivingArea"],
        np.nan,
    )

    if "SoldDate" in out.columns and "ListDate" in out.columns:
        try:
            out["DaysToSell"] = (out["SoldDate"] - out["ListDate"]).dt.days
        except Exception:
            out["DaysToSell"] = np.nan
    else:
        out["DaysToSell"] = np.nan

    # Address
    if "Address" not in out.columns or out["Address"].isna().all() or (
        out["Address"].astype(str).str.strip() == ""
    ).all():
        parts = []
        for c in ("StNumber", "StDir", "StName", "StType"):
            _ensure_col(out, c, "")
            parts.append(out[c].fillna("").astype(str))
        out["Address"] = (
            parts[0] + " " + parts[1] + " " + parts[2] + " " + parts[3]
        ).str.replace(r"\s+", " ", regex=True).str.strip()
    else:
        out["Address"] = out["Address"].fillna("").astype(str).str.strip()

    _ensure_col(out, "MLSNumber", "")
    out["MLSNumber"] = out["MLSNumber"].astype(str)
    # Empty MLS ids get a stable hash from address so dedupe still works
    empty = out["MLSNumber"].isin(["", "nan", "None", "NaN"])
    if empty.any():
        out.loc[empty, "MLSNumber"] = out.loc[empty, "Address"].map(
            lambda a: f"X-{hash(a) & 0xFFFFFFFF:08x}"
        )

    _ensure_col(out, "DwellingClass", "")
    if source:
        out.attrs["source"] = source

    # Drop exact MLSNumber dupes keeping first
    if "MLSNumber" in out.columns:
        out = out.drop_duplicates(subset=["MLSNumber"], keep="first").reset_index(drop=True)

    return out


def market_preview_stats(df: pd.DataFrame) -> dict:
    """Lightweight preview payload for portal/MLS generate UX."""
    if df is None or len(df) == 0:
        return {
            "n": 0,
            "sold": 0,
            "active": 0,
            "pending": 0,
            "expired_withdrawn": 0,
            "median_sold": None,
            "median_list": None,
            "status": {},
        }
    col = "StatusNorm" if "StatusNorm" in df.columns else "Status"
    status = df[col].astype(str).value_counts().to_dict()
    sold = df[df[col] == "Sold"] if col in df.columns else df.iloc[0:0]
    active = df[df[col] == "Active"] if col in df.columns else df.iloc[0:0]
    pending = df[df[col] == "Pending"] if col in df.columns else df.iloc[0:0]
    failed = df[df[col].isin(["Expired", "Withdrawn"])] if col in df.columns else df.iloc[0:0]

    def med(series):
        s = pd.to_numeric(series, errors="coerce").dropna()
        return float(s.median()) if len(s) else None

    return {
        "n": int(len(df)),
        "sold": int(len(sold)),
        "active": int(len(active)),
        "pending": int(len(pending)),
        "expired_withdrawn": int(len(failed)),
        "median_sold": med(sold["SoldPrice"]) if len(sold) and "SoldPrice" in sold.columns else None,
        "median_list": med(df["Price"]) if "Price" in df.columns else None,
        "status": {str(k): int(v) for k, v in status.items()},
    }
