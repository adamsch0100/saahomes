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
DEFAULT_TRIAL_DAYS = int(os.environ.get("DEFAULT_TRIAL_DAYS") or "60")
DEFAULT_PRESENTATION_LIMIT = int(os.environ.get("DEFAULT_PRESENTATION_LIMIT") or "3")


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


def _hash_token(token: str) -> str:
    secret = (os.environ.get("SESSION_SECRET") or "listlogic-dev-secret").encode("utf-8")
    return hmac.new(secret, token.encode("utf-8"), hashlib.sha256).hexdigest()


def default_trial_days() -> int:
    return DEFAULT_TRIAL_DAYS


def default_presentation_limit() -> int:
    return DEFAULT_PRESENTATION_LIMIT


def app_base_url() -> str:
    return (os.environ.get("APP_BASE_URL") or "https://listlogic.homes").rstrip("/")


def auth_required() -> bool:
    """Auth is always required once accounts system is initialized."""
    return True


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
    }


def get_user_by_id(user_id: str) -> Optional[dict]:
    return database.execute("SELECT * FROM users WHERE id = ?", (user_id,), fetch="one")


def get_user_by_email(email: str) -> Optional[dict]:
    return database.execute(
        "SELECT * FROM users WHERE lower(email) = lower(?)",
        (email.strip(),),
        fetch="one",
    )


def log_event(user_id: Optional[str], event_type: str, meta: Optional[dict] = None) -> None:
    try:
        database.execute(
            "INSERT INTO events (id, user_id, type, meta, created_at) VALUES (?, ?, ?, ?, ?)",
            (_uid(), user_id, event_type, json.dumps(meta or {}), _iso()),
        )
    except Exception:
        logger.exception("Failed to log event %s", event_type)


def create_session(user_id: str) -> str:
    token = secrets.token_urlsafe(32)
    expires = _utcnow() + timedelta(days=SESSION_DAYS)
    database.execute(
        "INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)",
        (_uid(), user_id, _hash_token(token), _iso(expires), _iso()),
    )
    return token


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
    Whichever-first trial: entitled while status active OR
    (status trial AND before trial_ends_at AND under presentation_limit).
    """
    status = (user.get("status") or "").lower()
    used = int(user.get("presentations_used") or 0)
    limit = user.get("presentation_limit")
    limit_i = int(limit) if limit is not None else None
    ends = _parse_iso(user.get("trial_ends_at"))

    if status == "disabled":
        return {"ok": False, "reason": "disabled", "remaining": 0, "days_left": 0}
    if status == "active":
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
        return {"ok": False, "reason": reason, "remaining": 0, "days_left": days_left or 0}

    # trial
    if ends and ends < _utcnow():
        _mark_expired(user["id"], "trial_expired")
        return {"ok": False, "reason": "trial_expired", "remaining": 0, "days_left": 0}
    if limit_i is not None and used >= limit_i:
        _mark_expired(user["id"], "limit_reached")
        return {"ok": False, "reason": "limit_reached", "remaining": 0, "days_left": days_left}

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
        return {"ok": False, "reason": "limit_reached", "remaining": 0, "just_exhausted": True}
    return entitlement(user)


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
) -> dict:
    """Persist a generated report for the agent library + client share link."""
    existing = database.execute(
        "SELECT * FROM presentations WHERE run_id = ?",
        (run_id,),
        fetch="one",
    )
    now = _iso()
    if existing:
        database.execute(
            """
            UPDATE presentations SET
              address = ?, recommended_price = ?, months_of_inventory = ?,
              active_count = ?, under_contract_count = ?, title = ?, updated_at = ?
            WHERE run_id = ?
            """,
            (
                address or existing.get("address") or "",
                recommended_price if recommended_price is not None else existing.get("recommended_price"),
                months_of_inventory if months_of_inventory is not None else existing.get("months_of_inventory"),
                active_count if active_count is not None else existing.get("active_count"),
                under_contract_count if under_contract_count is not None else existing.get("under_contract_count"),
                title or existing.get("title") or "",
                now,
                run_id,
            ),
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
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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


def get_presentation_by_run(run_id: str) -> Optional[dict]:
    row = database.execute(
        "SELECT * FROM presentations WHERE run_id = ?",
        (run_id,),
        fetch="one",
    )
    return _presentation_public(row) if row else None


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

    if invite_token:
        inv = validate_invite(invite_token)
        if not inv["ok"]:
            raise ValueError(inv["error"])
        trial_days = inv["trial_days"]
        presentation_limit = inv["presentation_limit"]
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
        promo_id = pv["promo"]["id"]

    now = _iso()
    ends = _iso(_utcnow() + timedelta(days=trial_days))
    user_id = _uid()
    pw_hash = _hash_password(password) if password else f"magic:{secrets.token_hex(16)}"
    profile_complete = 1 if (name or "").strip() and (brokerage or "").strip() else 0
    try:
        database.execute(
            "INSERT INTO users (id, email, password_hash, name, phone, brokerage, role, status, "
            "trial_ends_at, presentations_used, presentation_limit, promo_code_id, created_at, updated_at, "
            "brand_primary, brand_accent, logo_url, profile_complete, email_verified) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, 'trial', ?, 0, ?, ?, ?, ?, ?, ?, '', ?, ?)",
            (
                user_id,
                email_n,
                pw_hash,
                (name or "").strip()[:120],
                (phone or "").strip()[:40],
                (brokerage or "").strip()[:120],
                role if role in ("agent", "admin") else "agent",
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
            "VALUES (?, ?, ?, ?, ?, ?, ?, 'trial', ?, 0, ?, ?, ?, ?)",
            (
                user_id,
                email_n,
                pw_hash,
                (name or "").strip()[:120],
                (phone or "").strip()[:40],
                (brokerage or "").strip()[:120],
                role if role in ("agent", "admin") else "agent",
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
    complete = int(user.get("profile_complete") or 0)
    if mark_complete and name_n and brokerage_n:
        complete = 1
    database.execute(
        """
        UPDATE users SET
          name = ?, phone = ?, brokerage = ?,
          brand_primary = ?, brand_accent = ?, logo_url = ?,
          profile_complete = ?, updated_at = ?
        WHERE id = ?
        """,
        (name_n, phone_n, brokerage_n, primary, accent, logo, complete, _iso(), user_id),
    )
    log_event(user_id, "profile_updated", {"profile_complete": complete})
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
    next_path = (row.get("next_path") or "").strip() or "/saas/app.html"
    needs_onboarding = not bool(int(user.get("profile_complete") or 0))
    if needs_onboarding:
        dest = next_path if next_path.startswith("/") else "/saas/app.html"
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


def list_feedback(status: str = "", limit: int = 100) -> list[dict]:
    if status:
        return database.execute(
            "SELECT * FROM feedback WHERE status = ? ORDER BY created_at DESC LIMIT ?",
            (status, limit),
            fetch="all",
        ) or []
    return database.execute(
        "SELECT * FROM feedback ORDER BY created_at DESC LIMIT ?",
        (limit,),
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

    if not get_promo_by_code("COLDWELL-NOCO"):
        try:
            create_promo_code(
                code="COLDWELL-NOCO",
                label="Coldwell Banker Northern Colorado trial",
                trial_days=DEFAULT_TRIAL_DAYS,
                presentation_limit=DEFAULT_PRESENTATION_LIMIT,
                max_redemptions=200,
                notes="Default CB outreach code — 3 presentations or 60 days, whichever first",
            )
        except Exception as exc:
            # Another instance may have created it concurrently; log and continue.
            logger.info("Promo code COLDWELL-NOCO already present: %s", exc)
    logger.info("Auth bootstrap complete")
