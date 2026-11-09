package com.tbm.whatsapp.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "priority_inbox_items")
public class PriorityInboxItem {
    @Id
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "whatsapp_group_id", nullable = false)
    private WhatsAppGroup whatsappGroup;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "whatsapp_message_id")
    private WhatsAppMessage whatsappMessage;

    @Column(name = "twochat_message_id", length = 255)
    private String twochatMessageId;

    @Column(name = "priority_category", nullable = false, length = 32)
    private String priorityCategory; // CRITICAL, FINANCIAL, DEADLINE, OPERATIONAL

    @Column(name = "urgency_score", nullable = false, precision = 3, scale = 2)
    private BigDecimal urgencyScore;

    @Column(name = "summary_excerpt", nullable = false, columnDefinition = "TEXT")
    private String summaryExcerpt;

    @Column(nullable = false, length = 32)
    private String status = "NEW"; // NEW, VIEWED, ACKNOWLEDGED, RESOLVED, ESCALATED

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assigned_to_user_id")
    private User assignedToUser;

    @Column(name = "resolved_at")
    private Instant resolvedAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    protected PriorityInboxItem() {}

    public PriorityInboxItem(UUID id, WhatsAppGroup whatsappGroup, WhatsAppMessage whatsappMessage,
                             String twochatMessageId, String priorityCategory, BigDecimal urgencyScore,
                             String summaryExcerpt) {
        this.id = id != null ? id : UUID.randomUUID();
        this.whatsappGroup = whatsappGroup;
        this.whatsappMessage = whatsappMessage;
        this.twochatMessageId = twochatMessageId;
        this.priorityCategory = priorityCategory;
        this.urgencyScore = urgencyScore;
        this.summaryExcerpt = summaryExcerpt;
        this.status = "NEW";
        this.createdAt = Instant.now();
        this.updatedAt = Instant.now();
    }

    public UUID getId() { return id; }
    public WhatsAppGroup getWhatsappGroup() { return whatsappGroup; }
    public WhatsAppMessage getWhatsappMessage() { return whatsappMessage; }
    public String getTwochatMessageId() { return twochatMessageId; }
    public String getPriorityCategory() { return priorityCategory; }
    public BigDecimal getUrgencyScore() { return urgencyScore; }
    public String getSummaryExcerpt() { return summaryExcerpt; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public User getAssignedToUser() { return assignedToUser; }
    public void setAssignedToUser(User assignedToUser) { this.assignedToUser = assignedToUser; }
    public Instant getResolvedAt() { return resolvedAt; }
    public void setResolvedAt(Instant resolvedAt) { this.resolvedAt = resolvedAt; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
