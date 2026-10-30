CREATE TABLE IF NOT EXISTS whatsapp_message_assets (
    id UUID PRIMARY KEY,
    whatsapp_message_id UUID NOT NULL UNIQUE REFERENCES whatsapp_messages(id),
    provider_media_id VARCHAR(128) NOT NULL UNIQUE,
    media_kind VARCHAR(24) NOT NULL,
    mime_type VARCHAR(160),
    original_filename VARCHAR(255),
    provider_sha256 VARCHAR(128),
    content_sha256 VARCHAR(64),
    byte_size BIGINT,
    storage_key TEXT,
    extracted_text TEXT,
    detected_language VARCHAR(24),
    status VARCHAR(32) NOT NULL DEFAULT 'DOWNLOAD_PENDING',
    failure_code VARCHAR(80),
    retry_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT ck_message_asset_kind CHECK (media_kind IN ('image', 'audio', 'video', 'document', 'sticker')),
    CONSTRAINT ck_message_asset_status CHECK (status IN ('DOWNLOAD_PENDING', 'DOWNLOADED', 'PROCESSING', 'READY', 'WAITING_FOR_PROVIDER', 'UNSUPPORTED', 'FAILED'))
);

CREATE INDEX IF NOT EXISTS idx_message_assets_status_created ON whatsapp_message_assets (status, created_at);

CREATE TABLE IF NOT EXISTS conversation_summaries (
    id UUID PRIMARY KEY,
    campaign_id UUID NOT NULL REFERENCES campaigns(id),
    whatsapp_group_id UUID NOT NULL REFERENCES whatsapp_groups(id),
    window_start TIMESTAMP WITH TIME ZONE NOT NULL,
    window_end TIMESTAMP WITH TIME ZONE NOT NULL,
    summary_text TEXT NOT NULL,
    confidence NUMERIC(4,3) NOT NULL,
    review_status VARCHAR(24) NOT NULL,
    source_message_ids TEXT NOT NULL,
    provider VARCHAR(32) NOT NULL,
    model VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT ck_summary_confidence CHECK (confidence BETWEEN 0 AND 1),
    CONSTRAINT ck_summary_review_status CHECK (review_status IN ('READY', 'NEEDS_REVIEW'))
);

CREATE INDEX IF NOT EXISTS idx_conversation_summaries_group_window
    ON conversation_summaries (whatsapp_group_id, window_end DESC);
CREATE INDEX IF NOT EXISTS idx_conversation_summaries_campaign_window
    ON conversation_summaries (campaign_id, window_end DESC);

CREATE TABLE IF NOT EXISTS important_message_insights (
    id UUID PRIMARY KEY,
    summary_id UUID NOT NULL REFERENCES conversation_summaries(id) ON DELETE CASCADE,
    category VARCHAR(32) NOT NULL,
    title VARCHAR(255) NOT NULL,
    detail TEXT NOT NULL,
    confidence NUMERIC(4,3) NOT NULL,
    review_status VARCHAR(24) NOT NULL,
    source_message_ids TEXT NOT NULL,
    due_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT ck_insight_confidence CHECK (confidence BETWEEN 0 AND 1),
    CONSTRAINT ck_insight_review_status CHECK (review_status IN ('READY', 'NEEDS_REVIEW')),
    CONSTRAINT ck_insight_category CHECK (category IN ('OPERATIONS', 'RISK', 'QUESTION', 'DECISION', 'FINANCE', 'CUSTOMER_NEED', 'TASK'))
);

CREATE INDEX IF NOT EXISTS idx_important_insights_summary_category ON important_message_insights (summary_id, category);

CREATE TABLE IF NOT EXISTS unsupported_webhook_events (
    id UUID PRIMARY KEY,
    raw_event_id UUID NOT NULL REFERENCES raw_webhook_events(id),
    event_field VARCHAR(128),
    reason VARCHAR(255) NOT NULL,
    payload_sha256 VARCHAR(64) NOT NULL,
    payload TEXT NOT NULL,
    received_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT uq_unsupported_event UNIQUE (raw_event_id, payload_sha256)
);

CREATE INDEX IF NOT EXISTS idx_unsupported_webhook_events_received ON unsupported_webhook_events (received_at DESC);

CREATE TABLE IF NOT EXISTS group_webhook_events (
    id UUID PRIMARY KEY,
    raw_event_id UUID NOT NULL REFERENCES raw_webhook_events(id),
    event_field VARCHAR(64) NOT NULL,
    meta_group_id VARCHAR(128),
    payload_sha256 VARCHAR(64) NOT NULL,
    payload TEXT NOT NULL,
    received_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT uq_group_webhook_event UNIQUE (raw_event_id, payload_sha256)
);

CREATE INDEX IF NOT EXISTS idx_group_webhook_events_group_received ON group_webhook_events (meta_group_id, received_at DESC);

ALTER TABLE whatsapp_message_statuses ADD COLUMN IF NOT EXISTS billable BOOLEAN;
ALTER TABLE whatsapp_message_statuses ADD COLUMN IF NOT EXISTS pricing_model VARCHAR(40);
ALTER TABLE whatsapp_message_statuses ADD COLUMN IF NOT EXISTS pricing_category VARCHAR(40);
ALTER TABLE whatsapp_message_statuses ADD COLUMN IF NOT EXISTS pricing_type VARCHAR(40);
ALTER TABLE whatsapp_message_statuses ADD COLUMN IF NOT EXISTS cost_amount NUMERIC(12,6);
ALTER TABLE whatsapp_message_statuses ADD COLUMN IF NOT EXISTS currency_code VARCHAR(8);

ALTER TABLE whatsapp_groups DROP CONSTRAINT IF EXISTS ck_group_requires_consent;
ALTER TABLE whatsapp_groups ADD CONSTRAINT ck_group_requires_consent
    CHECK (status NOT IN ('INVITE_PENDING', 'ACTIVE') OR consent_sent_at IS NOT NULL);
