package com.tbm.whatsapp.repository;

import com.tbm.whatsapp.entity.WhatsAppMessageAsset;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface WhatsAppMessageAssetRepository extends JpaRepository<WhatsAppMessageAsset, UUID> {
    boolean existsByProviderMediaId(String providerMediaId);
    List<WhatsAppMessageAsset> findAllByStatusOrderByCreatedAtAsc(String status, Pageable pageable);
    List<WhatsAppMessageAsset> findAllByStatusInOrderByCreatedAtAsc(List<String> statuses, Pageable pageable);
    List<WhatsAppMessageAsset> findAllByWhatsappMessageIdIn(List<UUID> whatsappMessageIds);

    @Modifying
    @Query("delete from WhatsAppMessageAsset a where a.whatsappMessageId = :messageId")
    void deleteByWhatsappMessageId(@Param("messageId") UUID messageId);
}
