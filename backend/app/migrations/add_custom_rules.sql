-- Migration: Add custom_validation_rules table
CREATE TABLE IF NOT EXISTS custom_validation_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    segment VARCHAR(10) NOT NULL,
    condition_type VARCHAR(50) NOT NULL,
    element_position INTEGER NOT NULL DEFAULT 1,
    expected_value VARCHAR(500),
    severity VARCHAR(20) NOT NULL DEFAULT 'error',
    transaction_types JSONB,
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_custom_rules_enabled ON custom_validation_rules(enabled);
