"""Efficient listing-photo enrichment for ListLogic via ReefAPI (Zillow).

Design goals
------------
1. Spend credits only when needed — MLS disk cache means re-runs cost ~0.
2. Prefer 1 search call per spatial cluster (not per house) when nearby.
3. Search finds the home (cheap). One batched property_detail loads galleries.
4. Download images onto our storage so presentations don't depend on Zillow CDN.
5. Cards swipe through hosted gallery photos (not a single thumbnail).
"""
from __future__ import annotations

import hashlib
import json
import logging
import os
import re
import shutil
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

logger = logging.getLogger("ListLogic.reef")

ROOT = Path(__file__).resolve().parent
# Photo cache lives on the Railway volume (/data) so it survives redeploys —
# no re-downloading (or re-spending Reef credits) after each deploy.
_DATA_ROOT = Path(os.environ.get("LISTLOGIC_DATA_DIR") or "/data")
if not _DATA_ROOT.exists():
    _DATA_ROOT = ROOT
CACHE_DIR = _DATA_ROOT / "output" / "photo_cache"
_LEGACY_CACHE_DIR = ROOT / "output" / "photo_cache"
REEF_BASE = "https://api.reefapi.com/zillow/v1"

DEFAULT_TIMEOUT_SEC = 35
# Host this many listing photos per comp (Zillow can return 30+; enough for swipe).
MAX_GALLERY_PHOTOS = 15
# Soft budget only for inline/foreground enrich — background jobs run full.
# Reject Realtor/Zillow thumbnails that are too small to look sharp in the deck.
MIN_PHOTO_BYTES = 12_000
PHOTO_CACHE_VERSION = 2
PHOTO_MISS_VERSION = 5
ENRICH_BUDGET_SEC = 55
CLUSTER_RADIUS_DEG = 0.006
CLUSTER_PAD_DEG = 0.002
CACHE_TTL_DAYS = 120
SUBJECT_KEY = "__subject__"
GALLERY_BATCH_SIZE = 8
DOWNLOAD_TIMEOUT_SEC = 8
MAX_DOWNLOAD_FAILURES_PER_LISTING = 3

STREET_STOPWORDS = {
    "st", "street", "ave", "avenue", "av", "rd", "road", "dr", "drive", "ln", "lane",
    "ct", "court", "cir", "circle", "blvd", "boulevard", "way", "pl", "place", "ter",
    "terrace", "hwy", "highway", "pkwy", "parkway", "n", "s", "e", "w", "ne", "nw",
    "se", "sw", "north", "south", "east", "west", "co", "colorado",
}


_REEF_KEY_NAMES = ("REEF_API_KEY", "REEF_API_KEY")


def _load_dotenv_key() -> str:
    for name in _REEF_KEY_NAMES:
        key = (os.environ.get(name) or "").strip()
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
            if name.strip() in _REEF_KEY_NAMES:
                return val.strip().strip('"').strip("'")
    except OSError:
        return ""
    return ""


def reef_api_key() -> str:
    return _load_dotenv_key()


def reef_enabled() -> bool:
    return bool(reef_api_key())


def _safe_key(raw: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9_-]+", "", (raw or "").strip())[:48]
    return cleaned or hashlib.sha1((raw or "x").encode("utf-8")).hexdigest()[:16]


def _cache_meta_path(cache_key: str) -> Path:
    return CACHE_DIR / cache_key / "meta.json"


def _legacy_meta_path(cache_key: str) -> Path:
    return _LEGACY_CACHE_DIR / cache_key / "meta.json"


def _read_cache(cache_key: str) -> dict | None:
    path = _cache_meta_path(cache_key)
    legacy = False
    if not path.exists() and _LEGACY_CACHE_DIR != CACHE_DIR:
        path = _legacy_meta_path(cache_key)
        legacy = path.exists()
    if not path.exists():
        return None
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None
    if not isinstance(data, dict):
        return None
    fetched = float(data.get("fetched_at") or 0)
    if fetched and (time.time() - fetched) > CACHE_TTL_DAYS * 86400:
        return None
    if data.get("miss"):
        if int(data.get("cache_version") or 1) < PHOTO_MISS_VERSION:
            return None
        return data
    if int(data.get("cache_version") or 1) < PHOTO_CACHE_VERSION:
        return None
    primary = data.get("primary_path") or ""
    if primary and not Path(primary).exists():
        for base in ([CACHE_DIR, _LEGACY_CACHE_DIR] if legacy else [CACHE_DIR]):
            local = base / cache_key / "primary.jpg"
            if local.exists():
                data["primary_path"] = str(local)
                primary = str(local)
                break
    if primary:
        try:
            if Path(primary).exists() and Path(primary).stat().st_size < MIN_PHOTO_BYTES:
                return None
        except OSError:
            return None
    data["gallery_paths"] = [p for p in (data.get("gallery_paths") or []) if Path(p).exists()]
    if legacy:
        # First read migrates the entry onto the volume so later hits are local.
        try:
            new_folder = CACHE_DIR / cache_key
            if not new_folder.exists():
                shutil.copytree(_LEGACY_CACHE_DIR / cache_key, new_folder)
            data = _read_cache(cache_key) or data
        except OSError:
            pass
    return data


def _write_cache(cache_key: str, payload: dict) -> dict:
    folder = CACHE_DIR / cache_key
    folder.mkdir(parents=True, exist_ok=True)
    payload = dict(payload)
    payload["fetched_at"] = time.time()
    payload["cache_key"] = cache_key
    payload["cache_version"] = PHOTO_CACHE_VERSION
    (folder / "meta.json").write_text(json.dumps(payload, indent=2), encoding="utf-8")
    return payload


def _write_miss(cache_key: str, reason: str = "") -> dict:
    folder = CACHE_DIR / cache_key
    folder.mkdir(parents=True, exist_ok=True)
    payload = {
        "miss": True,
        "reason": reason,
        "fetched_at": time.time(),
        "cache_key": cache_key,
        "cache_version": PHOTO_MISS_VERSION,
    }
    (folder / "meta.json").write_text(json.dumps(payload, indent=2), encoding="utf-8")
    return payload


def _call(action: str, payload: dict, timeout: int = DEFAULT_TIMEOUT_SEC) -> dict:
    key = reef_api_key()
    if not key:
        return {"ok": False, "error": {"code": "NO_KEY", "message": "REEF_API_KEY not set"}}
    body = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        f"{REEF_BASE}/{action}",
        data=body,
        method="POST",
        headers={
            "content-type": "application/json",
            "x-api-key": key,
            "User-Agent": "ListLogic/1.0",
            "Accept": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        try:
            parsed = json.loads(exc.read().decode("utf-8", errors="replace"))
            if isinstance(parsed, dict):
                return parsed
        except Exception:
            pass
        return {"ok": False, "error": {"code": f"HTTP_{exc.code}", "message": str(exc)}}
    except Exception as exc:
        return {"ok": False, "error": {"code": "REQUEST_FAILED", "message": str(exc)}}


def _normalize_street(text: str) -> tuple[str, set[str]]:
    raw = (text or "").lower().replace(".", " ").replace(",", " ").replace("#", " ")
    raw = re.sub(r"[^a-z0-9\s-]", " ", raw)
    parts = [p for p in re.split(r"\s+", raw) if p]
    house = next((p for p in parts if re.match(r"^\d+[a-z]?$", p)), "")
    tokens = {p for p in parts if p not in STREET_STOPWORDS and not re.match(r"^\d+[a-z]?$", p)}
    return house, tokens


def _address_match_score(target: str, candidate: str) -> float:
    t_house, t_tokens = _normalize_street(target)
    c_house, c_tokens = _normalize_street(candidate)
    if not t_house or t_house != c_house:
        return 0.0
    if not t_tokens:
        return 0.55
    overlap = len(t_tokens & c_tokens)
    if overlap:
        return 0.55 + 0.45 * (overlap / max(len(t_tokens), 1))
    cand_low = (candidate or "").lower()
    numbered = [tok for tok in t_tokens if any(ch.isdigit() for ch in tok)]
    if numbered and any(tok in cand_low for tok in numbered):
        return 0.55
    if not t_tokens or not c_tokens:
        return 0.55
    return 0.0


def upgrade_listing_photo_url(url: str) -> str:
    """Prefer full-size Realtor/Zillow CDN variants over tiny card thumbnails."""
    u = (url or "").strip()
    if not u:
        return u
    if u.startswith("http://"):
        u = "https://" + u[7:]
    low = u.lower()
    # Realtor CDN: …s.jpg (~4KB thumb) → …od.jpg (full); also bump rd-w sizes.
    if "rdcpix.com" in low:
        u = re.sub(r"s\.jpe?g(\?.*)?$", r"od.jpg\1", u, flags=re.I)
        u = re.sub(r"s\.webp(\?.*)?$", r"od.webp\1", u, flags=re.I)
        u = re.sub(r"rd-w\d+_h\d+", "rd-w1280_h960", u, flags=re.I)
    # Zillow static: force larger crop / cc_ft size when present.
    if "zillowstatic.com" in low or "zillow.com" in low:
        u = re.sub(r"cc_ft_\d+", "cc_ft_1536", u, flags=re.I)
        u = re.sub(r"/p_c/", "/p_e/", u)
        u = re.sub(r"/p_h/", "/p_e/", u)
    return u


def _extract_photo_urls(item: dict, limit: int = MAX_GALLERY_PHOTOS) -> list[str]:
    photos = item.get("photos") or item.get("miniCardPhotos") or []
    urls: list[str] = []
    for p in photos:
        if isinstance(p, str):
            urls.append(p)
        elif isinstance(p, dict):
            u = p.get("url") or p.get("href") or p.get("uri") or ""
            if u:
                urls.append(str(u))
    for key in ("photo_url", "imgSrc", "image", "image_url", "primary_photo", "hiResImage"):
        raw = item.get(key)
        if isinstance(raw, dict):
            raw = raw.get("url") or raw.get("href") or raw.get("uri") or ""
        if raw:
            urls.append(str(raw))
    cleaned: list[str] = []
    seen: set[str] = set()
    for url in urls:
        url = upgrade_listing_photo_url(url)
        low = url.lower()
        if not url.startswith("http") or url in seen:
            continue
        if "maps.googleapis.com" in low or "staticmap" in low:
            continue
        seen.add(url)
        cleaned.append(url)
        if len(cleaned) >= limit:
            break
    return cleaned


def _download_image(url: str, dest: Path) -> bool:
    if not url or not url.startswith("http"):
        return False
    candidates = []
    upgraded = upgrade_listing_photo_url(url)
    if upgraded and upgraded not in candidates:
        candidates.append(upgraded)
    if url.startswith("http://"):
        https_url = "https://" + url[7:]
        if https_url not in candidates:
            candidates.append(https_url)
    if url not in candidates:
        candidates.append(url)

    dest.parent.mkdir(parents=True, exist_ok=True)
    for candidate in candidates:
        req = urllib.request.Request(
            candidate,
            headers={
                "User-Agent": "ListLogic/1.0",
                "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
                "Referer": "https://www.realtor.com/",
            },
        )
        try:
            with urllib.request.urlopen(req, timeout=DOWNLOAD_TIMEOUT_SEC) as resp:
                data = resp.read()
                ctype = (resp.headers.get("Content-Type") or "").lower()
            if len(data) < 800:
                continue
            # Skip obvious thumbs when a larger candidate may still succeed.
            if len(data) < MIN_PHOTO_BYTES and candidate != candidates[-1]:
                logger.info("Skipping tiny photo (%d bytes): %s", len(data), candidate[-48:])
                continue
            if "image" not in ctype and not candidate.lower().endswith((".jpg", ".jpeg", ".png", ".webp")):
                if not (data[:3] == b"\xff\xd8\xff" or data[:8].startswith(b"\x89PNG") or data[:4] == b"RIFF"):
                    continue
            dest.write_bytes(data)
            return True
        except Exception as exc:
            logger.info("Photo download failed (%s): %s", dest.name, exc)
            continue
    return False


def _geocode(address: str) -> tuple[float | None, float | None]:
    res = _call("autocomplete", {"query": address})
    if not res.get("ok"):
        return None, None
    for s in ((res.get("data") or {}).get("suggestions") or []):
        if s.get("latitude") is not None and s.get("longitude") is not None:
            return float(s["latitude"]), float(s["longitude"])
    return None, None


def _search_bounds(west: float, east: float, south: float, north: float) -> list[dict]:
    """Pull for-sale (includes pending on Zillow) and sold so active Fingerprint cards can match."""
    bounds = {"west": west, "east": east, "south": south, "north": north}
    items: list[dict] = []
    seen: set[str] = set()
    for status in ("for_sale", "sold"):
        res = _call(
            "search_by_coordinates",
            {
                "map_bounds": bounds,
                "status": status,
                "max_results": "200",
            },
        )
        if not res.get("ok"):
            logger.info("Reef cluster search failed (%s): %s", status, res.get("error"))
            continue
        for item in list((res.get("data") or {}).get("items") or []):
            if not isinstance(item, dict):
                continue
            key = str(item.get("zpid") or item.get("address") or "")
            if not key or key in seen:
                continue
            seen.add(key)
            items.append(item)
    return items


def _search_address(address: str) -> list[dict]:
    """Street-level Zillow search — last resort when map clusters miss a house."""
    q = (address or "").strip()
    if not q:
        return []
    items: list[dict] = []
    seen: set[str] = set()
    for status in ("for_sale", "sold"):
        res = _call("search", {"location": q, "status": status, "max_results": "8"})
        if not res.get("ok"):
            logger.info("Reef address search failed (%s): %s", status, res.get("error"))
            continue
        for item in list((res.get("data") or {}).get("items") or []):
            if not isinstance(item, dict):
                continue
            key = str(item.get("zpid") or item.get("address") or item.get("address_line") or "")
            if not key or key in seen:
                continue
            seen.add(key)
            items.append(item)
    return items


def _match_item(target_address: str, items: list[dict]) -> dict | None:
    scored: list[tuple[float, dict]] = []
    for item in items:
        cand = item.get("address") or item.get("address_line") or item.get("streetAddress") or item.get("unparsed_address") or ""
        score = _address_match_score(target_address, str(cand))
        if score >= 0.55:
            scored.append((score, item))
    if not scored:
        return None
    scored.sort(key=lambda x: x[0], reverse=True)
    return scored[0][1]


def _keep_match(target: dict, item: dict, out: dict) -> bool:
    addr = str(item.get("address") or item.get("address_line") or "")
    urls = _extract_photo_urls(item, limit=1)
    if urls:
        meta = _persist_photos(
            target["key"],
            urls,
            zpid=item.get("zpid"),
            matched_address=addr,
        )
        if meta:
            out[target["key"]] = meta
            return True
    if item.get("zpid"):
        out[target["key"]] = _write_cache(
            target["key"],
            {
                "zpid": item.get("zpid"),
                "matched_address": addr,
                "gallery_paths": [],
                "primary_path": "",
            },
        )
        return True
    return False


def _cluster_targets(targets: list[dict]) -> list[list[dict]]:
    remaining = [t for t in targets if t.get("lat") is not None and t.get("lng") is not None]
    no_coords = [t for t in targets if t.get("lat") is None or t.get("lng") is None]
    clusters: list[list[dict]] = []
    while remaining:
        seed = remaining.pop(0)
        cluster = [seed]
        changed = True
        while changed:
            changed = False
            lats = [float(t["lat"]) for t in cluster]
            lngs = [float(t["lng"]) for t in cluster]
            clat = sum(lats) / len(lats)
            clng = sum(lngs) / len(lngs)
            keep: list[dict] = []
            for t in remaining:
                if abs(float(t["lat"]) - clat) <= CLUSTER_RADIUS_DEG and abs(float(t["lng"]) - clng) <= CLUSTER_RADIUS_DEG:
                    cluster.append(t)
                    changed = True
                else:
                    keep.append(t)
            remaining = keep
        clusters.append(cluster)
    for t in no_coords:
        clusters.append([t])
    return clusters


def _persist_photos(cache_key: str, urls: list[str], *, zpid: Any = None, matched_address: str = "") -> dict | None:
    if not urls:
        return None
    folder = CACHE_DIR / cache_key
    gallery_dir = folder / "gallery"
    gallery_dir.mkdir(parents=True, exist_ok=True)
    paths: list[str] = []
    failures = 0
    for i, url in enumerate(urls[:MAX_GALLERY_PHOTOS]):
        dest = gallery_dir / f"{i:02d}.jpg"
        if dest.exists():
            paths.append(str(dest))
            continue
        if _download_image(url, dest):
            paths.append(str(dest))
            failures = 0
        else:
            failures += 1
            if failures >= MAX_DOWNLOAD_FAILURES_PER_LISTING and paths:
                break
    if not paths:
        return None
    primary = folder / "primary.jpg"
    try:
        shutil.copyfile(paths[0], primary)
    except OSError:
        return None
    return _write_cache(
        cache_key,
        {
            "cache_version": PHOTO_CACHE_VERSION,
            "primary_url_source": urls[0],
            "primary_path": str(primary),
            "photos_source": urls[:MAX_GALLERY_PHOTOS],
            "gallery_paths": paths,
            "zpid": zpid,
            "matched_address": matched_address,
        },
    )


def _gallery_count(meta: dict | None) -> int:
    if not meta or meta.get("miss"):
        return 0
    return len([p for p in (meta.get("gallery_paths") or []) if Path(p).exists()])


def _copy_to_run(cache_meta: dict, run_dir: Path | None, run_id: str, public_key: str) -> tuple[str, list[str]]:
    gallery_paths = [Path(p) for p in (cache_meta.get("gallery_paths") or []) if Path(p).exists()]
    primary = Path(cache_meta.get("primary_path") or "")
    if not primary.exists() and gallery_paths:
        primary = gallery_paths[0]
    if not primary.exists():
        return "", []
    sources = gallery_paths if gallery_paths else [primary]
    if run_dir is None:
        return str(sources[0]), [str(p) for p in sources]

    photos_dir = run_dir / "photos"
    photos_dir.mkdir(parents=True, exist_ok=True)
    safe = _safe_key(public_key)
    out_urls: list[str] = []
    for i, src in enumerate(sources):
        dest_name = f"{safe}.jpg" if i == 0 else f"{safe}_{i:02d}.jpg"
        dest = photos_dir / dest_name
        try:
            if not dest.exists() or dest.stat().st_size != src.stat().st_size:
                shutil.copyfile(src, dest)
        except OSError:
            shutil.copyfile(src, dest)
        out_urls.append(f"/runs/{run_id}/photos/{dest_name}" if run_id else f"photos/{dest_name}")
    return (out_urls[0] if out_urls else ""), out_urls


def _hydrate_galleries(metas: dict[str, dict]) -> int:
    need: list[tuple[str, str]] = []
    for key, meta in metas.items():
        if not meta or meta.get("miss"):
            continue
        zpid = meta.get("zpid")
        if not zpid:
            continue
        if _gallery_count(meta) >= MAX_GALLERY_PHOTOS:
            continue
        need.append((key, str(zpid)))
    if not need or not reef_enabled():
        return 0

    api_calls = 0
    for i in range(0, len(need), GALLERY_BATCH_SIZE):
        chunk = need[i : i + GALLERY_BATCH_SIZE]
        zpids = ",".join(z for _, z in chunk)
        res = _call("property_detail", {"zpids": zpids}, timeout=90)
        api_calls += 1
        if not res.get("ok"):
            logger.info("Gallery batch failed: %s", res.get("error"))
            continue
        items = ((res.get("data") or {}).get("items") or [])
        by_zpid = {str(it.get("zpid")): it for it in items if it.get("zpid") is not None}
        for key, zpid in chunk:
            item = by_zpid.get(zpid)
            if not item:
                continue
            urls = _extract_photo_urls(item, limit=MAX_GALLERY_PHOTOS)
            if not urls:
                continue
            updated = _persist_photos(
                key,
                urls,
                zpid=zpid,
                matched_address=str(item.get("address") or metas[key].get("matched_address") or ""),
            )
            if updated:
                metas[key] = updated
    logger.info("Gallery hydrate: needed=%d api_calls=%d", len(need), api_calls)
    return api_calls


def fetch_cluster_photos(targets: list[dict], *, deadline: float | None = None) -> dict[str, dict]:
    out: dict[str, dict] = {}
    misses: list[dict] = []
    for t in targets:
        key = t["key"]
        cached = _read_cache(key)
        if cached and cached.get("miss"):
            continue
        has_file = False
        if cached:
            primary = str(cached.get("primary_path") or "")
            galleries = [str(p) for p in (cached.get("gallery_paths") or []) if p]
            has_file = bool(primary and Path(primary).exists()) or any(Path(p).exists() for p in galleries)
        if has_file:
            out[key] = cached
        else:
            misses.append(t)

    api_calls = 0
    if misses and reef_enabled():
        for cluster in _cluster_targets(misses):
            if deadline is not None and time.time() > deadline:
                logger.info("Reef photo resolve: stopping early (time budget)")
                break
            for t in cluster:
                if t.get("lat") is None or t.get("lng") is None:
                    lat, lng = _geocode(t.get("address") or "")
                    api_calls += 1
                    t["lat"], t["lng"] = lat, lng

            located = [t for t in cluster if t.get("lat") is not None and t.get("lng") is not None]
            for t in cluster:
                if t not in located:
                    items_addr = _search_address(t.get("address") or "")
                    api_calls += 1
                    item = _match_item(t.get("address") or "", items_addr)
                    if not item or not _keep_match(t, item, out):
                        _write_miss(t["key"], "geocode")
            if not located:
                continue

            lats = [float(t["lat"]) for t in located]
            lngs = [float(t["lng"]) for t in located]
            pad = CLUSTER_PAD_DEG if len(located) > 1 else CLUSTER_RADIUS_DEG
            items = _search_bounds(min(lngs) - pad, max(lngs) + pad, min(lats) - pad, max(lats) + pad)
            api_calls += 1

            still: list[dict] = []
            for t in located:
                item = _match_item(t.get("address") or "", items)
                if not item or not _keep_match(t, item, out):
                    still.append(t)

            for t in still:
                if deadline is not None and time.time() > deadline:
                    break
                lat, lng = float(t["lat"]), float(t["lng"])
                d = 0.004
                items2 = _search_bounds(lng - d, lng + d, lat - d, lat + d)
                api_calls += 1
                item = _match_item(t.get("address") or "", items2)
                if not item:
                    items2 = _search_address(t.get("address") or "")
                    api_calls += 1
                    item = _match_item(t.get("address") or "", items2)
                if not item or not _keep_match(t, item, out):
                    _write_miss(t["key"], "no_match")

    if deadline is None or time.time() <= deadline:
        api_calls += _hydrate_galleries(out)
    logger.info(
        "Reef photo resolve: cache_hits=%d resolved=%d api≈%d",
        len(targets) - len(misses),
        len(out),
        api_calls,
    )
    return out


def enrich_report_photos(
    report: dict,
    *,
    max_comps: int = 8,
    run_dir: Path | None = None,
    run_id: str = "",
    include_subject: bool = True,
    cache_only: bool = False,
    deadline: float | None = None,
    on_listing: Any = None,
    extra_listings: list | None = None,
) -> dict[str, str]:
    """Attach hosted photo galleries to comps. Sets row photo_url + photos[].

    Priority (credit-aware):
      1. Existing MLS/portal card URLs already on the row (download, no Reef)
      2. Local photo cache
      3. Reef Zillow search only for remaining misses (unless cache_only)

    cache_only=True — MLS/card URLs + local cache only (no Reef API).
    on_listing(public_key, primary_url, gallery_urls) — called as each listing is ready.
    """
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    photo_map: dict[str, str] = {}
    pos = report.get("positioning") or {}
    comps = list(pos.get("closest_comps") or [])[:max_comps]
    subject = report.get("subject") or {}
    if deadline is None and not cache_only:
        deadline = time.time() + ENRICH_BUDGET_SEC

    candidates: list[dict] = []
    for c in comps:
        if not isinstance(c, dict):
            continue
        mls = str(c.get("mls_number") or "").strip()
        addr = str(c.get("address") or "").strip()
        if not mls and not addr:
            continue
        key = _safe_key(mls or addr)
        candidates.append({
            "key": key,
            "public_key": mls or key,
            "address": ", ".join(
                x for x in [addr, str(c.get("city") or ""), str(c.get("state") or "CO")] if x
            ),
            "lat": c.get("latitude"),
            "lng": c.get("longitude"),
            "row": c,
        })

    seen = {t["public_key"] for t in candidates}
    for c in extra_listings or []:
        if not isinstance(c, dict):
            continue
        mls = str(c.get("mls_number") or c.get("mls") or c.get("id") or "").strip()
        addr = str(c.get("address") or "").strip()
        if not mls and not addr:
            continue
        public_key = mls or _safe_key(addr)
        if public_key in seen or public_key == SUBJECT_KEY:
            continue
        seen.add(public_key)
        candidates.append({
            "key": _safe_key(mls or addr),
            "public_key": public_key,
            "address": ", ".join(
                x for x in [addr, str(c.get("city") or ""), str(c.get("state") or "CO")] if x
            ),
            "lat": c.get("latitude") or c.get("lat"),
            "lng": c.get("longitude") or c.get("lng"),
            "row": c,
        })
        if len(candidates) >= max_comps + 200:
            break

    if include_subject and isinstance(subject, dict):
        sub_addr = str(subject.get("address") or "").strip()
        existing_photo = str(subject.get("photo_url") or subject.get("photo") or "")
        if existing_photo.startswith("/runs/"):
            photo_map[SUBJECT_KEY] = existing_photo.split("?")[0]
        elif sub_addr:
            candidates.append({
                "key": SUBJECT_KEY,
                "public_key": SUBJECT_KEY,
                "address": sub_addr,
                "lat": subject.get("latitude"),
                "lng": subject.get("longitude"),
                "row": subject,
            })

    # 1) Prefer URLs already on the listing/subject (MLS export or portal card).
    reef_targets: list[dict] = []
    for t in candidates:
        row = t.get("row") if isinstance(t.get("row"), dict) else {}
        existing = str(
            row.get("photo_url")
            or row.get("photo")
            or row.get("PhotoURL")
            or row.get("PrimaryPhotoURL")
            or ""
        ).strip()
        if not existing and isinstance(row.get("photos"), list) and row["photos"]:
            existing = str(row["photos"][0] or "").strip()
        if existing.startswith("http://") or existing.startswith("https://"):
            existing = upgrade_listing_photo_url(existing)
        if existing.startswith("/runs/"):
            # Re-fetch if a prior Search run hosted a tiny thumbnail.
            try:
                local_name = existing.rstrip("/").split("/")[-1]
                local_path = (run_dir / "photos" / local_name) if run_dir else None
                if local_path and local_path.exists() and local_path.stat().st_size < MIN_PHOTO_BYTES:
                    existing = ""
                else:
                    photo_map[t["public_key"]] = existing.split("?")[0]
                    continue
            except OSError:
                photo_map[t["public_key"]] = existing.split("?")[0]
                continue
        if existing.startswith("http://") or existing.startswith("https://"):
            if run_dir is not None:
                photos_dir = run_dir / "photos"
                photos_dir.mkdir(parents=True, exist_ok=True)
                dest = photos_dir / f"{_safe_key(t['public_key'])}.jpg"
                # Replace blurry thumbs that were downloaded before URL upgrade.
                if dest.exists() and dest.stat().st_size < MIN_PHOTO_BYTES:
                    try:
                        dest.unlink()
                    except OSError:
                        pass
                if dest.exists() or _download_image(existing, dest):
                    local = f"/runs/{run_id}/photos/{dest.name}" if run_id else str(dest)
                    photo_map[t["public_key"]] = local
                    row["photo_url"] = local
                    row["photos"] = [local]
                    if t["public_key"] == SUBJECT_KEY:
                        row["photo"] = local
                    # Seed disk cache so later runs skip Reef
                    try:
                        _persist_photos(t["key"], [existing], matched_address=t.get("address") or "")
                    except Exception:
                        pass
                    if callable(on_listing):
                        try:
                            on_listing(t["public_key"], local, [local])
                        except Exception:
                            logger.exception("on_listing callback failed for %s", t["public_key"])
                    continue
        # 2) Local cache hit
        cached = _read_cache(t["key"])
        if cached and not cached.get("miss") and (cached.get("primary_path") or cached.get("gallery_paths")):
            primary_url, gallery_urls = _copy_to_run(cached, run_dir, run_id, t["public_key"])
            if primary_url:
                photo_map[t["public_key"]] = primary_url
                row["photo_url"] = primary_url
                row["photos"] = gallery_urls or [primary_url]
                if t["public_key"] == SUBJECT_KEY:
                    row["photo"] = primary_url
                if callable(on_listing):
                    try:
                        on_listing(t["public_key"], primary_url, gallery_urls or [primary_url])
                    except Exception:
                        logger.exception("on_listing callback failed for %s", t["public_key"])
                continue
        reef_targets.append(t)

    # 3) Reef only for remaining misses (skipped on cache_only / generate fast path)
    if reef_targets and not cache_only and reef_enabled():
        resolved = fetch_cluster_photos(reef_targets, deadline=deadline)
        for t in reef_targets:
            meta = resolved.get(t["key"]) or _read_cache(t["key"])
            if not meta or meta.get("miss"):
                continue
            primary_url, gallery_urls = _copy_to_run(meta, run_dir, run_id, t["public_key"])
            if not primary_url:
                continue
            photo_map[t["public_key"]] = primary_url
            row = t.get("row")
            if isinstance(row, dict):
                row["photo_url"] = primary_url
                row["photos"] = gallery_urls or [primary_url]
                if t["public_key"] == SUBJECT_KEY:
                    row["photo"] = primary_url
            if callable(on_listing):
                try:
                    on_listing(t["public_key"], primary_url, gallery_urls or [primary_url])
                except Exception:
                    logger.exception("on_listing callback failed for %s", t["public_key"])

    found = sum(1 for k, v in photo_map.items() if k != SUBJECT_KEY and v)
    logger.info(
        "Hosted galleries ready: %d/%d comps%s%s (reef_targets=%d)",
        found,
        len(comps),
        " + subject" if photo_map.get(SUBJECT_KEY) else "",
        " (cache-only)" if cache_only else "",
        len(reef_targets),
    )
    return photo_map
