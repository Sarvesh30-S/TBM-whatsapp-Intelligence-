package com.tbm.whatsapp.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "action_items")
public class ActionItem {
    @Id
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "whatsapp_group_id", nullable = false)
    private WhatsAppGroup whatsappGroup;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "whatsapp_message_id")
    private WhatsAppMessage whatsappMessage;

    @Column(name = "twochat_message_id", length = 255)
    private String twochatMessageId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assigned_to_user_id")
    private User assignedToUser;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by_user_id", nullable = false)
    private User createdByUser;

    @Column(nullable = false, length = 255)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(nullable = false, length = 20)
    private String priority = "MEDIUM";

    @Column(name = "due_date")
    private Instant dueDate;

    @Column(name = "task_status", nullable = false, length = 32)
    private String taskStatus = "PENDING"; // PENDING, IN_PROGRESS, COMPLETED, CANCELLED

    @Column(name = "approval_status", nullable = false, length = 32)
    private String approvalStatus = "NOT_REQUIRED"; // NOT_REQUIRED, PENDING_APPROVAL, APPROVED, REJECTED

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    protected ActionItem() {}

    public ActionItem(UUID id, WhatsAppGroup whatsappGroup, WhatsAppMessage whatsappMessage, String twochatMessageId,
                      User createdByUser, String title, String description, String priority, Instant dueDate) {
        this.id = id != null ? id : UUID.randomUUID();
        this.whatsappGroup = whatsappGroup;
        this.whatsappMessage = whatsappMessage;
        this.twochatMessageId = twochatMessageId;
        this.createdByUser = createdByUser;
        this.title = title;
        this.description = description;
        this.priority = priority != null ? priority : "MEDIUM";
        this.dueDate = dueDate;
        this.taskStatus = "PENDING";
        this.approvalStatus = "NOT_REQUIRED";
        this.createdAt = Instant.now();
        this.updatedAt = Instant.now();
    }

    public UUID getId() { return id; }
    public WhatsAppGroup getWhatsappGroup() { return whatsappGroup; }
    public WhatsAppMessage getWhatsappMessage() { return whatsappMessage; }
    public String getTwochatMessageId() { return twochatMessageId; }
    public User getAssignedToUser() { return assignedToUser; }
    public void setAssignedToUser(User assignedToUser) { this.assignedToUser = assignedToUser; }
    public User getCreatedByUser() { return createdByUser; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getPriority() { return priority; }
    public void setPriority(String priority) { this.priority = priority; }
    public Instant getDueDate() { return dueDate; }
    public void setDueDate(Instant dueDate) { this.dueDate = dueDate; }
    public String getTaskStatus() { return taskStatus; }
    public void setTaskStatus(String taskStatus) { this.taskStatus = taskStatus; }
    public String getApprovalStatus() { return approvalStatus; }
    public void setApprovalStatus(String approvalStatus) { this.approvalStatus = approvalStatus; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
