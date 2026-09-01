"""Fingerprint week windows, subject status, and condition multipliers."""
from __future__ import annotations

import unittest

from core import (
    FINGERPRINT_UC_STATUSES,
    detect_subject_market_status,
    listing_is_subject,
)


class SubjectStatusTests(unittest.TestCase):
    def test_listing_is_subject_by_mls(self):
        self.assertTrue(
            listing_is_subject(
                {"mls": "1058539", "address": "2845 W 13th"},
                {"mls_number": "1058539", "address": "Elsewhere"},
            )
        )

    def test_detect_pending_as_under_contract(self):
        rows = [
            {"mls": "1", "address": "100 Main St", "status": "Active"},
            {"mls": "99", "address": "200 Oak Ave", "status": "Pending"},
        ]
        status = detect_subject_market_status(
            rows, {"mls_number": "99", "address": "200 Oak Ave"}
        )
        self.assertEqual(status, "Pending")
        self.assertIn("Pending", FINGERPRINT_UC_STATUSES)

    def test_detect_sold(self):
        status = detect_subject_market_status(
            [{"mls": "7", "address": "9 Pine", "status": "Sold"}],
            {"mls": "7", "address": "9 Pine"},
        )
        self.assertEqual(status, "Sold")

    def test_unknown_subject(self):
        self.assertEqual(
            detect_subject_market_status(
                [{"mls": "1", "address": "100 Main", "status": "Active"}],
                {"mls_number": "404", "address": "No Match Ln"},
            ),
            "",
        )


class ConditionScaleTests(unittest.TestCase):
    def test_multipliers_cover_zero_through_ten(self):
        rating_mult = {
            0: 0.88, 1: 0.90, 2: 0.92, 3: 0.94, 4: 0.96,
            5: 0.98, 6: 1.00, 7: 1.025, 8: 1.045, 9: 1.07, 10: 1.09,
        }
        self.assertEqual(set(rating_mult), set(range(0, 11)))
        prev = 0
        for i in range(0, 11):
            self.assertGreater(rating_mult[i], prev)
            prev = rating_mult[i]


class PauseOnContractTests(unittest.TestCase):
    def test_pauses_when_subject_goes_pending(self):
        from server import _maybe_pause_on_subject_contract

        class _Dir:
            name = "run-not-sample"

        lock = {"stop_on_under_contract": True, "locked_price": 410000}
        report = {"subject": {"mls_number": "99", "address": "200 Oak Ave"}}
        snap = {
            "listings": [
                {"mls": "99", "address": "200 Oak Ave", "status": "Pending"},
            ]
        }
        out = _maybe_pause_on_subject_contract(_Dir(), report, lock, snap=snap)
        self.assertTrue(out.get("paused_at"))
        self.assertEqual(out.get("paused_reason"), "under_contract")
        self.assertFalse((out.get("email") or {}).get("on"))

    def test_does_not_pause_sample(self):
        from server import SAMPLE_RUN_ID, _maybe_pause_on_subject_contract

        class _Dir:
            name = SAMPLE_RUN_ID

        lock = {"stop_on_under_contract": True}
        out = _maybe_pause_on_subject_contract(
            _Dir(),
            {"subject": {"mls_number": "1", "address": "x"}},
            lock,
            snap={"listings": [{"mls": "1", "address": "x", "status": "Pending"}]},
        )
        self.assertFalse(out.get("paused_at"))


class MarketPulseAsOfTests(unittest.TestCase):
    def _frame(self):
        import pandas as pd

        return pd.DataFrame(
            {
                "MLSNumber": ["1", "2", "3", "4"],
                "Address": ["100 A St", "200 B St", "300 C St", "400 D St"],
                "StatusNorm": ["Active", "Sold", "Sold", "Expired"],
                "ListDate": pd.to_datetime(
                    ["2026-01-01", "2026-01-01", "2026-01-01", "2026-01-01"]
                ),
                "SoldDate": pd.to_datetime([pd.NaT, "2026-01-10", "2026-02-20", pd.NaT]),
                "SoldPrice": [None, 400000, 420000, None],
                "Price": [390000, 400000, 420000, 395000],
                "DOM": [40, 9, 50, 20],
                "LivingArea": [2000, 2000, 2000, 2000],
                "PricePerSqFt": [195.0, 200.0, 210.0, 197.0],
                "YearBuilt": [1990, 1990, 1990, 1990],
                "LastUpdateDate": pd.to_datetime(
                    ["2026-02-01", "2026-01-10", "2026-02-20", "2026-02-01"]
                ),
            }
        )

    def test_later_sale_excluded_from_earlier_week(self):
        from core import compute_market_pulse_as_of

        df = self._frame()
        early = compute_market_pulse_as_of(df, "2026-01-15", latest=False)
        late = compute_market_pulse_as_of(df, "2026-02-28", latest=True)
        self.assertEqual(early["sold_count"], 1)
        self.assertEqual(late["sold_count"], 2)
        self.assertEqual(early["as_of"], "2026-01-15")
        self.assertGreaterEqual(early["active_count"], 2)

    def test_not_yet_expired_counts_as_active(self):
        from core import compute_market_pulse_as_of

        df = self._frame()
        early = compute_market_pulse_as_of(df, "2026-01-15", latest=False)
        late = compute_market_pulse_as_of(df, "2026-02-28", latest=True)
        self.assertGreater(early["active_count"], late["active_count"])
        self.assertGreaterEqual(late.get("expired_withdrawn_count") or 0, 1)

    def test_history_stores_market_pulse(self):
        from core import append_fingerprint_history, attach_market_pulse_history

        hist = append_fingerprint_history(
            [],
            {
                "as_of": "2026-01-08",
                "locked_price": 400000,
                "rank": 2,
                "rank_of": 10,
                "active_count": 9,
            },
            {"listed_week": 1, "uc_week": 0, "sold_week": 0},
            market_pulse={
                "as_of": "2026-01-08",
                "months_of_inventory": 3.2,
                "active_count": 8,
                "odds_of_selling": 0.3,
                "absorption_rate": 2.5,
            },
        )
        self.assertEqual(hist[0]["market"]["months_of_inventory"], 3.2)
        self.assertEqual(hist[0]["market"]["active_count"], 8)

        filled, changed = attach_market_pulse_history(hist, self._frame())
        self.assertFalse(changed)
        self.assertEqual(filled[0]["market"]["months_of_inventory"], 3.2)

        bare = [{"as_of": "2026-01-15", "listed_week": 0}]
        filled, changed = attach_market_pulse_history(bare, self._frame())
        self.assertTrue(changed)
        self.assertIsNotNone(filled[0]["market"].get("active_count"))


if __name__ == "__main__":
    unittest.main()
