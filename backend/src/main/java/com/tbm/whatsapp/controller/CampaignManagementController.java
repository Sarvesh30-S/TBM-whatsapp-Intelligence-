package com.tbm.whatsapp.controller;

import com.tbm.whatsapp.entity.Brand;
import com.tbm.whatsapp.entity.Campaign;
import com.tbm.whatsapp.entity.ConversationSummary;
import com.tbm.whatsapp.entity.Person;
import com.tbm.whatsapp.entity.WhatsAppGroup;
import com.tbm.whatsapp.entity.WhatsAppGroupParticipant;
import com.tbm.whatsapp.entity.WhatsAppMessage;
import com.tbm.whatsapp.repository.BrandRepository;
import com.tbm.whatsapp.repository.CampaignRepository;
import com.tbm.whatsapp.repository.ConversationSummaryRepository;
import com.tbm.whatsapp.repository.ImportantMessageInsightRepository;
import com.tbm.whatsapp.repository.PersonRepository;
import com.tbm.whatsapp.repository.WhatsAppGroupParticipantRepository;
import com.tbm.whatsapp.repository.WhatsAppGroupRepository;
import com.tbm.whatsapp.repository.WhatsAppMessageRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.text.Normalizer;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/admin")
public class CampaignManagementController {
    private final BrandRepository brands;
    private final CampaignRepository campaigns;
    private final WhatsAppGroupRepository groups;
    private final WhatsAppGroupParticipantRepository participants;
    private final ConversationSummaryRepository summaries;
    private final ImportantMessageInsightRepository insights;
    private final WhatsAppMessageRepository messages;
    private final PersonRepository people;

    public CampaignManagementController(BrandRepository brands, CampaignRepository campaigns,
                                        WhatsAppGroupRepository groups,
                                        WhatsAppGroupParticipantRepository participants,
                                        ConversationSummaryRepository summaries,
                                        ImportantMessageInsightRepository insights,
                                        WhatsAppMessageRepository messages,
                                        PersonRepository people) {
        this.brands = brands;
        this.campaigns = campaigns;
        this.groups = groups;
        this.participants = participants;
        this.summaries = summaries;
        this.insights = insights;
        this.messages = messages;
        this.people = people;
    }

    @GetMapping("/brands")
    public List<BrandSummary> listBrands() {
        return brands.findAll().stream().map(BrandSummary::from).toList();
    }

    @PostMapping("/brands")
    @ResponseStatus(HttpStatus.CREATED)
    public BrandSummary createBrand(@Valid @RequestBody CreateBrandRequest request) {
        Instant now = Instant.now();
        Brand brand = brands.saveAndFlush(new Brand(UUID.randomUUID(), slug(request.name()), request.name().trim(), now));
        return BrandSummary.from(brand);
    }

    @GetMapping("/campaigns")
    public List<CampaignSummary> listCampaigns(@RequestParam(required = false) UUID brandId) {
        List<Campaign> result = brandId == null
                ? campaigns.findAllByOrderByCreatedAtDesc()
                : campaigns.findAllByBrandIdOrderByCreatedAtDesc(brandId);
        return result.stream().map(CampaignSummary::from).toList();
    }

    @PostMapping("/campaigns")
    @ResponseStatus(HttpStatus.CREATED)
    public CampaignSummary createCampaign(@Valid @RequestBody CreateCampaignRequest request) {
        if (!brands.existsById(request.brandId())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Brand not found");
        }
        Campaign campaign = campaigns.saveAndFlush(new Campaign(UUID.randomUUID(), request.brandId(),
                slug(request.name()), request.name().trim(), "DRAFT", Instant.now()));
        return CampaignSummary.from(campaign);
    }

    @RequestMapping(value = "/campaigns/{campaignId}", method = {RequestMethod.PATCH, RequestMethod.PUT})
    public CampaignSummary updateCampaign(@PathVariable UUID campaignId,
                                          @Valid @RequestBody UpdateCampaignRequest request) {
        Campaign campaign = campaigns.findById(campaignId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Campaign not found"));

        if (request.name() != null && !request.name().isBlank()) {
            campaign.setName(request.name().trim());
        }
        if (request.status() != null && !request.status().isBlank()) {
            String upper = request.status().trim().toUpperCase(Locale.ROOT);
            if (!List.of("DRAFT", "ACTIVE", "PAUSED", "COMPLETED").contains(upper)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid status: " + upper);
            }
            campaign.setStatus(upper);
        }
        Campaign saved = campaigns.saveAndFlush(campaign);
        return CampaignSummary.from(saved);
    }

    @DeleteMapping("/campaigns/{campaignId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    public void deleteCampaign(@PathVariable UUID campaignId) {
        Campaign campaign = campaigns.findById(campaignId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Campaign not found"));

        List<WhatsAppGroup> pods = groups.findAllByCampaignIdOrderByCreatedAtDesc(campaignId);

        // Clean up conversation summaries and insights for this campaign
        List<ConversationSummary> campaignSummaries = summaries.findAllByCampaignId(campaignId);
        if (!campaignSummaries.isEmpty()) {
            List<UUID> summaryIds = campaignSummaries.stream().map(ConversationSummary::getId).toList();
            if (insights != null) {
                insights.deleteBySummaryIdIn(summaryIds);
            }
            summaries.deleteAll(campaignSummaries);
        }

        for (WhatsAppGroup pod : pods) {
            participants.deleteAll(participants.findAllByWhatsappGroupId(pod.getId()));
            groups.delete(pod);
        }
        campaigns.delete(campaign);
    }

    @DeleteMapping("/pods/{podId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    public void deletePod(@PathVariable UUID podId) {
        WhatsAppGroup pod = groups.findById(podId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Pod not found"));

        // Clean up conversation summaries and insights for this pod
        List<ConversationSummary> podSummaries = summaries.findAllByWhatsappGroupId(podId);
        if (!podSummaries.isEmpty()) {
            List<UUID> summaryIds = podSummaries.stream().map(ConversationSummary::getId).toList();
            if (insights != null) {
                insights.deleteBySummaryIdIn(summaryIds);
            }
            summaries.deleteAll(podSummaries);
        }

        participants.deleteAll(participants.findAllByWhatsappGroupId(podId));
        groups.delete(pod);
    }

    @GetMapping("/campaigns/{campaignId}/pods")
    public List<PodSummary> listPods(@PathVariable UUID campaignId) {
        if (!campaigns.existsById(campaignId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Campaign not found");
        }
        return groups.findAllByCampaignIdOrderByCreatedAtDesc(campaignId).stream().map(this::toPodSummary).toList();
    }

    @PostMapping("/campaigns/{campaignId}/pods")
    @ResponseStatus(HttpStatus.CREATED)
    public PodSummary createPod(@PathVariable UUID campaignId, @Valid @RequestBody CreatePodRequest request) {
        if (!campaigns.existsById(campaignId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Campaign not found");
        }
        Instant now = Instant.now();
        WhatsAppGroup pod = groups.saveAndFlush(new WhatsAppGroup(UUID.randomUUID(), campaignId, null,
                request.subject().trim(), null, request.joinApprovalMode(), "PENDING_CONSENT", null,
                request.plannedExternalSeats(), now, now));
        return toPodSummary(pod);
    }

    @PatchMapping("/pods/{podId}/link-meta-group")
    public PodSummary linkMetaGroup(@PathVariable UUID podId,
                                    @Valid @RequestBody LinkMetaGroupRequest request) {
        WhatsAppGroup pod = groups.findById(podId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Pod not found"));

        String cleanGroupId = request.metaGroupId().trim();
        groups.findByMetaGroupId(cleanGroupId).ifPresent(existing -> {
            if (!existing.getId().equals(podId)) {
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                        "WhatsApp Group ID is already linked to pod: " + existing.getSubject());
            }
        });

        Instant now = Instant.now();
        pod.linkMetaGroup(cleanGroupId, request.inviteLink(), now);
        WhatsAppGroup saved = groups.saveAndFlush(pod);
        return toPodSummary(saved);
    }

    @DeleteMapping("/pods/{podId}/link-meta-group")
    public PodSummary unlinkMetaGroup(@PathVariable UUID podId) {
        WhatsAppGroup pod = groups.findById(podId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Pod not found"));

        Instant now = Instant.now();
        pod.unlinkMetaGroup(now);
        WhatsAppGroup saved = groups.saveAndFlush(pod);
        return toPodSummary(saved);
    }

    @PostMapping("/pods/{podId}/consent")
    public PodSummary recordConsent(@PathVariable UUID podId) {
        WhatsAppGroup pod = groups.findById(podId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Pod not found"));

        pod.recordConsent(Instant.now());
        WhatsAppGroup saved = groups.saveAndFlush(pod);
        return toPodSummary(saved);
    }

    @GetMapping("/pods/{podId}/participants")
    public List<ParticipantSummary> listParticipants(@PathVariable UUID podId) {
        WhatsAppGroup pod = groups.findById(podId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Pod not found"));
        return toPodSummary(pod).participants();
    }

    @PostMapping("/pods/{podId}/participants")
    @ResponseStatus(HttpStatus.CREATED)
    public ParticipantSummary addParticipant(@PathVariable UUID podId,
                                            @Valid @RequestBody AddParticipantRequest request) {
        WhatsAppGroup pod = groups.findById(podId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Pod not found"));

        String cleanWaId = request.waId().trim().replaceAll("[^0-9+]", "").replaceAll("^\\+", "");
        if (cleanWaId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid WhatsApp ID / phone number");
        }

        Person person = people.findByWaId(cleanWaId).orElseGet(() -> {
            String name = (request.displayName() != null && !request.displayName().isBlank())
                    ? request.displayName().trim()
                    : "+" + cleanWaId;
            return people.saveAndFlush(new Person(UUID.randomUUID(), cleanWaId, name, Instant.now()));
        });

        if (request.displayName() != null && !request.displayName().isBlank()) {
            person.setDisplayName(request.displayName().trim());
            people.saveAndFlush(person);
        }

        WhatsAppGroupParticipant participant = participants.findByWhatsappGroupIdAndPersonId(podId, person.getId())
                .map(existing -> {
                    existing.setStatus("ACTIVE");
                    return participants.saveAndFlush(existing);
                })
                .orElseGet(() -> participants.saveAndFlush(new WhatsAppGroupParticipant(
                        UUID.randomUUID(),
                        podId,
                        person.getId(),
                        request.isExternal() != null ? request.isExternal() : true,
                        "ACTIVE",
                        Instant.now(),
                        null
                )));

        return new ParticipantSummary(
                participant.getId(),
                person.getId(),
                person.getWaId(),
                person.getDisplayName(),
                participant.isExternal(),
                participant.getStatus(),
                participant.getJoinedAt() != null ? participant.getJoinedAt() : Instant.now()
        );
    }

    @DeleteMapping("/pods/{podId}/participants/{participantId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void removeParticipant(@PathVariable UUID podId, @PathVariable UUID participantId) {
        WhatsAppGroupParticipant participant = participants.findById(participantId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Participant not found"));

        if (!participant.getWhatsappGroupId().equals(podId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Participant does not belong to this pod");
        }

        participants.delete(participant);
    }

    private PodSummary toPodSummary(WhatsAppGroup group) {
        if (group.getMetaGroupId() != null && !group.getMetaGroupId().isBlank()) {
            syncSendersForGroup(group);
        }

        List<WhatsAppGroupParticipant> participantList = participants.findAllByWhatsappGroupId(group.getId());
        List<ParticipantSummary> participantSummaries = new ArrayList<>();
        int activeCount = 0;

        List<UUID> personIds = participantList.stream().map(WhatsAppGroupParticipant::getPersonId).toList();
        Map<UUID, Person> peopleById = personIds.isEmpty() ? Collections.emptyMap() :
                people.findAllById(personIds).stream()
                        .collect(Collectors.toMap(Person::getId, p -> p, (a, b) -> a));

        for (WhatsAppGroupParticipant p : participantList) {
            Person person = peopleById.get(p.getPersonId());
            String waId = person != null ? person.getWaId() : "unknown";
            String displayName = (person != null && person.getDisplayName() != null && !person.getDisplayName().isBlank())
                    ? person.getDisplayName()
                    : (waId.startsWith("+") ? waId : "+" + waId);

            if ("ACTIVE".equalsIgnoreCase(p.getStatus())) {
                activeCount++;
            }

            participantSummaries.add(new ParticipantSummary(
                    p.getId(),
                    p.getPersonId(),
                    waId,
                    displayName,
                    p.isExternal(),
                    p.getStatus(),
                    p.getJoinedAt() != null ? p.getJoinedAt() : group.getCreatedAt()
            ));
        }

        return new PodSummary(
                group.getId(),
                group.getCampaignId(),
                group.getMetaGroupId(),
                group.getSubject(),
                group.getInviteLink(),
                group.getJoinApprovalMode(),
                group.getPlannedExternalSeats(),
                activeCount,
                participantSummaries,
                group.getStatus(),
                group.getConsentSentAt() != null,
                group.getCreatedAt()
        );
    }

    private void syncSendersForGroup(WhatsAppGroup group) {
        String metaGroupId = group.getMetaGroupId();
        if (metaGroupId == null || metaGroupId.isBlank()) return;

        List<WhatsAppMessage> groupMessages = messages.findAllByGroupIdOrderByCreatedAtAsc(metaGroupId, PageRequest.of(0, 100));
        Set<String> senders = groupMessages.stream()
                .map(WhatsAppMessage::getSenderId)
                .filter(s -> s != null && !s.isBlank())
                .collect(Collectors.toSet());

        for (String sender : senders) {
            Person person = people.findByWaId(sender).orElseGet(() ->
                    people.saveAndFlush(new Person(UUID.randomUUID(), sender, "+" + sender, Instant.now()))
            );

            if (!participants.existsByWhatsappGroupIdAndPersonId(group.getId(), person.getId())) {
                participants.saveAndFlush(new WhatsAppGroupParticipant(
                        UUID.randomUUID(),
                        group.getId(),
                        person.getId(),
                        true,
                        "ACTIVE",
                        Instant.now(),
                        null
                ));
            }
        }
    }

    private String slug(String value) {
        String base = Normalizer.normalize(value.trim(), Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", "-")
                .replaceAll("^-|-$", "");
        if (base.isBlank()) base = "record";
        if (base.length() > 110) base = base.substring(0, 110).replaceAll("-$", "");
        return base + "-" + UUID.randomUUID().toString().substring(0, 8);
    }

    public record CreateBrandRequest(@NotBlank @Size(max = 160) String name) {}
    public record CreateCampaignRequest(@NotNull UUID brandId, @NotBlank @Size(max = 160) String name) {}
    public record UpdateCampaignRequest(
            @Size(max = 160) String name,
            @Pattern(regexp = "(?i)DRAFT|ACTIVE|PAUSED|COMPLETED", message = "Status must be DRAFT, ACTIVE, PAUSED, or COMPLETED") String status
    ) {}
    public record CreatePodRequest(@NotBlank @Size(max = 255) String subject,
                                   @NotBlank @Pattern(regexp = "approval_required|auto_approve") String joinApprovalMode,
                                   @Min(0) @Max(7) int plannedExternalSeats) {}
    public record LinkMetaGroupRequest(
            @NotBlank @Size(max = 128) String metaGroupId,
            @Size(max = 1000) String inviteLink
    ) {}
    public record AddParticipantRequest(
            @NotBlank String waId,
            String displayName,
            Boolean isExternal
    ) {}
    public record BrandSummary(UUID id, String slug, String name, Instant createdAt) {
        static BrandSummary from(Brand brand) { return new BrandSummary(brand.getId(), brand.getSlug(), brand.getName(), brand.getCreatedAt()); }
    }
    public record CampaignSummary(UUID id, UUID brandId, String slug, String name, String status) {
        static CampaignSummary from(Campaign campaign) { return new CampaignSummary(campaign.getId(), campaign.getBrandId(), campaign.getSlug(), campaign.getName(), campaign.getStatus()); }
    }
    public record ParticipantSummary(UUID id, UUID personId, String waId, String displayName,
                                    boolean isExternal, String status, Instant joinedAt) {}
    public record PodSummary(UUID id, UUID campaignId, String metaGroupId, String subject,
                             String inviteLink, String joinApprovalMode, int plannedExternalSeats,
                             int filledSeats, List<ParticipantSummary> participants, String status,
                             boolean consentSent, Instant createdAt) {
        static PodSummary from(WhatsAppGroup group) {
            return new PodSummary(group.getId(), group.getCampaignId(), group.getMetaGroupId(), group.getSubject(),
                    group.getInviteLink(), group.getJoinApprovalMode(), group.getPlannedExternalSeats(), 0,
                    Collections.emptyList(), group.getStatus(), group.getConsentSentAt() != null, group.getCreatedAt());
        }
    }
}
