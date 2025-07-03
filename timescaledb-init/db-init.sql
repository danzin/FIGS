-- ====================================================================
--  FIGS Database Initialization Script v3.1
--  Improved version with better data handling and performance
-- ====================================================================

\echo 'Beginning database initialization...'

-- Step 1: Create Extensions
\echo '--> Step 1: Creating extensions...'
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Step 2: Core Tables
\echo '--> Step 2: Creating core tables (assets, market_data, market_indicators)...'

-- The `assets` table stores metadata about each trackable asset.
CREATE TABLE IF NOT EXISTS public.assets (
    id SERIAL PRIMARY KEY,
    symbol TEXT NOT NULL UNIQUE,          -- e.g., 'bitcoin', 'ethereum', 'spy'
    name TEXT NOT NULL,                   -- e.g., 'Bitcoin', 'Ethereum', 'SPDR S&P 500 ETF'
    category TEXT DEFAULT 'crypto',       -- 'crypto', 'stock', 'commodity', 'index'
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- The `market_data` table stores time-series data related to specific assets (price and volume).
CREATE TABLE IF NOT EXISTS public.market_data (
    time TIMESTAMPTZ NOT NULL,
    asset_symbol TEXT NOT NULL REFERENCES public.assets(symbol) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('price', 'volume')),
    value DOUBLE PRECISION NOT NULL,
    source TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Add unique constraint to prevent duplicate entries
    CONSTRAINT unique_market_data_entry UNIQUE (time, asset_symbol, type, source)
);
SELECT create_hypertable('public.market_data', 'time', if_not_exists => TRUE);

-- The `market_indicators` table stores general, non-asset-specific time-series data.
-- FIXED: Removed UNIQUE constraint on name to allow historical data
CREATE TABLE IF NOT EXISTS public.market_indicators (
    time TIMESTAMPTZ NOT NULL,
    name TEXT NOT NULL,                   -- e.g., 'fear_greed_index', 'vix_level', 'btc_dominance'
    value DOUBLE PRECISION NOT NULL,
    source TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Add unique constraint to prevent duplicate entries
    CONSTRAINT unique_market_indicator_entry UNIQUE (time, name, source)
);
SELECT create_hypertable('public.market_indicators', 'time', if_not_exists => TRUE);

-- Step 3: Indexes for Performance
\echo '--> Step 3: Creating performance indexes...'
CREATE INDEX IF NOT EXISTS idx_market_data_asset_time ON public.market_data (asset_symbol, time DESC);
CREATE INDEX IF NOT EXISTS idx_market_data_asset_type_time ON public.market_data (asset_symbol, type, time DESC);
CREATE INDEX IF NOT EXISTS idx_market_data_source ON public.market_data (source);
CREATE INDEX IF NOT EXISTS idx_market_indicators_name_time ON public.market_indicators (name, time DESC);
CREATE INDEX IF NOT EXISTS idx_market_indicators_source ON public.market_indicators (source);

-- Step 4: Continuous Aggregates for OHLCV Data
\echo '--> Step 4: Creating OHLCV continuous aggregates...'

-- IMPROVED: Better handling of multiple data points in same bucket
-- Use last() for more recent data, improved volume prioritization
CREATE MATERIALIZED VIEW IF NOT EXISTS public.market_data_15m WITH (timescaledb.continuous) AS
SELECT
    time_bucket('15 minutes', time) AS bucket, 
    asset_symbol,
    array_agg(DISTINCT source) AS sources,
    
    -- OHLC using first/last for better accuracy
    first(value, time) FILTER (WHERE type = 'price') AS open,
    max(value) FILTER (WHERE type = 'price') AS high,
    min(value) FILTER (WHERE type = 'price') AS low,
    last(value, time) FILTER (WHERE type = 'price') AS close,
    
    -- IMPROVED: Volume prioritization with fallback to latest
    COALESCE(
        last(value, time) FILTER (WHERE type = 'volume' AND source = 'CoinGecko'),
        last(value, time) FILTER (WHERE type = 'volume' AND source = 'Kraken'),
        last(value, time) FILTER (WHERE type = 'volume')
    ) AS volume
FROM public.market_data 
GROUP BY bucket, asset_symbol;

CREATE MATERIALIZED VIEW IF NOT EXISTS public.market_data_1h WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 hour', time) AS bucket, 
    asset_symbol,
    array_agg(DISTINCT source) AS sources,
    
    first(value, time) FILTER (WHERE type = 'price') AS open,
    max(value) FILTER (WHERE type = 'price') AS high,
    min(value) FILTER (WHERE type = 'price') AS low,
    last(value, time) FILTER (WHERE type = 'price') AS close,
    
    COALESCE(
        last(value, time) FILTER (WHERE type = 'volume' AND source = 'CoinGecko'),
        last(value, time) FILTER (WHERE type = 'volume' AND source = 'Kraken'),
        last(value, time) FILTER (WHERE type = 'volume')
    ) AS volume
FROM public.market_data 
GROUP BY bucket, asset_symbol;

CREATE MATERIALIZED VIEW IF NOT EXISTS public.market_data_1d WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 day', time) AS bucket, 
    asset_symbol,
    array_agg(DISTINCT source) AS sources,
    
    first(value, time) FILTER (WHERE type = 'price') AS open,
    max(value) FILTER (WHERE type = 'price') AS high,
    min(value) FILTER (WHERE type = 'price') AS low,
    last(value, time) FILTER (WHERE type = 'price') AS close,
    
    COALESCE(
        last(value, time) FILTER (WHERE type = 'volume' AND source = 'CoinGecko'),
        last(value, time) FILTER (WHERE type = 'volume' AND source = 'Kraken'),
        last(value, time) FILTER (WHERE type = 'volume')
    ) AS volume
FROM public.market_data 
GROUP BY bucket, asset_symbol;

-- Indexes for aggregates
CREATE INDEX IF NOT EXISTS idx_market_data_15m_asset_bucket ON public.market_data_15m (asset_symbol, bucket DESC);
CREATE INDEX IF NOT EXISTS idx_market_data_1h_asset_bucket ON public.market_data_1h (asset_symbol, bucket DESC);
CREATE INDEX IF NOT EXISTS idx_market_data_1d_asset_bucket ON public.market_data_1d (asset_symbol, bucket DESC);

-- Step 5: Add Refresh Policies
\echo '--> Step 5: Adding refresh policies...'
SELECT add_continuous_aggregate_policy('market_data_15m', 
    start_offset => INTERVAL '1 day', 
    end_offset => INTERVAL '15 minutes', 
    schedule_interval => INTERVAL '5 minutes');
    
SELECT add_continuous_aggregate_policy('market_data_1h', 
    start_offset => INTERVAL '7 days', 
    end_offset => INTERVAL '1 hour', 
    schedule_interval => INTERVAL '15 minutes');
    
SELECT add_continuous_aggregate_policy('market_data_1d', 
    start_offset => INTERVAL '30 days', 
    end_offset => INTERVAL '4 hours', 
    schedule_interval => INTERVAL '1 hour');

-- Step 6: Create API Helper Functions
\echo '--> Step 6: Creating API helper functions...'

-- IMPROVED: Better error handling and validation
CREATE OR REPLACE FUNCTION get_ohlc_data(
    p_asset_symbol TEXT, 
    p_interval TEXT, 
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
    view_name TEXT;
BEGIN
    -- Validate inputs
    IF p_limit <= 0 OR p_limit > 10000 THEN
        RAISE EXCEPTION 'Limit must be between 1 and 10000. Got: %', p_limit;
    END IF;
    
    -- Check if asset exists
    IF NOT EXISTS (SELECT 1 FROM public.assets WHERE symbol = p_asset_symbol AND is_active = true) THEN
        RAISE EXCEPTION 'Asset not found or inactive: %', p_asset_symbol;
    END IF;
    
    SELECT
        CASE
            WHEN p_interval = '15m' THEN 'market_data_15m'
            WHEN p_interval = '1h'  THEN 'market_data_1h'
            WHEN p_interval = '1d'  THEN 'market_data_1d'
            ELSE NULL
        END
    INTO view_name;

    IF view_name IS NULL THEN
        RAISE EXCEPTION 'Invalid interval. Supported: 15m, 1h, 1d. Got: %', p_interval;
    END IF;

    RETURN QUERY EXECUTE format(
        'SELECT s.bucket, s.open, s.high, s.low, s.close, s.volume
         FROM public.%I s
         WHERE s.asset_symbol = $1 AND s.open IS NOT NULL
         ORDER BY s.bucket DESC
         LIMIT $2;',
        view_name
    )
    USING p_asset_symbol, p_limit;
END;
$$ LANGUAGE plpgsql;

-- IMPROVED: Get latest indicators with optional filtering
CREATE OR REPLACE FUNCTION get_latest_indicators(p_indicator_name TEXT DEFAULT NULL)
RETURNS TABLE (
    "name" TEXT, 
    "time" TIMESTAMPTZ, 
    "value" DOUBLE PRECISION, 
    "source" TEXT
) AS $$
BEGIN
    IF p_indicator_name IS NULL THEN
        RETURN QUERY
        SELECT DISTINCT ON (mi.name) mi.name, mi.time, mi.value, mi.source
        FROM public.market_indicators mi
        ORDER BY mi.name, mi.time DESC;
    ELSE
        RETURN QUERY
        SELECT mi.name, mi.time, mi.value, mi.source
        FROM public.market_indicators mi
        WHERE mi.name = p_indicator_name
        ORDER BY mi.time DESC
        LIMIT 1;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- IMPROVED: Get assets with latest price info
CREATE OR REPLACE FUNCTION get_assets()
RETURNS TABLE (
    "symbol" TEXT, 
    "name" TEXT, 
    "category" TEXT,
    "latest_price" DOUBLE PRECISION,
    "latest_price_time" TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY 
    SELECT 
        a.symbol, 
        a.name, 
        a.category,
        latest_data.price,
        latest_data.time
    FROM public.assets a
    LEFT JOIN LATERAL (
        SELECT md.value AS price, md.time
        FROM public.market_data md
        WHERE md.asset_symbol = a.symbol AND md.type = 'price'
        ORDER BY md.time DESC
        LIMIT 1
    ) latest_data ON true
    WHERE a.is_active = true 
    ORDER BY a.name;
END;
$$ LANGUAGE plpgsql;

-- IMPROVED: Helper functions for data insertion with conflict handling
CREATE OR REPLACE FUNCTION insert_market_data(
    p_time TIMESTAMPTZ,
    p_asset_symbol TEXT,
    p_price DOUBLE PRECISION,
    p_volume DOUBLE PRECISION DEFAULT NULL,
    p_source TEXT DEFAULT 'unknown'
)
RETURNS VOID AS $$
BEGIN
    -- Insert price data
    INSERT INTO public.market_data (time, asset_symbol, type, value, source)
    VALUES (p_time, p_asset_symbol, 'price', p_price, p_source)
    ON CONFLICT (time, asset_symbol, type, source) DO UPDATE SET
        value = EXCLUDED.value,
        created_at = NOW();
    
    -- Insert volume data if provided
    IF p_volume IS NOT NULL THEN
        INSERT INTO public.market_data (time, asset_symbol, type, value, source)
        VALUES (p_time, p_asset_symbol, 'volume', p_volume, p_source)
        ON CONFLICT (time, asset_symbol, type, source) DO UPDATE SET
            value = EXCLUDED.value,
            created_at = NOW();
    END IF;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION insert_market_indicator(
    p_time TIMESTAMPTZ,
    p_name TEXT,
    p_value DOUBLE PRECISION,
    p_source TEXT DEFAULT 'unknown'
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO public.market_indicators (time, name, value, source)
    VALUES (p_time, p_name, p_value, p_source)
    ON CONFLICT (time, name, source) DO UPDATE SET
        value = EXCLUDED.value,
        created_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Step 7: Insert Sample Data
\echo '--> Step 7: Inserting sample assets...'
INSERT INTO public.assets (symbol, name, category) VALUES
    ('bitcoin', 'Bitcoin', 'crypto'), 
    ('ethereum', 'Ethereum', 'crypto'),
    ('solana', 'Solana', 'crypto'), 
    ('render', 'Render Token', 'crypto'),
    ('spy', 'SPDR S&P 500 ETF', 'index'),
    ('brent_crude_oil', 'Brent Crude Oil', 'commodity'),
    ('vix', 'CBOE Volatility Index', 'index')
ON CONFLICT (symbol) DO NOTHING;

-- Step 8: Create useful views for debugging
\echo '--> Step 8: Creating debug views...'

-- View to see latest data for each asset
CREATE OR REPLACE VIEW latest_asset_data AS
SELECT DISTINCT ON (asset_symbol, type)
    asset_symbol,
    type,
    value,
    time,
    source
FROM public.market_data
ORDER BY asset_symbol, type, time DESC;

-- View to see data quality metrics
CREATE OR REPLACE VIEW data_quality_metrics AS
SELECT 
    asset_symbol,
    type,
    COUNT(*) as total_records,
    COUNT(DISTINCT source) as source_count,
    MIN(time) as earliest_data,
    MAX(time) as latest_data,
    array_agg(DISTINCT source) as sources
FROM public.market_data
GROUP BY asset_symbol, type;

\echo 'Database initialization completed successfully!'
\echo 'You can now use:'
\echo '  - get_ohlc_data(asset, interval, limit)'
\echo '  - get_assets()'
\echo '  - get_latest_indicators(name)'
\echo '  - insert_market_data(time, asset, price, volume, source)'
\echo '  - insert_market_indicator(time, name, value, source)'