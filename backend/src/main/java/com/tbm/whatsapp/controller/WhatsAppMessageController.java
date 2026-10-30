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
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
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

    public WhatsAppMessageController(WhatsAppMessageRepository repository) {
        this(repository, null, null, null, null);
    }

    @Autowired
    public WhatsAppMessageController(WhatsAppMessageRepository repository,
                                    WhatsAppMessageAssetRepository assetRepository,
                                    WhatsAppGroupRepository groupRepository,
                                    CampaignRepository campaignRepository,
                                    BrandRepository brandRepository) {
        this.repository = repository;
        this.assetRepository = assetRepository;
        this.groupRepository = groupRepository;
        this.campaignRepository = campaignRepository;
        this.brandRepository = brandRepository;
    }

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

    @GetMapping("/api/messages")
    public List<MessageSummary> listMessages(@RequestParam(defaultValue = "50") int limit) {
        int boundedLimit = Math.max(1, Math.min(limit, 100));
        List<WhatsAppMessage> messageList = repository.findAllByOrderByCreatedAtDesc(PageRequest.of(0, boundedLimit));

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
