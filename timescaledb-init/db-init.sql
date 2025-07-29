-- ====================================================================
-- Full schema, CAGG setup
-- ====================================================================
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- ========================
-- Create core tables
-- ========================

-- Assets lookup
CREATE TABLE IF NOT EXISTS public.assets (
    symbol        VARCHAR(20) PRIMARY KEY,
    name          VARCHAR(100) NOT NULL,
    category      VARCHAR(20) NOT NULL DEFAULT 'crypto',
    is_active     BOOLEAN DEFAULT true,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Raw market data
CREATE TABLE IF NOT EXISTS public.market_data (
    time          TIMESTAMPTZ NOT NULL,
    asset_symbol  VARCHAR(20) NOT NULL,
    "type"       VARCHAR(20) NOT NULL,
    value         DECIMAL(20,8) NOT NULL,
    source        VARCHAR(50) NOT NULL,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Standalone indicators
CREATE TABLE IF NOT EXISTS public.market_indicators (
    time          TIMESTAMPTZ NOT NULL,
    name          VARCHAR(100) NOT NULL,
    value         DECIMAL(20,8),
    source        VARCHAR(50) NOT NULL,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.news_articles (
  id SERIAL PRIMARY KEY,
  external_id TEXT UNIQUE, 
  source TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT UNIQUE NOT NULL,
  published_at TIMESTAMPTZ NOT NULL,
  body TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.news_sentiment (
  article_id INTEGER REFERENCES news_articles(id),
  time TIMESTAMPTZ NOT NULL,
  sentiment_score NUMERIC,
  sentiment_label TEXT,
  source TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (article_id, time)
);



-- Convert to hypertables
DO $$
BEGIN
    -- Check if already a hypertable before creating
    IF NOT EXISTS (
        SELECT 1 FROM timescaledb_information.hypertables 
        WHERE hypertable_name = 'news_sentiment' AND hypertable_schema = 'public'
    ) THEN
        PERFORM create_hypertable('public.news_sentiment', 'time');
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM timescaledb_information.hypertables 
        WHERE hypertable_name = 'market_data' AND hypertable_schema = 'public'
    ) THEN
        PERFORM create_hypertable('public.market_data', 'time');
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM timescaledb_information.hypertables 
        WHERE hypertable_name = 'market_indicators' AND hypertable_schema = 'public'
    ) THEN
        PERFORM create_hypertable('public.market_indicators', 'time');
    END IF;
END
$$;

-- ========================
-- Indexes & constraints
-- ========================

-- market_data indexes
CREATE INDEX IF NOT EXISTS idx_md_asset_time
  ON public.market_data (asset_symbol, time DESC);
CREATE INDEX IF NOT EXISTS idx_md_type_time
  ON public.market_data ("type", time DESC);
CREATE INDEX IF NOT EXISTS idx_md_source
  ON public.market_data (source);

-- market_indicators indexes
CREATE INDEX IF NOT EXISTS idx_mi_name_time
  ON public.market_indicators (name, time DESC);
CREATE INDEX IF NOT EXISTS idx_mi_source
  ON public.market_indicators (source);

-- news_articles indexes
CREATE INDEX IF NOT EXISTS idx_ns_trime
  ON news_sentiment (time);


-- ========================
-- Continuous Aggregates
-- ========================

-- Drop existing views if they exist (for clean recreation)
DROP MATERIALIZED VIEW IF EXISTS public.market_data_15m CASCADE;
DROP MATERIALIZED VIEW IF EXISTS public.market_data_1h CASCADE;
DROP MATERIALIZED VIEW IF EXISTS public.market_data_1d CASCADE;

-- 15‑minute
CREATE MATERIALIZED VIEW IF NOT EXISTS public.market_data_15m
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('15 minutes', time) AS time,
  asset_symbol,
  "type",
  first(value, time) AS open,
  max(value)        AS high,
  min(value)        AS low,
  last(value, time) AS close,
  CASE WHEN "type" = 'volume' THEN last(value, time) END AS volume,
  count(*)          AS data_points
FROM public.market_data
WHERE "type" IN ('price','volume')
GROUP BY 1, asset_symbol, "type";


-- 1‑hour
CREATE MATERIALIZED VIEW IF NOT EXISTS public.market_data_1h
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 hour', time) AS time,
  asset_symbol,
  "type",
  first(value, time) AS open,
  max(value)        AS high,
  min(value)        AS low,
  last(value, time) AS close,
  CASE WHEN "type" = 'volume' THEN last(value, time) END AS volume,
  count(*)          AS data_points
FROM public.market_data
WHERE "type" IN ('price','volume')
GROUP BY 1, asset_symbol, "type";
-- 1‑day
CREATE MATERIALIZED VIEW IF NOT EXISTS public.market_data_1d
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 day', time) AS time,
  asset_symbol,
  "type",
  first(value, time) AS open,
  max(value)        AS high,
  min(value)        AS low,
  last(value, time) AS close,
  CASE WHEN "type" = 'volume' THEN last(value, time) END AS volume,
  count(*)          AS data_points
FROM public.market_data
WHERE "type" IN ('price','volume')
GROUP BY 1, asset_symbol, "type";

-- Polices to auto-refresh CGs
DO $$
BEGIN
    -- Remove existing policies if they exist
    BEGIN
        PERFORM remove_continuous_aggregate_policy('market_data_15m');
    EXCEPTION
        WHEN OTHERS THEN NULL; -- Ignore if policy doesn't exist
    END;
    
    BEGIN
        PERFORM remove_continuous_aggregate_policy('market_data_1h');
    EXCEPTION
        WHEN OTHERS THEN NULL;
    END;
    
    BEGIN
        PERFORM remove_continuous_aggregate_policy('market_data_1d');
    EXCEPTION
        WHEN OTHERS THEN NULL;
    END;
    
    -- Add new policies
    PERFORM add_continuous_aggregate_policy('market_data_15m',
      start_offset => INTERVAL '1 hour',
      end_offset   => INTERVAL '1 minute',
      schedule_interval => INTERVAL '5 minute');

    PERFORM add_continuous_aggregate_policy('market_data_1h',
      start_offset => INTERVAL '24 hours',
      end_offset   => INTERVAL '5 minutes',
      schedule_interval => INTERVAL '10 minutes');

    PERFORM add_continuous_aggregate_policy('market_data_1d',
      start_offset => INTERVAL '60 days',
      end_offset   => INTERVAL '1 hour',
      schedule_interval => INTERVAL '30 minutes');
END
$$;



-- ========================
-- Latest Indicators 
-- ========================
CREATE OR REPLACE VIEW public.latest_indicators AS
SELECT DISTINCT ON (name)
    name,
    value,
    time   AS latest_time,
    source
FROM public.market_indicators
ORDER BY
    name,
    time DESC;


-- ========================
-- API Functions
-- ========================

-- get_ohlc_data
CREATE OR REPLACE FUNCTION public.get_ohlc_data(
    p_asset_symbol character varying, 
    p_interval character varying DEFAULT '1d'::character varying, 
    p_limit integer DEFAULT 100
)
RETURNS TABLE(
    "timestamp" timestamptz, 
    open numeric, 
    high numeric, 
    low numeric, 
    close numeric, 
    volume numeric
)
LANGUAGE plpgsql
STABLE
AS $function$
BEGIN
    RETURN QUERY EXECUTE format($f$
        SELECT 
            p.time AS bucketed_at,
            p.open,
            p.high,
            p.low,
            p.close,
            v.volume
        FROM public.market_data_%s p
        LEFT JOIN public.market_data_%s v ON p.time = v.time 
            AND p.asset_symbol = v.asset_symbol 
            AND v.type = 'volume'
        WHERE p.asset_symbol = $1
            AND p.type = 'price'
            AND p.open IS NOT NULL
        ORDER BY p.time DESC
        LIMIT $2
    $f$, p_interval, p_interval)
    USING p_asset_symbol, p_limit;
END;
$function$;

-- get_assets
CREATE OR REPLACE FUNCTION get_assets(
    p_asset_symbol VARCHAR(20) DEFAULT NULL
)
RETURNS TABLE (
    symbol VARCHAR(20),
    name VARCHAR(100),
    category VARCHAR(20),
    latest_price DECIMAL(20,8),
    latest_price_time TIMESTAMPTZ,
    is_active BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        a.symbol,
        a.name,
        a.category,
        md.value AS latest_price,
        md.time AS latest_price_time,
        a.is_active
    FROM public.assets a
    LEFT JOIN LATERAL (
        SELECT value, time
        FROM public.market_data
        WHERE asset_symbol = a.symbol AND type = 'price'
        ORDER BY time DESC
        LIMIT 1
    ) md ON true
    WHERE a.is_active = true
        AND (p_asset_symbol IS NULL OR a.symbol = p_asset_symbol)
    ORDER BY a.symbol;
END;
$$ LANGUAGE plpgsql;

-- get_latest_indicators
CREATE OR REPLACE FUNCTION get_latest_indicators(p_indicator_name VARCHAR(100) DEFAULT NULL)
RETURNS TABLE (
    name VARCHAR(100),
    value DECIMAL(20,8),
    "timestamp" TIMESTAMPTZ,
    source VARCHAR(50)
) AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT ON (mi.name)
        mi.name,
        mi.value,
        mi.time as "timestamp", 
        mi.source
    FROM public.market_indicators mi
    WHERE (p_indicator_name IS NULL OR mi.name = p_indicator_name)
    ORDER BY mi.name, mi.time DESC;
END;
$$ LANGUAGE plpgsql;

