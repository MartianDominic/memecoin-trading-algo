-- ============================================================================
-- DATABASE INITIALIZATION SCRIPT
-- ============================================================================
-- This script initializes the PostgreSQL database for the memecoin trading system
-- It creates the main database, user, and basic configuration

-- Create the main database if it doesn't exist
SELECT 'CREATE DATABASE memecoin_trading'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'memecoin_trading')\gexec

-- Create test database for development
SELECT 'CREATE DATABASE memecoin_trading_test'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'memecoin_trading_test')\gexec

-- Connect to the main database
\c memecoin_trading;

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Create application-specific user (optional, for enhanced security)
DO
$do$
BEGIN
   IF NOT EXISTS (
      SELECT FROM pg_catalog.pg_roles
      WHERE  rolname = 'memecoin_app') THEN

      CREATE ROLE memecoin_app LOGIN PASSWORD 'memecoin_app_password';
   END IF;
END
$do$;

-- Grant necessary permissions
GRANT CONNECT ON DATABASE memecoin_trading TO memecoin_app;
GRANT USAGE ON SCHEMA public TO memecoin_app;
GRANT CREATE ON SCHEMA public TO memecoin_app;

-- Create enum types that will be used by Prisma
DO $$ BEGIN
    CREATE TYPE "RiskLevel" AS ENUM ('VERY_LOW', 'LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "SignalType" AS ENUM ('MOMENTUM', 'REVERSAL', 'BREAKOUT', 'VOLUME_SPIKE', 'SAFETY_ALERT', 'FUNDAMENTAL');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "TradeAction" AS ENUM ('BUY', 'SELL', 'HOLD');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "TradeStatus" AS ENUM ('PENDING', 'EXECUTING', 'EXECUTED', 'CANCELLED', 'FAILED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create performance monitoring table
CREATE TABLE IF NOT EXISTS database_performance (
    id SERIAL PRIMARY KEY,
    query_type VARCHAR(50),
    execution_time_ms INTEGER,
    rows_affected INTEGER,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for performance monitoring
CREATE INDEX IF NOT EXISTS idx_db_performance_timestamp ON database_performance(timestamp);
CREATE INDEX IF NOT EXISTS idx_db_performance_query_type ON database_performance(query_type);

-- Insert initial system configuration
INSERT INTO system_config (key, value, description, category)
VALUES
    ('system_version', '1.0.0', 'Current system version', 'system'),
    ('api_rate_limit', '100', 'API requests per minute limit', 'api'),
    ('max_tokens_tracked', '10000', 'Maximum number of tokens to track simultaneously', 'tokens'),
    ('safety_check_interval', '300', 'Safety check interval in seconds', 'safety'),
    ('price_update_interval', '30', 'Price update interval in seconds', 'pricing')
ON CONFLICT (key) DO NOTHING;

-- Create stored procedures for common operations
CREATE OR REPLACE FUNCTION update_token_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create function to clean old data
CREATE OR REPLACE FUNCTION cleanup_old_data(days_to_keep INTEGER DEFAULT 30)
RETURNS void AS $$
BEGIN
    -- Clean old price data (keep last 30 days)
    DELETE FROM price_data
    WHERE timestamp < CURRENT_TIMESTAMP - INTERVAL '1 day' * days_to_keep;

    -- Clean old API usage data
    DELETE FROM api_usage
    WHERE timestamp < CURRENT_TIMESTAMP - INTERVAL '1 day' * days_to_keep;

    -- Clean old performance data
    DELETE FROM database_performance
    WHERE timestamp < CURRENT_TIMESTAMP - INTERVAL '1 day' * days_to_keep;

    RAISE NOTICE 'Cleaned data older than % days', days_to_keep;
END;
$$ LANGUAGE plpgsql;

-- Create function to get token statistics
CREATE OR REPLACE FUNCTION get_token_stats()
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'total_tokens', (SELECT COUNT(*) FROM tokens),
        'active_tokens', (SELECT COUNT(*) FROM tokens WHERE updated_at > CURRENT_TIMESTAMP - INTERVAL '1 hour'),
        'total_price_records', (SELECT COUNT(*) FROM price_data),
        'total_trades', (SELECT COUNT(*) FROM trades),
        'successful_trades', (SELECT COUNT(*) FROM trades WHERE status = 'EXECUTED'),
        'last_update', CURRENT_TIMESTAMP
    ) INTO result;

    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions to application user
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO memecoin_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO memecoin_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO memecoin_app;

-- Set default permissions for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO memecoin_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO memecoin_app;

-- Create backup role (optional)
DO
$do$
BEGIN
   IF NOT EXISTS (
      SELECT FROM pg_catalog.pg_roles
      WHERE  rolname = 'memecoin_backup') THEN

      CREATE ROLE memecoin_backup;
   END IF;
END
$do$;

GRANT CONNECT ON DATABASE memecoin_trading TO memecoin_backup;
GRANT USAGE ON SCHEMA public TO memecoin_backup;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO memecoin_backup;

-- Display initialization summary
DO $$
BEGIN
    RAISE NOTICE 'Database initialization completed successfully!';
    RAISE NOTICE 'Main database: memecoin_trading';
    RAISE NOTICE 'Test database: memecoin_trading_test';
    RAISE NOTICE 'Application user: memecoin_app';
    RAISE NOTICE 'Extensions enabled: uuid-ossp, pg_trgm, btree_gin, pg_stat_statements';
    RAISE NOTICE 'Run "npm run db:migrate" to create the full schema';
END $$;