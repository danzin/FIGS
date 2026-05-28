import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

import psycopg2
from psycopg2.extras import Json, RealDictCursor


class DatabaseClient:
    def __init__(self, host: str, port: int, user: str, password: str, database: str):
        self.conn = psycopg2.connect(
            host=host,
            port=port,
            user=user,
            password=password,
            dbname=database,
            cursor_factory=RealDictCursor,
        )

    def close(self) -> None:
        self.conn.close()

    def fetch_analogues(self, event: dict[str, Any], limit: int) -> list[dict[str, Any]]:
        query = """
            SELECT
                id,
                event_time,
                event_type,
                channel,
                severity::float8 AS severity,
                ABS(severity::float8 - %s::float8) AS severity_distance
            FROM public.macro_events
            WHERE id <> %s
              AND event_time < %s
              AND channel = %s
              AND event_type = %s
            ORDER BY severity_distance ASC, event_time DESC
            LIMIT %s;
        """
        with self.conn.cursor() as cur:
            cur.execute(
                query,
                (
                    float(event["severity"]),
                    event["id"],
                    event["event_time"],
                    event["channel"],
                    event["event_type"],
                    limit,
                ),
            )
            return list(cur.fetchall())

    def upsert_analogues(self, event_id: str, analogues: list[dict[str, Any]]) -> None:
        if not analogues:
            self.conn.commit()
            return

        query = """
            INSERT INTO public.macro_event_analogues (
                id,
                event_id,
                historical_event_id,
                embedding_similarity,
                regime_score,
                channel_score,
                composite_score,
                rank
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (event_id, historical_event_id)
            DO UPDATE SET
                embedding_similarity = EXCLUDED.embedding_similarity,
                regime_score = EXCLUDED.regime_score,
                channel_score = EXCLUDED.channel_score,
                composite_score = EXCLUDED.composite_score,
                rank = EXCLUDED.rank;
        """

        with self.conn.cursor() as cur:
            for idx, analogue in enumerate(analogues, start=1):
                severity_distance = float(analogue.get("severity_distance") or 1.0)
                embedding_similarity = max(0.0, min(1.0, 1.0 - severity_distance))
                regime_score = 0.6
                channel_score = 1.0
                composite_score = (
                    embedding_similarity * 0.6 + regime_score * 0.2 + channel_score * 0.2
                )
                cur.execute(
                    query,
                    (
                        str(uuid.uuid4()),
                        event_id,
                        analogue["id"],
                        embedding_similarity,
                        regime_score,
                        channel_score,
                        composite_score,
                        idx,
                    ),
                )
        self.conn.commit()

    def _fetch_latest_value_before(
        self, query: str, key: str, when: datetime, fallback_days: int
    ) -> float | None:
        with self.conn.cursor() as cur:
            cur.execute(query, (key, when))
            row = cur.fetchone()
            if row and row.get("value") is not None:
                return float(row["value"])

            fallback_time = when + timedelta(days=fallback_days)
            cur.execute(query, (key, fallback_time))
            row = cur.fetchone()
            if row and row.get("value") is not None:
                return float(row["value"])
        return None

    def get_asset_price_before(self, asset_symbol: str, when: datetime) -> float | None:
        query_1h = """
            SELECT close::float8 AS value
            FROM public.market_data_1h
            WHERE asset_symbol = %s
              AND type = 'price'
              AND time <= %s
            ORDER BY time DESC
            LIMIT 1;
        """
        value = self._fetch_latest_value_before(query_1h, asset_symbol, when, 1)
        if value is not None:
            return value

        query_1d = """
            SELECT close::float8 AS value
            FROM public.market_data_1d
            WHERE asset_symbol = %s
              AND type = 'price'
              AND time <= %s
            ORDER BY time DESC
            LIMIT 1;
        """
        return self._fetch_latest_value_before(query_1d, asset_symbol, when, 7)

    def get_indicator_value_before(self, indicator_name: str, when: datetime) -> float | None:
        query = """
            SELECT value::float8 AS value
            FROM public.market_indicators
            WHERE name = %s
              AND time <= %s
            ORDER BY time DESC
            LIMIT 1;
        """
        return self._fetch_latest_value_before(query, indicator_name, when, 7)

    def fetch_oil_btc_daily(self, lookback_days: int) -> list[dict[str, Any]]:
        query = """
            WITH oil AS (
                SELECT
                    date_trunc('day', time)::date AS day,
                    AVG(value::float8) AS oil
                FROM public.market_indicators
                WHERE name = 'brent_crude_oil_price'
                  AND time >= NOW() - (%s || ' days')::interval
                GROUP BY 1
            ),
            btc AS (
                SELECT
                    time::date AS day,
                    close::float8 AS btc
                FROM public.market_data_1d
                WHERE asset_symbol = 'bitcoin'
                  AND type = 'price'
                  AND time >= NOW() - (%s || ' days')::interval
            )
            SELECT o.day, o.oil, b.btc
            FROM oil o
            JOIN btc b ON b.day = o.day
            ORDER BY o.day;
        """
        with self.conn.cursor() as cur:
            cur.execute(query, (lookback_days, lookback_days))
            return list(cur.fetchall())

    def fetch_indicator_btc_daily(
        self, indicator_name: str, lookback_days: int
    ) -> list[dict[str, Any]]:
        query = """
            WITH indicator AS (
                SELECT
                    date_trunc('day', time)::date AS day,
                    AVG(value::float8) AS indicator
                FROM public.market_indicators
                WHERE name = %s
                  AND time >= NOW() - (%s || ' days')::interval
                GROUP BY 1
            ),
            btc AS (
                SELECT
                    time::date AS day,
                    close::float8 AS btc
                FROM public.market_data_1d
                WHERE asset_symbol = 'bitcoin'
                  AND type = 'price'
                  AND time >= NOW() - (%s || ' days')::interval
            )
            SELECT i.day, i.indicator, b.btc
            FROM indicator i
            JOIN btc b ON b.day = i.day
            ORDER BY i.day;
        """
        with self.conn.cursor() as cur:
            cur.execute(query, (indicator_name, lookback_days, lookback_days))
            return list(cur.fetchall())

    def insert_analysis_run(
        self,
        event_id: str,
        run_version: str,
        methodology: str,
        result_json: dict[str, Any],
        confidence_score: float,
    ) -> str:
        analysis_id = str(uuid.uuid4())
        query = """
            INSERT INTO public.macro_analysis_runs (
                id,
                event_id,
                run_version,
                methodology,
                result_json,
                confidence_score,
                created_at
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s);
        """
        with self.conn.cursor() as cur:
            cur.execute(
                query,
                (
                    analysis_id,
                    event_id,
                    run_version,
                    methodology,
                    Json(result_json),
                    confidence_score,
                    datetime.now(timezone.utc),
                ),
            )
        self.conn.commit()
        return analysis_id

