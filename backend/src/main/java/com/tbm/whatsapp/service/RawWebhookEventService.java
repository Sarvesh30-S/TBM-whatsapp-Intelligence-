package com.tbm.whatsapp.service;

import com.tbm.whatsapp.entity.RawWebhookEvent;
import com.tbm.whatsapp.repository.RawWebhookEventRepository;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.HexFormat;
import java.util.UUID;
import org.springframework.transaction.annotation.Transactional;

@Service
public class RawWebhookEventService {
    private final RawWebhookEventRepository repository;

    public RawWebhookEventService(RawWebhookEventRepository repository) {
        this.repository = repository;
    }

    /** Persist a signed webhook body once; the unique hash also makes concurrent retries safe. */
    @Transactional
    public RawWebhookEvent storeOrGet(String rawBody) {
        String fingerprint = sha256(rawBody);
        var existing = repository.findByPayloadSha256(fingerprint);
        if (existing.isPresent()) return existing.get();

        try {
            return repository.saveAndFlush(new RawWebhookEvent(UUID.randomUUID(), fingerprint, rawBody, Instant.now()));
        } catch (DataIntegrityViolationException exception) {
            if (isUniqueConstraintViolation(exception)) {
                return repository.findByPayloadSha256(fingerprint).orElseThrow(() -> exception);
            }
            throw exception;
        }
    }

    private String sha256(String value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (Exception exception) {
            throw new IllegalStateException("SHA-256 is unavailable", exception);
        }
    }

    private boolean isUniqueConstraintViolation(Throwable exception) {
        Throwable current = exception;
        while (current != null) {
            if (current instanceof java.sql.SQLException sqlException
                    && "23505".equals(sqlException.getSQLState())) {
                return true;
            }
            current = current.getCause();
        }
        return false;
    }
}
