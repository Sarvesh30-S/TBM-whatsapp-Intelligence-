package com.tbm.whatsapp.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.math.BigDecimal;
import java.util.UUID;

@Entity
@Table(name = "conversation_summaries")
public class ConversationSummary {
    @Id private UUID id;
    @Column(name = "campaign_id", nullable = false) private UUID campaignId;
    @Column(name = "whatsapp_group_id", nullable = false) private UUID whatsappGroupId;
    @Column(name = "window_start", nullable = false) private Instant windowStart;
    @Column(name = "window_end", nullable = false) private Instant windowEnd;
    @Column(name = "summary_text", nullable = false, columnDefinition = "TEXT") private String summaryText;
    @Column(nullable = false, precision = 4, scale = 3) private BigDecimal confidence;
    @Column(name = "review_status", nullable = false, length = 24) private String reviewStatus;
    @Column(name = "source_message_ids", nullable = false, columnDefinition = "TEXT") private String sourceMessageIds;
    @Column(nullable = false, length = 32) private String provider;
    @Column(nullable = false, length = 100) private String model;
    @Column(name = "created_at", nullable = false) private Instant createdAt;

    protected ConversationSummary() {}

    public ConversationSummary(UUID id, UUID campaignId, UUID whatsappGroupId, Instant windowStart,
                               Instant windowEnd, String summaryText, double confidence, String reviewStatus,
                               String sourceMessageIds, String provider, String model, Instant createdAt) {
        this.id = id;
        this.campaignId = campaignId;
        this.whatsappGroupId = whatsappGroupId;
        this.windowStart = windowStart;
        this.windowEnd = windowEnd;
        this.summaryText = summaryText;
        this.confidence = BigDecimal.valueOf(confidence);
        this.reviewStatus = reviewStatus;
        this.sourceMessageIds = sourceMessageIds;
        this.provider = provider;
        this.model = model;
        this.createdAt = createdAt;
    }

    public UUID getId() { return id; }
    public UUID getCampaignId() { return campaignId; }
    public UUID getWhatsappGroupId() { return whatsappGroupId; }
    public Instant getWindowStart() { return windowStart; }
    public Instant getWindowEnd() { return windowEnd; }
    public String getSummaryText() { return summaryText; }
    public double getConfidence() { return confidence.doubleValue(); }
    public String getReviewStatus() { return reviewStatus; }
    public String getSourceMessageIds() { return sourceMessageIds; }
    public String getProvider() { return provider; }
    public String getModel() { return model; }
    public Instant getCreatedAt() { return createdAt; }
}
