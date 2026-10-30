package com.tbm.whatsapp.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "whatsapp_groups")
public class WhatsAppGroup {
    @Id
    private UUID id;
    @Column(name = "campaign_id", nullable = false)
    private UUID campaignId;
    @Column(name = "meta_group_id", unique = true, length = 128)
    private String metaGroupId;
    @Column(nullable = false, length = 255)
    private String subject;
    @Column(name = "invite_link", columnDefinition = "TEXT")
    private String inviteLink;
    @Column(name = "join_approval_mode", nullable = false, length = 24)
    private String joinApprovalMode;
    @Column(nullable = false, length = 24)
    private String status;
    @Column(name = "planned_external_seats", nullable = false)
    private int plannedExternalSeats;
    @Column(name = "consent_sent_at")
    private Instant consentSentAt;
    @Column(name = "created_at", nullable = false)
    private Instant createdAt;
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected WhatsAppGroup() {}

    public WhatsAppGroup(UUID id, UUID campaignId, String metaGroupId, String subject, String inviteLink,
                         String joinApprovalMode, String status, Instant consentSentAt,
                         int plannedExternalSeats, Instant createdAt, Instant updatedAt) {
        this.id = id;
        this.campaignId = campaignId;
        this.metaGroupId = metaGroupId;
        this.subject = subject;
        this.inviteLink = inviteLink;
        this.joinApprovalMode = joinApprovalMode;
        this.status = status;
        this.consentSentAt = consentSentAt;
        this.plannedExternalSeats = plannedExternalSeats;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }

    public UUID getId() { return id; }
    public UUID getCampaignId() { return campaignId; }
    public String getMetaGroupId() { return metaGroupId; }
    public String getSubject() { return subject; }
    public String getJoinApprovalMode() { return joinApprovalMode; }
    public String getStatus() { return status; }
    public Instant getConsentSentAt() { return consentSentAt; }
    public int getPlannedExternalSeats() { return plannedExternalSeats; }
    public Instant getCreatedAt() { return createdAt; }
    public String getInviteLink() { return inviteLink; }

    public boolean recordInviteLink(String value, Instant updatedAt) {
        if (value == null || value.equals(inviteLink)) return false;
        this.inviteLink = value;
        this.updatedAt = updatedAt;
        return true;
    }

    public void linkMetaGroup(String metaGroupId, String inviteLink, Instant updatedAt) {
        if (metaGroupId != null && !metaGroupId.isBlank()) {
            this.metaGroupId = metaGroupId.trim();
        }
        if (inviteLink != null && !inviteLink.isBlank()) {
            this.inviteLink = inviteLink.trim();
        }
        this.updatedAt = updatedAt;
    }

    public void unlinkMetaGroup(Instant updatedAt) {
        this.metaGroupId = null;
        this.inviteLink = null;
        this.updatedAt = updatedAt;
    }

    public void recordConsent(Instant consentTime) {
        this.consentSentAt = consentTime;
        if ("PENDING_CONSENT".equals(this.status)) {
            this.status = "ACTIVE";
        }
        this.updatedAt = consentTime;
    }
}
