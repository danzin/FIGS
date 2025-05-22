      

CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Create the 'signals' table
CREATE TABLE IF NOT EXISTS public.signals (
    time TIMESTAMPTZ NOT NULL,
    name TEXT NOT NULL,
    value DOUBLE PRECISION NOT NULL,
    source TEXT NOT NULL,
    CONSTRAINT pk_signals PRIMARY KEY (name, time)
);

-- Convert the 'signals' table to a hypertable
-- The if_not_exists => TRUE makes this idempotent.
SELECT create_hypertable(
    'public.signals',
    'time',
    if_not_exists => TRUE,
    chunk_time_interval => INTERVAL '5 days' 
);

-- Create Indexes
CREATE INDEX IF NOT EXISTS idx_signals_name_time_desc ON public.signals (name, time DESC);
CREATE INDEX IF NOT EXISTS idx_signals_time_desc ON public.signals (time DESC);
CREATE INDEX IF NOT EXISTS idx_signals_source ON public.signals(source)
\echo 'Database initialization script completed successfully.'

    