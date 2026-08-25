#!/usr/bin/env python
"""ListLogic web app — upload MLS export, generate presentation."""
from __future__ import annotations

import asyncio
import hashlib
import hmac
import html as html_lib
import json
import logging
import os
import re
import shutil
import threading
import time
import uuid
from collections import defaultdict, deque
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Optional

from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, RedirectResponse, Response
from fastapi.staticfiles import StaticFiles
from starlette.middleware.base import BaseHTTPMiddleware

from subject import SUBJECT_2845_DEFAULTS, resolve_subject

ROOT = Path(__file__).resolve().parent
# Prefer Railway volume (/data) so runs survive redeploys. Local/dev falls back to repo paths.
_DATA_ROOT = Path(os.environ.get("LISTLOGIC_DATA_DIR") or "/data")
if not _DATA_ROOT.exists():
    _DATA_ROOT = ROOT
UPLOAD_DIR = Path(os.environ.get("LISTLOGIC_UPLOAD_DIR") or (_DATA_ROOT / "uploads"))
OUTPUT_DIR = Path(os.environ.get("LISTLOGIC_OUTPUT_DIR") or (_DATA_ROOT / "output" / "runs"))
DEMO_EXPORT = ROOT / "data" / "export-71.txt"
BRANDING_DIR = Path(os.environ.get("LISTLOGIC_BRANDING_DIR") or (_DATA_ROOT / "output" / "branding"))

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
BRANDING_DIR.mkdir(parents=True, exist_ok=True)

MAX_UPLOAD_BYTES = 15 * 1024 * 1024
RATE_LIMIT_WINDOW_SEC = 60
RATE_LIMIT_MAX_GENERATE = 10
SAMPLE_RUN_ID = "sample-2845"
SAMPLE_FINGERPRINT_LOCKED_AT = "2026-06-02"
SAMPLE_FINGERPRINT_MIN_WEEKS = 4
SAMPLE_FINGERPRINT_STORY = "from-export-v5"

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ListLogic")

app = FastAPI(title="ListLogic", version="0.3.0")


def _current_user(request: Request) -> Optional[dict]:
    import auth_service

    token = request.cookies.get(auth_service.SESSION_COOKIE)
    user = auth_service.user_from_session_token(token)
    if user and token:
        # Throttle last_seen writes to ~once per minute per session token.
        now_bucket = int(time.time() // 60)
        cache_key = "_ll_touch_" + hashlib.sha1(token.encode()).hexdigest()[:16]
        if getattr(_current_user, cache_key, None) != now_bucket:
            setattr(_current_user, cache_key, now_bucket)
            try:
                auth_service.touch_session(token, ip=_client_ip(request))
            except Exception:
                pass
    return user


def _require_user(request: Request) -> dict:
    user = _current_user(request)
    if not user:
        raise HTTPException(401, "Sign in required")
    return user


def _require_admin(request: Request) -> dict:
    user = _require_user(request)
    if (user.get("role") or "") != "admin":
        raise HTTPException(403, "Admin only")
    return user


def _client_ip(request: Request) -> str:
    """Best-effort client IP behind Railway's proxy."""
    fwd = request.headers.get("x-forwarded-for") or request.headers.get("X-Forwarded-For") or ""
    if fwd:
        return fwd.split(",")[0].strip()
    return (request.client.host if request.client else "") or ""


def _set_session_cookie(resp: Response, request: Request, token: str) -> None:
    import auth_service

    base = (os.environ.get("APP_BASE_URL") or "").lower()
    # Behind Railway the request scheme is often http even when the public URL is https.
    secure = base.startswith("https://") or request.url.scheme == "https"
    resp.set_cookie(
        auth_service.SESSION_COOKIE,
        token,
        max_age=auth_service.SESSION_DAYS * 24 * 60 * 60,
        httponly=True,
        samesite="lax",
        secure=secure,
        path="/",
    )


def _clear_session_cookie(resp: Response) -> None:
    import auth_service

    resp.delete_cookie(auth_service.SESSION_COOKIE, path="/")


class AuthMiddleware(BaseHTTPMiddleware):
    """Session auth. Marketing, demo, signup/login, and feedback stay public."""

    OPEN_EXACT = {
        "/",
        "/health",
        "/demo",
        "/demo/fingerprint",
        "/demo/fingerprint/",
        "/api/demo",
        "/api/demo-export",
        "/api/login",
        "/api/signup",
        "/api/auth/magic-link",
        "/api/auth/verify",
        "/api/logout",
        "/api/auth-status",
        "/api/feedback",
        "/api/invite-info",
        "/api/promo-info",
        "/api/billing/config",
        "/api/billing/webhook",
        "/api/public-config",
        "/favicon.ico",
        "/robots.txt",
        "/sitemap.xml",
        "/presentation.html",
        "/deck.html",
    }
    OPEN_PREFIXES = (
        "/saas/login.html",
        "/saas/signup.html",
        "/saas/verify.html",
        "/saas/index.html",
        "/saas/pricing.html",
        "/saas/faq.html",
        "/saas/terms.html",
        "/saas/privacy.html",
        "/saas/refunds.html",
        "/saas/vs-cloud-cma.html",
        "/saas/vs-saleswise.html",
        "/saas/vs-rpr.html",
        "/saas/vs-moxi-present.html",
        "/saas/vs-best-cma-software.html",
        "/saas/interactive-cma-software.html",
        "/saas/cma-software-for-realtors.html",
        "/saas/mls-export-cma.html",
        "/saas/any-mls-cma.html",
        "/saas/upload-mls-export.html",
        "/saas/cma-in-mls.html",
        "/saas/listing-presentation-software.html",
        "/saas/cma-report-generator.html",
        "/saas/brokerage-cma-software.html",
        "/saas/cma-template.html",
        "/saas/free-cma-software.html",
        "/saas/win-more-listings.html",
        "/saas/vs-toolkitcma.html",
        "/saas/seller-cma.html",
        "/saas/changelog.html",
        "/blog/",
        "/saas/ll.css",
        "/saas/analytics.js",
        "/saas/utm.js",
        "/saas/vendor/",
        "/saas/feedback.js",
        "/saas/assistant.js",
        "/saas/dash-nav.js",
        "/saas/nav-auth.js",
        "/branding/",
        "/invite/",
    )
    # Public static assets under /saas (CSS/JS/fonts/images) — never gate behind login
    OPEN_STATIC_SUFFIXES = (
        ".css",
        ".js",
        ".map",
        ".woff",
        ".woff2",
        ".ttf",
        ".png",
        ".jpg",
        ".jpeg",
        ".webp",
        ".svg",
        ".ico",
    )
    # Runs + short share links readable so demo/client links work; generate stays gated.
    OPEN_RUN_PREFIXES = ("/runs/", "/p/")

    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        if path in self.OPEN_EXACT or path in ("/saas", "/saas/"):
            return await call_next(request)
        if any(path.startswith(p) for p in self.OPEN_PREFIXES):
            return await call_next(request)
        if path.startswith("/saas/") and path.lower().endswith(self.OPEN_STATIC_SUFFIXES):
            return await call_next(request)
        if path.startswith("/saas/admin"):
            user = _current_user(request)
            if not user or (user.get("role") or "") != "admin":
                if path.startswith("/api/"):
                    return JSONResponse({"detail": "Admin only"}, status_code=403)
                return RedirectResponse(url="/saas/login.html?next=/saas/admin.html", status_code=302)
            return await call_next(request)
        if any(path.startswith(p) for p in self.OPEN_RUN_PREFIXES):
            return await call_next(request)
        # Public read APIs so shared/demo presentations can load photos + edits
        if (
            request.method == "GET"
            and path.startswith("/api/runs/")
            and path.endswith(("/share", "/edits", "/scenarios", "/comp-photos", "/pulse", "/pulse-opt-out"))
        ):
            return await call_next(request)
        # Internal cron
        if path.startswith("/api/internal/"):
            return await call_next(request)
        user = _current_user(request)
        if not user:
            if path.startswith("/api/"):
                return JSONResponse({"detail": "Sign in required", "reason": "auth"}, status_code=401)
            return RedirectResponse(url=f"/saas/login.html?next={path}", status_code=302)
        # App HTML is fine for any signed-in user; entitlement checked on generate
        return await call_next(request)


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app):
        super().__init__(app)
        self._hits: dict[str, deque] = defaultdict(deque)

    async def dispatch(self, request: Request, call_next):
        if request.url.path in ("/api/generate", "/api/demo") and request.method in ("POST", "GET"):
            ip = request.client.host if request.client else "unknown"
            now = time.time()
            q = self._hits[ip]
            while q and now - q[0] > RATE_LIMIT_WINDOW_SEC:
                q.popleft()
            if len(q) >= RATE_LIMIT_MAX_GENERATE:
                return JSONResponse(
                    {"detail": "Too many requests. Try again in a minute."},
                    status_code=429,
                )
            q.append(now)
        return await call_next(request)


app.add_middleware(RateLimitMiddleware)
app.add_middleware(AuthMiddleware)

app.mount("/saas", StaticFiles(directory=str(ROOT / "saas"), html=True), name="saas")
app.mount("/blog", StaticFiles(directory=str(ROOT / "blog"), html=True), name="blog")


@app.on_event("startup")
def _startup():
    """Migrations/admin seed must not block readiness — Railway healthchecks /health."""
    import threading

    def _boot():
        try:
            import auth_service

            auth_service.bootstrap()
            logger.info("Auth bootstrap complete")
        except Exception:
            logger.exception("Auth bootstrap failed")

    threading.Thread(target=_boot, name="listlogic-bootstrap", daemon=True).start()
    _start_scheduler()


def _run_lifecycle_sweep() -> dict:
    """Trial reminders + expirations (same logic as /api/internal/trial-reminders)."""
    import auth_service
    import mailer

    base = auth_service.app_base_url()
    reminded = 0
    expired = 0
    for user in auth_service.users_needing_trial_reminder(7):
        if auth_service.event_already_sent(user["id"], "trial_reminder_email"):
            continue
        mailer.send_trial_reminder(user, base)
        auth_service.log_event(user["id"], "trial_reminder_email", {})
        reminded += 1
    for user in auth_service.users_newly_expired():
        if auth_service.event_already_sent(user["id"], "trial_expired_email"):
            continue
        mailer.send_trial_expired(user, base)
        auth_service.log_event(user["id"], "trial_expired_email", {})
        expired += 1
    return {"reminded": reminded, "expired": expired}


def _run_owner_digest() -> bool:
    """Weekly owner email; self-dedupes via the events table."""
    import auth_service
    import mailer
    import stripe_billing

    if auth_service.recent_event_exists("owner_digest_email", within_hours=144):
        return False
    stats = auth_service.admin_stats()
    subs_data = auth_service.list_subscriptions()
    billing = subs_data.get("summary", {})
    stripe_actual = None
    if stripe_billing.stripe_configured():
        mrr = 0.0
        active = 0
        past_due_ct = 0
        for s in subs_data.get("subscriptions", []):
            user = s.get("user") or {}
            if not user.get("has_stripe"):
                continue
            snap = stripe_billing.subscription_snapshot(user)
            if not snap:
                continue
            status = snap.get("subscription_status") or ""
            if status in ("active", "trialing"):
                active += 1
                mrr += float(snap.get("monthly_amount") or 0)
            elif status == "past_due":
                past_due_ct += 1
        stripe_actual = {"mrr": round(mrr, 2), "active_subs": active, "past_due": past_due_ct}
    sent = mailer.send_owner_digest({
        "stats": stats,
        "billing": billing,
        "past_due": auth_service.list_past_due_users(days=30),
        "new_users": auth_service.list_recent_signups(days=7),
        "stripe_actual": stripe_actual,
        "admin_url": auth_service.app_base_url() + "/saas/admin.html",
    })
    auth_service.log_event(None, "owner_digest_email", {"sent": bool(sent), "paying": billing.get("paying", 0)})
    return bool(sent)


def _start_scheduler() -> None:
    """In-process cron: lifecycle sweep every 6h, owner digest weekly.

    Single uvicorn worker (see Dockerfile) makes a thread safe here; the digest
    dedupes via the events table so a restart never double-sends.
    """
    import threading
    import time

    if getattr(app.state, "scheduler_started", False):
        return
    app.state.scheduler_started = True

    def _loop():
        time.sleep(180)  # let bootstrap/migrations settle first
        while True:
            try:
                result = _run_lifecycle_sweep()
                if result.get("reminded") or result.get("expired"):
                    logger.info("Lifecycle sweep: %s", result)
            except Exception:
                logger.exception("Lifecycle sweep failed")
            try:
                if _run_owner_digest():
                    logger.info("Owner digest sent")
            except Exception:
                logger.exception("Owner digest failed")
            try:
                sweep = _photo_maintenance_sweep()
                if sweep.get("rehosted") or sweep.get("enriched"):
                    logger.info("Photo maintenance: %s", sweep)
            except Exception:
                logger.exception("Photo maintenance sweep failed")
            try:
                pulse = _run_pulse_briefs()
                if pulse.get("sent"):
                    logger.info("Pulse briefs: %s", pulse)
            except Exception:
                logger.exception("Pulse brief sweep failed")
            time.sleep(6 * 3600)

    threading.Thread(target=_loop, name="listlogic-scheduler", daemon=True).start()


def _save_html(report: dict, path: Path) -> Path:
    import importlib
    import interactive_html
    import deck_html

    importlib.reload(interactive_html)
    importlib.reload(deck_html)
    out = interactive_html.save_interactive_html(report, path)
    deck_path = path.parent / "deck.html"
    deck_html.save_deck_html(report, deck_path)
    return out


def _build_presentation(**kwargs):
    import importlib
    import presentation

    importlib.reload(presentation)
    return presentation.build_presentation(**kwargs)


def _slug(value: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9]+", "-", (value or "report").strip().lower()).strip("-")
    return cleaned[:48] or "report"


def _optional_float(value: Optional[str]) -> Optional[float]:
    if value is None or str(value).strip() == "":
        return None
    return float(value)


def _safe_run_id(run_id: str) -> str:
    if not re.fullmatch(r"[A-Za-z0-9_-]{6,120}", run_id or ""):
        raise HTTPException(404, "Run not found")
    return run_id


def _generate(
    export_path: Optional[Path] = None,
    *,
    address: str,
    living_area: Optional[float],
    beds: Optional[float],
    baths: Optional[float],
    year_built: Optional[int],
    condition: str,
    list_price: Optional[float],
    mls_number: Optional[str],
    garage_spaces: Optional[float] = None,
    lot_size: Optional[float] = None,
    acres: Optional[float] = None,
    subdivision: Optional[str] = None,
    style: Optional[str] = None,
    photo_url: Optional[str] = None,
    latitude: Optional[float] = None,
    longitude: Optional[float] = None,
    city_filter: str,
    area_name: str,
    agent_name: str,
    agent_phone: str,
    agent_email: str,
    brokerage: str,
    brand_primary: str = "",
    brand_accent: str = "",
    logo_url: str = "",
    market_notes: str = "",
    force_run_id: Optional[str] = None,
    market_df=None,
    data_source: str = "",
    subject_photo_bytes: Optional[bytes] = None,
    subject_photo_ext: str = ".jpg",
    copy_defaults: Optional[dict] = None,
    portal_criteria: Optional[dict] = None,
) -> dict:
    defaults = dict(SUBJECT_2845_DEFAULTS) if "2845" in (address or "") and "13" in (address or "") else {}
    overrides = {
        "condition": condition or "average",
        "living_area": living_area,
        "beds": beds,
        "baths": baths,
        "year_built": year_built,
        "list_price": list_price,
        "garage_spaces": garage_spaces,
        "lot_size": lot_size,
        "acres": acres,
        "subdivision": subdivision,
        "style": style,
        "photo_url": photo_url,
        "latitude": latitude,
        "longitude": longitude,
        "mls_number": mls_number,
    }
    overrides = {k: v for k, v in overrides.items() if v is not None and v != ""}

    subject = resolve_subject(
        str(export_path) if export_path else None,
        address=address or None,
        mls_number=mls_number or None,
        defaults=defaults or None,
        overrides=overrides,
        market_df=market_df,
    )
    if living_area:
        subject.living_area = float(living_area)
    if beds is not None:
        subject.beds = float(beds)
    if baths is not None:
        subject.baths = float(baths)
    if year_built is not None:
        subject.year_built = int(year_built)
    if garage_spaces is not None:
        subject.garage_spaces = float(garage_spaces)
    if lot_size is not None:
        subject.lot_size = float(lot_size)
    if acres is not None:
        subject.acres = float(acres)
    if subdivision:
        subject.subdivision = str(subdivision)
    if style:
        subject.style = str(style)
    if photo_url:
        subject.photo_url = str(photo_url)
    if latitude is not None:
        subject.latitude = float(latitude)
    if longitude is not None:
        subject.longitude = float(longitude)

    report = _build_presentation(
        export_path=str(export_path) if export_path else None,
        subject=subject,
        area_name=area_name or "Custom market",
        city_filter=city_filter or "",
        agent_name=agent_name or "Your Agent",
        agent_phone=agent_phone or "",
        agent_email=agent_email or "",
        brokerage=brokerage or "",
        market_notes=market_notes or "",
        market_df=market_df,
        data_source=data_source or "",
    )
    meta = report.setdefault("meta", {})
    if brand_primary:
        meta["brand_primary"] = brand_primary
    if brand_accent:
        meta["brand_accent"] = brand_accent
    if logo_url:
        meta["logo_url"] = logo_url
    meta["city"] = city_filter or meta.get("city") or ""
    meta["state"] = "CO"
    meta["market_notes"] = market_notes or ""
    meta["market_label"] = area_name or ""
    if portal_criteria:
        meta["portal_criteria"] = portal_criteria
    try:
        from portal_market import lookup_zestimate, portal_values_fresh

        existing_pv = meta.get("portal_values") if isinstance(meta.get("portal_values"), dict) else None
        if not portal_values_fresh(existing_pv):
            z_addr = (address or "").strip() or (getattr(subject, "address", "") or "")
            portal_values = lookup_zestimate(z_addr)
            if portal_values:
                meta["portal_values"] = portal_values
    except Exception:
        logger.info("Zestimate lookup skipped for %s", (address or "")[:80])
    if copy_defaults:
        try:
            from copy_defaults import apply_account_copy

            apply_account_copy(report, copy_defaults)
        except Exception:
            logger.exception("Failed to apply account copy defaults")

    if force_run_id:
        run_id = _safe_run_id(force_run_id)
        run_dir = OUTPUT_DIR / run_id
        if run_dir.exists():
            shutil.rmtree(run_dir, ignore_errors=True)
    else:
        run_id = f"{datetime.now().strftime('%Y%m%d-%H%M%S')}-{_slug(address)}-{uuid.uuid4().hex[:8]}"
        run_dir = OUTPUT_DIR / run_id
    run_dir.mkdir(parents=True, exist_ok=True)
    if market_df is not None:
        try:
            market_df.to_csv(run_dir / "market.csv", sep="|", index=False)
        except Exception:
            logger.exception("Failed to persist market.csv for pulse")
    elif export_path:
        try:
            shutil.copyfile(export_path, run_dir / "market.csv")
        except Exception:
            logger.exception("Failed to copy market export for pulse")

    # Prefer an uploaded subject photo; else host autofill URL if present (no Reef spend).
    sub = report.get("subject") if isinstance(report.get("subject"), dict) else None
    if sub is None and subject:
        from dataclasses import asdict as _asdict
        report["subject"] = _asdict(subject)
        sub = report["subject"]
    if isinstance(sub, dict):
        hosted = _host_subject_photo(
            run_id,
            run_dir,
            upload_bytes=subject_photo_bytes,
            upload_ext=subject_photo_ext,
            remote_url=str(sub.get("photo_url") or photo_url or ""),
        )
        if hosted:
            sub["photo_url"] = hosted
            sub["photo"] = hosted
            sub["photos"] = [hosted]
            photos = _load_photo_map(run_dir)
            photos[SUBJECT_PHOTO_MLS] = hosted
            _save_photo_map(run_dir, photos)

    # Fast path: apply cached listing photos only, then finish generate.
    # Full Reef fetch continues in the background so the UI can show photos as they arrive.
    photo_map: dict = {}
    photos_pending = False
    try:
        from reef_photos import enrich_report_photos, reef_enabled

        if reef_enabled():
            photo_map = enrich_report_photos(
                report,
                run_dir=run_dir,
                run_id=run_id,
                cache_only=True,
            )
            meta["reef_photos"] = len([k for k, v in photo_map.items() if v])
            meta["photos_hosted"] = True
            photos_pending = True
    except Exception:
        logger.exception("Cached photo apply failed")

    if photo_map:
        try:
            _save_photo_map(run_dir, photo_map)
            galleries: dict = {}
            for k, v in photo_map.items():
                if v:
                    galleries[k] = [v]
            for c in (report.get("positioning") or {}).get("closest_comps") or []:
                if isinstance(c, dict) and c.get("mls_number") and c.get("photos"):
                    galleries[str(c["mls_number"])] = list(c["photos"])
            sub = report.get("subject") or {}
            if isinstance(sub, dict) and (sub.get("photos") or sub.get("photo_url") or sub.get("photo")):
                galleries[SUBJECT_PHOTO_MLS] = list(
                    sub.get("photos")
                    or [sub.get("photo_url") or sub.get("photo")]
                )
            _save_gallery_map(run_dir, galleries)
        except Exception:
            logger.exception("Failed to persist comp_photos.json for %s", run_id)

    if photos_pending:
        total = _expected_photo_targets(report)
        _write_photos_status(
            run_dir,
            status="pending",
            done=len([v for v in photo_map.values() if v]),
            total=total,
            message="Fetching listing photos…",
        )
    else:
        _write_photos_status(run_dir, status="ready", done=0, total=0, message="")

    (run_dir / "presentation.json").write_text(
        json.dumps(report, indent=2, default=str),
        encoding="utf-8",
    )
    try:
        _write_pulse_lock(run_dir, report, source="recommended")
    except Exception:
        logger.exception("Failed to lock recommended list for pulse")
    html_path = _save_html(report, run_dir / "presentation.html")

    if photos_pending:
        try:
            _start_background_photos(run_id, run_dir)
        except Exception:
            logger.exception("Failed to start background photo job for %s", run_id)
    latest = ROOT / "output" / "presentation.html"
    latest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(html_path, latest)
    shutil.copyfile(run_dir / "presentation.json", ROOT / "output" / "presentation.json")
    shutil.copyfile(html_path, ROOT / "presentation.html")
    deck_src = run_dir / "deck.html"
    if deck_src.exists():
        shutil.copyfile(deck_src, ROOT / "output" / "deck.html")
        shutil.copyfile(deck_src, ROOT / "deck.html")

    # PDF seller packet (presentation.pdf aliases to same rich packet as story.pdf)
    pdf_url = None
    story_pdf_url = None
    try:
        from pdf_export import build_pdf, build_story_pdf

        pdf_path = run_dir / "presentation.pdf"
        build_pdf(
            report,
            pdf_path,
            agent_name=agent_name or "Your Agent",
            brokerage=brokerage or "",
        )
        shutil.copyfile(pdf_path, ROOT / "output" / "presentation.pdf")
        pdf_url = f"/runs/{run_id}/pdf"

        story_path = run_dir / "story.pdf"
        build_story_pdf(
            report,
            story_path,
            agent_name=agent_name or "Your Agent",
            brokerage=brokerage or "",
        )
        shutil.copyfile(story_path, ROOT / "output" / "story.pdf")
        story_pdf_url = f"/runs/{run_id}/story.pdf"
    except Exception:
        logger.exception("PDF export failed for run %s", run_id)

    # Refresh sample demo PDFs so /demo always shows the latest packet design.
    if run_id == SAMPLE_RUN_ID:
        try:
            _refresh_sample_pdfs(report, run_dir)
        except Exception:
            logger.exception("Sample PDF refresh failed")

    positioning = report.get("positioning") or {}
    stats = report.get("stats") or {}
    return {
        "run_id": run_id,
        "url": f"/runs/{run_id}/",
        "share_url": f"/runs/{run_id}/",
        "pdf_url": pdf_url,
        "story_pdf_url": story_pdf_url,
        "deck_url": f"/runs/{run_id}/deck.html",
        "fingerprint_url": f"/runs/{run_id}/fingerprint/",
        "photos_pending": photos_pending,
        "recommended_price": positioning.get("recommended_price"),
        "price_low": positioning.get("price_low"),
        "price_high": positioning.get("price_high"),
        "months_of_inventory": stats.get("months_of_inventory"),
        "active_count": report.get("active_count"),
        "under_contract_count": report.get("under_contract_count"),
        "subject": {
            "address": subject.address,
            "living_area": subject.living_area,
            "beds": subject.beds,
            "baths": subject.baths,
            "year_built": subject.year_built,
            "source": (subject.extra or {}).get("source"),
        },
    }


@app.get("/", response_class=HTMLResponse)
def home():
    # Serve the homepage directly at "/" (no redirect to /saas/) so "/" is the
    # single canonical home — avoids the duplicate-canonical indexation issue.
    index = ROOT / "saas" / "index.html"
    return HTMLResponse(content=index.read_text(encoding="utf-8")) if index.exists() else RedirectResponse(url="/saas/")


@app.get("/saas")
@app.get("/saas/")
@app.get("/saas/index.html")
async def home_canonical_redirect():
    # Collapse the bare /saas directory (and its index) onto "/" so there's one
    # canonical home. (Note: /saas/*.html product pages stay untouched.)
    return RedirectResponse(url="/", status_code=301)


@app.get("/favicon.ico")
def favicon():
    return FileResponse(ROOT / "saas" / "listlogic-logo.png", media_type="image/png")


@app.get("/robots.txt")
def robots():
    return FileResponse(ROOT / "robots.txt", media_type="text/plain")


@app.get("/sitemap.xml")
def sitemap():
    return FileResponse(ROOT / "sitemap.xml", media_type="application/xml")


@app.get("/health")
def health():
    import db as database

    return {
        "ok": True,
        "product": "ListLogic",
        "auth": "session",
        "db": database.health_info(),
        "storage": {
            "output_dir": str(OUTPUT_DIR),
            "upload_dir": str(UPLOAD_DIR),
            "data_root": str(_DATA_ROOT),
            "persistent": str(_DATA_ROOT).replace("\\", "/").startswith("/data")
            or bool(os.environ.get("LISTLOGIC_DATA_DIR")),
        },
    }


def _hydrate_run_from_db(run_id: str) -> Optional[Path]:
    """Restore presentation.html from Postgres if disk was wiped by a redeploy."""
    import auth_service

    try:
        row = auth_service.get_presentation_by_run(run_id)
    except Exception:
        logger.exception("DB hydrate lookup failed for %s", run_id)
        return None
    html = (row or {}).get("presentation_html") or ""
    if not html:
        return None
    run_dir = OUTPUT_DIR / run_id
    run_dir.mkdir(parents=True, exist_ok=True)
    path = run_dir / "presentation.html"
    path.write_text(html, encoding="utf-8")
    deck_html = (row or {}).get("deck_html") or ""
    if deck_html:
        (run_dir / "deck.html").write_text(deck_html, encoding="utf-8")
    logger.info("Hydrated run %s from database backup", run_id)
    return path


def _missing_run_page(run_id: str) -> HTMLResponse:
    safe = html_lib.escape(run_id)
    body = f"""<!DOCTYPE html><html><head><meta charset="utf-8"><title>Presentation unavailable — ListLogic</title>
<link rel="stylesheet" href="/saas/ll.css">
<style>body{{font-family:Inter,system-ui,sans-serif;max-width:560px;margin:12vh auto;padding:24px}}
h1{{font-family:Fraunces,serif;font-size:1.6rem}} .muted{{color:#64748b}}</style></head>
<body>
<h1>This presentation isn’t on the server anymore</h1>
<p class="muted">Run <code>{safe}</code> was lost when the app redeployed before permanent storage was enabled.</p>
<p>Generate a fresh presentation from the app — new runs are saved on permanent storage.</p>
<p><a class="btn btn-primary" href="/saas/app.html">Back to ListLogic</a>
 · <a href="/demo">Try the demo</a></p>
</body></html>"""
    return HTMLResponse(body, status_code=404)


@app.get("/api/auth-status")
def auth_status(request: Request):
    import auth_service

    user = _current_user(request)
    if not user:
        return {
            "required": True,
            "authenticated": False,
            "user": None,
            "entitlement": None,
        }
    ent = auth_service.entitlement(user)
    return {
        "required": True,
        "authenticated": True,
        "user": auth_service.public_user(user),
        "entitlement": ent,
    }


@app.get("/api/public-config")
async def public_config():
    """Non-secret client config (GA4 id, etc.)."""
    return {
        "ga4": (
            os.environ.get("GA4_MEASUREMENT_ID")
            or os.environ.get("GA4_PROPERTY_ID")
            or "G-WHGZQDZ6ZG"
        ).strip(),
        "app_base": (os.environ.get("APP_BASE_URL") or "https://listlogic.homes").rstrip("/"),
        "stripe_trial_days": int(os.environ.get("STRIPE_TRIAL_DAYS") or "7"),
    }


@app.get("/api/billing/config")
def billing_config():
    import stripe_billing

    return stripe_billing.public_plans()


@app.get("/api/team")
def team_get(request: Request):
    import auth_service

    user = _require_user(request)
    if not auth_service.is_brokerage_owner(user):
        raise HTTPException(403, "Team seats are for brokerage plan owners")
    return {"ok": True, "team": auth_service.team_snapshot(user)}


@app.post("/api/team/invite")
async def team_invite(request: Request):
    import auth_service
    import mailer

    user = _require_user(request)
    try:
        payload = await request.json()
    except Exception as exc:
        raise HTTPException(400, "Invalid JSON") from exc
    emails = payload.get("emails") if payload.get("emails") is not None else payload.get("email")
    try:
        result = auth_service.invite_team_members(user, emails)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    owner_name = (user.get("name") or "").strip()
    brokerage = (user.get("brokerage") or "").strip()
    for item in result.get("invited") or []:
        url = item.get("url") or ""
        to = item.get("email") or ""
        if not url or not to:
            continue
        try:
            sent = mailer.send_team_invite(to=to, url=url, owner_name=owner_name, brokerage=brokerage)
            item["sent"] = bool(sent)
        except Exception:
            logger.exception("Team invite email failed for %s", to)
            item["sent"] = False
    return {"ok": True, **result}


@app.post("/api/team/invite/revoke")
async def team_invite_revoke(request: Request):
    import auth_service

    user = _require_user(request)
    try:
        payload = await request.json()
    except Exception as exc:
        raise HTTPException(400, "Invalid JSON") from exc
    token = str(payload.get("token") or "").strip()
    try:
        team = auth_service.revoke_team_invite(user, token)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    return {"ok": True, "team": team}


@app.post("/api/team/members/remove")
async def team_member_remove(request: Request):
    import auth_service

    user = _require_user(request)
    try:
        payload = await request.json()
    except Exception as exc:
        raise HTTPException(400, "Invalid JSON") from exc
    member_id = str(payload.get("user_id") or payload.get("id") or "").strip()
    try:
        team = auth_service.remove_teammate(user, member_id)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    return {"ok": True, "team": team}


@app.post("/api/billing/checkout")
async def billing_checkout(request: Request):
    import stripe_billing

    user = _require_user(request)
    if not stripe_billing.stripe_configured():
        raise HTTPException(503, "Stripe is not configured yet")
    try:
        payload = await request.json()
    except Exception as exc:
        raise HTTPException(400, "Invalid JSON") from exc
    plan = str(payload.get("plan") or "").strip().lower()
    quantity = int(payload.get("quantity") or payload.get("seats") or 1)
    try:
        session = stripe_billing.create_checkout_session(user, plan=plan, quantity=quantity)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    except Exception as exc:
        logger.exception("Stripe checkout failed")
        raise HTTPException(502, f"Checkout failed: {exc}") from exc
    return {"ok": True, **session}


@app.post("/api/billing/portal")
async def billing_portal(request: Request):
    import stripe_billing

    user = _require_user(request)
    if not stripe_billing.stripe_configured():
        raise HTTPException(503, "Stripe is not configured yet")
    try:
        portal = stripe_billing.create_billing_portal_session(user)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    except Exception as exc:
        logger.exception("Stripe portal failed")
        raise HTTPException(502, f"Billing portal failed: {exc}") from exc
    return {"ok": True, **portal}


@app.post("/api/billing/webhook")
async def billing_webhook(request: Request):
    import stripe_billing

    payload = await request.body()
    sig = request.headers.get("stripe-signature") or ""
    try:
        event = stripe_billing.construct_event(payload, sig)
    except Exception as exc:
        logger.warning("Stripe webhook signature failed: %s", exc)
        raise HTTPException(400, "Invalid webhook signature") from exc
    try:
        result = stripe_billing.handle_webhook_event(event)
    except Exception as exc:
        logger.exception("Stripe webhook handler failed")
        raise HTTPException(500, "Webhook handler error") from exc
    return {"received": True, **result}


@app.post("/api/signup")
async def signup(request: Request):
    """Legacy password signup — prefer /api/auth/magic-link."""
    import auth_service
    import mailer

    try:
        payload = await request.json()
    except Exception as exc:
        raise HTTPException(400, "Invalid JSON") from exc
    try:
        user = auth_service.create_user(
            email=str(payload.get("email") or ""),
            password=str(payload.get("password") or ""),
            name=str(payload.get("name") or ""),
            phone=str(payload.get("phone") or ""),
            brokerage=str(payload.get("brokerage") or ""),
            promo_code=str(payload.get("promo_code") or ""),
            invite_token=str(payload.get("invite") or payload.get("invite_token") or ""),
            email_verified=False,
        )
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    token = auth_service.create_session(
        user["id"], ip=_client_ip(request), user_agent=request.headers.get("user-agent", "")
    )
    try:
        mailer.send_welcome(user, auth_service.app_base_url())
    except Exception:
        logger.exception("Welcome email failed")
    resp = JSONResponse({
        "ok": True,
        "user": auth_service.public_user(user),
        "entitlement": auth_service.entitlement(user),
    })
    _set_session_cookie(resp, request, token)
    return resp


@app.post("/api/auth/magic-link")
async def request_magic_link(request: Request):
    import auth_service
    import mailer

    try:
        payload = await request.json()
    except Exception as exc:
        raise HTTPException(400, "Invalid JSON") from exc
    email = str(payload.get("email") or "").strip()
    try:
        link = auth_service.create_magic_link(
            email,
            promo_code=str(payload.get("promo_code") or ""),
            invite_token=str(payload.get("invite") or payload.get("invite_token") or ""),
            next_path=str(payload.get("next") or "/saas/app.html"),
        )
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc

    sent = False
    send_error = ""
    try:
        sent = mailer.send_magic_link(to=link["email"], url=link["url"], is_new=link["is_new"])
        if not sent and mailer._smtp_config():
            send_error = "SMTP is configured but the message could not be delivered. Check Railway logs / Gmail app password."
    except Exception as exc:
        logger.exception("Magic link email failed")
        send_error = str(exc)[:200]

    # Dev fallback: include URL when SMTP isn't configured OR send failed
    configured = bool(mailer._smtp_config())
    if sent:
        message = "Check your email for a sign-in link."
    elif not configured:
        message = "Email delivery isn't configured — use the link below (dev mode)."
    else:
        message = "We couldn't send the email right now — use the link below, or try again in a minute."
    out = {
        "ok": True,
        "email": link["email"],
        "sent": sent,
        "message": message,
    }
    if send_error and not sent:
        out["send_error"] = send_error
    if not sent:
        out["dev_url"] = link["url"]
    return JSONResponse(out)


@app.post("/api/auth/verify")
async def verify_magic_link(request: Request):
    import auth_service
    import mailer

    try:
        payload = await request.json()
    except Exception as exc:
        raise HTTPException(400, "Invalid JSON") from exc
    token = str(payload.get("token") or "")
    try:
        result = auth_service.consume_magic_link(token)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc

    user = result["user"]
    if result.get("is_new"):
        try:
            mailer.send_welcome(user, auth_service.app_base_url())
        except Exception:
            logger.exception("Welcome email failed")

    session = auth_service.create_session(
        user["id"], ip=_client_ip(request), user_agent=request.headers.get("user-agent", "")
    )
    resp = JSONResponse({
        "ok": True,
        "user": auth_service.public_user(user),
        "entitlement": auth_service.entitlement(user),
        "is_new": result.get("is_new"),
        "needs_onboarding": result.get("needs_onboarding"),
        "next": result.get("next") or "/saas/app.html",
    })
    _set_session_cookie(resp, request, session)
    return resp


@app.get("/api/sessions")
def list_my_sessions(request: Request):
    import auth_service

    user = _require_user(request)
    token = request.cookies.get(auth_service.SESSION_COOKIE)
    return {"ok": True, "sessions": auth_service.list_sessions(user["id"], current_token=token)}


@app.post("/api/sessions/signout-others")
def signout_other_sessions(request: Request):
    import auth_service

    user = _require_user(request)
    token = request.cookies.get(auth_service.SESSION_COOKIE)
    removed = auth_service.delete_other_sessions(user["id"], token)
    return {"ok": True, "removed": removed}


@app.delete("/api/sessions/{session_id}")
def delete_my_session(request: Request, session_id: str):
    import auth_service

    user = _require_user(request)
    ok = auth_service.delete_session_by_id(user["id"], session_id)
    if not ok:
        raise HTTPException(404, "Session not found")
    return {"ok": True}


@app.post("/api/profile")
async def save_profile(request: Request):
    import auth_service

    user = _require_user(request)
    content_type = (request.headers.get("content-type") or "").lower()
    logo_url = None
    password = ""
    if "multipart/form-data" in content_type:
        form = await request.form()
        name = str(form.get("name") or "")
        phone = str(form.get("phone") or "")
        brokerage = str(form.get("brokerage") or "")
        brand_primary = str(form.get("brand_primary") or "")
        brand_accent = str(form.get("brand_accent") or "")
        password = str(form.get("password") or "")
        listings_year = str(form.get("listings_year") or "")
        sms_consent_raw = str(form.get("sms_consent") or "").lower()
        sms_consent = sms_consent_raw in {"1", "true", "yes", "on"}
        logo = form.get("logo")
        if logo and getattr(logo, "filename", None):
            raw = await logo.read()
            if len(raw) > 2 * 1024 * 1024:
                raise HTTPException(400, "Logo must be under 2MB")
            suffix = Path(logo.filename).suffix.lower()
            if suffix not in {".png", ".jpg", ".jpeg", ".webp", ".svg"}:
                raise HTTPException(400, "Logo must be png, jpg, webp, or svg")
            logo_name = f"{uuid.uuid4().hex}{suffix}"
            logo_path = BRANDING_DIR / logo_name
            logo_path.write_bytes(raw)
            logo_url = f"/branding/{logo_name}"
    else:
        try:
            payload = await request.json()
        except Exception as exc:
            raise HTTPException(400, "Invalid JSON") from exc
        name = str(payload.get("name") or "")
        phone = str(payload.get("phone") or "")
        brokerage = str(payload.get("brokerage") or "")
        brand_primary = str(payload.get("brand_primary") or "")
        brand_accent = str(payload.get("brand_accent") or "")
        password = str(payload.get("password") or "")
        listings_year = str(payload.get("listings_year") or "")
        sms_consent = bool(payload.get("sms_consent"))
        if "logo_url" in payload:
            logo_url = str(payload.get("logo_url") or "")

    try:
        if password:
            auth_service.set_password(user["id"], password)
        updated = auth_service.update_profile(
            user["id"],
            name=name,
            phone=phone,
            brokerage=brokerage,
            brand_primary=brand_primary,
            brand_accent=brand_accent,
            logo_url=logo_url,
            listings_year=listings_year,
            sms_consent=sms_consent,
            mark_complete=True,
        )
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc

    return JSONResponse({
        "ok": True,
        "user": auth_service.public_user(updated),
        "entitlement": auth_service.entitlement(updated),
    })


@app.post("/api/login")
async def login(request: Request):
    import auth_service

    content_type = (request.headers.get("content-type") or "").lower()
    email = ""
    password = ""
    requested_next = ""
    if "application/json" in content_type:
        try:
            payload = await request.json()
        except Exception as exc:
            raise HTTPException(400, "Invalid JSON") from exc
        email = str(payload.get("email") or "")
        password = str(payload.get("password") or "")
        requested_next = str(payload.get("next") or "")
    else:
        form = await request.form()
        # Legacy access-code form field "token" no longer supported as primary login
        email = str(form.get("email") or form.get("token") or "")
        password = str(form.get("password") or "")
        requested_next = str(form.get("next") or "")
        if form.get("token") and not form.get("password"):
            raise HTTPException(
                400,
                "Access codes are retired. Create an account or sign in with email.",
            )
    try:
        user = auth_service.login_user(email, password)
    except ValueError as exc:
        raise HTTPException(401, str(exc)) from exc
    token = auth_service.create_session(
        user["id"], ip=_client_ip(request), user_agent=request.headers.get("user-agent", "")
    )
    home = auth_service.resolve_post_auth_next(user, requested_next)
    if not bool(int(user.get("profile_complete") or 0)):
        home = "/saas/onboarding.html?next=" + home
    resp = JSONResponse({
        "ok": True,
        "user": auth_service.public_user(user),
        "entitlement": auth_service.entitlement(user),
        "next": home,
    })
    _set_session_cookie(resp, request, token)
    return resp


@app.post("/api/logout")
async def logout(request: Request):
    import auth_service

    token = request.cookies.get(auth_service.SESSION_COOKIE)
    auth_service.delete_session(token)
    resp = JSONResponse({"ok": True})
    _clear_session_cookie(resp)
    return resp


@app.get("/api/invite-info")
def invite_info(token: str = ""):
    import auth_service

    if not token:
        raise HTTPException(400, "Missing invite token")
    info = auth_service.validate_invite(token)
    if not info["ok"]:
        raise HTTPException(404, info.get("error") or "Invite not found")
    kind = (info.get("kind") or "").strip()
    return {
        "ok": True,
        "email": info.get("email") or "",
        "brokerage": info.get("brokerage") or "",
        "kind": kind,
        "trial_days": info.get("trial_days"),
        "presentation_limit": info.get("presentation_limit"),
    }


@app.get("/api/promo-info")
def promo_info(code: str = ""):
    import auth_service

    if not code:
        raise HTTPException(400, "Missing promo code")
    info = auth_service.validate_promo(code)
    if not info["ok"]:
        raise HTTPException(404, info.get("error") or "Promo not found")
    return {
        "ok": True,
        "code": (code or "").strip(),
        "unlimited": bool(info.get("unlimited")),
        "trial_days": info.get("trial_days"),
        "presentation_limit": info.get("presentation_limit"),
        "label": (info.get("promo") or {}).get("label") or "",
    }


@app.post("/api/feedback")
async def submit_feedback(request: Request):
    import auth_service
    import mailer

    try:
        payload = await request.json()
    except Exception as exc:
        raise HTTPException(400, "Invalid JSON") from exc
    user = _current_user(request)
    email = str(payload.get("email") or (user or {}).get("email") or "")
    try:
        result = auth_service.save_feedback(
            message=str(payload.get("message") or ""),
            category=str(payload.get("category") or "other"),
            email=email,
            user_id=(user or {}).get("id"),
            page_url=str(payload.get("page_url") or ""),
            user_agent=request.headers.get("user-agent") or "",
        )
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    try:
        mailer.send_feedback_notice({
            "category": payload.get("category") or "other",
            "email": email,
            "user_id": (user or {}).get("id"),
            "page_url": payload.get("page_url"),
            "message": payload.get("message"),
        })
    except Exception:
        logger.exception("Feedback email failed")
    return result


@app.post("/api/assistant/chat")
async def assistant_chat(request: Request):
    """Logged-in ListLogic AI help + feedback coach (OpenCode)."""
    import auth_service
    import assistant as ll_assistant

    user = _require_user(request)
    try:
        payload = await request.json()
    except Exception as exc:
        raise HTTPException(400, "Invalid JSON") from exc
    messages = payload.get("messages") or []
    if not isinstance(messages, list):
        raise HTTPException(400, "messages must be a list")
    result = ll_assistant.chat(
        messages=messages,
        user=auth_service.public_user(user),
        page_url=str(payload.get("page_url") or ""),
    )
    # Persist Q&A for admin review (best-effort)
    try:
        last_user = ""
        for m in reversed(messages if isinstance(messages, list) else []):
            if isinstance(m, dict) and (m.get("role") or "") == "user":
                last_user = str(m.get("content") or "")
                break
        if last_user:
            auth_service.save_assistant_turn(
                user_id=user.get("id"),
                user_message=last_user,
                assistant_reply=str(result.get("reply") or ""),
                page_url=str(payload.get("page_url") or ""),
                conversation_id=str(payload.get("conversation_id") or ""),
                ok=bool(result.get("ok")),
                model=str(result.get("model") or ""),
            )
    except Exception:
        logger.exception("Assistant turn persist failed")
    # Auto-file feedback if model emitted a draft and client asked to commit
    if payload.get("file_feedback") and result.get("feedback_draft"):
        draft = result["feedback_draft"]
        try:
            filed = auth_service.save_feedback(
                message=draft.get("message") or "",
                category=draft.get("category") or "other",
                email=user.get("email") or "",
                user_id=user.get("id"),
                page_url=str(payload.get("page_url") or ""),
                user_agent=request.headers.get("user-agent") or "",
            )
            result["feedback_filed"] = filed
            try:
                import mailer

                mailer.send_feedback_notice({
                    "category": draft.get("category"),
                    "email": user.get("email"),
                    "user_id": user.get("id"),
                    "page_url": payload.get("page_url"),
                    "message": draft.get("message"),
                })
            except Exception:
                logger.exception("Assistant feedback email failed")
        except ValueError as exc:
            result["feedback_error"] = str(exc)
    return JSONResponse(result)


def _refresh_sample_html(run_dir: Path, *, force: bool = False) -> bool:
    """Re-bake sample presentation.html + deck.html from saved JSON using current templates.

    Returns True when the HTML files were rewritten.
    """
    json_path = run_dir / "presentation.json"
    html_path = run_dir / "presentation.html"
    if not json_path.exists():
        return False
    try:
        # Skip rewrite when sample already has the current UI markers
        if not force and html_path.exists():
            existing = html_path.read_text(encoding="utf-8", errors="ignore")
            deck_existing = ""
            deck_path = run_dir / "deck.html"
            if deck_path.exists():
                deck_existing = deck_path.read_text(encoding="utf-8", errors="ignore")
            if (
                "btnSortUsed" in existing
                and "fulldata-body" in existing
                and "In comps · remove" in existing
                and "btnPrintLeavebehind" in existing
                and "listlogic-logo.png" in existing
                and "print-page-spine" in existing
                and "print-fit-v7" in existing
                and "demo-ui-snappy" in existing
                and "RUN_ID === 'sample-2845'" in existing
                and "charts failed to boot" in existing
                and "/saas/vendor/chart.umd.min.js" in existing
                and "mapboxgl" in existing
                and "MAPBOX_TOKEN" in existing
                and "map-hover-tip" in existing
                and "mapKindVisible" in existing
                and "spine-net" in existing
                and "netSellerFeePct" in existing
                and "netSellingVal" in existing
                and "spine-prices" in existing
                and "spine-timing" in existing
                and "md-panel" in existing
                and "md-talk" in existing
                and "match-badge" in existing
                and "sectionsModal" in existing
                and "ll-shown" in existing
                and "comps-grid-8" in deck_existing
                and "market-layout" in deck_existing
                and "6 · Pace" in deck_existing
                and "6b · Prices" in deck_existing
                and "6c · Timing" in deck_existing
                and "data-deck-spine=\"v7\"" in deck_existing
                and "fitBodies" in deck_existing
                and "pulseBlock" in existing
                and "portal-chip" in existing
                and "pulseMail" in existing
            ):
                return False
        report = json.loads(json_path.read_text(encoding="utf-8"))
        _save_html(report, html_path)
        # Keep root/latest mirrors in sync for /presentation.html and /deck.html
        try:
            latest = ROOT / "output" / "presentation.html"
            latest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(html_path, latest)
            shutil.copyfile(html_path, ROOT / "presentation.html")
            deck_src = run_dir / "deck.html"
            if deck_src.exists():
                shutil.copyfile(deck_src, ROOT / "output" / "deck.html")
                shutil.copyfile(deck_src, ROOT / "deck.html")
            shutil.copyfile(json_path, ROOT / "output" / "presentation.json")
        except Exception:
            logger.exception("Sample HTML mirror copy failed for %s", run_dir.name)
        logger.info("Refreshed sample presentation + deck HTML for %s", run_dir.name)
        return True
    except Exception:
        logger.exception("Failed refreshing sample HTML for %s", run_dir.name)
        return False


def _refresh_sample_pdfs(report: dict, run_dir: Path) -> None:
    """Re-bake sample PDFs so the demo always matches the latest packet design."""
    try:
        from pdf_export import build_pdf, build_story_pdf
        meta = report.get("meta") or {}
        agent_name = meta.get("agent_name") or "Your Agent"
        brokerage = meta.get("brokerage") or ""
        build_pdf(report, run_dir / "presentation.pdf", agent_name=agent_name, brokerage=brokerage)
        build_story_pdf(report, run_dir / "story.pdf", agent_name=agent_name, brokerage=brokerage)
        logger.info("Refreshed sample PDFs for %s", run_dir.name)
    except Exception:
        logger.exception("Failed refreshing sample PDFs for %s", run_dir.name)


def _rewrite_run_paths(run_dir: Path, old_id: str, new_id: str) -> None:
    """Point baked HTML/JSON photo URLs at the stable sample run id after rename."""
    if not old_id or old_id == new_id or not run_dir.exists():
        return
    needle = f"/runs/{old_id}/"
    repl = f"/runs/{new_id}/"
    for path in run_dir.rglob("*"):
        if not path.is_file() or path.suffix.lower() not in {".html", ".json", ".js", ".css", ".txt"}:
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except OSError:
            continue
        if needle not in text:
            continue
        path.write_text(text.replace(needle, repl), encoding="utf-8")


def _repair_sample_run_paths(run_dir: Path) -> bool:
    """Fix sample HTML that still references a pre-rename /runs/{timestamp-uuid}/ path."""
    html_path = run_dir / "presentation.html"
    if not html_path.exists():
        return False
    try:
        text = html_path.read_text(encoding="utf-8")
    except OSError:
        return False
    old_ids = set(re.findall(r"/runs/([A-Za-z0-9_-]{6,120})/", text))
    old_ids.discard(SAMPLE_RUN_ID)
    if not old_ids:
        return False
    for old_id in old_ids:
        _rewrite_run_paths(run_dir, old_id, SAMPLE_RUN_ID)
    return True


def _seed_sample_launch_files(run_dir: Path) -> bool:
    """Lock pulse + optional Zestimate so public /demo shows the new story.

    Returns True when presentation.json changed (caller should rebake HTML).
    """
    json_path = run_dir / "presentation.json"
    report = _read_json_file(json_path, {}) or {}
    if not report:
        return False
    json_changed = False
    meta = report.setdefault("meta", {})
    pv = meta.get("portal_values") if isinstance(meta.get("portal_values"), dict) else None
    if not (pv and pv.get("amount")):
        try:
            from portal_market import lookup_zestimate

            addr = (
                (report.get("subject") or {}).get("address")
                if isinstance(report.get("subject"), dict)
                else ""
            ) or "2845 W 13th Street Greeley 80634"
            portal_values = lookup_zestimate(str(addr))
            if portal_values:
                meta["portal_values"] = portal_values
                json_path.write_text(json.dumps(report, indent=2, default=str), encoding="utf-8")
                json_changed = True
        except Exception:
            logger.info("Sample Zestimate seed skipped")
    try:
        _seed_sample_fingerprint(run_dir, report)
    except Exception:
        logger.exception("Sample Market Fingerprint seed skipped")
    edits_path = run_dir / "edits.json"
    edits = _read_json_file(edits_path, {}) or {}
    if not isinstance(edits, dict):
        edits = {}
    changed = False
    if edits.get("portalChip") != "on":
        edits["portalChip"] = "on"
        changed = True
    if edits.get("pulseBlock") != "on":
        edits["pulseBlock"] = "on"
        changed = True
    if changed:
        edits_path.write_text(json.dumps(edits, indent=2), encoding="utf-8")
    return json_changed


def _ensure_sample_run() -> str:
    """Build or reuse the public sample listing run (no trial credit)."""
    run_dir = OUTPUT_DIR / SAMPLE_RUN_ID
    html_path = run_dir / "presentation.html"
    if html_path.exists():
        _repair_sample_run_paths(run_dir)
        json_changed = _seed_sample_launch_files(run_dir)
        html_refreshed = _refresh_sample_html(run_dir, force=json_changed)
        # Sample photos must be volume-local, not expiring CDN links.
        try:
            remote, missing = _run_photo_health(run_dir)
            snap = _read_json_file(run_dir / "pulse_snapshot.json")
            need_fp = _fingerprint_needs_photos(snap, _load_photo_map(run_dir))
            if remote:
                _start_rehost(SAMPLE_RUN_ID, run_dir)
            elif missing or need_fp:
                _start_background_photos(SAMPLE_RUN_ID, run_dir)
            elif _load_photo_map(run_dir):
                _write_photos_status(run_dir, status="ready", message="")
        except Exception:
            logger.exception("Sample photo health check failed")
        # PDFs are expensive — only rebuild when HTML template changed or files missing.
        pdf_path = run_dir / "presentation.pdf"
        story_path = run_dir / "story.pdf"
        need_pdfs = html_refreshed or not pdf_path.exists() or not story_path.exists()
        if need_pdfs:
            try:
                json_path = run_dir / "presentation.json"
                if json_path.exists():
                    report = json.loads(json_path.read_text(encoding="utf-8"))
                    _refresh_sample_pdfs(report, run_dir)
            except Exception:
                logger.exception("Sample PDF sync failed for %s", run_dir.name)
        return SAMPLE_RUN_ID
    if not DEMO_EXPORT.exists():
        raise HTTPException(404, "Sample export missing")
    result = _generate(
        DEMO_EXPORT,
        address="2845 W 13th Street Greeley 80634",
        living_area=2392.0,
        beds=4.0,
        baths=2.0,
        garage_spaces=2.0,
        year_built=1969,
        condition="average",
        list_price=None,
        mls_number="1058539",
        city_filter="Greeley",
        area_name="West Greeley · similar homes",
        market_notes="Public sample listing — create an account to run your own market; unlock at Generate.",
        agent_name="Adam Schwartz",
        agent_phone="(970) 533-3990",
        agent_email="adam@saahomes.com",
        brokerage="Schwartz and Associates, Coldwell Banker Realty",
        brand_primary="#0c3c6e",
        brand_accent="#1a5f9e",
        logo_url="",
        force_run_id=SAMPLE_RUN_ID,
    )
    # Normalize in case generate returned a different id
    if result.get("run_id") != SAMPLE_RUN_ID:
        src = OUTPUT_DIR / result["run_id"]
        if src.exists() and src.resolve() != run_dir.resolve():
            if run_dir.exists():
                shutil.rmtree(run_dir, ignore_errors=True)
            src.rename(run_dir)
            _rewrite_run_paths(run_dir, result["run_id"], SAMPLE_RUN_ID)
    _seed_sample_launch_files(run_dir)
    return SAMPLE_RUN_ID


@app.get("/demo")
def demo_redirect():
    run_id = _ensure_sample_run()
    return RedirectResponse(url=f"/runs/{run_id}/?sample=1", status_code=302)


@app.get("/demo/fingerprint")
@app.get("/demo/fingerprint/")
def demo_fingerprint_redirect():
    run_id = _ensure_sample_run()
    return RedirectResponse(url=f"/runs/{run_id}/fingerprint/?sample=1", status_code=302)


@app.get("/api/demo")
def api_demo():
    run_id = _ensure_sample_run()
    return {
        "ok": True,
        "run_id": run_id,
        "url": f"/runs/{run_id}/?sample=1",
        "fingerprint_url": f"/runs/{run_id}/fingerprint/?sample=1",
        "sample": True,
    }


@app.get("/invite/{token}")
def invite_redirect(token: str):
    return RedirectResponse(url=f"/saas/signup.html?invite={token}", status_code=302)


# —— Admin APIs ——

@app.get("/api/admin/users")
def admin_users(request: Request, q: str = ""):
    import auth_service

    _require_admin(request)
    return {"users": auth_service.list_users(q=q)}


@app.get("/api/admin/presentations")
def admin_presentations(request: Request, q: str = ""):
    import auth_service

    _require_admin(request)
    return {"presentations": auth_service.list_all_presentations(q=q)}


@app.get("/api/admin/stats")
def admin_stats(request: Request):
    import auth_service

    _require_admin(request)
    return {"stats": auth_service.admin_stats()}


@app.get("/api/admin/shared-accounts")
def admin_shared_accounts(request: Request, days: int = 7, min_ips: int = 3):
    """Accounts active from 3+ distinct IPs in the window — possible credential sharing."""
    import auth_service

    _require_admin(request)
    return {"ok": True, "flagged": auth_service.list_shared_account_flags(days=days, min_ips=min_ips)}


@app.get("/api/admin/subscriptions")
def admin_subscriptions(request: Request):
    import auth_service

    _require_admin(request)
    return auth_service.list_subscriptions()


@app.get("/api/admin/billing-live")
def admin_billing_live(request: Request):
    """Live Stripe pull: subscription status, last payment, next renewal per user."""
    import auth_service
    import stripe_billing

    _require_admin(request)
    if not stripe_billing.stripe_configured():
        return {"configured": False, "snapshots": {}, "totals": {}}
    subs = auth_service.list_subscriptions().get("subscriptions", [])
    snapshots: dict[str, dict] = {}
    mrr = 0.0
    active_subs = 0
    past_due = 0
    for s in subs:
        user = s.get("user") or {}
        if not user.get("has_stripe"):
            continue
        snap = stripe_billing.subscription_snapshot(user)
        if not snap:
            continue
        snapshots[user["id"]] = snap
        status = snap.get("subscription_status") or ""
        if status in ("active", "trialing"):
            active_subs += 1
            mrr += float(snap.get("monthly_amount") or 0)
        elif status == "past_due":
            past_due += 1
    return {
        "configured": True,
        "snapshots": snapshots,
        "totals": {"mrr": round(mrr, 2), "active_subs": active_subs, "past_due": past_due},
    }


@app.post("/api/internal/owner-digest")
def owner_digest(request: Request):
    """Cron/manual: email Adam the weekly revenue + activity digest."""
    import auth_service
    import mailer

    secret = (os.environ.get("CRON_SECRET") or os.environ.get("SESSION_SECRET") or "").strip()
    hdr = (request.headers.get("X-Cron-Secret") or "").strip()
    force = (request.headers.get("X-Digest-Force") or "").strip() == "1"
    if secret and hdr != secret:
        user = _current_user(request)
        if not user or (user.get("role") or "") != "admin":
            raise HTTPException(401, "Unauthorized")
        force = True  # admin clicking the button always sends

    if not force and auth_service.recent_event_exists("owner_digest_email", within_hours=144):
        return {"ok": True, "skipped": "digest already sent this week"}

    stats = auth_service.admin_stats()
    billing = auth_service.list_subscriptions().get("summary", {})
    past_due = auth_service.list_past_due_users(days=30)
    new_users = auth_service.list_recent_signups(days=7)

    stripe_actual = None
    try:
        live = admin_billing_live(request)
        if live.get("configured"):
            t = live.get("totals") or {}
            stripe_actual = {"mrr": t.get("mrr", 0), "active_subs": t.get("active_subs", 0), "past_due": t.get("past_due", 0)}
    except Exception:
        logger.exception("Owner digest: live Stripe totals failed")

    sent = mailer.send_owner_digest({
        "stats": stats,
        "billing": billing,
        "past_due": past_due,
        "new_users": new_users,
        "stripe_actual": stripe_actual,
        "admin_url": auth_service.app_base_url() + "/saas/admin.html",
    })
    auth_service.log_event(None, "owner_digest_email", {"sent": bool(sent), "paying": billing.get("paying", 0)})
    return {"ok": True, "sent": bool(sent), "paying": billing.get("paying", 0)}


@app.get("/api/admin/assistant-chats")
def admin_assistant_chats(request: Request, q: str = ""):
    import auth_service

    _require_admin(request)
    return {"turns": auth_service.list_assistant_turns(q=q)}


@app.get("/api/admin/events")
def admin_events(request: Request, q: str = "", type: str = ""):
    import auth_service

    _require_admin(request)
    return {"events": auth_service.list_events(q=q, event_type=type)}


@app.get("/api/admin/users/{user_id}")
def admin_user_detail(user_id: str, request: Request):
    import auth_service

    _require_admin(request)
    detail = auth_service.admin_user_detail(user_id)
    if not detail:
        raise HTTPException(404, "User not found")
    return detail


@app.post("/api/admin/users/{user_id}")
async def admin_user_update(user_id: str, request: Request):
    import auth_service

    _require_admin(request)
    payload = await request.json()
    clear_limit = bool(payload.get("clear_limit")) or (
        "presentation_limit" in payload and payload.get("presentation_limit") is None and payload.get("status") == "active"
    )
    kwargs = {
        "status": payload.get("status"),
        "extend_days": payload.get("extend_days"),
        "presentations_used": payload.get("presentations_used"),
    }
    if clear_limit:
        import db as database
        from auth_service import _iso
        database.execute(
            "UPDATE users SET presentation_limit = NULL, status = COALESCE(?, status), updated_at = ? WHERE id = ?",
            (payload.get("status"), _iso(), user_id),
        )
        user = auth_service.public_user(auth_service.get_user_by_id(user_id))
    else:
        if payload.get("presentation_limit") is not None:
            kwargs["presentation_limit"] = payload.get("presentation_limit")
        user = auth_service.admin_update_user(user_id, **kwargs)
    if not user:
        raise HTTPException(404, "User not found")
    return {"ok": True, "user": user}


@app.get("/api/admin/promo-codes")
def admin_promo_list(request: Request):
    import auth_service

    _require_admin(request)
    return {"promo_codes": auth_service.list_promo_codes()}


@app.post("/api/admin/promo-codes")
async def admin_promo_create(request: Request):
    import auth_service

    _require_admin(request)
    payload = await request.json()
    try:
        unlimited = bool(payload.get("unlimited")) or str(payload.get("presentation_limit") or "").strip().lower() in (
            "-1",
            "unlimited",
        )
        if unlimited:
            limit = auth_service.UNLIMITED_PROMO_SENTINEL
            trial_days = int(payload.get("trial_days") or 0)
        elif payload.get("presentation_limit") is not None:
            limit = int(payload.get("presentation_limit"))
            trial_days = int(
                payload.get("trial_days")
                if payload.get("trial_days") is not None
                else auth_service.default_trial_days()
            )
        else:
            limit = auth_service.default_presentation_limit()
            trial_days = int(
                payload.get("trial_days")
                if payload.get("trial_days") is not None
                else auth_service.default_trial_days()
            )
        row = auth_service.create_promo_code(
            code=str(payload.get("code") or ""),
            label=str(payload.get("label") or ""),
            trial_days=trial_days,
            presentation_limit=limit,
            max_redemptions=payload.get("max_redemptions"),
            notes=str(payload.get("notes") or ""),
        )
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    return {"ok": True, "promo": row}


@app.post("/api/admin/promo-codes/{promo_id}/active")
async def admin_promo_active(promo_id: str, request: Request):
    import auth_service

    _require_admin(request)
    payload = await request.json()
    auth_service.set_promo_active(promo_id, bool(payload.get("active")))
    return {"ok": True}


@app.get("/api/admin/invites")
def admin_invites(request: Request):
    import auth_service

    _require_admin(request)
    return {"invites": auth_service.list_invites()}


@app.post("/api/admin/invites")
async def admin_invite_create(request: Request):
    import auth_service

    admin = _require_admin(request)
    payload = await request.json()
    row = auth_service.create_invite(
        email=str(payload.get("email") or ""),
        trial_days=int(payload.get("trial_days") or auth_service.default_trial_days()),
        presentation_limit=int(
            payload.get("presentation_limit")
            if payload.get("presentation_limit") is not None
            else auth_service.default_presentation_limit()
        ),
        brokerage=str(payload.get("brokerage") or ""),
        max_uses=int(payload.get("max_uses") or 1),
        expires_days=int(payload.get("expires_days") or 30),
        created_by=admin["id"],
    )
    return {"ok": True, "invite": row}


@app.get("/api/admin/feedback")
def admin_feedback(request: Request, status: str = "", category: str = ""):
    import auth_service

    _require_admin(request)
    return {"feedback": auth_service.list_feedback(status=status, category=category)}


@app.post("/api/admin/feedback/{feedback_id}")
async def admin_feedback_update(feedback_id: str, request: Request):
    import auth_service

    _require_admin(request)
    payload = await request.json()
    try:
        auth_service.set_feedback_status(feedback_id, str(payload.get("status") or "seen"))
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    return {"ok": True}


@app.post("/api/internal/trial-reminders")
def trial_reminders(request: Request):
    """Cron/manual: send 7-day reminders and expire past-due trials."""
    import auth_service
    import mailer

    secret = (os.environ.get("CRON_SECRET") or os.environ.get("SESSION_SECRET") or "").strip()
    hdr = (request.headers.get("X-Cron-Secret") or "").strip()
    # Allow local/admin without secret when none configured
    if secret and hdr != secret:
        user = _current_user(request)
        if not user or (user.get("role") or "") != "admin":
            raise HTTPException(401, "Unauthorized")

    base = auth_service.app_base_url()
    reminded = 0
    expired = 0
    for user in auth_service.users_needing_trial_reminder(7):
        if auth_service.event_already_sent(user["id"], "trial_reminder_email"):
            continue
        mailer.send_trial_reminder(user, base)
        auth_service.log_event(user["id"], "trial_reminder_email", {})
        reminded += 1
    for user in auth_service.users_newly_expired():
        if auth_service.event_already_sent(user["id"], "trial_expired_email"):
            continue
        mailer.send_trial_expired(user, base)
        auth_service.log_event(user["id"], "trial_expired_email", {})
        expired += 1
    return {"ok": True, "reminded": reminded, "expired": expired}


@app.get("/presentation.html")
def demo_presentation(request: Request):
    path = ROOT / "presentation.html"
    if not path.exists():
        raise HTTPException(404, "No presentation yet — generate one from /saas/app.html")
    return FileResponse(path, media_type="text/html")


@app.get("/deck.html")
def demo_deck(request: Request):
    path = ROOT / "deck.html"
    if not path.exists():
        path = ROOT / "output" / "deck.html"
    if not path.exists():
        raise HTTPException(404, "No deck yet — generate a presentation first")
    return FileResponse(path, media_type="text/html")


_PRESENTATION_MARKERS = (
    "mapboxgl",
    "map-hover-tip",
    "mapKindVisible",
    "data-map-filters",
    "spine-net",
    "netSellerFeePct",
    "match-badge",
    "sectionsModal",
    "ll-shown",
    "MAPBOX_TOKEN",
    "print-fit-v2",
    "demo-ui-snappy",
    "sample-demo-bar",
    "charts failed to boot",
    "/saas/vendor/chart.umd.min.js",
)


def _rebake_if_stale(run_id: str, html_path: Path) -> Path:
    """Re-bake baked presentation HTML when it predates the current template
    (old map tiles, pre-filter map, etc.). Falls back to the existing file."""
    json_path = html_path.parent / "presentation.json"
    if not json_path.exists():
        return html_path
    try:
        text = html_path.read_text(encoding="utf-8", errors="ignore")
    except OSError:
        return html_path
    if all(marker in text for marker in _PRESENTATION_MARKERS):
        return html_path
    try:
        report = json.loads(json_path.read_text(encoding="utf-8"))
        _save_html(report, html_path)
        logger.info("Rebaked stale presentation HTML for %s", run_id)
    except Exception:
        logger.exception("Stale rebake failed for %s", run_id)
    return html_path


@app.get("/runs/{run_id}/")
def view_run(run_id: str):
    run_id = _safe_run_id(run_id)
    path = OUTPUT_DIR / run_id / "presentation.html"
    if not path.exists():
        path = _hydrate_run_from_db(run_id) or path
    if not path.exists():
        return _missing_run_page(run_id)
    path = _rebake_if_stale(run_id, path)
    return FileResponse(path, media_type="text/html")


def _fingerprint_view_payload(run_dir: Path) -> dict:
    report = _read_json_file(run_dir / "presentation.json", {}) or {}
    try:
        if run_dir.name == SAMPLE_RUN_ID:
            _seed_sample_fingerprint(run_dir, report)
        else:
            _ensure_fingerprint_files(run_dir, report)
    except Exception:
        logger.exception("Fingerprint files missing for %s", run_dir.name)
    lock = _read_json_file(run_dir / "pulse.json")
    if isinstance(lock, dict) and lock.get("locked_price"):
        meta = report.get("meta") if isinstance(report.get("meta"), dict) else {}
        needs_upload = str(meta.get("data_source") or "") == "mls_export" and not meta.get("portal_criteria")
        stale = bool(needs_upload and _snapshot_age_days(_read_json_file(run_dir / "pulse_snapshot.json")) >= 6)
        try:
            _save_pulse_brief(run_dir, report, lock, stale_upload=stale)
        except Exception:
            logger.exception("Fingerprint brief rebuild failed for %s", run_dir.name)
    payload = _pulse_payload(run_dir, report)
    payload["report"] = {
        "subject": report.get("subject") if isinstance(report.get("subject"), dict) else {},
    }
    payload["stale_upload"] = bool(
        (payload.get("brief") or {}).get("stale_upload")
        or (payload.get("needs_upload") and _snapshot_age_days(payload.get("snapshot")) >= 6)
    )
    payload["agent_name"] = str((report.get("meta") or {}).get("agent_name") or "")
    try:
        snap = payload.get("snapshot") or _read_json_file(run_dir / "pulse_snapshot.json")
        from reef_photos import reef_enabled
        if reef_enabled() and _fingerprint_needs_photos(snap, _load_photo_map(run_dir)):
            _start_background_photos(run_dir.name, run_dir)
            payload["photos_fetching"] = True
    except Exception:
        logger.exception("Fingerprint photo fetch start failed for %s", run_dir.name)
    return payload


def _fingerprint_html_response(run_dir: Path, *, agent: bool) -> HTMLResponse:
    import fingerprint_html

    view = _fingerprint_view_payload(run_dir)
    html = fingerprint_html.render_fingerprint_html(view, agent=agent)
    if agent and run_dir.name != SAMPLE_RUN_ID:
        _touch_fingerprint_looked(run_dir)
    return HTMLResponse(html)


def _seller_access_on(run_dir: Path) -> bool:
    lock = _read_json_file(run_dir / "pulse.json", {}) or {}
    return lock.get("seller_access", True) is not False


@app.get("/runs/{run_id}/fingerprint")
@app.get("/runs/{run_id}/fingerprint/")
def view_run_fingerprint(run_id: str, request: Request):
    run_id = _safe_run_id(run_id)
    run_dir = OUTPUT_DIR / run_id
    if not (run_dir / "presentation.json").exists():
        path = _hydrate_run_from_db(run_id)
        run_dir = path.parent if path else run_dir
    if not (run_dir / "presentation.json").exists():
        raise HTTPException(404, "Fingerprint not found")
    agent = False
    if run_id == SAMPLE_RUN_ID:
        agent = False
    else:
        try:
            _require_run_owner(request, run_id)
            agent = True
        except HTTPException:
            if not _seller_access_on(run_dir):
                return HTMLResponse(
                    "<!doctype html><html><body style='font-family:system-ui;padding:2rem'>"
                    "<p>This Market Fingerprint is private.</p></body></html>",
                    status_code=403,
                )
            agent = False
    return _fingerprint_html_response(run_dir, agent=agent)


@app.get("/p/{share_token}/fingerprint")
@app.get("/p/{share_token}/fingerprint/")
def view_shared_fingerprint(share_token: str, request: Request):
    import auth_service

    token = (share_token or "").strip()
    if not re.fullmatch(r"[A-Za-z0-9_-]{6,64}", token):
        raise HTTPException(404, "Share link not found")
    row = auth_service.get_presentation_by_share_token(token)
    if not row or not row.get("run_id"):
        raise HTTPException(404, "Share link not found")
    run_id = _safe_run_id(row["run_id"])
    run_dir = OUTPUT_DIR / run_id
    if not (run_dir / "presentation.json").exists():
        path = _hydrate_run_from_db(run_id)
        run_dir = path.parent if path else run_dir
    if not (run_dir / "presentation.json").exists():
        raise HTTPException(404, "Fingerprint not found")
    if not _seller_access_on(run_dir):
        return HTMLResponse(
            "<!doctype html><html><body style='font-family:system-ui;padding:2rem'>"
            "<p>This Market Fingerprint is private. Ask your agent for an updated link.</p>"
            "</body></html>",
            status_code=403,
        )
    return _fingerprint_html_response(run_dir, agent=False)


@app.get("/p/{share_token}")
@app.get("/p/{share_token}/")
def view_shared_presentation(share_token: str, request: Request):
    """Short client share link → live presentation (with rich link preview meta)."""
    import auth_service

    token = (share_token or "").strip()
    if not re.fullmatch(r"[A-Za-z0-9_-]{6,64}", token):
        raise HTTPException(404, "Share link not found")
    row = auth_service.get_presentation_by_share_token(token)
    if not row or not row.get("run_id"):
        raise HTTPException(404, "Share link not found")
    run_id = _safe_run_id(row["run_id"])
    path = OUTPUT_DIR / run_id / "presentation.html"
    if not path.exists():
        path = _hydrate_run_from_db(run_id) or path
    if not path.exists():
        return _missing_run_page(run_id)

    address = (row.get("address") or "this home").strip() or "this home"
    base = str(request.base_url).rstrip("/")
    share_url = f"{base}/p/{token}"
    target_url = f"{base}/runs/{run_id}/"
    og_image = f"{base}/saas/ll-og-share.png"

    title = f"Pricing story for {address} — ListLogic"
    desc_bits = []
    if row.get("recommended_price"):
        try:
            desc_bits.append("Recommended list " + "${:,.0f}".format(float(row["recommended_price"])))
        except (TypeError, ValueError):
            pass
    desc_bits.append("Live market position, price-vs-odds trade-offs, and the comps that prove it.")
    description = " · ".join(desc_bits)

    esc = html_lib.escape
    meta_block = f"""<meta property="og:type" content="website">
<meta property="og:site_name" content="ListLogic">
<meta property="og:url" content="{esc(share_url)}">
<meta property="og:title" content="{esc(title)}">
<meta property="og:description" content="{esc(description)}">
<meta property="og:image" content="{esc(og_image)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{esc(title)}">
<meta name="twitter:description" content="{esc(description)}">
<meta name="twitter:image" content="{esc(og_image)}">
<meta name="theme-color" content="#0c3c6e">
"""

    try:
        text = path.read_text(encoding="utf-8")
    except OSError:
        return RedirectResponse(url=f"/runs/{run_id}/", status_code=302)

    # Replace <title> and inject social meta right after <head>'s viewport meta
    text = re.sub(r"<title>[^<]*</title>", f"<title>{esc(title)}</title>", text, count=1)
    if "</head>" in text:
        text = text.replace("</head>", meta_block + "</head>", 1)
    return HTMLResponse(content=text, status_code=200)


@app.get("/api/runs/{run_id}/share")
def run_share_meta(run_id: str):
    """Public share URL for a run (used by Share with client)."""
    import auth_service

    run_id = _safe_run_id(run_id)
    try:
        row = auth_service.get_presentation_by_run(run_id)
    except Exception:
        logger.exception("Share lookup failed for %s", run_id)
        row = None
    if row:
        return JSONResponse(
            {
                "run_id": run_id,
                "share_url": row.get("share_url"),
                "url": row.get("url"),
            }
        )
    # Fallback for older runs that were never registered
    share_path = OUTPUT_DIR / run_id / "share.json"
    if share_path.exists():
        try:
            data = json.loads(share_path.read_text(encoding="utf-8"))
            token = data.get("share_token")
            if token:
                return JSONResponse(
                    {
                        "run_id": run_id,
                        "share_url": f"/p/{token}",
                        "url": f"/runs/{run_id}/",
                    }
                )
        except Exception:
            logger.exception("Failed reading share.json for %s", run_id)
    return JSONResponse({"run_id": run_id, "share_url": f"/runs/{run_id}/", "url": f"/runs/{run_id}/"})


@app.get("/api/my-presentations")
def my_presentations(request: Request):
    import auth_service

    user = _require_user(request)
    items = auth_service.list_presentations(user["id"])
    return JSONResponse({"presentations": items, "count": len(items)})


@app.delete("/api/presentations/{presentation_id}")
def delete_presentation(request: Request, presentation_id: str):
    import auth_service
    import db

    user = _require_user(request)
    # Users can only delete their own presentations; admins can delete any
    row = db.execute(
        "SELECT user_id FROM presentations WHERE id = ?",
        (presentation_id,),
        fetch="one",
    )
    if not row:
        raise HTTPException(404, "Presentation not found")
    if row["user_id"] != user["id"] and (user.get("role") or "") != "admin":
        raise HTTPException(403, "Cannot delete another user's presentation")
    db.execute("DELETE FROM presentations WHERE id = ?", (presentation_id,))
    return JSONResponse({"ok": True, "deleted": presentation_id})


@app.get("/runs/{run_id}/deck.html")
def view_run_deck(run_id: str):
    run_id = _safe_run_id(run_id)
    path = OUTPUT_DIR / run_id / "deck.html"
    if not path.exists():
        # Rebuild from presentation.json if interactive exists but deck was never saved
        json_path = OUTPUT_DIR / run_id / "presentation.json"
        if json_path.exists():
            try:
                import deck_html

                report = json.loads(json_path.read_text(encoding="utf-8"))
                deck_html.save_deck_html(report, path)
            except Exception:
                logger.exception("Failed to build deck for %s", run_id)
        if not path.exists():
            raise HTTPException(404, "Deck not found")
    return FileResponse(path, media_type="text/html")


@app.get("/runs/{run_id}/pdf")
def view_run_pdf(run_id: str):
    run_id = _safe_run_id(run_id)
    path = OUTPUT_DIR / run_id / "presentation.pdf"
    if not path.exists():
        raise HTTPException(404, "PDF not found")
    return FileResponse(
        path,
        media_type="application/pdf",
        filename=f"ListLogic-{run_id}.pdf",
    )


@app.get("/runs/{run_id}/story.pdf")
def view_run_story_pdf(run_id: str):
    run_id = _safe_run_id(run_id)
    path = OUTPUT_DIR / run_id / "story.pdf"
    if not path.exists():
        # Build on demand from saved JSON if missing
        json_path = OUTPUT_DIR / run_id / "presentation.json"
        if not json_path.exists():
            raise HTTPException(404, "Story PDF not found")
        try:
            from pdf_export import build_story_pdf
            report = json.loads(json_path.read_text(encoding="utf-8"))
            meta = report.get("meta") or {}
            build_story_pdf(
                report,
                path,
                agent_name=meta.get("agent_name") or "",
                brokerage=meta.get("brokerage") or "",
            )
        except Exception as exc:
            raise HTTPException(500, "Could not build story PDF") from exc
    return FileResponse(
        path,
        media_type="application/pdf",
        filename=f"ListLogic-story-{run_id}.pdf",
    )


def _refresh_run_story_pdf(report: dict, run_dir: Path) -> None:
    try:
        from pdf_export import build_story_pdf
        meta = report.get("meta") or {}
        build_story_pdf(
            report,
            run_dir / "story.pdf",
            agent_name=meta.get("agent_name") or "",
            brokerage=meta.get("brokerage") or "",
        )
    except Exception:
        logger.exception("story.pdf refresh failed for %s", run_dir.name)


@app.post("/api/runs/{run_id}/ai-seller-story")
def ai_seller_story(run_id: str):
    """Regenerate seller-facing bottom line + advantages + watch-outs."""
    run_id = _safe_run_id(run_id)
    run_dir = OUTPUT_DIR / run_id
    json_path = run_dir / "presentation.json"
    if not json_path.exists():
        raise HTTPException(404, "Run not found")
    try:
        report = json.loads(json_path.read_text(encoding="utf-8"))
        from llm_narrative import NarrativeEngine, regenerate_seller_story

        engine = NarrativeEngine.auto()
        report = regenerate_seller_story(report, engine)
        json_path.write_text(json.dumps(report, indent=2, default=str), encoding="utf-8")
        _refresh_run_story_pdf(report, run_dir)

        pos = report.get("positioning") or {}
        return {
            "llm_enhanced": bool(report.get("llm_enhanced")),
            "llm_provider": report.get("llm_provider"),
            "bl": report.get("executive_summary") or "",
            "adv": "\n".join(pos.get("advantages") or []),
            "risk": "\n".join(pos.get("risks") or []),
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(500, f"AI seller story failed: {exc}") from exc


@app.post("/api/runs/{run_id}/ai-coach")
def ai_coach_notes(run_id: str):
    """Regenerate private coach notes only."""
    run_id = _safe_run_id(run_id)
    run_dir = OUTPUT_DIR / run_id
    json_path = run_dir / "presentation.json"
    if not json_path.exists():
        raise HTTPException(404, "Run not found")
    try:
        report = json.loads(json_path.read_text(encoding="utf-8"))
        from llm_narrative import NarrativeEngine, regenerate_coach_notes

        engine = NarrativeEngine.auto()
        report = regenerate_coach_notes(report, engine)
        json_path.write_text(json.dumps(report, indent=2, default=str), encoding="utf-8")

        cards = (report.get("story") or {}).get("objection_cards") or []
        obj_lines = []
        for c in cards:
            title = str(c.get("title") or "").replace("|", "/")
            body = str(c.get("body") or "").replace("|", "/")
            obj_lines.append(f"{title}|{body}")
        return {
            "llm_enhanced": bool(report.get("llm_enhanced")),
            "llm_provider": report.get("llm_provider"),
            "obj": "\n".join(obj_lines),
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(500, f"AI coach failed: {exc}") from exc


@app.get("/runs/{run_id}/json")
def view_run_json(run_id: str):
    run_id = _safe_run_id(run_id)
    path = OUTPUT_DIR / run_id / "presentation.json"
    if not path.exists():
        raise HTTPException(404, "Run not found")
    return FileResponse(path, media_type="application/json")


def _read_json_file(path: Path, default=None):
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default


def _require_run_owner(request: Request, run_id: str) -> dict:
    user = _require_user(request)
    if (user.get("role") or "") == "admin":
        return user
    share = _read_json_file(OUTPUT_DIR / run_id / "share.json", {}) or {}
    if str(share.get("user_id") or "") == str(user.get("id") or ""):
        return user
    try:
        import auth_service

        row = auth_service.get_presentation_by_run(run_id)
        if row and str(row.get("user_id") or "") == str(user.get("id") or ""):
            return user
    except Exception:
        logger.exception("Run owner lookup failed for %s", run_id)
    raise HTTPException(403, "Not your report")


def _load_run_market(run_dir: Path):
    path = run_dir / "market.csv"
    if not path.exists() and run_dir.name == SAMPLE_RUN_ID and DEMO_EXPORT.exists():
        try:
            from core import load_export

            df = load_export(DEMO_EXPORT)
            path.parent.mkdir(parents=True, exist_ok=True)
            df.to_csv(path, sep="|", index=False)
            logger.info("Wrote sample market.csv from demo export (%s rows)", len(df))
            return df
        except Exception:
            logger.exception("Failed to load demo export for sample market")
            return None
    if not path.exists():
        return None
    try:
        import pandas as pd
        from market_schema import normalize_market_frame

        df = pd.read_csv(path, sep="|", low_memory=False)
        if "StatusNorm" in df.columns and "Price" in df.columns:
            return normalize_market_frame(df, source="saved")
        from core import load_export

        return load_export(path)
    except Exception:
        try:
            from core import load_export

            return load_export(path)
        except Exception:
            logger.exception("Failed to load market.csv from %s", run_dir)
            return None


def _write_pulse_lock(run_dir: Path, report: dict, *, price=None, source: str = "recommended") -> Optional[dict]:
    pos = report.get("positioning") or {}
    subject = report.get("subject") or {}
    meta = report.get("meta") or {}
    existing = _read_json_file(run_dir / "pulse.json", {}) or {}
    try:
        locked_price = float(price if price not in (None, "") else pos.get("recommended_price") or 0)
    except (TypeError, ValueError):
        locked_price = 0
    if locked_price <= 0:
        return None
    try:
        subject_sqft = float(subject.get("living_area") or existing.get("subject_sqft") or 0)
    except (TypeError, ValueError):
        subject_sqft = 0
    payload = {
        "locked_price": int(round(locked_price)),
        "locked_at": datetime.now().isoformat(timespec="seconds"),
        "subject_sqft": subject_sqft,
        "market_label": meta.get("market_label") or report.get("area") or "",
        "source": source,
        "seller_access": existing.get("seller_access", True) is not False,
    }
    for key in ("email", "seller_name", "seller_email", "sold_at", "last_refresh_at", "last_looked_at", "active_at", "active_at_source"):
        if existing.get(key) not in (None, ""):
            payload[key] = existing[key]
    (run_dir / "pulse.json").write_text(json.dumps(payload, indent=2), encoding="utf-8")
    df = _load_run_market(run_dir)
    if df is not None:
        _write_fingerprint_snapshot(run_dir, report, payload, df)
    else:
        _save_pulse_brief(run_dir, report, payload)
    return payload


def _clock_baseline(run_dir: Path, lock: dict | None) -> dict | None:
    from core import fingerprint_clock

    clock = fingerprint_clock(lock)
    if clock.get("clock") == "active":
        active = _read_json_file(run_dir / "fingerprint_active_baseline.json")
        if isinstance(active, dict) and (active.get("listings") or active.get("ids")):
            return active
    generate = _read_json_file(run_dir / "fingerprint_baseline.json")
    return generate if isinstance(generate, dict) else None


def _ensure_active_baseline(run_dir: Path, report: dict, lock: dict, df=None) -> dict | None:
    from core import _fingerprint_date, reconstruct_fingerprint_baseline

    active_at = _fingerprint_date((lock or {}).get("active_at"))
    if not active_at:
        return None
    path = run_dir / "fingerprint_active_baseline.json"
    existing = _read_json_file(path)
    if (
        isinstance(existing, dict)
        and str(existing.get("as_of") or "")[:10] == active_at
        and (existing.get("listings") or existing.get("ids"))
    ):
        return existing
    generate = _read_json_file(run_dir / "fingerprint_baseline.json")
    if (
        df is None
        and isinstance(generate, dict)
        and str(generate.get("as_of") or "")[:10] == active_at
        and (generate.get("listings") or generate.get("ids"))
    ):
        path.write_text(json.dumps(generate, indent=2, default=str), encoding="utf-8")
        return generate
    if df is None or len(df) == 0:
        return existing if isinstance(existing, dict) else None
    subject = report.get("subject") if isinstance(report.get("subject"), dict) else {}
    try:
        locked_price = float((lock or {}).get("locked_price") or 0)
    except (TypeError, ValueError):
        locked_price = 0
    try:
        subject_sqft = float((lock or {}).get("subject_sqft") or subject.get("living_area") or 0)
    except (TypeError, ValueError):
        subject_sqft = 0
    baseline = reconstruct_fingerprint_baseline(
        df,
        locked_price,
        subject_sqft,
        as_of=active_at,
        photo_map=_load_photo_map(run_dir),
        gallery_map=_load_gallery_map(run_dir),
    )
    path.write_text(json.dumps(baseline, indent=2, default=str), encoding="utf-8")
    return baseline


def _apply_active_at(run_dir: Path, lock: dict | None, report: dict, df=None, snap=None) -> dict:
    from core import detect_subject_active_at

    lock = dict(lock) if isinstance(lock, dict) else {}
    source = str(lock.get("active_at_source") or "")
    if source not in ("agent", "sample"):
        subject = report.get("subject") if isinstance(report.get("subject"), dict) else {}
        found = ""
        if df is not None:
            found = detect_subject_active_at(df, subject)
        if not found and snap is not None:
            found = detect_subject_active_at(snap, subject)
        if found:
            lock["active_at"] = found
            lock["active_at_source"] = "detected"
    _ensure_active_baseline(run_dir, report, lock, df)
    return lock


def _write_fingerprint_snapshot(run_dir: Path, report: dict, lock: dict, df, *, rotate_prev: bool = False) -> dict:
    from core import (
        append_fingerprint_history,
        build_pulse_snapshot,
        digest_pulse,
        fingerprint_sold_from_df,
        freeze_fingerprint_baseline,
        merge_fingerprint_ledger,
    )

    locked_price = float(lock.get("locked_price") or 0)
    subject_sqft = float(lock.get("subject_sqft") or 0)
    photo_map = _load_photo_map(run_dir)
    gallery_map = _load_gallery_map(run_dir)
    snap = build_pulse_snapshot(
        df,
        locked_price,
        subject_sqft,
        photo_map=photo_map,
        gallery_map=gallery_map,
    )
    prev_path = run_dir / "pulse_snapshot.json"
    if rotate_prev and prev_path.exists():
        try:
            shutil.copyfile(prev_path, run_dir / "pulse_snapshot_prev.json")
        except OSError:
            logger.exception("Failed to keep previous fingerprint snapshot")
    (run_dir / "pulse_snapshot.json").write_text(
        json.dumps(snap, indent=2, default=str),
        encoding="utf-8",
    )
    baseline_path = run_dir / "fingerprint_baseline.json"
    baseline = _read_json_file(baseline_path)
    if not isinstance(baseline, dict) or not (baseline.get("listings") or baseline.get("ids")):
        baseline = freeze_fingerprint_baseline(snap)
        baseline_path.write_text(json.dumps(baseline, indent=2, default=str), encoding="utf-8")
    lock = _apply_active_at(run_dir, lock, report, df=df, snap=snap)
    clock_base = _clock_baseline(run_dir, lock) or baseline
    baseline_ids = {str(x) for x in (baseline.get("ids") or []) if x}
    clock_ids = {str(x) for x in ((clock_base or {}).get("ids") or []) if x}
    sold_map = fingerprint_sold_from_df(df, baseline_ids | clock_ids)
    ledger = merge_fingerprint_ledger(
        _read_json_file(run_dir / "fingerprint_ledger.json"),
        snap,
        baseline=baseline,
        sold_map=sold_map,
        as_of=snap.get("as_of"),
    )
    (run_dir / "fingerprint_ledger.json").write_text(
        json.dumps(ledger, indent=2, default=str),
        encoding="utf-8",
    )
    prev = _read_json_file(run_dir / "pulse_snapshot_prev.json")
    subject = report.get("subject") if isinstance(report.get("subject"), dict) else {}
    digest = digest_pulse(snap, lock, prev, baseline=clock_base, ledger=ledger, subject=subject)
    history = append_fingerprint_history(
        _read_json_file(run_dir / "fingerprint_history.json", []),
        snap,
        digest,
    )
    (run_dir / "fingerprint_history.json").write_text(
        json.dumps(history, indent=2, default=str),
        encoding="utf-8",
    )
    lock["last_refresh_at"] = datetime.now().isoformat(timespec="seconds")
    (run_dir / "pulse.json").write_text(json.dumps(lock, indent=2), encoding="utf-8")
    _save_pulse_brief(run_dir, report, lock, snap)
    return snap


def _fingerprint_snapshot_empty(snap) -> bool:
    return not isinstance(snap, dict) or not snap.get("listings")


def _ensure_fingerprint_files(run_dir: Path, report: dict | None = None, *, source: str = "recommended") -> None:
    """Create lock + baseline on first view if Generate already ran."""
    report = report if isinstance(report, dict) else (_read_json_file(run_dir / "presentation.json", {}) or {})
    lock = _read_json_file(run_dir / "pulse.json")
    if not isinstance(lock, dict) or not lock.get("locked_price"):
        _write_pulse_lock(run_dir, report, source=source)
        lock = _read_json_file(run_dir / "pulse.json")
    snap = _read_json_file(run_dir / "pulse_snapshot.json")
    baseline = _read_json_file(run_dir / "fingerprint_baseline.json")
    if (
        isinstance(lock, dict)
        and lock.get("locked_price")
        and not _fingerprint_snapshot_empty(snap)
        and isinstance(baseline, dict)
        and (baseline.get("listings") or baseline.get("ids"))
    ):
        return
    df = _load_run_market(run_dir)
    if df is not None and isinstance(lock, dict) and lock.get("locked_price"):
        _write_fingerprint_snapshot(run_dir, report, lock, df)


def _sample_history_has_motion(history) -> bool:
    if not isinstance(history, list) or len(history) < SAMPLE_FINGERPRINT_MIN_WEEKS:
        return False
    total = 0
    for i, week in enumerate(history):
        if i == 0 or not isinstance(week, dict):
            continue
        total += int(week.get("listed_week") or 0)
        total += int(week.get("uc_week") or 0)
        total += int(week.get("sold_week") or 0)
    return total >= 4


def _sample_fingerprint_ready(run_dir: Path) -> bool:
    lock = _read_json_file(run_dir / "pulse.json") or {}
    baseline = _read_json_file(run_dir / "fingerprint_baseline.json") or {}
    snap = _read_json_file(run_dir / "pulse_snapshot.json")
    history = _read_json_file(run_dir / "fingerprint_history.json", []) or []
    return bool(
        lock.get("sample_story") == SAMPLE_FINGERPRINT_STORY
        and lock.get("locked_price")
        and lock.get("locked_at")
        and not _fingerprint_snapshot_empty(snap)
        and (baseline.get("listings") or baseline.get("ids"))
        and isinstance(history, list)
        and len(history) >= SAMPLE_FINGERPRINT_MIN_WEEKS
        and _sample_history_has_motion(history)
    )


def _sample_week_dates(start: str, end: str) -> list[str]:
    """Weekly as-of dates from lock day through the latest snapshot, inclusive."""
    try:
        first = datetime.strptime(str(start)[:10], "%Y-%m-%d")
        last = datetime.strptime(str(end)[:10], "%Y-%m-%d")
    except ValueError:
        return [str(start)[:10]]
    if last < first:
        last = first
    days = []
    cur = first
    while cur < last:
        days.append(cur.strftime("%Y-%m-%d"))
        cur += timedelta(days=7)
    last_s = last.strftime("%Y-%m-%d")
    if not days or days[-1] != last_s:
        days.append(last_s)
    if len(days) <= 8:
        return days
    inner = days[1:-1]
    step = max(1, len(inner) / 6)
    picked = [days[0]]
    i = 0.0
    while len(picked) < 7 and int(i) < len(inner):
        day = inner[int(i)]
        if day not in picked:
            picked.append(day)
        i += step
    if days[-1] not in picked:
        picked.append(days[-1])
    return picked


def _sample_market_as_of(df) -> str:
    """Latest list / sold / update day in the demo market file."""
    import pandas as pd

    latest = None
    if df is None or len(df) == 0:
        return datetime.now().strftime("%Y-%m-%d")
    for col in ("SoldDate", "ListDate", "LastUpdateDate"):
        if col not in df.columns:
            continue
        series = pd.to_datetime(df[col], errors="coerce")
        mx = series.max()
        if pd.isna(mx):
            continue
        day = pd.Timestamp(mx)
        if getattr(day, "tzinfo", None) is not None:
            day = day.tz_localize(None)
        day = day.normalize()
        if latest is None or day > latest:
            latest = day
    return (latest or pd.Timestamp.now()).strftime("%Y-%m-%d")


def _sample_lock_day(df) -> str:
    """List day for the demo Fingerprint: ~7 weeks before the market file ends."""
    as_of = _sample_market_as_of(df)
    try:
        last = datetime.strptime(str(as_of)[:10], "%Y-%m-%d")
    except ValueError:
        return SAMPLE_FINGERPRINT_LOCKED_AT
    first = last - timedelta(days=49)
    return first.strftime("%Y-%m-%d")


def _seed_sample_fingerprint(run_dir: Path, report: dict) -> None:
    """Lock the public demo on a list day in this MLS file and replay real weekly movement."""
    from core import (
        append_fingerprint_history,
        build_pulse_snapshot_as_of,
        digest_pulse,
        fingerprint_sold_from_df,
        merge_fingerprint_ledger,
        reconstruct_fingerprint_baseline,
    )

    if _sample_fingerprint_ready(run_dir):
        lock = _read_json_file(run_dir / "pulse.json") or {}
        if isinstance(lock, dict) and lock.get("locked_price") and not lock.get("active_at"):
            lock["active_at"] = str(lock.get("locked_at") or "")[:10] or SAMPLE_FINGERPRINT_LOCKED_AT
            lock["active_at_source"] = "sample"
            (run_dir / "pulse.json").write_text(json.dumps(lock, indent=2), encoding="utf-8")
        _ensure_active_baseline(run_dir, report, lock if isinstance(lock, dict) else {})
        _seed_sample_fingerprint_notes(run_dir, overwrite=True)
        try:
            _save_pulse_brief(run_dir, report, lock if isinstance(lock, dict) else {})
        except Exception:
            logger.exception("Sample Fingerprint brief refresh skipped")
        return
    df = _load_run_market(run_dir)
    if df is None or len(df) == 0:
        _ensure_fingerprint_files(run_dir, report, source="sample")
        return
    pos = report.get("positioning") if isinstance(report.get("positioning"), dict) else {}
    subject = report.get("subject") if isinstance(report.get("subject"), dict) else {}
    meta = report.get("meta") if isinstance(report.get("meta"), dict) else {}
    try:
        locked_price = float(pos.get("recommended_price") or pos.get("recommended_price") or 410000)
    except (TypeError, ValueError):
        locked_price = 410000
    try:
        subject_sqft = float(subject.get("living_area") or 2392)
    except (TypeError, ValueError):
        subject_sqft = 2392.0
    existing = _read_json_file(run_dir / "pulse.json", {}) or {}
    lock_day = _sample_lock_day(df)
    end = _sample_market_as_of(df)
    week_days = _sample_week_dates(lock_day, end)
    if not week_days:
        week_days = [lock_day]
    lock = {
        "locked_price": int(round(locked_price)),
        "locked_at": f"{lock_day}T09:00:00",
        "active_at": lock_day,
        "active_at_source": "sample",
        "subject_sqft": subject_sqft,
        "subject_beds": float(subject.get("beds") or 4),
        "subject_baths": float(subject.get("baths") or 2),
        "subject_garage": float(subject.get("garage_spaces") or 2),
        "market_label": meta.get("market_label") or report.get("area") or "West Greeley · similar homes",
        "source": "sample",
        "sample_story": SAMPLE_FINGERPRINT_STORY,
        "seller_access": existing.get("seller_access", True) is not False,
    }
    for key in ("email", "seller_name", "seller_email"):
        if existing.get(key) not in (None, ""):
            lock[key] = existing[key]
    photo_map = _load_photo_map(run_dir)
    gallery_map = _load_gallery_map(run_dir)
    baseline = reconstruct_fingerprint_baseline(
        df,
        locked_price,
        subject_sqft,
        as_of=week_days[0],
        photo_map=photo_map,
        gallery_map=gallery_map,
    )
    seen_ids = {str(x) for x in (baseline.get("ids") or []) if x}
    ledger = None
    history: list = []
    prev = None
    prior = None
    snap = None
    digest = {}
    for i, day in enumerate(week_days):
        is_last = i == len(week_days) - 1
        snap = build_pulse_snapshot_as_of(
            df,
            locked_price,
            subject_sqft,
            as_of=day,
            photo_map=photo_map,
            gallery_map=gallery_map,
            latest=is_last,
        )
        for row in snap.get("listings") or []:
            if isinstance(row, dict) and row.get("id"):
                seen_ids.add(str(row["id"]))
        sold_map = fingerprint_sold_from_df(df, seen_ids, as_of=day)
        ledger = merge_fingerprint_ledger(
            ledger,
            snap,
            baseline=baseline,
            sold_map=sold_map,
            as_of=day,
        )
        digest = digest_pulse(snap, lock, prev, baseline=baseline, ledger=ledger, subject=subject)
        history = append_fingerprint_history(history, snap, digest)
        prior = prev
        prev = snap
    if not history or snap is None:
        return
    (run_dir / "pulse_snapshot.json").write_text(json.dumps(snap, indent=2, default=str), encoding="utf-8")
    (run_dir / "pulse_snapshot_prev.json").write_text(
        json.dumps(prior or prev, indent=2, default=str),
        encoding="utf-8",
    )
    (run_dir / "fingerprint_baseline.json").write_text(json.dumps(baseline, indent=2, default=str), encoding="utf-8")
    (run_dir / "fingerprint_active_baseline.json").write_text(json.dumps(baseline, indent=2, default=str), encoding="utf-8")
    (run_dir / "fingerprint_ledger.json").write_text(json.dumps(ledger, indent=2, default=str), encoding="utf-8")
    (run_dir / "fingerprint_history.json").write_text(json.dumps(history, indent=2, default=str), encoding="utf-8")
    lock["last_refresh_at"] = datetime.now().isoformat(timespec="seconds")
    (run_dir / "pulse.json").write_text(json.dumps(lock, indent=2), encoding="utf-8")
    _seed_sample_fingerprint_notes(run_dir, history=history, overwrite=True)
    _save_pulse_brief(run_dir, report, lock, snap)
    logger.info(
        "Sample Fingerprint seeded lock=%s weeks=%s baseline=%s active_now=%s listed_week=%s uc_week=%s sold_week=%s",
        lock["locked_at"],
        len(history),
        baseline.get("active_count"),
        digest.get("active_count"),
        digest.get("listed_week"),
        digest.get("uc_week"),
        digest.get("sold_week"),
    )


def _fingerprint_notes_path(run_dir: Path) -> Path:
    return run_dir / "fingerprint_notes.json"


def _read_fingerprint_notes(run_dir: Path) -> list:
    from core import normalize_fingerprint_notes

    return normalize_fingerprint_notes(_read_json_file(_fingerprint_notes_path(run_dir), []))


def _write_fingerprint_notes(run_dir: Path, notes) -> list:
    from core import normalize_fingerprint_notes

    rows = normalize_fingerprint_notes(notes)
    _fingerprint_notes_path(run_dir).write_text(
        json.dumps(rows, indent=2),
        encoding="utf-8",
    )
    return rows


def _touch_fingerprint_looked(run_dir: Path) -> None:
    lock = _read_json_file(run_dir / "pulse.json")
    if not isinstance(lock, dict) or not lock.get("locked_price"):
        return
    prev = str(lock.get("last_looked_at") or "")
    now = datetime.now()
    if prev:
        try:
            then = datetime.fromisoformat(prev[:19])
            if (now - then).total_seconds() < 120:
                return
        except ValueError:
            pass
    lock["last_looked_at"] = now.isoformat(timespec="seconds")
    (run_dir / "pulse.json").write_text(json.dumps(lock, indent=2), encoding="utf-8")


def _seed_sample_fingerprint_notes(run_dir: Path, history: list | None = None, *, overwrite: bool = False) -> None:
    path = _fingerprint_notes_path(run_dir)
    if path.exists() and not overwrite:
        return
    rows = history if isinstance(history, list) else (_read_json_file(run_dir / "fingerprint_history.json", []) or [])
    notes = []
    for i, week in enumerate(rows):
        if not isinstance(week, dict):
            continue
        as_of = str(week.get("as_of") or "")[:10]
        if not as_of:
            continue
        listed = int(week.get("listed_week") or 0)
        uc = int(week.get("uc_week") or 0)
        sold = int(week.get("sold_week") or 0)
        rank = week.get("rank") or 0
        rank_of = week.get("rank_of") or 0
        rank_txt = f"You sit {rank} of {rank_of} similar actives." if rank and rank_of else ""
        if i == 0:
            body = (
                "Hold the initial list this week unless a cheaper similar home shows up that "
                "buyers will open first. Walk those cheaper new lists before you talk price. " + rank_txt
            ).strip()
        else:
            bits = []
            if listed:
                bits.append(f"{listed} similar listed")
            if uc:
                bits.append(f"{uc} went under contract")
            if sold:
                bits.append(f"{sold} sold")
            if bits:
                body = (
                    f"{', '.join(bits).capitalize()} in your set. Recommendation: walk the cheaper "
                    f"new lists first — those are the homes buyers open. Hold the initial list unless "
                    f"one of those is a true match. {rank_txt}"
                ).strip()
            else:
                body = (
                    f"Quiet week in this size band. Recommendation: hold the initial list and "
                    f"keep showing — no new cheaper similar lists to chase. {rank_txt}"
                ).strip()
        notes.append({
            "as_of": as_of,
            "body": body[:500],
            "status": "published",
            "published_at": f"{as_of}T12:00:00",
            "emailed_at": "",
        })
    if notes:
        _write_fingerprint_notes(run_dir, notes)


def _sample_visuals_ready(run_dir: Path) -> bool:
    from core import FINGERPRINT_UC_STATUSES

    ledger = _read_json_file(run_dir / "fingerprint_ledger.json") or {}
    listings = ledger.get("listings") if isinstance(ledger, dict) else {}
    if not isinstance(listings, dict):
        return False
    dates: set[str] = set()
    for rec in listings.values():
        if not isinstance(rec, dict) or not rec.get("baseline"):
            continue
        for row in rec.get("status_history") or []:
            if not isinstance(row, dict):
                continue
            st = str(row.get("status") or "")
            if st in FINGERPRINT_UC_STATUSES or st == "Sold":
                as_of = str(row.get("as_of") or "")[:10]
                if as_of:
                    dates.add(as_of)
    return len(dates) >= 2


def _backfill_sample_fingerprint_visuals(run_dir: Path) -> None:
    """Date pending/sold events across the sample's two real weeks so week-click lights up homes."""
    from core import FINGERPRINT_UC_STATUSES

    if _sample_visuals_ready(run_dir):
        return
    ledger = _read_json_file(run_dir / "fingerprint_ledger.json") or {}
    listings = ledger.get("listings") if isinstance(ledger, dict) else None
    if not isinstance(listings, dict) or not listings:
        return
    history = _read_json_file(run_dir / "fingerprint_history.json", []) or []
    snap = _read_json_file(run_dir / "pulse_snapshot.json") or {}
    first = SAMPLE_FINGERPRINT_LOCKED_AT
    last = str(snap.get("as_of") or "")[:10]
    if history:
        first = str((history[0] or {}).get("as_of") or first)[:10]
        last = str((history[-1] or {}).get("as_of") or last)[:10]
    if not last or last == first:
        return
    moved = []
    for rec in listings.values():
        if not isinstance(rec, dict) or not rec.get("baseline"):
            continue
        st = str(rec.get("last_status") or rec.get("status") or "")
        if st in FINGERPRINT_UC_STATUSES or st == "Sold":
            moved.append(rec)
    if not moved:
        return
    for i, rec in enumerate(moved):
        event_as_of = first if (i % 2 == 0) else last
        first_price = int(rec.get("first_price") or rec.get("was_price") or rec.get("price") or 0)
        last_price = int(rec.get("last_price") or rec.get("price") or 0)
        rec["status_history"] = [
            {
                "as_of": first,
                "status": str(rec.get("first_status") or "Active"),
                "price": first_price,
            },
            {
                "as_of": event_as_of,
                "status": str(rec.get("last_status") or rec.get("status") or ""),
                "price": last_price,
            },
        ]
    ledger["listings"] = listings
    (run_dir / "fingerprint_ledger.json").write_text(
        json.dumps(ledger, indent=2, default=str),
        encoding="utf-8",
    )
    report = _read_json_file(run_dir / "presentation.json", {}) or {}
    lock = _read_json_file(run_dir / "pulse.json") or {}
    if isinstance(lock, dict) and lock.get("locked_price"):
        _save_pulse_brief(run_dir, report, lock, snap)


def _hydrate_fingerprint_photos(run_dir: Path, snap: dict | None, ledger: dict | None):
    """Attach hosted MLS photos that arrived after the snapshot was frozen."""
    from core import apply_listing_photos

    photo_map = _load_photo_map(run_dir)
    gallery_map = _load_gallery_map(run_dir)
    if isinstance(snap, dict) and snap.get("listings"):
        snap = dict(snap)
        snap["listings"] = apply_listing_photos(snap["listings"], photo_map, gallery_map)
    if isinstance(ledger, dict) and isinstance(ledger.get("listings"), dict):
        rows = [v for v in ledger["listings"].values() if isinstance(v, dict)]
        updated = apply_listing_photos(rows, photo_map, gallery_map)
        by_id = {str(r.get("id")): r for r in updated if r.get("id")}
        ledger = dict(ledger)
        ledger["listings"] = {
            k: by_id.get(str(k), v) for k, v in ledger["listings"].items()
        }
    return snap, ledger


def _fingerprint_photo_targets(run_dir: Path, cap: int = 200) -> list[dict]:
    """Snapshot + ledger listings so Fingerprint cards can get real photos."""
    snap = _read_json_file(run_dir / "pulse_snapshot.json") or {}
    ledger = _read_json_file(run_dir / "fingerprint_ledger.json") or {}
    rows: list[dict] = []
    for row in snap.get("listings") or []:
        if isinstance(row, dict):
            rows.append(row)
    listings = ledger.get("listings") if isinstance(ledger, dict) else {}
    if isinstance(listings, dict):
        rows.extend(v for v in listings.values() if isinstance(v, dict))
    elif isinstance(listings, list):
        rows.extend(v for v in listings if isinstance(v, dict))
    out: list[dict] = []
    seen: set[str] = set()
    for row in rows:
        mls = str(row.get("mls") or row.get("id") or "").strip()
        addr = str(row.get("address") or "").strip()
        key = mls or addr
        if not key or key in seen:
            continue
        seen.add(key)
        out.append({
            "mls_number": mls,
            "mls": mls,
            "id": mls,
            "address": addr,
            "city": row.get("city") or "",
            "state": "CO",
            "latitude": row.get("lat") or row.get("latitude"),
            "longitude": row.get("lng") or row.get("longitude"),
            "photo_url": row.get("photo_url") or "",
        })
    out.sort(key=lambda r: 0 if not r.get("photo_url") else 1)
    return out[:cap]


def _fingerprint_needs_photos(snap: dict | None, photo_map: dict | None) -> bool:
    photos = photo_map if isinstance(photo_map, dict) else {}
    for row in (snap or {}).get("listings") or []:
        if not isinstance(row, dict):
            continue
        if row.get("photo_url") or (isinstance(row.get("photos"), list) and row["photos"]):
            continue
        mls = str(row.get("mls") or row.get("id") or "").strip()
        addr = str(row.get("address") or "").strip()
        compact = "".join(ch for ch in addr if ch.isalnum() or ch in "-_")[:48]
        if photos.get(mls) or photos.get(str(row.get("id") or "")) or photos.get(addr) or (compact and photos.get(compact)):
            continue
        if mls or addr:
            return True
    return False


def _pulse_links(run_id: str, report: dict | None = None) -> tuple[str, str, str, str]:
    import auth_service

    base = auth_service.app_base_url().rstrip("/")
    report_url = f"{base}/runs/{run_id}/"
    share_url = report_url
    token = ""
    try:
        row = auth_service.get_presentation_by_run(run_id)
        token = str((row or {}).get("share_token") or "")
    except Exception:
        token = ""
    if not token:
        share = _read_json_file(OUTPUT_DIR / run_id / "share.json", {}) or {}
        token = str(share.get("share_token") or "")
    if token:
        share_url = f"{base}/p/{token}/"
    fingerprint_url = f"{share_url.rstrip('/')}/fingerprint/"
    agent_fingerprint = f"{base}/runs/{run_id}/fingerprint/"
    return report_url, share_url, fingerprint_url, agent_fingerprint


def _save_pulse_brief(
    run_dir: Path,
    report: dict,
    lock: dict,
    snap: dict | None = None,
    *,
    stale_upload: bool = False,
) -> dict:
    from core import build_pulse_brief

    snap = snap if snap is not None else _read_json_file(run_dir / "pulse_snapshot.json")
    prev = _read_json_file(run_dir / "pulse_snapshot_prev.json")
    subject = report.get("subject") if isinstance(report.get("subject"), dict) else {}
    need_detect = str((lock or {}).get("active_at_source") or "") != "agent" and not (lock or {}).get("active_at")
    df = _load_run_market(run_dir) if need_detect else None
    lock = _apply_active_at(run_dir, lock, report, df=df, snap=snap)
    if lock.get("locked_price"):
        (run_dir / "pulse.json").write_text(json.dumps(lock, indent=2), encoding="utf-8")
    report_url, share_url, fingerprint_url, agent_fp = _pulse_links(run_dir.name, report)
    baseline = _clock_baseline(run_dir, lock)
    ledger = _read_json_file(run_dir / "fingerprint_ledger.json")
    snap, ledger = _hydrate_fingerprint_photos(run_dir, snap, ledger)
    meta = report.get("meta") if isinstance(report.get("meta"), dict) else {}
    brief = build_pulse_brief(
        lock,
        snap,
        prev,
        subject=subject,
        share_url=share_url,
        report_url=report_url,
        fingerprint_url=fingerprint_url,
        stale_upload=stale_upload,
        baseline=baseline,
        ledger=ledger,
        history=_read_json_file(run_dir / "fingerprint_history.json", []),
        notes=_read_fingerprint_notes(run_dir),
        portal_criteria=meta.get("portal_criteria") if isinstance(meta.get("portal_criteria"), dict) else None,
        city=str(meta.get("city") or report.get("area") or ""),
    )
    brief["agent_fingerprint_url"] = agent_fp
    (run_dir / "pulse_brief.json").write_text(
        json.dumps(brief, indent=2, default=str),
        encoding="utf-8",
    )
    return brief


def _listing_flow_client(flow: dict | None) -> dict | None:
    if not isinstance(flow, dict):
        return None
    return {
        "newPm": flow.get("new_listings_per_month"),
        "salesPm": flow.get("sales_per_month"),
        "supplyPressure": flow.get("supply_pressure"),
        "netPm": flow.get("net_inventory_per_month"),
        "newBelowRecPm": flow.get("new_below_recommended_per_month"),
        "activeBelowRec": flow.get("active_below_recommended_now"),
        "thresholdPrice": flow.get("threshold_price"),
        "subjectSqft": flow.get("subject_living_area"),
        "samples": flow.get("samples") or [],
        "insight": flow.get("insight") or "",
        "chart": flow.get("chart") or {},
    }


def _rebuild_listing_flow(report: dict, df, locked_price: float, subject_sqft: float) -> dict:
    from core import compute_listing_flow

    stats = report.get("stats") or {}
    pos = report.get("positioning") or {}
    subject = report.get("subject") or {}
    try:
        rec = float(locked_price or pos.get("recommended_price") or 0)
    except (TypeError, ValueError):
        rec = 0
    try:
        sqft = float(subject_sqft or subject.get("living_area") or 0)
    except (TypeError, ValueError):
        sqft = 0
    flow = compute_listing_flow(
        df,
        float(stats.get("absorption_rate") or 0),
        rec,
        sqft,
    )
    report["listing_flow"] = flow
    report["chart_listing_flow"] = flow.get("chart") or {}
    return flow


def _pulse_payload(run_dir: Path, report: dict | None = None) -> dict:
    from core import digest_pulse

    if report is None:
        report = _read_json_file(run_dir / "presentation.json", {}) or {}
    meta = report.get("meta") or {}
    lock = _read_json_file(run_dir / "pulse.json")
    snap = _read_json_file(run_dir / "pulse_snapshot.json")
    prev = _read_json_file(run_dir / "pulse_snapshot_prev.json")
    digest = (
        digest_pulse(
            snap,
            lock,
            prev,
            baseline=_clock_baseline(run_dir, lock),
            ledger=_read_json_file(run_dir / "fingerprint_ledger.json"),
            subject=report.get("subject") if isinstance(report.get("subject"), dict) else {},
        )
        if lock
        else None
    )
    brief = _read_json_file(run_dir / "pulse_brief.json")
    if lock and not brief:
        try:
            brief = _save_pulse_brief(run_dir, report, lock, snap)
        except Exception:
            brief = None
    data_source = str(meta.get("data_source") or "")
    report_url, share_url, fingerprint_url, agent_fp = _pulse_links(run_dir.name, report)
    return {
        "lock": lock,
        "digest": digest,
        "brief": brief,
        "snapshot": snap,
        "data_source": data_source,
        "can_search_refresh": bool(meta.get("portal_criteria")),
        "needs_upload": data_source == "mls_export" and not meta.get("portal_criteria"),
        "listingFlow": _listing_flow_client(report.get("listing_flow")),
        "fingerprint_url": fingerprint_url,
        "agent_fingerprint_url": agent_fp,
        "seller_url": share_url,
        "report_url": report_url,
        "run_id": run_dir.name,
        "notes": _read_fingerprint_notes(run_dir),
        "agent_name": str(meta.get("agent_name") or ""),
        "last_looked_at": str((lock or {}).get("last_looked_at") or ""),
        "seller_got_weekly": _seller_got_weekly_recently(lock),
        "photos_fetching": False,
    }


def _reject_sample_mutation(run_id: str) -> None:
    if run_id == SAMPLE_RUN_ID:
        raise HTTPException(403, "The public sample is read-only")


@app.post("/api/runs/{run_id}/edits")
async def save_run_edits(run_id: str, request: Request):
    """Persist Agent Tools overrides alongside the run."""
    run_id = _safe_run_id(run_id)
    _reject_sample_mutation(run_id)
    run_dir = OUTPUT_DIR / run_id
    if not run_dir.exists():
        raise HTTPException(404, "Run not found")
    try:
        payload = await request.json()
    except Exception as exc:
        raise HTTPException(400, "Invalid JSON") from exc
    # Sanitize free-text fields
    for key in ("bl", "adv", "risk", "obj", "name"):
        if key in payload and isinstance(payload[key], str):
            payload[key] = html_lib.escape(payload[key])
    if isinstance(payload.get("adv"), list):
        payload["adv"] = [html_lib.escape(str(x)) for x in payload["adv"]]
    if isinstance(payload.get("risk"), list):
        payload["risk"] = [html_lib.escape(str(x)) for x in payload["risk"]]
    if isinstance(payload.get("ledes"), dict):
        payload["ledes"] = {
            str(k)[:40]: html_lib.escape(str(v)[:500])
            for k, v in payload["ledes"].items()
            if k in ("comps", "condition", "close")
        }
    if payload.get("portalChip") not in ("on", "off"):
        payload.pop("portalChip", None)
    if payload.get("pulseBlock") not in ("on", "off"):
        payload.pop("pulseBlock", None)
    existing = _read_json_file(run_dir / "edits.json", {}) or {}
    if "portalChip" not in payload and existing.get("portalChip") in ("on", "off"):
        payload["portalChip"] = existing["portalChip"]
    if "pulseBlock" not in payload and existing.get("pulseBlock") in ("on", "off"):
        payload["pulseBlock"] = existing["pulseBlock"]
    (run_dir / "edits.json").write_text(json.dumps(payload, indent=2), encoding="utf-8")
    return {"ok": True}


@app.get("/api/runs/{run_id}/edits")
def load_run_edits(run_id: str):
    run_id = _safe_run_id(run_id)
    path = OUTPUT_DIR / run_id / "edits.json"
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


@app.post("/api/runs/{run_id}/refresh-deck")
def refresh_run_deck(run_id: str, request: Request):
    """Re-bake flipbook HTML from presentation.json + this-run edits."""
    _require_user(request)
    run_id = _safe_run_id(run_id)
    _reject_sample_mutation(run_id)
    run_dir = OUTPUT_DIR / run_id
    json_path = run_dir / "presentation.json"
    if not json_path.exists():
        raise HTTPException(404, "Run not found")
    try:
        report = json.loads(json_path.read_text(encoding="utf-8"))
    except Exception as exc:
        raise HTTPException(400, "Invalid presentation JSON") from exc
    edits: dict = {}
    edits_path = run_dir / "edits.json"
    if edits_path.exists():
        try:
            edits = json.loads(edits_path.read_text(encoding="utf-8"))
        except Exception:
            edits = {}
    from copy_defaults import apply_run_edits
    import deck_html

    apply_run_edits(report, edits)
    if edits.get("portalChip") in ("on", "off"):
        report.setdefault("meta", {})["portal_chip"] = edits["portalChip"]
    deck_html.save_deck_html(report, run_dir / "deck.html")
    return {"ok": True}


@app.get("/api/runs/{run_id}/pulse")
def get_run_pulse(run_id: str):
    run_id = _safe_run_id(run_id)
    run_dir = OUTPUT_DIR / run_id
    if not (run_dir / "presentation.json").exists():
        raise HTTPException(404, "Run not found")
    return _pulse_payload(run_dir)


@app.post("/api/runs/{run_id}/pulse-lock")
async def lock_run_pulse(run_id: str, request: Request):
    run_id = _safe_run_id(run_id)
    _reject_sample_mutation(run_id)
    _require_run_owner(request, run_id)
    run_dir = OUTPUT_DIR / run_id
    json_path = run_dir / "presentation.json"
    if not json_path.exists():
        raise HTTPException(404, "Run not found")
    report = _read_json_file(json_path, {}) or {}
    try:
        body = await request.json()
    except Exception:
        body = {}
    price = body.get("price") if isinstance(body, dict) else None
    if price in (None, ""):
        edits = _read_json_file(run_dir / "edits.json", {}) or {}
        price = edits.get("rec")
    lock = _write_pulse_lock(run_dir, report, price=price, source="agent")
    if not lock:
        raise HTTPException(400, "Need a list price to lock")
    return _pulse_payload(run_dir, report)


@app.post("/api/runs/{run_id}/pulse-refresh")
async def refresh_run_pulse(run_id: str, request: Request):
    run_id = _safe_run_id(run_id)
    _reject_sample_mutation(run_id)
    _require_run_owner(request, run_id)
    run_dir = OUTPUT_DIR / run_id
    json_path = run_dir / "presentation.json"
    if not json_path.exists():
        raise HTTPException(404, "Run not found")
    report = _read_json_file(json_path, {}) or {}
    meta = report.get("meta") or {}
    lock = _read_json_file(run_dir / "pulse.json")
    if not lock:
        raise HTTPException(400, "Lock a list price before refreshing the pulse")
    from core import build_pulse_snapshot, digest_pulse

    criteria = meta.get("portal_criteria")
    export_file = None
    content_type = (request.headers.get("content-type") or "").lower()
    if "multipart/form-data" in content_type:
        form = await request.form()
        maybe = form.get("export_file")
        if maybe is not None and getattr(maybe, "filename", None):
            export_file = maybe
    snap_existing = _read_json_file(run_dir / "pulse_snapshot.json")
    if export_file is None and _snapshot_age_days(snap_existing) < 1:
        df_saved = _load_run_market(run_dir)
        if df_saved is not None:
            brief = _save_pulse_brief(run_dir, report, lock, snap_existing)
            return {
                **_pulse_payload(run_dir, report),
                "digest": digest_pulse(snap_existing, lock, _read_json_file(run_dir / "pulse_snapshot_prev.json")),
                "brief": brief,
                "snapshot": snap_existing,
                "listingFlow": _listing_flow_client(report.get("listing_flow")),
                "reused": True,
            }

    df = None
    if export_file is not None:
        suffix = Path(export_file.filename or "export.txt").suffix.lower() or ".txt"
        if suffix not in {".txt", ".csv", ".tsv"}:
            raise HTTPException(400, "Export must be .txt, .csv, or .tsv")
        content = await export_file.read()
        if not content or not content.strip():
            raise HTTPException(400, "Uploaded file is empty")
        if len(content) > MAX_UPLOAD_BYTES:
            raise HTTPException(400, "Export must be 15MB or smaller")
        tmp = UPLOAD_DIR / f"{uuid.uuid4().hex}{suffix}"
        tmp.write_bytes(content)
        try:
            from export_mapper import load_mapped_export

            df, _map_result = load_mapped_export(tmp)
        except Exception as exc:
            raise HTTPException(400, f"Could not map export headers: {exc}") from exc
        finally:
            try:
                tmp.unlink()
            except OSError:
                pass
        df.to_csv(run_dir / "market.csv", sep="|", index=False)
    elif criteria:
        from portal_market import build_portal_from_criteria, parse_portal_criteria, friendly_portal_error

        try:
            parsed = parse_portal_criteria(criteria)
            df = await asyncio.to_thread(build_portal_from_criteria, parsed, mode="refresh")
        except Exception as exc:
            logger.exception("Pulse search refresh failed")
            raise HTTPException(400, friendly_portal_error(exc)) from exc
        if df is None or len(df) == 0:
            raise HTTPException(400, "No portal listings matched those filters")
        df.to_csv(run_dir / "market.csv", sep="|", index=False)
    else:
        raise HTTPException(
            400,
            "Upload a fresh MLS export to refresh this pulse.",
        )

    prev_path = run_dir / "pulse_snapshot.json"
    snap = _write_fingerprint_snapshot(run_dir, report, lock, df, rotate_prev=True)
    prev = _read_json_file(run_dir / "pulse_snapshot_prev.json")
    locked_price = float(lock.get("locked_price") or 0)
    subject_sqft = float(lock.get("subject_sqft") or 0)
    try:
        flow = _rebuild_listing_flow(report, df, locked_price, subject_sqft)
        json_path.write_text(json.dumps(report, indent=2, default=str), encoding="utf-8")
    except Exception:
        logger.exception("Failed to rebuild listing flow after pulse refresh")
        flow = report.get("listing_flow")
    brief = _read_json_file(run_dir / "pulse_brief.json") or _save_pulse_brief(run_dir, report, lock, snap)
    from core import digest_pulse

    if run_id != SAMPLE_RUN_ID:
        try:
            if _fingerprint_needs_photos(snap, _load_photo_map(run_dir)):
                _start_background_photos(run_id, run_dir)
        except Exception:
            logger.exception("Fingerprint photo enrich after refresh failed for %s", run_id)

    return {
        **_pulse_payload(run_dir, report),
        "digest": digest_pulse(
            snap,
            lock,
            prev,
            baseline=_clock_baseline(run_dir, lock),
            ledger=_read_json_file(run_dir / "fingerprint_ledger.json"),
            subject=report.get("subject") if isinstance(report.get("subject"), dict) else {},
        ),
        "brief": brief,
        "snapshot": snap,
        "listingFlow": _listing_flow_client(flow),
    }


def _pulse_opt_out_token(run_id: str) -> str:
    secret = (os.environ.get("SESSION_SECRET") or os.environ.get("CRON_SECRET") or "listlogic-pulse").encode()
    return hmac.new(secret, f"pulse-opt-out:{run_id}".encode(), hashlib.sha256).hexdigest()[:24]


def _normalize_pulse_email(body: dict, existing: dict | None = None) -> dict:
    prev = existing if isinstance(existing, dict) else {}
    prev_email = prev.get("email") if isinstance(prev.get("email"), dict) else {}
    raw = body.get("recipients")
    recips: list[str] = []
    if isinstance(raw, str):
        if raw == "both":
            recips = ["agent", "seller"]
        elif raw in ("agent", "seller"):
            recips = [raw]
    elif isinstance(raw, list):
        recips = [str(x) for x in raw if str(x) in ("agent", "seller")]
    if not recips:
        recips = [str(x) for x in (prev_email.get("recipients") or ["agent"]) if x in ("agent", "seller")]
    if not recips:
        recips = ["agent"]
    seller_email = str(body.get("seller_email") if "seller_email" in body else prev_email.get("seller_email") or "").strip()
    if seller_email and not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", seller_email):
        raise HTTPException(400, "Seller email looks invalid")
    on = body.get("on")
    if on is None:
        on = prev_email.get("on", False)
    on = bool(on)
    if on and "seller" in recips and not seller_email:
        raise HTTPException(400, "Add a seller email to include them on the weekly email")
    started_at = prev_email.get("started_at") or ""
    if on and not started_at:
        started_at = datetime.now().isoformat(timespec="seconds")
    if not on:
        started_at = started_at or ""
    return {
        "on": on,
        "recipients": recips,
        "seller_email": seller_email,
        "started_at": started_at,
        "last_sent_at": prev_email.get("last_sent_at") or "",
    }


def _run_owner_user(run_id: str):
    import auth_service
    import db as database

    uid = ""
    share = _read_json_file(OUTPUT_DIR / run_id / "share.json", {}) or {}
    uid = str(share.get("user_id") or "")
    if not uid:
        try:
            row = database.execute(
                "SELECT user_id FROM presentations WHERE run_id = ?",
                (run_id,),
                fetch="one",
            )
            uid = str((row or {}).get("user_id") or "")
        except Exception:
            uid = ""
    return auth_service.get_user_by_id(uid) if uid else None


def _snapshot_age_days(snap: dict | None) -> float:
    if not isinstance(snap, dict) or not snap.get("as_of"):
        return 999
    ts = None
    try:
        import pandas as pd

        ts = pd.to_datetime(snap.get("as_of"), errors="coerce")
        if ts is not None and hasattr(ts, "tzinfo") and ts.tzinfo is not None:
            ts = ts.tz_localize(None)
        if ts is None or (hasattr(ts, "value") and pd.isna(ts)):
            return 999
        return max(0.0, float((pd.Timestamp.now() - ts).days))
    except Exception:
        return 999


def _send_run_pulse_email(run_dir: Path, *, stale_upload: bool = False) -> bool:
    import auth_service
    import mailer

    run_id = run_dir.name
    report = _read_json_file(run_dir / "presentation.json", {}) or {}
    lock = _read_json_file(run_dir / "pulse.json") or {}
    email_cfg = lock.get("email") if isinstance(lock.get("email"), dict) else {}
    if not email_cfg.get("on"):
        return False
    snap = _read_json_file(run_dir / "pulse_snapshot.json")
    brief = _save_pulse_brief(run_dir, report, lock, snap, stale_upload=stale_upload)
    user = _run_owner_user(run_id)
    agent_email = str((user or {}).get("email") or (report.get("meta") or {}).get("agent_email") or "").strip()
    seller_email = str(email_cfg.get("seller_email") or lock.get("seller_email") or "").strip()
    recips = [str(x) for x in (email_cfg.get("recipients") or ["agent"]) if x in ("agent", "seller")]
    seller_wants = "seller" in recips and bool(seller_email)
    agent_wants = "agent" in recips and bool(agent_email)
    # Agent still gets a write-note path when the picture only went to the seller.
    agent_nudge = bool(agent_email) and (agent_wants or seller_wants)
    if not seller_wants and not agent_nudge:
        logger.info("Pulse email skipped for %s — no recipient", run_id)
        return False
    import auth_service as _auth

    base = _auth.app_base_url().rstrip("/")
    opt_out = f"{base}/api/runs/{run_id}/pulse-opt-out?t={_pulse_opt_out_token(run_id)}"
    agent_name = str((user or {}).get("name") or (report.get("meta") or {}).get("agent_name") or "")
    agent_fp = str((brief or {}).get("agent_fingerprint_url") or f"{base}/runs/{run_id}/fingerprint/")
    note_url = agent_fp.rstrip("/") + "/#note"
    sent_any = False
    if seller_wants:
        sent_any = mailer.send_pulse_brief(
            to=seller_email,
            brief=brief,
            audience="seller",
            reply_to=agent_email,
            opt_out_url=opt_out,
            agent_name=agent_name,
        ) or sent_any
    if agent_nudge:
        sent_any = mailer.send_pulse_brief(
            to=agent_email,
            brief=brief,
            audience="agent",
            reply_to=agent_email,
            opt_out_url=opt_out,
            agent_name=agent_name,
            agent_note_url=note_url,
            seller_also_received=seller_wants,
        ) or sent_any
    if sent_any:
        email_cfg["last_sent_at"] = datetime.now().isoformat(timespec="seconds")
        if seller_wants:
            email_cfg["last_seller_sent_at"] = email_cfg["last_sent_at"]
        lock["email"] = email_cfg
        (run_dir / "pulse.json").write_text(json.dumps(lock, indent=2), encoding="utf-8")
        try:
            auth_service.log_event(
                (user or {}).get("id"),
                f"pulse_email:{run_id}",
                {"seller": seller_wants, "agent": agent_nudge},
            )
        except Exception:
            logger.exception("Pulse email event log failed")
    return bool(sent_any)


MAX_PULSE_REEF_REFRESHES = 3


def _run_pulse_briefs() -> dict:
    """Weekly Fingerprint refresh for Search markets; email only if opted in."""
    import auth_service

    checked = 0
    sent = 0
    skipped = 0
    refreshed = 0
    reef_refreshes = 0
    if not OUTPUT_DIR.exists():
        return {"checked": 0, "sent": 0, "skipped": 0, "refreshed": 0}
    for run_dir in OUTPUT_DIR.iterdir():
        if not run_dir.is_dir():
            continue
        lock = _read_json_file(run_dir / "pulse.json")
        if not isinstance(lock, dict) or not lock.get("locked_price"):
            continue
        if lock.get("sold_at"):
            continue
        if run_dir.name == SAMPLE_RUN_ID:
            continue
        checked += 1
        run_id = run_dir.name
        report = _read_json_file(run_dir / "presentation.json", {}) or {}
        meta = report.get("meta") or {}
        criteria = meta.get("portal_criteria")
        snap = _read_json_file(run_dir / "pulse_snapshot.json")
        stale_upload = False
        if criteria and _snapshot_age_days(snap) >= 6:
            from portal_market import reef_configured

            if not reef_configured():
                logger.warning("Fingerprint cron skipped Search refresh for %s: REEF_API_KEY is not set", run_id)
            elif reef_refreshes >= MAX_PULSE_REEF_REFRESHES:
                logger.info("Fingerprint cron Reef cap reached; skipping refresh for %s", run_id)
            else:
                try:
                    from portal_market import build_portal_from_criteria, parse_portal_criteria

                    parsed = parse_portal_criteria(criteria)
                    df = build_portal_from_criteria(parsed, mode="refresh")
                    reef_refreshes += 1
                    if df is not None and len(df):
                        df.to_csv(run_dir / "market.csv", sep="|", index=False)
                        snap = _write_fingerprint_snapshot(run_dir, report, lock, df, rotate_prev=True)
                        lock = _read_json_file(run_dir / "pulse.json") or lock
                        try:
                            _rebuild_listing_flow(
                                report,
                                df,
                                float(lock.get("locked_price") or 0),
                                float(lock.get("subject_sqft") or 0),
                            )
                            (run_dir / "presentation.json").write_text(
                                json.dumps(report, indent=2, default=str),
                                encoding="utf-8",
                            )
                        except Exception:
                            logger.exception("Fingerprint cron listing-flow rebuild failed for %s", run_id)
                        refreshed += 1
                        try:
                            if _fingerprint_needs_photos(snap, _load_photo_map(run_dir)):
                                _start_background_photos(run_id, run_dir)
                        except Exception:
                            logger.exception("Fingerprint cron photo enrich failed for %s", run_id)
                except Exception:
                    logger.exception("Fingerprint cron Search refresh failed for %s", run_id)
        elif not criteria:
            stale_upload = _snapshot_age_days(snap) >= 6

        email_cfg = lock.get("email") if isinstance(lock.get("email"), dict) else {}
        if not email_cfg.get("on"):
            continue
        user = _run_owner_user(run_id)
        uid = (user or {}).get("id")
        last_sent = str(email_cfg.get("last_sent_at") or "")
        if last_sent:
            try:
                import pandas as pd
                last_ts = pd.to_datetime(last_sent, errors="coerce")
                if pd.notna(last_ts) and (pd.Timestamp.now() - last_ts).total_seconds() < 144 * 3600:
                    skipped += 1
                    continue
            except Exception:
                pass
        if uid and auth_service.event_already_sent(uid, f"pulse_email:{run_id}", within_hours=144):
            skipped += 1
            continue
        if _send_run_pulse_email(run_dir, stale_upload=stale_upload):
            sent += 1
        else:
            skipped += 1
    return {
        "checked": checked,
        "sent": sent,
        "skipped": skipped,
        "refreshed": refreshed,
        "reef_refreshes": reef_refreshes,
    }


@app.post("/api/runs/{run_id}/pulse-email")
async def save_run_pulse_email(run_id: str, request: Request):
    run_id = _safe_run_id(run_id)
    _reject_sample_mutation(run_id)
    _require_run_owner(request, run_id)
    run_dir = OUTPUT_DIR / run_id
    if not (run_dir / "presentation.json").exists():
        raise HTTPException(404, "Run not found")
    lock = _read_json_file(run_dir / "pulse.json")
    if not lock:
        raise HTTPException(400, "Lock a list price before starting weekly email")
    try:
        body = await request.json()
    except Exception:
        body = {}
    if not isinstance(body, dict):
        body = {}
    email_cfg = _normalize_pulse_email(body, lock)
    lock["email"] = email_cfg
    (run_dir / "pulse.json").write_text(json.dumps(lock, indent=2), encoding="utf-8")
    return {"ok": True, "lock": lock, **_pulse_payload(run_dir)}


@app.post("/api/runs/{run_id}/fingerprint/contact")
async def save_fingerprint_contact(run_id: str, request: Request):
    run_id = _safe_run_id(run_id)
    _reject_sample_mutation(run_id)
    _require_run_owner(request, run_id)
    run_dir = OUTPUT_DIR / run_id
    lock = _read_json_file(run_dir / "pulse.json") or {}
    if not lock:
        raise HTTPException(400, "Generate a Fingerprint before saving seller contact")
    try:
        body = await request.json()
    except Exception:
        body = {}
    if not isinstance(body, dict):
        body = {}
    name = html_lib.escape(str(body.get("seller_name") or "").strip())[:120]
    email = str(body.get("seller_email") or "").strip()
    if email and not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email):
        raise HTTPException(400, "Seller email looks invalid")
    lock["seller_name"] = name
    lock["seller_email"] = email
    email_cfg = lock.get("email") if isinstance(lock.get("email"), dict) else {}
    if email:
        email_cfg["seller_email"] = email
        lock["email"] = email_cfg
    (run_dir / "pulse.json").write_text(json.dumps(lock, indent=2), encoding="utf-8")
    return {"ok": True, "lock": lock}


@app.post("/api/runs/{run_id}/fingerprint/active")
async def save_fingerprint_active(run_id: str, request: Request):
    from core import _fingerprint_date

    run_id = _safe_run_id(run_id)
    _reject_sample_mutation(run_id)
    _require_run_owner(request, run_id)
    run_dir = OUTPUT_DIR / run_id
    lock = _read_json_file(run_dir / "pulse.json") or {}
    if not lock:
        raise HTTPException(400, "Generate a Fingerprint before setting the listed date")
    try:
        body = await request.json()
    except Exception:
        body = {}
    if not isinstance(body, dict):
        body = {}
    raw = str(body.get("active_at") or "").strip()
    if not raw:
        lock.pop("active_at", None)
        lock.pop("active_at_source", None)
        active_path = run_dir / "fingerprint_active_baseline.json"
        if active_path.exists():
            try:
                active_path.unlink()
            except OSError:
                pass
    else:
        day = _fingerprint_date(raw)
        if not day:
            raise HTTPException(400, "Listed date must be YYYY-MM-DD")
        lock["active_at"] = day
        lock["active_at_source"] = "agent"
        report = _read_json_file(run_dir / "presentation.json", {}) or {}
        _ensure_active_baseline(run_dir, report, lock, _load_run_market(run_dir))
    (run_dir / "pulse.json").write_text(json.dumps(lock, indent=2), encoding="utf-8")
    report = _read_json_file(run_dir / "presentation.json", {}) or {}
    _save_pulse_brief(run_dir, report, lock)
    return {"ok": True, "lock": lock, **_pulse_payload(run_dir)}


@app.post("/api/runs/{run_id}/fingerprint/share")
async def save_fingerprint_share(run_id: str, request: Request):
    run_id = _safe_run_id(run_id)
    _reject_sample_mutation(run_id)
    _require_run_owner(request, run_id)
    run_dir = OUTPUT_DIR / run_id
    lock = _read_json_file(run_dir / "pulse.json") or {}
    if not lock:
        raise HTTPException(400, "Fingerprint not found")
    try:
        body = await request.json()
    except Exception:
        body = {}
    lock["seller_access"] = bool((body or {}).get("seller_access", True))
    (run_dir / "pulse.json").write_text(json.dumps(lock, indent=2), encoding="utf-8")
    return {"ok": True, "seller_access": lock["seller_access"], **_pulse_payload(run_dir)}


@app.post("/api/runs/{run_id}/fingerprint/sold")
async def mark_fingerprint_sold(run_id: str, request: Request):
    run_id = _safe_run_id(run_id)
    _reject_sample_mutation(run_id)
    _require_run_owner(request, run_id)
    run_dir = OUTPUT_DIR / run_id
    lock = _read_json_file(run_dir / "pulse.json") or {}
    if not lock:
        raise HTTPException(400, "Fingerprint not found")
    try:
        body = await request.json()
    except Exception:
        body = {}
    sold = bool((body or {}).get("sold", True))
    if sold:
        lock["sold_at"] = datetime.now().isoformat(timespec="seconds")
        email_cfg = lock.get("email") if isinstance(lock.get("email"), dict) else {}
        email_cfg["on"] = False
        lock["email"] = email_cfg
    else:
        lock.pop("sold_at", None)
    (run_dir / "pulse.json").write_text(json.dumps(lock, indent=2), encoding="utf-8")
    report = _read_json_file(run_dir / "presentation.json", {}) or {}
    _save_pulse_brief(run_dir, report, lock)
    return {"ok": True, "lock": lock, **_pulse_payload(run_dir)}


def _seller_got_weekly_recently(lock: dict | None, *, hours: float = 192) -> bool:
    lock = lock if isinstance(lock, dict) else {}
    email_cfg = lock.get("email") if isinstance(lock.get("email"), dict) else {}
    recips = [str(x) for x in (email_cfg.get("recipients") or [])]
    if "seller" not in recips:
        return False
    last = str(email_cfg.get("last_seller_sent_at") or email_cfg.get("last_sent_at") or "")
    if not last:
        return False
    try:
        then = datetime.fromisoformat(last[:19])
        return (datetime.now() - then).total_seconds() < hours * 3600
    except ValueError:
        return False


def _send_fingerprint_note_email(run_dir: Path, note: dict) -> bool:
    import auth_service
    import mailer

    lock = _read_json_file(run_dir / "pulse.json") or {}
    email_cfg = lock.get("email") if isinstance(lock.get("email"), dict) else {}
    seller_email = str(
        lock.get("seller_email") or email_cfg.get("seller_email") or ""
    ).strip()
    if not seller_email:
        return False
    report = _read_json_file(run_dir / "presentation.json", {}) or {}
    brief = _read_json_file(run_dir / "pulse_brief.json") or _save_pulse_brief(run_dir, report, lock)
    user = _run_owner_user(run_dir.name)
    agent_name = str((user or {}).get("name") or (report.get("meta") or {}).get("agent_name") or "")
    agent_email = str((user or {}).get("email") or (report.get("meta") or {}).get("agent_email") or "").strip()
    sent = mailer.send_fingerprint_note(
        to=seller_email,
        note_body=str(note.get("body") or ""),
        brief=brief if isinstance(brief, dict) else {},
        agent_name=agent_name,
        reply_to=agent_email,
        as_of=str(note.get("as_of") or ""),
        seller_name=str(lock.get("seller_name") or ""),
        weekly_already_sent=_seller_got_weekly_recently(lock),
    )
    if sent:
        try:
            auth_service.log_event((user or {}).get("id"), f"fingerprint_note:{run_dir.name}", {"to": seller_email})
        except Exception:
            logger.exception("Fingerprint note email event log failed")
    return bool(sent)


@app.post("/api/runs/{run_id}/fingerprint/note")
async def save_fingerprint_note(run_id: str, request: Request):
    from core import _fingerprint_note_as_of, sanitize_fingerprint_note_body

    run_id = _safe_run_id(run_id)
    _reject_sample_mutation(run_id)
    _require_run_owner(request, run_id)
    run_dir = OUTPUT_DIR / run_id
    lock = _read_json_file(run_dir / "pulse.json") or {}
    if not lock:
        raise HTTPException(400, "Generate a Fingerprint before saving a note")
    try:
        body = await request.json()
    except Exception:
        body = {}
    if not isinstance(body, dict):
        body = {}
    action = str(body.get("action") or "save").strip().lower()
    if action not in ("save", "publish", "unpublish"):
        raise HTTPException(400, "action must be save, publish, or unpublish")
    send_now = bool(body.get("email"))
    email_cfg = lock.get("email") if isinstance(lock.get("email"), dict) else {}
    seller_email = str(lock.get("seller_email") or email_cfg.get("seller_email") or "").strip()
    if action == "publish" and send_now and not seller_email:
        raise HTTPException(400, "Add a seller email before sending this note")
    brief = _read_json_file(run_dir / "pulse_brief.json") or {}
    as_of = (
        _fingerprint_note_as_of(body.get("as_of"))
        or _fingerprint_note_as_of((brief or {}).get("as_of"))
        or datetime.now().strftime("%Y-%m-%d")
    )
    note_body = sanitize_fingerprint_note_body(body.get("body"))
    notes = _read_fingerprint_notes(run_dir)
    note = next((n for n in notes if n.get("as_of") == as_of), None)
    if note is None:
        note = {
            "as_of": as_of,
            "body": "",
            "status": "draft",
            "published_at": "",
            "emailed_at": "",
        }
        notes.append(note)
    if action == "unpublish":
        note["status"] = "draft"
        note["published_at"] = ""
        if note_body:
            note["body"] = note_body
    else:
        if note_body:
            note["body"] = note_body
        if action == "publish":
            if not note.get("body"):
                raise HTTPException(400, "Write a note before sharing with the seller")
            note["status"] = "published"
            note["published_at"] = datetime.now().isoformat(timespec="seconds")
        elif not note.get("body"):
            notes = [n for n in notes if n.get("as_of") != as_of]
            note = {"as_of": as_of, "body": "", "status": "draft", "published_at": "", "emailed_at": ""}
    notes = _write_fingerprint_notes(run_dir, notes)
    note = next((n for n in notes if n.get("as_of") == as_of), note)
    report = _read_json_file(run_dir / "presentation.json", {}) or {}
    _save_pulse_brief(run_dir, report, lock)
    emailed = False
    if action == "publish" and send_now and note.get("body"):
        emailed = _send_fingerprint_note_email(run_dir, note)
        if emailed:
            note["emailed_at"] = datetime.now().isoformat(timespec="seconds")
            for row in notes:
                if row.get("as_of") == as_of:
                    row["emailed_at"] = note["emailed_at"]
            notes = _write_fingerprint_notes(run_dir, notes)
            note = next((n for n in notes if n.get("as_of") == as_of), note)
            _save_pulse_brief(run_dir, report, lock)
    return {
        "ok": True,
        "note": note,
        "emailed": emailed,
        "notes": notes,
        **_pulse_payload(run_dir, report),
    }


@app.get("/api/runs/{run_id}/pulse-opt-out")
def pulse_email_opt_out(run_id: str, t: str = ""):
    run_id = _safe_run_id(run_id)
    expected = _pulse_opt_out_token(run_id)
    if not t or not hmac.compare_digest(str(t), expected):
        raise HTTPException(403, "Invalid opt-out link")
    run_dir = OUTPUT_DIR / run_id
    lock = _read_json_file(run_dir / "pulse.json") or {}
    email_cfg = lock.get("email") if isinstance(lock.get("email"), dict) else {}
    email_cfg["on"] = False
    lock["email"] = email_cfg
    if run_dir.exists():
        (run_dir / "pulse.json").write_text(json.dumps(lock, indent=2), encoding="utf-8")
    return HTMLResponse(
        "<!doctype html><html><body style='font-family:system-ui;padding:2rem'>"
        "<p>Weekly Market Fingerprint emails are stopped for this listing. The live page still updates if the market refreshes.</p>"
        "</body></html>"
    )


@app.post("/api/internal/pulse-briefs")
def internal_pulse_briefs(request: Request):
    secret = (os.environ.get("CRON_SECRET") or os.environ.get("SESSION_SECRET") or "").strip()
    got = (request.headers.get("x-cron-secret") or request.query_params.get("secret") or "").strip()
    user = _current_user(request)
    if secret and got == secret:
        pass
    elif user and (user.get("role") or "") == "admin":
        pass
    else:
        raise HTTPException(403, "Not allowed")
    return _run_pulse_briefs()


@app.get("/api/profile/copy")
def get_profile_copy(request: Request):
    import auth_service

    user = _require_user(request)
    return {"ok": True, "copy_defaults": auth_service.parse_copy_defaults(user.get("copy_defaults"))}


@app.post("/api/profile/copy")
async def save_profile_copy(request: Request):
    import auth_service

    user = _require_user(request)
    try:
        payload = await request.json()
    except Exception as exc:
        raise HTTPException(400, "Invalid JSON") from exc
    try:
        updated = auth_service.update_copy_defaults(user["id"], payload)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    return JSONResponse({
        "ok": True,
        "copy_defaults": auth_service.parse_copy_defaults(updated.get("copy_defaults")),
        "user": auth_service.public_user(updated),
    })


@app.post("/api/runs/{run_id}/scenarios")
async def save_run_scenario(run_id: str, request: Request):
    """Append a named appointment scenario (seller number / rating snapshot)."""
    run_id = _safe_run_id(run_id)
    run_dir = OUTPUT_DIR / run_id
    if not run_dir.exists():
        raise HTTPException(404, "Run not found")
    try:
        payload = await request.json()
    except Exception as exc:
        raise HTTPException(400, "Invalid JSON") from exc
    if isinstance(payload.get("name"), str):
        payload["name"] = html_lib.escape(payload["name"])[:120]
    path = run_dir / "scenarios.json"
    data = {"scenarios": []}
    if path.exists():
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            data = {"scenarios": []}
    scenarios = data.get("scenarios") or []
    scenarios.insert(0, payload)
    data["scenarios"] = scenarios[:40]
    path.write_text(json.dumps(data, indent=2), encoding="utf-8")
    return {"ok": True, "count": len(data["scenarios"])}


@app.get("/api/runs/{run_id}/scenarios")
def load_run_scenarios(run_id: str):
    run_id = _safe_run_id(run_id)
    path = OUTPUT_DIR / run_id / "scenarios.json"
    if not path.exists():
        return {"scenarios": []}
    return json.loads(path.read_text(encoding="utf-8"))


def _safe_mls(mls: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9_-]+", "", (mls or "").strip())[:40]
    if not cleaned:
        raise HTTPException(400, "Invalid MLS number")
    return cleaned


# Allow a reserved key for the subject home photo in the same photo map.
SUBJECT_PHOTO_MLS = "__subject__"
_photo_jobs: dict[str, threading.Thread] = {}
_photo_jobs_lock = threading.Lock()


def _host_subject_photo(
    run_id: str,
    run_dir: Path,
    *,
    upload_bytes: Optional[bytes] = None,
    upload_ext: str = ".jpg",
    remote_url: str = "",
) -> str:
    """Save an uploaded subject photo, or download an autofill URL into the run."""
    photos_dir = run_dir / "photos"
    photos_dir.mkdir(parents=True, exist_ok=True)
    ext = (upload_ext or ".jpg").lower()
    if ext not in {".jpg", ".jpeg", ".png", ".webp"}:
        ext = ".jpg"
    if ext == ".jpeg":
        ext = ".jpg"
    dest = photos_dir / f"{SUBJECT_PHOTO_MLS}{ext}"
    local_url = f"/runs/{run_id}/photos/{SUBJECT_PHOTO_MLS}{ext}"

    if upload_bytes:
        dest.write_bytes(upload_bytes)
        return local_url

    url = (remote_url or "").strip()
    if not url:
        return ""
    if url.startswith(f"/runs/{run_id}/photos/"):
        return url
    if not (url.startswith("http://") or url.startswith("https://")):
        return ""
    try:
        from reef_photos import _download_image

        ok = _download_image(url, dest)
        if ok and dest.exists():
            return local_url
    except Exception:
        logger.exception("Subject photo download failed")
    return ""


def _photo_map_path(run_dir: Path) -> Path:
    return run_dir / "comp_photos.json"


def _gallery_map_path(run_dir: Path) -> Path:
    return run_dir / "comp_galleries.json"


def _photos_status_path(run_dir: Path) -> Path:
    return run_dir / "photos_status.json"


def _load_photo_map(run_dir: Path) -> dict:
    path = _photo_map_path(run_dir)
    if not path.exists():
        return {}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def _save_photo_map(run_dir: Path, data: dict) -> None:
    _photo_map_path(run_dir).write_text(json.dumps(data, indent=2), encoding="utf-8")


def _load_gallery_map(run_dir: Path) -> dict:
    path = _gallery_map_path(run_dir)
    if not path.exists():
        return {}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def _save_gallery_map(run_dir: Path, data: dict) -> None:
    _gallery_map_path(run_dir).write_text(json.dumps(data, indent=2), encoding="utf-8")


_REMOTE_PHOTO_RE = re.compile(r"^https?://", re.I)


def _run_photo_health(run_dir: Path) -> tuple[int, int]:
    """(remote_photo_urls, missing_local_files) for a run's baked artifacts."""
    remote = 0
    missing = 0
    json_path = run_dir / "presentation.json"
    if not json_path.exists():
        return 0, 0
    try:
        report = json.loads(json_path.read_text(encoding="utf-8"))
    except Exception:
        return 0, 0

    def _check_url(url: object) -> None:
        nonlocal remote, missing
        if not isinstance(url, str) or not url:
            return
        if _REMOTE_PHOTO_RE.match(url):
            remote += 1
        elif url.startswith(f"/runs/{run_dir.name}/photos/"):
            if not (run_dir / "photos" / url.rsplit("/", 1)[-1]).exists():
                missing += 1

    def _walk_row(row: object) -> None:
        if not isinstance(row, dict):
            return
        for key in ("photo", "photo_url"):
            _check_url(row.get(key))
        for url in row.get("photos") or []:
            _check_url(url)

    _walk_row(report.get("subject"))
    for comp in (report.get("positioning") or {}).get("closest_comps") or []:
        _walk_row(comp)
    for url in _load_photo_map(run_dir).values():
        _check_url(url)
    for gallery in _load_gallery_map(run_dir).values():
        for url in gallery or []:
            _check_url(url)
    return remote, missing


def _rehost_remote_photos(run_id: str, run_dir: Path) -> int:
    """Download http(s) photo URLs into the run's photos dir and re-point JSON/HTML.

    Runs are self-contained after this: no dependence on Zillow/MLS CDN links that
    expire. No Reef credits spent — only URLs already on the report are fetched.
    """
    json_path = run_dir / "presentation.json"
    if not json_path.exists():
        return 0
    try:
        from reef_photos import _download_image
    except Exception:
        logger.exception("Photo module unavailable for rehost on %s", run_id)
        return 0
    try:
        report = json.loads(json_path.read_text(encoding="utf-8"))
    except Exception:
        return 0

    photos_dir = run_dir / "photos"
    photos_dir.mkdir(parents=True, exist_ok=True)
    hosted = 0
    url_cache: dict[str, str] = {}

    def _host(url: object, key: str, idx: int) -> object:
        nonlocal hosted
        if not isinstance(url, str) or not url or not _REMOTE_PHOTO_RE.match(url):
            return url
        if url in url_cache:
            return url_cache[url]
        safe = re.sub(r"[^A-Za-z0-9_-]+", "", key)[:48] or "photo"
        ext = ".jpg"
        low = url.lower().split("?")[0]
        for cand in (".png", ".webp", ".jpeg", ".jpg"):
            if low.endswith(cand):
                ext = ".jpg" if cand == ".jpeg" else cand
                break
        name = f"{safe}.jpg" if idx == 0 and ext == ".jpg" else f"{safe}_{idx:02d}{ext}"
        dest = photos_dir / name
        local_url = f"/runs/{run_id}/photos/{name}"
        ok = dest.exists() and dest.stat().st_size > 800
        if not ok:
            ok = _download_image(url, dest)
        if ok:
            hosted += 1
            url_cache[url] = local_url
            return local_url
        return url

    def _fix_row(row: object, key: str) -> None:
        if not isinstance(row, dict):
            return
        for field in ("photo", "photo_url"):
            if row.get(field):
                row[field] = _host(row[field], key, 0)
        if isinstance(row.get("photos"), list):
            row["photos"] = [_host(u, key, i) for i, u in enumerate(row["photos"])]

    _fix_row(report.get("subject"), SUBJECT_PHOTO_MLS)
    for comp in (report.get("positioning") or {}).get("closest_comps") or []:
        if isinstance(comp, dict):
            _fix_row(comp, str(comp.get("mls_number") or comp.get("address") or "comp"))

    photos = _load_photo_map(run_dir)
    if photos:
        photos = {k: _host(v, k, 0) for k, v in photos.items()}
        _save_photo_map(run_dir, photos)
    galleries = _load_gallery_map(run_dir)
    if galleries:
        galleries = {k: [_host(u, k, i) for i, u in enumerate(gallery or [])] for k, gallery in galleries.items()}
        _save_gallery_map(run_dir, galleries)

    if hosted:
        json_path.write_text(json.dumps(report, indent=2, default=str), encoding="utf-8")
        try:
            _save_html(report, run_dir / "presentation.html")
        except Exception:
            logger.exception("Rehost rebake failed for %s", run_id)
        logger.info("Rehosted %d remote photos for %s", hosted, run_id)
    return hosted


_rehost_jobs: dict[str, threading.Thread] = {}
_rehost_lock = threading.Lock()


def _start_rehost(run_id: str, run_dir: Path) -> bool:
    with _rehost_lock:
        existing = _rehost_jobs.get(run_id)
        if existing and existing.is_alive():
            return False
        t = threading.Thread(target=_rehost_remote_photos, args=(run_id, run_dir), name=f"rehost-{run_id[:20]}", daemon=True)
        _rehost_jobs[run_id] = t
        t.start()
        return True


def _photo_maintenance_sweep(max_rehost: int = 3, max_enrich: int = 1) -> dict:
    """Keep every saved report self-contained: re-host remote photo URLs, refill
    missing local photo files from the volume cache. Sample run goes first."""
    rehosted = 0
    enriched = 0
    scanned = 0
    try:
        run_dirs = sorted(
            (d for d in OUTPUT_DIR.iterdir() if d.is_dir() and (d / "presentation.json").exists()),
            key=lambda d: d.stat().st_mtime,
            reverse=True,
        )[:60]
    except OSError:
        return {"scanned": 0, "rehosted": 0, "enriched": 0}
    run_dirs.sort(key=lambda d: 0 if d.name == SAMPLE_RUN_ID else 1)
    for run_dir in run_dirs:
        scanned += 1
        remote, missing = _run_photo_health(run_dir)
        if remote and rehosted < max_rehost:
            if _start_rehost(run_dir.name, run_dir):
                rehosted += 1
        elif missing and enriched < max_enrich:
            if _start_background_photos(run_dir.name, run_dir):
                enriched += 1
    return {"scanned": scanned, "rehosted": rehosted, "enriched": enriched}


def _load_photos_status(run_dir: Path) -> dict:
    path = _photos_status_path(run_dir)
    if not path.exists():
        return {"status": "ready", "done": 0, "total": 0, "message": ""}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {"status": "ready"}
    except Exception:
        return {"status": "ready"}


def _write_photos_status(run_dir: Path, **fields) -> dict:
    cur = _load_photos_status(run_dir)
    cur.update(fields)
    cur["updated_at"] = time.time()
    _photos_status_path(run_dir).write_text(json.dumps(cur, indent=2), encoding="utf-8")
    return cur


def _expected_photo_targets(report: dict) -> int:
    pos = report.get("positioning") or {}
    comps = list(pos.get("closest_comps") or [])[:8]
    n = sum(1 for c in comps if isinstance(c, dict) and (c.get("mls_number") or c.get("address")))
    sub = report.get("subject") or {}
    if isinstance(sub, dict) and (sub.get("address") or "").strip():
        n += 1
    return n


def _background_photo_enrich(run_id: str, run_dir: Path) -> None:
    """Full Reef enrich after generate returns — updates maps as listings finish."""
    json_path = run_dir / "presentation.json"
    try:
        from reef_photos import enrich_report_photos, reef_enabled

        if not reef_enabled() or not json_path.exists():
            _write_photos_status(run_dir, status="ready", message="Photo fetch skipped")
            return
        report = json.loads(json_path.read_text(encoding="utf-8"))
        extras = _fingerprint_photo_targets(run_dir)
        total = _expected_photo_targets(report) + len(extras)
        _write_photos_status(
            run_dir,
            status="fetching",
            done=0,
            total=total,
            message="Fetching listing photos…",
        )
        existing = _load_photo_map(run_dir)
        galleries = _load_gallery_map(run_dir)
        done_box = {"n": len([v for v in existing.values() if v])}

        def on_listing(key: str, primary_url: str, gallery_urls: list) -> None:
            existing[key] = primary_url
            if gallery_urls:
                galleries[key] = gallery_urls
            _save_photo_map(run_dir, existing)
            _save_gallery_map(run_dir, galleries)
            done_box["n"] = len([v for v in existing.values() if v])
            _write_photos_status(
                run_dir,
                status="fetching",
                done=done_box["n"],
                total=total,
                message=f"Fetching listing photos… {done_box['n']}/{total}",
            )

        photo_map = enrich_report_photos(
            report,
            run_dir=run_dir,
            run_id=run_id,
            cache_only=False,
            deadline=time.time() + 900,
            on_listing=on_listing,
            extra_listings=extras,
        )
        merged = {**existing, **{k: v for k, v in photo_map.items() if v}}
        for extra in extras or []:
            if not isinstance(extra, dict):
                continue
            mls = str(extra.get("mls") or extra.get("id") or extra.get("mls_number") or "").strip()
            addr = str(extra.get("address") or "").strip()
            compact = "".join(ch for ch in addr if ch.isalnum() or ch in "-_")[:48]
            url = merged.get(mls) or merged.get(addr) or merged.get(compact)
            if not url:
                continue
            for key in (mls, addr, compact):
                if key and key not in merged:
                    merged[key] = url
            gal = galleries.get(mls) or galleries.get(addr) or galleries.get(compact)
            if gal:
                for key in (mls, addr, compact):
                    if key and key not in galleries:
                        galleries[key] = gal
        _save_photo_map(run_dir, merged)
        # Galleries from report rows
        for c in (report.get("positioning") or {}).get("closest_comps") or []:
            if not isinstance(c, dict):
                continue
            mls = str(c.get("mls_number") or "").strip()
            photos = c.get("photos") or []
            if mls and photos:
                galleries[mls] = list(photos)
        sub = report.get("subject") or {}
        if isinstance(sub, dict) and (sub.get("photos") or sub.get("photo_url")):
            galleries[SUBJECT_PHOTO_MLS] = list(sub.get("photos") or [sub.get("photo_url")])
        _save_gallery_map(run_dir, galleries)
        json_path.write_text(json.dumps(report, indent=2, default=str), encoding="utf-8")
        try:
            _save_html(report, run_dir / "presentation.html")
        except Exception:
            logger.exception("Failed to rewrite HTML after background photos for %s", run_id)
        lock = _read_json_file(run_dir / "pulse.json")
        snap = _read_json_file(run_dir / "pulse_snapshot.json")
        if isinstance(snap, dict) and isinstance(snap.get("listings"), list):
            try:
                from core import apply_listing_photos
                snap["listings"] = apply_listing_photos(snap["listings"], merged, galleries)
                (run_dir / "pulse_snapshot.json").write_text(
                    json.dumps(snap, indent=2, default=str),
                    encoding="utf-8",
                )
            except Exception:
                logger.exception("Failed to persist Fingerprint photos onto snapshot for %s", run_id)
        if isinstance(lock, dict) and lock.get("locked_price"):
            try:
                _save_pulse_brief(run_dir, report, lock, snap if isinstance(snap, dict) else None)
            except Exception:
                logger.exception("Failed to refresh Fingerprint brief after photos for %s", run_id)
        count = len([v for v in merged.values() if v])
        _write_photos_status(
            run_dir,
            status="ready",
            done=count,
            total=total,
            message=f"Photos ready ({count})",
        )
        logger.info("Background photo enrich complete for %s (%d photos)", run_id, count)
    except Exception:
        logger.exception("Background photo enrich failed for %s", run_id)
        _write_photos_status(run_dir, status="error", message="Photo fetch failed")
    finally:
        with _photo_jobs_lock:
            _photo_jobs.pop(run_id, None)


def _start_background_photos(run_id: str, run_dir: Path) -> bool:
    with _photo_jobs_lock:
        existing = _photo_jobs.get(run_id)
        if existing and existing.is_alive():
            return False
        t = threading.Thread(
            target=_background_photo_enrich,
            args=(run_id, run_dir),
            name=f"photos-{run_id[:20]}",
            daemon=True,
        )
        _photo_jobs[run_id] = t
        t.start()
        return True


@app.post("/api/runs/{run_id}/comp-photos/fetch")
def fetch_run_comp_photos(run_id: str):
    """Start (or re-start) background Zillow photo backfill for a run."""
    run_id = _safe_run_id(run_id)
    run_dir = OUTPUT_DIR / run_id
    json_path = run_dir / "presentation.json"
    if not json_path.exists():
        raise HTTPException(404, "Run not found")
    try:
        from reef_photos import reef_enabled
    except Exception as exc:
        raise HTTPException(500, f"Photo module unavailable: {exc}") from exc
    if not reef_enabled():
        raise HTTPException(400, "REEF_API_KEY is not configured on this service")
    photos = _load_photo_map(run_dir)
    snap = _read_json_file(run_dir / "pulse_snapshot.json")
    if run_id == SAMPLE_RUN_ID and photos and not _fingerprint_needs_photos(snap, photos):
        _write_photos_status(run_dir, status="ready", message="")
        status = _load_photos_status(run_dir)
        return {
            "ok": True,
            "started": False,
            "status": "ready",
            "photos": photos,
            "galleries": _load_gallery_map(run_dir),
            "done": status.get("done", 0),
            "total": status.get("total", 0),
            "message": "",
        }
    started = _start_background_photos(run_id, run_dir)
    status = _load_photos_status(run_dir)
    if started:
        _write_photos_status(run_dir, status="fetching", message="Fetching listing photos…")
        status = _load_photos_status(run_dir)
    return {
        "ok": True,
        "started": started,
        "status": status.get("status"),
        "photos": _load_photo_map(run_dir),
        "galleries": _load_gallery_map(run_dir),
        "done": status.get("done", 0),
        "total": status.get("total", 0),
        "message": status.get("message") or "",
    }


@app.get("/api/runs/{run_id}/comp-photos")
def list_comp_photos(run_id: str):
    run_id = _safe_run_id(run_id)
    run_dir = OUTPUT_DIR / run_id
    if not run_dir.exists():
        raise HTTPException(404, "Run not found")
    status = _load_photos_status(run_dir)
    photos = _load_photo_map(run_dir)
    snap = _read_json_file(run_dir / "pulse_snapshot.json")
    st = (status.get("status") or "ready").lower()
    if run_id == SAMPLE_RUN_ID and photos and not _fingerprint_needs_photos(snap, photos):
        st = "ready"
    return {
        "photos": photos,
        "galleries": _load_gallery_map(run_dir),
        "status": st or "ready",
        "done": status.get("done", 0),
        "total": status.get("total", 0),
        "message": "" if st == "ready" else (status.get("message") or ""),
    }

@app.post("/api/runs/{run_id}/comp-photos")
async def set_comp_photo_url(run_id: str, request: Request):
    """Save a remote/listing photo URL for an MLS number (agent paste from Matrix)."""
    run_id = _safe_run_id(run_id)
    run_dir = OUTPUT_DIR / run_id
    if not run_dir.exists():
        raise HTTPException(404, "Run not found")
    try:
        payload = await request.json()
    except Exception as exc:
        raise HTTPException(400, "Invalid JSON") from exc
    mls = _safe_mls(str(payload.get("mls") or ""))
    url = str(payload.get("url") or "").strip()
    if url and not (url.startswith("http://") or url.startswith("https://") or url.startswith(f"/runs/{run_id}/photos/")):
        raise HTTPException(400, "Photo URL must be http(s) or a run photo path")
    photos = _load_photo_map(run_dir)
    if not url:
        photos.pop(mls, None)
    else:
        photos[mls] = url[:2000]
    _save_photo_map(run_dir, photos)
    return {"ok": True, "mls": mls, "url": photos.get(mls, "")}


@app.post("/api/runs/{run_id}/comp-photos/{mls}/upload")
async def upload_comp_photo(run_id: str, mls: str, file: UploadFile = File(...)):
    """Upload a listing photo file for a comparable (from MLS Matrix download)."""
    run_id = _safe_run_id(run_id)
    mls = _safe_mls(mls)
    run_dir = OUTPUT_DIR / run_id
    if not run_dir.exists():
        raise HTTPException(404, "Run not found")
    content_type = (file.content_type or "").lower()
    ext = {
        "image/jpeg": ".jpg",
        "image/jpg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
        "image/gif": ".gif",
    }.get(content_type)
    if not ext:
        name = (file.filename or "").lower()
        if name.endswith((".jpg", ".jpeg")):
            ext = ".jpg"
        elif name.endswith(".png"):
            ext = ".png"
        elif name.endswith(".webp"):
            ext = ".webp"
        else:
            raise HTTPException(400, "Upload a JPG, PNG, or WebP photo")
    raw = await file.read()
    if len(raw) > 8 * 1024 * 1024:
        raise HTTPException(400, "Photo too large (max 8MB)")
    photos_dir = run_dir / "photos"
    photos_dir.mkdir(parents=True, exist_ok=True)
    # Clear prior extensions for this MLS
    for old in photos_dir.glob(f"{mls}.*"):
        try:
            old.unlink()
        except OSError:
            pass
    dest = photos_dir / f"{mls}{ext}"
    dest.write_bytes(raw)
    url = f"/runs/{run_id}/photos/{mls}{ext}"
    photos = _load_photo_map(run_dir)
    photos[mls] = url
    _save_photo_map(run_dir, photos)
    return {"ok": True, "mls": mls, "url": url}


@app.get("/runs/{run_id}/photos/{filename}")
def serve_comp_photo(run_id: str, filename: str):
    run_id = _safe_run_id(run_id)
    safe_name = Path(filename).name
    if not re.match(r"^[A-Za-z0-9_-]+\.(jpg|jpeg|png|webp|gif)$", safe_name, re.I):
        raise HTTPException(400, "Invalid photo filename")
    path = OUTPUT_DIR / run_id / "photos" / safe_name
    if not path.exists():
        raise HTTPException(404, "Photo not found")
    return FileResponse(path)


@app.get("/api/demo-export")
def demo_export_info():
    return {
        "available": DEMO_EXPORT.exists(),
        "filename": DEMO_EXPORT.name if DEMO_EXPORT.exists() else None,
    }


@app.get("/api/portal/defaults")
def portal_defaults(request: Request):
    _require_user(request)
    from portal_market import DEFAULT_PORTAL_CRITERIA, _mapbox_token

    return {
        "criteria": dict(DEFAULT_PORTAL_CRITERIA),
        "mapbox_token": _mapbox_token(),
        "dwelling_options": [
            {"value": "detached", "label": "House (detached)"},
            {"value": "attached", "label": "Condo + Townhome (attached)"},
        ],
    }


@app.post("/api/portal/geocode")
async def portal_geocode(request: Request):
    _require_user(request)
    body = await request.json()
    query = str((body or {}).get("query") or "").strip()
    if not query:
        raise HTTPException(400, "query required")
    from portal_market import geocode_location

    try:
        return geocode_location(query)
    except Exception as exc:
        raise HTTPException(400, f"Geocode failed: {exc}") from exc


@app.post("/api/portal/subject")
async def portal_subject(request: Request):
    """Autofill subject beds/baths/sqft/year from a typed/selected address."""
    _require_user(request)
    body = await request.json()
    query = str((body or {}).get("query") or (body or {}).get("address") or "").strip()
    if not query:
        raise HTTPException(400, "address required")
    from portal_market import lookup_subject_property

    try:
        return await asyncio.to_thread(lookup_subject_property, query)
    except Exception as exc:
        logger.exception("Subject lookup failed")
        raise HTTPException(400, f"Subject lookup failed: {exc}") from exc


@app.post("/api/portal/preview")
async def portal_preview(request: Request):
    """Pull portal market for criteria + map; return counts only (no full report)."""
    _require_user(request)
    body = await request.json()
    if not isinstance(body, dict):
        raise HTTPException(400, "JSON body required")
    from market_schema import market_preview_stats
    from portal_market import build_portal_from_criteria, parse_portal_criteria

    criteria = parse_portal_criteria(body.get("criteria") or body)
    if body.get("location"):
        criteria["location"] = body["location"]
    if body.get("map_bounds"):
        criteria["map_bounds"] = body["map_bounds"]
    if body.get("polygon_ring"):
        criteria["polygon_ring"] = body["polygon_ring"]
    if not str(criteria.get("location") or "").strip():
        raise HTTPException(400, "location required (city, ZIP, or area)")

    try:
        df = await asyncio.to_thread(build_portal_from_criteria, criteria, mode="preview")
    except TypeError:
        # Older signature safety
        df = await asyncio.to_thread(build_portal_from_criteria, criteria)
    except Exception as exc:
        from portal_market import friendly_portal_error

        logger.exception("Portal preview failed")
        raise HTTPException(400, friendly_portal_error(exc)) from exc

    stats = market_preview_stats(df)
    return {
        "ok": True,
        "criteria": criteria,
        "preview": stats,
    }


@app.post("/api/export/inspect")
async def export_inspect(
    request: Request,
    export_file: UploadFile = File(...),
):
    """Smart-map an uploaded MLS file and return header mapping + confidence."""
    _require_user(request)
    from export_mapper import inspect_export

    suffix = Path(export_file.filename or "export.txt").suffix.lower() or ".txt"
    if suffix not in {".txt", ".csv", ".tsv"}:
        raise HTTPException(400, "Export must be .txt, .csv, or .tsv")
    content = await export_file.read()
    if not content.strip():
        raise HTTPException(400, "Uploaded file is empty")
    path = UPLOAD_DIR / f"{uuid.uuid4().hex}-inspect{suffix}"
    try:
        path.write_bytes(content)
        return inspect_export(path)
    except Exception as exc:
        raise HTTPException(400, f"Could not inspect export: {exc}") from exc
    finally:
        try:
            path.unlink(missing_ok=True)
        except OSError:
            pass


@app.get("/api/export/inspect-sample")
def export_inspect_sample(request: Request):
    """Inspect the bundled sample export for mapping review UX."""
    _require_user(request)
    if not DEMO_EXPORT.exists():
        raise HTTPException(400, "Sample export missing")
    from export_mapper import inspect_export

    return inspect_export(DEMO_EXPORT)


@app.post("/api/generate")
async def generate(
    request: Request,
    export_file: Optional[UploadFile] = File(None),
    export_files: Optional[List[UploadFile]] = File(None),
    use_sample_export: str = Form("false"),
    market_source: str = Form("mls"),
    portal_criteria: str = Form(""),
    column_map: str = Form(""),
    address: str = Form(...),
    living_area: Optional[str] = Form(None),
    beds: Optional[str] = Form(None),
    baths: Optional[str] = Form(None),
    year_built: Optional[str] = Form(None),
    garage_spaces: Optional[str] = Form(None),
    lot_size: Optional[str] = Form(None),
    acres: Optional[str] = Form(None),
    subdivision: Optional[str] = Form(None),
    style: Optional[str] = Form(None),
    subject_photo_url: Optional[str] = Form(None),
    subject_lat: Optional[str] = Form(None),
    subject_lng: Optional[str] = Form(None),
    condition: str = Form("average"),
    list_price: Optional[str] = Form(None),
    mls_number: Optional[str] = Form(None),
    city_filter: str = Form(""),
    area_name: str = Form("Custom market"),
    market_notes: str = Form(""),
    agent_name: str = Form("Adam Schwartz"),
    agent_phone: str = Form("(970) 533-3990"),
    agent_email: str = Form("adam@saahomes.com"),
    brokerage: str = Form("Schwartz and Associates, Coldwell Banker Realty"),
    brand_primary: str = Form("#0c3c6e"),
    brand_accent: str = Form("#1a5f9e"),
    seller_name: str = Form(""),
    seller_email: str = Form(""),
    logo: Optional[UploadFile] = File(None),
    subject_photo: Optional[UploadFile] = File(None),
):
    import auth_service

    user = _require_user(request)
    ent = auth_service.entitlement(user)
    if not ent["ok"]:
        raise HTTPException(
            status_code=402,
            detail={
                "message": "Unlock this presentation — start a 7-day trial ($39/mo after) or buy this report for $20. Sample demo stays free.",
                "reason": ent.get("reason") or "payment_required",
                "entitlement": ent,
            },
        )

    use_sample = use_sample_export.lower() in {"1", "true", "yes", "on"}
    source = (market_source or "mls").strip().lower()
    if source in ("portal", "realtor", "public"):
        source = "portal"
    else:
        source = "mls"

    export_path: Optional[Path] = None
    cleanup_paths: list[Path] = []
    logo_url = ""
    market_df = None
    criteria = None
    data_source = "mls_export"
    rename_overrides = None
    if column_map and column_map.strip():
        try:
            rename_overrides = json.loads(column_map)
            if not isinstance(rename_overrides, dict):
                rename_overrides = None
        except json.JSONDecodeError:
            rename_overrides = None

    if logo and logo.filename:
        raw = await logo.read()
        if len(raw) > 2 * 1024 * 1024:
            raise HTTPException(400, "Logo must be under 2MB")
        suffix = Path(logo.filename).suffix.lower()
        if suffix not in {".png", ".jpg", ".jpeg", ".webp", ".svg"}:
            raise HTTPException(400, "Logo must be png, jpg, webp, or svg")
        logo_name = f"{uuid.uuid4().hex}{suffix}"
        logo_path = BRANDING_DIR / logo_name
        logo_path.write_bytes(raw)
        logo_url = f"/branding/{logo_name}"

    if source == "portal":
        data_source = "realtor"
        try:
            criteria_raw = json.loads(portal_criteria) if portal_criteria.strip() else {}
        except json.JSONDecodeError as exc:
            raise HTTPException(400, "portal_criteria must be valid JSON") from exc
        from portal_market import build_portal_from_criteria, parse_portal_criteria

        criteria = parse_portal_criteria(criteria_raw)
        if not str(criteria.get("location") or "").strip():
            # Fall back to city_filter or address locality
            criteria["location"] = (city_filter or address or "").strip()
        if not str(criteria.get("location") or "").strip():
            raise HTTPException(400, "Portal mode needs a location (city/ZIP) in criteria")
        try:
            market_df = await asyncio.to_thread(
                build_portal_from_criteria, criteria, mode="generate"
            )
        except Exception as exc:
            from portal_market import friendly_portal_error

            logger.exception("Portal generate pull failed")
            raise HTTPException(400, friendly_portal_error(exc)) from exc
        if market_df is None or len(market_df) == 0:
            raise HTTPException(400, "No portal listings matched those filters / map")
        # Persist a pipe snapshot so photo/enrich paths that expect a file still work
        export_path = UPLOAD_DIR / f"{uuid.uuid4().hex}-portal.txt"
        market_df.to_csv(export_path, sep="|", index=False)
        cleanup_paths.append(export_path)
        if not area_name or area_name == "Custom market":
            area_name = str(criteria.get("location") or "Search market").strip()
        # Keep agent market_notes as provided — no source disclosure injected.
    elif use_sample:
        if not DEMO_EXPORT.exists():
            raise HTTPException(400, "Sample export missing")
        export_path = DEMO_EXPORT
        data_source = "mls_export"
    else:
        uploads: list[UploadFile] = []
        if export_files:
            uploads.extend([f for f in export_files if f and f.filename])
        if export_file and export_file.filename:
            if not any(f.filename == export_file.filename for f in uploads):
                uploads.append(export_file)
        if not uploads:
            raise HTTPException(400, "Upload a market export, enable sample, or use Search")
        if len(uploads) > 3:
            raise HTTPException(400, "Upload up to 3 export files at a time")

        saved_paths: list[Path] = []
        total_bytes = 0
        for upload in uploads:
            suffix = Path(upload.filename or "export.txt").suffix.lower() or ".txt"
            if suffix not in {".txt", ".csv", ".tsv"}:
                raise HTTPException(400, "Export must be .txt, .csv, or .tsv")
            content = await upload.read()
            if len(content) > MAX_UPLOAD_BYTES:
                raise HTTPException(400, "Each export file must be 15MB or smaller")
            total_bytes += len(content)
            if total_bytes > MAX_UPLOAD_BYTES * 2:
                raise HTTPException(400, "Combined exports must be 30MB or smaller")
            if not content.strip():
                raise HTTPException(400, f"Uploaded file is empty: {upload.filename}")
            try:
                sample = content[:4000].decode("utf-8", errors="strict")
            except UnicodeDecodeError as exc:
                raise HTTPException(400, "Export must be a text file") from exc
            if "|" not in sample and "\t" not in sample and "," not in sample:
                raise HTTPException(400, "Export does not look like a delimited MLS file")
            path = UPLOAD_DIR / f"{uuid.uuid4().hex}{suffix}"
            path.write_bytes(content)
            saved_paths.append(path)
            cleanup_paths.append(path)

        from export_mapper import load_mapped_export
        from core import load_exports

        if len(saved_paths) == 1:
            try:
                market_df, map_result = load_mapped_export(
                    saved_paths[0], rename_overrides=rename_overrides
                )
            except Exception as exc:
                raise HTTPException(400, f"Could not map export headers: {exc}") from exc
            if map_result.missing_required and not rename_overrides:
                raise HTTPException(
                    status_code=400,
                    detail={
                        "message": "Confirm column mapping for required fields before generating.",
                        "mapping": map_result.to_dict(),
                    },
                )
            if map_result.needs_review and not rename_overrides and map_result.confidence < 0.85:
                raise HTTPException(
                    status_code=400,
                    detail={
                        "message": "Please review and confirm column mapping before generating.",
                        "mapping": map_result.to_dict(),
                    },
                )
            export_path = saved_paths[0]
            # Write normalized pipe for downstream tools
            norm_path = UPLOAD_DIR / f"{uuid.uuid4().hex}-mapped.txt"
            market_df.to_csv(norm_path, sep="|", index=False)
            cleanup_paths.append(norm_path)
            export_path = norm_path
        else:
            try:
                frames = []
                for p in saved_paths:
                    df_i, _ = load_mapped_export(p, rename_overrides=rename_overrides)
                    frames.append(df_i)
                import pandas as pd

                merged = pd.concat(frames, ignore_index=True, sort=False)
                if "MLSNumber" in merged.columns:
                    sort_cols = [c for c in ("LastUpdateDate", "ListDate", "SoldDate") if c in merged.columns]
                    if sort_cols:
                        merged = merged.sort_values(sort_cols, ascending=False, na_position="last")
                    merged = merged.drop_duplicates(subset=["MLSNumber"], keep="first")
                market_df = merged.reset_index(drop=True)
            except Exception as exc:
                raise HTTPException(400, f"Could not merge exports: {exc}") from exc
            export_path = UPLOAD_DIR / f"{uuid.uuid4().hex}-merged.txt"
            market_df.to_csv(export_path, sep="|", index=False)
            cleanup_paths.append(export_path)
        data_source = "mls_export"

    subject_photo_bytes = None
    subject_photo_ext = ".jpg"
    if subject_photo and subject_photo.filename:
        raw_photo = await subject_photo.read()
        if len(raw_photo) > 8 * 1024 * 1024:
            raise HTTPException(400, "Subject photo must be under 8MB")
        suffix = Path(subject_photo.filename).suffix.lower() or ".jpg"
        if suffix not in {".png", ".jpg", ".jpeg", ".webp"}:
            raise HTTPException(400, "Subject photo must be png, jpg, or webp")
        subject_photo_bytes = raw_photo
        subject_photo_ext = ".jpg" if suffix == ".jpeg" else suffix

    lot_sqft = _optional_float(lot_size)
    acres_val = _optional_float(acres)
    if lot_sqft is None and acres_val is not None:
        lot_sqft = acres_val * 43560.0
    if acres_val is None and lot_sqft is not None:
        acres_val = lot_sqft / 43560.0

    try:
        t0 = time.time()
        result = await asyncio.to_thread(
            _generate,
            export_path,
            address=address,
            living_area=_optional_float(living_area),
            beds=_optional_float(beds),
            baths=_optional_float(baths),
            year_built=int(float(year_built)) if year_built not in (None, "") else None,
            condition=condition,
            list_price=_optional_float(list_price),
            mls_number=mls_number.strip() if mls_number else None,
            garage_spaces=_optional_float(garage_spaces),
            lot_size=lot_sqft,
            acres=acres_val,
            subdivision=(subdivision or "").strip() or None,
            style=(style or "").strip() or None,
            photo_url=(subject_photo_url or "").strip() or None,
            latitude=_optional_float(subject_lat),
            longitude=_optional_float(subject_lng),
            city_filter=city_filter,
            area_name=area_name,
            market_notes=market_notes,
            agent_name=agent_name,
            agent_phone=agent_phone,
            agent_email=agent_email,
            brokerage=brokerage,
            brand_primary=brand_primary.strip(),
            brand_accent=brand_accent.strip(),
            logo_url=logo_url,
            market_df=market_df,
            data_source=data_source,
            subject_photo_bytes=subject_photo_bytes,
            subject_photo_ext=subject_photo_ext,
            copy_defaults=auth_service.parse_copy_defaults(user.get("copy_defaults")),
            portal_criteria=criteria if source == "portal" else None,
        )
        logger.info("Generate finished in %.1fs for %s source=%s", time.time() - t0, address, data_source)
    except HTTPException:
        raise
    except Exception:
        logger.exception("Generation failed")
        raise HTTPException(status_code=500, detail="Generation failed. Check the export and try again.") from None
    finally:
        if not use_sample:
            for path in cleanup_paths:
                if path.exists() and path.parent == UPLOAD_DIR:
                    try:
                        path.unlink()
                    except OSError:
                        pass

    after = auth_service.increment_presentation(user["id"])
    result = dict(result)
    try:
        run_dir = OUTPUT_DIR / result["run_id"]
        sn = html_lib.escape((seller_name or "").strip())[:120]
        se = (seller_email or "").strip()
        if se and not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", se):
            se = ""
        if sn or se:
            lock = _read_json_file(run_dir / "pulse.json", {}) or {}
            if lock:
                if sn:
                    lock["seller_name"] = sn
                if se:
                    lock["seller_email"] = se
                    email_cfg = lock.get("email") if isinstance(lock.get("email"), dict) else {}
                    email_cfg["seller_email"] = se
                    email_cfg.setdefault("on", False)
                    lock["email"] = email_cfg
                (run_dir / "pulse.json").write_text(json.dumps(lock, indent=2), encoding="utf-8")
        presentation_html = ""
        deck_html = ""
        try:
            presentation_html = (run_dir / "presentation.html").read_text(encoding="utf-8")
        except Exception:
            pass
        try:
            deck_html = (run_dir / "deck.html").read_text(encoding="utf-8")
        except Exception:
            pass
        saved = auth_service.save_presentation(
            user["id"],
            run_id=result["run_id"],
            address=address or "",
            recommended_price=result.get("recommended_price"),
            months_of_inventory=result.get("months_of_inventory"),
            active_count=result.get("active_count"),
            under_contract_count=result.get("under_contract_count"),
            title=address or "",
            presentation_html=presentation_html or None,
            deck_html=deck_html or None,
        )
        result["presentation_id"] = saved.get("id")
        result["share_url"] = saved.get("share_url") or result.get("share_url")
        result["share_token"] = saved.get("share_token")
        result["saved"] = True
        result["fingerprint_url"] = f"/runs/{result['run_id']}/fingerprint/"
        result["agent_fingerprint_url"] = f"/runs/{result['run_id']}/fingerprint/"
        token = saved.get("share_token") or ""
        if token:
            result["fingerprint_url"] = f"/p/{token}/fingerprint/"
        # Sidecar for public share endpoint / recovery
        try:
            run_dir = OUTPUT_DIR / result["run_id"]
            (run_dir / "share.json").write_text(
                json.dumps(
                    {
                        "share_token": saved.get("share_token"),
                        "share_url": saved.get("share_url"),
                        "user_id": user["id"],
                    },
                    indent=2,
                ),
                encoding="utf-8",
            )
        except Exception:
            logger.exception("Failed to write share.json for %s", result.get("run_id"))
    except Exception:
        logger.exception("Failed to save presentation metadata for %s", result.get("run_id"))
        result["saved"] = False
    result["entitlement"] = after
    result["access_remaining"] = after.get("remaining")
    return JSONResponse(result)


@app.get("/branding/{filename}")
def branding_file(filename: str):
    if not re.fullmatch(r"[A-Za-z0-9._-]+", filename or ""):
        raise HTTPException(404, "Not found")
    path = BRANDING_DIR / filename
    if not path.exists():
        raise HTTPException(404, "Not found")
    return FileResponse(path)


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", "8787"))
    uvicorn.run("server:app", host="0.0.0.0", port=port, reload=False)
