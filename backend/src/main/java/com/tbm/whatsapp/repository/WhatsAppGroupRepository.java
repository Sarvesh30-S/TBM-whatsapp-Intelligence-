package com.tbm.whatsapp.repository;

import com.tbm.whatsapp.entity.WhatsAppGroup;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface WhatsAppGroupRepository extends JpaRepository<WhatsAppGroup, UUID> {
    List<WhatsAppGroup> findAllByCampaignIdOrderByCreatedAtDesc(UUID campaignId);
    List<WhatsAppGroup> findAllByOrderByCreatedAtDesc();
    List<WhatsAppGroup> findAllByMetaGroupIdIsNotNull();
    Optional<WhatsAppGroup> findByMetaGroupId(String metaGroupId);
}
