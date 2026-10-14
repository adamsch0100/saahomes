"""Tell the OttoBot board a ListLogic sign-up or lead arrived.

The board counts these into its signups_week / leads_week numbers. Fire-and-forget:
runs on a daemon thread with a 5s timeout and never blocks or fails the request.
Sends only ``kind`` and a short form name -- no name, email, phone or message.

OTTOBOT_INTAKE_URL overrides the endpoint; set it to "off" to disable. Skipped
under tests (pytest, or LISTLOGIC_ENV / APP_ENV set to "test").
"""

from __future__ import annotations

import json
import logging
import os
import sys
import threading
import urllib.request

logger = logging.getLogger("listlogic.board_intake")

DEFAULT_INTAKE_URL = "https://ottobot-production.up.railway.app/api/intake/listlogic"
TIMEOUT_SEC = 5


def _under_test() -> bool:
    if os.environ.get("PYTEST_CURRENT_TEST") or "pytest" in sys.modules:
        return True
    env = (os.environ.get("LISTLOGIC_ENV") or os.environ.get("APP_ENV") or "").strip().lower()
    return env == "test"


def _post(url: str, kind: str, form: str) -> None:
    body = json.dumps({"kind": kind, "form": form}).encode("utf-8")
    req = urllib.request.Request(
        url, data=body, method="POST", headers={"Content-Type": "application/json"}
    )
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT_SEC) as resp:
            if resp.status >= 400:
                logger.warning("board %s count not recorded (status %s, form %s)", kind, resp.status, form)
    except Exception as exc:  # never let the board break a sign-up
        logger.warning("board %s count not sent (form %s): %s", kind, form, exc)


def report_to_board(kind: str, form: str) -> None:
    """Count one genuine new submission on the board. ``kind`` is "lead" or "signup"."""
    if kind not in ("lead", "signup"):
        return
    url = str(os.environ.get("OTTOBOT_INTAKE_URL") or DEFAULT_INTAKE_URL).strip()
    if not url or url.lower() == "off" or _under_test():
        return
    form = str(form or "site form")[:80]
    threading.Thread(
        target=_post, args=(url, kind, form), name="listlogic-board-intake", daemon=True
    ).start()
