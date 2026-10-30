package com.tbm.whatsapp.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.math.BigDecimal;
import java.util.UUID;

@Entity
@Table(name = "important_message_insights")
public class ImportantMessageInsight {
    @Id private UUID id;
    @Column(name = "summary_id", nullable = false) private UUID summaryId;
    @Column(nullable = false, length = 32) private String category;
    @Column(nullable = false, length = 255) private String title;
    @Column(nullable = false, columnDefinition = "TEXT") private String detail;
    @Column(nullable = false, precision = 4, scale = 3) private BigDecimal confidence;
    @Column(name = "review_status", nullable = false, length = 24) private String reviewStatus;
    @Column(name = "source_message_ids", nullable = false, columnDefinition = "TEXT") private String sourceMessageIds;
    @Column(name = "due_at") private Instant dueAt;
    @Column(name = "created_at", nullable = false) private Instant createdAt;
    @Column(name = "task_status", length = 24) private String taskStatus;
    @Column(name = "resolved_at") private Instant resolvedAt;

    protected ImportantMessageInsight() {}

    public ImportantMessageInsight(UUID id, UUID summaryId, String category, String title, String detail,
                                   double confidence, String reviewStatus, String sourceMessageIds,
                                   Instant dueAt, Instant createdAt) {
        this.id = id;
        this.summaryId = summaryId;
        this.category = category;
        this.title = title;
        this.detail = detail;
        this.confidence = BigDecimal.valueOf(confidence);
        this.reviewStatus = reviewStatus;
        this.sourceMessageIds = sourceMessageIds;
        this.dueAt = dueAt;
        this.createdAt = createdAt;
        this.taskStatus = "TASK".equals(category) ? "OPEN" : null;
    }

    public UUID getId() { return id; }
    public UUID getSummaryId() { return summaryId; }
    public String getCategory() { return category; }
    public String getTitle() { return title; }
    public String getDetail() { return detail; }
    public double getConfidence() { return confidence.doubleValue(); }
    public String getReviewStatus() { return reviewStatus; }
    public String getSourceMessageIds() { return sourceMessageIds; }
    public Instant getDueAt() { return dueAt; }
    public Instant getCreatedAt() { return createdAt; }
    public String getTaskStatus() { return taskStatus; }
    public Instant getResolvedAt() { return resolvedAt; }

    public boolean updateTaskStatus(String status, Instant now) {
        if (!"TASK".equals(category)) throw new IllegalStateException("Only task insights have a workflow status");
        if (!java.util.Set.of("OPEN", "IN_PROGRESS", "DONE").contains(status)) {
            throw new IllegalArgumentException("Unsupported task status");
        }
        if ("DONE".equals(taskStatus) && !"DONE".equals(status)) {
            throw new IllegalStateException("Completed tasks cannot be reopened without an audited reopen flow");
        }
        if (status.equals(taskStatus)) return false;
        taskStatus = status;
        resolvedAt = "DONE".equals(status) ? now : null;
        return true;
    }
}
