INSERT INTO market_data (time, asset_symbol, type, value, source, created_at)
SELECT
    s.time,
    CASE
        WHEN s.name LIKE 'bitcoin%' THEN 'bitcoin'
        WHEN s.name LIKE 'ethereum%' THEN 'ethereum'
        WHEN s.name LIKE 'solana%' THEN 'solana'
    END AS asset_symbol,
    CASE
        WHEN s.name LIKE '%price' THEN 'price'
        WHEN s.name LIKE '%volume' THEN 'volume'
    END AS type,
    s.value,
    s.source,
    NOW() AS created_at
FROM signals s
WHERE s.name IN (
    'bitcoin_price', 'bitcoin_volume',
    'ethereum_price', 'ethereum_volume',
    'solana_price', 'solana_volume'
);