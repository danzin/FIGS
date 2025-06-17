
\echo 'Starting OHLC continuous aggregate creation...'
\echo 'Current data will be preserved throughout this process.'
\echo ''

\echo '--> Step 1: Cleaning up failed continuous aggregates...'

DROP MATERIALIZED VIEW IF EXISTS public.signals_hourly_ohlcv CASCADE;
DROP MATERIALIZED VIEW IF EXISTS public.signals_15min_ohlcv CASCADE;

\echo '--> Step 2: Creating OHLC continuous aggregate...'

CREATE MATERIALIZED VIEW public.signals_hourly_ohlc
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 hour', time) AS bucketed_at,
    regexp_replace(name, '_price$', '') AS asset,
    source,
    -- OHLC calculations
    first(value, time) AS open_price,
    max(value) AS high_price,
    min(value) AS low_price,
    last(value, time) AS close_price,
    NULL::double precision AS volume,

    count(*) AS price_samples,
    stddev(value) AS price_volatility
FROM public.signals
WHERE name LIKE '%_price'  -- Only process price signals
GROUP BY 
    time_bucket('1 hour', time),
    regexp_replace(name, '_price$', ''),
    source
WITH NO DATA;

\echo '--> Step 3: Creating 15-minute OHLC continuous aggregate...'

CREATE MATERIALIZED VIEW public.signals_15min_ohlc
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('15 minutes', time) AS bucketed_at,
    regexp_replace(name, '_price$', '') AS asset,
    source,
    first(value, time) AS open_price,
    max(value) AS high_price,
    min(value) AS low_price,
    last(value, time) AS close_price,
    NULL::double precision AS volume,
    count(*) AS price_samples
FROM public.signals
WHERE name LIKE '%_price'
GROUP BY 
    time_bucket('15 minutes', time),
    regexp_replace(name, '_price$', ''),
    source
WITH NO DATA;

\echo '--> Step 4: Creating performance indexes...'

CREATE INDEX IF NOT EXISTS idx_signals_hourly_ohlc_asset_time 
    ON public.signals_hourly_ohlc (asset, bucketed_at DESC);
CREATE INDEX IF NOT EXISTS idx_signals_hourly_ohlc_time 
    ON public.signals_hourly_ohlc (bucketed_at DESC);

CREATE INDEX IF NOT EXISTS idx_signals_15min_ohlc_asset_time 
    ON public.signals_15min_ohlc (asset, bucketed_at DESC);
CREATE INDEX IF NOT EXISTS idx_signals_15min_ohlc_time 
    ON public.signals_15min_ohlc (bucketed_at DESC);

\echo '--> Step 5: Adding refresh policies...'

SELECT add_continuous_aggregate_policy(
    'public.signals_hourly_ohlc',
    start_offset => INTERVAL '2 days',
    end_offset   => INTERVAL '30 minutes',
    schedule_interval => INTERVAL '5 minutes'
);

SELECT add_continuous_aggregate_policy(
    'public.signals_15min_ohlc',
    start_offset => INTERVAL '1 day',
    end_offset   => INTERVAL '15 minutes',
    schedule_interval => INTERVAL '5 minutes'
);

\echo '--> Step 6: Performing initial materialization...'
\echo '    This processes all historical price data...'

CALL refresh_continuous_aggregate('public.signals_hourly_ohlc', NULL, NULL);
CALL refresh_continuous_aggregate('public.signals_15min_ohlc', NULL, NULL);

\echo '--> Step 7: Creating lightweight-charts optimized view...'

CREATE OR REPLACE VIEW public.ohlc_for_charts AS
SELECT 
    EXTRACT(EPOCH FROM bucketed_at)::bigint AS time,
    asset,
    source,
    open_price AS open,
    high_price AS high,
    low_price AS low,
    close_price AS close,
    volume,
    price_samples
FROM public.signals_hourly_ohlc
ORDER BY bucketed_at DESC;

\echo '--> Step 8: Creating helper function for API queries...'

CREATE OR REPLACE FUNCTION get_ohlc_data(
    p_asset TEXT,
    p_source TEXT DEFAULT NULL,
    p_interval TEXT DEFAULT '1h',
    p_limit INTEGER DEFAULT 1000
) 
RETURNS TABLE (
    TIMESTAMPTZ BIGINT,
    open DOUBLE PRECISION,
    high DOUBLE PRECISION,
    low DOUBLE PRECISION,
    close DOUBLE PRECISION,
    volume DOUBLE PRECISION
) AS $$
BEGIN
    IF p_interval = '15m' THEN
        RETURN QUERY
        SELECT 
            EXTRACT(EPOCH FROM bucketed_at)::bigint,
            open_price,
            high_price,
            low_price,
            close_price,
            volume
        FROM public.signals_15min_ohlc
        WHERE asset = p_asset
        AND (p_source IS NULL OR source = p_source)
        ORDER BY bucketed_at DESC
        LIMIT p_limit;
    ELSE
        RETURN QUERY
        SELECT 
            EXTRACT(EPOCH FROM bucketed_at)::bigint,
            open_price,
            high_price,
            low_price,
            close_price,
            volume
        FROM public.signals_hourly_ohlc
        WHERE asset = p_asset
        AND (p_source IS NULL OR source = p_source)
        ORDER BY bucketed_at DESC
        LIMIT p_limit;
    END IF;
END;
$$ LANGUAGE plpgsql;

\echo ''
\echo 'OHLC Migration completed successfully!'
\echo ''
\echo 'Summary of what was created:'
\echo '- ✓ signals_hourly_ohlc (1-hour OHLC data)'
\echo '- ✓ signals_15min_ohlc (15-minute OHLC data)'
\echo '- ✓ ohlc_for_charts (view with Unix timestamps)'
\echo '- ✓ get_ohlc_data() function for API queries'
\echo '- ✓ Refresh policies every 5 minutes'
\echo '- ✓ Performance indexes'
\echo '- ✓ Historical data materialized'
\echo ''
\echo 'Usage examples:'
\echo '-- Get Bitcoin hourly OHLC data:'
\echo "SELECT * FROM get_ohlc_data('coingecko_bitcoin') LIMIT 24;"
\echo ''
\echo '-- Get Ethereum 15-minute data:'
\echo "SELECT * FROM get_ohlc_data('coingecko_ethereum', 'CoinGecko', '15m', 100);"
\echo ''
\echo '-- Direct query for lightweight-charts:'
\echo "SELECT time, open, high, low, close FROM ohlc_for_charts WHERE asset = 'coingecko_bitcoin' LIMIT 100;"