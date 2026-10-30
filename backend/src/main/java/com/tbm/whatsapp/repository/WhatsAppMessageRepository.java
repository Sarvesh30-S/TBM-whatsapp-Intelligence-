package com.tbm.whatsapp.repository;

import com.tbm.whatsapp.entity.WhatsAppMessage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.Optional;

public interface WhatsAppMessageRepository extends JpaRepository<WhatsAppMessage, UUID> {
    long countBySenderId(String senderId);
    boolean existsByProviderMessageId(String providerMessageId);
    Optional<WhatsAppMessage> findByProviderMessageId(String providerMessageId);
    java.util.List<WhatsAppMessage> findAllByOrderByCreatedAtDesc(Pageable pageable);
    List<WhatsAppMessage> findAllByGroupIdAndCreatedAtAfterOrderByCreatedAtAsc(String groupId, Instant after, Pageable pageable);
    List<WhatsAppMessage> findAllByGroupIdOrderByCreatedAtAsc(String groupId, Pageable pageable);

    @Query("select max(coalesce(m.messageTimestamp, m.createdAt)) from WhatsAppMessage m where m.groupId = :groupId")
    java.time.Instant findLatestActivityAt(@Param("groupId") String groupId);
}
