package com.tbm.whatsapp.service;

import com.tbm.whatsapp.repository.RawWebhookEventRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class WebhookNormalizationWorker {
    private static final Logger log = LoggerFactory.getLogger(WebhookNormalizationWorker.class);
    private final RawWebhookEventRepository events;
    private final WebhookNormalizationProcessor processor;
    private final int maxAttempts;

    public WebhookNormalizationWorker(RawWebhookEventRepository events, WebhookNormalizationProcessor processor,
                                      @Value("${app.webhook.normalization-max-attempts:5}") int maxAttempts) {
        this.events = events;
        this.processor = processor;
        this.maxAttempts = Math.max(1, Math.min(maxAttempts, 20));
    }

    @Scheduled(fixedDelayString = "${app.webhook.normalization-delay-ms:500}")
    public synchronized void processPendingEvents() {
        var pending = events.findTop10ByNormalizationStatusInAndNormalizationAttemptsLessThanOrderByReceivedAtAsc(
                List.of("PENDING", "FAILED"), maxAttempts);
        for (var event : pending) {
            try {
                processor.process(event.getId());
            } catch (Exception exception) {
                String errorCode = exception instanceof IllegalArgumentException ? "INVALID_PAYLOAD" : "NORMALIZATION_FAILED";
                processor.recordFailure(event.getId(), errorCode);
                log.warn("Webhook normalization failed for event {} ({})", event.getId(), errorCode);
            }
        }
    }
}
