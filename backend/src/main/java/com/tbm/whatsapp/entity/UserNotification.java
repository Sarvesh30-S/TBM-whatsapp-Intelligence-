package com.tbm.whatsapp.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "user_notifications")
public class UserNotification {
    @Id
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false, length = 255)
    private String title;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String message;

    @Column(name = "notification_type", nullable = false, length = 40)
    private String notificationType;

    @Column(name = "reference_id")
    private UUID referenceId;

    @Column(name = "is_read", nullable = false)
    private boolean read = false;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    protected UserNotification() {}

    public UserNotification(UUID id, User user, String title, String message, String notificationType, UUID referenceId) {
        this.id = id != null ? id : UUID.randomUUID();
        this.user = user;
        this.title = title;
        this.message = message;
        this.notificationType = notificationType;
        this.referenceId = referenceId;
        this.read = false;
        this.createdAt = Instant.now();
    }

    public UUID getId() { return id; }
    public User getUser() { return user; }
    public String getTitle() { return title; }
    public String getMessage() { return message; }
    public String getNotificationType() { return notificationType; }
    public UUID getReferenceId() { return referenceId; }
    public boolean isRead() { return read; }
    public void setRead(boolean read) { this.read = read; }
    public Instant getCreatedAt() { return createdAt; }
}
