package com.tbm.whatsapp.service;

import com.tbm.whatsapp.entity.RawWebhookEvent;
import com.tbm.whatsapp.repository.RawWebhookEventRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

@Service
public class WebhookNormalizationProcessor {
    private static final int MAX_ATTEMPTS = 5;
    private final RawWebhookEventRepository events;
    private final WhatsAppWebhookNormalizer normalizer;

    public WebhookNormalizationProcessor(RawWebhookEventRepository events, WhatsAppWebhookNormalizer normalizer) {
        this.events = events;
        this.normalizer = normalizer;
    }

    @Transactional
    public void process(UUID eventId) {
        RawWebhookEvent event = events.findByIdForProcessing(eventId).orElse(null);
        if (event == null || "PROCESSED".equals(event.getNormalizationStatus())
                || event.getNormalizationAttempts() >= MAX_ATTEMPTS) return;
        normalizer.normalize(event);
        event.markProcessed(Instant.now());
        events.save(event);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordFailure(UUID eventId, String errorCode) {
        events.findById(eventId).ifPresent(event -> {
            if (!"PROCESSED".equals(event.getNormalizationStatus())) {
                event.markFailed(errorCode);
                events.save(event);
            }
        });
    }
}
