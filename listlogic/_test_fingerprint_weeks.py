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


class WeeklyCountsTests(unittest.TestCase):
    """Weekly board counts against a portal pull (prior-sale dates, closes, price moves)."""

    @staticmethod
    def _df(rows):
        import pandas as pd
        from market_schema import normalize_market_frame

        return normalize_market_frame(pd.DataFrame(rows), source="realtor")

    @staticmethod
    def _row(mls, status, price, list_date, sold_date=None, sold_price=None):
        return {
            "MLSNumber": mls, "StName": f"{mls} Main St", "Status": status, "Price": price,
            "ListDate": list_date, "SoldDate": sold_date, "SoldPrice": sold_price,
            "FinishedSQFT": 1500, "City": "Greeley",
        }

    def _week(self, ledger, df, day, baseline=None, since="2026-09-22", price=410000):
        from core import (
            build_pulse_snapshot,
            fingerprint_sold_from_df,
            freeze_fingerprint_baseline,
            merge_fingerprint_ledger,
        )

        snap = build_pulse_snapshot(df, price, 1500, as_of=day)
        baseline = baseline or freeze_fingerprint_baseline(snap)
        sold = fingerprint_sold_from_df(df, set(baseline["ids"]), since=since, living_area=1500)
        ledger = merge_fingerprint_ledger(ledger, snap, baseline=baseline, sold_map=sold, as_of=day)
        return snap, baseline, ledger

    def test_prior_sale_on_active_is_not_a_close(self):
        from core import digest_pulse

        df = self._df([self._row("A1", "Active", 350000, "2026-08-01", "2019-05-01", 250000)])
        self.assertTrue(df["SoldDate"].isna().all())
        snap, base, ledger = self._week(None, df, "2026-09-22")
        lock = {"locked_price": 410000, "locked_at": "2026-09-22"}
        d = digest_pulse(snap, lock, None, baseline=base, ledger=ledger)
        self.assertEqual(d["sold_since"], 0)

    def test_similar_closes_count_by_close_date(self):
        from core import digest_pulse

        week1 = self._df([self._row("A1", "Active", 350000, "2026-08-01")])
        snap1, base, ledger = self._week(None, week1, "2026-09-28")
        week2 = self._df([
            self._row("A1", "Active", 350000, "2026-08-01"),
            self._row("S1", "Sold", 380000, "2026-07-01", "2026-10-01", 375000),
            self._row("S0", "Sold", 380000, "2026-07-01", "2026-09-01", 375000),
        ])
        snap2, _, ledger = self._week(ledger, week2, "2026-10-04", baseline=base)
        lock = {"locked_price": 410000, "locked_at": "2026-09-22"}
        d = digest_pulse(snap2, lock, snap1, baseline=base, ledger=ledger)
        self.assertEqual(d["sold_week"], 1)
        self.assertEqual(d["sold_since"], 1)
        self.assertEqual(ledger["listings"]["S1"]["status_history"][-1]["as_of"], "2026-10-01")
        self.assertEqual(d["sold_median_price_since"], 375000)

    def test_sanitize_drops_weekly_phantom_sales(self):
        from core import sanitize_fingerprint_ledger

        ledger = {"listings": {"A1": {
            "id": "A1", "status": "Sold", "last_status": "Sold", "price": 350000,
            "status_history": [
                {"as_of": "2026-09-22", "status": "Active", "price": 350000},
                {"as_of": "2026-09-22", "status": "Sold", "price": 350000},
                {"as_of": "2026-09-28", "status": "Active", "price": 350000},
                {"as_of": "2026-09-28", "status": "Sold", "price": 350000},
            ],
        }}}
        rec = sanitize_fingerprint_ledger(ledger)["listings"]["A1"]
        self.assertEqual([h["status"] for h in rec["status_history"]], ["Active", "Active"])
        self.assertEqual(rec["last_status"], "Active")

    def test_price_cut_counts_in_its_week(self):
        from core import digest_pulse

        snap1, base, ledger = self._week(None, self._df([self._row("A1", "Active", 360000, "2026-08-01")]), "2026-09-28")
        snap2, _, ledger = self._week(
            ledger, self._df([self._row("A1", "Active", 349000, "2026-08-01")]), "2026-10-04", baseline=base
        )
        lock = {"locked_price": 410000, "locked_at": "2026-09-22"}
        d = digest_pulse(snap2, lock, snap1, baseline=base, ledger=ledger)
        self.assertEqual(d["price_cuts_week"], 1)
        self.assertEqual(d["avg_cut_week"], 11000)

    def test_rank_then_uses_initial_price_not_frozen_rank(self):
        from core import digest_pulse

        df = self._df([self._row(f"A{i}", "Active", 340000 + i * 5000, "2026-08-01") for i in range(6)])
        snap, base, ledger = self._week(None, df, "2026-09-22")
        base["rank"] = 2  # frozen when a lower price was locked
        lock = {"locked_price": 410000, "locked_at": "2026-09-22"}
        d = digest_pulse(snap, lock, None, baseline=base, ledger=ledger)
        self.assertEqual(d["rank_then"], 7)

    def test_seller_price_adjustment_detected(self):
        from core import apply_subject_price, digest_pulse

        df = self._df([
            self._row("A1", "Active", 395000, "2026-08-01"),
            {**self._row("SUBJ", "Active", 399900, "2026-09-25"), "StName": "1704 6th Street"},
        ])
        lock = apply_subject_price(
            {"locked_price": 410000, "locked_at": "2026-09-22"},
            df,
            {"address": "1704 6th Street, Greeley"},
            as_of="2026-10-10",
        )
        self.assertEqual(lock["current_price"], 399900)
        self.assertEqual(lock["price_history"][-1]["from"], 410000)
        d = digest_pulse({"as_of": "2026-10-10", "listings": []}, lock)
        self.assertEqual(d["list_price"], 399900)
        self.assertEqual(d["initial_price"], 410000)


class PriceCallTests(unittest.TestCase):
    def _call(self, list_price, **kw):
        from core import fingerprint_price_call

        args = dict(
            list_price=list_price,
            active_prices=[350000, 360000, 370000, 380000, 390000],
            subject_dom=10,
            days_to_contract=30,
            uc_since=2,
            price_cuts_since=0,
        )
        args.update(kw)
        return fingerprint_price_call(**args)

    def test_cheapest_third_holds(self):
        c = self._call(355000)
        self.assertEqual((c["call"], c["rank"], c["rank_of"], c["target"]), ("hold", 2, 6, 0))

    def test_past_typical_days_in_top_band_adjusts_with_target(self):
        c = self._call(399000, subject_dom=45)
        self.assertEqual(c["call"], "adjust")
        # Cheapest third of 6 is 2 slots: be under the 2nd cheapest competitor.
        self.assertEqual(c["target"], 359000)

    def test_early_in_top_band_watches(self):
        self.assertEqual(self._call(399000)["call"], "watch")

    def test_too_few_actives_makes_no_call(self):
        self.assertEqual(self._call(399000, active_prices=[350000]), {})


class DaysToContractTests(unittest.TestCase):
    def test_median_days_from_list_to_contract(self):
        from core import _window_event_counts

        rows = [
            {"id": "a", "list_date": "2026-09-01", "status_history": [
                {"as_of": "2026-09-01", "status": "Active", "price": 1},
                {"as_of": "2026-09-21", "status": "Pending", "price": 1}]},
            {"id": "b", "list_date": "2026-09-10", "status_history": [
                {"as_of": "2026-09-10", "status": "Active", "price": 1},
                {"as_of": "2026-10-10", "status": "Pending", "price": 1}]},
        ]
        out = _window_event_counts(rows, "2026-09-15", "2026-10-16")
        self.assertEqual(out["uc"], 2)
        self.assertEqual(out["days_to_contract"], 25)


class ReconcileTests(unittest.TestCase):
    def test_identity_and_live_rank_after_recorded_price_change(self):
        from core import digest_pulse, record_subject_price

        baseline = {"ids": ["A", "B", "C"], "listings": [
            {"id": "A", "price": 350000}, {"id": "B", "price": 380000}, {"id": "C", "price": 420000}]}
        ledger = {"listings": {
            "A": {"id": "A", "last_status": "Active", "status_history": [{"as_of": "2026-09-22", "status": "Active", "price": 350000}]},
            "B": {"id": "B", "last_status": "Pending", "status_history": [
                {"as_of": "2026-09-22", "status": "Active", "price": 380000},
                {"as_of": "2026-10-01", "status": "Pending", "price": 380000}]},
            "C": {"id": "C", "last_status": "Active", "gone": True, "status_history": [{"as_of": "2026-09-22", "status": "Active", "price": 420000}]},
            "N": {"id": "N", "last_status": "Active", "list_date": "2026-10-05", "status_history": [{"as_of": "2026-10-10", "status": "Active", "price": 395000}]},
        }}
        snap = {"as_of": "2026-10-16", "rank": 3, "rank_of": 3, "listings": [
            {"id": "A", "status": "Active", "price": 350000},
            {"id": "N", "status": "Active", "price": 395000, "list_date": "2026-10-05"},
        ]}
        lock = {"locked_price": 410000, "locked_at": "2026-09-22"}
        d = digest_pulse(snap, lock, None, baseline=baseline, ledger=ledger)
        r = d["reconcile"]
        self.assertEqual((r["original"], r["still_active"], r["under_contract"], r["gone"], r["new_since"], r["active_now"]), (3, 1, 1, 1, 1, 2))
        self.assertTrue(r["adds_up"])
        self.assertEqual((d["rank"], d["rank_of"]), (3, 3))
        lock = record_subject_price(lock, 380000, as_of="2026-10-12")
        d2 = digest_pulse(snap, lock, None, baseline=baseline, ledger=ledger)
        self.assertEqual((d2["rank"], d2["list_price"], d2["initial_price"]), (2, 380000, 410000))
        self.assertEqual(lock["price_history"][-1]["source"], "agent")

    def test_agent_recorded_price_beats_stale_pull_same_day(self):
        from core import apply_subject_price, record_subject_price
        import pandas as pd

        lock = record_subject_price({"locked_price": 410000}, 400000, as_of="2026-10-16")
        df = pd.DataFrame([{"MLSNumber": "S", "Address": "1704 6th St", "StatusNorm": "Active", "Price": 410000}])
        lock = apply_subject_price(lock, df, {"address": "1704 6th Street, Greeley"}, as_of="2026-10-16")
        self.assertEqual(lock["current_price"], 400000)

    def test_subject_pull_status_and_active_fallback(self):
        from core import detect_subject_active_at, subject_pull_status
        import pandas as pd

        df = pd.DataFrame([
            {"MLSNumber": "S", "Address": "1704 6th St", "StatusNorm": "Active", "Price": 400000, "ListDate": None},
            {"MLSNumber": "X", "Address": "704 6th St", "StatusNorm": "Active", "Price": 300000, "ListDate": "2026-09-01"},
        ])
        subj = {"address": "1704 6th Street, Greeley, Colorado 80631"}
        sp = subject_pull_status(df, subj)
        self.assertEqual((sp["found"], sp["status"], sp["price"], sp["list_date"]), (True, "Active", 400000, ""))
        self.assertEqual(detect_subject_active_at(df, subj), "")
        self.assertEqual(detect_subject_active_at(df, subj, fallback_day="2026-09-28"), "2026-09-28")
        self.assertFalse(subject_pull_status(df, {"address": "9 Nowhere Ln"})["found"])


if __name__ == "__main__":
    unittest.main()


class FingerprintMarketTests(unittest.TestCase):
    """A saved-search report tracks every home the search returns; an export is banded."""

    @staticmethod
    def _df(rows):
        import pandas as pd

        return pd.DataFrame(rows)

    def _rows(self):
        base = {"StatusNorm": "Active", "ListDate": "2026-09-01", "SoldDate": None, "Beds": 3, "Baths": 2}
        return [
            dict(base, MLSNumber="1", Address="100 Main St", Price=350000, LivingArea=1500),
            dict(base, MLSNumber="2", Address="200 Main St", Price=360000, LivingArea=2600),  # outside 80-120%
            dict(base, MLSNumber="3", Address="300 Main St", Price=370000, LivingArea=900),   # outside 80-120%
            dict(base, MLSNumber="S", Address="1704 6th Street", Price=410000, LivingArea=1500),
        ]

    def test_band_is_zero_for_saved_search(self):
        from core import fingerprint_band_sqft

        lock = {"subject_sqft": 1500}
        self.assertEqual(fingerprint_band_sqft(lock, {}, portal_criteria={"location": "Greeley, CO"}), 0.0)
        self.assertEqual(fingerprint_band_sqft(lock, {}, portal_criteria=None), 1500.0)
        self.assertEqual(fingerprint_band_sqft({}, {"living_area": 1800}, portal_criteria={}), 1800.0)

    def test_search_market_keeps_every_size(self):
        from core import build_pulse_snapshot, reconstruct_fingerprint_baseline

        subject = {"address": "1704 6th Street, Greeley, CO"}
        banded = build_pulse_snapshot(self._df(self._rows()), 410000, 1500, as_of="2026-10-16", subject=subject)
        whole = build_pulse_snapshot(self._df(self._rows()), 410000, 0, as_of="2026-10-16", subject=subject)
        self.assertEqual(banded["active_count"], 1)
        self.assertEqual(whole["active_count"], 3)
        base = reconstruct_fingerprint_baseline(self._df(self._rows()), 410000, 0, as_of="2026-09-22", subject=subject)
        self.assertEqual(sorted(base["ids"]), ["1", "2", "3"])
        self.assertEqual(base["version"], __import__("core").FINGERPRINT_BASELINE_VERSION)

    def test_reconstruct_leaves_subject_out(self):
        from core import reconstruct_fingerprint_baseline

        with_subject = reconstruct_fingerprint_baseline(self._df(self._rows()), 410000, 0, as_of="2026-09-22")
        self.assertIn("S", with_subject["ids"])
        without = reconstruct_fingerprint_baseline(
            self._df(self._rows()), 410000, 0, as_of="2026-09-22", subject={"address": "1704 6th Street, Greeley, CO"}
        )
        self.assertNotIn("S", without["ids"])

    def test_criteria_chips_read_like_the_search(self):
        from core import _comp_set

        comp = _comp_set(
            {"subject_sqft": 1500},
            {},
            portal_criteria={"location": "Greeley, CO", "min_beds": 3, "min_baths": 2, "min_sqft": 1200,
                             "max_sqft": 2000, "price_min": 300000, "price_max": 450000, "lookback_days": 180},
        )
        self.assertEqual(comp["defined_by"], "search")
        self.assertEqual(
            comp["chips"],
            ["Greeley, CO", "3+ bed", "2+ bath", "1,200–2,000 sf", "$300,000–$450,000", "last 180 days"],
        )
        banded = _comp_set({"subject_sqft": 1500, "beds": 3}, {"living_area": 1500}, portal_criteria=None, city="Greeley")
        self.assertEqual(banded["defined_by"], "band")


class CarryOverTests(unittest.TestCase):
    """Migrating an older report keeps the homes and history the saved pull can no longer show."""

    def test_baseline_keeps_homes_that_left_the_pull(self):
        from core import carry_baseline_listings

        rebuilt = {"listings": [{"id": "A", "status": "Active", "price": 350000}], "ids": ["A"]}
        existing = {"listings": [{"id": "A", "status": "Active", "price": 350000},
                                 {"id": "GONE", "status": "Active", "price": 300000}]}
        out = carry_baseline_listings(rebuilt, existing, 410000)
        self.assertEqual(sorted(out["ids"]), ["A", "GONE"])
        self.assertEqual(out["active_count"], 2)
        self.assertEqual(out["rank"], 3)

    def test_ledger_prefers_what_was_observed(self):
        from core import carry_ledger_records

        old = {"listings": {
            "P5": {"id": "P5", "first_seen": "2026-09-22", "last_seen": "2026-10-10", "last_status": "Pending",
                   "status_history": [{"as_of": "2026-09-22", "status": "Active", "price": 1},
                                      {"as_of": "2026-10-10", "status": "Pending", "price": 1}]},
            "GONE": {"id": "GONE", "first_seen": "2026-09-22", "last_seen": "2026-10-04", "gone": True,
                     "last_status": "Active", "status_history": []},
        }}
        new = {"listings": {
            "P5": {"id": "P5", "first_seen": "2026-09-22", "last_seen": "2026-10-16", "last_status": "Pending", "gone": False,
                   "status_history": [{"as_of": "2026-09-22", "status": "Pending", "price": 1},
                                      {"as_of": "2026-10-16", "status": "Pending", "price": 1}]},
            "B1": {"id": "B1", "first_seen": "2026-09-22", "last_seen": "2026-10-16", "status_history": []},
        }, "updated": "2026-10-16"}
        out = carry_ledger_records(new, old)["listings"]
        self.assertEqual([h["as_of"] for h in out["P5"]["status_history"]], ["2026-09-22", "2026-10-10", "2026-10-16"])
        self.assertEqual(out["P5"]["status_history"][0]["status"], "Active")
        self.assertTrue(out["GONE"]["gone"])
        self.assertIn("B1", out)

    def test_list_price_as_of_follows_recorded_changes(self):
        from core import list_price_as_of

        lock = {"locked_price": 410000, "price_history": [{"as_of": "2026-10-10", "from": 410000, "to": 399900}]}
        self.assertEqual(list_price_as_of(lock, "2026-10-04"), 410000)
        self.assertEqual(list_price_as_of(lock, "2026-10-10"), 399900)
        self.assertEqual(list_price_as_of(lock, "2026-10-16"), 399900)
