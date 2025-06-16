\echo 'Beginning database initialization...'

-- Extension
\echo '--> Step 1: Creating extensions...'
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Raw signals hypertable
\echo '--> Step 2: Creating raw signals hypertable (public.signals)...'
CREATE TABLE IF NOT EXISTS public.signals (
    time TIMESTAMPTZ NOT NULL,
    name TEXT NOT NULL,
    value DOUBLE PRECISION NOT NULL,
    source TEXT NOT NULL,
    CONSTRAINT pk_signals PRIMARY KEY (name, time)
);

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
-- Additional index for price-related queries (OHLCV calculations)
CREATE INDEX IF NOT EXISTS idx_signals_price_volume ON public.signals (name, time) 
    WHERE name LIKE '%_price' OR name LIKE '%_volume';

-- Create the Hourly Continuous Aggregate for general/non-price stats
\echo '--> Step 4: Creating hourly continuous aggregate for non-price signals (public.signals_hourly_general)...'
CREATE MATERIALIZED VIEW IF NOT EXISTS public.signals_hourly_general
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 hour', "time") AS bucketed_at,
    name,
    source,
    avg(value) AS avg_value,
    min(value) AS min_value,
    max(value) AS max_value,
    first(value, "time") AS first_value,  -- Added first/last for non-price metrics
    last(value, "time") AS last_value,
    count(*) AS sample_count
FROM
    public.signals
WHERE
    -- Exclude price and volume data - handle separately
    name NOT LIKE '%_price' AND name NOT LIKE '%_volume'
GROUP BY
    bucketed_at, name, source
WITH NO DATA;

-- Create the Hourly OHLCV Continuous Aggregate (FIXED VERSION)
\echo '--> Step 5: Creating hourly OHLCV summary continuous aggregate (public.signals_hourly_ohlcv)...'
CREATE MATERIALIZED VIEW IF NOT EXISTS public.signals_hourly_ohlcv
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 hour', p.time) AS bucketed_at,
    -- Extract base asset name by removing '_price' suffix
    regexp_replace(p.name, '_price$', '') AS asset,
    p.source,
    -- OHLC calculations using proper time-based ordering
    first(p.value, p.time) AS open_price,
    max(p.value) AS high_price,
    min(p.value) AS low_price,
    last(p.value, p.time) AS close_price,
    -- Volume from matching volume signal (if exists)
    v.total_volume,
    -- Additional useful metrics
    count(p.*) AS price_samples,
    stddev(p.value) AS price_volatility
FROM
    public.signals p
LEFT JOIN (
    -- Subquery to get volume data for each hour/asset
    SELECT
        time_bucket('1 hour', time) AS bucketed_at,
        regexp_replace(name, '_volume$', '') AS asset,
        source,
        sum(value) AS total_volume
    FROM public.signals
    WHERE name LIKE '%_volume'
    GROUP BY bucketed_at, asset, source
) v ON (
    time_bucket('1 hour', p.time) = v.bucketed_at 
    AND regexp_replace(p.name, '_price$', '') = v.asset
    AND p.source = v.source
)
WHERE
    p.name LIKE '%_price'
GROUP BY
    bucketed_at, asset, p.source, v.total_volume
WITH NO DATA;

-- Create 15-minute aggregates for more granular analysis
\echo '--> Step 6: Creating 15-minute OHLCV continuous aggregate (public.signals_15min_ohlcv)...'
CREATE MATERIALIZED VIEW IF NOT EXISTS public.signals_15min_ohlcv
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('15 minutes', p.time) AS bucketed_at,
    regexp_replace(p.name, '_price$', '') AS asset,
    p.source,
    first(p.value, p.time) AS open_price,
    max(p.value) AS high_price,
    min(p.value) AS low_price,
    last(p.value, p.time) AS close_price,
    v.total_volume,
    count(p.*) AS price_samples
FROM
    public.signals p
LEFT JOIN (
    SELECT
        time_bucket('15 minutes', time) AS bucketed_at,
        regexp_replace(name, '_volume$', '') AS asset,
        source,
        sum(value) AS total_volume
    FROM public.signals
    WHERE name LIKE '%_volume'
    GROUP BY bucketed_at, asset, source
) v ON (
    time_bucket('15 minutes', p.time) = v.bucketed_at 
    AND regexp_replace(p.name, '_price$', '') = v.asset
    AND p.source = v.source
)
WHERE
    p.name LIKE '%_price'
GROUP BY
    bucketed_at, asset, p.source, v.total_volume
WITH NO DATA;

-- Create indexes on continuous aggregates for better query performance
\echo '--> Step 7: Creating indexes on continuous aggregates...'
-- Indexes for general signals aggregate
CREATE INDEX IF NOT EXISTS idx_signals_hourly_general_name_time 
    ON public.signals_hourly_general (name, bucketed_at DESC);
CREATE INDEX IF NOT EXISTS idx_signals_hourly_general_time 
    ON public.signals_hourly_general (bucketed_at DESC);

-- Indexes for OHLCV aggregates
CREATE INDEX IF NOT EXISTS idx_signals_hourly_ohlcv_asset_time 
    ON public.signals_hourly_ohlcv (asset, bucketed_at DESC);
CREATE INDEX IF NOT EXISTS idx_signals_hourly_ohlcv_time 
    ON public.signals_hourly_ohlcv (bucketed_at DESC);

CREATE INDEX IF NOT EXISTS idx_signals_15min_ohlcv_asset_time 
    ON public.signals_15min_ohlcv (asset, bucketed_at DESC);
CREATE INDEX IF NOT EXISTS idx_signals_15min_ohlcv_time 
    ON public.signals_15min_ohlcv (bucketed_at DESC);

-- Add refresh policies for continuous aggregates (faster refresh as requested)
\echo '--> Step 8: Adding refresh policies...'

-- Policy for general signals (every 10 minutes)
SELECT add_continuous_aggregate_policy(
    'public.signals_hourly_general',
    start_offset => INTERVAL '2 days',
    end_offset   => INTERVAL '30 minutes',
    schedule_interval => INTERVAL '10 minutes'
);

-- Policy for hourly OHLCV (every 5 minutes for recent data)
SELECT add_continuous_aggregate_policy(
    'public.signals_hourly_ohlcv',
    start_offset => INTERVAL '2 days',
    end_offset   => INTERVAL '30 minutes',
    schedule_interval => INTERVAL '5 minutes'
);

-- Policy for 15-minute OHLCV (every 5 minutes for real-time analysis)
SELECT add_continuous_aggregate_policy(
    'public.signals_15min_ohlcv',
    start_offset => INTERVAL '1 day',
    end_offset   => INTERVAL '15 minutes',
    schedule_interval => INTERVAL '5 minutes'
);

-- Add compression policies for historical data efficiency
\echo '--> Step 9: Adding compression policies...'

-- Compress raw data older than 30 days
SELECT add_compression_policy(
    'public.signals',
    INTERVAL '30 days'
);

-- Compress hourly aggregates older than 90 days
SELECT add_compression_policy(
    'public.signals_hourly_general',
    INTERVAL '90 days'
);

SELECT add_compression_policy(
    'public.signals_hourly_ohlcv',
    INTERVAL '90 days'
);

-- Compress 15-minute aggregates older than 30 days (keep recent data uncompressed for fast queries)
SELECT add_compression_policy(
    'public.signals_15min_ohlcv',
    INTERVAL '30 days'
);

-- Add retention policies for very old data
\echo '--> Step 10: Adding retention policies...'

-- Keep raw data for 2 years
SELECT add_retention_policy(
    'public.signals',
    INTERVAL '2 years'
);

-- Keep 15-minute aggregates for 1 year
SELECT add_retention_policy(
    'public.signals_15min_ohlcv',
    INTERVAL '1 year'
);

-- Keep hourly aggregates for 5 years
SELECT add_retention_policy(
    'public.signals_hourly_general',
    INTERVAL '5 years'
);

SELECT add_retention_policy(
    'public.signals_hourly_ohlcv',
    INTERVAL '5 years'
);

-- Create helper view for easy querying of latest prices
\echo '--> Step 11: Creating helper views...'

CREATE OR REPLACE VIEW public.latest_prices AS
SELECT DISTINCT ON (regexp_replace(name, '_price$', ''))
    regexp_replace(name, '_price$', '') AS asset,
    time,
    value AS price,
    source
FROM public.signals
WHERE name LIKE '%_price'
ORDER BY regexp_replace(name, '_price$', ''), time DESC;

CREATE OR REPLACE VIEW public.latest_signals AS
SELECT DISTINCT ON (name)
    name,
    time,
    value,
    source
FROM public.signals
WHERE name NOT LIKE '%_price' AND name NOT LIKE '%_volume'
ORDER BY name, time DESC;

\echo 'Database initialization script completed successfully.'
\echo ''
\echo 'Summary of created objects:'
\echo '- Hypertable: public.signals'
\echo '- Continuous aggregates: signals_hourly_general, signals_hourly_ohlcv, signals_15min_ohlcv'
\echo '- Helper views: latest_prices, latest_signals'
\echo '- Policies: refresh (5-10 min), compression (30-90 days), retention (1-5 years)'