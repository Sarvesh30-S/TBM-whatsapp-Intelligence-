package com.tbm.whatsapp.repository;

import com.tbm.whatsapp.entity.WhatsAppMessageStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface WhatsAppMessageStatusRepository extends JpaRepository<WhatsAppMessageStatus, UUID> {
    long countByProviderMessageId(String providerMessageId);
    boolean existsByStatusKey(String statusKey);
}
