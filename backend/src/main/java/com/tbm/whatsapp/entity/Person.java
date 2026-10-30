package com.tbm.whatsapp.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "people")
public class Person {
    @Id
    private UUID id;
    @Column(name = "wa_id", nullable = false, unique = true, length = 64)
    private String waId;
    @Column(name = "display_name", length = 160)
    private String displayName;
    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected Person() {}

    public Person(UUID id, String waId, String displayName, Instant createdAt) {
        this.id = id;
        this.waId = waId;
        this.displayName = displayName;
        this.createdAt = createdAt;
    }

    public UUID getId() { return id; }
    public String getWaId() { return waId; }
    public String getDisplayName() { return displayName; }
    public Instant getCreatedAt() { return createdAt; }

    public void setDisplayName(String displayName) {
        this.displayName = displayName;
    }
}
