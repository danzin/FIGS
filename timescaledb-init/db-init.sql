\echo 'Beginning database initialization...'

-- Step 1: Ensure required extensions are available
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Step 2: Create the raw signals hypertable
\echo 'Creating raw signals hypertable...'
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
    chunk_time_interval => INTERVAL '5 days'
);

-- Step 3: Create indexes on the raw data table
\echo 'Creating indexes on raw signals table...'
CREATE INDEX IF NOT EXISTS idx_signals_name_time_desc ON public.signals (name, time DESC);
CREATE INDEX IF NOT EXISTS idx_signals_time_desc ON public.signals (time DESC);
CREATE INDEX IF NOT EXISTS idx_signals_source ON public.signals(source);


-- Step 4: Create the Hourly Continuous Aggregate (CAGG)
-- This creates the materialized view that pre-calculates hourly rollups.
\echo 'Creating hourly continuous aggregate view (signals_hourly)...'
CREATE MATERIALIZED VIEW IF NOT EXISTS public.signals_hourly
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 hour', "time") AS bucketed_at,
    name,
    source,
    AVG(value) AS avg_value,
    MIN(value) AS min_value,
    MAX(value) AS max_value,
    COUNT(*) AS sample_count
FROM
    public.signals
GROUP BY
    bucketed_at, name, source
WITH NO DATA; -- The policy will handle population.

-- Add a policy to automatically refresh the continuous aggregate
\echo 'Adding refresh policy for signals_hourly...'
SELECT add_continuous_aggregate_policy(
    'public.signals_hourly',
    start_offset => INTERVAL '3 days',   
    end_offset   => INTERVAL '1 hour',     
    schedule_interval => INTERVAL '5 minutes' 
);


-- Add signals_hourly_summary view

\echo 'Creating hourly summary view (signals_hourly_summary)...'
CREATE OR REPLACE VIEW public.signals_hourly_summary AS
   SELECT bucketed_at,
    base_name,
    open_price,
    high_price,
    low_price,
    close_price,
    total_volume
   FROM _timescaledb_internal._materialized_hypertable_3;



\echo 'Database initialization script completed successfully.'