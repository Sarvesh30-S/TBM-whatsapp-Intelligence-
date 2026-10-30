package com.tbm.whatsapp.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "brands")
public class Brand {
    @Id
    private UUID id;
    @Column(nullable = false, unique = true, length = 120)
    private String slug;
    @Column(nullable = false, length = 160)
    private String name;
    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected Brand() {}

    public Brand(UUID id, String slug, String name, Instant createdAt) {
        this.id = id;
        this.slug = slug;
        this.name = name;
        this.createdAt = createdAt;
    }

    public UUID getId() { return id; }
    public String getSlug() { return slug; }
    public String getName() { return name; }
    public Instant getCreatedAt() { return createdAt; }
}
