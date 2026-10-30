package com.tbm.whatsapp.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "unsupported_webhook_events")
public class UnsupportedWebhookEvent {
    @Id private UUID id;
    @Column(name = "raw_event_id", nullable = false) private UUID rawEventId;
    @Column(name = "event_field", length = 128) private String eventField;
    @Column(nullable = false, length = 255) private String reason;
    @Column(name = "payload_sha256", nullable = false, length = 64) private String payloadSha256;
    @Column(nullable = false, columnDefinition = "TEXT") private String payload;
    @Column(name = "received_at", nullable = false) private Instant receivedAt;

    protected UnsupportedWebhookEvent() {}

    public UnsupportedWebhookEvent(UUID id, UUID rawEventId, String eventField, String reason,
                                   String payloadSha256, String payload, Instant receivedAt) {
        this.id = id;
        this.rawEventId = rawEventId;
        this.eventField = eventField;
        this.reason = reason;
        this.payloadSha256 = payloadSha256;
        this.payload = payload;
        this.receivedAt = receivedAt;
    }

    public UUID getId() { return id; }
    public String getEventField() { return eventField; }
    public String getReason() { return reason; }
    public String getPayload() { return payload; }
    public Instant getReceivedAt() { return receivedAt; }
}
