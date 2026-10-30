package com.tbm.whatsapp.controller;

import com.tbm.whatsapp.repository.RawWebhookEventRepository;
import com.tbm.whatsapp.repository.WhatsAppMessageRepository;
import com.tbm.whatsapp.repository.WhatsAppMessageStatusRepository;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
public class HealthController {
    private final RawWebhookEventRepository webhookEventRepository;
    private final WhatsAppMessageRepository messageRepository;
    private final WhatsAppMessageStatusRepository statusRepository;

    public HealthController(RawWebhookEventRepository webhookEventRepository,
                            WhatsAppMessageRepository messageRepository,
                            WhatsAppMessageStatusRepository statusRepository) {
        this.webhookEventRepository = webhookEventRepository;
        this.messageRepository = messageRepository;
        this.statusRepository = statusRepository;
    }

    @GetMapping("/api/health")
    public Map<String, String> health() {
        return Map.of(
                "status", "UP",
                "service", "whatsapp-intelligence-api",
                "storedWebhookEvents", Long.toString(webhookEventRepository.count()),
                "pendingWebhookNormalizations", Long.toString(webhookEventRepository.countByNormalizationStatus("PENDING")),
                "failedWebhookNormalizations", Long.toString(webhookEventRepository.countByNormalizationStatus("FAILED")),
                "storedMessages", Long.toString(messageRepository.count()),
                "storedStatuses", Long.toString(statusRepository.count()));
    }
}
