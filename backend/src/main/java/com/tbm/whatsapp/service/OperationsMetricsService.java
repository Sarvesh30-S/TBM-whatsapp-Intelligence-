package com.tbm.whatsapp.service;

import com.tbm.whatsapp.entity.WhatsAppGroup;
import com.tbm.whatsapp.repository.BrandRepository;
import com.tbm.whatsapp.repository.CampaignRepository;
import com.tbm.whatsapp.repository.ImportantMessageInsightRepository;
import com.tbm.whatsapp.repository.WhatsAppGroupRepository;
import com.tbm.whatsapp.repository.WhatsAppMessageRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
public class OperationsMetricsService {
    private final BrandRepository brands;
    private final CampaignRepository campaigns;
    private final WhatsAppGroupRepository groups;
    private final WhatsAppMessageRepository messages;
    private final ImportantMessageInsightRepository insights;
    private final int silenceAfterHours;

    public OperationsMetricsService(BrandRepository brands, CampaignRepository campaigns,
                                   WhatsAppGroupRepository groups, WhatsAppMessageRepository messages,
                                   ImportantMessageInsightRepository insights,
                                   @Value("${app.operations.silence-after-hours:24}") int silenceAfterHours) {
        this.brands = brands;
        this.campaigns = campaigns;
        this.groups = groups;
        this.messages = messages;
        this.insights = insights;
        this.silenceAfterHours = Math.max(1, Math.min(silenceAfterHours, 24 * 30));
    }

    public BoardView getBoard(UUID brandId, Instant now) {
        if (!brands.existsById(brandId)) throw new IllegalArgumentException("Brand not found");

        List<TaskView> tasks = insights.findTaskOperationsByBrandId(brandId).stream()
                .map(task -> {
                    boolean done = "DONE".equals(task.getTaskStatus());
                    boolean overdue = !done && task.getDueAt() != null && task.getDueAt().isBefore(now);
                    Long turnaroundSeconds = done && task.getResolvedAt() != null
                            ? Math.max(0L, Duration.between(task.getCreatedAt(), task.getResolvedAt()).getSeconds())
                            : null;
                    return new TaskView(task.getId(), task.getCampaignId(), task.getPodId(), task.getTitle(),
                            task.getDetail(), task.getDueAt(), task.getCreatedAt(), task.getTaskStatus(),
                            task.getResolvedAt(), overdue, turnaroundSeconds);
                }).toList();

        List<SilentPodView> silentPods = new ArrayList<>();
        for (var campaign : campaigns.findAllByBrandIdOrderByCreatedAtDesc(brandId)) {
            for (WhatsAppGroup group : groups.findAllByCampaignIdOrderByCreatedAtDesc(campaign.getId())) {
                if (!"ACTIVE".equals(group.getStatus()) || group.getMetaGroupId() == null) continue;
                Instant lastMessageAt = messages.findLatestActivityAt(group.getMetaGroupId());
                Instant activityAt = lastMessageAt != null ? lastMessageAt
                        : group.getConsentSentAt() != null ? group.getConsentSentAt() : group.getCreatedAt();
                long silentSeconds = Math.max(0L, Duration.between(activityAt, now).getSeconds());
                if (silentSeconds >= Duration.ofHours(silenceAfterHours).getSeconds()) {
                    silentPods.add(new SilentPodView(group.getId(), campaign.getId(), group.getMetaGroupId(),
                            group.getSubject(), activityAt, silentSeconds));
                }
            }
        }

        List<Long> completedTats = tasks.stream().map(TaskView::turnaroundSeconds)
                .filter(value -> value != null && value >= 0).toList();
        long averageTat = completedTats.isEmpty() ? 0L
                : Math.round(completedTats.stream().mapToLong(Long::longValue).average().orElse(0));
        return new BoardView(brandId, now, silenceAfterHours,
                tasks.stream().filter(task -> !"DONE".equals(task.status())).count(),
                tasks.stream().filter(TaskView::overdue).count(), silentPods.size(), completedTats.size(),
                averageTat, tasks, silentPods);
    }

    public record BoardView(UUID brandId, Instant calculatedAt, int silenceAfterHours,
                            long openTaskCount, long overdueTaskCount, long silentPodCount,
                            long completedTaskCount, long averageTurnaroundSeconds,
                            List<TaskView> tasks, List<SilentPodView> silentPods) {}

    public record TaskView(UUID id, UUID campaignId, UUID podId, String title, String detail,
                           Instant dueAt, Instant createdAt, String status, Instant resolvedAt,
                           boolean overdue, Long turnaroundSeconds) {}

    public record SilentPodView(UUID podId, UUID campaignId, String metaGroupId, String subject,
                                Instant lastActivityAt, long silentSeconds) {}
}
