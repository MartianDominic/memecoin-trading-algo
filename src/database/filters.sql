-- filters.sql - User custom filters table
-- This table stores user-defined filters for token screening

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

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_filters_user_id ON user_filters(user_id);
CREATE INDEX IF NOT EXISTS idx_user_filters_name ON user_filters(name);
CREATE INDEX IF NOT EXISTS idx_user_filters_active ON user_filters(is_active);
CREATE INDEX IF NOT EXISTS idx_user_filters_public ON user_filters(is_public);
CREATE INDEX IF NOT EXISTS idx_user_filters_created_at ON user_filters(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_filters_usage ON user_filters(usage_count DESC);

-- GIN index for JSON criteria searches
CREATE INDEX IF NOT EXISTS idx_user_filters_criteria_gin ON user_filters USING GIN (criteria_json);

-- Composite indexes
CREATE INDEX IF NOT EXISTS idx_user_filters_user_active 
    ON user_filters(user_id, is_active, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_filters_public_popular 
    ON user_filters(is_public, usage_count DESC) 
    WHERE is_active = true;

-- Update trigger for updated_at
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

-- Function to increment usage count
CREATE OR REPLACE FUNCTION increment_filter_usage(p_filter_id BIGINT)
RETURNS VOID AS $$
BEGIN
    UPDATE user_filters
    SET usage_count = usage_count + 1,
        last_used_at = CURRENT_TIMESTAMP
    WHERE id = p_filter_id;
END;
$$ LANGUAGE plpgsql;

-- Table for predefined filter templates
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

-- Indexes for filter templates
CREATE INDEX IF NOT EXISTS idx_filter_templates_category ON filter_templates(category);
CREATE INDEX IF NOT EXISTS idx_filter_templates_active ON filter_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_filter_templates_sort ON filter_templates(sort_order);
CREATE INDEX IF NOT EXISTS idx_filter_templates_usage ON filter_templates(usage_count DESC);

-- Insert some common filter templates
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
