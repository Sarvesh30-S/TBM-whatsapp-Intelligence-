package com.tbm.whatsapp.repository;

import com.tbm.whatsapp.entity.ImportantMessageInsight;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ImportantMessageInsightRepository extends JpaRepository<ImportantMessageInsight, UUID> {
    List<ImportantMessageInsight> findAllBySummaryIdOrderByCreatedAtAsc(UUID summaryId);
    void deleteBySummaryIdIn(List<UUID> summaryIds);

    @Query("""
            select i.id as id, c.id as campaignId, g.id as podId, c.brandId as brandId,
                   i.title as title, i.detail as detail, i.confidence as confidence,
                   i.dueAt as dueAt, i.createdAt as createdAt, i.taskStatus as taskStatus,
                   i.resolvedAt as resolvedAt
              from ImportantMessageInsight i, ConversationSummary s, WhatsAppGroup g, Campaign c
             where i.summaryId = s.id and s.whatsappGroupId = g.id and s.campaignId = c.id
               and i.category = 'TASK' and c.brandId = :brandId
             order by i.createdAt desc
            """)
    List<TaskOperationRow> findTaskOperationsByBrandId(@Param("brandId") UUID brandId);

    @Query("""
            select i from ImportantMessageInsight i, ConversationSummary s, WhatsAppGroup g, Campaign c
             where i.summaryId = s.id and s.whatsappGroupId = g.id and s.campaignId = c.id
               and i.category = 'TASK' and i.id = :taskId and c.brandId = :brandId
            """)
    Optional<ImportantMessageInsight> findTaskByIdAndBrandId(@Param("taskId") UUID taskId,
                                                             @Param("brandId") UUID brandId);

    interface TaskOperationRow {
        UUID getId();
        UUID getCampaignId();
        UUID getPodId();
        UUID getBrandId();
        String getTitle();
        String getDetail();
        BigDecimal getConfidence();
        Instant getDueAt();
        Instant getCreatedAt();
        String getTaskStatus();
        Instant getResolvedAt();
    }
}
