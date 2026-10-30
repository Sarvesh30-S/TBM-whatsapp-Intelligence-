package com.tbm.whatsapp.webhook;

import com.tbm.whatsapp.config.MetaApiProperties;
import com.tbm.whatsapp.service.WhatsAppWebhookIngestionService;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class WhatsAppWebhookController {
    private final MetaApiProperties properties;
    private final MetaWebhookSignatureVerifier signatureVerifier;
    private final WhatsAppWebhookIngestionService eventService;

    public WhatsAppWebhookController(MetaApiProperties properties,
                                     MetaWebhookSignatureVerifier signatureVerifier,
                                     WhatsAppWebhookIngestionService eventService) {
        this.properties = properties;
        this.signatureVerifier = signatureVerifier;
        this.eventService = eventService;
    }

    @GetMapping(value = "/webhook/whatsapp", produces = MediaType.TEXT_PLAIN_VALUE)
    public ResponseEntity<String> verifyWebhook(
            @RequestParam(name = "hub.mode", required = false) String mode,
            @RequestParam(name = "hub.verify_token", required = false) String verifyToken,
            @RequestParam(name = "hub.challenge", required = false) String challenge) {
        if ("subscribe".equals(mode)
                && constantTimeEquals(properties.webhookVerifyToken(), verifyToken)
                && challenge != null) {
            return ResponseEntity.ok(challenge);
        }
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Forbidden");
    }

    @PostMapping(value = "/webhook/whatsapp", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Void> receiveWebhook(
            @RequestBody String rawBody,
            @RequestHeader(name = "X-Hub-Signature-256", required = false) String signature) {
        if (!StringUtils.hasText(properties.appSecret())) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).build();
        }
        if (!signatureVerifier.isValid(rawBody, signature, properties.appSecret())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        eventService.ingest(rawBody);
        // Keep the handler fast: media, AI, and business processing run in later phases.
        return ResponseEntity.ok().build();
    }

    private boolean constantTimeEquals(String expected, String actual) {
        if (expected == null || actual == null) return false;
        return java.security.MessageDigest.isEqual(
                expected.getBytes(java.nio.charset.StandardCharsets.UTF_8),
                actual.getBytes(java.nio.charset.StandardCharsets.UTF_8));
    }
}
