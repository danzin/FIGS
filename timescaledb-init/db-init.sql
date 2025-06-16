
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
    chunk_time_interval => INTERVAL '5 days' 
);


-- Indexes on the raw data table
\echo '--> Step 3: Creating indexes on raw signals table...'
CREATE INDEX IF NOT EXISTS idx_signals_name_time_desc ON public.signals (name, time DESC);
CREATE INDEX IF NOT EXISTS idx_signals_time_desc ON public.signals (time DESC);
CREATE INDEX IF NOT EXISTS idx_signals_source ON public.signals(source);


-- Create the Hourly Continuous Aggregate for general stats
\echo '--> Step 4: Creating hourly continuous aggregate (public.signals_hourly)...'
CREATE MATERIALIZED VIEW IF NOT EXISTS public.signals_hourly
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 hour', "time") AS bucketed_at,
    name,
    source,
    avg(value) AS avg_value,
    min(value) AS min_value,
    max(value) AS max_value,
    count(*) AS sample_count
FROM
    public.signals
GROUP BY
    bucketed_at, name, source
WITH NO DATA;


--Create the Hourly Continuous Aggregate for OHLCV summaries
\echo '--> Step 5: Creating hourly OHLCV summary continuous aggregate (public.signals_hourly_summary)...'
CREATE MATERIALIZED VIEW IF NOT EXISTS public.signals_hourly_summary
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 hour', "time") AS bucketed_at,
    regexp_replace(name, '_price$', '') AS base_name,
    first(value, "time") FILTER (WHERE name ~~ '%_price') AS open_price,
    max(value) FILTER (WHERE name ~~ '%_price') AS high_price,
    min(value) FILTER (WHERE name ~~ '%_price') AS low_price,
    last(value, "time") FILTER (WHERE name ~~ '%_price') AS close_price,
    sum(value) FILTER (WHERE name ~~ '%_volume') AS total_volume
FROM
    public.signals
WHERE
    (name ~~ '%_price' OR name ~~ '%_volume')
GROUP BY
    bucketed_at, base_name
WITH NO DATA;


-- Add refresh policies for both continuous aggregates
\echo '--> Step 6: Adding refresh policies...'
 -- Policy for signals_hourly
SELECT add_continuous_aggregate_policy(
    'public.signals_hourly',
    start_offset => INTERVAL '3 days',
    end_offset   => INTERVAL '1 hour',
    schedule_interval => INTERVAL '30 minutes'
);

 -- Policy for signals_hourly_summary
SELECT add_continuous_aggregate_policy(
    'public.signals_hourly_summary',
    start_offset => INTERVAL '3 days',
    end_offset   => INTERVAL '1 hour',
    schedule_interval => INTERVAL '30 minutes'
);


\echo 'Database initialization script completed successfully.'