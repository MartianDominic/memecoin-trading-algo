-- token_analysis.sql - Combined analysis results table
-- This table stores comprehensive analysis data from multiple sources

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

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_token_analysis_address ON token_analysis(token_address);
CREATE INDEX IF NOT EXISTS idx_token_analysis_timestamp ON token_analysis(analysis_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_token_analysis_overall_score ON token_analysis(overall_score DESC);
CREATE INDEX IF NOT EXISTS idx_token_analysis_risk_score ON token_analysis(risk_score);
CREATE INDEX IF NOT EXISTS idx_token_analysis_opportunity_score ON token_analysis(opportunity_score DESC);
CREATE INDEX IF NOT EXISTS idx_token_analysis_complete ON token_analysis(analysis_complete);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_token_analysis_latest_complete 
    ON token_analysis(token_address, analysis_timestamp DESC) 
    WHERE analysis_complete = true;

CREATE INDEX IF NOT EXISTS idx_token_analysis_high_opportunity 
    ON token_analysis(opportunity_score DESC, risk_score) 
    WHERE analysis_complete = true AND opportunity_score >= 70;

CREATE INDEX IF NOT EXISTS idx_token_analysis_low_risk 
    ON token_analysis(risk_score, overall_score DESC) 
    WHERE analysis_complete = true AND risk_score <= 30;

-- Update trigger for updated_at
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

-- Function to get latest analysis for a token
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
