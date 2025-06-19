\echo 'Starting OHLC continuous aggregate creation (with volume support)...'
\echo 'Current data will be preserved throughout this process.'
\echo ''

\echo '--> Step 1: Cleaning up failed continuous aggregates...'

DROP MATERIALIZED VIEW IF EXISTS public.signals_hourly_ohlc CASCADE;
DROP MATERIALIZED VIEW IF EXISTS public.signals_15min_ohlc CASCADE;
DROP MATERIALIZED VIEW IF EXISTS public.signals_hourly_ohlc CASCADE;
DROP MATERIALIZED VIEW IF EXISTS public.signals_15min_ohlc CASCADE;
DROP FUNCTION IF EXISTS public.get_ohlc_data(TEXT, TEXT, TEXT, INTEGER) CASCADE;

\echo '--> Step 2: Creating hourly OHLC continuous aggregate with volume support...'

CREATE MATERIALIZED VIEW public.signals_hourly_ohlc
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 hour', time) AS bucketed_at,
    regexp_replace(name, '_(price|volume)$', '') AS asset,
    source,
    -- OHLC calculations (only for price signals)
    first(
        CASE WHEN name LIKE '%_price' THEN value ELSE NULL END, 
        time
    ) FILTER (WHERE name LIKE '%_price') AS open_price,
    max(
        CASE WHEN name LIKE '%_price' THEN value ELSE NULL END
    ) AS high_price,
    min(
        CASE WHEN name LIKE '%_price' THEN value ELSE NULL END
    ) AS low_price,
    last(
        CASE WHEN name LIKE '%_price' THEN value ELSE NULL END, 
        time
    ) FILTER (WHERE name LIKE '%_price') AS close_price,
    -- Volume calculation (most recent volume reading)
    last(
        CASE WHEN name LIKE '%_volume' THEN value ELSE NULL END, 
        time
    ) FILTER (WHERE name LIKE '%_volume') AS volume,
    -- Metadata
    count(*) FILTER (WHERE name LIKE '%_price') AS price_samples,
    stddev(value) FILTER (WHERE name LIKE '%_price') AS price_volatility
FROM public.signals
WHERE name LIKE '%_price' OR name LIKE '%_volume'
GROUP BY 
    time_bucket('1 hour', time),
    regexp_replace(name, '_(price|volume)$', ''),
    source
WITH NO DATA;

\echo '--> Step 3: Creating 15-minute OHLC continuous aggregate with volume support...'

CREATE MATERIALIZED VIEW public.signals_15min_ohlc
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('15 minutes', time) AS bucketed_at,
    regexp_replace(name, '_(price|volume)$', '') AS asset,
    source,
    -- OHLC calculations (only for price signals)
    first(
        CASE WHEN name LIKE '%_price' THEN value ELSE NULL END, 
        time
    ) FILTER (WHERE name LIKE '%_price') AS open_price,
    max(
        CASE WHEN name LIKE '%_price' THEN value ELSE NULL END
    ) AS high_price,
    min(
        CASE WHEN name LIKE '%_price' THEN value ELSE NULL END
    ) AS low_price,
    last(
        CASE WHEN name LIKE '%_price' THEN value ELSE NULL END, 
        time
    ) FILTER (WHERE name LIKE '%_price') AS close_price,
    -- Volume calculation (most recent volume reading)
    last(
        CASE WHEN name LIKE '%_volume' THEN value ELSE NULL END, 
        time
    ) FILTER (WHERE name LIKE '%_volume') AS volume,
    -- Metadata
    count(*) FILTER (WHERE name LIKE '%_price') AS price_samples
FROM public.signals
WHERE name LIKE '%_price' OR name LIKE '%_volume'
GROUP BY 
    time_bucket('15 minutes', time),
    regexp_replace(name, '_(price|volume)$', ''),
    source
WITH NO DATA;

\echo '--> Step 4: Creating 30-minute OHLC continuous aggregate with volume support...'

CREATE MATERIALIZED VIEW public.signals_30min_ohlc
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('30 minutes', time) AS bucketed_at,
    regexp_replace(name, '_(price|volume)$', '') AS asset,
    source,
    -- OHLC calculations (only for price signals)
    first(
        CASE WHEN name LIKE '%_price' THEN value ELSE NULL END, 
        time
    ) FILTER (WHERE name LIKE '%_price') AS open_price,
    max(
        CASE WHEN name LIKE '%_price' THEN value ELSE NULL END
    ) AS high_price,
    min(
        CASE WHEN name LIKE '%_price' THEN value ELSE NULL END
    ) AS low_price,
    last(
        CASE WHEN name LIKE '%_price' THEN value ELSE NULL END, 
        time
    ) FILTER (WHERE name LIKE '%_price') AS close_price,
    -- Volume calculation (most recent volume reading)
    last(
        CASE WHEN name LIKE '%_volume' THEN value ELSE NULL END, 
        time
    ) FILTER (WHERE name LIKE '%_volume') AS volume,
    -- Metadata
    count(*) FILTER (WHERE name LIKE '%_price') AS price_samples
FROM public.signals
WHERE name LIKE '%_price' OR name LIKE '%_volume'
GROUP BY 
    time_bucket('30 minutes', time),
    regexp_replace(name, '_(price|volume)$', ''),
    source
WITH NO DATA;

\echo '--> Step 5: Creating 1 day OHLC continuous aggregate with volume support...'

CREATE MATERIALIZED VIEW public.signals_1day_ohlc
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 day', time) AS bucketed_at,
    regexp_replace(name, '_(price|volume)$', '') AS asset,
    source,
    -- OHLC calculations (only for price signals)
    first(
        CASE WHEN name LIKE '%_price' THEN value ELSE NULL END, 
        time
    ) FILTER (WHERE name LIKE '%_price') AS open_price,
    max(
        CASE WHEN name LIKE '%_price' THEN value ELSE NULL END
    ) AS high_price,
    min(
        CASE WHEN name LIKE '%_price' THEN value ELSE NULL END
    ) AS low_price,
    last(
        CASE WHEN name LIKE '%_price' THEN value ELSE NULL END, 
        time
    ) FILTER (WHERE name LIKE '%_price') AS close_price,
    -- Volume calculation (most recent volume reading)
    last(
        CASE WHEN name LIKE '%_volume' THEN value ELSE NULL END, 
        time
    ) FILTER (WHERE name LIKE '%_volume') AS volume,
    -- Metadata
    count(*) FILTER (WHERE name LIKE '%_price') AS price_samples
FROM public.signals
WHERE name LIKE '%_price' OR name LIKE '%_volume'
GROUP BY 
    time_bucket('1 day', time),
    regexp_replace(name, '_(price|volume)$', ''),
    source
WITH NO DATA;

\echo '--> Step 6: Creating performance indexes...'

CREATE INDEX IF NOT EXISTS idx_signals_hourly_ohlc_asset_time 
    ON public.signals_hourly_ohlc (asset, bucketed_at DESC);
CREATE INDEX IF NOT EXISTS idx_signals_hourly_ohlc_time 
    ON public.signals_hourly_ohlc (bucketed_at DESC);

CREATE INDEX IF NOT EXISTS idx_signals_15min_ohlc_asset_time 
    ON public.signals_15min_ohlc (asset, bucketed_at DESC);
CREATE INDEX IF NOT EXISTS idx_signals_15min_ohlc_time 
    ON public.signals_15min_ohlc (bucketed_at DESC);

CREATE INDEX IF NOT EXISTS idx_signals_30min_ohlc_asset_time 
    ON public.signals_30min_ohlc (asset, bucketed_at DESC);
CREATE INDEX IF NOT EXISTS idx_signals_30min_ohlc_time 
    ON public.signals_30min_ohlc (bucketed_at DESC);

CREATE INDEX IF NOT EXISTS idx_signals_1day_ohlc_asset_time 
    ON public.signals_1day_ohlc (asset, bucketed_at DESC);
CREATE INDEX IF NOT EXISTS idx_signals_1day_ohlc_time 
    ON public.signals_1day_ohlc (bucketed_at DESC);

\echo '--> Step 7: Adding refresh policies...'

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

SELECT add_continuous_aggregate_policy(
    'public.signals_30min_ohlc',
    start_offset => INTERVAL '1 day 12 hours',
    end_offset   => INTERVAL '15 minutes',
    schedule_interval => INTERVAL '5 minutes'
);

SELECT add_continuous_aggregate_policy(
    'public.signals_1day_ohlc',
    start_offset => INTERVAL '3 days', 
    end_offset   => INTERVAL '1 hour', 
    schedule_interval => INTERVAL '1 hour' 
);


\echo '--> Step 8: Performing initial materialization...'
\echo '    This processes all historical price and volume data...'

CALL refresh_continuous_aggregate('public.signals_hourly_ohlc', NULL, NULL);
CALL refresh_continuous_aggregate('public.signals_15min_ohlc', NULL, NULL);
CALL refresh_continuous_aggregate('public.signals_30min_ohlc', NULL, NULL);
CALL refresh_continuous_aggregate('public.signals_1day_ohlc', NULL, NULL);

\echo '--> Step 8: Creating TimescaleDB-optimized view...'

CREATE OR REPLACE VIEW public.ohlc_for_charts AS
SELECT 
    bucketed_at AS "timestamp",
    asset,
    source,
    open_price AS "open",
    high_price AS "high",
    low_price AS "low",
    close_price AS "close",
    volume,
    price_samples
FROM public.signals_hourly_ohlc
WHERE open_price IS NOT NULL  -- Only return rows with actual price data
ORDER BY bucketed_at DESC;

\echo '--> Step 9: Creating helper API function...'

CREATE OR REPLACE FUNCTION get_ohlc_data(
    p_asset TEXT,
    p_source TEXT DEFAULT NULL,
    p_interval TEXT DEFAULT '1h',
    p_limit INTEGER DEFAULT 1000
)
RETURNS TABLE (
    "timestamp" TIMESTAMPTZ,
    "open" DOUBLE PRECISION,
    "high" DOUBLE PRECISION,
    "low" DOUBLE PRECISION,
    "close" DOUBLE PRECISION,
    "volume" DOUBLE PRECISION
) AS $$
DECLARE
    -- Variable to hold the dynamically constructed query
    query TEXT;
    -- Variable to hold the name of the CAGG table to query
    table_name TEXT;
BEGIN
    -- Step 1: Validate input parameters
    IF p_limit IS NULL OR p_limit <= 0 OR p_limit > 10000 THEN
        RAISE EXCEPTION 'Limit must be between 1 and 10000, got: %', p_limit;
    END IF;

    -- Step 2: Map the interval string to a valid, existing table name.

    SELECT
        CASE
            WHEN p_interval = '15m' THEN 'signals_15min_ohlc'
            WHEN p_interval = '30m' THEN 'signals_30min_ohlc'
            WHEN p_interval = '1h'  THEN 'signals_hourly_ohlc'
            WHEN p_interval = '1d'  THEN 'signals_1day_ohlc'
            ELSE NULL
        END
    INTO table_name;

    -- If the interval doesn't match any known table, raise an error.
    IF table_name IS NULL THEN
        RAISE EXCEPTION 'Invalid interval. Supported: 15m, 30m, 1h, 1d. Got: %', p_interval;
    END IF;


    -- Step 3: Construct the query string using format() for safe identifier injection.
    query := format(
        'SELECT
            s.bucketed_at,
            s.open_price,
            s.high_price,
            s.low_price,
            s.close_price,
            s.volume
        FROM %I s
        WHERE s.asset = $1
          AND s.open_price IS NOT NULL
          AND ($2 IS NULL OR s.source = $2)
        ORDER BY s.bucketed_at DESC
        LIMIT $3;',
        table_name 
    );

    -- Step 4: Execute the dynamic query and return the results.
    RETURN QUERY EXECUTE query
    USING p_asset, p_source, p_limit;

END;
$$ LANGUAGE plpgsql;

\echo ''
\echo 'OHLC Migration completed successfully!'
\echo ''
\echo 'Summary of what was created:'
\echo '- ✓ signals_hourly_ohlc (1-hour OHLC+V data with proper volume support)'
\echo '- ✓ signals_15min_ohlc (15-minute OHLC+V data with proper volume support)'
\echo '- ✓ signals_30min_ohlc (30-minute OHLC+V data with proper volume support)'
\echo '- ✓ signals_1day_ohlc (1-day OHLC+V data with proper volume support)'
\echo '- ✓ ohlc_for_charts (TimescaleDB-optimized view)'
\echo '- ✓ get_ohlc_data() function with professional error handling'
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
\echo '-- Direct query with TimescaleDB timestamps:'
\echo "SELECT timestamp, open, high, low, close, volume FROM ohlc_for_charts WHERE asset = 'coingecko_bitcoin' LIMIT 100;"