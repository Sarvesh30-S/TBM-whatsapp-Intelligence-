package com.tbm.whatsapp.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tbm.whatsapp.repository.BrandRepository;
import com.tbm.whatsapp.repository.CampaignRepository;
import com.tbm.whatsapp.repository.WhatsAppGroupParticipantRepository;
import com.tbm.whatsapp.repository.WhatsAppGroupRepository;
import com.tbm.whatsapp.repository.PersonRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@TestPropertySource(properties = "app.dashboard-admin-key=test-dashboard-key")
class CampaignManagementIntegrationTest {
    private static final String ADMIN_KEY = "test-dashboard-key";

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private WhatsAppGroupParticipantRepository participants;
    @Autowired private WhatsAppGroupRepository groups;
    @Autowired private CampaignRepository campaigns;
    @Autowired private BrandRepository brands;
    @Autowired private PersonRepository people;

    @BeforeEach
    void clearPlanningRecords() {
        participants.deleteAll();
        groups.deleteAll();
        campaigns.deleteAll();
        brands.deleteAll();
        people.deleteAll();
    }

    @Test
    void protectsAdminRoutesAndCreatesBrandCampaignAndLocalPod() throws Exception {
        mockMvc.perform(get("/api/admin/brands"))
                .andExpect(status().isUnauthorized());

        String brandResponse = mockMvc.perform(post("/api/admin/brands")
                        .header("X-Dashboard-Admin-Key", ADMIN_KEY)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Acme Retail\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("Acme Retail"))
                .andReturn().getResponse().getContentAsString();
        JsonNode brand = objectMapper.readTree(brandResponse);
        String brandId = brand.path("id").asText();

        String campaignResponse = mockMvc.perform(post("/api/admin/campaigns")
                        .header("X-Dashboard-Admin-Key", ADMIN_KEY)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"brandId\":\"" + brandId + "\",\"name\":\"October Pilot\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("DRAFT"))
                .andReturn().getResponse().getContentAsString();
        String campaignId = objectMapper.readTree(campaignResponse).path("id").asText();

        mockMvc.perform(post("/api/admin/campaigns/{campaignId}/pods", campaignId)
                        .header("X-Dashboard-Admin-Key", ADMIN_KEY)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"subject\":\"October Pilot Pod 1\",\"joinApprovalMode\":\"approval_required\",\"plannedExternalSeats\":7}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.plannedExternalSeats").value(7))
                .andExpect(jsonPath("$.metaGroupId").doesNotExist())
                .andExpect(jsonPath("$.consentSent").value(false))
                .andExpect(jsonPath("$.status").value("PENDING_CONSENT"));
    }

    @Test
    void rejectsPodPlansWithMoreThanSevenExternalSeats() throws Exception {
        String brandResponse = mockMvc.perform(post("/api/admin/brands")
                        .header("X-Dashboard-Admin-Key", ADMIN_KEY)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Seat Limit Brand\"}"))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        String brandId = objectMapper.readTree(brandResponse).path("id").asText();
        String campaignResponse = mockMvc.perform(post("/api/admin/campaigns")
                        .header("X-Dashboard-Admin-Key", ADMIN_KEY)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"brandId\":\"" + brandId + "\",\"name\":\"Overflow Campaign\"}"))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        String campaignId = objectMapper.readTree(campaignResponse).path("id").asText();

        mockMvc.perform(post("/api/admin/campaigns/{campaignId}/pods", campaignId)
                        .header("X-Dashboard-Admin-Key", ADMIN_KEY)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"subject\":\"Too Many People\",\"joinApprovalMode\":\"approval_required\",\"plannedExternalSeats\":8}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void updatesAndDeletesCampaign() throws Exception {
        String brandResponse = mockMvc.perform(post("/api/admin/brands")
                        .header("X-Dashboard-Admin-Key", ADMIN_KEY)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Brand To Update\"}"))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        String brandId = objectMapper.readTree(brandResponse).path("id").asText();

        String campaignResponse = mockMvc.perform(post("/api/admin/campaigns")
                        .header("X-Dashboard-Admin-Key", ADMIN_KEY)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"brandId\":\"" + brandId + "\",\"name\":\"Original Campaign Name\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("DRAFT"))
                .andReturn().getResponse().getContentAsString();
        String campaignId = objectMapper.readTree(campaignResponse).path("id").asText();

        // 1. Update Campaign Name and Status
        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch("/api/admin/campaigns/{campaignId}", campaignId)
                        .header("X-Dashboard-Admin-Key", ADMIN_KEY)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Updated Campaign Name\",\"status\":\"ACTIVE\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Updated Campaign Name"))
                .andExpect(jsonPath("$.status").value("ACTIVE"));

        // 2. Delete Campaign
        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete("/api/admin/campaigns/{campaignId}", campaignId)
                        .header("X-Dashboard-Admin-Key", ADMIN_KEY))
                .andExpect(status().isNoContent());

        // 3. Confirm Deletion
        mockMvc.perform(get("/api/admin/campaigns")
                        .header("X-Dashboard-Admin-Key", ADMIN_KEY))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isEmpty());
    }

    @Test
    void linksUnlinksMetaGroupAndRecordsConsent() throws Exception {
        String brandResponse = mockMvc.perform(post("/api/admin/brands")
                        .header("X-Dashboard-Admin-Key", ADMIN_KEY)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Brand For Pod Link\"}"))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        String brandId = objectMapper.readTree(brandResponse).path("id").asText();

        String campaignResponse = mockMvc.perform(post("/api/admin/campaigns")
                        .header("X-Dashboard-Admin-Key", ADMIN_KEY)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"brandId\":\"" + brandId + "\",\"name\":\"Campaign For Pod Link\"}"))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        String campaignId = objectMapper.readTree(campaignResponse).path("id").asText();

        String podResponse = mockMvc.perform(post("/api/admin/campaigns/{campaignId}/pods", campaignId)
                        .header("X-Dashboard-Admin-Key", ADMIN_KEY)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"subject\":\"Pilot Pod 1\",\"joinApprovalMode\":\"approval_required\",\"plannedExternalSeats\":5}"))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        String podId = objectMapper.readTree(podResponse).path("id").asText();

        // 1. Link Meta Group ID & Invite link
        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch("/api/admin/pods/{podId}/link-meta-group", podId)
                        .header("X-Dashboard-Admin-Key", ADMIN_KEY)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"metaGroupId\":\"120363025555555555@g.us\",\"inviteLink\":\"https://chat.whatsapp.com/test-invite\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.metaGroupId").value("120363025555555555@g.us"))
                .andExpect(jsonPath("$.inviteLink").value("https://chat.whatsapp.com/test-invite"));

        // 2. Record Consent & Activate Pod
        mockMvc.perform(post("/api/admin/pods/{podId}/consent", podId)
                        .header("X-Dashboard-Admin-Key", ADMIN_KEY))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.consentSent").value(true))
                .andExpect(jsonPath("$.status").value("ACTIVE"));

        // 3. Unlink Meta Group ID
        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete("/api/admin/pods/{podId}/link-meta-group", podId)
                        .header("X-Dashboard-Admin-Key", ADMIN_KEY))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.metaGroupId").doesNotExist());
    }

    @Test
    void tracksFilledSeatsAndPodEntities() throws Exception {
        String brandResponse = mockMvc.perform(post("/api/admin/brands")
                        .header("X-Dashboard-Admin-Key", ADMIN_KEY)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Acme Corp\"}"))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        String brandId = objectMapper.readTree(brandResponse).path("id").asText();

        String campaignResponse = mockMvc.perform(post("/api/admin/campaigns")
                        .header("X-Dashboard-Admin-Key", ADMIN_KEY)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"brandId\":\"" + brandId + "\",\"name\":\"Q4 Campaign\"}"))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        String campaignId = objectMapper.readTree(campaignResponse).path("id").asText();

        String podResponse = mockMvc.perform(post("/api/admin/campaigns/{campaignId}/pods", campaignId)
                        .header("X-Dashboard-Admin-Key", ADMIN_KEY)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"subject\":\"Pilot Pod Alpha\",\"joinApprovalMode\":\"approval_required\",\"plannedExternalSeats\":5}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.plannedExternalSeats").value(5))
                .andExpect(jsonPath("$.filledSeats").value(0))
                .andReturn().getResponse().getContentAsString();
        String podId = objectMapper.readTree(podResponse).path("id").asText();

        // 1. Add an entity (participant) to a seat in the pod
        String participantResponse = mockMvc.perform(post("/api/admin/pods/{podId}/participants", podId)
                        .header("X-Dashboard-Admin-Key", ADMIN_KEY)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"waId\":\"919876543210\",\"displayName\":\"Sarah Connor\",\"isExternal\":true}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.waId").value("919876543210"))
                .andExpect(jsonPath("$.displayName").value("Sarah Connor"))
                .andExpect(jsonPath("$.isExternal").value(true))
                .andExpect(jsonPath("$.status").value("ACTIVE"))
                .andReturn().getResponse().getContentAsString();
        String participantId = objectMapper.readTree(participantResponse).path("id").asText();

        // 2. Listing pods now shows 1 filled seat and the participant details
        mockMvc.perform(get("/api/admin/campaigns/{campaignId}/pods", campaignId)
                        .header("X-Dashboard-Admin-Key", ADMIN_KEY))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].filledSeats").value(1))
                .andExpect(jsonPath("$[0].plannedExternalSeats").value(5))
                .andExpect(jsonPath("$[0].participants[0].waId").value("919876543210"))
                .andExpect(jsonPath("$[0].participants[0].displayName").value("Sarah Connor"));

        // 3. Remove participant
        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete("/api/admin/pods/{podId}/participants/{participantId}", podId, participantId)
                        .header("X-Dashboard-Admin-Key", ADMIN_KEY))
                .andExpect(status().isNoContent());

        // 4. Listing pods shows 0 filled seats
        mockMvc.perform(get("/api/admin/campaigns/{campaignId}/pods", campaignId)
                        .header("X-Dashboard-Admin-Key", ADMIN_KEY))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].filledSeats").value(0))
                .andExpect(jsonPath("$[0].participants").isEmpty());
    }
}
