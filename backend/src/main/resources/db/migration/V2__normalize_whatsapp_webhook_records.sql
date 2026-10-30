CREATE TABLE whatsapp_messages (
    id UUID PRIMARY KEY,
    raw_event_id UUID NOT NULL REFERENCES raw_webhook_events(id),
    provider_message_id VARCHAR(128) NOT NULL UNIQUE,
    waba_id VARCHAR(64),
    phone_number_id VARCHAR(64),
    sender_id VARCHAR(64),
    message_type VARCHAR(32) NOT NULL,
    message_timestamp TIMESTAMP WITH TIME ZONE,
    text_body TEXT,
    message_payload TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX idx_whatsapp_messages_timestamp ON whatsapp_messages (message_timestamp);
CREATE INDEX idx_whatsapp_messages_sender ON whatsapp_messages (sender_id);

CREATE TABLE whatsapp_message_statuses (
    id UUID PRIMARY KEY,
    raw_event_id UUID NOT NULL REFERENCES raw_webhook_events(id),
    status_key VARCHAR(64) NOT NULL UNIQUE,
    provider_message_id VARCHAR(128) NOT NULL,
    recipient_id VARCHAR(64),
    status VARCHAR(32) NOT NULL,
    status_timestamp TIMESTAMP WITH TIME ZONE,
    status_payload TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX idx_whatsapp_status_message ON whatsapp_message_statuses (provider_message_id);
CREATE INDEX idx_whatsapp_status_timestamp ON whatsapp_message_statuses (status_timestamp);
