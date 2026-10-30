package com.tbm.whatsapp.repository;

import com.tbm.whatsapp.entity.RawWebhookEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;

import java.util.UUID;
import java.util.Optional;
import java.util.List;

public interface RawWebhookEventRepository extends JpaRepository<RawWebhookEvent, UUID> {
    boolean existsByPayloadSha256(String payloadSha256);
    Optional<RawWebhookEvent> findByPayloadSha256(String payloadSha256);
    List<RawWebhookEvent> findTop10ByNormalizationStatusInAndNormalizationAttemptsLessThanOrderByReceivedAtAsc(
            List<String> statuses, int maxAttempts);
    long countByNormalizationStatus(String normalizationStatus);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select event from RawWebhookEvent event where event.id = :eventId")
    Optional<RawWebhookEvent> findByIdForProcessing(@Param("eventId") UUID eventId);
}
