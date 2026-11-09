package com.tbm.whatsapp.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "audit_logs")
public class AuditLog {
    @Id
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private User user;

    @Column(nullable = false, length = 80)
    private String action;

    @Column(name = "resource_type", nullable = false, length = 64)
    private String resourceType;

    @Column(name = "resource_id", length = 128)
    private String resourceId;

    @Column(name = "ip_address", length = 45)
    private String ipAddress;

    @Column(name = "correlation_id", nullable = false, length = 64)
    private String correlationId;

    @Column(nullable = false, length = 20)
    private String status; // SUCCESS, DENIED, FAILED

    @Column(name = "redacted_metadata", columnDefinition = "JSONB")
    private String redactedMetadata;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    protected AuditLog() {}

    public AuditLog(UUID id, User user, String action, String resourceType, String resourceId,
                    String ipAddress, String correlationId, String status, String redactedMetadata) {
        this.id = id != null ? id : UUID.randomUUID();
        this.user = user;
        this.action = action;
        this.resourceType = resourceType;
        this.resourceId = resourceId;
        this.ipAddress = ipAddress;
        this.correlationId = correlationId;
        this.status = status;
        this.redactedMetadata = redactedMetadata;
        this.createdAt = Instant.now();
    }

    public UUID getId() { return id; }
    public User getUser() { return user; }
    public String getAction() { return action; }
    public String getResourceType() { return resourceType; }
    public String getResourceId() { return resourceId; }
    public String getIpAddress() { return ipAddress; }
    public String getCorrelationId() { return correlationId; }
    public String getStatus() { return status; }
    public String getRedactedMetadata() { return redactedMetadata; }
    public Instant getCreatedAt() { return createdAt; }
}
