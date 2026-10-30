package com.tbm.whatsapp.service;

import org.junit.jupiter.api.Test;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class DashboardEventHubTest {
    @Test
    void evictsCompletedEmitterWhenAWriteDetectsTheDeadConnection() {
        DashboardEventHub hub = new DashboardEventHub();
        UUID brandId = UUID.randomUUID();
        SseEmitter emitter = hub.subscribe(brandId);

        assertThat(hub.subscriberCount(brandId)).isEqualTo(1);
        emitter.complete();
        hub.publish(brandId, Map.of("type", "message"));

        assertThat(hub.subscriberCount(brandId)).isZero();
        hub.publish(brandId, Map.of("type", "message"));
        assertThat(hub.subscriberCount(brandId)).isZero();
    }
}
