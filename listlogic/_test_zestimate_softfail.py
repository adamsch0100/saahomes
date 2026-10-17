"""Zestimate soft-fail must not re-hit a dead upstream for the same address.

Covers incident inc-4c3d34e0: zillow/search returned HTTP 521 and every
presentation rebuild re-ran the lookup and re-logged the soft-fail.
"""
from __future__ import annotations

import logging
import sys
import tempfile
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import portal_market as pm  # noqa: E402

ADDR = "1843 24th Ave Ct"
GOOD_ITEM = {
    "address_line": ADDR,
    "zestimate_usd": 450000,
    "zpid": "12345",
    "url": "https://www.zillow.com/homedetails/12345",
}


def _use_temp_cache() -> Path:
    tmp = Path(tempfile.mkdtemp(prefix="ll-zestimate-"))
    pm._ZESTIMATE_CACHE_DIR = tmp / "zestimate_cache"
    return tmp


def test_failure_is_cached_and_not_retried() -> None:
    _use_temp_cache()
    calls: list[tuple] = []

    def boom(engine, action, params=None, timeout=60):
        calls.append((engine, action))
        raise pm.ReefApiError(
            "Market search failed (zillow/search, HTTP 521). Try again shortly or use Upload.",
            code="UPSTREAM_UNAVAILABLE",
            status=521,
        )

    prev_key, prev_call = pm._api_key, pm.reef_call
    pm._api_key = lambda: "test-key"
    pm.reef_call = boom
    try:
        assert pm.lookup_zestimate(ADDR) is None
        assert len(calls) == 1, calls
        assert pm._zestimate_failure_fresh(ADDR)
        assert pm._zestimate_failure_path(ADDR).exists()

        # Second lookup inside the TTL must not touch Reef again.
        assert pm.lookup_zestimate(ADDR) is None
        assert len(calls) == 1, calls
    finally:
        pm._api_key, pm.reef_call = prev_key, prev_call


def test_expired_failure_is_retried_and_success_clears_it() -> None:
    _use_temp_cache()
    calls: list[tuple] = []

    def boom(engine, action, params=None, timeout=60):
        calls.append((engine, action))
        raise pm.ReefApiError("HTTP 521", code="UPSTREAM_UNAVAILABLE", status=521)

    prev_key, prev_call = pm._api_key, pm.reef_call
    pm._api_key = lambda: "test-key"
    pm.reef_call = boom
    try:
        assert pm.lookup_zestimate(ADDR) is None
        assert pm._zestimate_failure_fresh(ADDR)

        # Age the failure marker past the TTL.
        path = pm._zestimate_failure_path(ADDR)
        path.write_text(
            '{"failed_at": %f, "reason": "HTTP 521"}'
            % (time.time() - pm.ZESTIMATE_FAILURE_TTL_SEC - 1),
            encoding="utf-8",
        )
        assert not pm._zestimate_failure_fresh(ADDR)

        def ok(engine, action, params=None, timeout=60):
            calls.append((engine, action))
            return {"data": {"results": [dict(GOOD_ITEM)]}}

        pm.reef_call = ok
        result = pm.lookup_zestimate(ADDR)
        assert result and result.get("amount") == 450000, result
        assert len(calls) == 2, calls
        assert not pm._zestimate_failure_path(ADDR).exists()
    finally:
        pm._api_key, pm.reef_call = prev_key, prev_call


def main() -> None:
    logging.basicConfig(level=logging.WARNING)
    test_failure_is_cached_and_not_retried()
    test_expired_failure_is_retried_and_success_clears_it()
    print("zestimate soft-fail tests OK")


if __name__ == "__main__":
    main()
