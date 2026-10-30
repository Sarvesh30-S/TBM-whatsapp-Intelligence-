package com.tbm.whatsapp.controller;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tbm.whatsapp.entity.ConversationSummary;
import com.tbm.whatsapp.entity.ImportantMessageInsight;
import com.tbm.whatsapp.entity.WhatsAppGroup;
import com.tbm.whatsapp.entity.WhatsAppMessage;
import com.tbm.whatsapp.entity.WhatsAppMessageAsset;
import com.tbm.whatsapp.repository.CampaignRepository;
import com.tbm.whatsapp.repository.ConversationSummaryRepository;
import com.tbm.whatsapp.repository.ImportantMessageInsightRepository;
import com.tbm.whatsapp.repository.WhatsAppGroupRepository;
import com.tbm.whatsapp.repository.WhatsAppMessageAssetRepository;
import com.tbm.whatsapp.repository.WhatsAppMessageRepository;
import com.tbm.whatsapp.service.ConversationIntelligenceService;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/admin/campaigns/{campaignId}/summaries")
public class ConversationSummaryController {
    private final CampaignRepository campaigns;
    private final ConversationSummaryRepository summaries;
    private final ImportantMessageInsightRepository insights;
    private final WhatsAppGroupRepository groups;
    private final WhatsAppMessageRepository messages;
    private final WhatsAppMessageAssetRepository assets;
    private final ConversationIntelligenceService intelligence;
    private final ObjectMapper mapper;

    public ConversationSummaryController(CampaignRepository campaigns, ConversationSummaryRepository summaries,
                                         ImportantMessageInsightRepository insights,
                                         WhatsAppGroupRepository groups, WhatsAppMessageRepository messages,
                                         WhatsAppMessageAssetRepository assets,
                                         ConversationIntelligenceService intelligence, ObjectMapper mapper) {
        this.campaigns = campaigns;
        this.summaries = summaries;
        this.insights = insights;
        this.groups = groups;
        this.messages = messages;
        this.assets = assets;
        this.intelligence = intelligence;
        this.mapper = mapper;
    }

    @GetMapping
    public List<SummaryView> list(@PathVariable UUID campaignId, @RequestParam(defaultValue = "20") int limit) {
        requireCampaign(campaignId);
        return summaries.findAllByCampaignIdOrderByWindowEndDesc(campaignId, PageRequest.of(0, Math.max(1, Math.min(limit, 100))))
                .stream().map(this::view).toList();
    }

    @GetMapping("/{summaryId}/sources")
    public List<SourceMessageView> sources(@PathVariable UUID campaignId, @PathVariable UUID summaryId,
                                          @RequestParam(required = false) UUID itemId) {
        requireCampaign(campaignId);
        ConversationSummary summary = summaries.findById(summaryId)
                .filter(candidate -> campaignId.equals(candidate.getCampaignId()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Summary not found"));
        WhatsAppGroup pod = groups.findById(summary.getWhatsappGroupId())
                .filter(candidate -> campaignId.equals(candidate.getCampaignId()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Pod not found"));

        List<String> sourceIds;
        if (itemId == null) {
            sourceIds = parseIds(summary.getSourceMessageIds());
        } else {
            ImportantMessageInsight item = insights.findById(itemId)
                    .filter(candidate -> summaryId.equals(candidate.getSummaryId()))
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Insight not found"));
            sourceIds = parseIds(item.getSourceMessageIds());
        }

        List<UUID> orderedIds = sourceIds.stream().map(this::parseUuid).filter(Objects::nonNull).distinct().toList();
        Map<UUID, WhatsAppMessage> messageById = messages.findAllById(orderedIds).stream()
                .filter(message -> Objects.equals(pod.getMetaGroupId(), message.getGroupId()))
                .collect(Collectors.toMap(WhatsAppMessage::getId, Function.identity()));
        List<WhatsAppMessageAsset> sourceAssets = orderedIds.isEmpty()
                ? List.of() : assets.findAllByWhatsappMessageIdIn(orderedIds);
        Map<UUID, WhatsAppMessageAsset> assetByMessageId = sourceAssets.stream()
                .collect(Collectors.toMap(WhatsAppMessageAsset::getWhatsappMessageId, Function.identity()));

        return orderedIds.stream().map(messageById::get).filter(Objects::nonNull).map(message -> {
            WhatsAppMessageAsset asset = assetByMessageId.get(message.getId());
            String attachmentText = asset != null && "READY".equals(asset.getStatus()) ? asset.getExtractedText() : null;
            return new SourceMessageView(message.getId(), message.getSenderId(), message.getMessageType(),
                    message.getTextBody(), asset == null ? null : asset.getMediaKind(),
                    asset == null ? null : asset.getOriginalFilename(), attachmentText,
                    message.getMessageTimestamp(), message.getCreatedAt());
        }).toList();
    }

    @PostMapping("/pods/{podId}/refresh")
    public SummaryView refresh(@PathVariable UUID campaignId, @PathVariable UUID podId) {
        requireCampaign(campaignId);
        try {
            ConversationSummary summary = intelligence.summarize(podId, true);
            if (summary == null || !campaignId.equals(summary.getCampaignId())) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No summary is ready for this pod");
            }
            return view(summary);
        } catch (IllegalArgumentException exception) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Pod not found");
        } catch (IllegalStateException exception) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, exception.getMessage());
        } catch (ResponseStatusException exception) {
            throw exception;
        } catch (Exception exception) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Summary provider request failed");
        }
    }

    private void requireCampaign(UUID campaignId) {
        if (!campaigns.existsById(campaignId)) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Campaign not found");
    }

    private SummaryView view(ConversationSummary summary) {
        List<ItemView> items = insights.findAllBySummaryIdOrderByCreatedAtAsc(summary.getId()).stream()
                .map(item -> new ItemView(item.getId(), item.getCategory(), item.getTitle(), item.getDetail(),
                        item.getConfidence(), item.getReviewStatus(), parseIds(item.getSourceMessageIds()), item.getDueAt()))
                .toList();
        return new SummaryView(summary.getId(), summary.getCampaignId(), summary.getWhatsappGroupId(),
                summary.getWindowStart(), summary.getWindowEnd(), summary.getSummaryText(), summary.getConfidence(),
                summary.getReviewStatus(), parseIds(summary.getSourceMessageIds()), summary.getProvider(), summary.getModel(), items);
    }

    private List<String> parseIds(String json) {
        try { return mapper.readValue(json, new TypeReference<>() {}); }
        catch (Exception ignored) { return List.of(); }
    }

    private UUID parseUuid(String value) {
        try { return UUID.fromString(value); }
        catch (RuntimeException ignored) { return null; }
    }

    public record SummaryView(UUID id, UUID campaignId, UUID podId, Instant windowStart, Instant windowEnd,
                              String summary, double confidence, String reviewStatus,
                              List<String> sourceMessageIds, String provider, String model, List<ItemView> items) {}
    public record ItemView(UUID id, String category, String title, String detail, double confidence,
                           String reviewStatus, List<String> sourceMessageIds, Instant dueAt) {}
    public record SourceMessageView(UUID id, String senderId, String type, String text,
                                   String mediaKind, String filename, String attachmentText,
                                   Instant messageTimestamp, Instant receivedAt) {}
}
