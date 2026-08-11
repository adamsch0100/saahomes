#!/usr/bin/env python
"""ListLogic web app — upload MLS export, generate presentation."""
from __future__ import annotations

import asyncio
import hashlib
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
from datetime import datetime
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
        "/api/billing/config",
        "/api/billing/webhook",
        "/favicon.ico",
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
        "/saas/ll.css",
        "/saas/vendor/",
        "/saas/feedback.js",
        "/saas/assistant.js",
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
            and path.endswith(("/share", "/edits", "/scenarios", "/comp-photos"))
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
    export_path: Path,
    *,
    address: str,
    living_area: Optional[float],
    beds: Optional[float],
    baths: Optional[float],
    year_built: Optional[int],
    condition: str,
    list_price: Optional[float],
    mls_number: Optional[str],
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
) -> dict:
    defaults = dict(SUBJECT_2845_DEFAULTS) if "2845" in (address or "") and "13" in (address or "") else {}
    overrides = {
        "condition": condition or "average",
        "living_area": living_area,
        "beds": beds,
        "baths": baths,
        "year_built": year_built,
        "list_price": list_price,
    }
    overrides = {k: v for k, v in overrides.items() if v is not None}

    subject = resolve_subject(
        str(export_path),
        address=address or None,
        mls_number=mls_number or None,
        defaults=defaults or None,
        overrides=overrides,
    )
    if living_area:
        subject.living_area = float(living_area)

    report = _build_presentation(
        export_path=str(export_path),
        subject=subject,
        area_name=area_name or "Custom market",
        city_filter=city_filter or "",
        agent_name=agent_name or "Your Agent",
        agent_phone=agent_phone or "",
        agent_email=agent_email or "",
        brokerage=brokerage or "",
        market_notes=market_notes or "",
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

    if force_run_id:
        run_id = _safe_run_id(force_run_id)
        run_dir = OUTPUT_DIR / run_id
        if run_dir.exists():
            shutil.rmtree(run_dir, ignore_errors=True)
        run_dir.mkdir(parents=True, exist_ok=True)
    else:
        run_id = f"{datetime.now().strftime('%Y%m%d-%H%M%S')}-{_slug(address)}-{uuid.uuid4().hex[:8]}"
        run_dir = OUTPUT_DIR / run_id
        run_dir.mkdir(parents=True, exist_ok=True)

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
    return RedirectResponse(url="/saas/")


@app.get("/favicon.ico")
def favicon():
    return FileResponse(ROOT / "saas" / "listlogic-logo.png", media_type="image/png")


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
 · <a href="/demo">Try the sample</a></p>
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


@app.get("/api/billing/config")
def billing_config():
    import stripe_billing

    return stripe_billing.public_plans()


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
                "Access codes are retired. Create a free trial account or sign in with email.",
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
    return {
        "ok": True,
        "email": info.get("email") or "",
        "brokerage": info.get("brokerage") or "",
        "trial_days": info.get("trial_days"),
        "presentation_limit": info.get("presentation_limit"),
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


def _refresh_sample_html(run_dir: Path) -> None:
    """Re-bake sample presentation.html from saved JSON using the current template."""
    json_path = run_dir / "presentation.json"
    html_path = run_dir / "presentation.html"
    if not json_path.exists():
        return
    try:
        # Skip rewrite when sample already has the current UI markers
        if html_path.exists():
            existing = html_path.read_text(encoding="utf-8", errors="ignore")
            if (
                "btnSortUsed" in existing
                and "fulldata-body" in existing
                and "In comps · remove" in existing
                and "btnPrintLeavebehind" in existing
                and "listlogic-logo.png" in existing
                and "print-page-spine" in existing
                and "arcgisonline.com" in existing
                and "map-hover-tip" in existing
                and "mapKindVisible" in existing
                and "spine-net" in existing
                and "netSellerFeePct" in existing
                and "match-badge" in existing
                and "sectionsModal" in existing
                and "ll-shown" in existing
            ):
                return
        report = json.loads(json_path.read_text(encoding="utf-8"))
        _save_html(report, html_path)
        logger.info("Refreshed sample presentation HTML for %s", run_dir.name)
    except Exception:
        logger.exception("Failed refreshing sample HTML for %s", run_dir.name)


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


def _ensure_sample_run() -> str:
    """Build or reuse the public sample listing run (no trial credit)."""
    run_dir = OUTPUT_DIR / SAMPLE_RUN_ID
    html_path = run_dir / "presentation.html"
    if html_path.exists():
        _repair_sample_run_paths(run_dir)
        _refresh_sample_html(run_dir)
        # Sample photos must be volume-local, not expiring CDN links.
        try:
            remote, missing = _run_photo_health(run_dir)
            if remote:
                _start_rehost(SAMPLE_RUN_ID, run_dir)
            elif missing:
                _start_background_photos(SAMPLE_RUN_ID, run_dir)
        except Exception:
            logger.exception("Sample photo health check failed")
        # Keep sample PDFs in sync with the latest packet design.
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
        year_built=1969,
        condition="average",
        list_price=None,
        mls_number="1058539",
        city_filter="Greeley",
        area_name="West Greeley · similar homes",
        market_notes="Public sample listing — start a free trial to run your own MLS export.",
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
    return SAMPLE_RUN_ID


@app.get("/demo")
def demo_redirect():
    run_id = _ensure_sample_run()
    return RedirectResponse(url=f"/runs/{run_id}/?sample=1", status_code=302)


@app.get("/api/demo")
def api_demo():
    run_id = _ensure_sample_run()
    return {
        "ok": True,
        "run_id": run_id,
        "url": f"/runs/{run_id}/?sample=1",
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
        row = auth_service.create_promo_code(
            code=str(payload.get("code") or ""),
            label=str(payload.get("label") or ""),
            trial_days=int(payload.get("trial_days") or auth_service.default_trial_days()),
            presentation_limit=int(
                payload.get("presentation_limit")
                if payload.get("presentation_limit") is not None
                else auth_service.default_presentation_limit()
            ),
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


_PRESENTATION_MARKERS = ("arcgisonline.com", "map-hover-tip", "mapKindVisible", "data-map-filters", "spine-net", "netSellerFeePct", "match-badge", "sectionsModal", "ll-shown")


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


@app.post("/api/runs/{run_id}/edits")
async def save_run_edits(run_id: str, request: Request):
    """Persist Agent Tools overrides alongside the run."""
    run_id = _safe_run_id(run_id)
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
    (run_dir / "edits.json").write_text(json.dumps(payload, indent=2), encoding="utf-8")
    return {"ok": True}


@app.get("/api/runs/{run_id}/edits")
def load_run_edits(run_id: str):
    run_id = _safe_run_id(run_id)
    path = OUTPUT_DIR / run_id / "edits.json"
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


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
        total = _expected_photo_targets(report)
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
            deadline=time.time() + 240,
            on_listing=on_listing,
        )
        merged = {**existing, **{k: v for k, v in photo_map.items() if v}}
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
    return {
        "photos": _load_photo_map(run_dir),
        "galleries": _load_gallery_map(run_dir),
        "status": status.get("status") or "ready",
        "done": status.get("done", 0),
        "total": status.get("total", 0),
        "message": status.get("message") or "",
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


@app.post("/api/generate")
async def generate(
    request: Request,
    export_file: Optional[UploadFile] = File(None),
    export_files: Optional[List[UploadFile]] = File(None),
    use_sample_export: str = Form("false"),
    address: str = Form(...),
    living_area: Optional[str] = Form(None),
    beds: Optional[str] = Form(None),
    baths: Optional[str] = Form(None),
    year_built: Optional[str] = Form(None),
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
    logo: Optional[UploadFile] = File(None),
):
    import auth_service

    user = _require_user(request)
    ent = auth_service.entitlement(user)
    if not ent["ok"]:
        raise HTTPException(
            status_code=402,
            detail={
                "message": "Trial ended — pick a plan to keep generating.",
                "reason": ent.get("reason") or "trial_expired",
                "entitlement": ent,
            },
        )

    use_sample = use_sample_export.lower() in {"1", "true", "yes", "on"}
    export_path: Path
    cleanup_paths: list[Path] = []
    logo_url = ""

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

    if use_sample:
        if not DEMO_EXPORT.exists():
            raise HTTPException(400, "Sample export missing")
        export_path = DEMO_EXPORT
    else:
        uploads: list[UploadFile] = []
        if export_files:
            uploads.extend([f for f in export_files if f and f.filename])
        if export_file and export_file.filename:
            if not any(f.filename == export_file.filename for f in uploads):
                uploads.append(export_file)
        if not uploads:
            raise HTTPException(400, "Upload an MLS export or enable the sample export")
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

        if len(saved_paths) == 1:
            export_path = saved_paths[0]
        else:
            from core import load_exports

            try:
                merged = load_exports(saved_paths)
            except Exception as exc:
                raise HTTPException(400, f"Could not merge exports: {exc}") from exc
            export_path = UPLOAD_DIR / f"{uuid.uuid4().hex}-merged.txt"
            merged.to_csv(export_path, sep="|", index=False)
            cleanup_paths.append(export_path)

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
        )
        logger.info("Generate finished in %.1fs for %s", time.time() - t0, address)
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
