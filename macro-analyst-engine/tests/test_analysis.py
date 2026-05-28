import unittest
import sys
import types
from pathlib import Path
from datetime import datetime, timedelta, timezone

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

# Keep unit tests independent from a local PostgreSQL client installation.
if "psycopg2" not in sys.modules:
    fake_psycopg2 = types.ModuleType("psycopg2")
    fake_psycopg2_extras = types.ModuleType("psycopg2.extras")

    class RealDictCursor:  # pragma: no cover - import shim only
        pass

    def Json(value):  # pragma: no cover - import shim only
        return value

    fake_psycopg2_extras.RealDictCursor = RealDictCursor
    fake_psycopg2_extras.Json = Json
    fake_psycopg2.extras = fake_psycopg2_extras
    sys.modules["psycopg2"] = fake_psycopg2
    sys.modules["psycopg2.extras"] = fake_psycopg2_extras

from src.analysis import (
    build_policy_context,
    build_analysis_payload,
    build_analogue_metrics,
    compute_confidence_score,
    compute_indicator_btc_lag_stats,
    compute_oil_btc_lag_stats,
    compute_window_return,
)


class FakeDb:
    def __init__(self):
        self.asset_values: dict[tuple[str, datetime.date], float] = {}
        self.indicator_values: dict[tuple[str, datetime.date], float] = {}
        self.daily_rows: list[dict] = []
        self.indicator_daily_rows: dict[str, list[dict]] = {}

    def get_asset_price_before(self, asset_symbol, when):
        return self.asset_values.get((asset_symbol, when.date()))

    def get_indicator_value_before(self, indicator_name, when):
        return self.indicator_values.get((indicator_name, when.date()))

    def fetch_oil_btc_daily(self, lookback_days):
        return self.daily_rows

    def fetch_indicator_btc_daily(self, indicator_name, lookback_days):
        return self.indicator_daily_rows.get(indicator_name, [])


class AnalysisTests(unittest.TestCase):
    def setUp(self):
        self.base_time = datetime(2026, 1, 10, tzinfo=timezone.utc)

    def test_compute_window_return(self):
        db = FakeDb()
        db.asset_values[("bitcoin", self.base_time.date())] = 100.0
        db.asset_values[("bitcoin", (self.base_time + timedelta(days=7)).date())] = 120.0

        result = compute_window_return(db, self.base_time, 7, "bitcoin")
        self.assertAlmostEqual(result, 20.0, places=6)

    def test_build_analogue_metrics(self):
        db = FakeDb()
        t1 = datetime(2026, 1, 1, tzinfo=timezone.utc)
        t2 = datetime(2026, 1, 5, tzinfo=timezone.utc)

        # Event 1 values
        db.asset_values[("bitcoin", t1.date())] = 100.0
        db.asset_values[("bitcoin", (t1 + timedelta(days=1)).date())] = 110.0
        db.asset_values[("bitcoin", (t1 + timedelta(days=7)).date())] = 120.0
        db.asset_values[("ethereum", t1.date())] = 50.0
        db.asset_values[("ethereum", (t1 + timedelta(days=7)).date())] = 55.0
        db.indicator_values[("brent_crude_oil_price", t1.date())] = 70.0
        db.indicator_values[("brent_crude_oil_price", (t1 + timedelta(days=7)).date())] = 77.0

        # Event 2 values
        db.asset_values[("bitcoin", t2.date())] = 200.0
        db.asset_values[("bitcoin", (t2 + timedelta(days=1)).date())] = 180.0
        db.asset_values[("bitcoin", (t2 + timedelta(days=7)).date())] = 220.0
        db.asset_values[("ethereum", t2.date())] = 40.0
        db.asset_values[("ethereum", (t2 + timedelta(days=7)).date())] = 36.0
        db.indicator_values[("brent_crude_oil_price", t2.date())] = 80.0
        db.indicator_values[("brent_crude_oil_price", (t2 + timedelta(days=7)).date())] = 72.0

        analogues = [
            {"id": "a1", "event_time": t1.isoformat()},
            {"id": "a2", "event_time": t2},
        ]

        metrics = build_analogue_metrics(db, analogues)

        self.assertAlmostEqual(metrics["btc_return_1d_mean"], 0.0, places=6)
        self.assertAlmostEqual(metrics["btc_return_7d_mean"], 15.0, places=6)
        self.assertAlmostEqual(metrics["eth_return_7d_mean"], 0.0, places=6)
        self.assertAlmostEqual(metrics["oil_return_7d_mean"], 0.0, places=6)
        self.assertEqual(metrics["sample_sizes"]["btc_1d"], 2)
        self.assertEqual(metrics["sample_sizes"]["btc_7d"], 2)

    def test_compute_oil_btc_lag_stats_detects_lag(self):
        db = FakeDb()
        base_day = datetime(2025, 1, 1, tzinfo=timezone.utc)

        oil_returns = [(((i * 37) % 17) - 8) / 5 for i in range(45)]
        btc_returns = [0.0, 0.0] + oil_returns[:-2]

        oil_prices = [100.0]
        btc_prices = [30000.0]

        for idx in range(len(oil_returns)):
            oil_prices.append(oil_prices[-1] * (1 + oil_returns[idx] / 100))
            btc_prices.append(btc_prices[-1] * (1 + btc_returns[idx] / 100))

        rows = []
        for idx in range(len(oil_prices)):
            rows.append(
                {
                    "day": base_day + timedelta(days=idx),
                    "oil": oil_prices[idx],
                    "btc": btc_prices[idx],
                }
            )

        db.daily_rows = rows
        stats = compute_oil_btc_lag_stats(db, 180)

        self.assertEqual(stats["best_lag_days"], 2)
        self.assertIsInstance(stats["best_corr"], float)
        self.assertGreater(abs(stats["best_corr"]), 0.9)
        self.assertEqual(stats["sample_size"], len(rows) - 1)

    def test_compute_indicator_btc_lag_stats_detects_lag(self):
        db = FakeDb()
        base_day = datetime(2025, 6, 1, tzinfo=timezone.utc)

        indicator_returns = [(((i * 23) % 19) - 9) / 4 for i in range(48)]
        btc_returns = [0.0, 0.0, 0.0] + indicator_returns[:-3]

        indicator_values = [10.0]
        btc_values = [25000.0]

        for idx in range(len(indicator_returns)):
            indicator_values.append(indicator_values[-1] * (1 + indicator_returns[idx] / 100))
            btc_values.append(btc_values[-1] * (1 + btc_returns[idx] / 100))

        rows = []
        for idx in range(len(indicator_values)):
            rows.append(
                {
                    "day": base_day + timedelta(days=idx),
                    "indicator": indicator_values[idx],
                    "btc": btc_values[idx],
                }
            )

        db.indicator_daily_rows["FRED_FEDFUNDS"] = rows
        stats = compute_indicator_btc_lag_stats(
            db, indicator_name="FRED_FEDFUNDS", lookback_days=365, max_lag_days=10
        )

        self.assertEqual(stats["indicator_name"], "FRED_FEDFUNDS")
        self.assertEqual(stats["best_lag_days"], 3)
        self.assertIsInstance(stats["best_corr"], float)
        self.assertGreater(abs(stats["best_corr"]), 0.9)
        self.assertEqual(stats["sample_size"], len(rows) - 1)

    def test_build_policy_context_returns_score(self):
        db = FakeDb()
        ref = self.base_time

        series_values = {
            "FRED_FEDFUNDS": (5.5, 5.0, 4.5),
            "FRED_DGS10": (4.4, 4.1, 3.8),
            "FRED_CPIAUCSL": (320.0, 315.0, 300.0),
            "FRED_M2SL": (20800.0, 20900.0, 21400.0),
            "FRED_RRPONTSYD": (450.0, 500.0, 700.0),
            "FRED_DTWEXBGS": (127.0, 124.0, 121.0),
            "brent_crude_oil_price": (92.0, 88.0, 80.0),
        }

        for name, (current, d30, d90) in series_values.items():
            db.indicator_values[(name, ref.date())] = current
            db.indicator_values[(name, (ref - timedelta(days=30)).date())] = d30
            db.indicator_values[(name, (ref - timedelta(days=90)).date())] = d90

        context = build_policy_context(db, ref)

        self.assertEqual(context["policy_regime_bias"], "restrictive_bias")
        self.assertGreater(context["policy_pressure_score"], 0.25)
        self.assertIn("fed_funds", context["indicators"])
        self.assertAlmostEqual(
            context["indicators"]["fed_funds"]["delta_90d"], 1.0, places=6
        )
        self.assertTrue(context["reference_time"].endswith("+00:00"))

    def test_compute_confidence_score_bounds(self):
        low = compute_confidence_score(
            analogue_count=0, lag_stats={"best_corr": None}, metrics={}
        )
        self.assertAlmostEqual(low, 0.2, places=6)

        high = compute_confidence_score(
            analogue_count=20,
            lag_stats={"best_corr": 0.9},
            metrics={"btc_return_7d_mean": 3.2, "sample_sizes": {"btc_7d": 12}},
        )
        self.assertAlmostEqual(high, 0.95, places=6)

    def test_build_analysis_payload_shape(self):
        event = {"id": "event-1"}
        analogues = [{"id": "hist-1"}, {"id": "hist-2"}]
        metrics = {"btc_return_7d_mean": 1.25}
        lag_stats = {"best_lag_days": 3, "best_corr": 0.42, "sample_size": 50}
        policy_context = {"policy_pressure_score": 0.4}
        policy_lags = {"fed_funds_btc": {"best_lag_days": 5, "best_corr": 0.2}}

        payload = build_analysis_payload(
            event=event,
            analogues=analogues,
            metrics=metrics,
            lag_stats=lag_stats,
            confidence_score=0.67,
            policy_context=policy_context,
            policy_lags=policy_lags,
        )

        self.assertEqual(payload["event_id"], "event-1")
        self.assertEqual(payload["analogue_count"], 2)
        self.assertEqual(payload["analogue_ids"], ["hist-1", "hist-2"])
        self.assertEqual(payload["metrics"], metrics)
        self.assertEqual(payload["oil_btc_lag"], lag_stats)
        self.assertEqual(payload["confidence_score"], 0.67)
        self.assertEqual(payload["policy_context"], policy_context)
        self.assertEqual(payload["policy_lags"], policy_lags)
        self.assertTrue(len(payload["assumptions"]) >= 1)


if __name__ == "__main__":
    unittest.main()

