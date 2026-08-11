"""Build a ListLogic market frame from public portal data (ReefAPI).

Phase-0 finding (Greeley / 80634, Aug 2026):
- Redfin status=sold returns 0 rows — MLS gates Redfin sold CSV for this market.
- Redfin for_sale works.
- Realtor.com sold paginates past 2 years and includes garage.
- Zillow sold is capped ~12 months.

Primary path: Realtor solds (2y) + Realtor for-sale actives.
"""
from __future__ import annotations

import json
import logging
import os
import time
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Optional

import numpy as np
import pandas as pd

logger = logging.getLogger("ListLogic.portal")

ROOT = Path(__file__).resolve().parent
REEF_BASE = "https://api.reefapi.com"
DEFAULT_LOOKBACK_DAYS = 730
PAGE_LIMIT = 200
MAX_PAGES = 12


def _api_key() -> str:
    key = (os.environ.get("REEF_API_KEY") or "").strip()
    if key:
        return key
    env_path = ROOT / ".env"
    if not env_path.exists():
        return ""
    try:
        for line in env_path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            name, val = line.split("=", 1)
            if name.strip() == "REEF_API_KEY":
                return val.strip().strip('"').strip("'")
    except OSError:
        return ""
    return ""


def reef_call(engine: str, action: str, params: dict | None = None, timeout: int = 60) -> dict:
    key = _api_key()
    if not key:
        raise RuntimeError("REEF_API_KEY is not configured")
    url = f"{REEF_BASE}/{engine}/v1/{action}"
    body = json.dumps(params or {}).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=body,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "Accept": "application/json",
            "x-api-key": key,
            "Authorization": f"Bearer {key}",
            "User-Agent": "ListLogic/1.0",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")[:500]
        raise RuntimeError(f"ReefAPI {engine}/{action} HTTP {exc.code}: {detail}") from exc


def _parse_date(val: Any) -> Optional[pd.Timestamp]:
    if val is None or val == "":
        return None
    try:
        return pd.to_datetime(val, errors="coerce")
    except Exception:
        return None


def _realtor_item_to_row(item: dict, *, status_force: str | None = None) -> dict:
    status = status_force or str(item.get("status") or "Sold")
    status = status.strip().title()
    if status.lower() in ("for_sale", "forsale", "for sale"):
        status = "Active"
    elif status.lower() in ("sold", "recently_sold", "closed"):
        status = "Sold"
    elif status.lower() in ("pending", "contingent"):
        status = "Pending"

    sold_price = item.get("last_sold_price_usd") or item.get("sold_price_usd")
    list_price = item.get("list_price_usd") or item.get("price")
    price = sold_price if status == "Sold" and sold_price else list_price
    sold_date = item.get("last_sold_date") or item.get("sold_date")
    list_date = item.get("list_date")
    sqft = item.get("sqft") or item.get("living_area")
    baths = item.get("baths")
    if baths is None:
        full = item.get("baths_full") or 0
        half = item.get("baths_half") or 0
        baths = float(full) + 0.5 * float(half) if (full or half) else None
    garage = item.get("garage")
    try:
        garage = float(garage) if garage is not None and garage != "" else None
    except (TypeError, ValueError):
        garage = None

    addr = item.get("address_line") or item.get("address") or ""
    pid = str(item.get("property_id") or item.get("listing_id") or "")
    photo = item.get("primary_photo_url") or ""
    if not photo:
        photos = item.get("photos") or []
        if isinstance(photos, list) and photos:
            photo = photos[0] if isinstance(photos[0], str) else (photos[0] or {}).get("href") or ""

    return {
        "MLSNumber": pid or f"R-{hash(addr) & 0xFFFFFFFF:08x}",
        "Category": 1,
        "Status": status,
        "Price": float(list_price or price or 0) or None,
        "SoldDate": sold_date,
        "SoldPrice": float(sold_price or 0) or None if status == "Sold" else None,
        "StNumber": "",
        "StDir": "",
        "StName": addr,
        "StType": "",
        "Unit": "",
        "City": item.get("city") or "",
        "Locale": item.get("city") or "",
        "ZipCode": str(item.get("postal_code") or ""),
        "Subdivision": item.get("neighborhood") or "",
        "County": item.get("county") or "",
        "Bdrm": item.get("beds"),
        "Bath": baths,
        "YearBuilt": item.get("year_built"),
        "DOM": item.get("days_on_market"),
        "GarSpaces": garage,
        "GarType": "",
        "Acres": None,
        "LotSize": item.get("lot_sqft"),
        "TotalSqFt": sqft,
        "FinishedSQFT": sqft,
        "FinishedSQFTincBasement": sqft,
        "ListDate": list_date,
        "LastUpdateDate": sold_date or list_date,
        "Latitude": item.get("latitude"),
        "Longitude": item.get("longitude"),
        "PhotoURL": photo,
        "PublicRemarks": "",
        "_source": "realtor",
        "_url": item.get("url") or "",
    }


def _normalize_frame(rows: list[dict]) -> pd.DataFrame:
    if not rows:
        return pd.DataFrame()
    df = pd.DataFrame(rows)
    status_map = {
        "Sold": "Sold",
        "Active": "Active",
        "Pending": "Pending",
        "Backup": "Pending",
        "Expired": "Expired",
        "Withdrawn": "Withdrawn",
        "FirstRight": "Pending",
    }
    df["StatusNorm"] = df["Status"].map(status_map).fillna("Other")
    for col in ("SoldDate", "ListDate", "LastUpdateDate"):
        if col in df.columns:
            df[col] = pd.to_datetime(df[col], errors="coerce", utc=True).dt.tz_localize(None)
    for col in (
        "Price", "SoldPrice", "TotalSqFt", "FinishedSQFT", "FinishedSQFTincBasement",
        "Bdrm", "Bath", "YearBuilt", "DOM", "GarSpaces", "Acres", "LotSize",
        "Latitude", "Longitude",
    ):
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")
    df["LivingArea"] = (
        df["FinishedSQFTincBasement"].fillna(df["FinishedSQFT"]).fillna(df["TotalSqFt"])
    )
    df["PricePerSqFt"] = np.where(
        (df["StatusNorm"] == "Sold") & (df["LivingArea"] > 0) & df["SoldPrice"].notna(),
        df["SoldPrice"] / df["LivingArea"],
        np.nan,
    )
    try:
        df["DaysToSell"] = (df["SoldDate"] - df["ListDate"]).dt.days
    except Exception:
        df["DaysToSell"] = np.nan
    df["Address"] = df["StName"].fillna("").astype(str).str.strip()
    df = df.drop_duplicates(subset=["MLSNumber"], keep="first").reset_index(drop=True)
    return df


def fetch_realtor_solds(
    location: str,
    *,
    lookback_days: int = DEFAULT_LOOKBACK_DAYS,
    min_sqft: int | None = None,
    max_sqft: int | None = None,
    home_type: str = "single_family",
    map_bounds: dict | None = None,
    max_pages: int = MAX_PAGES,
) -> list[dict]:
    cutoff = datetime.now(timezone.utc) - timedelta(days=lookback_days)
    cutoff_naive = cutoff.replace(tzinfo=None)
    all_items: list[dict] = []
    offset = 0
    for page in range(max_pages):
        params: dict[str, Any] = {
            "location": location,
            "sort": "sold_date",
            "limit": PAGE_LIMIT,
            "offset": offset,
            "home_type": home_type,
        }
        if min_sqft is not None:
            params["sqft_min"] = int(min_sqft)
        if max_sqft is not None:
            params["sqft_max"] = int(max_sqft)
        if map_bounds:
            params["map_bounds"] = map_bounds
        envelope = reef_call("realtor", "sold", params)
        data = envelope.get("data") or {}
        items = data.get("results") or data.get("items") or []
        if not items:
            break
        stop = False
        for it in items:
            dt = _parse_date(it.get("last_sold_date") or it.get("sold_date"))
            if dt is not None and pd.notna(dt):
                ts = dt.to_pydatetime()
                if getattr(ts, "tzinfo", None) is not None:
                    ts = ts.astimezone(timezone.utc).replace(tzinfo=None)
                if ts < cutoff_naive:
                    stop = True
                    continue
            all_items.append(it)
        logger.info(
            "Realtor solds page %s offset=%s got=%s kept_total=%s",
            page + 1, offset, len(items), len(all_items),
        )
        if stop or len(items) < PAGE_LIMIT:
            break
        offset += PAGE_LIMIT
        time.sleep(0.15)
    return all_items


def fetch_realtor_actives(
    location: str,
    *,
    min_sqft: int | None = None,
    max_sqft: int | None = None,
    home_type: str = "single_family",
    map_bounds: dict | None = None,
    max_pages: int = 5,
) -> list[dict]:
    all_items: list[dict] = []
    offset = 0
    for page in range(max_pages):
        params: dict[str, Any] = {
            "location": location,
            "status": "for_sale",
            "sort": "newest",
            "limit": PAGE_LIMIT,
            "offset": offset,
            "home_type": home_type,
        }
        if min_sqft is not None:
            params["sqft_min"] = int(min_sqft)
        if max_sqft is not None:
            params["sqft_max"] = int(max_sqft)
        if map_bounds:
            params["map_bounds"] = map_bounds
        envelope = reef_call("realtor", "search", params)
        data = envelope.get("data") or {}
        items = data.get("results") or data.get("items") or []
        if not items:
            break
        all_items.extend(items)
        if len(items) < PAGE_LIMIT:
            break
        offset += PAGE_LIMIT
        time.sleep(0.15)
    return all_items


def point_in_ring(lng: float, lat: float, ring: list[list[float]]) -> bool:
    if not ring or len(ring) < 3:
        return True
    inside = False
    n = len(ring)
    j = n - 1
    for i in range(n):
        xi, yi = ring[i][0], ring[i][1]
        xj, yj = ring[j][0], ring[j][1]
        intersect = ((yi > lat) != (yj > lat)) and (
            lng < (xj - xi) * (lat - yi) / ((yj - yi) or 1e-15) + xi
        )
        if intersect:
            inside = not inside
        j = i
    return inside


def bounds_from_ring(ring: list[list[float]]) -> dict:
    lngs = [p[0] for p in ring]
    lats = [p[1] for p in ring]
    return {"west": min(lngs), "east": max(lngs), "south": min(lats), "north": max(lats)}


def build_portal_market(
    location: str,
    *,
    lookback_days: int = DEFAULT_LOOKBACK_DAYS,
    min_sqft: int | None = 1800,
    max_sqft: int | None = 2800,
    home_type: str = "single_family",
    map_bounds: dict | None = None,
    polygon_ring: list[list[float]] | None = None,
) -> pd.DataFrame:
    bounds = map_bounds
    if polygon_ring and not bounds:
        bounds = bounds_from_ring(polygon_ring)

    solds = fetch_realtor_solds(
        location,
        lookback_days=lookback_days,
        min_sqft=min_sqft,
        max_sqft=max_sqft,
        home_type=home_type,
        map_bounds=bounds,
    )
    actives = fetch_realtor_actives(
        location,
        min_sqft=min_sqft,
        max_sqft=max_sqft,
        home_type=home_type,
        map_bounds=bounds,
    )
    rows = [_realtor_item_to_row(i, status_force="Sold") for i in solds]
    rows += [_realtor_item_to_row(i, status_force="Active") for i in actives]
    df = _normalize_frame(rows)

    if polygon_ring and len(df) and "Latitude" in df.columns:
        mask = df.apply(
            lambda r: (
                pd.notna(r.get("Latitude"))
                and pd.notna(r.get("Longitude"))
                and point_in_ring(float(r["Longitude"]), float(r["Latitude"]), polygon_ring)
            ),
            axis=1,
        )
        df = df[mask].reset_index(drop=True)

    df.attrs["source"] = "realtor"
    df.attrs["lookback_days"] = lookback_days
    df.attrs["location"] = location
    return df


def scorecard_vs_matrix(portal_df: pd.DataFrame, matrix_df: pd.DataFrame) -> dict:
    def _sold(df):
        if df is None or df.empty:
            return pd.DataFrame()
        col = "StatusNorm" if "StatusNorm" in df.columns else "Status"
        return df[df[col].astype(str).str.lower() == "sold"]

    def _active(df):
        if df is None or df.empty:
            return pd.DataFrame()
        col = "StatusNorm" if "StatusNorm" in df.columns else "Status"
        return df[df[col].astype(str).str.lower() == "active"]

    ps, ms = _sold(portal_df), _sold(matrix_df)
    pa, ma = _active(portal_df), _active(matrix_df)

    def med(series):
        s = pd.to_numeric(series, errors="coerce").dropna()
        return float(s.median()) if len(s) else None

    return {
        "portal_sold": int(len(ps)),
        "matrix_sold": int(len(ms)),
        "portal_active": int(len(pa)),
        "matrix_active": int(len(ma)),
        "portal_median_sold": med(ps["SoldPrice"]) if len(ps) and "SoldPrice" in ps.columns else None,
        "matrix_median_sold": med(ms["SoldPrice"]) if len(ms) and "SoldPrice" in ms.columns else None,
        "portal_median_ppsf": med(ps["PricePerSqFt"]) if len(ps) and "PricePerSqFt" in ps.columns else None,
        "matrix_median_ppsf": med(ms["PricePerSqFt"]) if len(ms) and "PricePerSqFt" in ms.columns else None,
        "portal_garage_pct": float(ps["GarSpaces"].notna().mean()) if len(ps) and "GarSpaces" in ps.columns else 0,
        "matrix_has_pending": int((matrix_df.get("StatusNorm") == "Pending").sum()) if matrix_df is not None and not matrix_df.empty else 0,
        "portal_has_pending": int((portal_df.get("StatusNorm") == "Pending").sum()) if portal_df is not None and not portal_df.empty else 0,
        "notes": [
            "Redfin solds gated for NoCo MLS — Realtor is primary sold source",
            "Portal markets lack Expired/Withdrawn and true Backup status",
            "Disclose source as public market data, not MLS",
        ],
    }
