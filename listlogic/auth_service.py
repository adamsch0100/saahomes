"""ListLogic user accounts, sessions, trials, promo codes, invites."""
from __future__ import annotations

import hashlib
import hmac
import json
import logging
import os
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

import bcrypt

import db as database

logger = logging.getLogger("ListLogic.auth")

SESSION_COOKIE = "ll_session"
SESSION_DAYS = 30
MAX_CONCURRENT_SESSIONS = int(os.environ.get("MAX_CONCURRENT_SESSIONS") or "3")
# Public signup: setup-only (no free custom presentations). Promo/invite may still grant trial credits.
DEFAULT_TRIAL_DAYS = int(os.environ.get("DEFAULT_TRIAL_DAYS") or "0")
DEFAULT_PRESENTATION_LIMIT = int(os.environ.get("DEFAULT_PRESENTATION_LIMIT") or "0")
# Stripe Checkout trial length for agent_monthly (card required up front).
STRIPE_TRIAL_DAYS = int(os.environ.get("STRIPE_TRIAL_DAYS") or "7")


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _iso(dt: Optional[datetime] = None) -> str:
    d = dt or _utcnow()
    if d.tzinfo is None:
        d = d.replace(tzinfo=timezone.utc)
    return d.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _parse_iso(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        s = value.replace("Z", "+00:00")
        return datetime.fromisoformat(s)
    except Exception:
        return None


def _uid() -> str:
    return uuid.uuid4().hex


def _hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except Exception:
        return False


def default_trial_days() -> int:
    return DEFAULT_TRIAL_DAYS


def default_presentation_limit() -> int:
    return DEFAULT_PRESENTATION_LIMIT


def app_base_url() -> str:
    return (os.environ.get("APP_BASE_URL") or "https://listlogic.homes").rstrip("/")


def auth_required() -> bool:
    """Auth is always required once accounts system is initialized."""
    return True


def resolve_post_auth_next(user: Optional[dict], requested: str = "") -> str:
    """Where to send someone after login. Admins land on the owner console by default."""
    req = (requested or "").strip()
    if req and not req.startswith("/"):
        req = ""
    # Only allow same-origin relative paths
    if req.startswith("//") or "://" in req:
        req = ""
    is_admin = bool(user) and (user.get("role") or "") == "admin"
    # Bare / marketing paths → role home. Explicit app/admin/deep links are kept.
    if not req or req in ("/", "/saas/", "/saas/index.html"):
        return "/saas/admin.html" if is_admin else "/saas/app.html"
    return req


def public_user(row: Optional[dict]) -> Optional[dict]:
    if not row:
        return None
    ph = (row.get("password_hash") or "").strip()
    has_password = bool(ph) and not ph.startswith("magic:")
    return {
        "id": row["id"],
        "email": row["email"],
        "name": row.get("name") or "",
        "phone": row.get("phone") or "",
        "brokerage": row.get("brokerage") or "",
        "role": row.get("role") or "agent",
        "status": row.get("status") or "trial",
        "trial_ends_at": row.get("trial_ends_at"),
        "presentations_used": int(row.get("presentations_used") or 0),
        "presentation_limit": row.get("presentation_limit"),
        "created_at": row.get("created_at"),
        "brand_primary": row.get("brand_primary") or "#0c3c6e",
        "brand_accent": row.get("brand_accent") or "#1a5f9e",
        "logo_url": row.get("logo_url") or "",
        "profile_complete": bool(int(row.get("profile_complete") or 0)),
        "email_verified": bool(int(row.get("email_verified") or 0)),
        "has_password": has_password,
        "plan": row.get("plan") or "",
        "stripe_customer_id": row.get("stripe_customer_id") or "",
        "has_stripe": bool((row.get("stripe_customer_id") or "").strip()),
        "listings_year": row.get("listings_year") or "",
        "sms_consent": bool(int(row.get("sms_consent") or 0)),
    }


# Plan catalog for owner billing views. Amounts mirror saas/pricing.html.
PLAN_CATALOG = {
    "agent_monthly": {"label": "Agent monthly", "monthly": 39.0, "recurring": True},
    "agent_annual": {"label": "Agent annual", "monthly": 32.5, "recurring": True},
    "one_time": {"label": "One-time report", "monthly": 0.0, "recurring": False},
    "brokerage_monthly": {"label": "Brokerage seat (monthly)", "monthly": 29.0, "recurring": True, "per_seat": True},
    "brokerage_annual": {"label": "Brokerage seat (annual)", "monthly": 24.17, "recurring": True, "per_seat": True},
}


def plan_label(plan: str) -> str:
    meta = PLAN_CATALOG.get((plan or "").strip().lower())
    return meta["label"] if meta else ((plan or "").strip() or "No plan")


def list_subscriptions() -> dict:
    """Owner billing view: anyone with a plan, Stripe customer, or subscription."""
    rows = database.execute(
        """
        SELECT * FROM users
        WHERE COALESCE(plan, '') != ''
           OR COALESCE(stripe_customer_id, '') != ''
           OR COALESCE(stripe_subscription_id, '') != ''
        ORDER BY updated_at DESC LIMIT 500
        """,
        fetch="all",
    ) or []

    seat_by_user: dict[str, int] = {}
    try:
        evs = database.execute(
            """
            SELECT user_id, meta FROM events
            WHERE type IN ('stripe_subscription_active', 'stripe_checkout_completed')
            ORDER BY created_at DESC
            """,
            fetch="all",
        ) or []
        for ev in evs:
            uid = ev.get("user_id")
            if not uid or uid in seat_by_user:
                continue
            try:
                meta = json.loads(ev.get("meta") or "{}")
            except Exception:
                meta = {}
            qty = meta.get("seat_quantity") or meta.get("quantity")
            if qty:
                seat_by_user[uid] = max(1, int(qty))
    except Exception:
        pass

    subs: list[dict] = []
    plan_counts: dict[str, int] = {}
    mrr = 0.0
    paying = 0
    for r in rows:
        pubs = public_user(r) or {}
        plan = (r.get("plan") or "").strip().lower()
        meta = PLAN_CATALOG.get(plan, {})
        seats = seat_by_user.get(r["id"], 1)
        is_sub = bool((r.get("stripe_subscription_id") or "").strip())
        status = (r.get("status") or "").lower()
        active_paying = status == "active" and (is_sub or bool(meta.get("recurring")))
        monthly_value = 0.0
        if active_paying and meta.get("recurring"):
            monthly_value = float(meta.get("monthly") or 0) * (seats if meta.get("per_seat") else 1)
            paying += 1
            mrr += monthly_value
            plan_counts[plan or "unknown"] = plan_counts.get(plan or "unknown", 0) + 1
        subs.append({
            "user": pubs,
            "plan": plan,
            "plan_label": plan_label(plan),
            "seats": seats,
            "per_seat": bool(meta.get("per_seat")),
            "recurring": bool(meta.get("recurring")),
            "has_subscription": is_sub,
            "monthly_value": round(monthly_value, 2),
            "stripe_subscription_id": (r.get("stripe_subscription_id") or "").strip(),
            "updated_at": r.get("updated_at"),
        })
    subs.sort(key=lambda s: (not s["recurring"], -(s["monthly_value"] or 0), s["updated_at"] or ""))
    return {
        "subscriptions": subs,
        "summary": {
            "paying": paying,
            "mrr": round(mrr, 2),
            "plan_counts": plan_counts,
            "with_stripe_customer": sum(1 for s in subs if s["user"].get("has_stripe")),
        },
    }


def get_user_by_id(user_id: str) -> Optional[dict]:
    return database.execute("SELECT * FROM users WHERE id = ?", (user_id,), fetch="one")


def get_user_by_email(email: str) -> Optional[dict]:
    return database.execute(
        "SELECT * FROM users WHERE lower(email) = lower(?)",
        (email.strip(),),
        fetch="one",
    )


def get_user_by_stripe_customer(customer_id: str) -> Optional[dict]:
    cid = (customer_id or "").strip()
    if not cid:
        return None
    return database.execute(
        "SELECT * FROM users WHERE stripe_customer_id = ?",
        (cid,),
        fetch="one",
    )


def set_stripe_ids(
    user_id: str,
    *,
    stripe_customer_id: Optional[str] = None,
    stripe_subscription_id: Optional[str] = None,
    plan: Optional[str] = None,
) -> Optional[dict]:
    fields: list[str] = []
    params: list[Any] = []
    if stripe_customer_id is not None:
        fields.append("stripe_customer_id = ?")
        params.append(stripe_customer_id)
    if stripe_subscription_id is not None:
        fields.append("stripe_subscription_id = ?")
        params.append(stripe_subscription_id)
    if plan is not None:
        fields.append("plan = ?")
        params.append(plan)
    if not fields:
        return get_user_by_id(user_id)
    fields.append("updated_at = ?")
    params.append(_iso())
    params.append(user_id)
    database.execute(f"UPDATE users SET {', '.join(fields)} WHERE id = ?", tuple(params))
    return get_user_by_id(user_id)


def apply_one_time_purchase(user_id: str, *, quantity: int = 1) -> Optional[dict]:
    """Grant N additional presentations (status active with a finite limit)."""
    user = get_user_by_id(user_id)
    if not user:
        return None
    used = int(user.get("presentations_used") or 0)
    limit = user.get("presentation_limit")
    qty = max(1, int(quantity or 1))
    if limit is None and (user.get("status") or "") == "active":
        # Already unlimited — keep unlimited, just record the purchase event.
        set_stripe_ids(user_id, plan="one_time")
        return get_user_by_id(user_id)
    current_limit = int(limit) if limit is not None else used
    new_limit = max(current_limit, used) + qty
    database.execute(
        "UPDATE users SET status = 'active', presentation_limit = ?, plan = ?, updated_at = ? WHERE id = ?",
        (new_limit, "one_time", _iso(), user_id),
    )
    return get_user_by_id(user_id)


def apply_subscription_active(
    user_id: str,
    *,
    plan: str,
    stripe_subscription_id: Optional[str] = None,
    seat_quantity: int = 1,
) -> Optional[dict]:
    fields = [
        "status = ?",
        "presentation_limit = NULL",
        "plan = ?",
        "updated_at = ?",
    ]
    params: list[Any] = ["active", plan or "agent_monthly", _iso()]
    if stripe_subscription_id:
        fields.insert(-1, "stripe_subscription_id = ?")
        params.insert(-1, stripe_subscription_id)
    # seat_quantity stored in plan metadata via events; column optional
    try:
        database.execute(
            f"UPDATE users SET {', '.join(fields)} WHERE id = ?",
            tuple(params + [user_id]),
        )
    except Exception:
        # Retry without subscription id if column missing mid-migrate
        database.execute(
            "UPDATE users SET status = 'active', presentation_limit = NULL, plan = ?, updated_at = ? WHERE id = ?",
            (plan or "agent_monthly", _iso(), user_id),
        )
    log_event(
        user_id,
        "stripe_subscription_active",
        {"plan": plan, "seat_quantity": seat_quantity, "subscription_id": stripe_subscription_id},
    )
    return get_user_by_id(user_id)


def apply_subscription_ended(user_id: str) -> Optional[dict]:
    database.execute(
        "UPDATE users SET status = 'expired', presentation_limit = COALESCE(presentation_limit, presentations_used), "
        "stripe_subscription_id = '', updated_at = ? WHERE id = ?",
        (_iso(), user_id),
    )
    return get_user_by_id(user_id)


def log_event(user_id: Optional[str], event_type: str, meta: Optional[dict] = None) -> None:
    try:
        database.execute(
            "INSERT INTO events (id, user_id, type, meta, created_at) VALUES (?, ?, ?, ?, ?)",
            (_uid(), user_id, event_type, json.dumps(meta or {}), _iso()),
        )
    except Exception:
        logger.exception("Failed to log event %s", event_type)


def create_session(user_id: str, ip: str = "", user_agent: str = "") -> str:
    token = secrets.token_urlsafe(32)
    expires = _utcnow() + timedelta(days=SESSION_DAYS)
    database.execute(
        "INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at, ip, user_agent, last_seen_at) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        (_uid(), user_id, _hash_token(token), _iso(expires), _iso(), ip or "", user_agent or "", _iso()),
    )
    _enforce_session_cap(user_id, keep_token=token)
    return token


def _enforce_session_cap(user_id: str, keep_token: Optional[str] = None) -> None:
    """Keep at most MAX_CONCURRENT_SESSIONS newest sessions; drop the oldest beyond the cap.
    The just-created session (keep_token) is never pruned — created_at has 1s resolution,
    so ties would otherwise be non-deterministic."""
    try:
        rows = database.execute(
            "SELECT id, token_hash, created_at FROM sessions WHERE user_id = ?",
            (user_id,),
            fetch="all",
        ) or []
        if len(rows) <= MAX_CONCURRENT_SESSIONS:
            return
        keep_hash = _hash_token(keep_token) if keep_token else None
        keep = [r for r in rows if keep_hash and r.get("token_hash") == keep_hash]
        others = [r for r in rows if r not in keep]
        # newest first among the rest
        others.sort(key=lambda r: (r.get("created_at") or ""), reverse=True)
        survivors = keep + others[: max(0, MAX_CONCURRENT_SESSIONS - len(keep))]
        survivor_ids = {r["id"] for r in survivors}
        stale = [r["id"] for r in rows if r["id"] not in survivor_ids]
        for sid in stale:
            database.execute("DELETE FROM sessions WHERE id = ?", (sid,))
        if stale:
            logger.info("Session cap: dropped %d oldest session(s) for user %s", len(stale), user_id)
    except Exception:
        logger.exception("Failed to enforce session cap for %s", user_id)


def touch_session(token: Optional[str], ip: str = "") -> None:
    """Refresh last_seen_at (+ip) on a session so Settings shows current devices."""
    if not token:
        return
    try:
        if ip:
            database.execute(
                "UPDATE sessions SET last_seen_at = ?, ip = ? WHERE token_hash = ?",
                (_iso(), ip, _hash_token(token)),
            )
        else:
            database.execute(
                "UPDATE sessions SET last_seen_at = ? WHERE token_hash = ?",
                (_iso(), _hash_token(token)),
            )
    except Exception:
        pass


def list_sessions(user_id: str, current_token: Optional[str] = None) -> list[dict]:
    """Active sessions for the Settings panel, newest activity first."""
    now = _iso()
    rows = database.execute(
        "SELECT id, ip, user_agent, created_at, last_seen_at, token_hash FROM sessions "
        "WHERE user_id = ? AND expires_at > ? ORDER BY COALESCE(last_seen_at, created_at) DESC",
        (user_id, now),
        fetch="all",
    ) or []
    cur_hash = _hash_token(current_token) if current_token else None
    out = []
    for r in rows:
        out.append({
            "id": r["id"],
            "ip": r.get("ip") or "",
            "user_agent": r.get("user_agent") or "",
            "created_at": r.get("created_at"),
            "last_seen_at": r.get("last_seen_at") or r.get("created_at"),
            "current": bool(cur_hash and r.get("token_hash") == cur_hash),
        })
    return out


def delete_other_sessions(user_id: str, keep_token: Optional[str]) -> int:
    """Sign out every session except the current one. Returns count removed."""
    if not keep_token:
        return 0
    try:
        rows = database.execute(
            "SELECT id FROM sessions WHERE user_id = ? AND token_hash <> ?",
            (user_id, _hash_token(keep_token)),
            fetch="all",
        ) or []
        for r in rows:
            database.execute("DELETE FROM sessions WHERE id = ?", (r["id"],))
        return len(rows)
    except Exception:
        logger.exception("Failed to delete other sessions for %s", user_id)
        return 0


def delete_session_by_id(user_id: str, session_id: str) -> bool:
    """Remove a single session owned by the user (for the Settings panel)."""
    try:
        database.execute(
            "DELETE FROM sessions WHERE id = ? AND user_id = ?",
            (session_id, user_id),
        )
        return True
    except Exception:
        return False


def delete_session(token: Optional[str]) -> None:
    if not token:
        return
    database.execute("DELETE FROM sessions WHERE token_hash = ?", (_hash_token(token),))


def user_from_session_token(token: Optional[str]) -> Optional[dict]:
    if not token:
        return None
    row = database.execute(
        "SELECT u.*, s.expires_at AS session_expires "
        "FROM sessions s JOIN users u ON u.id = s.user_id "
        "WHERE s.token_hash = ?",
        (_hash_token(token),),
        fetch="one",
    )
    if not row:
        return None
    exp = _parse_iso(row.get("session_expires"))
    if exp and exp < _utcnow():
        delete_session(token)
        return None
    return row


def entitlement(user: dict) -> dict:
    """
    Generate access: status active (subscription/one-shot credits), or legacy/promo
    status trial with remaining presentations before trial_ends_at.

    status setup = free signup/setup only — must pay (Stripe 7-day trial or $20) to generate.
    """
    status = (user.get("status") or "").lower()
    used = int(user.get("presentations_used") or 0)
    limit = user.get("presentation_limit")
    limit_i = int(limit) if limit is not None else None
    ends = _parse_iso(user.get("trial_ends_at"))

    if status == "disabled":
        return {"ok": False, "reason": "disabled", "remaining": 0, "days_left": 0}
    if status == "setup":
        return {
            "ok": False,
            "reason": "payment_required",
            "remaining": 0,
            "days_left": None,
            "needs_payment": True,
        }
    if status == "active":
        if limit_i is not None and used >= limit_i:
            return {
                "ok": False,
                "reason": "limit_reached",
                "remaining": 0,
                "days_left": None,
                "needs_payment": True,
            }
        return {
            "ok": True,
            "reason": "active",
            "remaining": None if limit_i is None else max(0, limit_i - used),
            "days_left": None,
        }

    days_left = None
    if ends:
        days_left = max(0, int((ends - _utcnow()).total_seconds() // 86400))

    if status == "expired":
        reason = "trial_expired"
        if limit_i is not None and used >= limit_i:
            reason = "limit_reached"
        return {
            "ok": False,
            "reason": reason,
            "remaining": 0,
            "days_left": days_left or 0,
            "needs_payment": True,
        }

    # Promo / invite / legacy free trial credits
    if status == "trial" and (limit_i is None or limit_i <= 0):
        return {
            "ok": False,
            "reason": "payment_required",
            "remaining": 0,
            "days_left": days_left,
            "needs_payment": True,
        }
    if ends and ends < _utcnow():
        _mark_expired(user["id"], "trial_expired")
        return {
            "ok": False,
            "reason": "trial_expired",
            "remaining": 0,
            "days_left": 0,
            "needs_payment": True,
        }
    if limit_i is not None and used >= limit_i:
        _mark_expired(user["id"], "limit_reached")
        return {
            "ok": False,
            "reason": "limit_reached",
            "remaining": 0,
            "days_left": days_left,
            "needs_payment": True,
        }

    remaining = None if limit_i is None else max(0, limit_i - used)
    return {"ok": True, "reason": "trial", "remaining": remaining, "days_left": days_left}


def _mark_expired(user_id: str, reason: str) -> None:
    database.execute(
        "UPDATE users SET status = 'expired', updated_at = ? WHERE id = ? AND status = 'trial'",
        (_iso(), user_id),
    )
    log_event(user_id, "trial_expired", {"reason": reason})


def increment_presentation(user_id: str) -> dict:
    user = get_user_by_id(user_id)
    if not user:
        raise ValueError("User not found")
    ent = entitlement(user)
    if not ent["ok"]:
        return ent
    database.execute(
        "UPDATE users SET presentations_used = presentations_used + 1, updated_at = ? WHERE id = ?",
        (_iso(), user_id),
    )
    user = get_user_by_id(user_id) or user
    used = int(user.get("presentations_used") or 0)
    limit_i = user.get("presentation_limit")
    log_event(user_id, "generate", {"presentations_used": used})
    if limit_i is not None and used >= int(limit_i) and (user.get("status") or "") == "trial":
        _mark_expired(user_id, "limit_reached")
        _notify_conversion_moment(user, "reports_used_up_email")
        return {"ok": False, "reason": "limit_reached", "remaining": 0, "just_exhausted": True}
    if limit_i is not None and used == int(limit_i) - 1 and (user.get("status") or "") == "trial":
        _notify_conversion_moment(user, "last_report_email")
    return entitlement(user)


def _notify_conversion_moment(user: dict, event_type: str) -> None:
    """Usage-triggered upgrade emails — fire exactly once per user, at the moment of intent."""
    if event_already_sent(user["id"], event_type, within_hours=24 * 365 * 10):
        return
    try:
        import mailer

        base = app_base_url()
        sent = False
        if event_type == "last_report_email":
            sent = mailer.send_last_report_notice(user, base)
        elif event_type == "reports_used_up_email":
            sent = mailer.send_reports_used_up(user, base)
        if sent:
            log_event(user["id"], event_type, {})
    except Exception:
        logger.exception("Conversion email %s failed for %s", event_type, user.get("email"))


def _new_share_token() -> str:
    # Short, URL-safe token for client share links (/p/{token})
    return secrets.token_urlsafe(8).replace("-", "").replace("_", "")[:12]


def save_presentation(
    user_id: str,
    *,
    run_id: str,
    address: str = "",
    recommended_price: Optional[float] = None,
    months_of_inventory: Optional[float] = None,
    active_count: Optional[int] = None,
    under_contract_count: Optional[int] = None,
    title: str = "",
    presentation_html: Optional[str] = None,
    deck_html: Optional[str] = None,
) -> dict:
    """Persist a generated report for the agent library + client share link."""
    existing = database.execute(
        "SELECT * FROM presentations WHERE run_id = ?",
        (run_id,),
        fetch="one",
    )
    now = _iso()
    if existing:
        fields = [
            "address = ?",
            "recommended_price = ?",
            "months_of_inventory = ?",
            "active_count = ?",
            "under_contract_count = ?",
            "title = ?",
            "updated_at = ?",
        ]
        params: list[Any] = [
            address or existing.get("address") or "",
            recommended_price if recommended_price is not None else existing.get("recommended_price"),
            months_of_inventory if months_of_inventory is not None else existing.get("months_of_inventory"),
            active_count if active_count is not None else existing.get("active_count"),
            under_contract_count if under_contract_count is not None else existing.get("under_contract_count"),
            title or existing.get("title") or "",
            now,
        ]
        if presentation_html is not None:
            fields.append("presentation_html = ?")
            params.append(presentation_html)
        if deck_html is not None:
            fields.append("deck_html = ?")
            params.append(deck_html)
        params.append(run_id)
        database.execute(
            f"UPDATE presentations SET {', '.join(fields)} WHERE run_id = ?",
            tuple(params),
        )
        row = database.execute("SELECT * FROM presentations WHERE run_id = ?", (run_id,), fetch="one") or existing
        return _presentation_public(row)

    share_token = _new_share_token()
    for _ in range(5):
        clash = database.execute(
            "SELECT id FROM presentations WHERE share_token = ?",
            (share_token,),
            fetch="one",
        )
        if not clash:
            break
        share_token = _new_share_token()

    pres_id = str(uuid.uuid4())
    database.execute(
        """
        INSERT INTO presentations (
          id, user_id, run_id, share_token, address, recommended_price,
          months_of_inventory, active_count, under_contract_count, title,
          presentation_html, deck_html, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            pres_id,
            user_id,
            run_id,
            share_token,
            address or "",
            recommended_price,
            months_of_inventory,
            active_count,
            under_contract_count,
            title or address or "",
            presentation_html or "",
            deck_html or "",
            now,
            now,
        ),
    )
    log_event(user_id, "presentation_saved", {"run_id": run_id, "share_token": share_token})
    row = database.execute("SELECT * FROM presentations WHERE id = ?", (pres_id,), fetch="one")
    return _presentation_public(row or {"id": pres_id, "run_id": run_id, "share_token": share_token, "address": address})


def _presentation_public(row: dict) -> dict:
    token = row.get("share_token") or ""
    run_id = row.get("run_id") or ""
    return {
        "id": row.get("id"),
        "run_id": run_id,
        "address": row.get("address") or "",
        "title": row.get("title") or row.get("address") or "",
        "recommended_price": row.get("recommended_price"),
        "months_of_inventory": row.get("months_of_inventory"),
        "active_count": row.get("active_count"),
        "under_contract_count": row.get("under_contract_count"),
        "created_at": row.get("created_at"),
        "updated_at": row.get("updated_at"),
        "url": f"/runs/{run_id}/" if run_id else "",
        "share_url": f"/p/{token}" if token else (f"/runs/{run_id}/" if run_id else ""),
        "share_token": token,
        "story_pdf_url": f"/runs/{run_id}/story.pdf" if run_id else "",
        "deck_url": f"/runs/{run_id}/deck.html" if run_id else "",
    }


def list_presentations(user_id: str, *, limit: int = 50) -> list[dict]:
    rows = database.execute(
        """
        SELECT * FROM presentations
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT ?
        """,
        (user_id, max(1, min(int(limit), 200))),
        fetch="all",
    ) or []
    return [_presentation_public(r) for r in rows]


def list_all_presentations(q: str = "", *, limit: int = 100) -> list[dict]:
    """Admin: all presentations joined to agent identity."""
    limit_i = max(1, min(int(limit), 300))
    q = (q or "").strip()
    if q:
        like = f"%{q}%"
        rows = database.execute(
            """
            SELECT p.*, u.email AS agent_email, u.name AS agent_name, u.brokerage AS agent_brokerage
            FROM presentations p
            LEFT JOIN users u ON u.id = p.user_id
            WHERE p.address LIKE ? OR p.title LIKE ? OR p.run_id LIKE ?
               OR u.email LIKE ? OR u.name LIKE ? OR p.share_token LIKE ?
            ORDER BY p.created_at DESC
            LIMIT ?
            """,
            (like, like, like, like, like, like, limit_i),
            fetch="all",
        ) or []
    else:
        rows = database.execute(
            """
            SELECT p.*, u.email AS agent_email, u.name AS agent_name, u.brokerage AS agent_brokerage
            FROM presentations p
            LEFT JOIN users u ON u.id = p.user_id
            ORDER BY p.created_at DESC
            LIMIT ?
            """,
            (limit_i,),
            fetch="all",
        ) or []
    out = []
    for r in rows:
        item = _presentation_public(r)
        item["user_id"] = r.get("user_id")
        item["agent_email"] = r.get("agent_email") or ""
        item["agent_name"] = r.get("agent_name") or ""
        item["agent_brokerage"] = r.get("agent_brokerage") or ""
        out.append(item)
    return out


def admin_stats() -> dict:
    """Lightweight ops snapshot for admin home."""
    def _count(sql: str, params: tuple = ()) -> int:
        row = database.execute(sql, params, fetch="one") or {}
        return int(row.get("n") or row.get("count") or 0)

    users_total = _count("SELECT COUNT(*) AS n FROM users")
    users_trial = _count("SELECT COUNT(*) AS n FROM users WHERE lower(status) = 'trial'")
    users_active = _count("SELECT COUNT(*) AS n FROM users WHERE lower(status) = 'active'")
    users_expired = _count("SELECT COUNT(*) AS n FROM users WHERE lower(status) = 'expired'")
    users_disabled = _count("SELECT COUNT(*) AS n FROM users WHERE lower(status) = 'disabled'")
    users_paying = _count(
        "SELECT COUNT(*) AS n FROM users WHERE lower(status) = 'active' "
        "AND (COALESCE(stripe_subscription_id, '') != '' OR lower(COALESCE(plan, '')) LIKE '%monthly%' "
        "OR lower(COALESCE(plan, '')) LIKE '%annual%')"
    )
    presentations_total = _count("SELECT COUNT(*) AS n FROM presentations")
    # ISO week-ish: last 7 days by created_at string compare (ISO timestamps sort lexically)
    week_ago = _iso(_utcnow() - timedelta(days=7))
    presentations_week = _count(
        "SELECT COUNT(*) AS n FROM presentations WHERE created_at >= ?",
        (week_ago,),
    )
    feedback_open = _count(
        "SELECT COUNT(*) AS n FROM feedback WHERE status IN ('new', 'seen')"
    )
    feedback_new = _count("SELECT COUNT(*) AS n FROM feedback WHERE status = 'new'")
    assistant_week = 0
    assistant_total = 0
    try:
        assistant_week = _count(
            "SELECT COUNT(*) AS n FROM assistant_turns WHERE created_at >= ?",
            (week_ago,),
        )
        assistant_total = _count("SELECT COUNT(*) AS n FROM assistant_turns")
    except Exception:
        pass
    stripe_on = bool((os.environ.get("STRIPE_SECRET_KEY") or "").strip())
    stripe_key = (os.environ.get("STRIPE_SECRET_KEY") or "").strip()
    stripe_mode = "test" if stripe_key.startswith("sk_test") else "live"
    return {
        "users_total": users_total,
        "users_trial": users_trial,
        "users_active": users_active,
        "users_expired": users_expired,
        "users_disabled": users_disabled,
        "users_paying": users_paying,
        "presentations_total": presentations_total,
        "presentations_week": presentations_week,
        "feedback_open": feedback_open,
        "feedback_new": feedback_new,
        "assistant_week": assistant_week,
        "assistant_total": assistant_total,
        "stripe_configured": stripe_on,
        "stripe_mode": stripe_mode if stripe_on else "",
    }


def save_assistant_turn(
    *,
    user_id: Optional[str],
    user_message: str,
    assistant_reply: str,
    page_url: str = "",
    conversation_id: str = "",
    ok: bool = True,
    model: str = "",
) -> Optional[dict]:
    msg = (user_message or "").strip()
    if not msg:
        return None
    turn_id = _uid()
    row = {
        "id": turn_id,
        "user_id": user_id,
        "conversation_id": (conversation_id or "")[:64],
        "page_url": (page_url or "")[:2000],
        "user_message": msg[:8000],
        "assistant_reply": (assistant_reply or "")[:12000],
        "ok": 1 if ok else 0,
        "model": (model or "")[:120],
        "created_at": _iso(),
    }
    try:
        database.execute(
            """
            INSERT INTO assistant_turns
              (id, user_id, conversation_id, page_url, user_message, assistant_reply, ok, model, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                row["id"],
                row["user_id"],
                row["conversation_id"],
                row["page_url"],
                row["user_message"],
                row["assistant_reply"],
                row["ok"],
                row["model"],
                row["created_at"],
            ),
        )
        log_event(
            user_id,
            "assistant_chat",
            {"turn_id": turn_id, "ok": bool(ok), "page_url": row["page_url"][:200]},
        )
    except Exception:
        logger.exception("Failed to save assistant turn")
        return None
    return row


def list_assistant_turns(q: str = "", *, limit: int = 100) -> list[dict]:
    limit_i = max(1, min(int(limit), 300))
    q = (q or "").strip()
    if q:
        like = f"%{q}%"
        rows = database.execute(
            """
            SELECT t.*, u.email AS agent_email, u.name AS agent_name
            FROM assistant_turns t
            LEFT JOIN users u ON u.id = t.user_id
            WHERE t.user_message LIKE ? OR t.assistant_reply LIKE ?
               OR u.email LIKE ? OR u.name LIKE ? OR t.page_url LIKE ?
               OR t.conversation_id LIKE ?
            ORDER BY t.created_at DESC
            LIMIT ?
            """,
            (like, like, like, like, like, like, limit_i),
            fetch="all",
        ) or []
    else:
        rows = database.execute(
            """
            SELECT t.*, u.email AS agent_email, u.name AS agent_name
            FROM assistant_turns t
            LEFT JOIN users u ON u.id = t.user_id
            ORDER BY t.created_at DESC
            LIMIT ?
            """,
            (limit_i,),
            fetch="all",
        ) or []
    out = []
    for r in rows:
        out.append({
            "id": r.get("id"),
            "user_id": r.get("user_id"),
            "conversation_id": r.get("conversation_id") or "",
            "page_url": r.get("page_url") or "",
            "user_message": r.get("user_message") or "",
            "assistant_reply": r.get("assistant_reply") or "",
            "ok": bool(int(r.get("ok") if r.get("ok") is not None else 1)),
            "model": r.get("model") or "",
            "created_at": r.get("created_at"),
            "agent_email": r.get("agent_email") or "",
            "agent_name": r.get("agent_name") or "",
        })
    return out


def list_events(q: str = "", event_type: str = "", *, limit: int = 150) -> list[dict]:
    limit_i = max(1, min(int(limit), 400))
    q = (q or "").strip()
    event_type = (event_type or "").strip()
    clauses: list[str] = []
    params: list[Any] = []
    if event_type:
        clauses.append("e.type = ?")
        params.append(event_type)
    if q:
        like = f"%{q}%"
        clauses.append("(e.type LIKE ? OR e.meta LIKE ? OR u.email LIKE ? OR u.name LIKE ?)")
        params.extend([like, like, like, like])
    where = (" WHERE " + " AND ".join(clauses)) if clauses else ""
    params.append(limit_i)
    rows = database.execute(
        f"""
        SELECT e.*, u.email AS agent_email, u.name AS agent_name
        FROM events e
        LEFT JOIN users u ON u.id = e.user_id
        {where}
        ORDER BY e.created_at DESC
        LIMIT ?
        """,
        tuple(params),
        fetch="all",
    ) or []
    out = []
    for r in rows:
        meta_raw = r.get("meta") or "{}"
        try:
            meta = json.loads(meta_raw) if isinstance(meta_raw, str) else (meta_raw or {})
        except Exception:
            meta = {"raw": str(meta_raw)[:500]}
        out.append({
            "id": r.get("id"),
            "user_id": r.get("user_id"),
            "type": r.get("type") or "",
            "meta": meta if isinstance(meta, dict) else {},
            "created_at": r.get("created_at"),
            "agent_email": r.get("agent_email") or "",
            "agent_name": r.get("agent_name") or "",
        })
    return out


def admin_user_detail(user_id: str) -> Optional[dict]:
    user = get_user_by_id(user_id)
    if not user:
        return None
    pubs = public_user(user) or {}
    presentations = list_presentations(user_id, limit=50)
    turns = []
    try:
        turns = database.execute(
            """
            SELECT id, conversation_id, page_url, user_message, assistant_reply, ok, created_at
            FROM assistant_turns WHERE user_id = ?
            ORDER BY created_at DESC LIMIT 40
            """,
            (user_id,),
            fetch="all",
        ) or []
    except Exception:
        pass
    stripe_key = (os.environ.get("STRIPE_SECRET_KEY") or "").strip()
    stripe_mode = "test" if stripe_key.startswith("sk_test") else "live"
    cid = (pubs.get("stripe_customer_id") or "").strip()
    stripe_url = ""
    if cid:
        base = "https://dashboard.stripe.com/test" if stripe_mode == "test" else "https://dashboard.stripe.com"
        stripe_url = f"{base}/customers/{cid}"
    return {
        "user": pubs,
        "presentations": presentations,
        "assistant_turns": [
            {
                "id": t.get("id"),
                "conversation_id": t.get("conversation_id") or "",
                "page_url": t.get("page_url") or "",
                "user_message": t.get("user_message") or "",
                "assistant_reply": t.get("assistant_reply") or "",
                "ok": bool(int(t.get("ok") if t.get("ok") is not None else 1)),
                "created_at": t.get("created_at"),
            }
            for t in turns
        ],
        "stripe_dashboard_url": stripe_url,
        "stripe_mode": stripe_mode,
    }


def get_presentation_by_run(run_id: str) -> Optional[dict]:
    row = database.execute(
        "SELECT * FROM presentations WHERE run_id = ?",
        (run_id,),
        fetch="one",
    )
    if not row:
        return None
    # Include HTML for hydrate; public list omits it via _presentation_public
    out = _presentation_public(row) or {}
    out["presentation_html"] = row.get("presentation_html") or ""
    out["deck_html"] = row.get("deck_html") or ""
    return out


def get_presentation_by_share_token(token: str) -> Optional[dict]:
    token = (token or "").strip()
    if not token or len(token) > 64:
        return None
    row = database.execute(
        "SELECT * FROM presentations WHERE share_token = ?",
        (token,),
        fetch="one",
    )
    return _presentation_public(row) if row else None


def get_promo_by_code(code: str) -> Optional[dict]:
    return database.execute(
        "SELECT * FROM promo_codes WHERE lower(code) = lower(?)",
        (code.strip(),),
        fetch="one",
    )


def validate_promo(code: str) -> dict:
    row = get_promo_by_code(code)
    if not row or not int(row.get("active") or 0):
        return {"ok": False, "error": "Invalid or inactive promo code"}
    exp = _parse_iso(row.get("expires_at"))
    if exp and exp < _utcnow():
        return {"ok": False, "error": "This promo code has expired"}
    max_r = row.get("max_redemptions")
    if max_r is not None and int(row.get("redemptions") or 0) >= int(max_r):
        return {"ok": False, "error": "This promo code has reached its redemption limit"}
    return {
        "ok": True,
        "promo": row,
        "trial_days": int(row.get("trial_days") or DEFAULT_TRIAL_DAYS),
        "presentation_limit": int(row.get("presentation_limit") or DEFAULT_PRESENTATION_LIMIT),
    }


def redeem_promo(promo_id: str) -> None:
    database.execute(
        "UPDATE promo_codes SET redemptions = redemptions + 1 WHERE id = ?",
        (promo_id,),
    )


def get_invite(token: str) -> Optional[dict]:
    return database.execute(
        "SELECT * FROM invites WHERE token = ?",
        (token.strip(),),
        fetch="one",
    )


def validate_invite(token: str) -> dict:
    row = get_invite(token)
    if not row:
        return {"ok": False, "error": "Invite not found"}
    exp = _parse_iso(row.get("expires_at"))
    if exp and exp < _utcnow():
        return {"ok": False, "error": "This invite has expired"}
    if int(row.get("uses") or 0) >= int(row.get("max_uses") or 1):
        return {"ok": False, "error": "This invite has already been used"}
    return {
        "ok": True,
        "invite": row,
        "trial_days": int(row.get("trial_days") or DEFAULT_TRIAL_DAYS),
        "presentation_limit": int(row.get("presentation_limit") or DEFAULT_PRESENTATION_LIMIT),
        "brokerage": row.get("brokerage") or "",
        "email": row.get("email") or "",
    }


def redeem_invite(invite_id: str) -> None:
    database.execute("UPDATE invites SET uses = uses + 1 WHERE id = ?", (invite_id,))


def create_user(
    *,
    email: str,
    password: str = "",
    name: str = "",
    phone: str = "",
    brokerage: str = "",
    promo_code: str = "",
    invite_token: str = "",
    role: str = "agent",
    email_verified: bool = False,
    brand_primary: str = "#0c3c6e",
    brand_accent: str = "#1a5f9e",
) -> dict:
    email_n = email.strip().lower()
    if not email_n or "@" not in email_n:
        raise ValueError("Valid email is required")
    password = password or ""
    if password and len(password) < 8:
        raise ValueError("Password must be at least 8 characters")
    if get_user_by_email(email_n):
        raise ValueError("An account with that email already exists")

    trial_days = DEFAULT_TRIAL_DAYS
    presentation_limit = DEFAULT_PRESENTATION_LIMIT
    promo_id = None
    invite_id = None
    granted_trial = False

    if invite_token:
        inv = validate_invite(invite_token)
        if not inv["ok"]:
            raise ValueError(inv["error"])
        trial_days = inv["trial_days"]
        presentation_limit = inv["presentation_limit"]
        granted_trial = int(presentation_limit or 0) > 0 or int(trial_days or 0) > 0
        if inv.get("brokerage") and not brokerage:
            brokerage = inv["brokerage"]
        invite_id = inv["invite"]["id"]
        if inv["invite"].get("promo_code_id"):
            promo_id = inv["invite"]["promo_code_id"]
        locked = (inv.get("email") or "").strip().lower()
        if locked and locked != email_n:
            raise ValueError("This invite is locked to a different email")

    if promo_code:
        pv = validate_promo(promo_code)
        if not pv["ok"]:
            raise ValueError(pv["error"])
        trial_days = pv["trial_days"]
        presentation_limit = pv["presentation_limit"]
        granted_trial = int(presentation_limit or 0) > 0 or int(trial_days or 0) > 0
        promo_id = pv["promo"]["id"]

    now = _iso()
    # Public default: setup account (pay at Generate). Promo/invite can still grant trial credits.
    if granted_trial:
        status = "trial"
        ends = _iso(_utcnow() + timedelta(days=max(1, int(trial_days or 7))))
        presentation_limit = max(1, int(presentation_limit or 1))
    else:
        status = "setup"
        ends = None
        presentation_limit = 0
    user_id = _uid()
    pw_hash = _hash_password(password) if password else f"magic:{secrets.token_hex(16)}"
    profile_complete = 1 if (name or "").strip() and (brokerage or "").strip() else 0
    try:
        database.execute(
            "INSERT INTO users (id, email, password_hash, name, phone, brokerage, role, status, "
            "trial_ends_at, presentations_used, presentation_limit, promo_code_id, created_at, updated_at, "
            "brand_primary, brand_accent, logo_url, profile_complete, email_verified) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, '', ?, ?)",
            (
                user_id,
                email_n,
                pw_hash,
                (name or "").strip()[:120],
                (phone or "").strip()[:40],
                (brokerage or "").strip()[:120],
                role if role in ("agent", "admin") else "agent",
                status,
                ends,
                presentation_limit,
                promo_id,
                now,
                now,
                (brand_primary or "#0c3c6e").strip()[:20],
                (brand_accent or "#1a5f9e").strip()[:20],
                profile_complete,
                1 if email_verified else 0,
            ),
        )
    except Exception as exc:
        # Don't treat unique-email conflicts as "old schema" — re-raise those.
        msg = str(exc).lower()
        if "unique" in msg or "duplicate key" in msg or type(exc).__name__ == "UniqueViolation":
            raise
        # Older DBs before profile columns — fall back to core insert, then patch
        database.execute(
            "INSERT INTO users (id, email, password_hash, name, phone, brokerage, role, status, "
            "trial_ends_at, presentations_used, presentation_limit, promo_code_id, created_at, updated_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)",
            (
                user_id,
                email_n,
                pw_hash,
                (name or "").strip()[:120],
                (phone or "").strip()[:40],
                (brokerage or "").strip()[:120],
                role if role in ("agent", "admin") else "agent",
                status,
                ends,
                presentation_limit,
                promo_id,
                now,
                now,
            ),
        )
        try:
            database.execute(
                "UPDATE users SET brand_primary = ?, brand_accent = ?, profile_complete = ?, "
                "email_verified = ?, updated_at = ? WHERE id = ?",
                (
                    (brand_primary or "#0c3c6e").strip()[:20],
                    (brand_accent or "#1a5f9e").strip()[:20],
                    profile_complete,
                    1 if email_verified else 0,
                    now,
                    user_id,
                ),
            )
        except Exception:
            pass
    if promo_id:
        redeem_promo(promo_id)
    if invite_id:
        redeem_invite(invite_id)
    log_event(user_id, "signup", {"promo_code_id": promo_id, "invite_id": invite_id, "magic": not bool(password)})
    return get_user_by_id(user_id) or {"id": user_id, "email": email_n}


def login_user(email: str, password: str) -> dict:
    user = get_user_by_email(email)
    ph = (user or {}).get("password_hash") or ""
    if user and str(ph).startswith("magic:"):
        raise ValueError("This account uses email sign-in. Request a magic link, or set a password after verifying.")
    if not user or not verify_password(password, ph):
        raise ValueError("Invalid email or password")
    if (user.get("status") or "") == "disabled":
        raise ValueError("This account has been disabled")
    entitlement(user)
    user = get_user_by_id(user["id"]) or user
    log_event(user["id"], "login", {})
    return user


def set_password(user_id: str, password: str) -> dict:
    if len(password or "") < 8:
        raise ValueError("Password must be at least 8 characters")
    database.execute(
        "UPDATE users SET password_hash = ?, email_verified = 1, updated_at = ? WHERE id = ?",
        (_hash_password(password), _iso(), user_id),
    )
    log_event(user_id, "password_set", {})
    return get_user_by_id(user_id) or {"id": user_id}


def update_profile(
    user_id: str,
    *,
    name: str = "",
    phone: str = "",
    brokerage: str = "",
    brand_primary: str = "",
    brand_accent: str = "",
    logo_url: Optional[str] = None,
    listings_year: Optional[str] = None,
    sms_consent: Optional[bool] = None,
    mark_complete: bool = True,
) -> dict:
    user = get_user_by_id(user_id)
    if not user:
        raise ValueError("User not found")
    name_n = (name if name is not None else user.get("name") or "").strip()[:120]
    phone_n = (phone if phone is not None else user.get("phone") or "").strip()[:40]
    brokerage_n = (brokerage if brokerage is not None else user.get("brokerage") or "").strip()[:120]
    primary = (brand_primary or user.get("brand_primary") or "#0c3c6e").strip()[:20]
    accent = (brand_accent or user.get("brand_accent") or "#1a5f9e").strip()[:20]
    logo = user.get("logo_url") or ""
    if logo_url is not None:
        logo = (logo_url or "").strip()[:500]
    listings = user.get("listings_year") or ""
    if listings_year is not None:
        allowed = {"", "0-2", "3-5", "6-12", "13+"}
        listings = (listings_year or "").strip()
        if listings not in allowed:
            listings = ""
    sms = int(user.get("sms_consent") or 0)
    sms_at = user.get("sms_consent_at") or ""
    if sms_consent is not None:
        sms = 1 if sms_consent else 0
        sms_at = _iso() if sms else ""
    complete = int(user.get("profile_complete") or 0)
    if mark_complete and name_n and brokerage_n:
        complete = 1
    database.execute(
        """
        UPDATE users SET
          name = ?, phone = ?, brokerage = ?,
          brand_primary = ?, brand_accent = ?, logo_url = ?,
          listings_year = ?, sms_consent = ?, sms_consent_at = ?,
          profile_complete = ?, updated_at = ?
        WHERE id = ?
        """,
        (
            name_n,
            phone_n,
            brokerage_n,
            primary,
            accent,
            logo,
            listings,
            sms,
            sms_at,
            complete,
            _iso(),
            user_id,
        ),
    )
    log_event(
        user_id,
        "profile_updated",
        {"profile_complete": complete, "listings_year": listings, "sms_consent": bool(sms)},
    )
    return get_user_by_id(user_id) or user


MAGIC_LINK_TTL_MIN = 30


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def create_magic_link(
    email: str,
    *,
    promo_code: str = "",
    invite_token: str = "",
    next_path: str = "",
    purpose: str = "auth",
) -> dict:
    email_n = email.strip().lower()
    if not email_n or "@" not in email_n:
        raise ValueError("Valid email is required")
    if invite_token:
        inv = validate_invite(invite_token)
        if not inv["ok"]:
            raise ValueError(inv["error"])
        locked = (inv.get("email") or "").strip().lower()
        if locked and locked != email_n:
            raise ValueError("This invite is locked to a different email")
    if promo_code:
        pv = validate_promo(promo_code)
        if not pv["ok"]:
            raise ValueError(pv["error"])

    raw = secrets.token_urlsafe(32)
    mid = _uid()
    now = _iso()
    expires = _iso(_utcnow() + timedelta(minutes=MAGIC_LINK_TTL_MIN))
    safe_next = (next_path or "").strip()
    if safe_next and not safe_next.startswith("/"):
        safe_next = "/saas/app.html"
    database.execute(
        """
        INSERT INTO magic_links (
          id, email, token_hash, purpose, promo_code, invite_token, next_path, expires_at, used_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)
        """,
        (
            mid,
            email_n,
            _hash_token(raw),
            purpose or "auth",
            (promo_code or "").strip()[:64],
            (invite_token or "").strip()[:120],
            safe_next[:300],
            expires,
            now,
        ),
    )
    existing = get_user_by_email(email_n)
    verify_url = f"{app_base_url()}/saas/verify.html?token={raw}"
    log_event((existing or {}).get("id"), "magic_link_sent", {"email": email_n})
    return {
        "email": email_n,
        "token": raw,
        "url": verify_url,
        "expires_at": expires,
        "is_new": existing is None,
    }


def consume_magic_link(token: str) -> dict:
    """Validate magic link, create/login user, return session-ready user + next path."""
    token = (token or "").strip()
    if not token or len(token) < 20:
        raise ValueError("Invalid or expired link")
    row = database.execute(
        "SELECT * FROM magic_links WHERE token_hash = ?",
        (_hash_token(token),),
        fetch="one",
    )
    if not row:
        raise ValueError("Invalid or expired link")
    if row.get("used_at"):
        raise ValueError("This link was already used — request a new one")
    exp = _parse_iso(row.get("expires_at"))
    if not exp or exp < _utcnow():
        raise ValueError("This link has expired — request a new one")

    email_n = (row.get("email") or "").strip().lower()
    user = get_user_by_email(email_n)
    is_new = False
    if not user:
        user = create_user(
            email=email_n,
            password="",
            promo_code=row.get("promo_code") or "",
            invite_token=row.get("invite_token") or "",
            email_verified=True,
        )
        is_new = True
    else:
        if (user.get("status") or "") == "disabled":
            raise ValueError("This account has been disabled")
        try:
            database.execute(
                "UPDATE users SET email_verified = 1, updated_at = ? WHERE id = ?",
                (_iso(), user["id"]),
            )
        except Exception:
            pass
        user = get_user_by_id(user["id"]) or user

    database.execute(
        "UPDATE magic_links SET used_at = ? WHERE id = ?",
        (_iso(), row["id"]),
    )
    entitlement(user)
    user = get_user_by_id(user["id"]) or user
    log_event(user["id"], "magic_login", {"is_new": is_new})
    requested = (row.get("next_path") or "").strip()
    next_path = resolve_post_auth_next(user, requested)
    needs_onboarding = not bool(int(user.get("profile_complete") or 0))
    if needs_onboarding:
        dest = next_path if next_path.startswith("/") else "/saas/app.html"
        # After onboarding, send admins to owner console if that was the intended home
        next_path = "/saas/onboarding.html?next=" + dest
    return {
        "user": user,
        "is_new": is_new,
        "next": next_path,
        "needs_onboarding": needs_onboarding,
    }


def create_promo_code(
    *,
    code: str,
    label: str = "",
    trial_days: int = DEFAULT_TRIAL_DAYS,
    presentation_limit: int = DEFAULT_PRESENTATION_LIMIT,
    max_redemptions: Optional[int] = None,
    notes: str = "",
    expires_at: Optional[str] = None,
) -> dict:
    code_n = code.strip().upper()
    if not code_n:
        raise ValueError("Code is required")
    if get_promo_by_code(code_n):
        raise ValueError("Promo code already exists")
    pid = _uid()
    database.execute(
        "INSERT INTO promo_codes (id, code, label, max_redemptions, redemptions, trial_days, "
        "presentation_limit, active, expires_at, notes, created_at) "
        "VALUES (?, ?, ?, ?, 0, ?, ?, 1, ?, ?, ?)",
        (
            pid,
            code_n,
            label or code_n,
            max_redemptions,
            trial_days,
            presentation_limit,
            expires_at,
            notes or "",
            _iso(),
        ),
    )
    return get_promo_by_code(code_n) or {"id": pid, "code": code_n}


def list_promo_codes() -> list[dict]:
    return database.execute(
        "SELECT * FROM promo_codes ORDER BY created_at DESC",
        (),
        fetch="all",
    ) or []


def set_promo_active(promo_id: str, active: bool) -> None:
    database.execute(
        "UPDATE promo_codes SET active = ? WHERE id = ?",
        (1 if active else 0, promo_id),
    )


def create_invite(
    *,
    email: str = "",
    trial_days: int = DEFAULT_TRIAL_DAYS,
    presentation_limit: int = DEFAULT_PRESENTATION_LIMIT,
    brokerage: str = "",
    max_uses: int = 1,
    expires_days: int = 30,
    created_by: Optional[str] = None,
    promo_code_id: Optional[str] = None,
) -> dict:
    token = secrets.token_urlsafe(16)
    iid = _uid()
    expires = _iso(_utcnow() + timedelta(days=expires_days)) if expires_days else None
    database.execute(
        "INSERT INTO invites (id, token, email, promo_code_id, trial_days, presentation_limit, "
        "brokerage, max_uses, uses, expires_at, created_by, created_at) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)",
        (
            iid,
            token,
            (email or "").strip().lower() or None,
            promo_code_id,
            trial_days,
            presentation_limit,
            brokerage or "",
            max_uses,
            expires,
            created_by,
            _iso(),
        ),
    )
    row = get_invite(token) or {"id": iid, "token": token}
    row["url"] = f"{app_base_url()}/saas/signup.html?invite={token}"
    return row


def list_invites() -> list[dict]:
    rows = database.execute("SELECT * FROM invites ORDER BY created_at DESC", (), fetch="all") or []
    base = app_base_url()
    for r in rows:
        r["url"] = f"{base}/saas/signup.html?invite={r['token']}"
    return rows


def list_users(q: str = "", limit: int = 200) -> list[dict]:
    q = (q or "").strip()
    if q:
        like = f"%{q}%"
        rows = database.execute(
            "SELECT * FROM users WHERE email LIKE ? OR name LIKE ? OR brokerage LIKE ? "
            "ORDER BY created_at DESC LIMIT ?",
            (like, like, like, limit),
            fetch="all",
        ) or []
    else:
        rows = database.execute(
            "SELECT * FROM users ORDER BY created_at DESC LIMIT ?",
            (limit,),
            fetch="all",
        ) or []
    return [public_user(r) for r in rows if r]


def admin_update_user(
    user_id: str,
    *,
    status: Optional[str] = None,
    presentation_limit: Optional[int] = None,
    extend_days: Optional[int] = None,
    presentations_used: Optional[int] = None,
) -> Optional[dict]:
    user = get_user_by_id(user_id)
    if not user:
        return None
    fields: list[str] = []
    params: list[Any] = []
    if status and status in ("trial", "active", "expired", "disabled"):
        fields.append("status = ?")
        params.append(status)
    if presentation_limit is not None:
        fields.append("presentation_limit = ?")
        params.append(presentation_limit)
    if presentations_used is not None:
        fields.append("presentations_used = ?")
        params.append(max(0, presentations_used))
    if extend_days:
        ends = _parse_iso(user.get("trial_ends_at")) or _utcnow()
        if ends < _utcnow():
            ends = _utcnow()
        fields.append("trial_ends_at = ?")
        params.append(_iso(ends + timedelta(days=int(extend_days))))
        if (user.get("status") or "") in ("expired", "trial"):
            fields.append("status = ?")
            params.append("trial")
    if not fields:
        return public_user(user)
    fields.append("updated_at = ?")
    params.append(_iso())
    params.append(user_id)
    database.execute(f"UPDATE users SET {', '.join(fields)} WHERE id = ?", tuple(params))
    return public_user(get_user_by_id(user_id))


def save_feedback(
    *,
    message: str,
    category: str = "other",
    email: str = "",
    user_id: Optional[str] = None,
    page_url: str = "",
    user_agent: str = "",
) -> dict:
    msg = (message or "").strip()
    if len(msg) < 3:
        raise ValueError("Please enter a bit more detail")
    cat = category if category in ("bug", "suggestion", "other") else "other"
    fid = _uid()
    database.execute(
        "INSERT INTO feedback (id, user_id, email, category, message, page_url, user_agent, status, created_at) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, 'new', ?)",
        (
            fid,
            user_id,
            (email or "").strip()[:200],
            cat,
            msg[:5000],
            (page_url or "")[:500],
            (user_agent or "")[:400],
            _iso(),
        ),
    )
    log_event(user_id, "feedback", {"feedback_id": fid, "category": cat})
    return {"id": fid, "ok": True}


def list_feedback(status: str = "", category: str = "", limit: int = 100) -> list[dict]:
    limit_i = max(1, min(int(limit), 300))
    status = (status or "").strip().lower()
    category = (category or "").strip().lower()
    clauses: list[str] = []
    params: list[Any] = []
    if status and status in ("new", "seen", "done"):
        clauses.append("status = ?")
        params.append(status)
    if category and category in ("bug", "suggestion", "other"):
        clauses.append("category = ?")
        params.append(category)
    where = (" WHERE " + " AND ".join(clauses)) if clauses else ""
    params.append(limit_i)
    return database.execute(
        f"SELECT * FROM feedback{where} ORDER BY created_at DESC LIMIT ?",
        tuple(params),
        fetch="all",
    ) or []


def set_feedback_status(feedback_id: str, status: str) -> None:
    if status not in ("new", "seen", "done"):
        raise ValueError("Invalid status")
    database.execute("UPDATE feedback SET status = ? WHERE id = ?", (status, feedback_id))


def users_needing_trial_reminder(days_before: int = 7) -> list[dict]:
    """Trial users whose trial_ends_at is about `days_before` days away (same calendar day window)."""
    target = _utcnow() + timedelta(days=days_before)
    day_start = target.replace(hour=0, minute=0, second=0, microsecond=0)
    day_end = day_start + timedelta(days=1)
    rows = database.execute(
        "SELECT * FROM users WHERE status = 'trial' AND trial_ends_at >= ? AND trial_ends_at < ?",
        (_iso(day_start), _iso(day_end)),
        fetch="all",
    ) or []
    return rows


def users_newly_expired() -> list[dict]:
    rows = database.execute(
        "SELECT * FROM users WHERE status = 'trial' AND trial_ends_at < ?",
        (_iso(),),
        fetch="all",
    ) or []
    out = []
    for u in rows:
        _mark_expired(u["id"], "trial_expired")
        refreshed = get_user_by_id(u["id"])
        if refreshed:
            out.append(refreshed)
    return out


def event_already_sent(user_id: str, event_type: str, within_hours: int = 40) -> bool:
    since = _iso(_utcnow() - timedelta(hours=within_hours))
    row = database.execute(
        "SELECT id FROM events WHERE user_id = ? AND type = ? AND created_at >= ? LIMIT 1",
        (user_id, event_type, since),
        fetch="one",
    )
    return bool(row)


def recent_event_exists(event_type: str, within_hours: int) -> bool:
    """User-agnostic event check (system cron jobs like the owner digest)."""
    since = _iso(_utcnow() - timedelta(hours=within_hours))
    try:
        row = database.execute(
            "SELECT id FROM events WHERE type = ? AND created_at >= ? LIMIT 1",
            (event_type, since),
            fetch="one",
        )
        return bool(row)
    except Exception:
        return False


def list_recent_signups(days: int = 7) -> list[dict]:
    since = _iso(_utcnow() - timedelta(days=days))
    rows = database.execute(
        "SELECT * FROM users WHERE created_at >= ? ORDER BY created_at DESC LIMIT 50",
        (since,),
        fetch="all",
    ) or []
    return [public_user(r) for r in rows if r]


def list_past_due_users(days: int = 30) -> list[dict]:
    """Users with a recent stripe_past_due / stripe_payment_failed event."""
    since = _iso(_utcnow() - timedelta(days=days))
    try:
        rows = database.execute(
            """
            SELECT DISTINCT user_id FROM events
            WHERE type IN ('stripe_past_due', 'stripe_payment_failed') AND created_at >= ?
            """,
            (since,),
            fetch="all",
        ) or []
    except Exception:
        return []
    out = []
    for r in rows:
        uid = r.get("user_id")
        if not uid:
            continue
        user = get_user_by_id(uid)
        if user:
            pubs = public_user(user) or {}
            pubs["plan_label"] = plan_label(user.get("plan") or "")
            out.append(pubs)
    return out


def list_shared_account_flags(days: int = 7, min_ips: int = 3) -> list[dict]:
    """Accounts whose sessions touched `min_ips`+ distinct IPs in the window — possible sharing."""
    since = _iso(_utcnow() - timedelta(days=days))
    try:
        rows = database.execute(
            """
            SELECT user_id, COUNT(DISTINCT NULLIF(ip, '')) AS ip_count,
                   COUNT(*) AS session_count,
                   MAX(COALESCE(last_seen_at, created_at)) AS last_active
            FROM sessions
            WHERE created_at >= ? OR last_seen_at >= ?
            GROUP BY user_id
            HAVING COUNT(DISTINCT NULLIF(ip, '')) >= ?
            ORDER BY ip_count DESC
            """,
            (since, since, min_ips),
            fetch="all",
        ) or []
    except Exception:
        logger.exception("shared-account flag query failed")
        return []
    out = []
    for r in rows:
        uid = r.get("user_id")
        if not uid:
            continue
        user = get_user_by_id(uid)
        if not user:
            continue
        pub = public_user(user) or {}
        pub["ip_count"] = int(r.get("ip_count") or 0)
        pub["session_count"] = int(r.get("session_count") or 0)
        pub["last_active"] = r.get("last_active")
        pub["plan_label"] = plan_label(user.get("plan") or "")
        out.append(pub)
    return out


def bootstrap() -> None:
    """Run migrations and seed admin + default promo."""
    database.run_migrations()
    admin_email = (os.environ.get("ADMIN_BOOTSTRAP_EMAIL") or "adam@saahomes.com").strip().lower()
    admin_pass = (os.environ.get("ADMIN_BOOTSTRAP_PASSWORD") or "").strip()
    existing = get_user_by_email(admin_email)
    if not existing:
        if not admin_pass:
            admin_pass = secrets.token_urlsafe(12)
            logger.warning(
                "Created bootstrap admin %s with generated password (set ADMIN_BOOTSTRAP_PASSWORD). Pass: %s",
                admin_email,
                admin_pass,
            )
        try:
            create_user(
                email=admin_email,
                password=admin_pass,
                name="Adam Schwartz",
                brokerage="SAA Homes",
                role="admin",
                email_verified=True,
            )
        except Exception as exc:
            msg = str(exc).lower()
            if "unique" in msg or "duplicate key" in msg:
                logger.info("Bootstrap admin %s already exists", admin_email)
            else:
                raise
        # Make admin active/unlimited
        admin = get_user_by_email(admin_email)
        if admin:
            database.execute(
                "UPDATE users SET role = 'admin', status = 'active', presentation_limit = NULL, updated_at = ? WHERE id = ?",
                (_iso(), admin["id"]),
            )
    elif admin_pass:
        # Allow password reset via env on boot if set; keep admin unlimited
        database.execute(
            "UPDATE users SET password_hash = ?, role = 'admin', status = 'active', "
            "presentation_limit = NULL, trial_ends_at = NULL, updated_at = ? WHERE id = ?",
            (_hash_password(admin_pass), _iso(), existing["id"]),
        )
    else:
        database.execute(
            "UPDATE users SET role = 'admin', status = 'active', "
            "presentation_limit = NULL, trial_ends_at = NULL, updated_at = ? WHERE id = ?",
            (_iso(), existing["id"]),
        )

    if not get_promo_by_code("CBListLogic"):
        try:
            create_promo_code(
                code="CBListLogic",
                label="Coldwell Banker ListLogic trial",
                trial_days=DEFAULT_TRIAL_DAYS,
                presentation_limit=DEFAULT_PRESENTATION_LIMIT,
                max_redemptions=200,
                notes="Default CB outreach code — complimentary credits (admin-configured limit/days)",
            )
        except Exception as exc:
            # Another instance may have created it concurrently; log and continue.
            logger.info("Promo code CBListLogic already present: %s", exc)
    # Retire legacy codes if they still exist from earlier seeds
    for legacy in ("COLDWELL-NOCO", "LISTLOGIC-BETA"):
        row = get_promo_by_code(legacy)
        if row and int(row.get("active") or 0):
            try:
                set_promo_active(row["id"], False)
            except Exception:
                pass
    logger.info("Auth bootstrap complete")
