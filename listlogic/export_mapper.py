"""Smart MLS export header mapper — any CSV/TXT → ListLogic internal schema.

Sniffs delimiter, maps headers via aliases + fuzzy match, then
normalize_market_frame() for engine-ready columns.
"""
from __future__ import annotations

import csv
import io
import re
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Any, Optional

import pandas as pd

from market_schema import REQUIRED_ENGINE_FIELDS, normalize_market_frame

# Canonical internal field → accepted header aliases (normalized tokens).
FIELD_ALIASES: dict[str, tuple[str, ...]] = {
    "MLSNumber": (
        "mlsnumber", "mls number", "mls#", "mls #", "mls id", "mlsid",
        "listingid", "listing id", "listing key", "listingkey", "listing number",
        "listingleky", "originating system listing id", "id", "mls no", "mlsnum",
    ),
    "Status": (
        "status", "standardstatus", "standard status", "mls status", "listing status",
        "listingstatus", "property status",
    ),
    "Price": (
        "price", "listprice", "list price", "current price", "listpriceusd",
        "asking price", "original list price", "current list price",
    ),
    "SoldPrice": (
        "soldprice", "sold price", "closeprice", "close price", "closing price",
        "sale price", "sales price", "closed price", "final price",
    ),
    "SoldDate": (
        "solddate", "sold date", "closedate", "close date", "closing date",
        "sale date", "datesold",
    ),
    "ListDate": (
        "listdate", "list date", "listingdate", "listing date", "on market date",
        "listingcontractdate", "listing contract date", "dom date",
    ),
    "LastUpdateDate": (
        "lastupdatedate", "last update date", "modificationtimestamp",
        "modification timestamp", "status change date", "statuschangedate",
    ),
    "StNumber": ("stnumber", "street number", "streetnumber", "housenumber", "house number"),
    "StDir": ("stdir", "street dir", "streetdir", "street direction", "dirprefix", "direction prefix"),
    "StName": ("stname", "street name", "streetname", "street"),
    "StType": ("sttype", "street type", "streettype", "streetsuffix", "street suffix"),
    "Address": (
        "address", "address line", "addressline", "full address", "property address",
        "unparsedaddress", "unparsed address", "streetaddress", "street address",
        "propertyaddress",
    ),
    "Unit": ("unit", "unit number", "unitnumber", "apt", "apartment"),
    "City": ("city", "locale", "municipality"),
    "ZipCode": ("zipcode", "zip", "zip code", "postalcode", "postal code"),
    "Subdivision": ("subdivision", "neighborhood", "sub division", "complex"),
    "County": ("county",),
    "Bdrm": (
        "bdrm", "bdrms", "beds", "bed", "bedrooms", "bedroom", "bedroomstotal",
        "bedrooms total", "bedroom total", "total bedrooms", "number of bedrooms",
        "# beds", "num beds",
    ),
    "Bath": (
        "bath", "baths", "bathroom", "bathrooms", "bathroomstotalinteger",
        "bathrooms total", "bathrooms total integer", "total baths", "bathstotal",
        "number of bathrooms", "# baths", "bathrooms total decimal",
        "bath count", "bathcount", "num baths",
    ),
    "FullBaths": ("fullbaths", "full baths", "bathroomsfull", "bathrooms full"),
    "HalfBaths": ("halfbaths", "half baths", "bathroomshalf", "bathrooms half"),
    "ThreeQuarterBaths": (
        "threequarterbaths", "three quarter baths", "bathroomsthreequarter",
        "bathrooms three quarter",
    ),
    "YearBuilt": ("yearbuilt", "year built", "yr built", "year", "yrbuilt"),
    "DOM": (
        "dom", "daysonmarket", "days on market", "cdom", "cumulative days on market",
        "days on mls",
    ),
    "GarSpaces": (
        "garspaces", "garage", "garage spaces", "garagespaces",
        "garage stalls", "parkingtotal", "parking total", "garage spaces total",
        "garages", "# garage", "garage count",
    ),
    "GarType": ("gartype", "garage type", "garagetype", "parking features"),
    "TotalSqFt": (
        "totalsqft", "total sqft", "total sf", "totalsf", "total square feet",
        "buildingsize", "building size", "gross living area", "gla",
        "sqft total", "sqfttotal", "total living area", "total area",
    ),
    "FinishedSQFT": (
        "finishedsqft", "finished sqft", "finished sf", "above grade sqft",
        "livingarea", "living area", "sqft", "sq ft", "square feet", "squarefeet",
        "approx sq ft", "heated sq ft",
    ),
    "FinishedSQFTincBasement": (
        "finishedsqftincbasement", "finished sqft inc basement",
        "finishedsqftincludingbasement", "total finished sqft",
    ),
    "Acres": ("acres", "lot size acres", "lotsizeacres"),
    "LotSize": ("lotsize", "lot size", "lot size sqft", "lotsizesquarefeet", "lot sqft"),
    "Latitude": ("latitude", "lat", "ygps"),
    "Longitude": ("longitude", "lng", "lon", "long", "xgps"),
    "Style": ("style", "propertystyle", "architecturalstyle", "levels"),
    "Type": ("type", "propertytype", "property type", "propertysubtype", "property sub type"),
    "PhotoURL": ("photourl", "photo url", "primary photo", "mediakey", "image url"),
    "PublicRemarks": ("publicremarks", "public remarks", "remarks", "description"),
}

# Minimum fields to run a useful report
CORE_REQUIRED = ("Status", "Bdrm", "Bath")
PRICE_ONE_OF = ("Price", "SoldPrice")
SQFT_ONE_OF = ("TotalSqFt", "FinishedSQFT", "FinishedSQFTincBasement", "LivingArea")
ID_ONE_OF = ("MLSNumber", "Address")


def _norm_header(h: str) -> str:
    h = (h or "").strip().lower()
    h = h.replace("#", " # ")
    h = re.sub(r"[_\-./]+", " ", h)
    h = re.sub(r"\s+", " ", h).strip()
    return h


def sniff_delimiter(sample: str) -> str:
    """Pick | , or tab from a text sample."""
    lines = [ln for ln in sample.splitlines() if ln.strip()][:5]
    if not lines:
        return "|"
    header = lines[0]
    candidates = ["|", "\t", ",", ";"]
    best, best_n = "|", -1
    for d in candidates:
        n = header.count(d)
        if n > best_n:
            best, best_n = d, n
    if best_n <= 0:
        try:
            dialect = csv.Sniffer().sniff(sample[:4096], delimiters="|,\t;")
            return dialect.delimiter
        except Exception:
            return ","
    return best


def _token_overlap(a: str, b: str) -> float:
    ta, tb = set(a.split()), set(b.split())
    if not ta or not tb:
        return 0.0
    return len(ta & tb) / max(len(ta | tb), 1)


def _best_alias_match(header_norm: str, aliases: tuple[str, ...]) -> float:
    if header_norm in aliases:
        return 1.0
    # compact form without spaces
    compact = header_norm.replace(" ", "")
    for al in aliases:
        al_c = al.replace(" ", "")
        if compact == al_c:
            return 0.98
        if header_norm == al:
            return 1.0
    # fuzzy token overlap + near-equal compact containment (avoid livingarea ⊂ totallivingarea)
    best = 0.0
    for al in aliases:
        al_c = al.replace(" ", "")
        best = max(best, _token_overlap(header_norm, al))
        if compact and al_c:
            shorter, longer = (compact, al_c) if len(compact) <= len(al_c) else (al_c, compact)
            if shorter in longer and len(shorter) >= 5:
                ratio = len(shorter) / max(len(longer), 1)
                if ratio >= 0.85:
                    best = max(best, 0.9)
    return best


@dataclass
class FieldMapping:
    internal: str
    source: Optional[str]
    confidence: float
    method: str  # exact | fuzzy | missing | derived


@dataclass
class MapResult:
    delimiter: str
    mappings: list[FieldMapping] = field(default_factory=list)
    confidence: float = 0.0
    missing_required: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    headers: list[str] = field(default_factory=list)
    rename_map: dict[str, str] = field(default_factory=dict)  # source -> internal

    def to_dict(self) -> dict:
        return {
            "delimiter": self.delimiter,
            "confidence": self.confidence,
            "missing_required": self.missing_required,
            "warnings": self.warnings,
            "headers": self.headers,
            "rename_map": self.rename_map,
            "mappings": [asdict(m) for m in self.mappings],
            "needs_review": self.needs_review,
        }

    @property
    def needs_review(self) -> bool:
        return self.confidence < 0.85 or bool(self.missing_required)


def propose_mapping(headers: list[str]) -> MapResult:
    """Map raw CSV headers → internal field names."""
    norms = {_norm_header(h): h for h in headers}
    used_sources: set[str] = set()
    rename: dict[str, str] = {}
    mappings: list[FieldMapping] = []

    for internal, aliases in FIELD_ALIASES.items():
        best_src = None
        best_score = 0.0
        best_method = "missing"
        for norm, original in norms.items():
            if original in used_sources:
                continue
            score = _best_alias_match(norm, aliases)
            # Also match if normalized header equals internal lower
            if norm == _norm_header(internal) or norm.replace(" ", "") == internal.lower():
                score = max(score, 1.0)
            if score > best_score:
                best_score = score
                best_src = original
                best_method = "exact" if score >= 0.98 else "fuzzy"
        if best_src and best_score >= 0.72:
            used_sources.add(best_src)
            rename[best_src] = internal
            mappings.append(FieldMapping(internal, best_src, round(best_score, 3), best_method))
        else:
            mappings.append(FieldMapping(internal, None, 0.0, "missing"))

    # Required checks
    mapped_internals = {m.internal for m in mappings if m.source}
    missing: list[str] = []
    for req in CORE_REQUIRED:
        if req not in mapped_internals:
            missing.append(req)
    if not any(f in mapped_internals for f in PRICE_ONE_OF):
        missing.append("Price|SoldPrice")
    if not any(f in mapped_internals for f in SQFT_ONE_OF):
        missing.append("SqFt")
    if not any(f in mapped_internals for f in ID_ONE_OF):
        missing.append("MLSNumber|Address")

    scores = [m.confidence for m in mappings if m.source]
    # Weight core fields higher
    core_scores = [
        m.confidence for m in mappings
        if m.source and m.internal in ("Status", "SoldPrice", "Price", "Bdrm", "Bath", "TotalSqFt", "FinishedSQFT", "MLSNumber", "Address", "ListDate", "SoldDate")
    ]
    confidence = float(sum(core_scores) / len(core_scores)) if core_scores else 0.0
    if missing:
        confidence *= 0.7

    warnings = []
    if "Address" not in mapped_internals and not all(
        f in mapped_internals for f in ("StNumber", "StName")
    ):
        warnings.append("No full Address or street parts — subject match may be weak")
    if "SoldDate" not in mapped_internals and "ListDate" not in mapped_internals:
        warnings.append("No ListDate/SoldDate — absorption lookback may be limited")

    return MapResult(
        delimiter="",
        mappings=mappings,
        confidence=round(confidence, 3),
        missing_required=missing,
        warnings=warnings,
        headers=list(headers),
        rename_map=rename,
    )


def read_raw_table(path: str | Path | None = None, *, text: str | None = None, delimiter: str | None = None) -> tuple[pd.DataFrame, str]:
    if text is None:
        if path is None:
            raise ValueError("path or text required")
        raw = Path(path).read_text(encoding="utf-8", errors="replace")
    else:
        raw = text
    delim = delimiter or sniff_delimiter(raw[:8192])
    df = pd.read_csv(io.StringIO(raw), sep=delim, low_memory=False)
    # Drop fully empty columns
    df = df.dropna(axis=1, how="all")
    return df, delim


def apply_mapping(df: pd.DataFrame, rename_map: dict[str, str]) -> pd.DataFrame:
    """Rename source columns to internal names; keep extras."""
    out = df.copy()
    # Avoid collisions: if two sources map to same internal, keep first
    final_rename = {}
    taken = set()
    for src, internal in rename_map.items():
        if src not in out.columns:
            continue
        if internal in taken or (internal in out.columns and internal != src):
            # overwrite only if target is same column being renamed
            if internal in out.columns and internal != src:
                out = out.drop(columns=[internal])
        final_rename[src] = internal
        taken.add(internal)
    out = out.rename(columns=final_rename)
    return out


def load_mapped_export(
    path: str | Path,
    *,
    rename_overrides: dict[str, str] | None = None,
    prefer_total_sqft_for_living: bool = False,
) -> tuple[pd.DataFrame, MapResult]:
    """Full path: sniff → propose → apply → normalize."""
    df, delim = read_raw_table(path)
    result = propose_mapping([str(c) for c in df.columns])
    result.delimiter = delim
    rename = dict(result.rename_map)
    if rename_overrides:
        # overrides are internal -> source OR source -> internal; accept source->internal
        for k, v in rename_overrides.items():
            if k in df.columns:
                rename[k] = v
            elif v in df.columns:
                rename[v] = k
    mapped = apply_mapping(df, rename)
    normalized = normalize_market_frame(
        mapped,
        prefer_total_sqft_for_living=prefer_total_sqft_for_living,
        source="mls_export",
    )
    return normalized, result


def inspect_export(path: str | Path) -> dict[str, Any]:
    """Preview mapping without fully normalizing numerics for UI review."""
    df, delim = read_raw_table(path)
    result = propose_mapping([str(c) for c in df.columns])
    result.delimiter = delim
    payload = result.to_dict()
    payload["row_count"] = int(len(df))
    payload["sample_rows"] = df.head(3).astype(str).to_dict(orient="records")
    return payload
