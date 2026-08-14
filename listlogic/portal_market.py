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
import threading
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
# Credit-aware defaults (each realtor sold/search page ≈ 2 credits)
PREVIEW_SOLD_PAGES = 2
PREVIEW_ACTIVE_PAGES = 1
GENERATE_SOLD_PAGES = 6
GENERATE_ACTIVE_PAGES = 3
PREVIEW_CALL_BUDGET = 4          # hard cap on Reef calls for preview
GENERATE_CALL_BUDGET = 12        # hard cap on Reef calls for generate market pull
SUBJECT_CALL_BUDGET = 2          # at most 2 Reef calls per subject autofill
PREVIEW_CACHE_TTL_SEC = 15 * 60
SUBJECT_CACHE_TTL_SEC = 7 * 24 * 3600

_DATA_ROOT = Path(os.environ.get("LISTLOGIC_DATA_DIR") or "/data")
if not _DATA_ROOT.exists():
    _DATA_ROOT = ROOT
_SUBJECT_CACHE_DIR = _DATA_ROOT / "output" / "subject_cache"
_PREVIEW_CACHE: dict[str, tuple[float, pd.DataFrame]] = {}
_reef_budget = threading.local()


def set_reef_call_budget(n: int | None) -> None:
    """Limit Reef calls for the current request (None = unlimited)."""
    _reef_budget.remaining = n


def get_reef_call_budget() -> int | None:
    return getattr(_reef_budget, "remaining", None)


def _consume_reef_budget() -> None:
    remaining = getattr(_reef_budget, "remaining", None)
    if remaining is None:
        return
    if remaining <= 0:
        raise ReefApiError(
            "Market search hit its credit budget for this request. "
            "Tighten the map/filters, or use Upload with an MLS export.",
            code="BUDGET",
        )
    _reef_budget.remaining = remaining - 1


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


class ReefApiError(RuntimeError):
    """ReefAPI call failed with a classified, UI-friendly message."""

    def __init__(self, message: str, *, code: str = "REEF_ERROR", status: int | None = None):
        super().__init__(message)
        self.code = code
        self.status = status


def friendly_portal_error(exc: BaseException) -> str:
    """Map portal/Reef failures to short agent-facing copy."""
    if isinstance(exc, ReefApiError):
        return str(exc)
    text = str(exc or "")
    low = text.lower()
    if "quota" in low or "402" in low or "payment required" in low:
        return (
            "Market search quota is used up for now (free-plan limit). "
            "Wait for the monthly reset, upgrade the ReefAPI plan, or switch to Upload with an MLS export."
        )
    if "credit budget" in low or "budget" in low:
        return (
            "Market search hit its credit budget for this request. "
            "Tighten the map/filters, or use Upload with an MLS export."
        )
    if "reef_api_key" in low or "not configured" in low:
        return "Market search isn’t configured on this server (missing API key)."
    if "timed out" in low or "timeout" in low:
        return "Market search timed out — try a smaller map area or fewer filters."
    if text.startswith("Portal market pull failed:"):
        return friendly_portal_error(RuntimeError(text.split(":", 1)[-1].strip()))
    if "ReefAPI" in text or "HTTP" in text:
        return "Market search failed temporarily. Try again in a minute, or use Upload."
    return text or "Market search failed."


def reef_call(engine: str, action: str, params: dict | None = None, timeout: int = 60) -> dict:
    _consume_reef_budget()
    key = _api_key()
    if not key:
        raise ReefApiError(
            "Market search isn’t configured on this server (missing API key).",
            code="NO_KEY",
        )
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
        detail = exc.read().decode("utf-8", errors="replace")[:800]
        code = "HTTP_ERROR"
        try:
            parsed = json.loads(detail)
            err = (parsed.get("error") or {}) if isinstance(parsed, dict) else {}
            code = str(err.get("code") or code)
        except Exception:
            parsed = None
        if exc.code == 402 or code.upper() in ("QUOTA_EXCEEDED", "PAYMENT_REQUIRED", "INSUFFICIENT_CREDITS"):
            raise ReefApiError(
                "Market search quota is used up for now (free-plan limit). "
                "Wait for the monthly reset, upgrade the ReefAPI plan, or switch to Upload with an MLS export.",
                code="QUOTA_EXCEEDED",
                status=402,
            ) from exc
        if exc.code in (401, 403):
            raise ReefApiError(
                "Market search API key was rejected — check REEF_API_KEY on the server.",
                code="AUTH",
                status=exc.code,
            ) from exc
        raise ReefApiError(
            f"Market search failed ({engine}/{action}, HTTP {exc.code}). Try again shortly or use Upload.",
            code=code,
            status=exc.code,
        ) from exc


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
    list_date = item.get("list_date") or item.get("listed_date") or item.get("on_market_date")
    # Realtor search/sold cards omit days_on_market; derive from list + sold/today.
    dom = item.get("days_on_market")
    if dom is None:
        dom = item.get("dom") or item.get("daysOnMarket")
    if dom is None:
        list_ts = _parse_date(list_date)
        end_ts = _parse_date(sold_date) if status == "Sold" else pd.Timestamp.now(tz="UTC")
        if list_ts is not None and end_ts is not None:
            try:
                def _as_naive_day(ts):
                    t = pd.Timestamp(ts)
                    if getattr(t, "tz", None) is not None:
                        t = t.tz_convert("UTC").tz_localize(None)
                    return t.normalize()

                days = int((_as_naive_day(end_ts) - _as_naive_day(list_ts)).days)
                if days >= 0:
                    dom = days
            except Exception:
                dom = None
    try:
        dom = int(dom) if dom is not None and dom != "" else None
    except (TypeError, ValueError):
        dom = None
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
    try:
        from reef_photos import upgrade_listing_photo_url
        photo = upgrade_listing_photo_url(str(photo or ""))
    except Exception:
        if isinstance(photo, str) and photo.startswith("http://"):
            photo = "https://" + photo[7:]

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
        "DOM": dom,
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
        try:
            envelope = reef_call("realtor", "sold", params)
        except ReefApiError as exc:
            if getattr(exc, "code", "") == "BUDGET" and all_items:
                logger.info("Sold fetch stopped early on budget (%s kept)", len(all_items))
                break
            raise
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
        if get_reef_call_budget() == 0:
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
        try:
            envelope = reef_call("realtor", "search", params)
        except ReefApiError as exc:
            if getattr(exc, "code", "") == "BUDGET" and all_items:
                logger.info("Active fetch stopped early on budget (%s kept)", len(all_items))
                break
            raise
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
        if get_reef_call_budget() == 0:
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
    min_lot_sqft: float | None = None,
    max_lot_sqft: float | None = None,
    min_year_built: int | None = None,
    max_year_built: int | None = None,
    sold_pages: int = GENERATE_SOLD_PAGES,
    active_pages: int = GENERATE_ACTIVE_PAGES,
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
    solds = fetch_realtor_solds(
        location,
        lookback_days=lookback_days,
        max_pages=max(1, int(sold_pages)),
        **common,
    )
    actives = fetch_realtor_actives(
        location,
        max_pages=max(1, int(active_pages)),
        **common,
    )
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

    # Lot size (sqft) — keep unknowns unless a bound is set and value is known out of range.
    if len(df) and (min_lot_sqft is not None or max_lot_sqft is not None):
        lot = pd.to_numeric(df.get("LotSize"), errors="coerce")
        if "Acres" in df.columns:
            acres = pd.to_numeric(df["Acres"], errors="coerce")
            lot = lot.fillna(acres * 43560.0)
        keep = pd.Series(True, index=df.index)
        if min_lot_sqft is not None:
            keep &= lot.isna() | (lot >= float(min_lot_sqft))
        if max_lot_sqft is not None:
            keep &= lot.isna() | (lot <= float(max_lot_sqft))
        df = df[keep].reset_index(drop=True)

    if len(df) and (min_year_built is not None or max_year_built is not None):
        yr = pd.to_numeric(df.get("YearBuilt"), errors="coerce")
        keep = pd.Series(True, index=df.index)
        if min_year_built is not None:
            keep &= yr.isna() | (yr >= int(min_year_built))
        if max_year_built is not None:
            keep &= yr.isna() | (yr <= int(max_year_built))
        df = df[keep].reset_index(drop=True)

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
    "min_lot_sqft": None,
    "max_lot_sqft": None,
    "min_year_built": None,
    "max_year_built": None,
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
            "min_lot_sqft", "max_lot_sqft", "min_year_built", "max_year_built",
        ):
            base[k] = v
    # Coerce numerics
    for ik in (
        "price_min", "price_max", "min_beds", "max_beds", "min_sqft", "max_sqft",
        "lookback_days", "min_year_built", "max_year_built",
    ):
        if base.get(ik) is not None:
            try:
                base[ik] = int(float(base[ik]))
            except (TypeError, ValueError):
                pass
    for fk in ("min_baths", "max_baths", "min_garage", "min_lot_sqft", "max_lot_sqft"):
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


def _criteria_cache_key(c: dict, *, mode: str) -> str:
    payload = {
        "mode": mode,
        "location": c.get("location"),
        "dwelling": c.get("dwelling"),
        "lookback_days": c.get("lookback_days"),
        "price_min": c.get("price_min"),
        "price_max": c.get("price_max"),
        "min_beds": c.get("min_beds"),
        "max_beds": c.get("max_beds"),
        "min_baths": c.get("min_baths"),
        "max_baths": c.get("max_baths"),
        "min_sqft": c.get("min_sqft"),
        "max_sqft": c.get("max_sqft"),
        "min_garage": c.get("min_garage"),
        "min_lot_sqft": c.get("min_lot_sqft"),
        "max_lot_sqft": c.get("max_lot_sqft"),
        "min_year_built": c.get("min_year_built"),
        "max_year_built": c.get("max_year_built"),
        "map_bounds": c.get("map_bounds"),
        "polygon_ring": c.get("polygon_ring"),
    }
    return json.dumps(payload, sort_keys=True, default=str)


def build_portal_from_criteria(criteria: dict, *, mode: str = "generate") -> pd.DataFrame:
    """Build market frame from a criteria dict (API/UI shape).

    mode:
      - preview  → cheap (few pages + short cache + tight call budget)
      - generate → fuller pull with a hard call budget
    """
    c = parse_portal_criteria(criteria)
    location = str(c.get("location") or "").strip()
    if not location:
        raise ValueError("location is required (city, ZIP, or address area)")
    polygon = c.get("polygon_ring")
    bounds = c.get("map_bounds")
    if polygon and not bounds:
        bounds = bounds_from_ring(polygon)

    mode_l = (mode or "generate").strip().lower()
    if mode_l == "preview":
        sold_pages, active_pages = PREVIEW_SOLD_PAGES, PREVIEW_ACTIVE_PAGES
        budget = PREVIEW_CALL_BUDGET
        cache_key = _criteria_cache_key({**c, "map_bounds": bounds, "polygon_ring": polygon}, mode="preview")
        hit = _PREVIEW_CACHE.get(cache_key)
        if hit and (time.time() - hit[0]) < PREVIEW_CACHE_TTL_SEC:
            logger.info("Portal preview cache hit for %s", location)
            return hit[1].copy()
    else:
        sold_pages, active_pages = GENERATE_SOLD_PAGES, GENERATE_ACTIVE_PAGES
        budget = GENERATE_CALL_BUDGET
        cache_key = None

    prev = get_reef_call_budget()
    set_reef_call_budget(budget)
    try:
        df = build_portal_market(
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
            min_lot_sqft=c.get("min_lot_sqft"),
            max_lot_sqft=c.get("max_lot_sqft"),
            min_year_built=c.get("min_year_built"),
            max_year_built=c.get("max_year_built"),
            sold_pages=sold_pages,
            active_pages=active_pages,
        )
    finally:
        set_reef_call_budget(prev)

    if cache_key is not None:
        _PREVIEW_CACHE[cache_key] = (time.time(), df.copy())
        # Bound memory
        if len(_PREVIEW_CACHE) > 40:
            oldest = sorted(_PREVIEW_CACHE.items(), key=lambda kv: kv[1][0])[:10]
            for k, _ in oldest:
                _PREVIEW_CACHE.pop(k, None)
    return df


_STREET_STOPWORDS = {
    "st", "street", "ave", "avenue", "rd", "road", "dr", "drive", "ln", "lane",
    "ct", "court", "blvd", "boulevard", "way", "cir", "circle", "pl", "place",
    "n", "s", "e", "w", "ne", "nw", "se", "sw", "north", "south", "east", "west",
    "co", "colorado", "usa", "united", "states", "of", "the",
}


def _normalize_street_parts(text: str) -> tuple[str, set[str]]:
    raw = (text or "").lower().replace(".", " ").replace(",", " ").replace("#", " ")
    raw = re.sub(r"[^a-z0-9\s-]", " ", raw)
    parts = [p for p in re.split(r"\s+", raw) if p]
    house = next((p for p in parts if re.match(r"^\d+[a-z]?$", p)), "")
    tokens = {p for p in parts if p not in _STREET_STOPWORDS and not re.match(r"^\d+[a-z]?$", p)}
    return house, tokens


def _address_match_score(target: str, candidate: str) -> float:
    t_house, t_tokens = _normalize_street_parts(target)
    c_house, c_tokens = _normalize_street_parts(candidate)
    if not t_house or t_house != c_house:
        return 0.0
    if not t_tokens:
        return 0.55
    overlap = len(t_tokens & c_tokens)
    if overlap == 0:
        return 0.0
    return 0.55 + 0.45 * (overlap / max(len(t_tokens), 1))


def _facts_from_listing_item(item: dict) -> dict[str, Any]:
    baths = item.get("baths")
    if baths is None:
        full = item.get("baths_full") or 0
        half = item.get("baths_half") or 0
        baths = float(full) + 0.5 * float(half) if (full or half) else None
    sqft = item.get("sqft") or item.get("living_area")
    year = item.get("year_built")
    beds = item.get("beds")
    try:
        beds_n = float(beds) if beds is not None and beds != "" else None
    except (TypeError, ValueError):
        beds_n = None
    try:
        baths_n = float(baths) if baths is not None and baths != "" else None
    except (TypeError, ValueError):
        baths_n = None
    try:
        sqft_n = float(sqft) if sqft is not None and sqft != "" else None
    except (TypeError, ValueError):
        sqft_n = None
    try:
        year_n = int(float(year)) if year is not None and year != "" else None
    except (TypeError, ValueError):
        year_n = None
    list_price = item.get("list_price_usd") or item.get("price") or item.get("last_sold_price_usd")
    try:
        price_n = float(list_price) if list_price not in (None, "") else None
    except (TypeError, ValueError):
        price_n = None
    garage = item.get("garage") or item.get("garage_spaces") or item.get("garages")
    try:
        garage_n = float(garage) if garage is not None and garage != "" else None
    except (TypeError, ValueError):
        garage_n = None
    lot = item.get("lot_sqft") or item.get("lot_size")
    try:
        lot_n = float(lot) if lot is not None and lot != "" else None
    except (TypeError, ValueError):
        lot_n = None
    acres = item.get("acres") or item.get("lot_acres")
    try:
        acres_n = float(acres) if acres is not None and acres != "" else None
    except (TypeError, ValueError):
        acres_n = None
    if acres_n is None and lot_n is not None and lot_n > 0:
        acres_n = round(lot_n / 43560.0, 4)
    if lot_n is None and acres_n is not None and acres_n > 0:
        lot_n = round(acres_n * 43560.0)
    photo = item.get("primary_photo_url") or item.get("photo_url") or item.get("primary_photo") or ""
    if not photo:
        photos = item.get("photos") or []
        if isinstance(photos, list) and photos:
            first = photos[0]
            photo = first if isinstance(first, str) else (first or {}).get("href") or (first or {}).get("url") or ""
    try:
        from reef_photos import upgrade_listing_photo_url
        photo = upgrade_listing_photo_url(str(photo or ""))
    except Exception:
        if isinstance(photo, str) and photo.startswith("http://"):
            photo = "https://" + photo[7:]
    return {
        "beds": beds_n,
        "baths": baths_n,
        "living_area": sqft_n,
        "year_built": year_n,
        "list_price": price_n,
        "garage_spaces": garage_n,
        "lot_size": lot_n,
        "acres": acres_n,
        "photo_url": str(photo) if photo else None,
        "property_id": str(item.get("property_id") or item.get("zpid") or item.get("listing_id") or "") or None,
        "matched_address": item.get("address_line") or item.get("address") or "",
        "latitude": item.get("latitude"),
        "longitude": item.get("longitude"),
        "city": item.get("city") or "",
        "subdivision": item.get("neighborhood") or item.get("subdivision") or "",
        "property_type": item.get("property_type") or item.get("sub_type") or "",
    }


def _pick_best_listing(address: str, items: list[dict]) -> dict | None:
    scored: list[tuple[float, dict]] = []
    for item in items:
        cand = item.get("address_line") or item.get("address") or ""
        score = _address_match_score(address, str(cand))
        if score >= 0.55:
            scored.append((score, item))
    if not scored:
        return None
    scored.sort(key=lambda x: x[0], reverse=True)
    return scored[0][1]


def _subject_demo_fallback(address: str) -> dict | None:
    """Known demo subject when live portals are unavailable."""
    raw = (address or "").lower()
    if "2845" not in raw or "greeley" not in raw:
        return None
    if "13" not in raw:
        return None
    try:
        from subject import SUBJECT_2845_DEFAULTS
    except Exception:
        return None
    d = SUBJECT_2845_DEFAULTS
    return {
        "found": True,
        "autofilled": True,
        "beds": d.get("beds"),
        "baths": d.get("baths"),
        "living_area": d.get("living_area"),
        "year_built": d.get("year_built"),
        "list_price": d.get("list_price"),
        "garage_spaces": d.get("garage_spaces"),
        "lot_size": d.get("lot_size"),
        "acres": d.get("acres"),
        "subdivision": d.get("subdivision"),
        "style": d.get("style"),
        "photo_url": d.get("photo_url"),
        "matched_address": d.get("address"),
        "property_id": None,
        "latitude": None,
        "longitude": None,
    }


def _subject_cache_path(address: str) -> Path:
    key = re.sub(r"[^a-z0-9]+", "-", (address or "").lower()).strip("-")[:80] or "addr"
    return _SUBJECT_CACHE_DIR / f"{key}.json"


def _read_subject_cache(address: str) -> dict | None:
    path = _subject_cache_path(address)
    if not path.exists():
        return None
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None
    if not isinstance(data, dict) or not data.get("found"):
        return None
    fetched = float(data.get("_cached_at") or 0)
    if fetched and (time.time() - fetched) > SUBJECT_CACHE_TTL_SEC:
        return None
    return data


def _write_subject_cache(address: str, payload: dict) -> None:
    try:
        _SUBJECT_CACHE_DIR.mkdir(parents=True, exist_ok=True)
        out = dict(payload)
        out["_cached_at"] = time.time()
        out["_cache_query"] = address
        _subject_cache_path(address).write_text(json.dumps(out, indent=2), encoding="utf-8")
    except OSError:
        logger.info("Subject cache write failed")


def lookup_subject_property(address: str) -> dict[str, Any]:
    """Resolve subject facts via Mapbox + one/two cheap portal card lookups.

    Credits: Mapbox geocode is free for us; Reef is budgeted (≤2 calls) and
    results are disk-cached for a week so repeat address picks cost ~0.
    """
    q = (address or "").strip()
    if not q:
        return {"found": False, "reason": "address required"}

    cached = _read_subject_cache(q)
    if cached:
        cached = dict(cached)
        cached["from_cache"] = True
        return cached

    geo: dict[str, Any] = {}
    try:
        geo = geocode_location(q)  # Mapbox — no Reef credits
    except Exception as exc:
        logger.info("Subject geocode soft-fail: %s", exc)

    lat = geo.get("latitude")
    lng = geo.get("longitude")
    loc = str(geo.get("location") or q)
    errors: list[str] = []
    best: dict | None = None

    prev = get_reef_call_budget()
    set_reef_call_budget(SUBJECT_CALL_BUDGET)
    try:
        if lat is not None and lng is not None:
            pad = 0.008
            bounds = {
                "west": float(lng) - pad,
                "east": float(lng) + pad,
                "south": float(lat) - pad,
                "north": float(lat) + pad,
            }
            # Prefer solds first (richer year/garage); fall back to for-sale once.
            for action, extra in (
                ("sold", {"location": loc, "map_bounds": bounds, "limit": 40}),
                ("search", {"location": loc, "map_bounds": bounds, "limit": 40, "status": "for_sale"}),
            ):
                try:
                    envelope = reef_call("realtor", action, extra, timeout=45)
                    data = envelope.get("data") or {}
                    items = data.get("results") or data.get("items") or []
                    hit = _pick_best_listing(q, items if isinstance(items, list) else [])
                    if hit:
                        best = hit
                        break
                except ReefApiError as exc:
                    errors.append(f"realtor/{action}: {exc.code}")
                    logger.info("Subject realtor %s soft-fail: %s", action, exc)
                    if getattr(exc, "code", "") in ("QUOTA_EXCEEDED", "BUDGET", "NO_KEY"):
                        break
                except Exception as exc:
                    errors.append(f"realtor/{action}: {exc}")
                    logger.info("Subject realtor %s soft-fail: %s", action, exc)
    finally:
        set_reef_call_budget(prev)

    geo_block = {
        "location": loc,
        "latitude": lat,
        "longitude": lng,
        "place_name": geo.get("place_name"),
    }

    if best is None:
        demo = _subject_demo_fallback(q)
        if demo:
            demo["geocode"] = geo_block
            _write_subject_cache(q, demo)
            return demo
        return {
            "found": False,
            "reason": "Could not match this address to a public listing card",
            "errors": errors[:3],
            "geocode": geo_block,
        }

    facts = _facts_from_listing_item(best)
    # Prefer Mapbox coords when listing coords are missing.
    if facts.get("latitude") is None:
        facts["latitude"] = lat
    if facts.get("longitude") is None:
        facts["longitude"] = lng
    out = {
        "found": True,
        "autofilled": True,
        **facts,
        "geocode": geo_block,
    }
    _write_subject_cache(q, out)
    return out


