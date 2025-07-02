CREATE OR REPLACE FUNCTION get_ohlc_data(
    p_asset TEXT,
    p_source TEXT DEFAULT NULL,
    p_interval TEXT DEFAULT '1h',
    p_limit INTEGER DEFAULT 1000
)
RETURNS TABLE (
    time   TIMESTAMPTZ,       
    open   DOUBLE PRECISION,
    high   DOUBLE PRECISION,
    low    DOUBLE PRECISION,
    close  DOUBLE PRECISION,
    volume DOUBLE PRECISION
) AS $$
DECLARE
  table_name TEXT;
  query      TEXT;
BEGIN


  query := format(
    'SELECT
       s.bucketed_at   AS timestamp,      
       s.open_price    AS open,
       s.high_price    AS high,
       s.low_price     AS low,
       s.close_price   AS close,
       s.volume        AS volume
     FROM %I s
     WHERE s.asset = $1
       AND s.open_price IS NOT NULL
       AND ($2 IS NULL OR s.source = $2)
     ORDER BY s.bucketed_at ASC    -- flip to ASC
     LIMIT $3;',
    table_name
  );

  RETURN QUERY EXECUTE query
  USING p_asset, p_source, p_limit;
END;
$$ LANGUAGE plpgsql;
