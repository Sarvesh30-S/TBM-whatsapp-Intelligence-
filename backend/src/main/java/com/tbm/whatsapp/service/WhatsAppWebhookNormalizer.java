package com.tbm.whatsapp.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tbm.whatsapp.entity.RawWebhookEvent;
import com.tbm.whatsapp.entity.WhatsAppMessage;
import com.tbm.whatsapp.entity.WhatsAppMessageStatus;
import com.tbm.whatsapp.entity.WhatsAppMessageAsset;
import com.tbm.whatsapp.entity.UnsupportedWebhookEvent;
import com.tbm.whatsapp.entity.GroupWebhookEvent;
import com.tbm.whatsapp.entity.WhatsAppGroup;
import com.tbm.whatsapp.repository.WhatsAppMessageAssetRepository;
import com.tbm.whatsapp.repository.WhatsAppMessageRepository;
import com.tbm.whatsapp.repository.WhatsAppMessageStatusRepository;
import com.tbm.whatsapp.repository.UnsupportedWebhookEventRepository;
import com.tbm.whatsapp.repository.GroupWebhookEventRepository;
import com.tbm.whatsapp.repository.WhatsAppGroupRepository;
import org.springframework.stereotype.Service;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.math.BigDecimal;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.HexFormat;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.net.URI;

@Service
public class WhatsAppWebhookNormalizer {
    private final ObjectMapper objectMapper;
    private final WhatsAppMessageRepository messages;
    private final WhatsAppMessageStatusRepository statuses;
    private final WhatsAppMessageAssetRepository assets;
    private final UnsupportedWebhookEventRepository unsupportedEvents;
    private final GroupWebhookEventRepository groupEvents;
    private final WhatsAppGroupRepository groups;
    private final ApplicationEventPublisher eventPublisher;
    private static final Set<String> GROUP_FIELDS = Set.of(
            "group_lifecycle_update", "group_participants_update", "group_settings_update", "group_status_update");
    private static final Set<String> MESSAGE_TYPES = Set.of(
            "text", "image", "audio", "video", "document", "sticker", "location", "contacts",
            "interactive", "button", "order", "system", "reaction", "unsupported", "unknown");

    public WhatsAppWebhookNormalizer(ObjectMapper objectMapper, WhatsAppMessageRepository messages,
                                     WhatsAppMessageStatusRepository statuses,
                                     WhatsAppMessageAssetRepository assets,
                                     UnsupportedWebhookEventRepository unsupportedEvents,
                                     GroupWebhookEventRepository groupEvents,
                                     WhatsAppGroupRepository groups,
                                     ApplicationEventPublisher eventPublisher) {
        this.objectMapper = objectMapper;
        this.messages = messages;
        this.statuses = statuses;
        this.assets = assets;
        this.unsupportedEvents = unsupportedEvents;
        this.groupEvents = groupEvents;
        this.groups = groups;
        this.eventPublisher = eventPublisher;
    }

    @Transactional
    public void normalize(RawWebhookEvent event) {
        try {
            JsonNode root = objectMapper.readTree(event.getPayload());
            for (JsonNode entry : iterable(root.path("entry"))) {
                String wabaId = text(entry, "id");
                for (JsonNode change : iterable(entry.path("changes"))) {
                    String field = text(change, "field");
                    JsonNode value = change.path("value");
                    if (GROUP_FIELDS.contains(field)) {
                        storeGroupEvent(event, field, value);
                        String groupId = text(value, "group_id");
                        if ("group_lifecycle_update".equals(field) && groupId != null) {
                            String inviteLink = findInviteLink(value);
                            if (inviteLink != null) {
                                groups.findByMetaGroupId(groupId).ifPresent(pod -> {
                                    if (pod.recordInviteLink(inviteLink, Instant.now())) {
                                        groups.save(pod);
                                    }
                                });
                            }
                        }
                        if (groupId != null) eventPublisher.publishEvent(new WhatsAppDashboardUpdate(groupId, field, event.getId()));
                        continue;
                    }
                    if (!"messages".equals(field)) {
                        storeUnsupportedEvent(event, field, "Webhook field is not supported by this build", change);
                        continue;
                    }
                    String phoneNumberId = text(value.path("metadata"), "phone_number_id");
                    for (JsonNode message : iterable(value.path("messages"))) {
                        String groupId = text(message, "group_id");
                        if (groupId == null) groupId = text(value, "group_id");
                        saveMessage(event, wabaId, phoneNumberId, groupId, message);
                        String type = text(message, "type");
                        if (type != null && !MESSAGE_TYPES.contains(type)) {
                            storeUnsupportedEvent(event, "messages." + type,
                                    "Message type is not supported by this build", message);
                        }
                    }
                    for (JsonNode status : iterable(value.path("statuses"))) saveStatus(event, status);
                }
            }
        } catch (Exception exception) {
            throw new IllegalArgumentException("Could not normalize WhatsApp webhook payload", exception);
        }
    }

    private void saveMessage(RawWebhookEvent event, String wabaId, String phoneNumberId,
                             String groupId, JsonNode node) throws Exception {
        String providerId = text(node, "id");
        if (providerId == null || messages.existsByProviderMessageId(providerId)) return;
        String type = text(node, "type");
        if (type == null) type = "unknown";
        String body = "text".equals(type) ? text(node.path("text"), "body") : null;
        WhatsAppMessage saved = messages.save(new WhatsAppMessage(UUID.randomUUID(), event.getId(), providerId, wabaId, phoneNumberId,
                groupId, text(node, "from"), type, epoch(text(node, "timestamp")), body,
                objectMapper.writeValueAsString(node), Instant.now()));
        if (groupId != null) eventPublisher.publishEvent(new WhatsAppDashboardUpdate(groupId, "message", saved.getId()));
        if (Set.of("image", "audio", "video", "document", "sticker").contains(type)) {
            JsonNode media = node.path(type);
            String mediaId = text(media, "id");
            if (mediaId == null) {
                storeUnsupportedEvent(event, "messages." + type,
                        "Media message is missing a provider media ID", node);
            } else if (!assets.existsByProviderMediaId(mediaId)) {
                assets.save(new WhatsAppMessageAsset(UUID.randomUUID(), saved.getId(), mediaId, type,
                        text(media, "mime_type"), text(media, "filename"), text(media, "sha256"), Instant.now()));
            }
        }
    }

    private void storeGroupEvent(RawWebhookEvent event, String field, JsonNode payload) throws Exception {
        String serialized = objectMapper.writeValueAsString(payload);
        String hash = sha256(serialized);
        if (groupEvents.existsByRawEventIdAndPayloadSha256(event.getId(), hash)) return;
        groupEvents.save(new GroupWebhookEvent(UUID.randomUUID(), event.getId(), field,
                text(payload, "group_id"), hash, serialized, Instant.now()));
    }

    private void storeUnsupportedEvent(RawWebhookEvent event, String field, String reason,
                                       JsonNode payload) throws Exception {
        String serialized = objectMapper.writeValueAsString(payload);
        String hash = sha256(serialized);
        if (unsupportedEvents.existsByRawEventIdAndPayloadSha256(event.getId(), hash)) return;
        unsupportedEvents.save(new UnsupportedWebhookEvent(UUID.randomUUID(), event.getId(), field, reason,
                hash, serialized, Instant.now()));
    }

    private void saveStatus(RawWebhookEvent event, JsonNode node) throws Exception {
        String providerId = text(node, "id");
        String status = text(node, "status");
        if (providerId == null || status == null) return;
        String recipient = text(node, "recipient_id");
        String timestamp = text(node, "timestamp");
        String key = sha256(String.join("|", providerId, status, nullToEmpty(timestamp), nullToEmpty(recipient)));
        if (statuses.existsByStatusKey(key)) return;
        JsonNode pricing = node.path("pricing");
        Boolean billable = pricing.has("billable") && !pricing.path("billable").isNull()
                ? pricing.path("billable").asBoolean() : null;
        BigDecimal cost = decimal(pricing.path("cost"));
        if (cost == null) cost = decimal(pricing.path("amount"));
        statuses.save(new WhatsAppMessageStatus(UUID.randomUUID(), event.getId(), key, providerId, recipient,
                status, epoch(timestamp), objectMapper.writeValueAsString(node), billable,
                text(pricing, "pricing_model"), text(pricing, "category"), text(pricing, "type"),
                cost, text(pricing, "currency"), Instant.now()));
        messages.findByProviderMessageId(providerId).map(WhatsAppMessage::getGroupId).filter(java.util.Objects::nonNull)
                .ifPresent(groupId -> eventPublisher.publishEvent(new WhatsAppDashboardUpdate(groupId, "message-status", null)));
    }

    private Iterable<JsonNode> iterable(JsonNode array) {
        if (!array.isArray()) return List.of();
        List<JsonNode> items = new ArrayList<>();
        array.elements().forEachRemaining(items::add);
        return items;
    }

    private String text(JsonNode node, String field) {
        JsonNode value = node.path(field);
        return value.isMissingNode() || value.isNull() ? null : value.asText();
    }

    private String findInviteLink(JsonNode node) {
        if (node == null || node.isNull()) return null;
        if (node.isObject()) {
            var fields = node.fields();
            while (fields.hasNext()) {
                var field = fields.next();
                String key = field.getKey().toLowerCase(java.util.Locale.ROOT);
                if (Set.of("invite_link", "invitelink", "group_invite_link").contains(key)) {
                    String valid = validInviteLink(field.getValue().asText(null));
                    if (valid != null) return valid;
                }
                String nested = findInviteLink(field.getValue());
                if (nested != null) return nested;
            }
        } else if (node.isArray()) {
            for (JsonNode child : node) {
                String nested = findInviteLink(child);
                if (nested != null) return nested;
            }
        }
        return null;
    }

    private String validInviteLink(String value) {
        if (value == null || value.isBlank()) return null;
        try {
            URI uri = URI.create(value.trim());
            if (!"https".equalsIgnoreCase(uri.getScheme())
                    || !"chat.whatsapp.com".equalsIgnoreCase(uri.getHost())
                    || (uri.getPort() != -1 && uri.getPort() != 443)
                    || uri.getRawPath() == null || uri.getRawPath().length() <= 1) return null;
            return uri.toASCIIString();
        } catch (IllegalArgumentException ignored) {
            return null;
        }
    }

    private Instant epoch(String value) {
        try { return value == null ? null : Instant.ofEpochSecond(Long.parseLong(value)); }
        catch (RuntimeException ignored) { return null; }
    }

    private BigDecimal decimal(JsonNode value) {
        try { return value.isNumber() ? value.decimalValue() : null; }
        catch (RuntimeException ignored) { return null; }
    }

    private String sha256(String value) throws Exception {
        return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
    }

    private String nullToEmpty(String value) { return value == null ? "" : value; }
}
