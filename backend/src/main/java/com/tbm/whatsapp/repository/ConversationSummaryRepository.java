package com.tbm.whatsapp.repository;

import com.tbm.whatsapp.entity.ConversationSummary;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ConversationSummaryRepository extends JpaRepository<ConversationSummary, UUID> {
    Optional<ConversationSummary> findFirstByWhatsappGroupIdOrderByWindowEndDesc(UUID whatsappGroupId);
    List<ConversationSummary> findAllByCampaignIdOrderByWindowEndDesc(UUID campaignId, Pageable pageable);
    List<ConversationSummary> findAllByWhatsappGroupIdOrderByWindowEndDesc(UUID whatsappGroupId, Pageable pageable);
    List<ConversationSummary> findAllByCampaignId(UUID campaignId);
    List<ConversationSummary> findAllByWhatsappGroupId(UUID whatsappGroupId);
}
