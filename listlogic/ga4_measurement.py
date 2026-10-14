"""Send server-side GA4 events for the ListLogic funnel steps GA4 misses.

The browser tag is best-effort. An ad blocker, a slow tag, or the auth-gated app
can leave a funnel step with no GA4 receipt. This fires the same chain event
names from the server through GA4's Measurement Protocol, so
address -> Generate -> sign_up -> begin_checkout still records a receipt when the
browser leg is missing. It mirrors ``backend/src/services/ga4MeasurementService.js``
on the SAA backend and the fire-and-forget shape of ``listlogic/board_intake.py``.

Fire-and-forget: a daemon thread with a 5s timeout, never blocking or failing the
request. Sends only counts and public plan/source labels -- no name, email, phone
or street address. No-ops when ``GA4_API_SECRET`` is unset; skipped under tests.

Env:
  GA4_API_SECRET / GA4_MEASUREMENT_API_SECRET   GA4 Admin -> Data streams -> Measurement Protocol
  GA4_MEASUREMENT_ID                            defaults to the live stream G-WHGZQDZ6ZG
"""

from __future__ import annotations

import json
import logging
import os
import sys
import threading
import time
import urllib.parse
import urllib.request

logger = logging.getLogger("listlogic.ga4")

DEFAULT_MEASUREMENT_ID = "G-WHGZQDZ6ZG"
ENDPOINT = "https://www.google-analytics.com/mp/collect"
TIMEOUT_SEC = 5


def _under_test() -> bool:
    if os.environ.get("PYTEST_CURRENT_TEST") or "pytest" in sys.modules:
        return True
    env = (os.environ.get("LISTLOGIC_ENV") or os.environ.get("APP_ENV") or "").strip().lower()
    return env == "test"


def _api_secret() -> str:
    return (
        os.environ.get("GA4_API_SECRET")
        or os.environ.get("GA4_MEASUREMENT_API_SECRET")
        or ""
    ).strip()


def _measurement_id() -> str:
    return (os.environ.get("GA4_MEASUREMENT_ID") or DEFAULT_MEASUREMENT_ID).strip()


def _client_id() -> str:
    # GA4 needs a client_id; a server-generated one is fine when the browser id
    # is not available (the count is what the funnel readout needs).
    return f"{int(time.time() * 1e6) % 10_000_000_000}.{int(time.time())}"


def _post(url: str, body: bytes) -> None:
    req = urllib.request.Request(
        url, data=body, method="POST", headers={"Content-Type": "application/json"}
    )
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT_SEC) as resp:
            if resp.status >= 400:
                logger.warning("GA4 %s not recorded (status %s)", url.split("?")[0], resp.status)
    except Exception as exc:  # never let GA4 break a request
        logger.warning("GA4 event not sent: %s", exc)


def send_event(event_name: str, params: dict | None = None, client_id: str | None = None) -> None:
    """Fire one GA4 Measurement Protocol event. ``event_name`` matches the
    browser ``llTrack`` name, so the board's funnel readout sees the step even
    when the browser leg never arrives. The ``leg=server`` param marks the
    origin; the browser and server legs may both land if both fire."""
    if not event_name:
        return
    secret = _api_secret()
    if not secret or _under_test():
        return
    clean = {k: v for k, v in (params or {}).items() if v is not None}
    clean.setdefault("leg", "server")
    clean.setdefault("engagement_time_msec", 100)
    body = {
        "client_id": client_id or _client_id(),
        "events": [{"name": str(event_name), "params": clean}],
    }
    url = ENDPOINT + "?" + urllib.parse.urlencode(
        {"measurement_id": _measurement_id(), "api_secret": secret}
    )
    threading.Thread(
        target=_post,
        args=(url, json.dumps(body).encode("utf-8")),
        name="listlogic-ga4",
        daemon=True,
    ).start()
