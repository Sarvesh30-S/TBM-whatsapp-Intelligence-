package com.tbm.whatsapp.service;

import org.springframework.stereotype.Service;

@Service
public class WhatsAppWebhookIngestionService {
    private final RawWebhookEventService rawEvents;

    public WhatsAppWebhookIngestionService(RawWebhookEventService rawEvents) {
        this.rawEvents = rawEvents;
    }

    public void ingest(String rawBody) {
        rawEvents.storeOrGet(rawBody);
    }
}
