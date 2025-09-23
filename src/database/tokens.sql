-- tokens.sql - Main tokens table with basic information
-- This table stores fundamental token metadata and tracking information

CREATE TABLE IF NOT EXISTS tokens (
    address VARCHAR(44) PRIMARY KEY,  -- Solana address is base58 encoded, max 44 chars
    symbol VARCHAR(20) NOT NULL,
    name VARCHAR(100) NOT NULL,
    decimals INTEGER DEFAULT 9,
    supply DECIMAL(20,0),  -- Total supply can be very large
    market_cap DECIMAL(20,2),
    price_usd DECIMAL(20,8),  -- Price with high precision
    volume_24h DECIMAL(20,2),
    
    -- Token metadata
    description TEXT,
    image_url TEXT,
    website_url TEXT,
    twitter_url TEXT,
    telegram_url TEXT,
    
    -- Discovery and tracking
    first_detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Status flags
    is_active BOOLEAN DEFAULT true,
    is_verified BOOLEAN DEFAULT false,
    is_scam BOOLEAN DEFAULT false,
    is_honeypot BOOLEAN DEFAULT false,
    
    -- Market data timestamps
    price_last_updated TIMESTAMP,
    volume_last_updated TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_tokens_symbol ON tokens(symbol);
CREATE INDEX IF NOT EXISTS idx_tokens_name ON tokens(name);
CREATE INDEX IF NOT EXISTS idx_tokens_created_at ON tokens(created_at);
CREATE INDEX IF NOT EXISTS idx_tokens_market_cap ON tokens(market_cap);
CREATE INDEX IF NOT EXISTS idx_tokens_volume_24h ON tokens(volume_24h);
CREATE INDEX IF NOT EXISTS idx_tokens_active ON tokens(is_active);
CREATE INDEX IF NOT EXISTS idx_tokens_last_updated ON tokens(last_updated_at);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_tokens_active_market_cap ON tokens(is_active, market_cap DESC);
CREATE INDEX IF NOT EXISTS idx_tokens_active_volume ON tokens(is_active, volume_24h DESC);
CREATE INDEX IF NOT EXISTS idx_tokens_detection_time ON tokens(first_detected_at DESC, is_active);

-- Update trigger for last_updated_at
CREATE OR REPLACE FUNCTION update_tokens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_tokens_updated_at
    BEFORE UPDATE ON tokens
    FOR EACH ROW
    EXECUTE FUNCTION update_tokens_updated_at();
