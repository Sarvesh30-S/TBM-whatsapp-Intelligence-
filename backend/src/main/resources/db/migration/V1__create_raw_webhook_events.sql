CREATE TABLE raw_webhook_events (
    id UUID PRIMARY KEY,
    payload_sha256 VARCHAR(64) NOT NULL UNIQUE,
    payload TEXT NOT NULL,
    received_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX idx_raw_webhook_events_received_at
    ON raw_webhook_events (received_at);
