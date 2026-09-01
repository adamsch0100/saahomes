"""
ListLogic – Core Analysis Engine
Data-driven custom pricing strategy for listing agents.

Philosophy: Clarity wins listings. Sellers who understand the market
become partners instead of adversaries.
"""

from __future__ import annotations
import pandas as pd
import numpy as np
from datetime import datetime
from pathlib import Path
from dataclasses import dataclass, field, asdict
from typing import Optional, List, Dict, Any, Tuple
from urllib.parse import quote as url_quote
import warnings
warnings.filterwarnings("ignore")


def format_month_label(value: Any, short: bool = False) -> str:
    """Turn '2025-12' / Period / Timestamp into 'December 2025' (or 'Dec 2025')."""
    if value is None:
        return ""
    text = str(value).strip()
    if not text:
        return ""
    try:
        ts = pd.Period(text).to_timestamp() if len(text) <= 7 else pd.Timestamp(text)
        return ts.strftime("%b %Y" if short else "%B %Y")
    except Exception:
        return text


# ---------------------------------------------------------------------------
# Data Models
# ---------------------------------------------------------------------------

@dataclass
class MarketStats:
    area_name: str
    as_of: str
    total_properties: int
    sold_count: int
    active_count: int
    pending_count: int
    expired_withdrawn_count: int
    months_analyzed: float
    absorption_rate: float
    months_of_inventory: float
    odds_of_selling: float
    median_sold_price: float
    avg_sold_price: float
    median_dom: float
    avg_dom: float
    median_price_per_sqft: float
    price_range_25_75: tuple
    year_built_range: tuple
    sqft_range: tuple
    monthly_sales: Dict[str, int] = field(default_factory=dict)
    notes: List[str] = field(default_factory=list)


@dataclass
class SubjectProperty:
    mls_number: Optional[str] = None
    address: str = ""
    list_price: Optional[float] = None
    living_area: float = 0
    beds: float = 0
    baths: float = 0
    year_built: int = 0
    style: str = ""
    subdivision: str = ""
    garage_spaces: float = 0
    lot_size: float = 0                 # sq ft when available
    acres: float = 0
    condition: str = "average"          # needs_work | average | updated | renovated
    dom: Optional[float] = None
    photo_url: str = ""
    latitude: float | None = None
    longitude: float | None = None
    extra: Dict[str, Any] = field(default_factory=dict)


@dataclass
class CompResult:
    mls_number: str
    address: str
    sold_price: float
    living_area: float
    beds: float
    baths: float
    year_built: int
    dom: float
    price_per_sqft: float
    sold_date: str
    distance_score: float               # lower = more similar
    style: str = ""
    subdivision: str = ""
    garage_spaces: float = 0
    lot_size: float = 0
    acres: float = 0
    latitude: float | None = None
    longitude: float | None = None
    city: str = ""
    state: str = "CO"
    photo_url: str = ""


PHOTO_URL_COLUMNS = (
    "PhotoURL", "PrimaryPhotoURL", "PrimaryPhoto", "MediaURL", "Photo",
    "ImageURL", "ListingPhoto", "PhotoLink", "MainPhotoURL", "PhotoUrl",
)


def extract_photo_url(row: pd.Series | dict) -> str:
    """Pull a listing photo URL from optional MLS export columns when present."""
    getter = row.get if hasattr(row, "get") else lambda k, default=None: row[k] if k in row else default
    for key in PHOTO_URL_COLUMNS:
        val = getter(key)
        if val is None or (isinstance(val, float) and pd.isna(val)):
            continue
        text = str(val).strip()
        if text.lower() in {"", "nan", "none", "null"}:
            continue
        if text.startswith(("http://", "https://", "/")):
            return text
    return ""


@dataclass
class PositioningResult:
    subject: SubjectProperty
    recommended_price: float
    price_low: float
    price_high: float
    expected_dom: float
    competitive_statement: str
    closest_comps: List[CompResult]
    narrative: str
    advantages: List[str]
    risks: List[str]
    trend_slope: float
    trend_intercept: float


# ---------------------------------------------------------------------------
# Loader & Cleaner
# ---------------------------------------------------------------------------

def load_export(path: str | Path, *, rename_overrides: dict | None = None) -> pd.DataFrame:
    """Load an MLS export (pipe/csv/tsv) via smart header mapping + normalize."""
    from export_mapper import load_mapped_export

    df, _result = load_mapped_export(path, rename_overrides=rename_overrides)
    return df


def load_export_legacy_matrix(path: str | Path) -> pd.DataFrame:
    """Legacy direct Matrix pipe load (kept for emergency/debug)."""
    df = pd.read_csv(path, sep="|", low_memory=False)
    from market_schema import normalize_market_frame
    return normalize_market_frame(df, source="mls_export")


def load_exports(paths: list[str | Path]) -> pd.DataFrame:
    """Load and merge one or more 71-field MLS exports into a single market frame.

    Dedupes on MLSNumber, keeping the row with the newest LastUpdateDate
    (falls back to ListDate, then first-seen). Use this when an agent uploads
    separate solds / actives / off-market pulls for the same competitive set.
    """
    frames: list[pd.DataFrame] = []
    for path in paths:
        frames.append(load_export(path))
    if not frames:
        raise ValueError("No export files to load")
    if len(frames) == 1:
        return frames[0]
    merged = pd.concat(frames, ignore_index=True, sort=False)
    if "MLSNumber" not in merged.columns:
        return merged
    sort_cols = [c for c in ("LastUpdateDate", "ListDate", "SoldDate") if c in merged.columns]
    if sort_cols:
        merged = merged.sort_values(sort_cols, ascending=False, na_position="last")
    return merged.drop_duplicates(subset=["MLSNumber"], keep="first").reset_index(drop=True)


def filter_market(
    df: pd.DataFrame,
    city: Optional[str] = None,
    zipcode: Optional[str] = None,
    subdivision: Optional[str] = None,
    min_sqft: Optional[float] = None,
    max_sqft: Optional[float] = None,
    min_beds: Optional[int] = None,
) -> pd.DataFrame:
    """Optional secondary cut. Agent-curated MLS uploads are usually already the market —
    pass city=None / blank to use the file as-is."""
    mask = pd.Series(True, index=df.index)
    if city and str(city).strip():
        mask &= df["City"].str.contains(str(city).strip(), case=False, na=False)
    if zipcode:
        mask &= df["ZipCode"].astype(str) == str(zipcode)
    if subdivision:
        mask &= df["Subdivision"].str.contains(subdivision, case=False, na=False)
    if min_sqft:
        mask &= df["LivingArea"] >= min_sqft
    if max_sqft:
        mask &= df["LivingArea"] <= max_sqft
    if min_beds:
        mask &= df["Bdrm"] >= min_beds
    return df[mask].copy()


def _property_key(row: pd.Series) -> str:
    """Stable key for relist detection — tax ID when present, else street + zip."""
    tax = row.get("AssessorCode")
    if pd.notna(tax) and str(tax).strip() and str(tax).strip().lower() not in {"nan", "none"}:
        return f"tax:{str(tax).strip()}"
    num = str(row.get("StNumber") or "").strip().upper()
    name = str(row.get("StName") or "").strip().upper()
    zipc = str(row.get("ZipCode") or "").strip()
    unit = str(row.get("Unit") or "").strip().upper()
    return f"{num}|{name}|{unit}|{zipc}"


def analyze_did_not_sell(
    df: pd.DataFrame,
    relist_window_days: int = 45,
) -> dict:
    """
    Expired + Withdrawn = candidates that did not sell on that listing.

    Fake churn: same property (tax ID or address) comes back Active/Pending/Sold
    with a ListDate within ~relist_window_days of leaving the market.
    True did-not-sell: left and did not quickly reappear.
    """
    failed = df[df["StatusNorm"].isin(["Expired", "Withdrawn"])].copy()
    if failed.empty:
        return {
            "expired_count": 0,
            "withdrawn_count": 0,
            "failed_listing_count": 0,
            "true_did_not_sell": 0,
            "likely_relist_churn": 0,
            "relist_window_days": relist_window_days,
            "note": "No expired or withdrawn listings in this market pull.",
        }

    failed["prop_key"] = failed.apply(_property_key, axis=1)
    failed["end_date"] = failed["LastUpdateDate"]
    if "ListDate" in failed.columns and "DOM" in failed.columns:
        fallback = failed["ListDate"] + pd.to_timedelta(failed["DOM"].fillna(0), unit="D")
        failed["end_date"] = failed["end_date"].fillna(fallback).fillna(failed["ListDate"])

    live = df[~df["StatusNorm"].isin(["Expired", "Withdrawn"])].copy()
    live["prop_key"] = live.apply(_property_key, axis=1)

    by_key: Dict[str, pd.DataFrame] = {
        k: g for k, g in live.groupby("prop_key") if k and k != "|||"
    }

    true_fail = 0
    churn = 0
    for _, row in failed.iterrows():
        end = row.get("end_date")
        key = row.get("prop_key")
        peers = by_key.get(key)
        is_churn = False
        if peers is not None and len(peers) and pd.notna(end):
            for _, other in peers.iterrows():
                ld = other.get("ListDate")
                if pd.isna(ld):
                    continue
                delta = (pd.Timestamp(ld) - pd.Timestamp(end)).days
                # Relisted just before/after withdraw/expire — typical agent reset
                if -7 <= delta <= relist_window_days:
                    is_churn = True
                    break
        if is_churn:
            churn += 1
        else:
            true_fail += 1

    expired_n = int((failed["StatusNorm"] == "Expired").sum())
    withdrawn_n = int((failed["StatusNorm"] == "Withdrawn").sum())
    note = (
        f"{true_fail} look like true did-not-sell "
        f"({expired_n} expired · {withdrawn_n} withdrawn). "
        f"{churn} look like quick relist churn (back on market within {relist_window_days} days) "
        "— those are not counted as failed sales."
    )
    return {
        "expired_count": expired_n,
        "withdrawn_count": withdrawn_n,
        "failed_listing_count": int(len(failed)),
        "true_did_not_sell": int(true_fail),
        "likely_relist_churn": int(churn),
        "relist_window_days": relist_window_days,
        "note": note,
    }


def infer_market_definition(
    df: pd.DataFrame,
    *,
    subject: Optional[SubjectProperty] = None,
    agent_label: str = "",
    agent_notes: str = "",
    area_name: str = "",
) -> dict:
    """
    Reverse-engineer what market the agent uploaded.
    The 71-field file is already their MLS search — we describe what is in it.
    """
    chips: List[str] = []
    details: List[dict] = []

    label = (agent_label or area_name or "").strip() or "Custom market"

    # Geography
    cities = sorted({str(c).strip() for c in df.get("City", pd.Series(dtype=str)).dropna().unique() if str(c).strip()})
    zips = sorted({str(z).strip() for z in df.get("ZipCode", pd.Series(dtype=str)).dropna().unique() if str(z).strip()})
    if len(cities) == 1:
        chips.append(cities[0])
        details.append({"label": "City", "value": cities[0]})
    elif cities:
        chips.append(f"{len(cities)} cities")
        details.append({"label": "Cities", "value": ", ".join(cities[:6]) + ("…" if len(cities) > 6 else "")})
    if zips:
        zlab = zips[0] if len(zips) == 1 else f"{len(zips)} zips"
        chips.append(zlab if len(zips) == 1 else f"{len(zips)} ZIP codes")
        details.append({"label": "ZIP", "value": ", ".join(zips[:8]) + ("…" if len(zips) > 8 else "")})

    # Time span from list / sold dates in the file
    dates = []
    for col in ("ListDate", "SoldDate"):
        if col in df.columns and df[col].notna().any():
            dates.append(df[col].min())
            dates.append(df[col].max())
    dates = [d for d in dates if pd.notna(d)]
    if dates:
        d0, d1 = min(dates), max(dates)
        months = max(1, round((d1 - d0).days / 30.44, 1))
        span = f"{d0.strftime('%b %Y')} – {d1.strftime('%b %Y')}"
        chips.append(f"~{months:.0f} mo history" if months >= 1 else span)
        details.append({"label": "Date span", "value": f"{span} (~{months} months)"})

    # Size band
    area = df["LivingArea"].dropna() if "LivingArea" in df.columns else pd.Series(dtype=float)
    if len(area):
        a_min, a_max = int(area.min()), int(area.max())
        a_med = int(area.median())
        chips.append(f"{a_min:,}–{a_max:,} sq ft")
        details.append({"label": "Living area", "value": f"{a_min:,} – {a_max:,} sq ft (median {a_med:,})"})

    # Beds / baths
    if "Bdrm" in df.columns and df["Bdrm"].notna().any():
        bmin, bmax = int(df["Bdrm"].min()), int(df["Bdrm"].max())
        chips.append(f"{bmin}–{bmax} bed" if bmin != bmax else f"{bmin} bed")
        details.append({"label": "Beds", "value": f"{bmin} – {bmax}"})
    if "Bath" in df.columns and df["Bath"].notna().any():
        details.append({
            "label": "Baths",
            "value": f"{df['Bath'].min():.1f} – {df['Bath'].max():.1f}",
        })

    # Garage
    if "GarSpaces" in df.columns and df["GarSpaces"].notna().any():
        gar = df["GarSpaces"].dropna()
        mode = int(gar.mode().iloc[0]) if len(gar.mode()) else int(gar.median())
        gmin, gmax = int(gar.min()), int(gar.max())
        if gmin == gmax:
            chips.append(f"{gmin}-car garage")
            details.append({"label": "Garage", "value": f"{gmin}-car"})
        else:
            chips.append(f"{gmin}–{gmax} car · mostly {mode}")
            details.append({"label": "Garage", "value": f"{gmin}–{gmax} spaces (most common: {mode})"})

    # Lot / acres
    if "Acres" in df.columns and df["Acres"].notna().any():
        ac = df["Acres"].dropna()
        ac = ac[(ac > 0) & (ac < 50)]
        if len(ac):
            details.append({
                "label": "Lot size",
                "value": f"{ac.min():.2f} – {ac.max():.2f} acres (median {ac.median():.2f})",
            })
            if ac.max() <= 0.5:
                chips.append("under ½ acre")

    # Year built
    if "YearBuilt" in df.columns and df["YearBuilt"].notna().any():
        y0, y1 = int(df["YearBuilt"].min()), int(df["YearBuilt"].max())
        details.append({"label": "Year built", "value": f"{y0} – {y1}"})

    # Counts
    sold_n = int((df["StatusNorm"] == "Sold").sum()) if "StatusNorm" in df.columns else 0
    active_n = int((df["StatusNorm"] == "Active").sum()) if "StatusNorm" in df.columns else 0
    details.append({
        "label": "Homes in this market",
        "value": f"{len(df)} total · {sold_n} sold · {active_n} active",
    })

    subject_line = ""
    if subject and subject.living_area:
        bits = [f"{subject.living_area:,.0f} sq ft"]
        if subject.beds:
            bits.append(f"{subject.beds:.0f}/{subject.baths:.0f}")
        if subject.garage_spaces:
            bits.append(f"{subject.garage_spaces:.0f}-car")
        if subject.year_built:
            bits.append(f"built {subject.year_built}")
        subject_line = "Your home: " + " · ".join(bits)

    summary = (
        f"This presentation uses your competitive market"
        f"{': ' + label if label else ''}."
        f" Matched to homes buyers would cross-shop with yours — not the whole city."
    )
    if agent_notes and agent_notes.strip():
        summary += f" Agent criteria: {agent_notes.strip()}"

    return {
        "label": label,
        "agent_notes": (agent_notes or "").strip(),
        "summary": summary,
        "chips": chips,
        "details": details,
        "subject_line": subject_line,
        "row_count": int(len(df)),
        "sold_count": sold_n,
        "active_count": active_n,
    }


def extract_subject_from_mls(df: pd.DataFrame, mls_number: str) -> Optional[SubjectProperty]:
    """Pull a subject property directly from the export by MLS #."""
    row = df[df["MLSNumber"].astype(str) == str(mls_number)]
    if row.empty:
        return None
    r = row.iloc[0]
    return SubjectProperty(
        mls_number=str(r["MLSNumber"]),
        address=str(r.get("Address", "")),
        list_price=float(r["Price"]) if pd.notna(r["Price"]) else None,
        living_area=float(r["LivingArea"]) if pd.notna(r["LivingArea"]) else 0,
        beds=float(r["Bdrm"]) if pd.notna(r["Bdrm"]) else 0,
        baths=float(r["Bath"]) if pd.notna(r["Bath"]) else 0,
        year_built=int(r["YearBuilt"]) if pd.notna(r["YearBuilt"]) else 0,
        style=str(r.get("Style", "") or ""),
        subdivision=str(r.get("Subdivision", "") or ""),
        garage_spaces=float(r["GarSpaces"]) if pd.notna(r.get("GarSpaces")) else 0,
        lot_size=float(r["LotSize"]) if pd.notna(r.get("LotSize")) else 0,
        acres=float(r["Acres"]) if pd.notna(r.get("Acres")) else 0,
        dom=float(r["DOM"]) if pd.notna(r.get("DOM")) else None,
        condition="average",
    )


# ---------------------------------------------------------------------------
# Core Analytics
# ---------------------------------------------------------------------------

def compute_market_stats(
    df: pd.DataFrame,
    area_name: str = "Market Area",
    lookback_months: Optional[int] = None,
) -> MarketStats:
    """
    Stats for the market dataframe.
    lookback_months=None → use the entire uploaded pull (agent already curated it).
    """
    now = pd.Timestamp.now()
    if lookback_months and "ListDate" in df.columns:
        cutoff = now - pd.DateOffset(months=lookback_months)
        recent = df[df["ListDate"] >= cutoff].copy()
    else:
        recent = df.copy()

    sold = recent[recent["StatusNorm"] == "Sold"]
    active = recent[recent["StatusNorm"] == "Active"]
    pending = recent[recent["StatusNorm"] == "Pending"]
    expired = recent[recent["StatusNorm"].isin(["Expired", "Withdrawn"])]

    if len(sold) > 0 and sold["SoldDate"].notna().any():
        first_sold = sold["SoldDate"].min()
        last_sold = sold["SoldDate"].max()
        months_span = max((last_sold - first_sold).days / 30.44, 1.0)
    else:
        # Fall back to list-date span in the pull, else 18
        if "ListDate" in recent.columns and recent["ListDate"].notna().any():
            months_span = max(
                (recent["ListDate"].max() - recent["ListDate"].min()).days / 30.44,
                1.0,
            )
        else:
            months_span = float(lookback_months or 18)

    absorption = len(sold) / months_span if months_span > 0 else 0.0
    # Industry standard: months of inventory uses ACTIVE only (available to buy).
    # Pending/Backup are under contract and reported separately.
    active_inventory = len(active)
    under_contract = len(pending)  # includes Backup + FirstRight via StatusNorm
    months_inv = active_inventory / absorption if absorption > 0 else 99.0
    odds = min(absorption / (active_inventory + 1e-6), 0.99) if active_inventory > 0 else 0.95

    monthly = {}
    if len(sold) > 0:
        sold = sold.copy()
        sold["Month"] = sold["SoldDate"].dt.to_period("M").astype(str)
        monthly = sold.groupby("Month").size().to_dict()

    median_price = float(sold["SoldPrice"].median()) if len(sold) else 0
    avg_price = float(sold["SoldPrice"].mean()) if len(sold) else 0
    p25 = float(sold["SoldPrice"].quantile(0.25)) if len(sold) else 0
    p75 = float(sold["SoldPrice"].quantile(0.75)) if len(sold) else 0
    median_dom = float(sold["DOM"].median()) if len(sold) and sold["DOM"].notna().any() else 0
    avg_dom = float(sold["DOM"].mean()) if len(sold) and sold["DOM"].notna().any() else 0
    pps = sold["PricePerSqFt"].dropna()
    median_pps = float(pps.median()) if len(pps) else 0

    notes = []
    if months_inv < 2.5:
        notes.append("Strong seller's market – inventory is tight.")
    elif months_inv < 4.5:
        notes.append("Seller-favorable market.")
    elif months_inv > 7:
        notes.append("Buyer's market – elevated inventory.")
    else:
        notes.append("Balanced market.")

    return MarketStats(
        area_name=area_name,
        as_of=now.strftime("%Y-%m-%d"),
        total_properties=len(recent),
        sold_count=len(sold),
        active_count=len(active),
        pending_count=len(pending),
        expired_withdrawn_count=len(expired),
        months_analyzed=round(months_span, 1),
        absorption_rate=round(absorption, 2),
        months_of_inventory=round(months_inv, 1),
        odds_of_selling=round(odds, 3),
        median_sold_price=round(median_price),
        avg_sold_price=round(avg_price),
        median_dom=round(median_dom),
        avg_dom=round(avg_dom, 1),
        median_price_per_sqft=round(median_pps, 1),
        price_range_25_75=(round(p25), round(p75)),
        year_built_range=(
            int(sold["YearBuilt"].min()) if len(sold) and sold["YearBuilt"].notna().any() else 0,
            int(sold["YearBuilt"].max()) if len(sold) and sold["YearBuilt"].notna().any() else 0,
        ),
        sqft_range=(
            int(sold["LivingArea"].min()) if len(sold) else 0,
            int(sold["LivingArea"].max()) if len(sold) else 0,
        ),
        monthly_sales=monthly,
        notes=notes,
    )


def compact_market_pulse(stats, dns: dict | None = None) -> dict:
    """Appointment-facing vitals only — serializable then/now payload."""
    if stats is None:
        s: dict = {}
    elif isinstance(stats, dict):
        s = stats
    else:
        s = asdict(stats)
    dns = dns if isinstance(dns, dict) else {}
    try:
        active = int(s.get("active_count") or 0)
    except (TypeError, ValueError):
        active = 0
    try:
        odds = float(s.get("odds_of_selling") or 0)
    except (TypeError, ValueError):
        odds = 0.0
    return {
        "as_of": str(s.get("as_of") or "")[:10],
        "months_of_inventory": round(float(s.get("months_of_inventory") or 0), 1),
        "absorption_rate": round(float(s.get("absorption_rate") or 0), 2),
        "odds_of_selling": round(odds, 3),
        "active_count": active,
        "with_yours": active + 1,
        "pending_count": int(s.get("pending_count") or 0),
        "median_dom": float(s.get("median_dom") or 0),
        "median_sold_price": float(s.get("median_sold_price") or 0),
        "median_price_per_sqft": float(s.get("median_price_per_sqft") or 0),
        "sold_count": int(s.get("sold_count") or 0),
        "expired_withdrawn_count": int(s.get("expired_withdrawn_count") or 0),
        "true_did_not_sell": int(dns.get("true_did_not_sell") or 0),
        "likely_relist_churn": int(dns.get("likely_relist_churn") or 0),
    }


def market_pulse_from_report(report: dict | None) -> dict:
    """Freeze the numbers the seller saw at the listing appointment."""
    report = report if isinstance(report, dict) else {}
    stats = report.get("stats") if isinstance(report.get("stats"), dict) else {}
    story = report.get("story") if isinstance(report.get("story"), dict) else {}
    dns = report.get("did_not_sell") if isinstance(report.get("did_not_sell"), dict) else {}
    if not dns and isinstance(story.get("did_not_sell"), dict):
        dns = story["did_not_sell"]
    pulse = compact_market_pulse(stats, dns)
    if story.get("months_of_inventory") not in (None, ""):
        pulse["months_of_inventory"] = round(float(story["months_of_inventory"]), 1)
    odds = story.get("market_odds")
    if odds in (None, ""):
        odds = story.get("odds_of_selling")
    if odds not in (None, ""):
        pulse["odds_of_selling"] = round(float(odds), 3)
    if story.get("sales_per_month") not in (None, ""):
        pulse["absorption_rate"] = round(float(story["sales_per_month"]), 2)
    if story.get("active_on_market") not in (None, ""):
        pulse["active_count"] = int(story["active_on_market"])
    if story.get("with_your_home") not in (None, ""):
        pulse["with_yours"] = int(story["with_your_home"])
    else:
        pulse["with_yours"] = int(pulse.get("active_count") or 0) + 1
    if story.get("under_contract") not in (None, ""):
        pulse["pending_count"] = int(story["under_contract"])
    if story.get("median_dom") not in (None, ""):
        pulse["median_dom"] = float(story["median_dom"])
    rating = int(story.get("home_rating") or 0)
    pulse["home_rating"] = rating or None
    pulse["home_rating_label"] = str(story.get("home_rating_label") or "")
    if not pulse.get("as_of"):
        pulse["as_of"] = str((report.get("meta") or {}).get("generated") or "")[:10]
    return pulse


def _size_band_mask(df: pd.DataFrame, living_area: float, lo: float = 0.8, hi: float = 1.2) -> pd.Series:
    if df is None or len(df) == 0 or not living_area or "LivingArea" not in df.columns:
        return pd.Series(True, index=df.index) if df is not None else pd.Series(dtype=bool)
    return (df["LivingArea"] >= living_area * lo) & (df["LivingArea"] <= living_area * hi)


def build_price_response_model(
    df: pd.DataFrame,
    stats: MarketStats | dict,
    recommended_price: float,
    living_area: float = 0,
) -> dict:
    """
    Calibrate DOM / 30-day odds from THIS market pull.

    Primary signal (always available): queue position among Active listings in the
    size band + absorption (sales/month). At the recommended list we normalize so
    expected DOM ≈ market median DOM and odds ≈ market odds.

    Secondary signal (when enough solds): empirical median DOM by list premium vs
    contemporaneous $/sqft — isotonic-smoothed and blended when sample supports it.
    """
    if isinstance(stats, dict):
        base_dom = float(stats.get("median_dom") or 45)
        base_odds = float(stats.get("odds_of_selling") or 0.35)
        sales_pm_mkt = float(stats.get("absorption_rate") or 0)
    else:
        base_dom = float(stats.median_dom or 45)
        base_odds = float(stats.odds_of_selling or 0.35)
        sales_pm_mkt = float(stats.absorption_rate or 0)

    empty = {
        "method": "heuristic",
        "n_active_band": 0,
        "n_sold_band": 0,
        "band_sales_pm": round(sales_pm_mkt, 2),
        "active_prices": [],
        "base_dom": base_dom,
        "base_odds": base_odds,
        "recommended_price": float(recommended_price or 0),
        "queue_dom_at_rec": None,
        "empirical_knots": [],
        "empirical_weight": 0.0,
        "note": "Insufficient band data — using inventory/odds anchors with heuristic slope.",
    }
    if df is None or len(df) == 0 or not recommended_price:
        return empty

    work = df.copy()
    mask = _size_band_mask(work, living_area) if living_area else pd.Series(True, index=work.index)
    band = work[mask].copy() if mask.any() else work.copy()
    if len(band) < 8:
        band = work.copy()

    active = band[band["StatusNorm"] == "Active"] if "StatusNorm" in band.columns else band.iloc[0:0]
    sold = band[band["StatusNorm"] == "Sold"] if "StatusNorm" in band.columns else band.iloc[0:0]
    active_prices = sorted(
        float(p) for p in active["Price"].dropna().tolist() if float(p) > 0
    ) if len(active) and "Price" in active.columns else []

    # Band absorption from sold span
    band_sales_pm = sales_pm_mkt
    if len(sold) and "SoldDate" in sold.columns and sold["SoldDate"].notna().any():
        first = sold["SoldDate"].min()
        last = sold["SoldDate"].max()
        months = max((last - first).days / 30.44, 1.0)
        band_sales_pm = max(len(sold) / months, 0.15)

    def queue_stats(list_price: float) -> tuple[float, float]:
        if not active_prices:
            return 1.0, band_sales_pm
        below = sum(1 for p in active_prices if p < list_price * 0.995)
        near = sum(1 for p in active_prices if abs(p - list_price) / list_price <= 0.005)
        position = 1.0 + below + 0.5 * near
        return position, band_sales_pm

    rec_pos, sales_pm = queue_stats(recommended_price)
    queue_dom_at_rec = 30.44 * rec_pos / max(sales_pm, 0.15)
    queue_odds_at_rec = min(0.95, sales_pm / max(rec_pos + sales_pm * 0.35, 0.15))

    # Empirical DOM curve: near-ask solds vs leave-one-out size-band fair value
    empirical_knots: list[dict] = []
    empirical_weight = 0.0
    sold_ok = sold.dropna(subset=["Price", "SoldPrice", "LivingArea", "DOM"]).copy() if len(sold) else sold
    if len(sold_ok):
        sold_ok = sold_ok[
            (sold_ok["LivingArea"] > 0)
            & (sold_ok["Price"] > 0)
            & (sold_ok["SoldPrice"] > 0)
            & ((sold_ok["SoldPrice"] / sold_ok["Price"]).between(0.96, 1.04))
        ]
    if len(sold_ok) >= 25:
        pps = sold_ok["SoldPrice"] / sold_ok["LivingArea"]
        med_pps = float(pps.median())
        prems, doms = [], []
        for _, row in sold_ok.iterrows():
            la = float(row["LivingArea"])
            sib = sold_ok[
                (sold_ok["LivingArea"] >= la * 0.85)
                & (sold_ok["LivingArea"] <= la * 1.15)
            ]
            fair_pps = float((sib["SoldPrice"] / sib["LivingArea"]).median()) if len(sib) >= 6 else med_pps
            fair = fair_pps * la
            if fair <= 0:
                continue
            prem = (float(row["Price"]) - fair) / fair
            prems.append(prem)
            doms.append(float(row["DOM"]))
        if len(prems) >= 20:
            edges = [-0.10, -0.05, -0.02, 0.0, 0.02, 0.05, 0.08, 0.12]
            # Build raw bin medians then enforce non-decreasing DOM for premium >= 0
            raw = []
            for i in range(len(edges)):
                lo_e = edges[i]
                hi_e = edges[i + 1] if i + 1 < len(edges) else 0.25
                mid = (lo_e + hi_e) / 2 if i + 1 < len(edges) else lo_e + 0.04
                pts = [d for p, d in zip(prems, doms) if lo_e <= p < hi_e]
                if len(pts) >= 4:
                    raw.append((mid, float(np.median(pts)), len(pts)))
            if len(raw) >= 3:
                # Isotonic on the overpriced side: DOM should not fall as premium rises
                xs = [r[0] for r in raw]
                ys = [r[1] for r in raw]
                ns = [r[2] for r in raw]
                # Find index nearest zero
                zero_i = min(range(len(xs)), key=lambda i: abs(xs[i]))
                base_y = ys[zero_i]
                # Forward pass for x >= 0
                for i in range(zero_i + 1, len(ys)):
                    ys[i] = max(ys[i], ys[i - 1])
                # Underpriced side: allow faster (lower DOM) but floor at 0.55 * base
                for i in range(zero_i - 1, -1, -1):
                    ys[i] = min(ys[i], ys[i + 1])
                    ys[i] = max(ys[i], base_y * 0.55)
                empirical_knots = [
                    {"delta": round(x, 3), "dom": round(y, 1), "n": int(n)}
                    for x, y, n in zip(xs, ys, ns)
                ]
                # Weight by how clearly overpricing lengthens DOM
                over = [y for x, y in zip(xs, ys) if x >= 0.05]
                under = [y for x, y in zip(xs, ys) if x <= 0]
                if over and under and np.median(over) > np.median(under) * 1.05:
                    empirical_weight = min(0.55, 0.15 + 0.02 * (len(prems) / 10))
                else:
                    # Flat / noisy — light blend only
                    empirical_weight = min(0.25, 0.08 + 0.01 * (len(prems) / 15))

    note = (
        f"Queue model from {len(active_prices)} Active in size band · "
        f"{band_sales_pm:.1f} sales/mo · normalized to median DOM {base_dom:.0f}d"
    )
    if empirical_knots:
        note += f" · blended with {sum(k['n'] for k in empirical_knots)} near-ask solds"

    return {
        "method": "queue+empirical" if empirical_knots else "queue",
        "n_active_band": len(active_prices),
        "n_sold_band": int(len(sold)),
        "band_sales_pm": round(float(band_sales_pm), 2),
        "active_prices": active_prices,
        "base_dom": base_dom,
        "base_odds": round(base_odds, 3),
        "recommended_price": float(recommended_price),
        "queue_dom_at_rec": round(float(queue_dom_at_rec), 1),
        "queue_odds_at_rec": round(float(queue_odds_at_rec), 3),
        "empirical_knots": empirical_knots,
        "empirical_weight": round(float(empirical_weight), 3),
        "note": note,
    }


def _interp_empirical_dom(knots: list[dict], delta: float, fallback: float) -> float:
    if not knots:
        return fallback
    xs = [float(k["delta"]) for k in knots]
    ys = [float(k["dom"]) for k in knots]
    if delta <= xs[0]:
        return ys[0]
    if delta >= xs[-1]:
        # extrapolate gently past last knot
        return ys[-1] * (1.0 + max(0.0, delta - xs[-1]) * 2.5)
    for i in range(len(xs) - 1):
        if xs[i] <= delta <= xs[i + 1]:
            t = (delta - xs[i]) / max(xs[i + 1] - xs[i], 1e-9)
            return ys[i] + t * (ys[i + 1] - ys[i])
    return fallback


# ---------------------------------------------------------------------------
# Listing flow / supply stream
# ---------------------------------------------------------------------------

LISTING_FLOW_SQFT_LO = 0.8
LISTING_FLOW_SQFT_HI = 1.2


def listing_flow_sqft_mask(series: pd.Series, living_area: float) -> pd.Series:
    """80–120% living-area band used by listing flow and the over/under pulse."""
    area = float(living_area or 0)
    if area <= 0:
        return pd.Series(True, index=series.index)
    sqft = pd.to_numeric(series, errors="coerce")
    return (sqft >= area * LISTING_FLOW_SQFT_LO) & (sqft <= area * LISTING_FLOW_SQFT_HI)


def compute_listing_flow(
    df: pd.DataFrame,
    sales_per_month: float,
    recommended_price: float = 0,
    living_area: float = 0,
    lookback_months: int = 18,
) -> dict:
    """
    New listings vs sales — the supply stream that makes overpricing costly.

    Uses ListDate on every row in the competitive market pull (not only actives).
    """
    empty = {
        "new_listings_per_month": 0.0,
        "sales_per_month": round(float(sales_per_month or 0), 2),
        "supply_pressure": 0.0,
        "net_inventory_per_month": 0.0,
        "new_below_recommended_per_month": 0.0,
        "active_below_recommended_now": 0,
        "threshold_price": round(float(recommended_price or 0)),
        "subject_living_area": round(float(living_area or 0)),
        "samples": [],
        "chart": {"labels": [], "new_listings": [], "sales": []},
        "insight": "",
        "overprice_insight": "",
    }
    if df is None or len(df) == 0 or "ListDate" not in df.columns:
        return empty

    work = df.copy()
    work["ListDate"] = pd.to_datetime(work["ListDate"], errors="coerce")
    work = work[work["ListDate"].notna()]
    if not len(work):
        return empty

    now = pd.Timestamp.now()
    cutoff = now - pd.DateOffset(months=lookback_months)
    recent = work[work["ListDate"] >= cutoff].copy()
    if not len(recent):
        recent = work.copy()

    recent["Month"] = recent["ListDate"].dt.to_period("M").astype(str)
    monthly_new = recent.groupby("Month").size()

  # Sales by month from sold rows
    sold = recent[recent["StatusNorm"] == "Sold"].copy()
    if len(sold) and "SoldDate" in sold.columns:
        sold["SoldDate"] = pd.to_datetime(sold["SoldDate"], errors="coerce")
        sold = sold[sold["SoldDate"].notna()]
        sold["Month"] = sold["SoldDate"].dt.to_period("M").astype(str)
        monthly_sales = sold.groupby("Month").size()
    else:
        monthly_sales = pd.Series(dtype=int)

    labels_raw = sorted(set(monthly_new.index.tolist()) | set(monthly_sales.index.tolist()))
    labels = [format_month_label(m, short=True) for m in labels_raw]
    new_vals = [int(monthly_new.get(m, 0)) for m in labels_raw]
    sale_vals = [int(monthly_sales.get(m, 0)) for m in labels_raw]

    # Recent average (last 6 months with data)
    tail_n = 6
    recent_new = monthly_new.tail(tail_n) if len(monthly_new) else monthly_new
    new_pm = float(recent_new.mean()) if len(recent_new) else 0.0
    if not new_pm and len(monthly_new):
        span_m = max((recent["ListDate"].max() - recent["ListDate"].min()).days / 30.44, 1.0)
        new_pm = len(recent) / span_m

    sales_pm = float(sales_per_month or 0)
    if not sales_pm and len(monthly_sales):
        sales_pm = float(monthly_sales.tail(tail_n).mean())

    supply_pressure = (new_pm / sales_pm) if sales_pm > 0 else (99.0 if new_pm > 0 else 0.0)
    net_pm = new_pm - sales_pm

    below_pm = 0.0
    active_below = 0
    samples: list = []
    for _, row in recent.iterrows():
        price_val = row.get("Price")
        if pd.isna(price_val):
            continue
        sqft_val = row.get("LivingArea")
        samples.append({
            "m": str(row["ListDate"].to_period("M")),
            "p": float(price_val),
            "s": float(sqft_val) if pd.notna(sqft_val) else 0.0,
            "a": 1 if str(row.get("StatusNorm") or "") == "Active" else 0,
        })

    if recommended_price and recommended_price > 0:
        band = recent.copy()
        if living_area and living_area > 0 and "LivingArea" in band.columns:
            band = band[listing_flow_sqft_mask(band["LivingArea"], living_area)]
        price_col = "Price"
        if price_col in band.columns:
            band = band[band[price_col].notna()]
            below = band[band[price_col] < recommended_price]
            if len(below):
                below_monthly = below.groupby(below["ListDate"].dt.to_period("M").astype(str)).size()
                below_pm = float(below_monthly.tail(tail_n).mean()) if len(below_monthly) else 0.0
            actives = band[band["StatusNorm"] == "Active"]
            if len(actives):
                active_below = int((actives["Price"] < recommended_price).sum())

    if supply_pressure >= 1.15:
        pressure_label = "New listings are arriving faster than the market clears"
    elif supply_pressure >= 0.85:
        pressure_label = "New listings and sales are roughly in balance"
    else:
        pressure_label = "Sales are outpacing new listings — inventory is draining"

    insight = (
        f"About <b>{new_pm:.1f}</b> new listings per month vs <b>{sales_pm:.1f}</b> sales per month "
        f"(supply pressure <b>{supply_pressure:.2f}×</b>). {pressure_label}."
    )
    overprice_insight = ""
    if recommended_price and below_pm > 0:
        overprice_insight = (
            f"Against a comp-supported value line of <b>${recommended_price:,.0f}</b>, about "
            f"<b>{below_pm:.1f}</b> similar new listings/month come in cheaper — with "
            f"<b>{active_below}</b> Active under that line right now."
        )

    return {
        "new_listings_per_month": round(new_pm, 2),
        "sales_per_month": round(sales_pm, 2),
        "supply_pressure": round(supply_pressure, 2),
        "net_inventory_per_month": round(net_pm, 2),
        "new_below_recommended_per_month": round(below_pm, 2),
        "active_below_recommended_now": active_below,
        "threshold_price": round(float(recommended_price or 0)),
        "subject_living_area": round(float(living_area or 0)),
        "samples": samples,
        "chart": {
            "labels": labels,
            "new_listings": new_vals,
            "sales": sale_vals,
        },
        "insight": insight,
        "overprice_insight": overprice_insight,
    }


def _pulse_listing_id(row: pd.Series) -> str:
    mls = str(row.get("MLSNumber") or row.get("MLSNumber") or "").strip()
    if mls:
        return mls
    addr = str(row.get("Address") or row.get("StName") or "").strip()
    price = row.get("Price")
    return addr or f"{addr}|{price}"


def _pulse_num(row: pd.Series, *keys) -> float:
    for key in keys:
        if key not in row.index:
            continue
        val = row.get(key)
        if val is None or (isinstance(val, float) and pd.isna(val)):
            continue
        try:
            return float(val)
        except (TypeError, ValueError):
            continue
    return 0.0


def pulse_portal_urls(address: str, city: str = "", state: str = "") -> dict:
    loc = " ".join(part for part in (address or "", city or "", state or "") if str(part).strip())
    loc = loc.strip()
    if not loc:
        return {"zillow": "", "realtor": ""}
    q = url_quote(loc)
    return {
        "zillow": f"https://www.zillow.com/homes/{q}_rb/",
        "realtor": f"https://www.realtor.com/realestateandhomes-search/{q}",
    }


FINGERPRINT_LIVE_STATUSES = frozenset({"Active", "Pending", "Backup", "FirstRight"})
FINGERPRINT_UC_STATUSES = frozenset({"Pending", "Backup", "FirstRight"})
FINGERPRINT_SOLD_STATUSES = frozenset({"Sold"})


def _fingerprint_date(value) -> str:
    text = str(value or "").strip()[:10]
    if len(text) != 10 or text[4] != "-" or text[7] != "-":
        return ""
    try:
        datetime.strptime(text, "%Y-%m-%d")
    except ValueError:
        return ""
    return text


def _fp_norm_addr(addr) -> str:
    import re

    a = str(addr or "").upper().strip()
    if not a:
        return ""
    a = re.sub(r"[.,#]", " ", a)
    a = re.sub(r"\s+", " ", a)
    replacements = {
        " STREET": " ST", " AVENUE": " AVE", " COURT": " CT",
        " DRIVE": " DR", " LANE": " LN", " ROAD": " RD",
        " BOULEVARD": " BLVD", " PLACE": " PL", " WEST ": " W ",
        " EAST ": " E ", " NORTH ": " N ", " SOUTH ": " S ",
    }
    for old, new in replacements.items():
        a = a.replace(old, new)
    return a.strip()


def listing_is_subject(row: dict | None, subject: dict | None) -> bool:
    if not isinstance(row, dict) or not isinstance(subject, dict):
        return False
    mls_s = str(subject.get("mls_number") or subject.get("mls") or "").strip()
    mls_r = str(row.get("mls") or row.get("mls_number") or row.get("MLSNumber") or "").strip()
    if mls_s and mls_r and mls_s == mls_r:
        return True
    a = _fp_norm_addr(subject.get("address"))
    b = _fp_norm_addr(row.get("address") or row.get("Address"))
    if a and b and (a in b or b in a):
        return True
    return False


def detect_subject_market_status(source, subject: dict | None) -> str:
    """Current MLS status of the subject home: Active, Pending, Sold, or ''."""
    if not isinstance(subject, dict) or not (
        subject.get("address") or subject.get("mls_number") or subject.get("mls")
    ):
        return ""
    rows: list[dict] = []
    if isinstance(source, pd.DataFrame):
        if source is None or len(source) == 0:
            return ""
        for _, raw in source.iterrows():
            status = str(raw.get("StatusNorm") or raw.get("status") or "").strip()
            rows.append({
                "mls": str(raw.get("MLSNumber") or raw.get("mls") or "").strip(),
                "address": str(raw.get("Address") or raw.get("address") or "").strip(),
                "status": status,
            })
    elif isinstance(source, dict):
        rows = [r for r in (source.get("listings") or []) if isinstance(r, dict)]
    elif isinstance(source, list):
        rows = [r for r in source if isinstance(r, dict)]
    for row in rows:
        if not listing_is_subject(row, subject):
            continue
        status = str(row.get("status") or row.get("StatusNorm") or "").strip()
        if status in FINGERPRINT_UC_STATUSES:
            return "Pending"
        if status in FINGERPRINT_SOLD_STATUSES or status == "Sold":
            return "Sold"
        if status in FINGERPRINT_LIVE_STATUSES:
            return status
        return status
    return ""


def compute_market_pulse(
    df: pd.DataFrame,
    *,
    area_name: str = "Market",
    subject: dict | None = None,
) -> dict:
    """Recompute appointment vitals from the current market file (same filters as the report)."""
    if df is None or len(df) == 0:
        return {}
    stats = compute_market_stats(df, area_name=area_name)
    dns = analyze_did_not_sell(df)
    pulse = compact_market_pulse(stats, dns)
    if "StatusNorm" in df.columns:
        active = df[df["StatusNorm"] == "Active"]
        n = 0
        for _, row in active.iterrows():
            rec = {
                "mls": str(row.get("MLSNumber") or ""),
                "address": str(row.get("Address") or ""),
            }
            if listing_is_subject(rec, subject):
                continue
            n += 1
        pulse["active_count"] = n
        pulse["with_yours"] = n + 1
    return pulse


def _failed_status_as_of(row: pd.Series, as_of_ts: pd.Timestamp) -> str:
    """Expired / withdrawn as of a historical day; still Active if they had not left yet."""
    current = str(row.get("StatusNorm") or "")
    if current not in ("Expired", "Withdrawn"):
        return ""
    list_ts = _pulse_day(row.get("ListDate"))
    if list_ts is None or list_ts > as_of_ts:
        return ""
    end = _pulse_day(row.get("LastUpdateDate"))
    if end is None and pd.notna(row.get("DOM")):
        try:
            end = list_ts + pd.Timedelta(days=float(row.get("DOM") or 0))
        except (TypeError, ValueError):
            end = None
    if end is not None and end > as_of_ts:
        return "Active"
    return current


def market_frame_as_of(df: pd.DataFrame, as_of, *, latest: bool = False) -> pd.DataFrame:
    """Copy of the market pull with StatusNorm reconstructed as of ``as_of``."""
    as_of_ts = _pulse_day(as_of) or pd.Timestamp.now().normalize()
    if df is None or len(df) == 0:
        return df if df is not None else pd.DataFrame()
    keep_idx: list = []
    statuses: list[str] = []
    for idx, row in df.iterrows():
        st = _status_as_of_row(row, as_of_ts, latest=latest)
        if not st:
            st = _failed_status_as_of(row, as_of_ts)
        if not st:
            continue
        keep_idx.append(idx)
        statuses.append(st)
    if not keep_idx:
        return df.iloc[0:0].copy()
    work = df.loc[keep_idx].copy()
    work["StatusNorm"] = statuses
    return work


def compute_market_pulse_as_of(
    df: pd.DataFrame,
    as_of,
    *,
    area_name: str = "Market",
    subject: dict | None = None,
    latest: bool = False,
) -> dict:
    """Appointment vitals as they would have read on ``as_of`` (later sales do not leak back)."""
    as_of_ts = _pulse_day(as_of) or pd.Timestamp.now().normalize()
    work = market_frame_as_of(df, as_of_ts, latest=latest)
    pulse = compute_market_pulse(work, area_name=area_name, subject=subject)
    if pulse:
        pulse["as_of"] = as_of_ts.strftime("%Y-%m-%d")
    return pulse


def attach_market_pulse_history(
    history: list | None,
    df: pd.DataFrame,
    *,
    subject: dict | None = None,
    area_name: str = "Market",
) -> tuple[list, bool]:
    """Fill missing per-week market vitals from the MLS pull. Does not overwrite stored weeks."""
    rows = list(history) if isinstance(history, list) else []
    if df is None or len(df) == 0 or not rows:
        return rows, False
    changed = False
    n = len(rows)
    out: list = []
    for i, week in enumerate(rows):
        if not isinstance(week, dict):
            out.append(week)
            continue
        row = dict(week)
        existing = row.get("market")
        if isinstance(existing, dict) and existing.get("active_count") is not None:
            out.append(row)
            continue
        as_of = str(row.get("as_of") or "")[:10]
        if len(as_of) != 10:
            out.append(row)
            continue
        row["market"] = compute_market_pulse_as_of(
            df,
            as_of,
            area_name=area_name,
            subject=subject,
            latest=(i == n - 1),
        )
        changed = True
        out.append(row)
    return out, changed


def fingerprint_clock(lock: dict | None) -> dict:
    """Generate clock until the listing goes active, then since-active is the board."""
    lock = lock if isinstance(lock, dict) else {}
    locked_at = _fingerprint_date(lock.get("locked_at"))
    active_at = _fingerprint_date(lock.get("active_at"))
    if active_at:
        return {
            "clock": "active",
            "clock_at": active_at,
            "clock_label": "since active",
            "locked_at": locked_at,
            "active_at": active_at,
            "active_at_source": str(lock.get("active_at_source") or ""),
        }
    return {
        "clock": "generate",
        "clock_at": locked_at,
        "clock_label": "since generate",
        "locked_at": locked_at,
        "active_at": "",
        "active_at_source": str(lock.get("active_at_source") or ""),
    }


def _in_date_window(day: str, start: str, end: str = "", *, start_inclusive: bool = True) -> bool:
    d = _fingerprint_date(day)
    s = _fingerprint_date(start)
    e = _fingerprint_date(end)
    if not d or not s:
        return False
    if start_inclusive:
        if d < s:
            return False
    elif d <= s:
        return False
    if e and d > e:
        return False
    return True


def _status_event_date(row: dict | None, statuses: set[str]) -> str:
    if not isinstance(row, dict):
        return ""
    dates: list[str] = []
    for item in row.get("status_history") or []:
        if not isinstance(item, dict):
            continue
        if str(item.get("status") or "") in statuses:
            day = _fingerprint_date(item.get("as_of"))
            if day:
                dates.append(day)
    if dates:
        return min(dates)
    if str(row.get("last_status") or row.get("status") or "") in statuses:
        return _fingerprint_date(row.get("last_seen") or row.get("as_of"))
    return ""


def _listing_on_date(row: dict | None) -> str:
    if not isinstance(row, dict):
        return ""
    return _fingerprint_date(row.get("list_date")) or _fingerprint_date(row.get("first_seen"))


def detect_subject_active_at(source, subject: dict | None) -> str:
    """List date of the subject home once it is on the market."""
    if not isinstance(subject, dict) or not (subject.get("address") or subject.get("mls_number") or subject.get("mls")):
        return ""
    rows: list[dict] = []
    if isinstance(source, pd.DataFrame):
        if source is None or len(source) == 0:
            return ""
        for _, raw in source.iterrows():
            rows.append({
                "mls": str(raw.get("MLSNumber") or "").strip(),
                "address": str(raw.get("Address") or "").strip(),
                "status": str(raw.get("StatusNorm") or "").strip(),
                "list_date": "",
            })
            raw_date = raw.get("ListDate")
            if pd.notna(raw_date):
                try:
                    rows[-1]["list_date"] = pd.to_datetime(raw_date).strftime("%Y-%m-%d")
                except Exception:
                    pass
    elif isinstance(source, dict):
        rows = [r for r in (source.get("listings") or []) if isinstance(r, dict)]
    elif isinstance(source, list):
        rows = [r for r in source if isinstance(r, dict)]
    live = set(FINGERPRINT_LIVE_STATUSES) | set(FINGERPRINT_SOLD_STATUSES)
    for row in rows:
        if not listing_is_subject(row, subject):
            continue
        status = str(row.get("status") or row.get("StatusNorm") or "")
        if status and status not in live:
            continue
        day = _listing_on_date(row)
        if day:
            return day
    return ""


def _fingerprint_pool(snapshot: dict | None, ledger: dict | None) -> list[dict]:
    pool: dict[str, dict] = {}
    ledger_listings = (ledger or {}).get("listings") if isinstance(ledger, dict) else {}
    if isinstance(ledger_listings, dict):
        for pid, rec in ledger_listings.items():
            if isinstance(rec, dict):
                pool[str(pid)] = dict(rec)
    snap = snapshot if isinstance(snapshot, dict) else {}
    for row in snap.get("listings") or []:
        if not isinstance(row, dict) or not row.get("id"):
            continue
        pid = str(row["id"])
        existing = pool.get(pid) if isinstance(pool.get(pid), dict) else {}
        pool[pid] = {**existing, **row}
    return list(pool.values())


def _window_event_counts(
    rows: list[dict],
    start: str,
    end: str = "",
    *,
    start_inclusive: bool = True,
    subject: dict | None = None,
    locked_price: float = 0.0,
) -> dict[str, int]:
    listed = 0
    uc = 0
    sold = 0
    listed_under = 0
    listed_over = 0
    if not start:
        return {"listed": 0, "uc": 0, "sold": 0, "listed_under": 0, "listed_over": 0}
    try:
        locked = float(locked_price or 0)
    except (TypeError, ValueError):
        locked = 0.0
    for row in rows:
        if listing_is_subject(row, subject):
            continue
        if _in_date_window(_listing_on_date(row), start, end, start_inclusive=start_inclusive):
            listed += 1
            try:
                price = float(row.get("price") or 0)
            except (TypeError, ValueError):
                price = 0.0
            side = str(row.get("side") or "")
            if not side and locked:
                side = "under" if price < locked else ("over" if price > locked else "at")
            if side == "under":
                listed_under += 1
            elif side == "over":
                listed_over += 1
        sold_day = _status_event_date(row, FINGERPRINT_SOLD_STATUSES)
        uc_day = _status_event_date(row, set(FINGERPRINT_UC_STATUSES))
        if _in_date_window(sold_day, start, end, start_inclusive=start_inclusive):
            sold += 1
        elif _in_date_window(uc_day, start, end, start_inclusive=start_inclusive):
            uc += 1
    return {
        "listed": listed,
        "uc": uc,
        "sold": sold,
        "listed_under": listed_under,
        "listed_over": listed_over,
    }


def _pulse_latlng(row: pd.Series) -> tuple[float | None, float | None]:
    lat = _pulse_num(row, "Latitude", "Lat")
    lng = _pulse_num(row, "Longitude", "Lng", "Lon")
    if not lat or not lng:
        return None, None
    if abs(lat) > 90 or abs(lng) > 180:
        return None, None
    return lat, lng


def _pulse_listing_from_row(row: pd.Series, locked: float, *, list_date: str = "") -> dict:
    try:
        price = float(row.get("Price"))
    except (TypeError, ValueError):
        price = 0.0
    sqft = _pulse_num(row, "LivingArea")
    address = str(row.get("Address") or row.get("StName") or "").strip()
    city = str(row.get("City") or "").strip()
    side = "under" if price < locked else ("over" if price > locked else "at")
    ppsf = round(price / sqft, 2) if price and sqft else 0.0
    urls = pulse_portal_urls(address, city)
    lat, lng = _pulse_latlng(row)
    photo = extract_photo_url(row)
    return {
        "id": _pulse_listing_id(row),
        "mls": str(row.get("MLSNumber") or row.get("MLSNumber") or row.get("MLSNumber") or "").strip(),
        "address": address,
        "city": city,
        "price": int(round(price)) if price else 0,
        "delta": int(round(price - locked)) if price and locked else 0,
        "list_date": list_date,
        "sqft": round(sqft) if sqft else 0,
        "beds": _pulse_num(row, "Bdrm", "Beds"),
        "baths": _pulse_num(row, "Bath", "Baths"),
        "year": int(_pulse_num(row, "YearBuilt")) if _pulse_num(row, "YearBuilt") else 0,
        "dom": int(round(_pulse_num(row, "DOM"))) if _pulse_num(row, "DOM") else 0,
        "ppsf": ppsf,
        "status": str(row.get("StatusNorm") or ""),
        "side": side,
        "zillow": urls["zillow"],
        "realtor": urls["realtor"],
        "photo_url": photo,
        "photos": [photo] if photo else [],
        "lat": lat,
        "lng": lng,
        "rank": 0,
        "rank_of": 0,
    }


def _photo_key_variants(*parts: str) -> list[str]:
    keys: list[str] = []
    seen: set[str] = set()
    for part in parts:
        text = str(part or "").strip()
        if not text or text in seen:
            continue
        seen.add(text)
        keys.append(text)
        compact = "".join(ch for ch in text if ch.isalnum() or ch in "-_")[:48]
        if compact and compact not in seen:
            seen.add(compact)
            keys.append(compact)
    return keys


def _lookup_photo(store: dict | None, card: dict, *, allow_list: bool = False):
    if not isinstance(store, dict) or not store:
        return [] if allow_list else ""
    for key in _photo_key_variants(
        str(card.get("mls") or ""),
        str(card.get("id") or ""),
        str(card.get("mls_number") or ""),
        str(card.get("address") or ""),
    ):
        val = store.get(key)
        if isinstance(val, list):
            if allow_list:
                return val
            val = val[0] if val else ""
        if val:
            return val
    return [] if allow_list else ""


def apply_listing_photos(listings: list[dict], photo_map: dict | None, gallery_map: dict | None = None) -> list[dict]:
    """Attach hosted MLS photos onto fingerprint listing cards."""
    photos = photo_map if isinstance(photo_map, dict) else {}
    galleries = gallery_map if isinstance(gallery_map, dict) else {}
    out: list[dict] = []
    for row in listings or []:
        if not isinstance(row, dict):
            continue
        card = dict(row)
        hosted = _lookup_photo(photos, card)
        gallery = _lookup_photo(galleries, card, allow_list=True) or []
        if isinstance(gallery, str):
            gallery = [gallery] if gallery else []
        if not isinstance(gallery, list):
            gallery = []
        if hosted:
            card["photo_url"] = hosted
        urls = []
        primary = str(card.get("photo_url") or "")
        if primary:
            urls.append(primary)
        for item in gallery:
            su = str(item or "").strip()
            if su and su not in urls:
                urls.append(su)
        existing = card.get("photos") if isinstance(card.get("photos"), list) else []
        for item in existing:
            su = str(item or "").strip()
            if su and su not in urls:
                urls.append(su)
        card["photos"] = urls[:8]
        if urls:
            card["photo_url"] = urls[0]
        out.append(card)
    return out


def _assign_active_ranks(listings: list[dict], locked_price: float) -> dict:
    """Rank Active listings by list price; subject rank includes the initial list."""
    actives = [
        r for r in listings
        if isinstance(r, dict) and str(r.get("status") or "") == "Active" and r.get("price")
    ]
    actives.sort(key=lambda r: int(r.get("price") or 0))
    n = len(actives)
    for i, row in enumerate(actives, 1):
        row["rank"] = i
        row["rank_of"] = n
    locked = float(locked_price or 0)
    cheaper = sum(1 for r in actives if int(r.get("price") or 0) < locked) if locked else 0
    return {
        "rank": cheaper + 1 if locked else 0,
        "rank_of": n + 1 if locked else n,
        "active_count": n,
    }


def build_pulse_snapshot(
    df: pd.DataFrame,
    locked_price: float,
    living_area: float = 0,
    *,
    as_of: str | None = None,
    photo_map: dict | None = None,
    gallery_map: dict | None = None,
) -> dict:
    """Live similar listings (Active + under contract) tagged over/under the initial list."""
    as_of = as_of or datetime.now().strftime("%Y-%m-%d")
    locked = float(locked_price or 0)
    empty = {
        "as_of": as_of,
        "locked_price": round(locked) if locked else 0,
        "subject_sqft": round(float(living_area or 0)),
        "listings": [],
        "rank": 0,
        "rank_of": 0,
        "active_count": 0,
    }
    if df is None or len(df) == 0 or locked <= 0:
        return empty

    work = df.copy()
    if "LivingArea" in work.columns and living_area and living_area > 0:
        work = work[listing_flow_sqft_mask(work["LivingArea"], living_area)]
    if "Price" not in work.columns:
        return empty
    work = work[work["Price"].notna()]
    listings: list[dict] = []
    for _, row in work.iterrows():
        try:
            price = float(row.get("Price"))
        except (TypeError, ValueError):
            continue
        if price <= 0:
            continue
        status = str(row.get("StatusNorm") or "")
        if status not in FINGERPRINT_LIVE_STATUSES:
            continue
        list_date = ""
        raw_date = row.get("ListDate")
        if pd.notna(raw_date):
            try:
                list_date = pd.to_datetime(raw_date).strftime("%Y-%m-%d")
            except Exception:
                list_date = ""
        listings.append(_pulse_listing_from_row(row, locked, list_date=list_date))
    listings = apply_listing_photos(listings, photo_map, gallery_map)
    rank_info = _assign_active_ranks(listings, locked)
    return {
        "as_of": as_of,
        "locked_price": int(round(locked)),
        "subject_sqft": round(float(living_area or 0)),
        "listings": listings,
        **rank_info,
    }


def freeze_fingerprint_baseline(snapshot: dict | None) -> dict:
    """Active cohort from generate (or from the listed/active date when reconstructed)."""
    snap = snapshot if isinstance(snapshot, dict) else {}
    actives = [
        dict(r)
        for r in (snap.get("listings") or [])
        if isinstance(r, dict) and str(r.get("status") or "") == "Active"
    ]
    return {
        "as_of": snap.get("as_of") or datetime.now().strftime("%Y-%m-%d"),
        "locked_price": int(snap.get("locked_price") or 0),
        "subject_sqft": snap.get("subject_sqft") or 0,
        "listings": actives,
        "ids": [str(r.get("id")) for r in actives if r.get("id")],
        "rank": snap.get("rank") or 0,
        "rank_of": snap.get("rank_of") or 0,
        "active_count": len(actives),
    }


def reconstruct_fingerprint_baseline(
    df: pd.DataFrame,
    locked_price: float,
    living_area: float = 0,
    *,
    as_of: str,
    photo_map: dict | None = None,
    gallery_map: dict | None = None,
) -> dict:
    """Rebuild the Active cohort as it would have looked on ``as_of``.

    A home was Active that day if it listed on or before as_of and had not
    already sold by then. Homes now pending/sold are tagged Active in the
    freeze so the ledger can show what happened after the lock.
    """
    as_of_ts = pd.to_datetime(as_of, errors="coerce")
    if pd.isna(as_of_ts):
        as_of_ts = pd.Timestamp.now()
    as_of_ts = as_of_ts.tz_localize(None) if getattr(as_of_ts, "tzinfo", None) else as_of_ts
    as_of_ts = pd.Timestamp(as_of_ts).normalize()
    as_of_str = as_of_ts.strftime("%Y-%m-%d")
    locked = float(locked_price or 0)
    empty = {
        "as_of": as_of_str,
        "locked_price": int(round(locked)) if locked else 0,
        "subject_sqft": round(float(living_area or 0)),
        "listings": [],
        "ids": [],
        "rank": 0,
        "rank_of": 0,
        "active_count": 0,
    }
    if df is None or len(df) == 0 or locked <= 0:
        return empty
    work = df.copy()
    if "LivingArea" in work.columns and living_area and living_area > 0:
        work = work[listing_flow_sqft_mask(work["LivingArea"], living_area)]
    if "Price" not in work.columns:
        return empty
    listings: list[dict] = []
    for _, row in work.iterrows():
        try:
            price = float(row.get("Price"))
        except (TypeError, ValueError):
            continue
        if price <= 0:
            continue
        list_ts = pd.to_datetime(row.get("ListDate"), errors="coerce")
        if pd.isna(list_ts):
            continue
        list_ts = list_ts.tz_localize(None) if getattr(list_ts, "tzinfo", None) else list_ts
        if pd.Timestamp(list_ts).normalize() > as_of_ts:
            continue
        status = str(row.get("StatusNorm") or "")
        sold_ts = pd.to_datetime(row.get("SoldDate"), errors="coerce")
        if pd.notna(sold_ts):
            sold_ts = sold_ts.tz_localize(None) if getattr(sold_ts, "tzinfo", None) else sold_ts
            if pd.Timestamp(sold_ts).normalize() <= as_of_ts:
                continue
        if status == "Sold" or status in FINGERPRINT_LIVE_STATUSES:
            list_date = ""
            try:
                list_date = pd.Timestamp(list_ts).strftime("%Y-%m-%d")
            except Exception:
                list_date = ""
            card = _pulse_listing_from_row(row, locked, list_date=list_date)
            card["status"] = "Active"
            card["was_status"] = status
            listings.append(card)
    listings = apply_listing_photos(listings, photo_map, gallery_map)
    rank_info = _assign_active_ranks(listings, locked)
    return {
        "as_of": as_of_str,
        "locked_price": int(round(locked)),
        "subject_sqft": round(float(living_area or 0)),
        "listings": listings,
        "ids": [str(r.get("id")) for r in listings if r.get("id")],
        "rank": rank_info.get("rank") or 0,
        "rank_of": rank_info.get("rank_of") or 0,
        "active_count": len(listings),
    }


def _pulse_day(value) -> pd.Timestamp | None:
    ts = pd.to_datetime(value, errors="coerce")
    if pd.isna(ts):
        return None
    ts = ts.tz_localize(None) if getattr(ts, "tzinfo", None) else ts
    return pd.Timestamp(ts).normalize()


def _status_as_of_row(row: pd.Series, as_of_ts: pd.Timestamp, *, latest: bool = False) -> str:
    """Active / under-contract / Sold as of a historical day."""
    list_ts = _pulse_day(row.get("ListDate"))
    if list_ts is None or list_ts > as_of_ts:
        return ""
    sold_ts = _pulse_day(row.get("SoldDate"))
    if sold_ts is not None and sold_ts <= as_of_ts:
        return "Sold"
    current = str(row.get("StatusNorm") or "")
    if current in FINGERPRINT_UC_STATUSES:
        pending_ts = _pulse_day(row.get("LastUpdateDate"))
        if pending_ts is not None and list_ts <= pending_ts <= as_of_ts:
            return current
        if latest:
            return current
        return "Active"
    if current == "Sold":
        pending_ts = (sold_ts - pd.Timedelta(days=14)) if sold_ts is not None else None
        if pending_ts is not None and pending_ts < list_ts:
            pending_ts = list_ts
        if pending_ts is not None and pending_ts <= as_of_ts:
            return "Pending"
        return "Active"
    if current in FINGERPRINT_LIVE_STATUSES:
        return current
    return ""


def build_pulse_snapshot_as_of(
    df: pd.DataFrame,
    locked_price: float,
    living_area: float = 0,
    *,
    as_of: str,
    photo_map: dict | None = None,
    gallery_map: dict | None = None,
    latest: bool = False,
) -> dict:
    """Live similar set as it would have looked on ``as_of`` (Active + under contract)."""
    as_of_ts = _pulse_day(as_of) or pd.Timestamp.now().normalize()
    as_of_str = as_of_ts.strftime("%Y-%m-%d")
    locked = float(locked_price or 0)
    empty = {
        "as_of": as_of_str,
        "locked_price": int(round(locked)) if locked else 0,
        "subject_sqft": round(float(living_area or 0)),
        "listings": [],
        "rank": 0,
        "rank_of": 0,
        "active_count": 0,
    }
    if df is None or len(df) == 0 or locked <= 0:
        return empty
    work = df.copy()
    if "LivingArea" in work.columns and living_area and living_area > 0:
        work = work[listing_flow_sqft_mask(work["LivingArea"], living_area)]
    if "Price" not in work.columns:
        return empty
    listings: list[dict] = []
    for _, row in work.iterrows():
        try:
            price = float(row.get("Price"))
        except (TypeError, ValueError):
            continue
        if price <= 0:
            continue
        status = _status_as_of_row(row, as_of_ts, latest=latest)
        if status not in FINGERPRINT_LIVE_STATUSES:
            continue
        list_date = ""
        list_ts = _pulse_day(row.get("ListDate"))
        if list_ts is not None:
            list_date = list_ts.strftime("%Y-%m-%d")
        card = _pulse_listing_from_row(row, locked, list_date=list_date)
        card["status"] = status
        listings.append(card)
    listings = apply_listing_photos(listings, photo_map, gallery_map)
    rank_info = _assign_active_ranks(listings, locked)
    return {
        "as_of": as_of_str,
        "locked_price": int(round(locked)),
        "subject_sqft": round(float(living_area or 0)),
        "listings": listings,
        **rank_info,
    }


def fingerprint_sold_from_df(
    df: pd.DataFrame,
    ids: set[str],
    *,
    as_of: str | None = None,
) -> dict[str, dict]:
    """Ids that show Sold in the market pull, optionally only if sold by ``as_of``."""
    found: dict[str, dict] = {}
    if df is None or len(df) == 0 or not ids:
        return found
    work = df.copy()
    as_of_ts = _pulse_day(as_of) if as_of else None
    for _, row in work.iterrows():
        pid = _pulse_listing_id(row)
        if pid not in ids:
            continue
        sold_ts = _pulse_day(row.get("SoldDate"))
        status = str(row.get("StatusNorm") or "")
        if status != "Sold" and sold_ts is None:
            continue
        if as_of_ts is not None and (sold_ts is None or sold_ts > as_of_ts):
            continue
        list_date = ""
        list_ts = _pulse_day(row.get("ListDate"))
        if list_ts is not None:
            list_date = list_ts.strftime("%Y-%m-%d")
        card = _pulse_listing_from_row(row, 0, list_date=list_date)
        card["status"] = "Sold"
        found[pid] = card
    return found


def merge_fingerprint_ledger(
    ledger: dict | None,
    snapshot: dict | None,
    *,
    baseline: dict | None = None,
    sold_map: dict | None = None,
    as_of: str | None = None,
) -> dict:
    """Keep every seen listing, including homes that left the live pull."""
    snap = snapshot if isinstance(snapshot, dict) else {}
    as_of = as_of or str(snap.get("as_of") or datetime.now().strftime("%Y-%m-%d"))
    locked = float(snap.get("locked_price") or 0)
    prev = ledger if isinstance(ledger, dict) else {}
    listings = dict(prev.get("listings") or {})
    baseline_ids = set()
    if isinstance(baseline, dict):
        baseline_ids = {str(x) for x in (baseline.get("ids") or []) if x}
        if not baseline_ids:
            baseline_ids = {
                str(r.get("id"))
                for r in (baseline.get("listings") or [])
                if isinstance(r, dict) and r.get("id")
            }

    curr_ids: set[str] = set()
    for row in snap.get("listings") or []:
        if not isinstance(row, dict) or not row.get("id"):
            continue
        pid = str(row["id"])
        curr_ids.add(pid)
        existing = listings.get(pid) if isinstance(listings.get(pid), dict) else {}
        card = _pulse_card(row, locked)
        status_hist = list(existing.get("status_history") or [])
        new_status = str(card.get("status") or "")
        new_price = int(card.get("price") or 0)
        last = status_hist[-1] if status_hist else {}
        if not status_hist or last.get("status") != new_status or last.get("price") != new_price:
            status_hist.append({"as_of": as_of, "as_of": as_of, "status": new_status, "price": new_price})
            status_hist = status_hist[-16:]
        listings[pid] = {
            **existing,
            **card,
            "baseline": bool(existing.get("baseline") or pid in baseline_ids),
            "first_seen": existing.get("first_seen") or as_of,
            "last_seen": as_of,
            "first_price": existing.get("first_price") or new_price,
            "last_price": new_price,
            "first_status": existing.get("first_status") or new_status,
            "last_status": new_status,
            "rank_then": existing.get("rank_then") or card.get("rank") or 0,
            "rank_now": card.get("rank") or 0,
            "status_history": status_hist,
            "gone": False,
        }

    sold_map = sold_map if isinstance(sold_map, dict) else {}
    for pid, sold_row in sold_map.items():
        existing = listings.get(pid) if isinstance(listings.get(pid), dict) else {}
        card = _pulse_card(sold_row, locked)
        card["status"] = "Sold"
        status_hist = list(existing.get("status_history") or [])
        if not status_hist or status_hist[-1].get("status") != "Sold":
            status_hist.append({"as_of": as_of, "status": "Sold", "price": int(card.get("price") or 0)})
        listings[pid] = {
            **existing,
            **card,
            "baseline": bool(existing.get("baseline") or pid in baseline_ids),
            "first_seen": existing.get("first_seen") or as_of,
            "last_seen": as_of,
            "last_status": "Sold",
            "status_history": status_hist[-16:],
            "gone": False,
        }
        curr_ids.add(pid)

    for pid, existing in list(listings.items()):
        if pid in curr_ids:
            continue
        last_status = str(existing.get("last_status") or "")
        gone = last_status not in FINGERPRINT_UC_STATUSES and last_status != "Sold"
        listings[pid] = {**existing, "gone": gone, "last_seen": existing.get("last_seen") or as_of}

    return {"listings": listings, "updated": as_of}


def append_fingerprint_history(
    history: list | None,
    snapshot: dict | None,
    digest: dict | None,
    market_pulse: dict | None = None,
) -> list:
    snap = snapshot if isinstance(snapshot, dict) else {}
    dig = digest if isinstance(digest, dict) else {}
    rows = list(history) if isinstance(history, list) else []
    as_of = str(snap.get("as_of") or dig.get("as_of") or datetime.now().strftime("%Y-%m-%d"))
    row = {
        "as_of": as_of,
        "locked_price": int(snap.get("locked_price") or dig.get("locked_price") or 0),
        "rank": int(snap.get("rank") or dig.get("rank") or 0),
        "rank_of": int(snap.get("rank_of") or dig.get("rank_of") or 0),
        "active_count": int(snap.get("active_count") or 0),
        "new_under": int(dig.get("new_under") or 0),
        "new_over": int(dig.get("new_over") or 0),
        "still_active_cheaper": int(dig.get("still_active_cheaper") or 0),
        "went_pending": int(dig.get("went_pending") or 0),
        "went_sold": int(dig.get("went_sold") or 0),
        "listed_since": int(dig.get("listed_since") or 0),
        "uc_since": int(dig.get("uc_since") or 0),
        "sold_since": int(dig.get("sold_since") or 0),
        "listed_week": int(dig.get("listed_week") or 0),
        "uc_week": int(dig.get("uc_week") or 0),
        "sold_week": int(dig.get("sold_week") or 0),
        "listed_under_week": int(dig.get("listed_under_week") or 0),
        "listed_over_week": int(dig.get("listed_over_week") or 0),
        "clock": str(dig.get("clock") or ""),
        "clock_at": str(dig.get("clock_at") or ""),
    }
    if isinstance(market_pulse, dict) and (
        market_pulse.get("active_count") is not None
        or market_pulse.get("months_of_inventory") is not None
    ):
        row["market"] = compact_market_pulse(market_pulse, market_pulse)
    if rows and rows[-1].get("as_of") == as_of:
        if "market" not in row and isinstance(rows[-1].get("market"), dict):
            row["market"] = rows[-1]["market"]
        rows[-1] = row
    else:
        rows.append(row)
    return rows[-52:]


FINGERPRINT_NOTE_MAX_CHARS = 500


def _fingerprint_note_as_of(value) -> str:
    text = str(value or "").strip()[:10]
    if len(text) != 10 or text[4] != "-" or text[7] != "-":
        return ""
    try:
        datetime.strptime(text, "%Y-%m-%d")
    except ValueError:
        return ""
    return text


def sanitize_fingerprint_note_body(text) -> str:
    """Plain text only — never HTML, never treated as a list-price rec."""
    import re

    raw = str(text or "")
    raw = re.sub(r"</?[A-Za-z][^>]{0,200}>", " ", raw)
    return " ".join(raw.split()).strip()[:FINGERPRINT_NOTE_MAX_CHARS]


def normalize_fingerprint_notes(notes) -> list[dict]:
    """One note per week; drafts stay private until status is published."""
    if not isinstance(notes, list):
        return []
    by_week: dict[str, dict] = {}
    for item in notes:
        if not isinstance(item, dict):
            continue
        as_of = _fingerprint_note_as_of(item.get("as_of"))
        body = sanitize_fingerprint_note_body(item.get("body"))
        if not as_of or not body:
            continue
        status = str(item.get("status") or "draft").strip().lower()
        if status not in ("draft", "published"):
            status = "draft"
        published_at = str(item.get("published_at") or "").strip() if status == "published" else ""
        by_week[as_of] = {
            "as_of": as_of,
            "body": body,
            "status": status,
            "published_at": published_at,
            "emailed_at": str(item.get("emailed_at") or "").strip(),
        }
    rows = [by_week[k] for k in sorted(by_week)]
    return rows[-52:]


def _pulse_ids(snapshot: dict | None) -> set[str]:
    ids: set[str] = set()
    if not isinstance(snapshot, dict):
        return ids
    for row in snapshot.get("listings") or []:
        if isinstance(row, dict) and row.get("id"):
            ids.add(str(row["id"]))
    return ids


def digest_pulse(
    snapshot: dict | None,
    locked: dict | None,
    previous: dict | None = None,
    *,
    baseline: dict | None = None,
    ledger: dict | None = None,
    subject: dict | None = None,
) -> dict:
    """Listed / under contract / sold since the clock, plus this week's slice.

    Clock is the listed/active date once known, otherwise generate. Pending,
    backup, and first-right all count as under contract.
    """
    snap = snapshot if isinstance(snapshot, dict) else {}
    lock = locked if isinstance(locked, dict) else {}
    clock = fingerprint_clock(lock)
    locked_price = float(lock.get("locked_price") or snap.get("locked_price") or 0)
    clock_at = clock.get("clock_at") or ""
    as_of = _fingerprint_date(snap.get("as_of")) or datetime.now().strftime("%Y-%m-%d")
    prev_as_of = _fingerprint_date((previous or {}).get("as_of")) if isinstance(previous, dict) else ""
    pool = _fingerprint_pool(snap, ledger)
    since = _window_event_counts(
        pool, clock_at, as_of, start_inclusive=True, subject=subject, locked_price=locked_price
    )
    week = (
        _window_event_counts(
            pool, prev_as_of, as_of, start_inclusive=False, subject=subject, locked_price=locked_price
        )
        if prev_as_of
        else {"listed": 0, "uc": 0, "sold": 0, "listed_under": 0, "listed_over": 0}
    )

    new_under = 0
    new_over = 0
    still_active_cheaper = 0
    active_now = 0
    pending_now = 0
    for row in snap.get("listings") or []:
        if not isinstance(row, dict) or listing_is_subject(row, subject):
            continue
        try:
            price = float(row.get("price") or 0)
        except (TypeError, ValueError):
            price = 0
        status = str(row.get("status") or "")
        if status == "Active":
            active_now += 1
        if status in FINGERPRINT_UC_STATUSES:
            pending_now += 1
        is_new = _in_date_window(_listing_on_date(row), clock_at, as_of, start_inclusive=True)
        side = row.get("side")
        if not side:
            side = "under" if price < locked_price else ("over" if price > locked_price else "at")
        if is_new:
            if side == "under":
                new_under += 1
            elif side == "over":
                new_over += 1
        if status == "Active" and price and price < locked_price:
            still_active_cheaper += 1

    baseline_ids = set()
    if isinstance(baseline, dict):
        baseline_ids = {str(x) for x in (baseline.get("ids") or []) if x}
        if not baseline_ids:
            baseline_ids = {
                str(r.get("id"))
                for r in (baseline.get("listings") or [])
                if isinstance(r, dict) and r.get("id")
            }
    went_pending = 0
    went_sold = 0
    still_from_baseline = 0
    ledger_listings = (ledger or {}).get("listings") if isinstance(ledger, dict) else {}
    if isinstance(ledger_listings, dict) and baseline_ids:
        for pid in baseline_ids:
            rec = ledger_listings.get(pid) if isinstance(ledger_listings.get(pid), dict) else {}
            if listing_is_subject(rec, subject):
                continue
            st = str(rec.get("last_status") or rec.get("status") or "")
            sold_day = _status_event_date(rec, FINGERPRINT_SOLD_STATUSES)
            uc_day = _status_event_date(rec, set(FINGERPRINT_UC_STATUSES))
            still_active = st == "Active" and not rec.get("gone")
            if still_active and not _in_date_window(sold_day, clock_at, as_of) and not _in_date_window(uc_day, clock_at, as_of):
                still_from_baseline += 1
            if _in_date_window(sold_day, clock_at, as_of):
                went_sold += 1
            elif _in_date_window(uc_day, clock_at, as_of):
                went_pending += 1

    return {
        "new_under": new_under,
        "new_over": new_over,
        "listed_since": since["listed"],
        "uc_since": since["uc"],
        "sold_since": since["sold"],
        "listed_week": week["listed"],
        "uc_week": week["uc"],
        "sold_week": week["sold"],
        "listed_under_week": week.get("listed_under") or 0,
        "listed_over_week": week.get("listed_over") or 0,
        "listed_under_since": since.get("listed_under") or 0,
        "listed_over_since": since.get("listed_over") or 0,
        "still_active_cheaper": still_active_cheaper,
        "as_of": as_of,
        "locked_price": int(round(locked_price)) if locked_price else 0,
        "locked_at": clock.get("locked_at") or "",
        "active_at": clock.get("active_at") or "",
        "clock": clock.get("clock") or "generate",
        "clock_at": clock_at,
        "clock_label": clock.get("clock_label") or "since generate",
        "count": len(snap.get("listings") or []),
        "active_count": int(snap.get("active_count") or active_now),
        "pending_now": pending_now,
        "baseline_active": len(baseline_ids),
        "still_from_baseline": still_from_baseline,
        "went_pending": went_pending,
        "went_sold": went_sold,
        "rank": int(snap.get("rank") or 0),
        "rank_of": int(snap.get("rank_of") or 0),
        "rank_then": int((baseline or {}).get("rank") or 0) if isinstance(baseline, dict) else 0,
    }


PULSE_CARD_CAP = 24


def _pulse_is_new(row: dict, clock_at: str, as_of: str = "") -> bool:
    return _in_date_window(_listing_on_date(row), clock_at, as_of, start_inclusive=True)


def _pulse_card(row: dict, locked_price: float) -> dict:
    try:
        price = float(row.get("price") or 0)
    except (TypeError, ValueError):
        price = 0
    try:
        locked = float(locked_price or 0)
    except (TypeError, ValueError):
        locked = 0
    delta = int(round(price - locked)) if price and locked else int(row.get("delta") or 0)
    address = str(row.get("address") or "").strip()
    city = str(row.get("city") or "").strip()
    urls = pulse_portal_urls(address, city) if not row.get("zillow") else {
        "zillow": row.get("zillow") or "",
        "realtor": row.get("realtor") or "",
    }
    photos = row.get("photos") if isinstance(row.get("photos"), list) else []
    photo_url = str(row.get("photo_url") or (photos[0] if photos else "") or "")
    if photo_url and photo_url not in photos:
        photos = [photo_url] + list(photos)
    return {
        "id": str(row.get("id") or ""),
        "mls": str(row.get("mls") or ""),
        "address": address,
        "city": city,
        "price": int(round(price)) if price else 0,
        "delta": delta,
        "list_date": str(row.get("list_date") or row.get("list_date") or ""),
        "list_date": str(row.get("list_date") or row.get("list_date") or ""),
        "sqft": int(row.get("sqft") or 0),
        "beds": float(row.get("beds") or 0),
        "baths": float(row.get("baths") or 0),
        "year": int(row.get("year") or 0),
        "dom": int(row.get("dom") or 0),
        "ppsf": float(row.get("ppsf") or 0),
        "status": str(row.get("status") or ""),
        "side": str(row.get("side") or ""),
        "zillow": urls.get("zillow") or "",
        "realtor": urls.get("realtor") or "",
        "photo_url": photo_url,
        "photo_url": photo_url,
        "photos": [str(u) for u in photos if u][:8],
        "lat": row.get("lat"),
        "lng": row.get("lng"),
        "rank": int(row.get("rank") or 0),
        "rank_of": int(row.get("rank_of") or 0),
        "rank_then": int(row.get("rank_then") or 0),
        "was_price": int(row.get("was_price") or row.get("first_price") or 0),
        "was_status": str(row.get("was_status") or row.get("first_status") or ""),
        "baseline": bool(row.get("baseline")),
        "gone": bool(row.get("gone")),
        "status_history": row.get("status_history") if isinstance(row.get("status_history"), list) else [],
    }


def _pulse_talk_tracks(
    digest: dict,
    *,
    cheaper_before: int | None = None,
    stale_upload: bool = False,
) -> dict:
    new_under = int(digest.get("new_under") or 0)
    new_over = int(digest.get("new_over") or 0)
    cheaper = int(digest.get("still_active_cheaper") or 0)
    rank = int(digest.get("rank") or 0)
    rank_of = int(digest.get("rank_of") or 0)
    rank_then = int(digest.get("rank_then") or 0)
    went_pending = int(digest.get("uc_since") or digest.get("went_pending") or 0)
    went_sold = int(digest.get("sold_since") or digest.get("went_sold") or 0)
    listed_week = int(digest.get("listed_week") or 0)
    uc_week = int(digest.get("uc_week") or 0)
    sold_week = int(digest.get("sold_week") or 0)
    clock_label = str(digest.get("clock_label") or "since generate")
    since_you = "since you listed" if digest.get("clock") == "active" else "since we generated this"
    agent: list[str] = []
    seller: list[str] = []
    if stale_upload:
        agent.append("Snapshot unchanged. Upload this week’s MLS export to refresh the Fingerprint.")
        seller.append("This update uses the last market file we have. Ask your agent for this week’s export to refresh.")
    if rank and rank_of and rank_then and rank > rank_then:
        agent.append(
            f"Rank slipped from {rank_then} to {rank} of {rank_of} in this size band. Walk whether the initial list still wins the first showing."
        )
        seller.append(
            f"Your list is now {rank} of {rank_of} similar actives (was {rank_then}). More homes sit under you than {since_you}."
        )
    elif rank and rank_of:
        agent.append(f"You sit {rank} of {rank_of} similar actives at the initial list.")
        seller.append(f"Among similar homes buyers can still buy, yours is priced {rank} of {rank_of}.")
    if listed_week or uc_week or sold_week:
        bits = []
        if listed_week:
            bits.append(f"{listed_week} listed")
        if uc_week:
            bits.append(f"{uc_week} under contract")
        if sold_week:
            bits.append(f"{sold_week} sold")
        week_line = " · ".join(bits)
        agent.append(f"This week in the size band: {week_line}.")
        seller.append(f"This week: {week_line} among similar homes.")
    if went_pending >= 1:
        agent.append(
            f"{went_pending} similar home{'s' if went_pending != 1 else ''} went under contract {clock_label}. Those buyers did not wait."
        )
        seller.append(
            f"{went_pending} similar home{'s' if went_pending != 1 else ''} {since_you} {'are' if went_pending != 1 else 'is'} now under contract."
        )
    if went_sold >= 1:
        agent.append(f"{went_sold} similar home{'s' if went_sold != 1 else ''} sold {clock_label} — proof of what this band will pay.")
        seller.append(f"{went_sold} similar home{'s' if went_sold != 1 else ''} sold {since_you}.")
    if new_under >= 3:
        agent.append(
            f"{new_under} similar homes listed under the initial list {clock_label}. Walk those addresses — buyers open cheaper first."
        )
        seller.append(
            f"{new_under} similar homes have listed below your price {since_you}. Those are the homes buyers will open first."
        )
    elif new_under == 1:
        agent.append(f"One similar home listed under the initial list {clock_label}. Open it with the seller and compare condition.")
        seller.append(f"One similar home listed below your price {since_you}. Worth walking through how it compares.")
    if cheaper_before is not None and cheaper > cheaper_before:
        agent.append(f"The queue under you grew from {cheaper_before} to {cheaper} still-active cheaper homes.")
        seller.append(
            f"More similar homes are now priced under you ({cheaper}, up from {cheaper_before})."
        )
    if new_over > new_under and new_over >= 2:
        agent.append("Most new similar lists came in above the initial list — your number is still the value ask.")
        seller.append("Most new similar homes listed above your price. Your number is still the value play in this set.")
    if not agent and not stale_upload:
        agent.append("Quiet week in the size band — no new cheaper similar lists to walk. Hold the initial list.")
        seller.append("A quiet week in your size range. No new similar homes listed under your price.")
    return {"agent": agent[:4], "seller": seller[:4]}


def _baseline_ids(baseline: dict | None) -> set[str]:
    if not isinstance(baseline, dict):
        return set()
    ids = {str(x) for x in (baseline.get("ids") or []) if x}
    if ids:
        return ids
    return {
        str(r.get("id"))
        for r in (baseline.get("listings") or [])
        if isinstance(r, dict) and r.get("id")
    }


def _comp_set(lock: dict | None, subject: dict | None, *, portal_criteria: dict | None = None, city: str = "") -> dict:
    """How this similar set was cut — beds, baths, garage, size band, market."""
    lock = lock if isinstance(lock, dict) else {}
    sub = subject if isinstance(subject, dict) else {}
    c = portal_criteria if isinstance(portal_criteria, dict) else {}
    try:
        sqft = float(
            lock.get("subject_sqft")
            or lock.get("subject_sqft")
            or sub.get("living_area")
            or sub.get("sqft")
            or 0
        )
    except (TypeError, ValueError):
        sqft = 0.0
    lo = int(round(sqft * LISTING_FLOW_SQFT_LO)) if sqft else 0
    hi = int(round(sqft * LISTING_FLOW_SQFT_HI)) if sqft else 0
    def _num(key_a, key_b=None, fallback=None):
        for key in (key_a, key_b):
            if not key:
                continue
            val = c.get(key)
            if val is None:
                val = sub.get(key)
            if val not in (None, "", 0, 0.0):
                try:
                    return float(val)
                except (TypeError, ValueError):
                    continue
        return fallback
    beds = _num("min_beds", "beds", sub.get("beds") or lock.get("subject_beds"))
    baths = _num("min_baths", "baths", sub.get("baths") or lock.get("subject_baths"))
    garage = _num(
        "min_garage",
        "garage_spaces",
        sub.get("garage_spaces") or lock.get("subject_garage"),
    )
    market = str(lock.get("market_label") or lock.get("area_name") or city or "").strip()
    chips: list[str] = []
    if beds:
        chips.append(f"{int(beds)}+ bed" if c.get("min_beds") else f"{int(beds)} bed")
    if baths:
        n = baths if baths % 1 else int(baths)
        chips.append(f"{n}+ bath" if c.get("min_baths") else f"{n} bath")
    if garage:
        n = int(garage)
        chips.append(f"{n}+ car" if c.get("min_garage") else f"{n}-car garage")
    if lo and hi:
        chips.append(f"{lo:,}–{hi:,} sf")
    if market:
        chips.append(market.split("·")[0].strip())
    if not chips:
        chips.append("Similar homes in this market")
    return {
        "chips": chips,
        "beds": beds or 0,
        "baths": baths or 0,
        "garage": garage or 0,
        "sqft_low": lo,
        "sqft_high": hi,
        "sqft": int(round(sqft)) if sqft else 0,
        "market": market,
        "city": str(city or "").strip(),
    }


def _days_since(value) -> int:
    ts = pd.to_datetime(value, errors="coerce")
    if pd.isna(ts):
        return 0
    ts = ts.tz_localize(None) if getattr(ts, "tzinfo", None) else ts
    return max(0, int((pd.Timestamp.now() - ts).days))


def build_pulse_brief(
    lock: dict | None,
    snapshot: dict | None,
    previous: dict | None = None,
    *,
    subject: dict | None = None,
    share_url: str = "",
    report_url: str = "",
    fingerprint_url: str = "",
    stale_upload: bool = False,
    baseline: dict | None = None,
    ledger: dict | None = None,
    history: list | None = None,
    notes: list | None = None,
    portal_criteria: dict | None = None,
    city: str = "",
    market_pulse: dict | None = None,
) -> dict:
    """One brief JSON for Live Story, Fingerprint page, and weekly email."""
    lock = lock if isinstance(lock, dict) else {}
    snap = snapshot if isinstance(snapshot, dict) else {}
    prev = previous if isinstance(previous, dict) else {}
    sub = subject if isinstance(subject, dict) else {}
    digest = digest_pulse(snap, lock, prev, baseline=baseline, ledger=ledger, subject=sub)
    locked_price = float(digest.get("locked_price") or lock.get("locked_price") or 0)
    locked_at = str(lock.get("locked_at") or digest.get("locked_at") or "")
    active_at = str(digest.get("active_at") or lock.get("active_at") or "")
    clock_at = str(digest.get("clock_at") or "")
    as_of = str(digest.get("as_of") or "")
    days_locked = _days_since(locked_at)
    days_active = _days_since(active_at) if active_at else 0

    has_prev = bool(prev and prev.get("listings") is not None)
    prev_by_id = {
        str(r.get("id")): r
        for r in (prev.get("listings") or [])
        if isinstance(r, dict) and r.get("id")
    }
    curr_ids = _pulse_ids(snap)

    new_under: list[dict] = []
    new_over: list[dict] = []
    cheaper_active: list[dict] = []
    price_cuts: list[dict] = []
    status_changes: list[dict] = []
    still_active: list[dict] = []
    pending_now: list[dict] = []
    for row in snap.get("listings") or []:
        if not isinstance(row, dict) or listing_is_subject(row, sub):
            continue
        card = _pulse_card(row, locked_price)
        is_new = _pulse_is_new(row, clock_at, as_of)
        if is_new and card["side"] == "under" and len(new_under) < PULSE_CARD_CAP:
            new_under.append(card)
        elif is_new and card["side"] == "over" and len(new_over) < PULSE_CARD_CAP:
            new_over.append(card)
        if card["status"] == "Active":
            still_active.append(card)
            if card["price"] and card["price"] < locked_price and len(cheaper_active) < PULSE_CARD_CAP:
                cheaper_active.append(card)
        if card["status"] in FINGERPRINT_UC_STATUSES and len(pending_now) < PULSE_CARD_CAP:
            pending_now.append(card)
        prev_row = prev_by_id.get(card["id"])
        if prev_row:
            try:
                old_price = float(prev_row.get("price") or 0)
            except (TypeError, ValueError):
                old_price = 0
            if old_price and card["price"] and old_price - card["price"] >= 1000:
                cut = dict(card)
                cut["was_price"] = int(round(old_price))
                if len(price_cuts) < PULSE_CARD_CAP:
                    price_cuts.append(cut)
            old_status = str(prev_row.get("status") or "")
            if old_status and card["status"] and old_status != card["status"]:
                changed = dict(card)
                changed["was_status"] = old_status
                if len(status_changes) < PULSE_CARD_CAP:
                    status_changes.append(changed)

    gone: list[dict] = []
    for pid, prev_row in prev_by_id.items():
        if pid in curr_ids or listing_is_subject(prev_row, sub):
            continue
        card = _pulse_card(prev_row, locked_price)
        if len(gone) < PULSE_CARD_CAP:
            gone.append(card)

    baseline_then: list[dict] = []
    went_pending_cards: list[dict] = []
    went_sold_cards: list[dict] = []
    ledger_listings = (ledger or {}).get("listings") if isinstance(ledger, dict) else {}
    clock_ids = _baseline_ids(baseline)
    freeze_by_id = {
        str(r.get("id")): r
        for r in ((baseline or {}).get("listings") or [])
        if isinstance(r, dict) and r.get("id")
    }
    if isinstance(ledger_listings, dict) and clock_ids:
        for pid in clock_ids:
            rec = ledger_listings.get(pid) if isinstance(ledger_listings.get(pid), dict) else freeze_by_id.get(pid)
            if not isinstance(rec, dict) or listing_is_subject(rec, sub):
                continue
            card = _pulse_card(rec, locked_price)
            st = str(rec.get("last_status") or rec.get("status") or "")
            if rec.get("gone") and st == "Active":
                card["status"] = "Gone"
            baseline_then.append(card)
            sold_day = _status_event_date(rec, FINGERPRINT_SOLD_STATUSES)
            uc_day = _status_event_date(rec, set(FINGERPRINT_UC_STATUSES))
            if _in_date_window(sold_day, clock_at, as_of):
                went_sold_cards.append(card)
            elif _in_date_window(uc_day, clock_at, as_of):
                went_pending_cards.append(card)
    elif isinstance(ledger_listings, dict):
        for rec in ledger_listings.values():
            if not isinstance(rec, dict) or not rec.get("baseline") or listing_is_subject(rec, sub):
                continue
            card = _pulse_card(rec, locked_price)
            st = str(rec.get("last_status") or "")
            if rec.get("gone") and st == "Active":
                card["status"] = "Gone"
            baseline_then.append(card)
            if st in FINGERPRINT_UC_STATUSES:
                went_pending_cards.append(card)
            elif st == "Sold":
                went_sold_cards.append(card)
    elif isinstance(baseline, dict):
        for row in baseline.get("listings") or []:
            if isinstance(row, dict) and not listing_is_subject(row, sub):
                baseline_then.append(_pulse_card(row, locked_price))

    still_active.sort(key=lambda c: c.get("price") or 0)
    new_under.sort(key=lambda c: c.get("price") or 0)
    new_over.sort(key=lambda c: c.get("price") or 0)
    cheaper_active.sort(key=lambda c: c.get("price") or 0)
    baseline_then.sort(key=lambda c: c.get("price") or c.get("was_price") or 0)

    prev_digest = digest_pulse(prev, lock, None, baseline=baseline, ledger=None, subject=sub) if has_prev else None
    cheaper_before = int(prev_digest["still_active_cheaper"]) if prev_digest else None
    tracks = _pulse_talk_tracks(
        digest,
        cheaper_before=cheaper_before,
        stale_upload=stale_upload,
    )
    fp_url = fingerprint_url or share_url or report_url
    position = []
    for card in still_active:
        if card.get("price"):
            position.append({
                "id": card.get("id"),
                "price": card.get("price"),
                "address": card.get("address"),
                "city": card.get("city") or "",
                "subject": False,
                "beds": card.get("beds") or 0,
                "baths": card.get("baths") or 0,
                "sqft": card.get("sqft") or 0,
                "photo_url": card.get("photo_url") or "",
                "lat": card.get("lat"),
                "lng": card.get("lng"),
                "status": card.get("status") or "Active",
            })
    if locked_price:
        position.append({
            "id": "subject",
            "price": int(round(locked_price)),
            "address": str(sub.get("address") or "Your home"),
            "city": str(sub.get("city") or ""),
            "subject": True,
            "beds": sub.get("beds") or 0,
            "baths": sub.get("baths") or 0,
            "sqft": lock.get("subject_sqft") or sub.get("living_area") or 0,
            "photo_url": str(sub.get("photo_url") or sub.get("photo") or ""),
            "lat": sub.get("latitude") or sub.get("lat"),
            "lng": sub.get("longitude") or sub.get("lng"),
            "status": "Your list",
        })
    position.sort(key=lambda c: c.get("price") or 0)

    return {
        "as_of": digest.get("as_of"),
        "locked_price": int(round(locked_price)) if locked_price else 0,
        "locked_price": int(round(locked_price)) if locked_price else 0,
        "locked_at": locked_at,
        "active_at": _fingerprint_date(active_at),
        "clock": digest.get("clock") or "generate",
        "clock_at": clock_at,
        "clock_label": digest.get("clock_label") or "since generate",
        "days_locked": days_locked,
        "days_active": days_active,
        "days_locked": days_locked,
        "days_active": days_active,
        "market_label": str(lock.get("market_label") or ""),
        "subject_address": str(sub.get("address") or ""),
        "subject_photo": str(sub.get("photo_url") or sub.get("photo") or ""),
        "subject_lat": sub.get("latitude") or sub.get("lat"),
        "subject_lng": sub.get("longitude") or sub.get("lng"),
        "subject_sqft": float(lock.get("subject_sqft") or sub.get("living_area") or 0),
        "share_url": share_url or "",
        "report_url": report_url or "",
        "fingerprint_url": fp_url or "",
        "digest": digest,
        "stale_upload": bool(stale_upload),
        "talk": tracks,
        "talk": tracks,
        "new_under": new_under,
        "new_over": new_over,
        "new_under": new_under,
        "new_over": new_over,
        "cheaper_active": cheaper_active,
        "still_active": still_active[:40],
        "pending_now": pending_now,
        "pending_now": pending_now,
        "price_cuts": price_cuts,
        "price_cuts": price_cuts,
        "status_changes": status_changes,
        "gone": gone,
        "baseline": baseline_then[:40],
        "baseline": baseline_then[:40],
        "went_pending": went_pending_cards[:PULSE_CARD_CAP],
        "went_sold": went_sold_cards[:PULSE_CARD_CAP],
        "position": position[:40],
        "history": list(history or [])[-12:],
        "notes": normalize_fingerprint_notes(notes),
        "sold_at": str(lock.get("sold_at") or ""),
        "paused_at": str(lock.get("paused_at") or ""),
        "paused_reason": str(lock.get("paused_reason") or ""),
        "stop_on_under_contract": lock.get("stop_on_under_contract") is True,
        "comp_set": _comp_set(lock, sub, portal_criteria=portal_criteria, city=city),
        "last_refresh_at": str(lock.get("last_refresh_at") or lock.get("last_looked_at") or ""),
        "market_pulse": market_pulse if isinstance(market_pulse, dict) else {},
    }


def build_scatter_data(df: pd.DataFrame) -> pd.DataFrame:
    sold = df[df["StatusNorm"] == "Sold"].copy()
    sold = sold.dropna(subset=["LivingArea", "SoldPrice"])
    sold = sold[sold["LivingArea"] > 400]
    cols = [
        "MLSNumber", "SoldPrice", "LivingArea", "Bdrm", "Bath",
        "YearBuilt", "DOM", "PricePerSqFt", "Style", "Subdivision",
        "SoldDate", "Address"
    ]
    return sold[[c for c in cols if c in sold.columns]]


def linear_trend(x: np.ndarray, y: np.ndarray) -> Tuple[float, float]:
    if len(x) < 2:
        return 0.0, float(np.mean(y)) if len(y) else 0.0
    slope, intercept = np.polyfit(x, y, 1)
    return float(slope), float(intercept)


# ---------------------------------------------------------------------------
# Closest Comps Engine
# ---------------------------------------------------------------------------

def find_closest_comps(
    df: pd.DataFrame,
    subject: SubjectProperty,
    n: int = 8,
    max_sqft_diff_pct: float = 0.28,
    price_anchor: Optional[float] = None,
    max_price_diff_pct: float = 0.32,
) -> List[CompResult]:
    """
    Rank sold properties by similarity to the subject.

    Feature weights: living area, beds, year, baths, garage.
    Recency is a hard preference — a sale from last month beats an
    otherwise-similar sale from 18 months ago.

    price_anchor (trend / median) drops extreme price outliers that
    match size but are not the same product (e.g. $200k vs $390k).
    """
    sold = df[df["StatusNorm"] == "Sold"].copy()
    sold = sold.dropna(subset=["LivingArea", "SoldPrice", "YearBuilt"])
    sold = sold[sold["LivingArea"] > 400]

    if subject.living_area > 0:
        low = subject.living_area * (1 - max_sqft_diff_pct)
        high = subject.living_area * (1 + max_sqft_diff_pct)
        sold = sold[(sold["LivingArea"] >= low) & (sold["LivingArea"] <= high)]

    anchor = float(price_anchor or 0)
    if not anchor and subject.list_price:
        anchor = float(subject.list_price)
    if anchor > 0 and len(sold):
        plow = anchor * (1 - max_price_diff_pct)
        phigh = anchor * (1 + max_price_diff_pct)
        banded = sold[(sold["SoldPrice"] >= plow) & (sold["SoldPrice"] <= phigh)]
        # Keep the band when we still have enough sales; otherwise loosen once.
        if len(banded) >= max(3, min(n, 4)):
            sold = banded
        else:
            plow2 = anchor * (1 - max_price_diff_pct * 1.5)
            phigh2 = anchor * (1 + max_price_diff_pct * 1.5)
            banded2 = sold[(sold["SoldPrice"] >= plow2) & (sold["SoldPrice"] <= phigh2)]
            if len(banded2) >= 3:
                sold = banded2

    if len(sold) == 0:
        return []

    today = pd.Timestamp.now().normalize()
    subject_garage = float(subject.garage_spaces or 0)
    scores = []
    for _, row in sold.iterrows():
        sqft_diff = abs(row["LivingArea"] - subject.living_area) / max(subject.living_area, 1)
        bed_diff = abs((row["Bdrm"] or 0) - subject.beds) / 4.0
        year_diff = abs((row["YearBuilt"] or 0) - subject.year_built) / 40.0
        bath_diff = abs((row["Bath"] or 0) - subject.baths) / 3.0
        gar = float(row["GarSpaces"]) if pd.notna(row.get("GarSpaces")) else 0.0
        garage_diff = abs(gar - subject_garage) / 3.0

        sold_dt = row.get("SoldDate")
        if pd.notna(sold_dt):
            age_days = max(0, (today - pd.Timestamp(sold_dt)).days)
        else:
            age_days = 540
        # 0 days → 0, ~12 months → ~0.67, 18+ months → 1.0
        recency_diff = min(1.0, age_days / 540.0)

        price_penalty = 0.0
        if anchor > 0 and pd.notna(row.get("SoldPrice")):
            price_penalty = min(1.0, abs(float(row["SoldPrice"]) - anchor) / anchor)

        # Lower score = better match. Recent sales get a meaningful edge.
        score = (
            sqft_diff * 0.32 +
            bed_diff * 0.10 +
            year_diff * 0.10 +
            bath_diff * 0.07 +
            garage_diff * 0.08 +
            recency_diff * 0.23 +
            price_penalty * 0.10
        )
        scores.append((score, row))

    scores.sort(key=lambda x: x[0])
    results = []
    for score, row in scores[:n]:
        lat = float(row["Latitude"]) if pd.notna(row.get("Latitude")) else None
        lng = float(row["Longitude"]) if pd.notna(row.get("Longitude")) else None
        results.append(CompResult(
            mls_number=str(row["MLSNumber"]),
            address=str(row.get("Address", "")),
            sold_price=float(row["SoldPrice"]),
            living_area=float(row["LivingArea"]),
            beds=float(row["Bdrm"]) if pd.notna(row["Bdrm"]) else 0,
            baths=float(row["Bath"]) if pd.notna(row["Bath"]) else 0,
            year_built=int(row["YearBuilt"]) if pd.notna(row["YearBuilt"]) else 0,
            dom=float(row["DOM"]) if pd.notna(row["DOM"]) else 0,
            price_per_sqft=float(row["PricePerSqFt"]) if pd.notna(row["PricePerSqFt"]) else 0,
            sold_date=str(row["SoldDate"].date()) if pd.notna(row["SoldDate"]) else "",
            distance_score=round(score, 4),
            style=str(row.get("Style", "") or ""),
            subdivision=str(row.get("Subdivision", "") or ""),
            garage_spaces=float(row["GarSpaces"]) if pd.notna(row.get("GarSpaces")) else 0,
            lot_size=float(row["LotSize"]) if pd.notna(row.get("LotSize")) else 0,
            acres=float(row["Acres"]) if pd.notna(row.get("Acres")) else 0,
            latitude=lat,
            longitude=lng,
            city=str(row.get("City", "") or ""),
            photo_url=extract_photo_url(row),
        ))
    return results


# ---------------------------------------------------------------------------
# Positioning + AI Narrative
# ---------------------------------------------------------------------------

def position_subject(
    df: pd.DataFrame,
    stats: MarketStats,
    subject: SubjectProperty,
) -> PositioningResult:
    """
    Full positioning of the subject against the market + closest comps.
    """
    scatter = build_scatter_data(df)
    slope, intercept = linear_trend(
        scatter["LivingArea"].values,
        scatter["SoldPrice"].values
    ) if len(scatter) > 5 else (0.0, 0.0)

    # Base value from market trend line
    trend_value = slope * subject.living_area + intercept if subject.living_area else stats.median_sold_price
    if not trend_value or trend_value <= 0:
        trend_value = float(stats.median_sold_price or 0)

    # Comp-based value (price-banded so size-matched outliers don't sneak in)
    comps = find_closest_comps(df, subject, n=8, price_anchor=trend_value)
    if comps:
        # Weight closer comps more heavily
        weights = [1 / (c.distance_score + 0.05) for c in comps]
        total_w = sum(weights)
        comp_value = sum(c.sold_price * w for c, w in zip(comps, weights)) / total_w
        # Also look at $/sqft of comps
        comp_pps = sum(c.price_per_sqft * w for c, w in zip(comps, weights)) / total_w
        comp_value_from_pps = comp_pps * subject.living_area
        # Blend
        base = (comp_value * 0.55 + comp_value_from_pps * 0.25 + trend_value * 0.20)
    else:
        base = trend_value
        comp_pps = stats.median_price_per_sqft

    # Condition adjustments
    cond_adj = {
        "needs_work": 0.93,
        "average": 1.00,
        "updated": 1.045,
        "renovated": 1.08,
    }.get(subject.condition, 1.0)

    # Age relative to market
    mid_year = (stats.year_built_range[0] + stats.year_built_range[1]) / 2 if stats.year_built_range[0] else 1970
    if subject.year_built > mid_year + 12:
        age_adj = 1.03
    elif subject.year_built < mid_year - 18:
        age_adj = 0.96
    else:
        age_adj = 1.0

    recommended = base * cond_adj * age_adj
    # Round to nearest $1,000
    recommended = round(recommended / 1000) * 1000
    low = round(recommended * 0.965 / 1000) * 1000
    high = round(recommended * 1.04 / 1000) * 1000

    # Expected DOM estimate (simple model)
    inv = stats.months_of_inventory
    if inv < 3:
        base_dom = 28
    elif inv < 5:
        base_dom = 42
    else:
        base_dom = 65
    # Price aggressiveness factor
    if subject.list_price and subject.list_price > recommended * 1.06:
        expected_dom = base_dom * 1.6
    elif subject.list_price and subject.list_price < recommended * 0.97:
        expected_dom = base_dom * 0.7
    else:
        expected_dom = base_dom

    # Competitive statement
    if inv < 3.5:
        competitive_statement = "In the current inventory environment, a well-priced home should attract strong interest relatively quickly."
    else:
        competitive_statement = "With current inventory levels, pricing must be sharp to stand out and generate momentum."

    # Advantages / risks
    advantages = []
    risks = []
    if subject.living_area >= stats.sqft_range[0] + (stats.sqft_range[1] - stats.sqft_range[0]) * 0.6:
        advantages.append("Larger than typical living area for this market segment.")
    if subject.year_built > mid_year + 8:
        advantages.append("Newer than the majority of recent sales.")
    if subject.condition in ("updated", "renovated"):
        advantages.append("Updated condition is a meaningful advantage versus average comps.")
    if subject.garage_spaces >= 2:
        advantages.append("Two-car (or larger) garage is expected by most buyers in this price range.")

    if subject.year_built < mid_year - 15:
        risks.append("Older home – buyers will compare condition and systems carefully.")
    if subject.list_price and subject.list_price > high:
        risks.append("Current list price sits above the competitive range indicated by recent sales.")
    if stats.months_of_inventory > 5:
        risks.append("Elevated inventory means buyers have more choices – pricing and presentation matter more.")

    if not advantages:
        advantages.append("Solid fundamentals relative to recent closed sales.")
    if not risks:
        risks.append("Main risk is overpricing relative to the current absorption rate.")

    narrative = _build_subject_narrative(stats, subject, recommended, low, high, comps, expected_dom)

    return PositioningResult(
        subject=subject,
        recommended_price=recommended,
        price_low=low,
        price_high=high,
        expected_dom=round(expected_dom),
        competitive_statement=competitive_statement,
        closest_comps=comps,
        narrative=narrative,
        advantages=advantages,
        risks=risks,
        trend_slope=slope,
        trend_intercept=intercept,
    )


def _build_subject_narrative(
    stats: MarketStats,
    subject: SubjectProperty,
    recommended: float,
    low: float,
    high: float,
    comps: List[CompResult],
    expected_dom: float,
) -> str:
    inv = stats.months_of_inventory
    odds_pct = stats.odds_of_selling * 100

    temp = (
        "strong seller's market" if inv < 2.5 else
        "seller-favorable market" if inv < 4.5 else
        "balanced market" if inv < 7 else
        "buyer's market"
    )

    comp_line = ""
    if comps:
        top3 = comps[:3]
        prices = [f"${c.sold_price:,.0f}" for c in top3]
        comp_line = f"The three most similar recent sales closed at {', '.join(prices)}."

    # Psychological framing: address the two big fears directly
    fear_line = (
        "The biggest risk in today's market is not pricing slightly under the top of the range — "
        "it is launching too high, watching activity fade, and later accepting less than you could have received with a stronger initial price."
    )

    return f"""**Your Home in This Market**

We analyzed {stats.sold_count} closed sales over the past {stats.months_analyzed:.0f} months.  
Homes are selling at **{stats.absorption_rate:.1f} per month**, which leaves about **{inv:.1f} months of inventory**. This is a **{temp}**.

A well-priced new listing currently has roughly a **{odds_pct:.0f}% chance** of going under contract in any given 30-day period.

**Where your home sits**  
Looking at living area ({subject.living_area:,.0f} sqft), age, layout, and the closest comparable sales:

- Competitive range: **${low:,.0f} – ${high:,.0f}**
- Recommended list price: **${recommended:,.0f}**

{comp_line}

At the recommended price we would expect meaningful buyer interest and a typical time-to-contract of about **{expected_dom:.0f} days**.

**What this means for your decision**  
{fear_line}

Homes that start inside the competitive range create urgency. Homes that start meaningfully above it usually sit longer and often sell for less in the end.
""".strip()


def generate_executive_summary(
    stats: MarketStats,
    subject: SubjectProperty | None,
    positioning: "PositioningResult | None",
) -> str:
    """One tight paragraph that lands the entire message in 20 seconds."""
    inv = stats.months_of_inventory
    if inv < 2.5:
        climate = "a strong seller's market"
    elif inv < 4.5:
        climate = "a seller-favorable market"
    elif inv < 7:
        climate = "a balanced market"
    else:
        climate = "a buyer's market"

    if positioning and subject:
        return (
            f"This is {climate} with {inv:.1f} months of inventory. "
            f"Based on {stats.sold_count} recent sales, your home is best positioned "
            f"between ${positioning.price_low:,.0f} and ${positioning.price_high:,.0f}, "
            f"with a recommended list price of ${positioning.recommended_price:,.0f}. "
            f"At that level we would expect roughly {positioning.expected_dom:.0f} days to contract. "
            f"The data is clear: launching inside the competitive range creates the strongest outcome for most sellers."
        )
    return (
        f"This is {climate} with {inv:.1f} months of inventory and "
        f"{stats.sold_count} closed sales in the analyzed period. "
        f"Median sold price is ${stats.median_sold_price:,.0f}. "
        f"Homes that are priced in line with recent sales are moving; homes that are not tend to sit."
    )


def generate_market_narrative(stats: MarketStats) -> str:
    inv = stats.months_of_inventory
    odds_pct = stats.odds_of_selling * 100

    if inv < 2.5:
        temp = "very strong seller's market"
        implication = "Well-priced homes are receiving multiple offers and selling quickly."
    elif inv < 4.5:
        temp = "seller-favorable market"
        implication = "Demand is healthy. Homes that are priced correctly and show well move in a reasonable time frame."
    elif inv < 7:
        temp = "balanced market"
        implication = "Neither side has a clear advantage. Pricing strategy and presentation quality matter more than usual."
    else:
        temp = "buyer's market"
        implication = "Buyers have more choices. Homes that are overpriced tend to sit and ultimately sell for less."

    if stats.median_dom <= 30:
        dom_comment = f"The typical home is under contract in about {stats.median_dom:.0f} days."
    elif stats.median_dom <= 55:
        dom_comment = f"Most homes take roughly {stats.median_dom:.0f} days to go under contract – still a healthy pace."
    else:
        dom_comment = f"Homes are averaging {stats.median_dom:.0f} days on market. Buyers are being more selective."

    return f"""**Market Snapshot – {stats.area_name}**
*As of {stats.as_of}*

Over the last {stats.months_analyzed:.0f} months we have seen **{stats.sold_count} closed sales**.  
Homes are currently selling at a rate of **{stats.absorption_rate:.1f} per month**.

There are **{stats.active_count} active listings** and **{stats.pending_count} under contract**.  
That equates to roughly **{inv:.1f} months of inventory**.

This is a **{temp}**. {implication}

**Odds of Selling**  
At the current pace, a newly listed home has approximately a **{odds_pct:.0f}% chance** of going under contract in any given 30-day period (assuming it is priced competitively and presented well).

**Pricing Reality**  
- Median sold price: **${stats.median_sold_price:,.0f}**  
- Typical range (middle 50%): **${stats.price_range_25_75[0]:,.0f} – ${stats.price_range_25_75[1]:,.0f}**  
- Median price per finished square foot: **${stats.median_price_per_sqft:.0f}**

{dom_comment}

**What this means for sellers**  
The market rewards realistic pricing and strong presentation. Homes that come out too high relative to recent comparable sales tend to accumulate days on market and ultimately sell for less than they would have if priced correctly from day one.
""".strip()


# ---------------------------------------------------------------------------
# Full Report Orchestrator
# ---------------------------------------------------------------------------

def create_full_report(
    export_path: str | Path | None = None,
    area_name: str = "Greeley / West Greeley",
    city_filter: str = "",
    lookback_months: Optional[int] = None,
    subject: Optional[SubjectProperty] = None,
    subject_mls: Optional[str] = None,
    market_notes: str = "",
    market_df: Optional[pd.DataFrame] = None,
    data_source: str = "",
) -> dict:
    if market_df is not None:
        df = market_df.copy()
    elif export_path is not None:
        df = load_export(export_path)
    else:
        raise ValueError("export_path or market_df required")
    # Blank city_filter = use the uploaded MLS pull as-is (already curated).
    market_df_use = filter_market(df, city=city_filter or None)

    stats = compute_market_stats(market_df_use, area_name=area_name, lookback_months=lookback_months)
    scatter = build_scatter_data(market_df_use)
    market_narrative = generate_market_narrative(stats)

    # Resolve subject
    if subject is None and subject_mls:
        subject = extract_subject_from_mls(df, subject_mls)

    positioning = None
    if subject and subject.living_area > 0:
        positioning = position_subject(market_df_use, stats, subject)

    slope, intercept = linear_trend(
        scatter["LivingArea"].values,
        scatter["SoldPrice"].values
    ) if len(scatter) > 5 else (0.0, 0.0)

    # Executive summary (lands the whole message fast)
    exec_summary = generate_executive_summary(stats, subject, positioning)

    market_definition = infer_market_definition(
        market_df_use,
        subject=subject,
        agent_label=area_name,
        agent_notes=market_notes,
        area_name=area_name,
    )
    did_not_sell = analyze_did_not_sell(market_df_use)

    report = {
        "generated_at": datetime.now().isoformat(),
        "area": area_name,
        "stats": asdict(stats),
        "executive_summary": exec_summary,
        "market_narrative": market_narrative,
        "market_definition": market_definition,
        "did_not_sell": did_not_sell,
        "scatter_trend": {"slope": slope, "intercept": intercept},
        "scatter_points": scatter.head(250).to_dict(orient="records"),
        "subject": asdict(subject) if subject else None,
        "positioning": None,
        "data_source": data_source or (df.attrs.get("source") if hasattr(df, "attrs") else "") or "",
    }

    if positioning:
        scenarios = simulate_price_sensitivity(
            stats, subject,
            positioning.recommended_price,
            positioning.price_low,
            positioning.price_high,
        )
        sens_narr = generate_price_sensitivity_narrative(
            scenarios, positioning.recommended_price, stats
        )

        report["positioning"] = {
            "recommended_price": positioning.recommended_price,
            "price_low": positioning.price_low,
            "price_high": positioning.price_high,
            "expected_dom": positioning.expected_dom,
            "competitive_statement": positioning.competitive_statement,
            "narrative": positioning.narrative,
            "advantages": positioning.advantages,
            "risks": positioning.risks,
            "closest_comps": [asdict(c) for c in positioning.closest_comps],
            "trend_slope": positioning.trend_slope,
            "trend_intercept": positioning.trend_intercept,
            "price_scenarios": [asdict(s) for s in scenarios],
            "price_sensitivity_narrative": sens_narr,
        }

    return report


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    # Demo with a realistic active listing from the export as subject
    # (You can replace with the real subject MLS or manual attributes)
    demo_subject = SubjectProperty(
        mls_number="1058539",
        address="1843 24th Ave Ct",
        list_price=389900,
        living_area=2163,
        beds=4,
        baths=2,
        year_built=1966,
        style="1 Story/Ranch",
        subdivision="Rolling Hills",
        garage_spaces=2,
        condition="average",
        dom=75,
    )

    _export = Path(__file__).resolve().parent / "data" / "export-71.txt"
    report = create_full_report(
        str(_export),
        area_name="Greeley, CO (West / Central)",
        city_filter="Greeley",
        subject=demo_subject,
    )

    print("=" * 72)
    print("ListLogic – FULL REPORT (with Subject Positioning)")
    print("=" * 72)
    print(report["market_narrative"])
    print()
    if report["positioning"]:
        print("-" * 72)
        print(report["positioning"]["narrative"])
        print()
        print("Recommended:", f"${report['positioning']['recommended_price']:,.0f}")
        print("Range:", f"${report['positioning']['price_low']:,.0f} – ${report['positioning']['price_high']:,.0f}")
        print("Expected DOM:", report["positioning"]["expected_dom"])
        print()
        print("Closest comps:")
        for c in report["positioning"]["closest_comps"][:5]:
            print(f"  {c['address'][:30]:<30} ${c['sold_price']:>8,.0f}  {c['living_area']:.0f}sf  {c['year_built']}  score={c['distance_score']:.3f}")


# ---------------------------------------------------------------------------
# Price Sensitivity Simulator (standout feature)
# ---------------------------------------------------------------------------

@dataclass
class PriceScenario:
    list_price: float
    label: str                          # Aggressive / Balanced / Premium / etc.
    expected_dom: float
    odds_30_day: float
    competitive_position: str           # "Top of market", "Middle", "Above market"
    notes: str


def simulate_price_sensitivity(
    stats: MarketStats,
    subject: SubjectProperty,
    recommended_price: float,
    price_low: float,
    price_high: float,
    listing_flow: Optional[dict] = None,
    price_response: Optional[dict] = None,
) -> List[PriceScenario]:
    """
    Model expected DOM and monthly odds at different price points.
    Uses calibrated queue/empirical response when available.
    """
    scenarios = []
    points = [
        (round(recommended_price * 0.94 / 1000) * 1000, "Aggressive", "Priced to create urgency and maximize odds of multiple offers."),
        (price_low, "Competitive Low", "Bottom of the data-supported range. Strong buyer response expected."),
        (recommended_price, "Balanced (Recommended)", "Aligned with recent comparable sales and market trend."),
        (price_high, "Competitive High", "Top of the supportable range. Requires strong presentation and patience."),
        (round(recommended_price * 1.08 / 1000) * 1000, "Premium / Aspirational", "Meaningfully above recent sales. Higher risk of extended DOM."),
    ]

    for price, label, note in points:
        outcome = estimate_price_outcome(
            stats, recommended_price, price, listing_flow, price_response
        )
        scenarios.append(PriceScenario(
            list_price=price,
            label=label,
            expected_dom=outcome["expected_dom"],
            odds_30_day=outcome["odds_30_day"],
            competitive_position=outcome["competitive_position"],
            notes=note,
        ))

    return scenarios


def _new_below_price_per_month(
    listing_flow: Optional[dict],
    list_price: float,
    living_area: float = 0,
    tail_months: int = 6,
) -> float:
    """New listings/month that priced under ``list_price`` (size-banded when possible)."""
    if not listing_flow or not list_price:
        return 0.0
    samples = listing_flow.get("samples") or []
    if not samples:
        # Fall back to threshold measured at recommended
        return float(listing_flow.get("new_below_recommended_per_month") or 0)

    rows = []
    for row in samples:
        try:
            p = float(row.get("p") or 0)
            s = float(row.get("s") or 0)
            m = str(row.get("m") or "")
        except (TypeError, ValueError):
            continue
        if p <= 0 or not m:
            continue
        if living_area and s and not (living_area * 0.8 <= s <= living_area * 1.2):
            continue
        if p < list_price:
            rows.append(m)
    if not rows:
        return 0.0
    counts: Dict[str, int] = {}
    for m in rows:
        counts[m] = counts.get(m, 0) + 1
    # Average last N months present in the sample
    months = sorted(counts.keys())[-tail_months:]
    if not months:
        return 0.0
    return float(sum(counts[m] for m in months) / len(months))


def _effective_queue_position(
    position_now: float,
    sales_pm: float,
    arrival_below_pm: float,
) -> tuple[float, float]:
    """
    Buyers take cheaper homes first. While you wait, new listings under your
    price join the line ahead of you.

    Closed form:
      pos_eff = pos_now + arrival_below_pm * (pos_eff / sales_pm)
      pos_eff = pos_now / (1 - arrival_below_pm / sales_pm)

    When sales outpace cheaper arrivals, the denominator grows toward 1 and
    pos_eff ≈ pos_now (draining market). When cheaper supply floods in,
    the queue stretches. Caps keep the math stable if arrivals ≥ sales.
    """
    sales = max(float(sales_pm), 0.15)
    arrive = max(float(arrival_below_pm), 0.0)
    pos = max(float(position_now), 1.0)
    # Share of monthly demand absorbed by homes that cut in line
    cut_in = min(0.85, arrive / sales)
    pos_eff = pos / max(1.0 - cut_in, 0.15)
    months = pos_eff / sales
    fresh_during_wait = arrive * months
    return pos_eff, fresh_during_wait


def estimate_price_outcome(
    stats: MarketStats | dict,
    recommended_price: float,
    list_price: float,
    listing_flow: Optional[dict] = None,
    price_response: Optional[dict] = None,
) -> dict:
    """Estimate DOM + 30-day odds for an arbitrary list price vs recommended.

    Prefer ``price_response`` from ``build_price_response_model`` (queue from this
    pull's Actives + absorption, optional empirical sold blend). Falls back to a
    transparent heuristic when calibration is missing.
    """
    if isinstance(stats, dict):
        base_dom = float(stats.get("median_dom") or 45)
        inv = float(stats.get("months_of_inventory") or 0)
        base_odds = float(stats.get("odds_of_selling") or 0)
    else:
        base_dom = stats.median_dom or 45
        inv = stats.months_of_inventory
        base_odds = stats.odds_of_selling

    if not recommended_price:
        recommended_price = list_price or 1.0

    delta = (list_price - recommended_price) / recommended_price
    pressure = 1.0
    below_pm = 0.0
    if listing_flow:
        pressure = float(listing_flow.get("supply_pressure") or 1.0)
        below_pm = float(listing_flow.get("new_below_recommended_per_month") or 0)

    method = "heuristic"
    living_area = 0.0
    if listing_flow:
        living_area = float(listing_flow.get("subject_living_area") or 0)
    if price_response and price_response.get("active_prices") is not None and price_response.get("method") != "heuristic":
        method = str(price_response.get("method") or "queue")
        active_prices = [float(p) for p in (price_response.get("active_prices") or [])]
        sales_pm = float(price_response.get("band_sales_pm") or 0.15)
        base_dom = float(price_response.get("base_dom") or base_dom)
        base_odds = float(price_response.get("base_odds") or base_odds)

        def _queue_pos(price: float) -> float:
            if not active_prices:
                return 1.0
            below = sum(1 for p in active_prices if p < price * 0.995)
            near = sum(1 for p in active_prices if abs(p - price) / max(price, 1) <= 0.005)
            return 1.0 + below + 0.5 * near

        pos_now = _queue_pos(list_price)
        rec_pos_now = _queue_pos(recommended_price)

        # Cheaper new listings at THIS list price (not only at recommended)
        arrive_pm = _new_below_price_per_month(listing_flow, list_price, living_area)
        arrive_pm_rec = _new_below_price_per_month(listing_flow, recommended_price, living_area)

        pos_eff, fresh_during = _effective_queue_position(pos_now, sales_pm, arrive_pm)
        rec_pos_eff, _ = _effective_queue_position(rec_pos_now, sales_pm, arrive_pm_rec)

        raw_dom = 30.44 * pos_eff / max(sales_pm, 0.15)
        rec_raw = 30.44 * rec_pos_eff / max(sales_pm, 0.15)
        # Normalize so recommended ≈ market median DOM
        scale = base_dom / max(rec_raw, 1.0)
        queue_dom = raw_dom * scale

        raw_odds = min(0.95, sales_pm / max(pos_eff + sales_pm * 0.35, 0.15))
        rec_odds_raw = min(0.95, sales_pm / max(rec_pos_eff + sales_pm * 0.35, 0.15))
        odds_scale = base_odds / max(rec_odds_raw, 0.02)
        queue_odds = min(0.92, max(0.03, raw_odds * odds_scale))

        w = float(price_response.get("empirical_weight") or 0)
        # Emp knots are absolute DOM from solds — blend toward them near market
        if w > 0 and (price_response.get("empirical_knots") or []):
            emp_dom = _interp_empirical_dom(
                price_response.get("empirical_knots") or [],
                delta,
                queue_dom,
            )
            emp_at0 = _interp_empirical_dom(price_response.get("empirical_knots") or [], 0.0, base_dom)
            emp_scaled = emp_dom * (base_dom / max(emp_at0, 1.0))
            expected_dom = (1.0 - w) * queue_dom + w * emp_scaled
        else:
            expected_dom = queue_dom

        # Mild inventory climate (MOI) — already in base_odds/DOM; tiny nudge only
        if inv > 6.5 and delta > 0.02:
            expected_dom *= 1.08
            queue_odds *= 0.92
        elif inv < 2.5 and delta < 0:
            expected_dom *= 0.92
            queue_odds = min(0.85, queue_odds * 1.08)

        odds = queue_odds
        expected_dom = max(10, round(expected_dom))
        fresh_below = float(fresh_during)
        below_pm = float(arrive_pm)
    else:
        # Legacy heuristic fallback
        inv_factor = 1.0
        if inv < 2.5:
            inv_factor = 0.75
        elif inv < 4.0:
            inv_factor = 0.90
        elif inv > 6.5:
            inv_factor = 1.35

        if delta <= -0.04:
            dom_mult = 0.60
        elif delta <= 0:
            dom_mult = 0.80 + (delta + 0.04) * 5.0
        elif delta <= 0.03:
            dom_mult = 1.0 + delta * 5.0
        elif delta <= 0.08:
            dom_mult = 1.15 + (delta - 0.03) * 10.0
        else:
            dom_mult = 1.65 + (delta - 0.08) * 25.0

        if delta <= -0.04:
            odds = min(0.75, base_odds * 1.55)
        elif delta <= 0.02:
            odds = base_odds * (1.15 - delta * 3)
        elif delta <= 0.08:
            odds = max(0.05, base_odds * (0.90 - (delta - 0.02) * 8.0))
        else:
            odds = max(0.02, base_odds * (0.42 - (delta - 0.08) * 4.0))

        if listing_flow:
            if delta > 0.02 and pressure > 1.0:
                dom_mult *= 1.0 + min(0.55, (pressure - 1.0) * 0.4 + delta * 1.0)
            if delta > 0.03 and pressure > 0.9:
                odds *= max(0.22, 1.0 - (delta - 0.02) * pressure * 1.6)

        expected_dom = max(10, round(base_dom * dom_mult * inv_factor))
        fresh_below = 0.0
        if below_pm > 0 and delta > 0:
            band_below_pm = below_pm * (1.0 + min(0.5, delta * 2.0))
            fresh_below = band_below_pm * (expected_dom / 30.44)

    if delta < -0.03:
        position = "Clearly under the current market — expect urgency"
    elif delta < 0.02:
        position = "In the heart of the market"
    elif delta < 0.06:
        position = "At the upper edge of supportable"
    elif delta < 0.10:
        position = "Above recent sales — buyers will choose better value first"
    else:
        position = "Priced as everyone else's comp — helps other listings sell"

    return {
        "list_price": float(list_price),
        "expected_dom": float(expected_dom),
        "odds_30_day": round(float(odds), 3),
        "competitive_position": position,
        "delta_pct": round(delta * 100, 1),
        "fresh_competitors_below": round(fresh_below, 1),
        "supply_pressure": round(pressure, 2),
        "method": method,
    }




def generate_price_sensitivity_narrative(
    scenarios: List[PriceScenario],
    recommended: float,
    stats: MarketStats,
) -> str:
    bal = next((s for s in scenarios if "Balanced" in s.label), scenarios[2])
    agg = scenarios[0]
    prem = scenarios[-1]

    return f"""**Price Strategy Options**

Here is how different list prices are likely to perform in the current market ({stats.months_of_inventory:.1f} months of inventory, {stats.absorption_rate:.1f} sales/month):

- **Aggressive (${agg.list_price:,.0f})** → Expected ~{agg.expected_dom:.0f} days to contract. Highest probability of strong early activity.
- **Balanced / Recommended (${bal.list_price:,.0f})** → Expected ~{bal.expected_dom:.0f} days. Best combination of speed and net proceeds for most sellers.
- **Premium (${prem.list_price:,.0f})** → Expected ~{prem.expected_dom:.0f}+ days. Requires a buyer who falls in love and is willing to pay above recent sales.

Most sellers are best served by launching inside or very near the balanced range. Starting too high is the most common reason homes sit, get reduced, and ultimately sell for less than they would have with a stronger initial price.
""".strip()
