package com.tbm.whatsapp.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "raw_webhook_events")
public class RawWebhookEvent {
    @Id
    @Column(nullable = false, updatable = false)
    private UUID id;

    @Column(name = "payload_sha256", nullable = false, length = 64, unique = true)
    private String payloadSha256;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String payload;

    @Column(name = "received_at", nullable = false)
    private Instant receivedAt;

    @Column(name = "normalization_status", nullable = false, length = 16)
    private String normalizationStatus = "PENDING";

    @Column(name = "normalization_attempts", nullable = false)
    private int normalizationAttempts;

    @Column(name = "normalization_error", length = 80)
    private String normalizationError;

    @Column(name = "normalized_at")
    private Instant normalizedAt;

    protected RawWebhookEvent() {
    }

    public RawWebhookEvent(UUID id, String payloadSha256, String payload, Instant receivedAt) {
        this.id = id;
        this.payloadSha256 = payloadSha256;
        this.payload = payload;
        this.receivedAt = receivedAt;
    }

    public UUID getId() {
        return id;
    }

    public String getPayloadSha256() {
        return payloadSha256;
    }

    public String getPayload() {
        return payload;
    }

    public Instant getReceivedAt() {
        return receivedAt;
    }

    public String getNormalizationStatus() { return normalizationStatus; }
    public int getNormalizationAttempts() { return normalizationAttempts; }
    public String getNormalizationError() { return normalizationError; }
    public Instant getNormalizedAt() { return normalizedAt; }

    public void markProcessed(Instant at) {
        normalizationStatus = "PROCESSED";
        normalizationError = null;
        normalizedAt = at;
    }

    public void markFailed(String errorCode) {
        normalizationStatus = "FAILED";
        normalizationAttempts++;
        normalizationError = errorCode;
    }
}
