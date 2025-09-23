-- alerts.sql - Token alerts and notifications table
-- This table stores user alerts and system notifications for tokens

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

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_alerts_token_address ON alerts(token_address);
CREATE INDEX IF NOT EXISTS idx_alerts_user_id ON alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_alerts_type ON alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts(severity);
CREATE INDEX IF NOT EXISTS idx_alerts_acknowledged ON alerts(acknowledged);
CREATE INDEX IF NOT EXISTS idx_alerts_dismissed ON alerts(dismissed);
CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_expires_at ON alerts(expires_at);

-- Composite indexes for common queries
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

-- GIN index for alert data searches
CREATE INDEX IF NOT EXISTS idx_alerts_data_gin ON alerts USING GIN (alert_data);

-- Table for alert subscriptions/preferences
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

-- Indexes for alert subscriptions
CREATE INDEX IF NOT EXISTS idx_alert_subscriptions_user ON alert_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_alert_subscriptions_type ON alert_subscriptions(alert_type);
CREATE INDEX IF NOT EXISTS idx_alert_subscriptions_enabled ON alert_subscriptions(is_enabled);

-- Function to create alert
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

-- Function to acknowledge alert
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

-- Function to dismiss alert
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

-- Function to clean up expired alerts
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
