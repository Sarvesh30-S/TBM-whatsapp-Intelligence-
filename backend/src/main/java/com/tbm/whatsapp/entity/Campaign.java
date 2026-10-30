package com.tbm.whatsapp.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "campaigns")
public class Campaign {
    @Id
    private UUID id;
    @Column(name = "brand_id", nullable = false)
    private UUID brandId;
    @Column(nullable = false, length = 120)
    private String slug;
    @Column(nullable = false, length = 160)
    private String name;
    @Column(nullable = false, length = 24)
    private String status;
    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected Campaign() {}

    public Campaign(UUID id, UUID brandId, String slug, String name, String status, Instant createdAt) {
        this.id = id;
        this.brandId = brandId;
        this.slug = slug;
        this.name = name;
        this.status = status;
        this.createdAt = createdAt;
    }

    public UUID getId() { return id; }
    public UUID getBrandId() { return brandId; }
    public String getSlug() { return slug; }
    public String getName() { return name; }
    public String getStatus() { return status; }

    public void setName(String name) {
        if (name != null && !name.isBlank()) this.name = name.trim();
    }

    public void setStatus(String status) {
        if (status != null && !status.isBlank()) this.status = status.trim().toUpperCase(java.util.Locale.ROOT);
    }
}
