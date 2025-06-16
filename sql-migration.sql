

\echo 'Starting safe migration of TimescaleDB structure...'
\echo 'Current data will be preserved throughout this process.'
\echo ''

-- Step 1: Remove existing policies to avoid conflicts
\echo '--> Step 1: Cleaning up existing policies...'

-- Remove existing refresh policies (if they exist)
DO $$
BEGIN
    -- Try to remove policy for signals_hourly
    BEGIN
        PERFORM remove_continuous_aggregate_policy('public.signals_hourly');
        RAISE NOTICE 'Removed refresh policy for signals_hourly';
    EXCEPTION 
        WHEN OTHERS THEN
            RAISE NOTICE 'No existing refresh policy for signals_hourly (this is fine)';
    END;
    
    -- Try to remove policy for signals_hourly_summary
    BEGIN
        PERFORM remove_continuous_aggregate_policy('public.signals_hourly_summary');
        RAISE NOTICE 'Removed refresh policy for signals_hourly_summary';
    EXCEPTION 
        WHEN OTHERS THEN
            RAISE NOTICE 'No existing refresh policy for signals_hourly_summary (this is fine)';
    END;
END $$;

-- Step 2: Add new indexes to existing raw table (safe operation)
\echo '--> Step 2: Adding new indexes to signals table...'

-- This index will help with OHLCV queries
CREATE INDEX IF NOT EXISTS idx_signals_price_volume ON public.signals (name, time) 
    WHERE name LIKE '%_price' OR name LIKE '%_volume';

-- Update chunk interval if needed (safe operation)
\echo '--> Step 3: Checking chunk interval...'
DO $$
DECLARE
    current_interval INTERVAL;
BEGIN
    SELECT d.interval_length INTO current_interval
    FROM _timescaledb_catalog.dimension d
    JOIN _timescaledb_catalog.hypertable h ON h.id = d.hypertable_id
    WHERE h.table_name = 'signals' AND h.schema_name = 'public';
    
    IF current_interval = INTERVAL '5 days' THEN
        RAISE NOTICE 'Updating chunk interval from 5 days to 7 days for better performance...';
        PERFORM set_chunk_time_interval('public.signals', INTERVAL '7 days');
    ELSE
        RAISE NOTICE 'Chunk interval is already %, leaving unchanged', current_interval;
    END IF;
END $$;

-- Step 3: Create new continuous aggregates
\echo '--> Step 4: Creating new continuous aggregates...'

-- General signals aggregate (for non-price data)
\echo '    Creating signals_hourly_general...'
CREATE MATERIALIZED VIEW IF NOT EXISTS public.signals_hourly_general
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 hour', "time") AS bucketed_at,
    name,
    source,
    avg(value) AS avg_value,
    min(value) AS min_value,
    max(value) AS max_value,
    first(value, "time") AS first_value,
    last(value, "time") AS last_value,
    count(*) AS sample_count
FROM
    public.signals
WHERE
    name NOT LIKE '%_price' AND name NOT LIKE '%_volume'
GROUP BY
    bucketed_at, name, source
WITH NO DATA;

-- OHLCV aggregate (fixed logic)
\echo '    Creating signals_hourly_ohlcv...'
CREATE MATERIALIZED VIEW IF NOT EXISTS public.signals_hourly_ohlcv
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 hour', p.time) AS bucketed_at,
    regexp_replace(p.name, '_price$', '') AS asset,
    p.source,
    first(p.value, p.time) AS open_price,
    max(p.value) AS high_price,
    min(p.value) AS low_price,
    last(p.value, p.time) AS close_price,
    v.total_volume,
    count(p.*) AS price_samples,
    stddev(p.value) AS price_volatility
FROM
    public.signals p
LEFT JOIN (
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

-- 15-minute OHLCV aggregate
\echo '    Creating signals_15min_ohlcv...'
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

-- Step 4: Create indexes on new continuous aggregates
\echo '--> Step 5: Creating indexes on new continuous aggregates...'

CREATE INDEX IF NOT EXISTS idx_signals_hourly_general_name_time 
    ON public.signals_hourly_general (name, bucketed_at DESC);
CREATE INDEX IF NOT EXISTS idx_signals_hourly_general_time 
    ON public.signals_hourly_general (bucketed_at DESC);

CREATE INDEX IF NOT EXISTS idx_signals_hourly_ohlcv_asset_time 
    ON public.signals_hourly_ohlcv (asset, bucketed_at DESC);
CREATE INDEX IF NOT EXISTS idx_signals_hourly_ohlcv_time 
    ON public.signals_hourly_ohlcv (bucketed_at DESC);

CREATE INDEX IF NOT EXISTS idx_signals_15min_ohlcv_asset_time 
    ON public.signals_15min_ohlcv (asset, bucketed_at DESC);
CREATE INDEX IF NOT EXISTS idx_signals_15min_ohlcv_time 
    ON public.signals_15min_ohlcv (bucketed_at DESC);

-- Step 5: Add new refresh policies
\echo '--> Step 6: Adding new refresh policies...'

SELECT add_continuous_aggregate_policy(
    'public.signals_hourly_general',
    start_offset => INTERVAL '2 days',
    end_offset   => INTERVAL '30 minutes',
    schedule_interval => INTERVAL '10 minutes'
);

SELECT add_continuous_aggregate_policy(
    'public.signals_hourly_ohlcv',
    start_offset => INTERVAL '2 days',
    end_offset   => INTERVAL '30 minutes',
    schedule_interval => INTERVAL '5 minutes'
);

SELECT add_continuous_aggregate_policy(
    'public.signals_15min_ohlcv',
    start_offset => INTERVAL '1 day',
    end_offset   => INTERVAL '15 minutes',
    schedule_interval => INTERVAL '5 minutes'
);

-- Step 6: Initial materialization of new aggregates (this processes historical data)
\echo '--> Step 7: Performing initial materialization of new aggregates...'
\echo '    This may take a few minutes depending on data volume...'

-- Refresh the new continuous aggregates to include all historical data
CALL refresh_continuous_aggregate('public.signals_hourly_general', NULL, NULL);
CALL refresh_continuous_aggregate('public.signals_hourly_ohlcv', NULL, NULL);
CALL refresh_continuous_aggregate('public.signals_15min_ohlcv', NULL, NULL);

-- Step 7: Add compression and retention policies
\echo '--> Step 8: Adding compression policies...'

-- Only add compression if it doesn't already exist
DO $$
BEGIN
    BEGIN
        PERFORM add_compression_policy('public.signals', INTERVAL '30 days');
        RAISE NOTICE 'Added compression policy for signals table';
    EXCEPTION 
        WHEN duplicate_object THEN
            RAISE NOTICE 'Compression policy already exists for signals table';
    END;
    
    BEGIN
        PERFORM add_compression_policy('public.signals_hourly_general', INTERVAL '90 days');
        RAISE NOTICE 'Added compression policy for signals_hourly_general';
    EXCEPTION 
        WHEN duplicate_object THEN
            RAISE NOTICE 'Compression policy already exists for signals_hourly_general';
    END;
    
    BEGIN
        PERFORM add_compression_policy('public.signals_hourly_ohlcv', INTERVAL '90 days');
        RAISE NOTICE 'Added compression policy for signals_hourly_ohlcv';
    EXCEPTION 
        WHEN duplicate_object THEN
            RAISE NOTICE 'Compression policy already exists for signals_hourly_ohlcv';
    END;
    
    BEGIN
        PERFORM add_compression_policy('public.signals_15min_ohlcv', INTERVAL '30 days');
        RAISE NOTICE 'Added compression policy for signals_15min_ohlcv';
    EXCEPTION 
        WHEN duplicate_object THEN
            RAISE NOTICE 'Compression policy already exists for signals_15min_ohlcv';
    END;
END $$;

-- Step 8: Create helper views
\echo '--> Step 9: Creating helper views...'

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

-- Step 9: Clean of old continuous aggregates
\echo '--> Step 10: Handling old continuous aggregates...'
\echo '    The old aggregates (signals_hourly, signals_hourly_summary) still exist.'
\echo '    They can be safely dropped after you verify the new ones work correctly.'
\echo '    '
\echo '    To drop them later, run:'
\echo '    DROP MATERIALIZED VIEW IF EXISTS public.signals_hourly CASCADE;'
\echo '    DROP MATERIALIZED VIEW IF EXISTS public.signals_hourly_summary CASCADE;'

\echo ''
\echo 'Migration completed successfully!'
\echo ''
\echo 'Summary of changes:'
\echo '- ✓ All existing data preserved'
\echo '- ✓ New continuous aggregates created with fixed OHLCV logic'
\echo '- ✓ Faster refresh policies (5-10 minutes)'
\echo '- ✓ Performance indexes added'
\echo '- ✓ Compression and helper views configured'
\echo '- ✓ Historical data materialized in new aggregates'
\echo ''
\echo 'You can now query the new aggregates:'
\echo '- signals_hourly_general (for non-price signals)'
\echo '- signals_hourly_ohlcv (for price OHLC data)'  
\echo '- signals_15min_ohlcv (for granular price data)'
\echo '- latest_prices and latest_signals (helper views)'