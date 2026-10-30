package com.tbm.whatsapp.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "whatsapp_group_participants")
public class WhatsAppGroupParticipant {
    @Id
    private UUID id;
    @Column(name = "whatsapp_group_id", nullable = false)
    private UUID whatsappGroupId;
    @Column(name = "person_id", nullable = false)
    private UUID personId;
    @Column(name = "is_external", nullable = false)
    private boolean external;
    @Column(nullable = false, length = 24)
    private String status;
    @Column(name = "joined_at")
    private Instant joinedAt;
    @Column(name = "left_at")
    private Instant leftAt;

    protected WhatsAppGroupParticipant() {}

    public WhatsAppGroupParticipant(UUID id, UUID whatsappGroupId, UUID personId, boolean external,
                                    String status, Instant joinedAt, Instant leftAt) {
        this.id = id;
        this.whatsappGroupId = whatsappGroupId;
        this.personId = personId;
        this.external = external;
        this.status = status;
        this.joinedAt = joinedAt;
        this.leftAt = leftAt;
    }

    public UUID getId() { return id; }
    public UUID getWhatsappGroupId() { return whatsappGroupId; }
    public UUID getPersonId() { return personId; }
    public boolean isExternal() { return external; }
    public String getStatus() { return status; }
    public Instant getJoinedAt() { return joinedAt; }
    public Instant getLeftAt() { return leftAt; }

    public void setStatus(String status) { this.status = status; }
    public void setLeftAt(Instant leftAt) { this.leftAt = leftAt; }
}
