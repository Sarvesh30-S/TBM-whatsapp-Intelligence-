package com.tbm.whatsapp.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.math.BigDecimal;
import java.util.UUID;

@Entity
@Table(name = "whatsapp_message_statuses")
public class WhatsAppMessageStatus {
    @Id
    private UUID id;
    @Column(name = "raw_event_id", nullable = false)
    private UUID rawEventId;
    @Column(name = "status_key", nullable = false, unique = true, length = 64)
    private String statusKey;
    @Column(name = "provider_message_id", nullable = false, length = 128)
    private String providerMessageId;
    @Column(name = "recipient_id", length = 64)
    private String recipientId;
    @Column(nullable = false, length = 32)
    private String status;
    @Column(name = "status_timestamp")
    private Instant statusTimestamp;
    @Column(name = "status_payload", nullable = false, columnDefinition = "TEXT")
    private String statusPayload;
    @Column(name = "billable")
    private Boolean billable;
    @Column(name = "pricing_model", length = 40)
    private String pricingModel;
    @Column(name = "pricing_category", length = 40)
    private String pricingCategory;
    @Column(name = "pricing_type", length = 40)
    private String pricingType;
    @Column(name = "cost_amount", precision = 12, scale = 6)
    private BigDecimal costAmount;
    @Column(name = "currency_code", length = 8)
    private String currencyCode;
    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected WhatsAppMessageStatus() {}

    public WhatsAppMessageStatus(UUID id, UUID rawEventId, String statusKey, String providerMessageId,
                                 String recipientId, String status, Instant statusTimestamp,
                                 String statusPayload, Boolean billable, String pricingModel,
                                 String pricingCategory, String pricingType, BigDecimal costAmount,
                                 String currencyCode, Instant createdAt) {
        this.id = id;
        this.rawEventId = rawEventId;
        this.statusKey = statusKey;
        this.providerMessageId = providerMessageId;
        this.recipientId = recipientId;
        this.status = status;
        this.statusTimestamp = statusTimestamp;
        this.statusPayload = statusPayload;
        this.billable = billable;
        this.pricingModel = pricingModel;
        this.pricingCategory = pricingCategory;
        this.pricingType = pricingType;
        this.costAmount = costAmount;
        this.currencyCode = currencyCode;
        this.createdAt = createdAt;
    }

    public String getProviderMessageId() { return providerMessageId; }
    public String getRecipientId() { return recipientId; }
    public String getStatus() { return status; }
    public Instant getStatusTimestamp() { return statusTimestamp; }
    public Boolean getBillable() { return billable; }
    public String getPricingModel() { return pricingModel; }
    public String getPricingCategory() { return pricingCategory; }
    public String getPricingType() { return pricingType; }
    public BigDecimal getCostAmount() { return costAmount; }
    public String getCurrencyCode() { return currencyCode; }
    public String getStatusPayload() { return statusPayload; }
}
