package com.tbm.whatsapp.security;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tbm.whatsapp.entity.AuditLog;
import com.tbm.whatsapp.entity.User;
import com.tbm.whatsapp.repository.AuditLogRepository;
import com.tbm.whatsapp.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Pattern;

@Service
public class AuditLoggingService {
    private static final Logger log = LoggerFactory.getLogger(AuditLoggingService.class);
    private static final Pattern SENSITIVE_KEYS = Pattern.compile("(?i)(password|token|secret|key|authorization|cookie)");
    private final AuditLogRepository auditLogRepository;
    private final UserRepository userRepository;
    private final ObjectMapper objectMapper;

    public AuditLoggingService(AuditLogRepository auditLogRepository, UserRepository userRepository, ObjectMapper objectMapper) {
        this.auditLogRepository = auditLogRepository;
        this.userRepository = userRepository;
        this.objectMapper = objectMapper;
    }

    @Async
    public void record(UUID userId, String action, String resourceType, String resourceId,
                       String ipAddress, String status, Map<String, Object> metadata) {
        try {
            User user = userId != null ? userRepository.findById(userId).orElse(null) : null;
            String correlationId = MDC.get("correlationId");
            if (correlationId == null || correlationId.isBlank()) {
                correlationId = UUID.randomUUID().toString();
            }

            Map<String, Object> sanitized = sanitizeMetadata(metadata);
            String json = sanitized != null && !sanitized.isEmpty() ? objectMapper.writeValueAsString(sanitized) : "{}";

            AuditLog entry = new AuditLog(
                    UUID.randomUUID(),
                    user,
                    action,
                    resourceType,
                    resourceId,
                    ipAddress,
                    correlationId,
                    status,
                    json
            );

            auditLogRepository.save(entry);
        } catch (JsonProcessingException e) {
            log.error("Failed to serialize audit log metadata for action {}: {}", action, e.getMessage());
        } catch (Exception e) {
            log.error("Failed to persist audit log entry: {}", e.getMessage());
        }
    }

    private Map<String, Object> sanitizeMetadata(Map<String, Object> input) {
        if (input == null) return null;
        Map<String, Object> sanitized = new HashMap<>();
        input.forEach((key, value) -> {
            if (SENSITIVE_KEYS.matcher(key).find()) {
                sanitized.put(key, "[REDACTED]");
            } else if (value instanceof Map<?, ?> mapVal) {
                // Nested sanitization
                Map<String, Object> castMap = new HashMap<>();
                mapVal.forEach((k, v) -> castMap.put(String.valueOf(k), v));
                sanitized.put(key, sanitizeMetadata(castMap));
            } else {
                sanitized.put(key, value);
            }
        });
        return sanitized;
    }
}
