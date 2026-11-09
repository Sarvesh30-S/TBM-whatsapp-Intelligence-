package com.tbm.whatsapp.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "user_group_assignments")
public class UserGroupAssignment {
    @Id
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "whatsapp_group_id", nullable = false)
    private WhatsAppGroup whatsappGroup;

    @Column(name = "can_view", nullable = false)
    private boolean canView = true;

    @Column(name = "can_send", nullable = false)
    private boolean canSend = false;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assigned_by")
    private User assignedBy;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    protected UserGroupAssignment() {}

    public UserGroupAssignment(UUID id, User user, WhatsAppGroup group, boolean canView, boolean canSend, User assignedBy) {
        this.id = id != null ? id : UUID.randomUUID();
        this.user = user;
        this.whatsappGroup = group;
        this.canView = canView;
        this.canSend = canSend;
        this.assignedBy = assignedBy;
        this.createdAt = Instant.now();
    }

    public UUID getId() { return id; }
    public User getUser() { return user; }
    public WhatsAppGroup getWhatsappGroup() { return whatsappGroup; }
    public boolean isCanView() { return canView; }
    public void setCanView(boolean canView) { this.canView = canView; }
    public boolean isCanSend() { return canSend; }
    public void setCanSend(boolean canSend) { this.canSend = canSend; }
    public User getAssignedBy() { return assignedBy; }
    public Instant getCreatedAt() { return createdAt; }
}
