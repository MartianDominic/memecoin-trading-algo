-- 001_initial_schema.sql - Initial database schema migration
-- This migration creates all tables, indexes, and relationships for the memecoin trading system

-- Enable required PostgreSQL extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Begin transaction
BEGIN;

-- ============================================================================
-- MAIN TOKENS TABLE
-- ============================================================================

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

-- ============================================================================
-- TOKEN ANALYSIS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS token_analysis (
    id BIGSERIAL PRIMARY KEY,
    token_address VARCHAR(44) NOT NULL REFERENCES tokens(address) ON DELETE CASCADE,
    analysis_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- DEX Screener data
    dex_data JSONB,
    dex_score INTEGER CHECK (dex_score >= 0 AND dex_score <= 100),
    dex_last_updated TIMESTAMP,
    
    -- Rug Check data
    rug_data JSONB,
    rug_score INTEGER CHECK (rug_score >= 0 AND rug_score <= 100),
    rug_risk_level VARCHAR(20), -- 'low', 'medium', 'high', 'critical'
    rug_last_updated TIMESTAMP,
    
    -- Jupiter API data
    jupiter_data JSONB,
    jupiter_liquidity DECIMAL(20,2),
    jupiter_price DECIMAL(20,8),
    jupiter_last_updated TIMESTAMP,
    
    -- Solscan data
    solscan_data JSONB,
    solscan_holder_count INTEGER,
    solscan_transaction_count INTEGER,
    solscan_last_updated TIMESTAMP,
    
    -- Calculated scores
    overall_score INTEGER CHECK (overall_score >= 0 AND overall_score <= 100),
    risk_score INTEGER CHECK (risk_score >= 0 AND risk_score <= 100),
    opportunity_score INTEGER CHECK (opportunity_score >= 0 AND opportunity_score <= 100),
    
    -- Analysis flags
    analysis_complete BOOLEAN DEFAULT false,
    has_errors BOOLEAN DEFAULT false,
    error_details TEXT,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- USER FILTERS TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_filters (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    
    -- Filter criteria as JSON
    criteria_json JSONB NOT NULL,
    
    -- Filter settings
    is_active BOOLEAN DEFAULT true,
    is_public BOOLEAN DEFAULT false,
    
    -- User and sharing
    user_id VARCHAR(100), -- Could be user session ID or auth user ID
    created_by VARCHAR(100),
    
    -- Usage statistics
    usage_count INTEGER DEFAULT 0,
    last_used_at TIMESTAMP,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure valid JSON structure
    CONSTRAINT valid_criteria_json CHECK (jsonb_typeof(criteria_json) = 'object')
);

CREATE TABLE IF NOT EXISTS filter_templates (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    category VARCHAR(50), -- 'safety', 'opportunity', 'technical', 'fundamental'
    template_json JSONB NOT NULL,
    
    -- Template metadata
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    icon VARCHAR(50),
    color VARCHAR(20),
    
    -- Usage tracking
    usage_count INTEGER DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT valid_template_json CHECK (jsonb_typeof(template_json) = 'object')
);

-- ============================================================================
-- ALERTS TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS alerts (
    id BIGSERIAL PRIMARY KEY,
    token_address VARCHAR(44) NOT NULL REFERENCES tokens(address) ON DELETE CASCADE,
    
    -- Alert details
    alert_type VARCHAR(50) NOT NULL, -- 'price_spike', 'volume_surge', 'rug_risk', 'new_token', 'score_change'
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    
    -- Alert data
    alert_data JSONB, -- Additional structured data for the alert
    
    -- Trigger conditions
    trigger_value DECIMAL(20,8), -- The value that triggered the alert
    threshold_value DECIMAL(20,8), -- The threshold that was crossed
    
    -- User and targeting
    user_id VARCHAR(100), -- Target user (null for system-wide alerts)
    filter_id BIGINT REFERENCES user_filters(id) ON DELETE SET NULL, -- Filter that generated this alert
    
    -- Status
    acknowledged BOOLEAN DEFAULT false,
    acknowledged_at TIMESTAMP,
    acknowledged_by VARCHAR(100),
    
    dismissed BOOLEAN DEFAULT false,
    dismissed_at TIMESTAMP,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP, -- Optional expiration for time-sensitive alerts
    
    -- Ensure valid combinations
    CONSTRAINT valid_alert_acknowledgment CHECK (
        (acknowledged = false) OR 
        (acknowledged = true AND acknowledged_at IS NOT NULL)
    )
);

CREATE TABLE IF NOT EXISTS alert_subscriptions (
    id BIGSERIAL PRIMARY KEY,
    user_id VARCHAR(100) NOT NULL,
    
    -- Subscription settings
    alert_type VARCHAR(50) NOT NULL,
    is_enabled BOOLEAN DEFAULT true,
    
    -- Delivery preferences
    delivery_method VARCHAR(20) DEFAULT 'in_app', -- 'in_app', 'email', 'webhook'
    delivery_endpoint TEXT, -- Email address or webhook URL
    
    -- Filtering
    min_severity VARCHAR(20) DEFAULT 'medium',
    
    -- Rate limiting
    max_alerts_per_hour INTEGER DEFAULT 10,
    max_alerts_per_day INTEGER DEFAULT 100,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Unique constraint per user and alert type
    UNIQUE(user_id, alert_type, delivery_method)
);

-- ============================================================================
-- CREATE ALL INDEXES
-- ============================================================================

-- Tokens table indexes
CREATE INDEX IF NOT EXISTS idx_tokens_symbol ON tokens(symbol);
CREATE INDEX IF NOT EXISTS idx_tokens_name ON tokens(name);
CREATE INDEX IF NOT EXISTS idx_tokens_created_at ON tokens(created_at);
CREATE INDEX IF NOT EXISTS idx_tokens_market_cap ON tokens(market_cap);
CREATE INDEX IF NOT EXISTS idx_tokens_volume_24h ON tokens(volume_24h);
CREATE INDEX IF NOT EXISTS idx_tokens_active ON tokens(is_active);
CREATE INDEX IF NOT EXISTS idx_tokens_last_updated ON tokens(last_updated_at);
CREATE INDEX IF NOT EXISTS idx_tokens_active_market_cap ON tokens(is_active, market_cap DESC);
CREATE INDEX IF NOT EXISTS idx_tokens_active_volume ON tokens(is_active, volume_24h DESC);
CREATE INDEX IF NOT EXISTS idx_tokens_detection_time ON tokens(first_detected_at DESC, is_active);

-- Token analysis indexes
CREATE INDEX IF NOT EXISTS idx_token_analysis_address ON token_analysis(token_address);
CREATE INDEX IF NOT EXISTS idx_token_analysis_timestamp ON token_analysis(analysis_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_token_analysis_overall_score ON token_analysis(overall_score DESC);
CREATE INDEX IF NOT EXISTS idx_token_analysis_risk_score ON token_analysis(risk_score);
CREATE INDEX IF NOT EXISTS idx_token_analysis_opportunity_score ON token_analysis(opportunity_score DESC);
CREATE INDEX IF NOT EXISTS idx_token_analysis_complete ON token_analysis(analysis_complete);
CREATE INDEX IF NOT EXISTS idx_token_analysis_latest_complete 
    ON token_analysis(token_address, analysis_timestamp DESC) 
    WHERE analysis_complete = true;
CREATE INDEX IF NOT EXISTS idx_token_analysis_high_opportunity 
    ON token_analysis(opportunity_score DESC, risk_score) 
    WHERE analysis_complete = true AND opportunity_score >= 70;
CREATE INDEX IF NOT EXISTS idx_token_analysis_low_risk 
    ON token_analysis(risk_score, overall_score DESC) 
    WHERE analysis_complete = true AND risk_score <= 30;

-- User filters indexes
CREATE INDEX IF NOT EXISTS idx_user_filters_user_id ON user_filters(user_id);
CREATE INDEX IF NOT EXISTS idx_user_filters_name ON user_filters(name);
CREATE INDEX IF NOT EXISTS idx_user_filters_active ON user_filters(is_active);
CREATE INDEX IF NOT EXISTS idx_user_filters_public ON user_filters(is_public);
CREATE INDEX IF NOT EXISTS idx_user_filters_created_at ON user_filters(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_filters_usage ON user_filters(usage_count DESC);
CREATE INDEX IF NOT EXISTS idx_user_filters_criteria_gin ON user_filters USING GIN (criteria_json);
CREATE INDEX IF NOT EXISTS idx_user_filters_user_active 
    ON user_filters(user_id, is_active, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_filters_public_popular 
    ON user_filters(is_public, usage_count DESC) 
    WHERE is_active = true;

-- Filter templates indexes
CREATE INDEX IF NOT EXISTS idx_filter_templates_category ON filter_templates(category);
CREATE INDEX IF NOT EXISTS idx_filter_templates_active ON filter_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_filter_templates_sort ON filter_templates(sort_order);
CREATE INDEX IF NOT EXISTS idx_filter_templates_usage ON filter_templates(usage_count DESC);

-- Alerts indexes
CREATE INDEX IF NOT EXISTS idx_alerts_token_address ON alerts(token_address);
CREATE INDEX IF NOT EXISTS idx_alerts_user_id ON alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_alerts_type ON alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts(severity);
CREATE INDEX IF NOT EXISTS idx_alerts_acknowledged ON alerts(acknowledged);
CREATE INDEX IF NOT EXISTS idx_alerts_dismissed ON alerts(dismissed);
CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_expires_at ON alerts(expires_at);
CREATE INDEX IF NOT EXISTS idx_alerts_user_unread 
    ON alerts(user_id, created_at DESC) 
    WHERE acknowledged = false AND dismissed = false;
CREATE INDEX IF NOT EXISTS idx_alerts_token_recent 
    ON alerts(token_address, created_at DESC) 
    WHERE acknowledged = false;
CREATE INDEX IF NOT EXISTS idx_alerts_severity_unread 
    ON alerts(severity, created_at DESC) 
    WHERE acknowledged = false AND dismissed = false;
CREATE INDEX IF NOT EXISTS idx_alerts_active 
    ON alerts(created_at DESC) 
    WHERE acknowledged = false AND dismissed = false AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS idx_alerts_data_gin ON alerts USING GIN (alert_data);

-- Alert subscriptions indexes
CREATE INDEX IF NOT EXISTS idx_alert_subscriptions_user ON alert_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_alert_subscriptions_type ON alert_subscriptions(alert_type);
CREATE INDEX IF NOT EXISTS idx_alert_subscriptions_enabled ON alert_subscriptions(is_enabled);

-- ============================================================================
-- CREATE FUNCTIONS AND TRIGGERS
-- ============================================================================

-- Update triggers for timestamps
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

CREATE OR REPLACE FUNCTION update_token_analysis_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_token_analysis_updated_at
    BEFORE UPDATE ON token_analysis
    FOR EACH ROW
    EXECUTE FUNCTION update_token_analysis_updated_at();

CREATE OR REPLACE FUNCTION update_user_filters_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_user_filters_updated_at
    BEFORE UPDATE ON user_filters
    FOR EACH ROW
    EXECUTE FUNCTION update_user_filters_updated_at();

-- Utility functions
CREATE OR REPLACE FUNCTION get_latest_token_analysis(p_token_address VARCHAR(44))
RETURNS token_analysis AS $$
DECLARE
    result token_analysis;
BEGIN
    SELECT * INTO result
    FROM token_analysis
    WHERE token_address = p_token_address
        AND analysis_complete = true
    ORDER BY analysis_timestamp DESC
    LIMIT 1;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION increment_filter_usage(p_filter_id BIGINT)
RETURNS VOID AS $$
BEGIN
    UPDATE user_filters
    SET usage_count = usage_count + 1,
        last_used_at = CURRENT_TIMESTAMP
    WHERE id = p_filter_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION create_alert(
    p_token_address VARCHAR(44),
    p_alert_type VARCHAR(50),
    p_severity VARCHAR(20),
    p_title VARCHAR(200),
    p_message TEXT,
    p_user_id VARCHAR(100) DEFAULT NULL,
    p_alert_data JSONB DEFAULT NULL,
    p_trigger_value DECIMAL(20,8) DEFAULT NULL,
    p_threshold_value DECIMAL(20,8) DEFAULT NULL,
    p_expires_hours INTEGER DEFAULT NULL
)
RETURNS BIGINT AS $$
DECLARE
    alert_id BIGINT;
    expires_at_value TIMESTAMP;
BEGIN
    -- Calculate expiration if provided
    IF p_expires_hours IS NOT NULL THEN
        expires_at_value := CURRENT_TIMESTAMP + (p_expires_hours || ' hours')::INTERVAL;
    END IF;
    
    -- Insert the alert
    INSERT INTO alerts (
        token_address, alert_type, severity, title, message,
        user_id, alert_data, trigger_value, threshold_value, expires_at
    ) VALUES (
        p_token_address, p_alert_type, p_severity, p_title, p_message,
        p_user_id, p_alert_data, p_trigger_value, p_threshold_value, expires_at_value
    )
    RETURNING id INTO alert_id;
    
    RETURN alert_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION acknowledge_alert(
    p_alert_id BIGINT,
    p_user_id VARCHAR(100)
)
RETURNS BOOLEAN AS $$
DECLARE
    update_count INTEGER;
BEGIN
    UPDATE alerts
    SET acknowledged = true,
        acknowledged_at = CURRENT_TIMESTAMP,
        acknowledged_by = p_user_id
    WHERE id = p_alert_id
        AND acknowledged = false
        AND (user_id IS NULL OR user_id = p_user_id);
    
    GET DIAGNOSTICS update_count = ROW_COUNT;
    RETURN update_count > 0;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION dismiss_alert(
    p_alert_id BIGINT,
    p_user_id VARCHAR(100)
)
RETURNS BOOLEAN AS $$
DECLARE
    update_count INTEGER;
BEGIN
    UPDATE alerts
    SET dismissed = true,
        dismissed_at = CURRENT_TIMESTAMP
    WHERE id = p_alert_id
        AND dismissed = false
        AND (user_id IS NULL OR user_id = p_user_id);
    
    GET DIAGNOSTICS update_count = ROW_COUNT;
    RETURN update_count > 0;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION cleanup_expired_alerts()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM alerts
    WHERE expires_at IS NOT NULL 
        AND expires_at < CURRENT_TIMESTAMP
        AND created_at < CURRENT_TIMESTAMP - INTERVAL '7 days'; -- Keep for at least 7 days
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- CREATE VIEWS FOR COMMON QUERIES
-- ============================================================================

-- View for latest token analysis with token details
CREATE OR REPLACE VIEW v_latest_token_analysis AS
SELECT 
    t.address,
    t.symbol,
    t.name,
    t.market_cap,
    t.volume_24h,
    t.price_usd,
    t.is_active,
    ta.overall_score,
    ta.risk_score,
    ta.opportunity_score,
    ta.rug_risk_level,
    ta.analysis_timestamp,
    ta.analysis_complete
FROM tokens t
LEFT JOIN LATERAL (
    SELECT *
    FROM token_analysis
    WHERE token_address = t.address
        AND analysis_complete = true
    ORDER BY analysis_timestamp DESC
    LIMIT 1
) ta ON true
WHERE t.is_active = true;

-- View for unread alerts with token info
CREATE OR REPLACE VIEW v_unread_alerts AS
SELECT 
    a.id,
    a.token_address,
    t.symbol,
    t.name,
    a.alert_type,
    a.severity,
    a.title,
    a.message,
    a.created_at,
    a.user_id
FROM alerts a
JOIN tokens t ON a.token_address = t.address
WHERE a.acknowledged = false 
    AND a.dismissed = false
    AND (a.expires_at IS NULL OR a.expires_at > CURRENT_TIMESTAMP)
ORDER BY a.created_at DESC;

-- View for top opportunities
CREATE OR REPLACE VIEW v_top_opportunities AS
SELECT 
    t.address,
    t.symbol,
    t.name,
    t.market_cap,
    t.volume_24h,
    t.price_usd,
    ta.overall_score,
    ta.opportunity_score,
    ta.risk_score,
    ta.analysis_timestamp
FROM tokens t
JOIN token_analysis ta ON t.address = ta.token_address
WHERE t.is_active = true
    AND ta.analysis_complete = true
    AND ta.opportunity_score >= 70
    AND ta.risk_score <= 50
    AND ta.analysis_timestamp = (
        SELECT MAX(analysis_timestamp)
        FROM token_analysis ta2
        WHERE ta2.token_address = t.address
            AND ta2.analysis_complete = true
    )
ORDER BY ta.opportunity_score DESC, ta.risk_score ASC;

-- View for recent token discoveries
CREATE OR REPLACE VIEW v_recent_discoveries AS
SELECT 
    t.address,
    t.symbol,
    t.name,
    t.market_cap,
    t.volume_24h,
    t.first_detected_at,
    ta.overall_score,
    ta.risk_score,
    EXTRACT(HOURS FROM (CURRENT_TIMESTAMP - t.first_detected_at)) as hours_since_discovery
FROM tokens t
LEFT JOIN LATERAL (
    SELECT overall_score, risk_score
    FROM token_analysis
    WHERE token_address = t.address
        AND analysis_complete = true
    ORDER BY analysis_timestamp DESC
    LIMIT 1
) ta ON true
WHERE t.is_active = true
    AND t.first_detected_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
ORDER BY t.first_detected_at DESC;

-- ============================================================================
-- INSERT SAMPLE FILTER TEMPLATES
-- ============================================================================

INSERT INTO filter_templates (name, description, category, template_json, sort_order) VALUES
('High Safety', 'Tokens with low rug risk and good fundamentals', 'safety', 
 '{"rug_score": {"max": 30}, "overall_score": {"min": 70}, "market_cap": {"min": 100000}}', 1),

('New Opportunities', 'Recently created tokens with growth potential', 'opportunity',
 '{"first_detected_hours": {"max": 24}, "volume_24h": {"min": 50000}, "opportunity_score": {"min": 60}}', 2),

('Large Cap Safe', 'Established tokens with large market cap', 'safety',
 '{"market_cap": {"min": 10000000}, "rug_score": {"max": 20}, "holder_count": {"min": 1000}}', 3),

('High Volume Movers', 'Tokens with high trading volume', 'technical',
 '{"volume_24h": {"min": 500000}, "price_change_24h": {"min": 10}}', 4),

('Low Risk Discovery', 'New tokens with safety checks', 'safety',
 '{"first_detected_hours": {"max": 72}, "rug_score": {"max": 40}, "liquidity": {"min": 25000}}', 5)

ON CONFLICT (name) DO NOTHING;

-- Commit the transaction
COMMIT;

-- Migration complete
SELECT 'Migration 001_initial_schema.sql completed successfully' as status;
