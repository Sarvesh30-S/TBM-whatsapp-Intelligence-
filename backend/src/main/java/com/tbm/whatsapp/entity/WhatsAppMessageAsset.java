package com.tbm.whatsapp.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "whatsapp_message_assets")
public class WhatsAppMessageAsset {
    @Id
    private UUID id;
    @Column(name = "whatsapp_message_id", nullable = false, unique = true)
    private UUID whatsappMessageId;
    @Column(name = "provider_media_id", nullable = false, unique = true, length = 128)
    private String providerMediaId;
    @Column(name = "media_kind", nullable = false, length = 24)
    private String mediaKind;
    @Column(name = "mime_type", length = 160)
    private String mimeType;
    @Column(name = "original_filename", length = 255)
    private String originalFilename;
    @Column(name = "provider_sha256", length = 128)
    private String providerSha256;
    @Column(name = "content_sha256", length = 64)
    private String contentSha256;
    @Column(name = "byte_size")
    private Long byteSize;
    @Column(name = "storage_key", columnDefinition = "TEXT")
    private String storageKey;
    @Column(name = "extracted_text", columnDefinition = "TEXT")
    private String extractedText;
    @Column(name = "detected_language", length = 24)
    private String detectedLanguage;
    @Column(nullable = false, length = 32)
    private String status;
    @Column(name = "failure_code", length = 80)
    private String failureCode;
    @Column(name = "retry_count", nullable = false)
    private int retryCount;
    @Column(name = "created_at", nullable = false)
    private Instant createdAt;
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected WhatsAppMessageAsset() {}

    public WhatsAppMessageAsset(UUID id, UUID whatsappMessageId, String providerMediaId, String mediaKind,
                                String mimeType, String originalFilename, String providerSha256, Instant now) {
        this.id = id;
        this.whatsappMessageId = whatsappMessageId;
        this.providerMediaId = providerMediaId;
        this.mediaKind = mediaKind;
        this.mimeType = mimeType;
        this.originalFilename = originalFilename;
        this.providerSha256 = providerSha256;
        this.status = "DOWNLOAD_PENDING";
        this.retryCount = 0;
        this.createdAt = now;
        this.updatedAt = now;
    }

    public void markDownloaded(String storageKey, String contentSha256, long byteSize, String mimeType) {
        this.storageKey = storageKey;
        this.contentSha256 = contentSha256;
        this.byteSize = byteSize;
        if (mimeType != null) this.mimeType = mimeType;
        this.status = "DOWNLOADED";
        this.failureCode = null;
        this.updatedAt = Instant.now();
    }

    public void markReady(String text, String language) {
        this.extractedText = text;
        this.detectedLanguage = language;
        this.status = "READY";
        this.failureCode = null;
        this.updatedAt = Instant.now();
    }

    public void markProcessing() {
        this.status = "PROCESSING";
        this.failureCode = null;
        this.updatedAt = Instant.now();
    }

    public void markUnsupported(String reason) {
        this.status = "UNSUPPORTED";
        this.failureCode = reason;
        this.updatedAt = Instant.now();
    }

    public void markWaitingForProvider(String reason) {
        this.status = "WAITING_FOR_PROVIDER";
        this.failureCode = reason;
        this.updatedAt = Instant.now();
    }

    public void markFailed(String reason, boolean retryable) {
        this.retryCount++;
        this.failureCode = reason;
        this.status = retryable && retryCount < 5 ? "DOWNLOAD_PENDING" : "FAILED";
        this.updatedAt = Instant.now();
    }

    public UUID getId() { return id; }
    public UUID getWhatsappMessageId() { return whatsappMessageId; }
    public String getProviderMediaId() { return providerMediaId; }
    public String getMediaKind() { return mediaKind; }
    public String getMimeType() { return mimeType; }
    public String getOriginalFilename() { return originalFilename; }
    public String getProviderSha256() { return providerSha256; }
    public String getContentSha256() { return contentSha256; }
    public Long getByteSize() { return byteSize; }
    public String getStorageKey() { return storageKey; }
    public String getExtractedText() { return extractedText; }
    public String getDetectedLanguage() { return detectedLanguage; }
    public String getStatus() { return status; }
    public String getFailureCode() { return failureCode; }
    public int getRetryCount() { return retryCount; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
