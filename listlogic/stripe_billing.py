"""Stripe Checkout + webhook helpers for ListLogic plans."""
from __future__ import annotations

import logging
import os
from typing import Any, Optional

logger = logging.getLogger("ListLogic.stripe")

# Live prices created in LeadData.io / ListLogic Stripe account (lookup_key fallbacks).
DEFAULT_PRICE_IDS = {
    "agent_monthly": "price_1U2aUn0087Tci2qY7dWr9sEX",
    "agent_annual": "price_1U2aUo0087Tci2qYNxP5jrby",
    "one_time": "price_1U2aUp0087Tci2qYzMM0cw0f",
    "brokerage_monthly": "price_1U2aUp0087Tci2qYv13JxTh5",
    "brokerage_annual": "price_1U2aVB0087Tci2qYazLBHDRp",
}

PLAN_META = {
    "agent_monthly": {"mode": "subscription", "label": "Agent monthly", "unlimited": True},
    "agent_annual": {"mode": "subscription", "label": "Agent annual", "unlimited": True},
    "one_time": {"mode": "payment", "label": "One-time report", "unlimited": False},
    "brokerage_monthly": {
        "mode": "subscription",
        "label": "Brokerage seat (monthly)",
        "unlimited": True,
        "min_qty": 5,
    },
    "brokerage_annual": {
        "mode": "subscription",
        "label": "Brokerage seat (annual)",
        "unlimited": True,
        "min_qty": 5,
    },
}


def stripe_configured() -> bool:
    return bool((os.environ.get("STRIPE_SECRET_KEY") or "").strip())


def get_stripe():
    import stripe

    key = (os.environ.get("STRIPE_SECRET_KEY") or "").strip()
    if not key:
        raise RuntimeError("STRIPE_SECRET_KEY is not set")
    stripe.api_key = key
    return stripe


def price_id_for_plan(plan: str) -> str:
    plan = (plan or "").strip().lower()
    env_map = {
        "agent_monthly": "STRIPE_PRICE_AGENT_MONTHLY",
        "agent_annual": "STRIPE_PRICE_AGENT_ANNUAL",
        "one_time": "STRIPE_PRICE_ONE_TIME",
        "brokerage_monthly": "STRIPE_PRICE_BROKERAGE_MONTHLY",
        "brokerage_annual": "STRIPE_PRICE_BROKERAGE_ANNUAL",
    }
    if plan not in env_map:
        raise ValueError(f"Unknown plan: {plan}")
    env_val = (os.environ.get(env_map[plan]) or "").strip()
    return env_val or DEFAULT_PRICE_IDS[plan]


def public_plans() -> dict:
    return {
        "configured": stripe_configured(),
        "plans": {
            key: {
                "label": meta["label"],
                "mode": meta["mode"],
                "min_qty": meta.get("min_qty", 1),
                "price_id_set": bool(price_id_for_plan(key)),
            }
            for key, meta in PLAN_META.items()
        },
    }


def app_base_url() -> str:
    return (os.environ.get("APP_BASE_URL") or "https://listlogic.homes").rstrip("/")


def ensure_customer(user: dict) -> str:
    """Return Stripe customer id, creating one if needed."""
    import auth_service

    existing = (user.get("stripe_customer_id") or "").strip()
    if existing:
        return existing

    stripe = get_stripe()
    customer = stripe.Customer.create(
        email=user.get("email") or None,
        name=(user.get("name") or None) or None,
        metadata={"listlogic_user_id": user["id"], "app": "listlogic"},
    )
    cid = customer["id"]
    auth_service.set_stripe_ids(user["id"], stripe_customer_id=cid)
    return cid


def create_checkout_session(
    user: dict,
    *,
    plan: str,
    quantity: int = 1,
) -> dict[str, Any]:
    plan = (plan or "").strip().lower()
    meta = PLAN_META.get(plan)
    if not meta:
        raise ValueError("Unknown plan")

    qty = max(1, int(quantity or 1))
    min_qty = int(meta.get("min_qty") or 1)
    if qty < min_qty:
        raise ValueError(f"Minimum {min_qty} seats for this plan")

    stripe = get_stripe()
    customer_id = ensure_customer(user)
    price_id = price_id_for_plan(plan)
    base = app_base_url()

    kwargs: dict[str, Any] = {
        "mode": meta["mode"],
        "customer": customer_id,
        "client_reference_id": user["id"],
        "line_items": [{"price": price_id, "quantity": qty}],
        "success_url": f"{base}/saas/app.html?billing=success&plan={plan}",
        "cancel_url": f"{base}/saas/app.html?billing=cancel",
        "metadata": {
            "app": "listlogic",
            "plan": plan,
            "user_id": user["id"],
            "quantity": str(qty),
        },
        "allow_promotion_codes": True,
        # Checkout / hosted UI brand (account may still say LeadData until Dashboard rename)
        "branding_settings": {
            "display_name": "Schwartz and Associates",
        },
    }
    if meta["mode"] == "subscription":
        sub_data: dict[str, Any] = {
            "metadata": {
                "app": "listlogic",
                "plan": plan,
                "user_id": user["id"],
                "quantity": str(qty),
            }
        }
        # Card-required 7-day trial on agent monthly (auto-converts to $39/mo).
        trial_days = int(os.environ.get("STRIPE_TRIAL_DAYS") or "7")
        if plan == "agent_monthly" and trial_days > 0:
            sub_data["trial_period_days"] = trial_days
            kwargs["payment_method_collection"] = "always"
        kwargs["subscription_data"] = sub_data
    elif meta["mode"] == "payment":
        # One-time: push ListLogic onto the card line when banks use suffix
        kwargs["payment_intent_data"] = {
            "statement_descriptor_suffix": "LISTLOGIC",
        }

    session = stripe.checkout.Session.create(**kwargs)
    return {"id": session["id"], "url": session["url"], "plan": plan}


def create_billing_portal_session(user: dict) -> dict[str, str]:
    cid = (user.get("stripe_customer_id") or "").strip()
    if not cid:
        raise ValueError("No Stripe customer on this account yet")
    stripe = get_stripe()
    portal = stripe.billing_portal.Session.create(
        customer=cid,
        return_url=f"{app_base_url()}/saas/app.html",
    )
    return {"url": portal["url"]}


def construct_event(payload: bytes, sig_header: str):
    stripe = get_stripe()
    secret = (os.environ.get("STRIPE_WEBHOOK_SECRET") or "").strip()
    if not secret:
        raise RuntimeError("STRIPE_WEBHOOK_SECRET is not set")
    return stripe.Webhook.construct_event(payload, sig_header, secret)


def handle_webhook_event(event: dict) -> dict[str, Any]:
    import auth_service

    etype = event.get("type") or ""
    data = (event.get("data") or {}).get("object") or {}

    if etype == "checkout.session.completed":
        return _on_checkout_completed(auth_service, data)
    if etype in ("customer.subscription.updated", "customer.subscription.deleted"):
        return _on_subscription_change(auth_service, data, deleted=etype.endswith("deleted"))
    if etype == "invoice.payment_failed":
        return _on_payment_failed(auth_service, data)
    return {"ok": True, "ignored": etype}


def _user_id_from_meta(obj: dict) -> Optional[str]:
    meta = obj.get("metadata") or {}
    uid = (meta.get("user_id") or obj.get("client_reference_id") or "").strip()
    return uid or None


def _on_checkout_completed(auth_service, session: dict) -> dict[str, Any]:
    user_id = _user_id_from_meta(session)
    meta = session.get("metadata") or {}
    plan = (meta.get("plan") or "").strip().lower()
    customer_id = session.get("customer")
    subscription_id = session.get("subscription")
    qty = int(meta.get("quantity") or 1)

    if not user_id:
        # Fallback: look up by customer id
        if customer_id:
            user = auth_service.get_user_by_stripe_customer(str(customer_id))
            user_id = user["id"] if user else None
    if not user_id:
        logger.warning("checkout.session.completed without user_id: %s", session.get("id"))
        return {"ok": False, "reason": "missing_user"}

    if customer_id:
        auth_service.set_stripe_ids(
            user_id,
            stripe_customer_id=str(customer_id),
            stripe_subscription_id=str(subscription_id) if subscription_id else None,
            plan=plan or None,
        )

    if plan == "one_time" or session.get("mode") == "payment":
        user = auth_service.apply_one_time_purchase(user_id, quantity=qty)
    else:
        user = auth_service.apply_subscription_active(
            user_id,
            plan=plan or "agent_monthly",
            stripe_subscription_id=str(subscription_id) if subscription_id else None,
            seat_quantity=qty,
        )

    auth_service.log_event(
        user_id,
        "stripe_checkout_completed",
        {"plan": plan, "session_id": session.get("id"), "quantity": qty},
    )
    return {"ok": True, "user_id": user_id, "plan": plan, "status": (user or {}).get("status")}


def _on_subscription_change(auth_service, sub: dict, *, deleted: bool) -> dict[str, Any]:
    customer_id = sub.get("customer")
    user = None
    uid = _user_id_from_meta(sub)
    if uid:
        user = auth_service.get_user_by_id(uid)
    if not user and customer_id:
        user = auth_service.get_user_by_stripe_customer(str(customer_id))
    if not user:
        return {"ok": False, "reason": "user_not_found"}

    status = (sub.get("status") or "").lower()
    plan = ((sub.get("metadata") or {}).get("plan") or user.get("plan") or "").strip().lower()

    if deleted or status in ("canceled", "unpaid", "incomplete_expired"):
        auth_service.apply_subscription_ended(user["id"])
        auth_service.log_event(user["id"], "stripe_subscription_ended", {"status": status})
        return {"ok": True, "ended": True}

    if status in ("active", "trialing"):
        auth_service.apply_subscription_active(
            user["id"],
            plan=plan or "agent_monthly",
            stripe_subscription_id=str(sub.get("id") or ""),
            seat_quantity=int(sub.get("quantity") or 1),
        )
        return {"ok": True, "active": True}

    if status == "past_due":
        auth_service.log_event(user["id"], "stripe_past_due", {"subscription": sub.get("id")})
        return {"ok": True, "past_due": True}

    return {"ok": True, "status": status}


def _on_payment_failed(auth_service, invoice: dict) -> dict[str, Any]:
    customer_id = invoice.get("customer")
    user = auth_service.get_user_by_stripe_customer(str(customer_id)) if customer_id else None
    if user:
        auth_service.log_event(
            user["id"],
            "stripe_payment_failed",
            {"invoice": invoice.get("id")},
        )
    return {"ok": True}


# ---------- Owner console: live Stripe snapshots ----------

_SNAPSHOT_CACHE: dict[str, tuple[float, dict]] = {}
_SNAPSHOT_TTL = 600  # seconds


def _cents(value: Any) -> float:
    try:
        return round(float(value or 0) / 100.0, 2)
    except Exception:
        return 0.0


def _ts(value: Any) -> str:
    if not value:
        return ""
    try:
        from datetime import datetime, timezone

        return datetime.fromtimestamp(int(value), tz=timezone.utc).isoformat()
    except Exception:
        return ""


def subscription_snapshot(user: dict) -> Optional[dict]:
    """Live Stripe state for one user: sub status, last payment, next renewal.

    Cached per customer for _SNAPSHOT_TTL seconds so dashboard refreshes don't
    fan out into Stripe rate limits.
    """
    cid = (user.get("stripe_customer_id") or "").strip()
    sub_id = (user.get("stripe_subscription_id") or "").strip()
    if not cid or not stripe_configured():
        return None

    cache_key = f"{cid}:{sub_id}"
    import time

    hit = _SNAPSHOT_CACHE.get(cache_key)
    if hit and (time.time() - hit[0]) < _SNAPSHOT_TTL:
        return hit[1]

    stripe = get_stripe()
    snap: dict[str, Any] = {
        "subscription_status": "",
        "cancel_at_period_end": False,
        "next_renewal": "",
        "seats": 0,
        "monthly_amount": 0.0,
        "last_payment_amount": 0.0,
        "last_payment_at": "",
    }
    try:
        if sub_id:
            sub = stripe.Subscription.retrieve(sub_id)
            snap["subscription_status"] = (sub.get("status") or "").lower()
            snap["cancel_at_period_end"] = bool(sub.get("cancel_at_period_end"))
            snap["next_renewal"] = _ts(sub.get("current_period_end"))
            items = ((sub.get("items") or {}).get("data") or [])
            if items:
                item = items[0]
                qty = int(item.get("quantity") or sub.get("quantity") or 1)
                snap["seats"] = qty
                price = item.get("price") or {}
                unit = _cents(price.get("unit_amount"))
                interval = (price.get("recurring") or {}).get("interval") or "month"
                monthly = unit * qty
                if interval == "year":
                    monthly = monthly / 12.0
                snap["monthly_amount"] = round(monthly, 2)
        invoice_iter = stripe.Invoice.list(customer=cid, status="paid", limit=1)
        paid = (invoice_iter.get("data") or [])
        if paid:
            inv = paid[0]
            snap["last_payment_amount"] = _cents(inv.get("amount_paid"))
            snap["last_payment_at"] = _ts(inv.get("status_transitions", {}).get("paid_at") or inv.get("created"))
    except Exception:
        logger.exception("Stripe snapshot failed for customer %s", cid)
        return None

    _SNAPSHOT_CACHE[cache_key] = (time.time(), snap)
    return snap
