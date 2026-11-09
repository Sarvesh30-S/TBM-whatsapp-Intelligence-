package com.tbm.whatsapp.controller;

import com.tbm.whatsapp.entity.Brand;
import com.tbm.whatsapp.entity.Campaign;
import com.tbm.whatsapp.entity.WhatsAppGroup;
import com.tbm.whatsapp.entity.WhatsAppMessage;
import com.tbm.whatsapp.repository.BrandRepository;
import com.tbm.whatsapp.repository.CampaignRepository;
import com.tbm.whatsapp.repository.WhatsAppGroupRepository;
import com.tbm.whatsapp.repository.WhatsAppMessageAssetRepository;
import com.tbm.whatsapp.repository.WhatsAppMessageRepository;
import com.tbm.whatsapp.security.GroupSecurityEvaluator;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
public class WhatsAppMessageController {
    private final WhatsAppMessageRepository repository;
    private final WhatsAppMessageAssetRepository assetRepository;
    private final WhatsAppGroupRepository groupRepository;
    private final CampaignRepository campaignRepository;
    private final BrandRepository brandRepository;
    private final GroupSecurityEvaluator groupSecurity;

    public WhatsAppMessageController(WhatsAppMessageRepository repository) {
        this(repository, null, null, null, null, null);
    }

    @Autowired
    public WhatsAppMessageController(WhatsAppMessageRepository repository,
                                    WhatsAppMessageAssetRepository assetRepository,
                                    WhatsAppGroupRepository groupRepository,
                                    CampaignRepository campaignRepository,
                                    BrandRepository brandRepository,
                                    GroupSecurityEvaluator groupSecurity) {
        this.repository = repository;
        this.assetRepository = assetRepository;
        this.groupRepository = groupRepository;
        this.campaignRepository = campaignRepository;
        this.brandRepository = brandRepository;
        this.groupSecurity = groupSecurity;
    }

    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN', 'M2M_INTEGRATION')")
    @DeleteMapping({"/api/messages/{id}", "/api/admin/messages/{id}"})
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    public void deleteMessage(@PathVariable UUID id) {
        if (!repository.existsById(id)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Message not found");
        }
        if (assetRepository != null) {
            assetRepository.deleteByWhatsappMessageId(id);
        }
        repository.deleteById(id);
    }

    @PreAuthorize("hasAnyAuthority('WHATSAPP_CONTENT_READ', 'M2M_INTEGRATION')")
    @GetMapping("/api/messages")
    public List<MessageSummary> listMessages(@RequestParam(defaultValue = "50") int limit,
                                            Authentication authentication) {
        int boundedLimit = Math.max(1, Math.min(limit, 100));

        List<WhatsAppMessage> messageList;
        if (authentication != null && authentication.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("M2M_INTEGRATION"))) {
            // M2M background workers and ingestion processors read full feed
            messageList = repository.findAllByOrderByCreatedAtDesc(PageRequest.of(0, boundedLimit));
        } else {
            // Enforce database-level filtering by permitted group IDs for all users
            List<String> permittedGroupIds = groupSecurity != null
                    ? groupSecurity.getPermittedMetaGroupIds(authentication)
                    : Collections.emptyList();

            if (permittedGroupIds.isEmpty()) {
                return Collections.emptyList();
            }

            messageList = repository.findAllByGroupIdInOrderByCreatedAtDesc(
                    permittedGroupIds, PageRequest.of(0, boundedLimit));
        }

        Map<String, WhatsAppGroup> groupByMetaId = Collections.emptyMap();
        Map<UUID, Campaign> campaignById = Collections.emptyMap();
        Map<UUID, Brand> brandById = Collections.emptyMap();

        if (groupRepository != null && campaignRepository != null && brandRepository != null) {
            List<WhatsAppGroup> groups = groupRepository.findAllByMetaGroupIdIsNotNull();
            groupByMetaId = groups.stream()
                    .filter(g -> g.getMetaGroupId() != null && !g.getMetaGroupId().isBlank())
                    .collect(Collectors.toMap(WhatsAppGroup::getMetaGroupId, g -> g, (a, b) -> a));

            campaignById = campaignRepository.findAll().stream()
                    .collect(Collectors.toMap(Campaign::getId, c -> c, (a, b) -> a));

            brandById = brandRepository.findAll().stream()
                    .collect(Collectors.toMap(Brand::getId, b -> b, (a, b) -> a));
        }

        Map<String, WhatsAppGroup> finalGroupByMetaId = groupByMetaId;
        Map<UUID, Campaign> finalCampaignById = campaignById;
        Map<UUID, Brand> finalBrandById = brandById;

        return messageList.stream()
                .map(message -> {
                    String brandName = null;
                    String brandGroupName = null;
                    String campaignName = null;

                    if (message.getGroupId() != null && finalGroupByMetaId.containsKey(message.getGroupId())) {
                        WhatsAppGroup group = finalGroupByMetaId.get(message.getGroupId());
                        if (group != null) {
                            brandGroupName = group.getSubject();
                            Campaign campaign = finalCampaignById.get(group.getCampaignId());
                            if (campaign != null) {
                                campaignName = campaign.getName();
                                Brand brand = finalBrandById.get(campaign.getBrandId());
                                if (brand != null) {
                                    brandName = brand.getName();
                                }
                            }
                        }
                    }

                    return new MessageSummary(
                            message.getId(),
                            message.getProviderMessageId(),
                            message.getSenderId(),
                            message.getPhoneNumberId(),
                            message.getGroupId(),
                            message.getMessageType(),
                            message.getTextBody(),
                            message.getMessageTimestamp(),
                            message.getCreatedAt(),
                            brandName,
                            brandGroupName,
                            campaignName
                    );
                })
                .toList();
    }

    @PreAuthorize("@groupSecurity.canReadGroup(authentication, #groupId)")
    @GetMapping("/api/groups/{groupId}/messages")
    public List<MessageSummary> getGroupMessages(@PathVariable UUID groupId,
                                                @RequestParam(defaultValue = "50") int limit,
                                                Authentication authentication) {
        if (groupRepository == null) {
            return Collections.emptyList();
        }
        WhatsAppGroup group = groupRepository.findById(groupId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Group not found"));

        int boundedLimit = Math.max(1, Math.min(limit, 100));
        List<WhatsAppMessage> messageList = repository.findAllByGroupIdOrderByCreatedAtAsc(
                group.getMetaGroupId(), PageRequest.of(0, boundedLimit));

        return messageList.stream().map(MessageSummary::from).toList();
    }

    public record OutboundMessageRequest(
            @NotBlank(message = "Message text is required") String text
    ) {}

    @PreAuthorize("@groupSecurity.canSendToGroup(authentication, #groupId)")
    @PostMapping("/api/groups/{groupId}/messages/send")
    public ResponseEntity<?> sendGroupMessage(@PathVariable UUID groupId,
                                             @Valid @RequestBody OutboundMessageRequest request,
                                             Authentication authentication) {
        if (groupRepository == null) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Group service unavailable");
        }
        WhatsAppGroup group = groupRepository.findById(groupId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Group not found"));

        WhatsAppMessage message = new WhatsAppMessage(
                UUID.randomUUID(),
                UUID.randomUUID(),
                "wamid.outbound." + System.currentTimeMillis(),
                null,
                null,
                group.getMetaGroupId(),
                authentication != null ? authentication.getName() : "system",
                "text",
                Instant.now(),
                request.text().trim(),
                "{\"type\":\"text\",\"body\":\"" + request.text().trim().replace("\"", "\\\"") + "\"}",
                Instant.now()
        );
        repository.save(message);

        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of(
                "message", "Message dispatched successfully",
                "messageId", message.getId().toString(),
                "groupId", groupId.toString()
        ));
    }

    public record MessageSummary(UUID id, String providerMessageId, String senderId,
                                 String phoneNumberId, String groupId, String type, String text,
                                 Instant messageTimestamp, Instant receivedAt,
                                 String brandName, String brandGroupName, String campaignName) {
        static MessageSummary from(WhatsAppMessage message) {
            return new MessageSummary(message.getId(), message.getProviderMessageId(), message.getSenderId(),
                    message.getPhoneNumberId(), message.getGroupId(), message.getMessageType(), message.getTextBody(),
                    message.getMessageTimestamp(), message.getCreatedAt(), null, null, null);
        }
    }
}
