package com.tbm.whatsapp.webhook;

import com.tbm.whatsapp.repository.RawWebhookEventRepository;
import com.tbm.whatsapp.repository.WhatsAppMessageRepository;
import com.tbm.whatsapp.repository.WhatsAppMessageStatusRepository;
import com.tbm.whatsapp.repository.WhatsAppMessageAssetRepository;
import com.tbm.whatsapp.repository.UnsupportedWebhookEventRepository;
import com.tbm.whatsapp.repository.GroupWebhookEventRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.HexFormat;
import java.time.Instant;
import java.sql.Timestamp;
import java.util.UUID;
import java.util.function.BooleanSupplier;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@TestPropertySource(properties = {"meta.app-secret=integration-test-secret", "app.dashboard-admin-key=test-dashboard-key"})
class RawWebhookPersistenceIntegrationTest {
    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private RawWebhookEventRepository repository;

    @Autowired
    private WhatsAppMessageRepository messageRepository;

    @Autowired
    private WhatsAppMessageStatusRepository statusRepository;

    @Autowired
    private WhatsAppMessageAssetRepository assetRepository;

    @Autowired
    private UnsupportedWebhookEventRepository unsupportedRepository;

    @Autowired
    private GroupWebhookEventRepository groupEventRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void clearEvents() {
        groupEventRepository.deleteAll();
        unsupportedRepository.deleteAll();
        assetRepository.deleteAll();
        statusRepository.deleteAll();
        messageRepository.deleteAll();
        repository.deleteAll();
    }

    @Test
    void persistsSignedWebhookAndDeduplicatesRetry() throws Exception {
        String body = "{\"object\":\"whatsapp_business_account\",\"entry\":[{\"id\":\"test-waba\",\"changes\":[{\"field\":\"messages\",\"value\":{\"metadata\":{\"phone_number_id\":\"test-phone\"},\"messages\":[{\"from\":\"15551234567\",\"id\":\"wamid.test.1\",\"timestamp\":\"1793001000\",\"type\":\"text\",\"group_id\":\"test-group-1\",\"text\":{\"body\":\"Hello from test\"}}],\"statuses\":[{\"id\":\"wamid.test.1\",\"status\":\"delivered\",\"timestamp\":\"1793001005\",\"recipient_id\":\"15551234567\"}]}}]}]}";
        String signature = signature(body, "integration-test-secret");

        mockMvc.perform(post("/webhook/whatsapp")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-Hub-Signature-256", signature)
                        .content(body))
                .andExpect(status().isOk());
        await(() -> messageRepository.count() == 1 && statusRepository.count() == 1);
        assertThat(repository.count()).isEqualTo(1);
        assertThat(messageRepository.count()).isEqualTo(1);
        assertThat(messageRepository.findAll().getFirst().getTextBody()).isEqualTo("Hello from test");
        assertThat(messageRepository.findAll().getFirst().getGroupId()).isEqualTo("test-group-1");
        assertThat(statusRepository.countByProviderMessageId("wamid.test.1")).isEqualTo(1);
        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get("/api/messages")
                        .header("X-Dashboard-Admin-Key", "test-dashboard-key"))
                .andExpect(status().isOk())
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath("$[0].text").value("Hello from test"))
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath("$[0].senderId").value("15551234567"))
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath("$[0].groupId").value("test-group-1"));

        mockMvc.perform(post("/webhook/whatsapp")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-Hub-Signature-256", signature)
                        .content(body))
                .andExpect(status().isOk());
        assertThat(repository.count()).isEqualTo(1);
        assertThat(messageRepository.count()).isEqualTo(1);
        assertThat(statusRepository.count()).isEqualTo(1);
    }

    @Test
    void rejectsInvalidSignatureWithoutPersistingPayload() throws Exception {
        mockMvc.perform(post("/webhook/whatsapp")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-Hub-Signature-256", "sha256=00")
                        .content("{\"object\":\"whatsapp_business_account\"}"))
                .andExpect(status().isForbidden());

        assertThat(repository.count()).isZero();
    }

    @Test
    void healthEndpointReportsStoredEventCountWithoutPayload() throws Exception {
        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get("/api/health"))
                .andExpect(status().isOk())
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath("$.storedWebhookEvents").value(0));
    }

    @Test
    void messageSnapshotRequiresDashboardAuthentication() throws Exception {
        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get("/api/messages"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void activeGroupRequiresConsentToHaveBeenSent() {
        Instant now = Instant.now();
        UUID brandId = UUID.randomUUID();
        UUID campaignId = UUID.randomUUID();
        jdbcTemplate.update("INSERT INTO brands (id, slug, name, created_at) VALUES (?, ?, ?, ?)",
                brandId, "brand-" + brandId, "Test Brand", Timestamp.from(now));
        jdbcTemplate.update("INSERT INTO campaigns (id, brand_id, slug, name, status, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                campaignId, brandId, "campaign-" + campaignId, "Test Campaign", "DRAFT", Timestamp.from(now));

        UUID blockedGroupId = UUID.randomUUID();
        assertThatThrownBy(() -> jdbcTemplate.update("""
                INSERT INTO whatsapp_groups (id, campaign_id, subject, join_approval_mode, status, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """, blockedGroupId, campaignId, "Not consented", "approval_required", "ACTIVE",
                Timestamp.from(now), Timestamp.from(now)))
                .isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);

        jdbcTemplate.update("""
                INSERT INTO whatsapp_groups (id, campaign_id, subject, join_approval_mode, status, consent_sent_at, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, UUID.randomUUID(), campaignId, "Consented", "approval_required", "ACTIVE",
                Timestamp.from(now), Timestamp.from(now), Timestamp.from(now));
    }

    @Test
    void groupLifecycleUpdateStoresOnlyAValidatedInviteLinkOnItsPod() throws Exception {
        Instant now = Instant.now();
        UUID brandId = UUID.randomUUID();
        UUID campaignId = UUID.randomUUID();
        UUID podId = UUID.randomUUID();
        String groupId = "meta-group-" + UUID.randomUUID();
        jdbcTemplate.update("INSERT INTO brands (id, slug, name, created_at) VALUES (?, ?, ?, ?)",
                brandId, "brand-" + brandId, "Test Brand", Timestamp.from(now));
        jdbcTemplate.update("INSERT INTO campaigns (id, brand_id, slug, name, status, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                campaignId, brandId, "campaign-" + campaignId, "Test Campaign", "DRAFT", Timestamp.from(now));
        jdbcTemplate.update("""
                INSERT INTO whatsapp_groups (id, campaign_id, meta_group_id, subject, join_approval_mode,
                    status, planned_external_seats, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, podId, campaignId, groupId, "Test Pod", "approval_required", "PENDING_CONSENT", 7,
                Timestamp.from(now), Timestamp.from(now));

        String body = """
                {"object":"whatsapp_business_account","entry":[{"id":"test-waba","changes":[{"field":"group_lifecycle_update","value":{"group_id":"%s","data":{"invite_link":"https://chat.whatsapp.com/AbCdEf0123456789"}}}]}]}
                """.formatted(groupId);
        mockMvc.perform(post("/webhook/whatsapp")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-Hub-Signature-256", signature(body, "integration-test-secret"))
                        .content(body))
                .andExpect(status().isOk());
        await(() -> jdbcTemplate.queryForObject("SELECT invite_link FROM whatsapp_groups WHERE id = ?", String.class, podId) != null);

        String inviteLink = jdbcTemplate.queryForObject("SELECT invite_link FROM whatsapp_groups WHERE id = ?", String.class, podId);
        assertThat(inviteLink).isEqualTo("https://chat.whatsapp.com/AbCdEf0123456789");
        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM group_webhook_events WHERE meta_group_id = ?", Long.class, groupId))
                .isEqualTo(1L);
    }

    @Test
    void summarySourceDetailReturnsOnlyCitedMessagesFromItsCampaignPod() throws Exception {
        Instant now = Instant.now();
        UUID brandId = UUID.randomUUID();
        UUID campaignId = UUID.randomUUID();
        UUID podId = UUID.randomUUID();
        UUID summaryId = UUID.randomUUID();
        UUID itemId = UUID.randomUUID();
        UUID citedMessageId = UUID.randomUUID();
        UUID wrongPodMessageId = UUID.randomUUID();
        UUID rawEventId = UUID.randomUUID();
        UUID wrongPodEventId = UUID.randomUUID();
        String groupId = "source-group-" + UUID.randomUUID();

        jdbcTemplate.update("INSERT INTO brands (id, slug, name, created_at) VALUES (?, ?, ?, ?)",
                brandId, "brand-" + brandId, "Source Brand", Timestamp.from(now));
        jdbcTemplate.update("INSERT INTO campaigns (id, brand_id, slug, name, status, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                campaignId, brandId, "campaign-" + campaignId, "Source Campaign", "ACTIVE", Timestamp.from(now));
        jdbcTemplate.update("""
                INSERT INTO whatsapp_groups (id, campaign_id, meta_group_id, subject, join_approval_mode,
                    status, planned_external_seats, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, podId, campaignId, groupId, "Source Pod", "approval_required", "PENDING_CONSENT", 2,
                Timestamp.from(now), Timestamp.from(now));
        jdbcTemplate.update("INSERT INTO raw_webhook_events (id, payload_sha256, payload, received_at) VALUES (?, ?, ?, ?)",
                rawEventId, "a".repeat(64), "{}", Timestamp.from(now));
        jdbcTemplate.update("INSERT INTO raw_webhook_events (id, payload_sha256, payload, received_at) VALUES (?, ?, ?, ?)",
                wrongPodEventId, "b".repeat(64), "{}", Timestamp.from(now));
        insertSourceMessage(citedMessageId, rawEventId, groupId, "Message from the campaign pod", now);
        insertSourceMessage(wrongPodMessageId, wrongPodEventId, "unrelated-group", "Must not be returned", now);

        String allSourceIds = "[\"%s\",\"%s\"]".formatted(citedMessageId, wrongPodMessageId);
        String itemSourceIds = "[\"%s\"]".formatted(citedMessageId);
        jdbcTemplate.update("""
                INSERT INTO conversation_summaries (id, campaign_id, whatsapp_group_id, window_start, window_end,
                    summary_text, confidence, review_status, source_message_ids, provider, model, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, summaryId, campaignId, podId, Timestamp.from(now.minusSeconds(60)), Timestamp.from(now),
                "Please replace the device.", 0.95, "READY", allSourceIds, "openai", "test-model", Timestamp.from(now));
        jdbcTemplate.update("""
                INSERT INTO important_message_insights (id, summary_id, category, title, detail, confidence,
                    review_status, source_message_ids, due_at, created_at, task_status, resolved_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, itemId, summaryId, "TASK", "Replace device", "Arrange a replacement.", 0.9,
                "READY", itemSourceIds, null, Timestamp.from(now), "OPEN", null);

        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .get("/api/admin/campaigns/{campaignId}/summaries/{summaryId}/sources", campaignId, summaryId)
                        .header("X-Dashboard-Admin-Key", "test-dashboard-key"))
                .andExpect(status().isOk())
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath("$", org.hamcrest.Matchers.hasSize(1)))
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath("$[0].text").value("Message from the campaign pod"));

        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .get("/api/admin/campaigns/{campaignId}/summaries/{summaryId}/sources", campaignId, summaryId)
                        .param("itemId", itemId.toString())
                        .header("X-Dashboard-Admin-Key", "test-dashboard-key"))
                .andExpect(status().isOk())
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath("$", org.hamcrest.Matchers.hasSize(1)))
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath("$[0].id").value(citedMessageId.toString()));

        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .get("/api/admin/campaigns/{campaignId}/summaries/{summaryId}/sources", UUID.randomUUID(), summaryId)
                        .header("X-Dashboard-Admin-Key", "test-dashboard-key"))
                .andExpect(status().isNotFound());
    }

    private void insertSourceMessage(UUID messageId, UUID rawEventId, String groupId, String body, Instant now) {
        jdbcTemplate.update("""
                INSERT INTO whatsapp_messages (id, raw_event_id, provider_message_id, waba_id, phone_number_id,
                    group_id, sender_id, message_type, message_timestamp, text_body, message_payload, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, messageId, rawEventId, "wamid." + messageId, "test-waba", "test-phone", groupId,
                "15551234567", "text", Timestamp.from(now), body, "{}", Timestamp.from(now));
    }

    @Test
    void unsupportedWebhookFieldsAreDurablyClassifiedByTheBackgroundWorker() throws Exception {
        String body = """
                {"object":"whatsapp_business_account","entry":[{"id":"test-waba","changes":[{"field":"synthetic_unknown_field","value":{"probe":"unsupported-log-test"}}]}]}
                """;
        mockMvc.perform(post("/webhook/whatsapp")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-Hub-Signature-256", signature(body, "integration-test-secret"))
                        .content(body))
                .andExpect(status().isOk());

        await(() -> unsupportedRepository.count() == 1);
        assertThat(unsupportedRepository.findAll().getFirst().getEventField()).isEqualTo("synthetic_unknown_field");
    }

    @Test
    void operationsMetricsCalculateOverdueSilenceAndTaskTurnaroundWithinBrandScope() throws Exception {
        Instant now = Instant.now();
        Instant taskCreatedAt = now.minusSeconds(3 * 60 * 60);
        Instant dueAt = now.minusSeconds(60);
        UUID brandId = UUID.randomUUID();
        UUID otherBrandId = UUID.randomUUID();
        UUID campaignId = UUID.randomUUID();
        UUID podId = UUID.randomUUID();
        UUID summaryId = UUID.randomUUID();
        UUID taskId = UUID.randomUUID();
        String metaGroupId = "metrics-group-" + UUID.randomUUID();
        jdbcTemplate.update("INSERT INTO brands (id, slug, name, created_at) VALUES (?, ?, ?, ?)",
                brandId, "brand-" + brandId, "Metrics Brand", Timestamp.from(now));
        jdbcTemplate.update("INSERT INTO brands (id, slug, name, created_at) VALUES (?, ?, ?, ?)",
                otherBrandId, "brand-" + otherBrandId, "Other Brand", Timestamp.from(now));
        jdbcTemplate.update("INSERT INTO campaigns (id, brand_id, slug, name, status, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                campaignId, brandId, "campaign-" + campaignId, "Metrics Campaign", "ACTIVE", Timestamp.from(now));
        jdbcTemplate.update("""
                INSERT INTO whatsapp_groups (id, campaign_id, meta_group_id, subject, join_approval_mode,
                    status, consent_sent_at, planned_external_seats, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, podId, campaignId, metaGroupId, "Quiet Pod", "approval_required", "ACTIVE",
                Timestamp.from(now.minusSeconds(48 * 60 * 60)), 7, Timestamp.from(now.minusSeconds(48 * 60 * 60)),
                Timestamp.from(now.minusSeconds(48 * 60 * 60)));
        jdbcTemplate.update("""
                INSERT INTO conversation_summaries (id, campaign_id, whatsapp_group_id, window_start, window_end,
                    summary_text, confidence, review_status, source_message_ids, provider, model, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, summaryId, campaignId, podId, Timestamp.from(taskCreatedAt), Timestamp.from(now),
                "Need to replace the client device.", 0.9, "READY", "[]", "openai", "test-model", Timestamp.from(now));
        jdbcTemplate.update("""
                INSERT INTO important_message_insights (id, summary_id, category, title, detail, confidence,
                    review_status, source_message_ids, due_at, created_at, task_status, resolved_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, taskId, summaryId, "TASK", "Replace the client device", "Coordinate the replacement.",
                0.9, "READY", "[]", Timestamp.from(dueAt), Timestamp.from(taskCreatedAt), "OPEN", null);

        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .get("/api/admin/brands/{brandId}/operations", brandId)
                        .header("X-Dashboard-Admin-Key", "test-dashboard-key"))
                .andExpect(status().isOk())
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath("$.openTaskCount").value(1))
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath("$.overdueTaskCount").value(1))
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath("$.silentPodCount").value(1))
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath("$.tasks[0].overdue").value(true));

        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .get("/api/admin/campaigns/{campaignId}/summaries", campaignId)
                        .header("X-Dashboard-Admin-Key", "test-dashboard-key"))
                .andExpect(status().isOk())
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath("$[0].sourceMessageIds").isArray())
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath("$[0].items[0].sourceMessageIds").isArray());

        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .put("/api/admin/brands/{brandId}/operations/tasks/{taskId}", otherBrandId, taskId)
                        .header("X-Dashboard-Admin-Key", "test-dashboard-key")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"DONE\"}"))
                .andExpect(status().isNotFound());

        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .put("/api/admin/brands/{brandId}/operations/tasks/{taskId}", brandId, taskId)
                        .header("X-Dashboard-Admin-Key", "test-dashboard-key")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"DONE\"}"))
                .andExpect(status().isOk())
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath("$.status").value("DONE"));

        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .put("/api/admin/brands/{brandId}/operations/tasks/{taskId}", brandId, taskId)
                        .header("X-Dashboard-Admin-Key", "test-dashboard-key")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"OPEN\"}"))
                .andExpect(status().isConflict());

        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .get("/api/admin/brands/{brandId}/operations", brandId)
                        .header("X-Dashboard-Admin-Key", "test-dashboard-key"))
                .andExpect(status().isOk())
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath("$.openTaskCount").value(0))
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath("$.overdueTaskCount").value(0))
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath("$.completedTaskCount").value(1))
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath("$.averageTurnaroundSeconds").value(org.hamcrest.Matchers.greaterThan(0)));
    }

    private String signature(String body, String secret) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        return "sha256=" + HexFormat.of().formatHex(mac.doFinal(body.getBytes(StandardCharsets.UTF_8)));
    }

    private void await(BooleanSupplier condition) throws InterruptedException {
        Instant deadline = Instant.now().plusSeconds(5);
        while (!condition.getAsBoolean() && Instant.now().isBefore(deadline)) Thread.sleep(25);
        assertThat(condition.getAsBoolean()).isTrue();
    }
}
