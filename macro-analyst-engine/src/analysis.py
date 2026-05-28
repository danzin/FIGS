from datetime import datetime, timedelta, timezone
from typing import Any

import numpy as np

from src.db import DatabaseClient


def _to_utc_datetime(value: str | datetime) -> datetime:
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def _pct_change(current: float | None, previous: float | None) -> float | None:
    if current is None or previous is None or previous == 0:
        return None
    return ((current - previous) / abs(previous)) * 100


def _delta(current: float | None, previous: float | None) -> float | None:
    if current is None or previous is None:
        return None
    return current - previous


def _mean(values: list[float]) -> float | None:
    return float(np.mean(values)) if values else None


def _median(values: list[float]) -> float | None:
    return float(np.median(values)) if values else None


def _std(values: list[float]) -> float | None:
    return float(np.std(values)) if values else None


def compute_window_return(
    db: DatabaseClient,
    event_time: datetime,
    horizon_days: int,
    asset_symbol: str,
) -> float | None:
    start_price = db.get_asset_price_before(asset_symbol, event_time)
    end_price = db.get_asset_price_before(
        asset_symbol, event_time + timedelta(days=horizon_days)
    )
    return _pct_change(end_price, start_price)


def compute_indicator_window_return(
    db: DatabaseClient,
    event_time: datetime,
    horizon_days: int,
    indicator_name: str,
) -> float | None:
    start_value = db.get_indicator_value_before(indicator_name, event_time)
    end_value = db.get_indicator_value_before(
        indicator_name, event_time + timedelta(days=horizon_days)
    )
    return _pct_change(end_value, start_value)


def build_analogue_metrics(
    db: DatabaseClient, analogues: list[dict[str, Any]]
) -> dict[str, Any]:
    btc_1d: list[float] = []
    btc_7d: list[float] = []
    eth_7d: list[float] = []
    oil_7d: list[float] = []

    for analogue in analogues:
        event_time = _to_utc_datetime(analogue["event_time"])

        btc_1d_ret = compute_window_return(db, event_time, 1, "bitcoin")
        btc_7d_ret = compute_window_return(db, event_time, 7, "bitcoin")
        eth_7d_ret = compute_window_return(db, event_time, 7, "ethereum")
        oil_7d_ret = compute_indicator_window_return(
            db, event_time, 7, "brent_crude_oil_price"
        )

        if btc_1d_ret is not None:
            btc_1d.append(btc_1d_ret)
        if btc_7d_ret is not None:
            btc_7d.append(btc_7d_ret)
        if eth_7d_ret is not None:
            eth_7d.append(eth_7d_ret)
        if oil_7d_ret is not None:
            oil_7d.append(oil_7d_ret)

    return {
        "btc_return_1d_mean": _mean(btc_1d),
        "btc_return_1d_median": _median(btc_1d),
        "btc_return_1d_std": _std(btc_1d),
        "btc_return_7d_mean": _mean(btc_7d),
        "btc_return_7d_median": _median(btc_7d),
        "btc_return_7d_std": _std(btc_7d),
        "eth_return_7d_mean": _mean(eth_7d),
        "eth_return_7d_median": _median(eth_7d),
        "oil_return_7d_mean": _mean(oil_7d),
        "sample_sizes": {
            "btc_1d": len(btc_1d),
            "btc_7d": len(btc_7d),
            "eth_7d": len(eth_7d),
            "oil_7d": len(oil_7d),
        },
    }


def _lagged_corr(x: list[float], y: list[float], lag: int) -> float | None:
    if lag < 0:
        return None
    if lag == 0:
        x_adj, y_adj = x, y
    else:
        x_adj = x[:-lag]
        y_adj = y[lag:]
    if len(x_adj) < 8 or len(y_adj) < 8:
        return None
    if np.std(x_adj) == 0 or np.std(y_adj) == 0:
        return None
    return float(np.corrcoef(x_adj, y_adj)[0, 1])


def compute_oil_btc_lag_stats(
    db: DatabaseClient, lookback_days: int
) -> dict[str, Any]:
    rows = db.fetch_oil_btc_daily(lookback_days)
    if len(rows) < 20:
        return {
            "best_lag_days": None,
            "best_corr": None,
            "sample_size": len(rows),
        }

    oil_returns: list[float] = []
    btc_returns: list[float] = []

    for idx in range(1, len(rows)):
        current = rows[idx]
        previous = rows[idx - 1]
        oil_ret = _pct_change(float(current["oil"]), float(previous["oil"]))
        btc_ret = _pct_change(float(current["btc"]), float(previous["btc"]))
        if oil_ret is not None and btc_ret is not None:
            oil_returns.append(oil_ret)
            btc_returns.append(btc_ret)

    if len(oil_returns) < 10:
        return {
            "best_lag_days": None,
            "best_corr": None,
            "sample_size": len(oil_returns),
        }

    best_lag = None
    best_corr = None
    for lag in range(0, 8):
        corr = _lagged_corr(oil_returns, btc_returns, lag)
        if corr is None:
            continue
        if best_corr is None or abs(corr) > abs(best_corr):
            best_corr = corr
            best_lag = lag

    return {
        "best_lag_days": best_lag,
        "best_corr": best_corr,
        "sample_size": len(oil_returns),
    }


def compute_indicator_btc_lag_stats(
    db: DatabaseClient,
    indicator_name: str,
    lookback_days: int,
    max_lag_days: int = 30,
) -> dict[str, Any]:
    rows = db.fetch_indicator_btc_daily(indicator_name, lookback_days)
    if len(rows) < 20:
        return {
            "indicator_name": indicator_name,
            "best_lag_days": None,
            "best_corr": None,
            "sample_size": len(rows),
        }

    indicator_returns: list[float] = []
    btc_returns: list[float] = []

    for idx in range(1, len(rows)):
        current = rows[idx]
        previous = rows[idx - 1]
        indicator_ret = _pct_change(
            float(current["indicator"]), float(previous["indicator"])
        )
        btc_ret = _pct_change(float(current["btc"]), float(previous["btc"]))
        if indicator_ret is not None and btc_ret is not None:
            indicator_returns.append(indicator_ret)
            btc_returns.append(btc_ret)

    if len(indicator_returns) < 10:
        return {
            "indicator_name": indicator_name,
            "best_lag_days": None,
            "best_corr": None,
            "sample_size": len(indicator_returns),
        }

    best_lag = None
    best_corr = None
    for lag in range(0, max_lag_days + 1):
        corr = _lagged_corr(indicator_returns, btc_returns, lag)
        if corr is None:
            continue
        if best_corr is None or abs(corr) > abs(best_corr):
            best_corr = corr
            best_lag = lag

    return {
        "indicator_name": indicator_name,
        "best_lag_days": best_lag,
        "best_corr": best_corr,
        "sample_size": len(indicator_returns),
    }


def build_policy_context(db: DatabaseClient, reference_time: datetime) -> dict[str, Any]:
    indicator_map = {
        "fed_funds": "FRED_FEDFUNDS",
        "us10y": "FRED_DGS10",
        "cpi": "FRED_CPIAUCSL",
        "m2": "FRED_M2SL",
        "rrp": "FRED_RRPONTSYD",
        "dxy": "FRED_DTWEXBGS",
        "brent": "brent_crude_oil_price",
    }

    indicator_context: dict[str, Any] = {}
    for key, name in indicator_map.items():
        current = db.get_indicator_value_before(name, reference_time)
        prev_30d = db.get_indicator_value_before(name, reference_time - timedelta(days=30))
        prev_90d = db.get_indicator_value_before(name, reference_time - timedelta(days=90))
        indicator_context[key] = {
            "name": name,
            "current": current,
            "delta_30d": _delta(current, prev_30d),
            "delta_90d": _delta(current, prev_90d),
            "pct_change_30d": _pct_change(current, prev_30d),
            "pct_change_90d": _pct_change(current, prev_90d),
        }

    pressure_score = 0.0

    fed_delta_90d = indicator_context.get("fed_funds", {}).get("delta_90d")
    if isinstance(fed_delta_90d, (int, float)):
        pressure_score += 0.25 if fed_delta_90d > 0 else -0.25

    us10y_delta_90d = indicator_context.get("us10y", {}).get("delta_90d")
    if isinstance(us10y_delta_90d, (int, float)):
        pressure_score += 0.20 if us10y_delta_90d > 0 else -0.20

    m2_pct_90d = indicator_context.get("m2", {}).get("pct_change_90d")
    if isinstance(m2_pct_90d, (int, float)):
        pressure_score += 0.20 if m2_pct_90d < 0 else -0.20

    cpi_pct_90d = indicator_context.get("cpi", {}).get("pct_change_90d")
    if isinstance(cpi_pct_90d, (int, float)):
        pressure_score += 0.15 if cpi_pct_90d > 0 else -0.10

    brent_pct_90d = indicator_context.get("brent", {}).get("pct_change_90d")
    if isinstance(brent_pct_90d, (int, float)):
        pressure_score += 0.20 if brent_pct_90d > 0 else -0.10

    bounded_score = float(max(-1.0, min(1.0, pressure_score)))
    if bounded_score >= 0.25:
        regime = "restrictive_bias"
    elif bounded_score <= -0.25:
        regime = "accommodative_bias"
    else:
        regime = "mixed_bias"

    return {
        "reference_time": reference_time.isoformat(),
        "policy_pressure_score": bounded_score,
        "policy_regime_bias": regime,
        "indicators": indicator_context,
    }


def compute_confidence_score(
    analogue_count: int, lag_stats: dict[str, Any], metrics: dict[str, Any]
) -> float:
    score = 0.2
    score += min(0.3, analogue_count * 0.04)

    best_corr = lag_stats.get("best_corr")
    if isinstance(best_corr, float):
        score += min(0.25, abs(best_corr) * 0.5)

    btc_7d_mean = metrics.get("btc_return_7d_mean")
    if isinstance(btc_7d_mean, float):
        score += 0.1

    sample_size = (
        metrics.get("sample_sizes", {}).get("btc_7d")
        if isinstance(metrics.get("sample_sizes"), dict)
        else 0
    )
    if isinstance(sample_size, int) and sample_size >= 5:
        score += 0.1

    return float(max(0.05, min(0.95, score)))


def build_analysis_payload(
    event: dict[str, Any],
    analogues: list[dict[str, Any]],
    metrics: dict[str, Any],
    lag_stats: dict[str, Any],
    confidence_score: float,
    policy_context: dict[str, Any] | None = None,
    policy_lags: dict[str, Any] | None = None,
) -> dict[str, Any]:
    payload = {
        "event_id": event["id"],
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "methodology": "analogue-event-window-v1",
        "analogue_count": len(analogues),
        "analogue_ids": [a["id"] for a in analogues],
        "metrics": metrics,
        "oil_btc_lag": lag_stats,
        "confidence_score": confidence_score,
        "assumptions": [
            "Analogues selected by same channel+event_type and severity distance.",
            "Returns are computed from latest available values at or before each horizon cut.",
            "Lag correlation is descriptive and not causal proof.",
        ],
    }

    if policy_context is not None:
        payload["policy_context"] = policy_context
    if policy_lags is not None:
        payload["policy_lags"] = policy_lags

    return payload

