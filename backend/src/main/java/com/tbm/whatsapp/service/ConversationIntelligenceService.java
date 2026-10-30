package com.tbm.whatsapp.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tbm.whatsapp.entity.ConversationSummary;
import com.tbm.whatsapp.entity.ImportantMessageInsight;
import com.tbm.whatsapp.entity.WhatsAppGroup;
import com.tbm.whatsapp.entity.WhatsAppMessage;
import com.tbm.whatsapp.entity.WhatsAppMessageAsset;
import com.tbm.whatsapp.repository.ConversationSummaryRepository;
import com.tbm.whatsapp.repository.ImportantMessageInsightRepository;
import com.tbm.whatsapp.repository.WhatsAppGroupRepository;
import com.tbm.whatsapp.repository.WhatsAppMessageAssetRepository;
import com.tbm.whatsapp.repository.WhatsAppMessageRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.context.ApplicationEventPublisher;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
public class ConversationIntelligenceService {
    private static final Logger log = LoggerFactory.getLogger(ConversationIntelligenceService.class);
    private static final int MAX_MESSAGES_PER_SUMMARY = 250;
    private final WhatsAppGroupRepository groups;
    private final WhatsAppMessageRepository messages;
    private final WhatsAppMessageAssetRepository assets;
    private final ConversationSummaryRepository summaries;
    private final ImportantMessageInsightRepository insights;
    private final OpenAiContentService openAi;
    private final ObjectMapper objectMapper;
    private final double confidenceThreshold;
    private final ApplicationEventPublisher eventPublisher;

    public ConversationIntelligenceService(WhatsAppGroupRepository groups,
                                          WhatsAppMessageRepository messages,
                                          WhatsAppMessageAssetRepository assets,
                                          ConversationSummaryRepository summaries,
                                          ImportantMessageInsightRepository insights,
                                          OpenAiContentService openAi,
                                          ObjectMapper objectMapper,
                                          ApplicationEventPublisher eventPublisher,
                                          @Value("${app.ai.confidence-threshold:0.75}") double confidenceThreshold) {
        this.groups = groups;
        this.messages = messages;
        this.assets = assets;
        this.summaries = summaries;
        this.insights = insights;
        this.openAi = openAi;
        this.objectMapper = objectMapper;
        this.eventPublisher = eventPublisher;
        this.confidenceThreshold = Math.max(0, Math.min(1, confidenceThreshold));
    }

    @Scheduled(fixedDelayString = "${app.ai.worker-delay-ms:5000}")
    public void summarizeIdleGroups() {
        for (WhatsAppGroup group : groups.findAllByMetaGroupIdIsNotNull()) {
            try { summarize(group.getId(), false); }
            catch (Exception exception) {
                log.warn("Conversation summary failed for pod {} with {}", group.getId(), exception.getClass().getSimpleName());
            }
        }
    }

    @Transactional
    public ConversationSummary summarize(UUID podId, boolean force) throws Exception {
        WhatsAppGroup pod = groups.findById(podId).orElseThrow(() -> new IllegalArgumentException("Pod not found"));
        if (!StringUtils.hasText(pod.getMetaGroupId())) throw new IllegalStateException("Pod has no linked Meta group ID");

        ConversationSummary previous = summaries.findFirstByWhatsappGroupIdOrderByWindowEndDesc(podId).orElse(null);
        List<WhatsAppMessage> batch = previous == null
                ? messages.findAllByGroupIdOrderByCreatedAtAsc(pod.getMetaGroupId(), PageRequest.of(0, MAX_MESSAGES_PER_SUMMARY))
                : messages.findAllByGroupIdAndCreatedAtAfterOrderByCreatedAtAsc(
                        pod.getMetaGroupId(), previous.getWindowEnd(), PageRequest.of(0, MAX_MESSAGES_PER_SUMMARY));
        if (batch.isEmpty()) return previous;
        WhatsAppMessage lastMessage = batch.get(batch.size() - 1);
        if (!force && lastMessage.getCreatedAt().isAfter(Instant.now().minusSeconds(60))) return previous;

        List<OpenAiContentService.MessageForSummary> analyzable = attachMediaText(batch);
        if (analyzable == null || analyzable.isEmpty()) return previous;
        OpenAiContentService.SummaryResult result = openAi.summarize(pod.getMetaGroupId(), analyzable);
        List<String> sourceIds = analyzable.stream().map(message -> message.id().toString()).toList();
        Instant windowStart = analyzable.getFirst().receivedAt();
        Instant windowEnd = analyzable.getLast().receivedAt();
        Instant now = Instant.now();
        String summaryReviewStatus = result.confidence() >= confidenceThreshold ? "READY" : "NEEDS_REVIEW";
        ConversationSummary stored = summaries.saveAndFlush(new ConversationSummary(UUID.randomUUID(),
                pod.getCampaignId(), podId, windowStart, windowEnd, result.summary(), result.confidence(),
                summaryReviewStatus, objectMapper.writeValueAsString(sourceIds),
                openAi.isConfigured() ? "openai" : "heuristic",
                openAi.isConfigured() ? openAi.modelName() : "rules-engine", now));
        for (OpenAiContentService.InsightResult item : result.items()) {
            List<String> validSourceIds = item.sourceMessageIds().stream().filter(sourceIds::contains).distinct().toList();
            if (validSourceIds.isEmpty()) continue;
            String reviewStatus = item.confidence() >= confidenceThreshold ? "READY" : "NEEDS_REVIEW";
            insights.save(new ImportantMessageInsight(UUID.randomUUID(), stored.getId(), item.category(),
                    item.title(), item.detail(), item.confidence(), reviewStatus,
                    objectMapper.writeValueAsString(validSourceIds), parseInstant(item.dueAt()), now));
        }
        eventPublisher.publishEvent(new WhatsAppDashboardUpdate(pod.getMetaGroupId(), "summary", stored.getId()));
        return stored;
    }

    private List<OpenAiContentService.MessageForSummary> attachMediaText(List<WhatsAppMessage> batch) {
        List<UUID> ids = batch.stream().map(WhatsAppMessage::getId).toList();
        var textByMessageId = new java.util.HashMap<UUID, String>();
        for (WhatsAppMessageAsset asset : assets.findAllByWhatsappMessageIdIn(ids)) {
            if ("READY".equals(asset.getStatus()) && StringUtils.hasText(asset.getExtractedText())) {
                textByMessageId.put(asset.getWhatsappMessageId(), asset.getExtractedText());
            }
        }
        List<OpenAiContentService.MessageForSummary> selected = new ArrayList<>();
        for (WhatsAppMessage message : batch) {
            String attachmentText = textByMessageId.get(message.getId());
            boolean isAttachment = !"text".equals(message.getMessageType());
            if (isAttachment && !StringUtils.hasText(attachmentText)) {
                var asset = assets.findAllByWhatsappMessageIdIn(List.of(message.getId())).stream().findFirst().orElse(null);
                if (asset != null && !List.of("FAILED", "UNSUPPORTED").contains(asset.getStatus())) return null;
            }
            String content = join(message.getTextBody(), attachmentText);
            if (StringUtils.hasText(content)) selected.add(new OpenAiContentService.MessageForSummary(
                    message.getId(), message.getCreatedAt(), content));
        }
        return selected;
    }

    private String join(String first, String second) {
        if (!StringUtils.hasText(first)) return second;
        if (!StringUtils.hasText(second)) return first;
        return first + "\n[Attachment transcription/OCR]\n" + second;
    }

    private Instant parseInstant(String value) {
        try { return StringUtils.hasText(value) ? Instant.parse(value) : null; }
        catch (RuntimeException ignored) { return null; }
    }

}
