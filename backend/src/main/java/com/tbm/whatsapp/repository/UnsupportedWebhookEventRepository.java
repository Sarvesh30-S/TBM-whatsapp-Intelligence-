package com.tbm.whatsapp.repository;

import com.tbm.whatsapp.entity.UnsupportedWebhookEvent;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface UnsupportedWebhookEventRepository extends JpaRepository<UnsupportedWebhookEvent, UUID> {
    boolean existsByRawEventIdAndPayloadSha256(UUID rawEventId, String payloadSha256);
}
