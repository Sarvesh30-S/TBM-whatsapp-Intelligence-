package com.tbm.whatsapp.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "whatsapp_messages")
public class WhatsAppMessage {
    @Id
    private UUID id;
    @Column(name = "raw_event_id", nullable = false)
    private UUID rawEventId;
    @Column(name = "provider_message_id", nullable = false, unique = true, length = 128)
    private String providerMessageId;
    @Column(name = "waba_id", length = 64)
    private String wabaId;
    @Column(name = "phone_number_id", length = 64)
    private String phoneNumberId;
    @Column(name = "group_id", length = 128)
    private String groupId;
    @Column(name = "sender_id", length = 64)
    private String senderId;
    @Column(name = "message_type", nullable = false, length = 32)
    private String messageType;
    @Column(name = "message_timestamp")
    private Instant messageTimestamp;
    @Column(name = "text_body", columnDefinition = "TEXT")
    private String textBody;
    @Column(name = "message_payload", nullable = false, columnDefinition = "TEXT")
    private String messagePayload;
    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected WhatsAppMessage() {}

    public WhatsAppMessage(UUID id, UUID rawEventId, String providerMessageId, String wabaId,
                           String phoneNumberId, String groupId, String senderId, String messageType,
                           Instant messageTimestamp, String textBody, String messagePayload, Instant createdAt) {
        this.id = id;
        this.rawEventId = rawEventId;
        this.providerMessageId = providerMessageId;
        this.wabaId = wabaId;
        this.phoneNumberId = phoneNumberId;
        this.groupId = groupId;
        this.senderId = senderId;
        this.messageType = messageType;
        this.messageTimestamp = messageTimestamp;
        this.textBody = textBody;
        this.messagePayload = messagePayload;
        this.createdAt = createdAt;
    }

    public String getProviderMessageId() { return providerMessageId; }
    public UUID getId() { return id; }
    public String getPhoneNumberId() { return phoneNumberId; }
    public String getGroupId() { return groupId; }
    public String getSenderId() { return senderId; }
    public Instant getMessageTimestamp() { return messageTimestamp; }
    public String getMessageType() { return messageType; }
    public String getTextBody() { return textBody; }
    public Instant getCreatedAt() { return createdAt; }
}
