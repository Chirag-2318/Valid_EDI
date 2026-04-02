CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS edi_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    s3_key VARCHAR(500) NOT NULL,
    s3_url TEXT NOT NULL,
    file_size INTEGER,
    transaction_type VARCHAR(10),
    status VARCHAR(50) DEFAULT 'pending',
    is_valid BOOLEAN DEFAULT FALSE,
    error_count INTEGER DEFAULT 0,
    warning_count INTEGER DEFAULT 0,
    uploaded_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS parse_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_id UUID NOT NULL REFERENCES edi_files(id) ON DELETE CASCADE,
    transaction_set VARCHAR(10),
    sender_id VARCHAR(50),
    receiver_id VARCHAR(50),
    interchange_date DATE,
    segment_count INTEGER,
    parsed_at TIMESTAMP DEFAULT NOW(),
    raw_json JSONB
);

CREATE INDEX IF NOT EXISTS idx_parse_results_file_id ON parse_results(file_id);

CREATE TABLE IF NOT EXISTS validation_errors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_id UUID NOT NULL REFERENCES edi_files(id) ON DELETE CASCADE,
    segment VARCHAR(10),
    element_position INTEGER,
    loop_id VARCHAR(20),
    error_code VARCHAR(50),
    error_message TEXT,
    severity VARCHAR(20),
    suggestion TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_validation_errors_file_id ON validation_errors(file_id);