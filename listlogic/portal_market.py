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
import re
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

# Realtor.com UI: House | Condo | Townhome
# ListLogic maps those to dwelling class for like-for-like comps.
DWELLING_DETACHED = "detached"  # House
DWELLING_ATTACHED = "attached"  # Condo + Townhome
HOME_TYPE_HOUSE = "single_family"
HOME_TYPE_ATTACHED = "condos,townhomes"


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
    flags = item.get("flags") if isinstance(item.get("flags"), dict) else {}
    status = status_force or str(item.get("status") or "Sold")
    status = status.strip().title()
    if status.lower() in ("for_sale", "forsale", "for sale"):
        # Realtor folds UC into for_sale; promote pending/contingent flags.
        if flags.get("is_pending") or flags.get("is_contingent"):
            status = "Pending"
        else:
            status = "Active"
    elif status.lower() in ("sold", "recently_sold", "closed"):
        status = "Sold"
    elif status.lower() in ("pending", "contingent"):
        status = "Pending"

    sold_price = item.get("last_sold_price_usd") or item.get("sold_price_usd")
    list_price = item.get("list_price_usd") or item.get("price")
    # Some metros omit last_sold_price on sold cards; list/price is the close amount.
    if status == "Sold" and not sold_price:
        sold_price = list_price
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

    prop_type = str(item.get("property_type") or item.get("sub_type") or "").lower()
    dwelling = classify_dwelling(item)

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
        "PropertyType": prop_type,
        "DwellingClass": dwelling,
        "_source": "realtor",
        "_url": item.get("url") or "",
        "_flags": flags,
    }


def home_type_for_dwelling(dwelling: str) -> str:
    """Map ListLogic dwelling class → Realtor.com home_type filter."""
    d = (dwelling or DWELLING_DETACHED).strip().lower()
    if d in ("attached", "condo", "condos", "townhome", "townhomes", "townhouse"):
        return HOME_TYPE_ATTACHED
    # house / detached / single_family / sfr
    return HOME_TYPE_HOUSE


def classify_dwelling(item: dict | pd.Series) -> str:
    """Classify as detached (House) or attached (Condo/Townhome).

    Realtor.com UI options: House, Condo, Townhome.
    Condo + Townhome compete together; House is the detached set.
    """
    if isinstance(item, dict):
        addr = str(
            item.get("address_line")
            or item.get("address")
            or item.get("Address")
            or item.get("StName")
            or ""
        )
        ptype = str(
            item.get("property_type")
            or item.get("sub_type")
            or item.get("PropertyType")
            or item.get("home_type")
            or ""
        ).lower()
        style = str(item.get("style") or item.get("Style") or item.get("Type") or "").lower()
    else:
        addr = str(item.get("Address") or item.get("StName") or "")
        ptype = str(item.get("PropertyType") or item.get("DwellingClass") or "").lower()
        style = str(item.get("Style") or item.get("Type") or "").lower()

    addr_u = addr.upper()
    # Unit/Apt addresses are attached product even when mis-tagged as single_family.
    if re.search(r"\bUNIT\b|\bAPT\b|\bAPARTMENT\b|#\s*\d+", addr_u):
        return DWELLING_ATTACHED

    blob = f"{ptype} {style}"
    if any(
        tok in blob
        for tok in (
            "condo",
            "cooper",
            "townhome",
            "townhouse",
            "town home",
            "apartment",
            "duplex",
            "triplex",
            "multi_family",
            "multifamily",
        )
    ):
        # Explicit "Condo(Detached Only)" from Matrix stays detached.
        if "detached only" in blob or "detached condo" in blob:
            return DWELLING_DETACHED
        return DWELLING_ATTACHED

    if any(tok in blob for tok in ("single_family", "single family", "house", "detached")):
        return DWELLING_DETACHED

    # Default: treat as house/detached (Matrix SFR farm comps).
    return DWELLING_DETACHED


def _is_condo_like(item: dict | pd.Series) -> bool:
    """Backward-compatible alias: True when dwelling is attached."""
    return classify_dwelling(item) == DWELLING_ATTACHED


def _passes_filters(
    item: dict,
    *,
    min_sqft: int | None,
    max_sqft: int | None,
    min_beds: int | None,
    max_beds: int | None,
    min_baths: float | None,
    max_baths: float | None,
    price_min: int | None = None,
    price_max: int | None = None,
    min_garage: float | None = None,
    dwelling: str | None = DWELLING_DETACHED,
    require_garage_known: bool = False,
) -> bool:
    if dwelling:
        want = DWELLING_ATTACHED if dwelling == DWELLING_ATTACHED else DWELLING_DETACHED
        if classify_dwelling(item) != want:
            return False
    sqft = item.get("sqft") or item.get("living_area")
    try:
        sqft_n = float(sqft) if sqft is not None else None
    except (TypeError, ValueError):
        sqft_n = None
    if min_sqft is not None and (sqft_n is None or sqft_n < min_sqft):
        return False
    if max_sqft is not None and (sqft_n is None or sqft_n > max_sqft):
        return False
    beds = item.get("beds")
    try:
        beds_n = float(beds) if beds is not None else None
    except (TypeError, ValueError):
        beds_n = None
    if min_beds is not None and (beds_n is None or beds_n < min_beds):
        return False
    if max_beds is not None and (beds_n is None or beds_n > max_beds):
        return False
    baths = item.get("baths")
    if baths is None:
        full = item.get("baths_full") or 0
        half = item.get("baths_half") or 0
        baths = float(full) + 0.5 * float(half) if (full or half) else None
    try:
        baths_n = float(baths) if baths is not None else None
    except (TypeError, ValueError):
        baths_n = None
    if min_baths is not None and (baths_n is None or baths_n < min_baths):
        return False
    if max_baths is not None and (baths_n is None or baths_n > max_baths):
        return False

    # Price: for active/for_sale cards use LIST price only.
    # last_sold_price_usd is a prior closing (often decades-old) and must not
    # gate current inventory filters.
    status_l = str(item.get("status") or "").lower()
    if status_l in ("for_sale", "forsale", "for sale", "ready_to_build", "coming_soon"):
        price = item.get("list_price_usd") or item.get("price")
    elif status_l in ("sold", "recently_sold", "closed"):
        price = item.get("last_sold_price_usd") or item.get("sold_price_usd") or item.get("list_price_usd")
    else:
        # Pending/contingent still listed — use list price.
        price = (
            item.get("list_price_usd")
            or item.get("price")
            or item.get("last_sold_price_usd")
            or item.get("sold_price_usd")
        )
    try:
        price_n = float(price) if price is not None else None
    except (TypeError, ValueError):
        price_n = None
    if price_min is not None and (price_n is None or price_n < price_min):
        return False
    if price_max is not None and (price_n is None or price_n > price_max):
        return False

    garage = item.get("garage")
    try:
        garage_n = float(garage) if garage is not None and garage != "" else None
    except (TypeError, ValueError):
        garage_n = None
    if min_garage is not None:
        if garage_n is None:
            if require_garage_known:
                return False
            # If garage unknown, keep (portal often omits); when known must meet min.
        elif garage_n < min_garage:
            return False
    return True


def _normalize_frame(rows: list[dict]) -> pd.DataFrame:
    if not rows:
        return pd.DataFrame()
    from market_schema import normalize_market_frame
    df = pd.DataFrame(rows)
    # Portal rows already put full address in StName; ensure Address exists.
    if "Address" not in df.columns and "StName" in df.columns:
        df["Address"] = df["StName"].fillna("").astype(str).str.strip()
    return normalize_market_frame(df, source="realtor")


def fetch_realtor_solds(
    location: str,
    *,
    lookback_days: int = DEFAULT_LOOKBACK_DAYS,
    min_sqft: int | None = None,
    max_sqft: int | None = None,
    min_beds: int | None = None,
    max_beds: int | None = None,
    min_baths: float | None = None,
    max_baths: float | None = None,
    price_min: int | None = None,
    price_max: int | None = None,
    min_garage: float | None = None,
    require_garage_known: bool = False,
    home_type: str | None = None,
    dwelling: str = DWELLING_DETACHED,
    map_bounds: dict | None = None,
    max_pages: int = MAX_PAGES,
) -> list[dict]:
    cutoff = datetime.now(timezone.utc) - timedelta(days=lookback_days)
    cutoff_naive = cutoff.replace(tzinfo=None)
    resolved_home_type = home_type or home_type_for_dwelling(dwelling)
    all_items: list[dict] = []
    offset = 0
    for page in range(max_pages):
        params: dict[str, Any] = {
            "location": location,
            "sort": "sold_date",
            "limit": PAGE_LIMIT,
            "offset": offset,
            "home_type": resolved_home_type,
        }
        if min_sqft is not None:
            params["sqft_min"] = int(min_sqft)
        if max_sqft is not None:
            params["sqft_max"] = int(max_sqft)
        if min_beds is not None:
            params["beds_min"] = int(min_beds)
        if max_beds is not None:
            params["beds_max"] = int(max_beds)
        if min_baths is not None:
            params["baths_min"] = float(min_baths)
        if price_min is not None:
            params["price_min"] = int(price_min)
        if price_max is not None:
            params["price_max"] = int(price_max)
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
            if not _passes_filters(
                it,
                min_sqft=min_sqft,
                max_sqft=max_sqft,
                min_beds=min_beds,
                max_beds=max_beds,
                min_baths=min_baths,
                max_baths=max_baths,
                price_min=price_min,
                price_max=price_max,
                min_garage=min_garage,
                require_garage_known=require_garage_known,
                dwelling=dwelling,
            ):
                continue
            all_items.append(it)
        logger.info(
            "Realtor solds page %s offset=%s got=%s kept_total=%s home_type=%s dwelling=%s",
            page + 1, offset, len(items), len(all_items), resolved_home_type, dwelling,
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
    min_beds: int | None = None,
    max_beds: int | None = None,
    min_baths: float | None = None,
    max_baths: float | None = None,
    price_min: int | None = None,
    price_max: int | None = None,
    min_garage: float | None = None,
    require_garage_known: bool = False,
    home_type: str | None = None,
    dwelling: str = DWELLING_DETACHED,
    map_bounds: dict | None = None,
    max_pages: int = 5,
) -> list[dict]:
    resolved_home_type = home_type or home_type_for_dwelling(dwelling)
    all_items: list[dict] = []
    offset = 0
    for page in range(max_pages):
        params: dict[str, Any] = {
            "location": location,
            "status": "for_sale",
            "sort": "newest",
            "limit": PAGE_LIMIT,
            "offset": offset,
            "home_type": resolved_home_type,
        }
        if min_sqft is not None:
            params["sqft_min"] = int(min_sqft)
        if max_sqft is not None:
            params["sqft_max"] = int(max_sqft)
        if min_beds is not None:
            params["beds_min"] = int(min_beds)
        if max_beds is not None:
            params["beds_max"] = int(max_beds)
        if min_baths is not None:
            params["baths_min"] = float(min_baths)
        if price_min is not None:
            params["price_min"] = int(price_min)
        if price_max is not None:
            params["price_max"] = int(price_max)
        if map_bounds:
            params["map_bounds"] = map_bounds
        envelope = reef_call("realtor", "search", params)
        data = envelope.get("data") or {}
        items = data.get("results") or data.get("items") or []
        if not items:
            break
        for it in items:
            if not _passes_filters(
                it,
                min_sqft=min_sqft,
                max_sqft=max_sqft,
                min_beds=min_beds,
                max_beds=max_beds,
                min_baths=min_baths,
                max_baths=max_baths,
                price_min=price_min,
                price_max=price_max,
                min_garage=min_garage,
                require_garage_known=require_garage_known,
                dwelling=dwelling,
            ):
                continue
            all_items.append(it)
        logger.info(
            "Realtor actives page %s offset=%s got=%s kept_total=%s home_type=%s dwelling=%s",
            page + 1, offset, len(items), len(all_items), resolved_home_type, dwelling,
        )
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
    min_beds: int | None = None,
    max_beds: int | None = None,
    min_baths: float | None = None,
    max_baths: float | None = None,
    price_min: int | None = None,
    price_max: int | None = None,
    min_garage: float | None = None,
    require_garage_known: bool = False,
    home_type: str | None = None,
    dwelling: str = DWELLING_DETACHED,
    map_bounds: dict | None = None,
    polygon_ring: list[list[float]] | None = None,
) -> pd.DataFrame:
    """Build market frame from Realtor.com.

    dwelling:
      - detached → Realtor "House" (single_family)
      - attached → Realtor "Condo" + "Townhome"
    Always compare like-for-like with the subject property's dwelling class.
    """
    bounds = map_bounds
    if polygon_ring:
        ring_bounds = bounds_from_ring(polygon_ring)
        if ring_bounds:
            # Prefer polygon-derived bounds so a stray viewport never fights the drawn shape.
            bounds = ring_bounds
        elif not bounds:
            bounds = None

    want = DWELLING_ATTACHED if str(dwelling).lower() in (
        "attached", "condo", "condos", "townhome", "townhomes", "townhouse",
    ) else DWELLING_DETACHED
    resolved_home_type = home_type or home_type_for_dwelling(want)

    common = dict(
        min_sqft=min_sqft,
        max_sqft=max_sqft,
        min_beds=min_beds,
        max_beds=max_beds,
        min_baths=min_baths,
        max_baths=max_baths,
        price_min=price_min,
        price_max=price_max,
        min_garage=min_garage,
        require_garage_known=require_garage_known,
        home_type=resolved_home_type,
        dwelling=want,
        map_bounds=bounds,
    )
    solds = fetch_realtor_solds(location, lookback_days=lookback_days, **common)
    actives = fetch_realtor_actives(location, **common)
    # Solds forced Sold; for-sale rows keep Active/Pending from flags.
    rows = [_realtor_item_to_row(i, status_force="Sold") for i in solds]
    rows += [_realtor_item_to_row(i, status_force=None) for i in actives]
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

    # Final dwelling scrub (catches House-tagged units / townhomes).
    if len(df):
        keep = df.apply(lambda r: classify_dwelling(r) == want, axis=1)
        df = df[keep].reset_index(drop=True)
        df["DwellingClass"] = want

    # Post-clip garage enforcement (unknown garage dropped when required).
    if len(df) and min_garage is not None:
        gar = pd.to_numeric(df.get("GarSpaces"), errors="coerce")
        if require_garage_known:
            df = df[gar.notna() & (gar >= float(min_garage))].reset_index(drop=True)
        else:
            df = df[gar.isna() | (gar >= float(min_garage))].reset_index(drop=True)

    df.attrs["source"] = "realtor"
    df.attrs["lookback_days"] = lookback_days
    df.attrs["location"] = location
    df.attrs["dwelling"] = want
    df.attrs["home_type"] = resolved_home_type
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


# Defaults inspired by Matrix Criteria Summary (editable per run).
DEFAULT_PORTAL_CRITERIA: dict[str, Any] = {
    "dwelling": DWELLING_DETACHED,
    "price_min": 300_000,
    "price_max": 450_000,
    "min_beds": 3,
    "max_beds": 6,
    "min_baths": 2.0,
    "max_baths": 4.0,
    "min_sqft": 1700,
    "max_sqft": 2900,
    "min_garage": 1,
    "require_garage_known": False,
    "lookback_days": 730,
}


def _mapbox_token() -> str:
    for key in ("MAPBOX_ACCESS_TOKEN", "MAPBOX_TOKEN", "VITE_MAPBOX_TOKEN"):
        val = (os.environ.get(key) or "").strip()
        if val:
            return val
    env_path = ROOT / ".env"
    if env_path.exists():
        try:
            for line in env_path.read_text(encoding="utf-8").splitlines():
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                name, raw = line.split("=", 1)
                if name.strip() in ("MAPBOX_ACCESS_TOKEN", "MAPBOX_TOKEN", "VITE_MAPBOX_TOKEN"):
                    return raw.strip().strip('"').strip("'")
        except OSError:
            pass
    return ""


def geocode_location(query: str) -> dict:
    """Geocode an address/city/ZIP via Mapbox. Returns center + place label."""
    token = _mapbox_token()
    q = (query or "").strip()
    if not q:
        raise ValueError("location query required")
    if not token:
        # Soft fallback — still usable as Realtor location string
        return {
            "query": q,
            "location": q,
            "longitude": None,
            "latitude": None,
            "place_name": q,
            "bbox": None,
        }
    from urllib.parse import quote

    url = (
        f"https://api.mapbox.com/geocoding/v5/mapbox.places/{quote(q)}.json"
        f"?access_token={token}&limit=1&types=address,place,locality,neighborhood,postcode"
    )
    req = urllib.request.Request(url, headers={"User-Agent": "ListLogic/1.0"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        payload = json.loads(resp.read().decode("utf-8"))
    feats = payload.get("features") or []
    if not feats:
        return {"query": q, "location": q, "longitude": None, "latitude": None, "place_name": q, "bbox": None}
    f0 = feats[0]
    center = f0.get("center") or [None, None]
    ctx = f0.get("context") or []
    place = f0.get("place_name") or q
    # Prefer "City, ST" for Realtor location
    city = None
    region = None
    for c in ctx:
        cid = str(c.get("id") or "")
        if cid.startswith("place"):
            city = c.get("text")
        if cid.startswith("region"):
            region = c.get("short_code") or c.get("text")
            if isinstance(region, str) and region.startswith("US-"):
                region = region[3:]
    loc = q
    if city and region:
        loc = f"{city}, {region}"
    elif place:
        loc = place.split(",")[0] + (", " + place.split(",")[1].strip() if len(place.split(",")) > 1 else "")
    return {
        "query": q,
        "location": loc,
        "longitude": float(center[0]) if center[0] is not None else None,
        "latitude": float(center[1]) if center[1] is not None else None,
        "place_name": place,
        "bbox": f0.get("bbox"),
    }


def parse_portal_criteria(raw: dict | None) -> dict:
    """Merge user criteria onto defaults; coerce types."""
    base = dict(DEFAULT_PORTAL_CRITERIA)
    if not raw:
        return base
    for k, v in raw.items():
        if v is None or v == "":
            continue
        if k in base or k in (
            "location", "map_bounds", "polygon_ring", "require_garage_known",
            "price_min", "price_max", "min_beds", "max_beds", "min_baths", "max_baths",
            "min_sqft", "max_sqft", "min_garage", "lookback_days", "dwelling", "home_type",
        ):
            base[k] = v
    # Coerce numerics
    for ik in ("price_min", "price_max", "min_beds", "max_beds", "min_sqft", "max_sqft", "lookback_days"):
        if base.get(ik) is not None:
            try:
                base[ik] = int(float(base[ik]))
            except (TypeError, ValueError):
                pass
    for fk in ("min_baths", "max_baths", "min_garage"):
        if base.get(fk) is not None:
            try:
                base[fk] = float(base[fk])
            except (TypeError, ValueError):
                pass
    if "require_garage_known" in base:
        base["require_garage_known"] = bool(base["require_garage_known"])
    dwell = str(base.get("dwelling") or DWELLING_DETACHED).lower()
    if dwell in ("house", "sfr", "single_family", "detached"):
        base["dwelling"] = DWELLING_DETACHED
    elif dwell in ("attached", "condo", "condos", "townhome", "townhomes", "townhouse"):
        base["dwelling"] = DWELLING_ATTACHED
    return base


def build_portal_from_criteria(criteria: dict) -> pd.DataFrame:
    """Build market frame from a criteria dict (API/UI shape)."""
    c = parse_portal_criteria(criteria)
    location = str(c.get("location") or "").strip()
    if not location:
        raise ValueError("location is required (city, ZIP, or address area)")
    polygon = c.get("polygon_ring")
    bounds = c.get("map_bounds")
    if polygon and not bounds:
        bounds = bounds_from_ring(polygon)
    return build_portal_market(
        location,
        lookback_days=int(c.get("lookback_days") or DEFAULT_LOOKBACK_DAYS),
        min_sqft=c.get("min_sqft"),
        max_sqft=c.get("max_sqft"),
        min_beds=c.get("min_beds"),
        max_beds=c.get("max_beds"),
        min_baths=c.get("min_baths"),
        max_baths=c.get("max_baths"),
        price_min=c.get("price_min"),
        price_max=c.get("price_max"),
        min_garage=c.get("min_garage"),
        require_garage_known=bool(c.get("require_garage_known")),
        dwelling=str(c.get("dwelling") or DWELLING_DETACHED),
        map_bounds=bounds,
        polygon_ring=polygon,
    )

