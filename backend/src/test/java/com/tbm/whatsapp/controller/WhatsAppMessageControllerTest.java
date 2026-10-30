package com.tbm.whatsapp.controller;

import com.tbm.whatsapp.entity.RawWebhookEvent;
import com.tbm.whatsapp.entity.WhatsAppMessage;
import com.tbm.whatsapp.repository.RawWebhookEventRepository;
import com.tbm.whatsapp.repository.WhatsAppMessageRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@TestPropertySource(properties = "app.dashboard-admin-key=test-dashboard-key")
class WhatsAppMessageControllerTest {
    private static final String ADMIN_KEY = "test-dashboard-key";

    @Autowired private MockMvc mockMvc;
    @Autowired private WhatsAppMessageRepository messageRepository;
    @Autowired private RawWebhookEventRepository rawEventRepository;

    @BeforeEach
    void cleanUp() {
        messageRepository.deleteAll();
        rawEventRepository.deleteAll();
    }

    @Test
    void rejectsMessageDeletionWithoutAdminKey() throws Exception {
        UUID id = UUID.randomUUID();
        mockMvc.perform(delete("/api/messages/" + id))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void returnsNotFoundWhenDeletingNonExistentMessage() throws Exception {
        UUID id = UUID.randomUUID();
        mockMvc.perform(delete("/api/messages/" + id)
                        .header("X-Dashboard-Admin-Key", ADMIN_KEY))
                .andExpect(status().isNotFound());
    }

    @Test
    void successfullyDeletesMessage() throws Exception {
        RawWebhookEvent rawEvent = new RawWebhookEvent(
                UUID.randomUUID(),
                "sha256:test",
                "{}",
                Instant.now()
        );
        rawEventRepository.save(rawEvent);

        UUID messageId = UUID.randomUUID();
        WhatsAppMessage message = new WhatsAppMessage(
                messageId,
                rawEvent.getId(),
                "wamid.test.123",
                "waba-1",
                "phone-1",
                null,
                "1234567890",
                "text",
                Instant.now(),
                "Hello to be deleted",
                "{}",
                Instant.now()
        );
        messageRepository.save(message);
        assertThat(messageRepository.existsById(messageId)).isTrue();

        mockMvc.perform(delete("/api/messages/" + messageId)
                        .header("X-Dashboard-Admin-Key", ADMIN_KEY))
                .andExpect(status().isNoContent());

        assertThat(messageRepository.existsById(messageId)).isFalse();
    }
}
