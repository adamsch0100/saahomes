#!/usr/bin/env python3
"""Weekly model-routing intelligence for Hermes.

Lives inside each Hermes agent (not a fourth service). Pulls:
  - OpenCode Go catalog (subscription-first)
  - OpenRouter rankings (most used) + catalog pricing
  - OpenRouter Artificial Analysis coding benchmarks (when keyed)

Then picks the most capable *affordable* Go model for volume/mid.
Hard slot stays locked to xai-oauth / grok-build-0.1 (SuperGrok CLI limits).

Writes /opt/data/model-routing-lock.json so bootstrap can re-apply after restarts
without flipping models every deploy.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

HERMES_HOME = Path(os.environ.get("HERMES_HOME", "/opt/data"))
LOCK_PATH = HERMES_HOME / "model-routing-lock.json"
GO_MODELS_URL = "https://opencode.ai/zen/go/v1/models"
OR_MODELS_URL = "https://openrouter.ai/api/v1/models"
OR_RANKINGS_URL = "https://openrouter.ai/api/v1/datasets/rankings-daily"
OR_BENCH_URL = "https://openrouter.ai/api/v1/benchmarks"

HARD_LOCK = {"provider": "xai-oauth", "model": "grok-build-0.1", "locked": True}

# OpenCode Go request economics (from opencode.ai/docs/go). Volume = high
# monthly request budget. Never auto-promote grok-4.5 / kimi-k3 onto chat.
VOLUME_IDS = {
    "deepseek-v4-flash",
    "mimo-v2.5",
    "hy3",
    "minimax-m2.7",
    "minimax-m2.5",
    "qwen3.7-plus",
    "qwen3.6-plus",
    "gpt-5.6-luna",
    "kimi-k2.7-code",
    "kimi-k2.6",
}
MID_IDS = {
    "deepseek-v4-pro",
    "glm-5.2",
    "glm-5.1",
    "mimo-v2.5-pro",
    "minimax-m3",
    "qwen3.7-max",
    "kimi-k2.7-code",
}
NEVER_VOLUME = {
    "grok-4.5",
    "kimi-k3",
    "glm-5.3",
    "qwen3.8-max",
    "muse-spark-1.2-contributor",  # trains on prompts
}

GO_TO_OPENROUTER = {
    "deepseek-v4-flash": "deepseek/deepseek-v4-flash",
    "deepseek-v4-pro": "deepseek/deepseek-v4-pro",
    "kimi-k3": "moonshotai/kimi-k3",
    "kimi-k2.7-code": "moonshotai/kimi-k2.7-code",
    "kimi-k2.6": "moonshotai/kimi-k2.6",
    "glm-5.3": "z-ai/glm-5.3",
    "glm-5.2": "z-ai/glm-5.2",
    "glm-5.1": "z-ai/glm-5.1",
    "mimo-v2.5": "xiaomi/mimo-v2.5",
    "mimo-v2.5-pro": "xiaomi/mimo-v2.5-pro",
    "hy3": "tencent/hy3",
    "gpt-5.6-luna": "openai/gpt-5.6-luna",
    "grok-4.5": "x-ai/grok-4.5",
    "minimax-m3": "minimax/minimax-m3",
    "minimax-m2.7": "minimax/minimax-m2.7",
    "qwen3.7-plus": "qwen/qwen3.7-plus",
    "qwen3.7-max": "qwen/qwen3.7-max",
    "qwen3.8-max": "qwen/qwen3.8-max",
}

HYSTERESIS = 1.25
USER_AGENT = "Hermes-model-routing-pulse/1.0"


def http_json(url: str, api_key: str | None = None, timeout: int = 45) -> Any:
    headers = {"User-Agent": USER_AGENT, "Accept": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def family(slug: str) -> str:
    name = slug.lower().split("/")[-1]
    name = name.split(":")[0]
    name = re.sub(r"-(0731|0423|0813|latest|preview)$", "", name)
    name = re.sub(r"-\d{4}-\d{2}-\d{2}$", "", name)
    return name


def load_lock() -> dict[str, Any]:
    if not LOCK_PATH.exists():
        return {
            "volume": {"provider": "opencode-go", "model": "deepseek-v4-flash"},
            "mid": {"provider": "opencode-go", "model": "deepseek-v4-pro"},
            "fallback": {"provider": "openrouter", "model": "deepseek/deepseek-v4-flash"},
            "hard": HARD_LOCK,
        }
    return json.loads(LOCK_PATH.read_text(encoding="utf-8"))


def go_catalog() -> set[str]:
    payload = http_json(GO_MODELS_URL)
    return {item["id"] for item in payload.get("data", []) if item.get("id")}


def or_pricing(api_key: str | None) -> dict[str, float]:
    try:
        payload = http_json(OR_MODELS_URL, api_key)
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, json.JSONDecodeError):
        return {}
    prices: dict[str, float] = {}
    for item in payload.get("data", []):
        slug = item.get("id") or ""
        prompt = (item.get("pricing") or {}).get("prompt")
        try:
            prices[family(slug)] = float(prompt) if prompt is not None else 99.0
        except (TypeError, ValueError):
            continue
    return prices


def or_rankings(api_key: str | None, days: int = 7) -> dict[str, float]:
    if not api_key:
        return {}
    end = datetime.now(timezone.utc).date() - timedelta(days=1)
    start = end - timedelta(days=days - 1)
    url = f"{OR_RANKINGS_URL}?start_date={start.isoformat()}&end_date={end.isoformat()}"
    try:
        payload = http_json(url, api_key)
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, json.JSONDecodeError):
        return {}
    totals: dict[str, float] = {}
    for row in payload.get("data", []):
        slug = row.get("model_permaslug") or ""
        if slug in {"", "other"}:
            continue
        try:
            totals[family(slug)] = totals.get(family(slug), 0.0) + float(row.get("total_tokens") or 0)
        except (TypeError, ValueError):
            continue
    return totals


def or_coding_scores(api_key: str | None) -> dict[str, float]:
    if not api_key:
        return {}
    url = f"{OR_BENCH_URL}?source=artificial-analysis&task_type=coding&max_results=40"
    try:
        payload = http_json(url, api_key)
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, json.JSONDecodeError):
        return {}
    scores: dict[str, float] = {}
    items = payload.get("data") or payload.get("items") or []
    if isinstance(payload, list):
        items = payload
    for item in items:
        if not isinstance(item, dict):
            continue
        slug = item.get("model") or item.get("model_id") or item.get("id") or ""
        score = item.get("primary_score") or item.get("score") or item.get("intelligence")
        if not slug or score is None:
            continue
        try:
            scores[family(str(slug))] = float(score)
        except (TypeError, ValueError):
            continue
    return scores


def score_model(
    go_id: str,
    rankings: dict[str, float],
    coding: dict[str, float],
    prices: dict[str, float],
) -> float:
    fam = family(go_id)
    token_share = rankings.get(fam, 0.0)
    # log-ish without math.log for tiny values
    token_pts = 0.0 if token_share <= 0 else min(50.0, (token_share ** 0.5) / 1_000_000)
    code_pts = coding.get(fam, 40.0)  # missing AA → neutral, don't punish Go-only models
    price = prices.get(fam, 0.5)
    cheap_pts = 20.0 / (1.0 + max(price, 0.0) * 1000.0)
    return token_pts + code_pts * 0.45 + cheap_pts


def pick(
    pool: set[str],
    go_ids: set[str],
    rankings: dict[str, float],
    coding: dict[str, float],
    prices: dict[str, float],
    current: str,
) -> tuple[str, float, dict[str, float]]:
    eligible = (pool & go_ids) - NEVER_VOLUME
    if current in go_ids and current not in NEVER_VOLUME:
        eligible.add(current)
    if not eligible:
        return current, 0.0, {}
    scored = {
        mid: score_model(mid, rankings, coding, prices) for mid in eligible
    }
    winner = max(scored, key=lambda k: scored[k])
    current_score = scored.get(current, 0.0)
    if current in scored and scored[winner] < current_score * HYSTERESIS:
        return current, current_score, scored
    return winner, scored[winner], scored


def openrouter_slug(go_id: str) -> str:
    return GO_TO_OPENROUTER.get(go_id, f"deepseek/{go_id}" if go_id.startswith("deepseek") else go_id)


def patch_config_fallback(or_slug: str) -> None:
    config_path = HERMES_HOME / "config.yaml"
    if not config_path.exists():
        return
    text = config_path.read_text(encoding="utf-8")
    updated, count = re.subn(
        r"(fallback_providers:\n\s+-\s+provider:\s+openrouter\n\s+model:\s+)\S+",
        rf"\1{or_slug}",
        text,
        count=1,
    )
    if count:
        config_path.write_text(updated, encoding="utf-8")


def hermes_set(key: str, value: str) -> None:
    subprocess.run(
        ["hermes", "config", "set", key, value],
        check=False,
        capture_output=True,
        text=True,
    )


def apply_lock(lock: dict[str, Any]) -> None:
    LOCK_PATH.parent.mkdir(parents=True, exist_ok=True)
    LOCK_PATH.write_text(json.dumps(lock, indent=2) + "\n", encoding="utf-8")
    volume = (lock.get("volume") or {}).get("model")
    mid = (lock.get("mid") or {}).get("model")
    fallback = (lock.get("fallback") or {}).get("model")
    if volume:
        hermes_set("model.provider", "opencode-go")
        hermes_set("model.default", volume)
        hermes_set("auxiliary.compression.model", volume)
        hermes_set("auxiliary.web_extract.model", volume)
    if mid:
        hermes_set("delegation.model", mid)
    if fallback:
        patch_config_fallback(fallback)


def brief(lock: dict[str, Any], notes: list[str], rankings_ok: bool, go_n: int) -> str:
    volume = lock["volume"]["model"]
    mid = lock["mid"]["model"]
    fallback = lock["fallback"]["model"]
    hard = lock["hard"]["model"]
    action = lock.get("action", "HOLD")
    lines = [
        f"Model routing pulse - {datetime.now(timezone.utc).strftime('%Y-%m-%d')}",
        f"Action: {action}",
        f"Volume (Go): {volume}",
        f"Mid / delegation (Go): {mid}",
        f"Fallback (OpenRouter): {fallback}",
        f"Hard (locked SuperGrok): {hard}",
        f"Go catalog: {go_n} models | OpenRouter rankings: {'yes' if rankings_ok else 'no key/fail'}",
    ]
    if notes:
        lines.append("Why:")
        lines.extend(f"- {n}" for n in notes[:6])
    lines.append("Cache: volume stays sticky unless challenger scores >= 1.25x current.")
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true", help="Write lock + hermes config set")
    parser.add_argument("--apply-lock-only", action="store_true", help="Re-apply existing lock after seed copy")
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()

    current = load_lock()
    if args.apply_lock_only:
        apply_lock(current)
        print(f"Re-applied lock: volume={current.get('volume', {}).get('model')}")
        return 0

    api_key = os.environ.get("OPENROUTER_API_KEY") or None
    notes: list[str] = []
    try:
        go_ids = go_catalog()
    except Exception as exc:  # noqa: BLE001 — pulse must still report
        print(f"Go catalog fetch failed: {exc}", file=sys.stderr)
        go_ids = {current["volume"]["model"], current["mid"]["model"]}
        notes.append(f"Go catalog fetch failed ({exc}); held previous lock.")

    rankings = or_rankings(api_key)
    coding = or_coding_scores(api_key)
    prices = or_pricing(api_key)
    if not api_key:
        notes.append("OPENROUTER_API_KEY missing - ranked by Go catalog + hysteresis only.")
    elif not rankings:
        notes.append("OpenRouter rankings unavailable - held unless coding/price says otherwise.")

    vol_now = current["volume"]["model"]
    mid_now = current["mid"]["model"]
    vol_new, vol_score, vol_scored = pick(VOLUME_IDS, go_ids, rankings, coding, prices, vol_now)
    mid_new, mid_score, _ = pick(MID_IDS, go_ids, rankings, coding, prices, mid_now)

    changed = vol_new != vol_now or mid_new != mid_now
    lock = {
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "action": "APPLY" if changed else "HOLD",
        "volume": {"provider": "opencode-go", "model": vol_new, "score": round(vol_score, 2)},
        "mid": {"provider": "opencode-go", "model": mid_new, "score": round(mid_score, 2)},
        "fallback": {
            "provider": "openrouter",
            "model": openrouter_slug(vol_new),
        },
        "hard": HARD_LOCK,
        "runners_up_volume": sorted(vol_scored, key=vol_scored.get, reverse=True)[:5],
        "notes": notes,
    }
    if vol_new != vol_now:
        notes.insert(0, f"Volume {vol_now} -> {vol_new} (score {vol_score:.1f}, hysteresis {HYSTERESIS}x).")
    if mid_new != mid_now:
        notes.insert(0, f"Mid {mid_now} -> {mid_new} (score {mid_score:.1f}).")
    if not changed:
        notes.insert(0, f"Held {vol_now} / {mid_now} - no challenger cleared hysteresis.")
    lock["notes"] = notes

    if args.apply:
        apply_lock(lock)

    if args.json:
        print(json.dumps(lock, indent=2))
    else:
        print(brief(lock, notes, bool(rankings), len(go_ids)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
