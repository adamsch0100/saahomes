"""
ListLogic – Subject Property Resolver

Automatic lookup from the MLS export + editable overrides.
Priority:
1. Exact MLS number match in export
2. Address match in export
3. Manual / public attributes you supply
4. Any field can still be overridden
"""

from __future__ import annotations
from dataclasses import asdict
from typing import Optional, Dict, Any
import re
import pandas as pd
from core import SubjectProperty, load_export


def _normalize_address(addr: str) -> str:
    if not addr:
        return ""
    a = addr.upper().strip()
    a = re.sub(r"[.,#]", " ", a)
    a = re.sub(r"\s+", " ", a)
    # Common suffix normalization
    replacements = {
        " STREET": " ST", " AVENUE": " AVE", " COURT": " CT",
        " DRIVE": " DR", " LANE": " LN", " ROAD": " RD",
        " BOULEVARD": " BLVD", " PLACE": " PL", " WEST ": " W ",
        " EAST ": " E ", " NORTH ": " N ", " SOUTH ": " S ",
    }
    for k, v in replacements.items():
        a = a.replace(k, v)
    return a.strip()


def find_in_export(
    df: pd.DataFrame,
    address: Optional[str] = None,
    mls_number: Optional[str] = None,
) -> Optional[dict]:
    """Search the loaded MLS export for a matching property."""
    if mls_number:
        row = df[df["MLSNumber"].astype(str) == str(mls_number)]
        if not row.empty:
            return _row_to_dict(row.iloc[0])

    if address:
        target = _normalize_address(address)
        # Try full address contains
        for _, r in df.iterrows():
            cand = _normalize_address(str(r.get("Address", "")))
            if target in cand or cand in target:
                return _row_to_dict(r)
        # Try number + street name
        nums = re.findall(r"\d+", address)
        if nums:
            num = nums[0]
            name_part = re.sub(r"^\d+\s*", "", address)
            name_part = re.sub(r"(?i)\b(st|ave|ct|dr|ln|rd|blvd|pl|west|east|north|south|w|e|n|s)\b", "", name_part)
            name_part = name_part.strip()
            mask = (
                df["StNumber"].astype(str) == num
            ) & (
                df["StName"].astype(str).str.contains(name_part[:6], case=False, na=False)
            )
            hits = df[mask]
            if not hits.empty:
                return _row_to_dict(hits.iloc[0])
    return None


def _row_to_dict(r) -> dict:
    living = r.get("LivingArea")
    if pd.isna(living) or living == 0:
        living = r.get("FinishedSQFTincBasement") or r.get("FinishedSQFT") or r.get("TotalSqFt")
    return {
        "mls_number": str(r.get("MLSNumber", "")),
        "address": str(r.get("Address", "")),
        "list_price": float(r["Price"]) if pd.notna(r.get("Price")) else None,
        "living_area": float(living) if pd.notna(living) else 0,
        "beds": float(r["Bdrm"]) if pd.notna(r.get("Bdrm")) else 0,
        "baths": float(r["Bath"]) if pd.notna(r.get("Bath")) else 0,
        "year_built": int(r["YearBuilt"]) if pd.notna(r.get("YearBuilt")) else 0,
        "style": str(r.get("Style") or ""),
        "subdivision": str(r.get("Subdivision") or ""),
        "garage_spaces": float(r["GarSpaces"]) if pd.notna(r.get("GarSpaces")) else 0,
        "lot_size": float(r["LotSize"]) if pd.notna(r.get("LotSize")) else 0,
        "acres": float(r["Acres"]) if pd.notna(r.get("Acres")) else 0,
        "dom": float(r["DOM"]) if pd.notna(r.get("DOM")) else None,
        "status": str(r.get("StatusNorm") or r.get("Status") or ""),
        "source": "mls_export",
    }


def resolve_subject(
    export_path: Optional[str] = None,
    address: Optional[str] = None,
    mls_number: Optional[str] = None,
    overrides: Optional[Dict[str, Any]] = None,
    defaults: Optional[Dict[str, Any]] = None,
    market_df: Optional[pd.DataFrame] = None,
) -> SubjectProperty:
    """
    Resolve a subject property with automatic lookup + editable overrides.

    Example:
        subject = resolve_subject(
            "export-71.txt",
            address="2845 W 13th Street, Greeley 80634",
            overrides={"living_area": 2100, "condition": "updated"},
        )
    """
    if market_df is not None:
        df = market_df
    elif export_path:
        df = load_export(export_path)
    else:
        df = pd.DataFrame()
    found = find_in_export(df, address=address, mls_number=mls_number) if len(df) else None

    data = {}
    if defaults:
        data.update(defaults)
    if found:
        data.update({k: v for k, v in found.items() if v not in (None, "", 0)})
        data["source"] = found.get("source", "mls_export")
    else:
        data["source"] = "manual"
        if address:
            data["address"] = address

    if overrides:
        data.update({k: v for k, v in overrides.items() if v is not None})

    lat = data.get("latitude")
    lng = data.get("longitude")
    try:
        lat_n = float(lat) if lat not in (None, "") else None
    except (TypeError, ValueError):
        lat_n = None
    try:
        lng_n = float(lng) if lng not in (None, "") else None
    except (TypeError, ValueError):
        lng_n = None

    return SubjectProperty(
        mls_number=data.get("mls_number"),
        address=data.get("address") or address or "",
        list_price=data.get("list_price"),
        living_area=float(data.get("living_area") or 0),
        beds=float(data.get("beds") or 0),
        baths=float(data.get("baths") or 0),
        year_built=int(data.get("year_built") or 0),
        style=str(data.get("style") or ""),
        subdivision=str(data.get("subdivision") or ""),
        garage_spaces=float(data.get("garage_spaces") or 0),
        lot_size=float(data.get("lot_size") or 0),
        acres=float(data.get("acres") or 0),
        condition=str(data.get("condition") or "average"),
        dom=data.get("dom"),
        photo_url=str(data.get("photo_url") or data.get("photo") or ""),
        latitude=lat_n,
        longitude=lng_n,
        extra={"source": data.get("source", "manual"), **{k: v for k, v in data.items() if k not in (
            "mls_number", "address", "list_price", "living_area", "beds", "baths",
            "year_built", "style", "subdivision", "garage_spaces", "lot_size", "acres",
            "condition", "dom", "photo_url", "photo", "latitude", "longitude"
        )}},
    )


# ---------------------------------------------------------------------------
# Known public attributes for 2845 W 13th St (editable)
# Sources: Zillow / public records — living area varies by source (1196 main
# vs ~2392 total). Using a balanced mid-range that matches similar 4bd ranches
# in this export; override freely.
# ---------------------------------------------------------------------------

SUBJECT_2845_DEFAULTS = {
    "address": "2845 W 13th St, Greeley, CO 80634",
    "beds": 4,
    "baths": 2,
    "year_built": 1969,
    "subdivision": "Sherwood Park 1st Add",
    "style": "1 Story/Ranch",
    "living_area": 2392,          # total sqft (public records); finished may be lower
    "list_price": None,           # not currently listed
    "garage_spaces": 2,
    "condition": "average",
}


if __name__ == "__main__":
    from pathlib import Path
    # Demo: resolve 2845 W 13th
    _export = Path(__file__).resolve().parent / "data" / "export-71.txt"
    subj = resolve_subject(
        str(_export),
        address="2845 W 13th Street Greeley 80634",
        defaults=SUBJECT_2845_DEFAULTS,
        # Example override – uncomment / change as needed:
        # overrides={"living_area": 2200, "condition": "updated", "list_price": 399000},
    )
    print("Resolved subject:")
    for k, v in asdict(subj).items():
        print(f"  {k}: {v}")
