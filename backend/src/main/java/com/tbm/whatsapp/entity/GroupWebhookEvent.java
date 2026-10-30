package com.tbm.whatsapp.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "group_webhook_events")
public class GroupWebhookEvent {
    @Id private UUID id;
    @Column(name = "raw_event_id", nullable = false) private UUID rawEventId;
    @Column(name = "event_field", nullable = false, length = 64) private String eventField;
    @Column(name = "meta_group_id", length = 128) private String metaGroupId;
    @Column(name = "payload_sha256", nullable = false, length = 64) private String payloadSha256;
    @Column(nullable = false, columnDefinition = "TEXT") private String payload;
    @Column(name = "received_at", nullable = false) private Instant receivedAt;

    protected GroupWebhookEvent() {}

    public GroupWebhookEvent(UUID id, UUID rawEventId, String eventField, String metaGroupId,
                             String payloadSha256, String payload, Instant receivedAt) {
        this.id = id;
        this.rawEventId = rawEventId;
        this.eventField = eventField;
        this.metaGroupId = metaGroupId;
        this.payloadSha256 = payloadSha256;
        this.payload = payload;
        this.receivedAt = receivedAt;
    }
}
