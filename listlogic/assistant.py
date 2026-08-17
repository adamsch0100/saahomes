"""
ListLogic AI assistant — product help + feedback coach.

Uses OpenCode Go (default deepseek-v4-flash — cheap + grounded by product KB).
"""
from __future__ import annotations

import json
import logging
import os
import urllib.request
from pathlib import Path
from typing import Any, Optional

logger = logging.getLogger("ListLogic.assistant")

OPENCODE_GO_API_URL = "https://opencode.ai/zen/go/v1/chat/completions"
# Cheap helper for Q&A / feedback triage (override with LISTLOGIC_ASSISTANT_MODEL=kimi-k2.6 if needed)
DEFAULT_ASSISTANT_MODEL = "deepseek-v4-flash"

PRODUCT_KNOWLEDGE = """
# ListLogic product knowledge (source of truth for the assistant)

## What it is
ListLogic is a SaaS tool for real estate listing agents. Search a market nationwide (location + filters + optional map) or upload an MLS export from any MLS, set the subject home + branding, and generate an interactive seller pricing presentation (live story), plus a portrait seller packet PDF and a landscape listing flipbook.

Brand domain: listlogic.homes
Built for Schwartz and Associates / SAA Homes; sold to agents more broadly.

## Core pricing ideas (domain rules)
- Months of inventory = Active listings ÷ sales per month. Pending/Backup are NOT inventory.
- Under contract = Pending + Backup (+ FirstRight treated as pending).
- Only Active homes compete for buyers.
- Condition rating starts at typical 5/10 in the live story; adjust together and list price responds.
- Days to contract / odds include supply-stream awareness: new listings under the tested ask cut in line.
- Recommended list is anchored to recent comparable closes, not wishful asking prices.

## Funnel: Demo → Account → Unlock → Paid
1. **Sample demo** (`/demo`) — public sample listing (2845 W 13th St, Greeley). No account. Free forever.
2. **Create account** (email magic link) — no card. Search/Upload, subject, branding allowed (setup).
3. **Generate** — hard gate. Personalized teaser. Unlock with **7-day Stripe trial** (card required → auto $39/mo) or **$20 one-time** for that report. Or open sample demo.
4. Optional **promo codes** / **invite links** may still grant complimentary trial credits (admin-controlled).
5. Paid plans: $20 one-time, $39/mo agent (after 7-day trial), $390/yr, brokerage $29/seat/mo (min 5).

## Accounts & access
- Signup at `/saas/signup.html`; login at `/saas/login.html`.
- Admin at `/saas/admin.html` (role=admin): users, promo codes, invites, feedback inbox.
- Bootstrap admin via ADMIN_BOOTSTRAP_EMAIL / ADMIN_BOOTSTRAP_PASSWORD.
- New public signups have status `setup` until they pay — they cannot generate custom presentations for free.

## How agents use it
1. Sign in → `/saas/app.html`
2. Choose **Search** (nationwide market pull with filters/map) or **Upload** (CSV/TXT from any MLS). On Upload, review and confirm column mapping before generate. Sample checkbox uses the bundled Greeley export for practice.
3. Enter subject address / beds / baths / sq ft / branding
4. Generate → interactive `/runs/{id}/` with charts, comps, supply stream, price slider, Agent Tools
5. Seller packet PDF + listing flipbook from the presentation chrome

## Feedback system
- Agents should report bugs/suggestions via the assistant or Send feedback.
- Feedback is stored and emailed to Adam (FEEDBACK_TO / adam@saahomes.com).
- Categories: bug, suggestion, other.
- Admin can mark feedback new/seen/done.

## What the assistant should do
- Answer how-to questions about ListLogic (trial, demo, generate, Search vs Upload, header mapping, print packs, pricing math concepts at a high level).
- Help users phrase and file feedback (bugs/suggestions).
- Be honest when something needs Adam (billing exceptions, custom brokerage deals, data bugs you cannot verify).
- Stripe Checkout is wired for agent monthly/annual, one-time, and brokerage seats. Brokerage owners invite teammates themselves from the Team tab after login (paste emails). If checkout errors or a webhook has not activated yet, tell the agent to refresh or email Adam — do not invent access.
- Never reveal other users’ data, admin passwords, API keys, or internal secrets.
- Do not disclose how Search market data is sourced (no portal/vendor names). Keep answers product-facing.
- Keep answers short, practical, agent-friendly.

## Tone
Clear, calm, professional — like a sharp product specialist sitting beside the agent.
"""


def _load_env_file() -> None:
    env_path = Path(__file__).resolve().parent / ".env"
    if not env_path.exists():
        return
    try:
        for line in env_path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, val = line.split("=", 1)
            key, val = key.strip(), val.strip().strip('"').strip("'")
            if key and not os.environ.get(key):
                os.environ[key] = val
    except Exception:
        pass


def assistant_model() -> str:
    return (os.environ.get("LISTLOGIC_ASSISTANT_MODEL") or DEFAULT_ASSISTANT_MODEL).strip()


def _opencode_key() -> str:
    _load_env_file()
    return (os.environ.get("OPENCODE_GO_API_KEY") or "").strip()


def available() -> bool:
    return bool(_opencode_key())


def _system_prompt(user: Optional[dict] = None) -> str:
    bits = [
        "You are ListLogic Assistant — the in-app help and feedback guide for signed-in listing agents.",
        PRODUCT_KNOWLEDGE.strip(),
        "\n## Current user context",
    ]
    if user:
        bits.append(
            f"- Name: {user.get('name') or '—'}\n"
            f"- Email: {user.get('email') or '—'}\n"
            f"- Brokerage: {user.get('brokerage') or '—'}\n"
            f"- Account status: {user.get('status') or '—'}\n"
            f"- Presentations used: {user.get('presentations_used')} / {user.get('presentation_limit')}\n"
            f"- Trial ends: {user.get('trial_ends_at') or '—'}\n"
        )
    else:
        bits.append("- (no user profile)")
    bits.append(
        "\nWhen the user reports a bug or suggestion, acknowledge it, ask 1 clarifying question only if needed, "
        "then tell them you can file it — respond with a short JSON block ONLY when they confirm filing, like:\n"
        '```feedback\n{"category":"bug"|"suggestion"|"other","message":"..."}\n```\n'
        "Otherwise answer in normal markdown-ish plain text. Do not wrap normal answers in JSON."
    )
    return "\n".join(bits)


def chat(
    *,
    messages: list[dict[str, str]],
    user: Optional[dict] = None,
    page_url: str = "",
) -> dict[str, Any]:
    """
    messages: [{role: user|assistant, content: str}, ...] recent turns only.
    """
    key = _opencode_key()
    if not key:
        return {
            "ok": False,
            "error": "Assistant is not configured (missing OPENCODE_GO_API_KEY).",
            "reply": (
                "I can’t reach the AI helper right now. Use **Send feedback** in this panel, "
                "or email adam@saahomes.com — or try again after Adam configures OpenCode."
            ),
        }

    # Cap history
    cleaned: list[dict[str, str]] = []
    for m in messages[-12:]:
        role = (m.get("role") or "").strip()
        content = (m.get("content") or "").strip()
        if role not in ("user", "assistant") or not content:
            continue
        cleaned.append({"role": role, "content": content[:4000]})
    if not cleaned or cleaned[-1]["role"] != "user":
        return {"ok": False, "error": "Send a user message.", "reply": "Ask me anything about ListLogic."}

    sys = _system_prompt(user)
    if page_url:
        sys += f"\nAgent is currently on page: {page_url}\n"

    payload = json.dumps({
        "model": assistant_model(),
        "messages": [{"role": "system", "content": sys}, *cleaned],
        "temperature": 0.35,
        "max_tokens": 900,
    }).encode("utf-8")

    try:
        req = urllib.request.Request(
            OPENCODE_GO_API_URL,
            data=payload,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {key}",
                "User-Agent": "ListLogic-Assistant/1.0",
            },
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=90) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        reply = (data.get("choices") or [{}])[0].get("message", {}).get("content", "").strip()
        if not reply:
            raise RuntimeError("Empty model reply")
        feedback_draft = _extract_feedback_block(reply)
        return {
            "ok": True,
            "reply": reply,
            "model": assistant_model(),
            "feedback_draft": feedback_draft,
        }
    except Exception as exc:
        logger.exception("Assistant chat failed")
        return {
            "ok": False,
            "error": str(exc),
            "reply": (
                "Sorry — I hit a snag talking to the model. Try again in a moment, "
                "or file feedback with the Feedback tab / email adam@saahomes.com."
            ),
        }


def _extract_feedback_block(reply: str) -> Optional[dict]:
    import re

    m = re.search(r"```feedback\s*(\{.*?\})\s*```", reply, re.DOTALL | re.IGNORECASE)
    if not m:
        return None
    try:
        data = json.loads(m.group(1))
        if not isinstance(data, dict) or not data.get("message"):
            return None
        cat = data.get("category") or "other"
        if cat not in ("bug", "suggestion", "other"):
            cat = "other"
        return {"category": cat, "message": str(data.get("message"))[:5000]}
    except Exception:
        return None
