#!/bin/bash
set -e

# This script runs during PostgreSQL initialization
# It ensures the TimescaleDB extension and schema are properly set up

echo "=== Initializing market_signals database schema ==="

# Enable TimescaleDB extension
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    CREATE EXTENSION IF NOT EXISTS timescaledb;
EOSQL

# Run the main schema file
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f /docker-entrypoint-initdb.d/02-schema.sql

# Run macro event pipeline schema
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f /docker-entrypoint-initdb.d/03-macro-schema.sql

echo "=== Database initialization complete ==="
