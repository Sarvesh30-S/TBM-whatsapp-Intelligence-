package com.tbm.whatsapp.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "notification_preferences")
public class NotificationPreference {
    @Id
    private UUID userId;

    @OneToOne(fetch = FetchType.LAZY)
    @MapsId
    @JoinColumn(name = "user_id")
    private User user;

    @Column(name = "notify_priority_inbox", nullable = false)
    private boolean notifyPriorityInbox = true;

    @Column(name = "notify_approvals", nullable = false)
    private boolean notifyApprovals = true;

    @Column(name = "notify_task_assigned", nullable = false)
    private boolean notifyTaskAssigned = true;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    protected NotificationPreference() {}

    public NotificationPreference(User user) {
        this.user = user;
        this.userId = user.getId();
        this.notifyPriorityInbox = true;
        this.notifyApprovals = true;
        this.notifyTaskAssigned = true;
        this.updatedAt = Instant.now();
    }

    public UUID getUserId() { return userId; }
    public User getUser() { return user; }
    public boolean isNotifyPriorityInbox() { return notifyPriorityInbox; }
    public void setNotifyPriorityInbox(boolean notifyPriorityInbox) { this.notifyPriorityInbox = notifyPriorityInbox; }
    public boolean isNotifyApprovals() { return notifyApprovals; }
    public void setNotifyApprovals(boolean notifyApprovals) { this.notifyApprovals = notifyApprovals; }
    public boolean isNotifyTaskAssigned() { return notifyTaskAssigned; }
    public void setNotifyTaskAssigned(boolean notifyTaskAssigned) { this.notifyTaskAssigned = notifyTaskAssigned; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
