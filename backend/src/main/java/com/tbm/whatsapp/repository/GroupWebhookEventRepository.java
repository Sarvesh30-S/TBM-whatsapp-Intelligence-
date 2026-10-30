package com.tbm.whatsapp.repository;

import com.tbm.whatsapp.entity.GroupWebhookEvent;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface GroupWebhookEventRepository extends JpaRepository<GroupWebhookEvent, UUID> {
    boolean existsByRawEventIdAndPayloadSha256(UUID rawEventId, String payloadSha256);
}
