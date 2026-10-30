package com.tbm.whatsapp.repository;

import com.tbm.whatsapp.entity.WhatsAppGroupParticipant;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface WhatsAppGroupParticipantRepository extends JpaRepository<WhatsAppGroupParticipant, UUID> {
    List<WhatsAppGroupParticipant> findAllByWhatsappGroupId(UUID whatsappGroupId);
    List<WhatsAppGroupParticipant> findAllByWhatsappGroupIdAndStatus(UUID whatsappGroupId, String status);
    Optional<WhatsAppGroupParticipant> findByWhatsappGroupIdAndPersonId(UUID whatsappGroupId, UUID personId);
    boolean existsByWhatsappGroupIdAndPersonId(UUID whatsappGroupId, UUID personId);
    long countByWhatsappGroupIdAndStatus(UUID whatsappGroupId, String status);
}
