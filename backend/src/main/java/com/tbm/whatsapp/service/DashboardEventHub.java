package com.tbm.whatsapp.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.time.Instant;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class DashboardEventHub {
    private static final Logger log = LoggerFactory.getLogger(DashboardEventHub.class);
    private final ConcurrentHashMap<UUID, Set<SseEmitter>> emittersByBrand = new ConcurrentHashMap<>();

    public SseEmitter subscribe(UUID brandId) {
        SseEmitter emitter = new SseEmitter(60L * 60L * 1000L);
        Set<SseEmitter> brandEmitters = emittersByBrand.computeIfAbsent(brandId, ignored -> ConcurrentHashMap.newKeySet());
        brandEmitters.add(emitter);
        emitter.onCompletion(() -> remove(brandId, emitter));
        emitter.onTimeout(() -> remove(brandId, emitter));
        emitter.onError(ignored -> remove(brandId, emitter));
        try {
            emitter.send(SseEmitter.event().name("connected").data(Map.of("brandId", brandId, "connectedAt", Instant.now())));
        } catch (IOException exception) {
            remove(brandId, emitter);
        }
        return emitter;
    }

    public void publish(UUID brandId, Map<String, ?> payload) {
        Set<SseEmitter> subscribers = emittersByBrand.get(brandId);
        if (subscribers == null || subscribers.isEmpty()) return;
        for (SseEmitter emitter : subscribers) {
            try {
                emitter.send(SseEmitter.event().name("dashboard-update").data(payload));
            } catch (IOException | IllegalStateException exception) {
                log.debug("Removing a disconnected dashboard event stream for brand {}", brandId);
                remove(brandId, emitter);
            }
        }
    }

    @Scheduled(fixedDelay = 20000)
    public void heartbeat() {
        Instant now = Instant.now();
        emittersByBrand.forEach((brandId, emitters) -> emitters.forEach(emitter -> {
            try {
                emitter.send(SseEmitter.event().name("heartbeat").data(Map.of("at", now.toString())));
            } catch (IOException | IllegalStateException exception) {
                remove(brandId, emitter);
            }
        }));
    }

    private void remove(UUID brandId, SseEmitter emitter) {
        Set<SseEmitter> emitters = emittersByBrand.get(brandId);
        if (emitters == null) return;
        emitters.remove(emitter);
        if (emitters.isEmpty()) emittersByBrand.remove(brandId, emitters);
    }

    int subscriberCount(UUID brandId) {
        Set<SseEmitter> emitters = emittersByBrand.get(brandId);
        return emitters == null ? 0 : emitters.size();
    }
}
