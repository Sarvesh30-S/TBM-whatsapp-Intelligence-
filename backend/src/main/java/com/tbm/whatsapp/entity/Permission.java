package com.tbm.whatsapp.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "permissions")
public class Permission {
    @Id
    private UUID id;

    @Column(nullable = false, unique = true, length = 80)
    private String code;

    @Column(nullable = false, length = 40)
    private String category;

    @Column(nullable = false, length = 255)
    private String description;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected Permission() {}

    public Permission(UUID id, String code, String category, String description) {
        this.id = id != null ? id : UUID.randomUUID();
        this.code = code;
        this.category = category;
        this.description = description;
        this.createdAt = Instant.now();
    }

    public UUID getId() { return id; }
    public String getCode() { return code; }
    public String getCategory() { return category; }
    public String getDescription() { return description; }
    public Instant getCreatedAt() { return createdAt; }
}
