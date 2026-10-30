ALTER TABLE raw_webhook_events ADD COLUMN normalization_status VARCHAR(16) NOT NULL DEFAULT 'PENDING';
ALTER TABLE raw_webhook_events ADD COLUMN normalization_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE raw_webhook_events ADD COLUMN normalization_error VARCHAR(80);
ALTER TABLE raw_webhook_events ADD COLUMN normalized_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE raw_webhook_events ADD CONSTRAINT ck_raw_webhook_normalization_status
    CHECK (normalization_status IN ('PENDING', 'PROCESSED', 'FAILED'));
ALTER TABLE raw_webhook_events ADD CONSTRAINT ck_raw_webhook_normalization_attempts
    CHECK (normalization_attempts >= 0);

CREATE INDEX idx_raw_webhook_events_normalization_queue
    ON raw_webhook_events (normalization_status, normalization_attempts, received_at);
