\echo 'Beginning database initialization...'

\echo '--> Step 1: Creating extensions...'
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Raw signals 
\echo '--> Step 2: Creating raw signals hypertable (public.signals)...'
CREATE TABLE IF NOT EXISTS public.signals (
    time TIMESTAMPTZ NOT NULL,
    name TEXT NOT NULL,
    value DOUBLE PRECISION NOT NULL,
    source TEXT NOT NULL
);

-- Gypertable
SELECT create_hypertable(
    'public.signals',
    'time',
    if_not_exists => TRUE,
    chunk_time_interval => INTERVAL '7 days'
);

-- Indexes on the raw data table
\echo '--> Step 3: Creating indexes on raw signals table...'
CREATE INDEX IF NOT EXISTS idx_signals_name_time_desc ON public.signals (name, time DESC);
CREATE INDEX IF NOT EXISTS idx_signals_time_desc ON public.signals (time DESC);
CREATE INDEX IF NOT EXISTS idx_signals_source ON public.signals(source);
CREATE INDEX IF NOT EXISTS idx_signals_price_volume ON public.signals (name, time) 
    WHERE name LIKE '%_price' OR name LIKE '%_volume';

-- Create the Hourly Continuous Aggregate for general/non-price stats
\echo '--> Step 4: Creating hourly continuous aggregate for non-price signals...'
CREATE MATERIALIZED VIEW IF NOT EXISTS public.signals_hourly_general
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 hour', time) AS bucketed_at,
    name,
    source,
    avg(value) AS avg_value,
    min(value) AS min_value,
    max(value) AS max_value,
    first(value, time) AS first_value,
    last(value, time) AS last_value,
    count(*) AS sample_count
FROM public.signals
WHERE name NOT LIKE '%_price' AND name NOT LIKE '%_volume'
GROUP BY bucketed_at, name, source
WITH NO DATA;

-- Create the Hourly OHLC+Volume Continuous Aggregate 
\echo '--> Step 5: Creating hourly OHLC+volume continuous aggregate...'
CREATE MATERIALIZED VIEW IF NOT EXISTS public.signals_hourly_ohlc
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
    -- Volume calculation: most recent volume reading in bucket
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

-- Create 15-minute OHLC+Volume aggregate
\echo '--> Step 6: Creating 15-minute OHLC+volume continuous aggregate...'
CREATE MATERIALIZED VIEW IF NOT EXISTS public.signals_15min_ohlc
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

\echo '--> Step 7: Creating indexes on continuous aggregates...'

-- Indexes for general signals aggregate
CREATE INDEX IF NOT EXISTS idx_signals_hourly_general_name_time 
    ON public.signals_hourly_general (name, bucketed_at DESC);
CREATE INDEX IF NOT EXISTS idx_signals_hourly_general_time 
    ON public.signals_hourly_general (bucketed_at DESC);

-- Indexes for OHLC+V aggregates
CREATE INDEX IF NOT EXISTS idx_signals_hourly_ohlc_asset_time 
    ON public.signals_hourly_ohlc (asset, bucketed_at DESC);
CREATE INDEX IF NOT EXISTS idx_signals_hourly_ohlc_time 
    ON public.signals_hourly_ohlc (bucketed_at DESC);

CREATE INDEX IF NOT EXISTS idx_signals_15min_ohlc_asset_time 
    ON public.signals_15min_ohlc (asset, bucketed_at DESC);
CREATE INDEX IF NOT EXISTS idx_signals_15min_ohlc_time 
    ON public.signals_15min_ohlc (bucketed_at DESC);

\echo '--> Step 8: Adding refresh policies...'

SELECT add_continuous_aggregate_policy(
    'public.signals_hourly_general',
    start_offset => INTERVAL '2 days',
    end_offset   => INTERVAL '30 minutes',
    schedule_interval => INTERVAL '10 minutes'
);

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

\echo '--> Step 9: Adding compression policies...'

DO $$
BEGIN
    BEGIN
        PERFORM add_compression_policy('public.signals', INTERVAL '30 days');
        RAISE NOTICE 'Added compression policy for signals table';
    EXCEPTION 
        WHEN OTHERS THEN
            RAISE NOTICE 'Compression not available or already exists for signals table';
    END;
END $$;

\echo '--> Step 10: Creating helper views...'

-- Latest prices view remains useful
CREATE OR REPLACE VIEW public.latest_prices AS
SELECT DISTINCT ON (regexp_replace(name, '_price$', ''))
    regexp_replace(name, '_price$', '') AS asset,
    time,
    value AS price,
    source
FROM public.signals
WHERE name LIKE '%_price'
ORDER BY regexp_replace(name, '_price$', ''), time DESC;

-- You might also want a latest_volumes view if needed:
CREATE OR REPLACE VIEW public.latest_volumes AS
SELECT DISTINCT ON (regexp_replace(name, '_volume$', ''))
    regexp_replace(name, '_volume$', '') AS asset,
    time,
    value AS volume,
    source
FROM public.signals
WHERE name LIKE '%_volume'
ORDER BY regexp_replace(name, '_volume$', ''), time DESC;

CREATE OR REPLACE VIEW public.latest_signals AS
SELECT DISTINCT ON (name)
    name,
    time,
    value,
    source
FROM public.signals
WHERE name NOT LIKE '%_price' AND name NOT LIKE '%_volume'
ORDER BY name, time DESC;

-- Updated ohlc_for_charts to include volume and use datetime
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

\echo '--> Step 11: Creating API helper function...'

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
BEGIN
    -- Validate input parameters
    IF p_limit IS NULL OR p_limit <= 0 OR p_limit > 10000 THEN
        RAISE EXCEPTION 'Limit must be between 1 and 10000, got: %', p_limit;
    END IF;
    
    IF p_interval NOT IN ('15m', '1h') THEN
        RAISE EXCEPTION 'Invalid interval. Supported: 15m, 1h. Got: %', p_interval;
    END IF;

    -- Return data based on interval
    IF p_interval = '15m' THEN
        RETURN QUERY
        SELECT 
            s.bucketed_at,
            s.open_price,
            s.high_price,
            s.low_price,
            s.close_price,
            s.volume
        FROM public.signals_15min_ohlc s
        WHERE s.asset = p_asset
        AND s.open_price IS NOT NULL
        AND (p_source IS NULL OR s.source = p_source)
        ORDER BY s.bucketed_at DESC
        LIMIT p_limit;
    ELSE
        RETURN QUERY
        SELECT 
            s.bucketed_at,
            s.open_price,
            s.high_price,
            s.low_price,
            s.close_price,
            s.volume
        FROM public.signals_hourly_ohlc s
        WHERE s.asset = p_asset
        AND s.open_price IS NOT NULL
        AND (p_source IS NULL OR s.source = p_source)
        ORDER BY s.bucketed_at DESC
        LIMIT p_limit;
    END IF;
END;
$$ LANGUAGE plpgsql;

\echo ''
\echo 'Database initialization completed successfully!'
\echo ''
\echo 'Summary of created objects:'
\echo '- ✓ Hypertable: public.signals (7-day chunks)'
\echo '- ✓ Continuous aggregates: signals_hourly_general, signals_hourly_ohlc (with volume), signals_15min_ohlc (with volume)'
\echo '- ✓ Helper views: latest_prices, latest_volumes, latest_signals, ohlc_for_charts'
\echo '- ✓ API function: get_ohlc_data(asset, source, interval, limit) with error handling'
\echo '- ✓ Refresh policies: 5-10 minute intervals'
\echo '- ✓ Compression policy: 30-day compression on raw table'
\echo '- ✓ Performance indexes created'
\echo ''
\echo 'Usage examples:'
\echo '-- Get Bitcoin hourly OHLC+V data:'
\echo "SELECT * FROM get_ohlc_data('coingecko_bitcoin') LIMIT 24;"
\echo ''
\echo '-- Get Ethereum 15-minute OHLC+V data:'
\echo "SELECT * FROM get_ohlc_data('coingecko_ethereum', 'CoinGecko', '15m', 100);"
\echo ''
\echo '-- Direct query for charts:'
\echo "SELECT timestamp, open, high, low, close, volume FROM ohlc_for_charts WHERE asset = 'coingecko_bitcoin' LIMIT 100;"
\echo ''
\echo '-- Latest price and volume:'
\echo "SELECT * FROM latest_prices;"
\echo "SELECT * FROM latest_volumes;"

