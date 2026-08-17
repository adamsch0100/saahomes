"""Account-level reusable presentation wording (ledes, extra bullets, coach templates).

Listing-specific bottom line, recommended price, and data-generated
advantages/risks are never stored as account defaults.
"""
from __future__ import annotations

import json
from typing import Any

LEDE_KEYS = ("comps", "condition", "close")

DEFAULT_LEDES = {
    "comps": "Does it look like yours — or nicer / dated — and does the sold price match that story?",
    "condition": (
        "Within your segment, updates and presentation decide where you land. "
        "We start at a typical 5/10, rate together, then lock the list."
    ),
    "close": "We'll fine-tune condition, lock the list, and launch with a plan buyers can believe.",
}


def _clip(value: Any, limit: int) -> str:
    return str(value or "").strip()[:limit]


def _lines(value: Any, *, limit: int = 8, each: int = 220) -> list[str]:
    if isinstance(value, list):
        raw = value
    else:
        raw = str(value or "").splitlines()
    out: list[str] = []
    for item in raw:
        text = _clip(item, each)
        if text and text not in out:
            out.append(text)
        if len(out) >= limit:
            break
    return out


def sanitize(raw: Any) -> dict[str, Any]:
    data = raw if isinstance(raw, dict) else {}
    ledes_in = data.get("ledes") if isinstance(data.get("ledes"), dict) else {}
    ledes = {}
    for key in LEDE_KEYS:
        text = _clip(ledes_in.get(key), 500)
        if text:
            ledes[key] = text
    return {
        "ledes": ledes,
        "extraAdv": _lines(data.get("extraAdv")),
        "extraRisk": _lines(data.get("extraRisk")),
        "coachTemplates": _clip(data.get("coachTemplates"), 4000),
    }


def parse(raw: Any) -> dict[str, Any]:
    if isinstance(raw, dict):
        return sanitize(raw)
    if isinstance(raw, str) and raw.strip():
        try:
            return sanitize(json.loads(raw))
        except (TypeError, ValueError, json.JSONDecodeError):
            return sanitize({})
    return sanitize({})


def dumps(data: dict[str, Any]) -> str:
    return json.dumps(sanitize(data), ensure_ascii=False)


def _parse_coach(text: str) -> list[dict[str, str]]:
    cards = []
    for line in (text or "").splitlines():
        line = line.strip()
        if not line:
            continue
        if "|" in line:
            title, body = line.split("|", 1)
        else:
            title, body = "Note", line
        title = title.strip()[:80] or "Note"
        body = body.strip()[:400]
        if body:
            cards.append({"title": title, "body": body})
        if len(cards) >= 8:
            break
    return cards


def apply_account_copy(report: dict, raw: Any) -> dict:
    """Merge reusable account wording into a freshly generated report."""
    copy = parse(raw)
    pos = report.setdefault("positioning", {})
    adv = [str(x) for x in (pos.get("advantages") or []) if str(x).strip()]
    risk = [str(x) for x in (pos.get("risks") or []) if str(x).strip()]
    for item in copy["extraAdv"]:
        if item not in adv:
            adv.append(item)
    for item in copy["extraRisk"]:
        if item not in risk:
            risk.append(item)
    pos["advantages"] = adv
    pos["risks"] = risk

    story = report.setdefault("story", {})
    if copy["coachTemplates"]:
        existing = list(story.get("objection_cards") or [])
        have = {(c.get("title") or "").strip().lower() for c in existing if isinstance(c, dict)}
        for card in _parse_coach(copy["coachTemplates"]):
            key = card["title"].strip().lower()
            if key not in have:
                existing.append(card)
                have.add(key)
        story["objection_cards"] = existing[:8]

    if copy["ledes"]:
        report["copy_ledes"] = dict(copy["ledes"])
    return report


def apply_run_edits(report: dict, edits: Any) -> dict:
    """Overlay this-listing Agent Tools edits onto a report before re-baking the flipbook."""
    data = edits if isinstance(edits, dict) else {}
    pos = report.setdefault("positioning", {})
    if data.get("rec") not in (None, ""):
        try:
            pos["recommended_price"] = float(data["rec"])
        except (TypeError, ValueError):
            pass
    if data.get("low") not in (None, ""):
        try:
            pos["price_low"] = float(data["low"])
        except (TypeError, ValueError):
            pass
    if data.get("high") not in (None, ""):
        try:
            pos["price_high"] = float(data["high"])
        except (TypeError, ValueError):
            pass
    if data.get("dom") not in (None, ""):
        try:
            pos["expected_dom"] = float(data["dom"])
        except (TypeError, ValueError):
            pass
    if data.get("bl") is not None:
        report["executive_summary"] = str(data["bl"])
    if data.get("adv") is not None:
        pos["advantages"] = _lines(data.get("adv"), limit=12)
    if data.get("risk") is not None:
        pos["risks"] = _lines(data.get("risk"), limit=12)
    ledes = data.get("ledes") if isinstance(data.get("ledes"), dict) else {}
    if ledes:
        merged = dict(report.get("copy_ledes") or {})
        for key in LEDE_KEYS:
            text = _clip(ledes.get(key), 500)
            if text:
                merged[key] = text
        if merged:
            report["copy_ledes"] = merged
    return report
