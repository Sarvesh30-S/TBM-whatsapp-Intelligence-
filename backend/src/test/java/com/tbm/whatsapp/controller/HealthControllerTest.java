package com.tbm.whatsapp.controller;

import com.tbm.whatsapp.repository.RawWebhookEventRepository;
import com.tbm.whatsapp.repository.WhatsAppMessageRepository;
import com.tbm.whatsapp.repository.WhatsAppMessageStatusRepository;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class HealthControllerTest {
    @Test
    void healthReportsUp() {
        RawWebhookEventRepository repository = mock(RawWebhookEventRepository.class);
        WhatsAppMessageRepository messages = mock(WhatsAppMessageRepository.class);
        WhatsAppMessageStatusRepository statuses = mock(WhatsAppMessageStatusRepository.class);
        when(repository.count()).thenReturn(3L);
        when(messages.count()).thenReturn(2L);
        when(statuses.count()).thenReturn(4L);

        assertThat(new HealthController(repository, messages, statuses).health())
                .containsEntry("status", "UP")
                .containsEntry("storedWebhookEvents", "3")
                .containsEntry("storedMessages", "2")
                .containsEntry("storedStatuses", "4");
    }
}
