package com.tbm.whatsapp.service;

import com.tbm.whatsapp.repository.CampaignRepository;
import com.tbm.whatsapp.repository.WhatsAppGroupRepository;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionalEventListener;

import java.util.Map;

@Component
public class DashboardEventListener {
    private final DashboardEventHub hub;
    private final WhatsAppGroupRepository groups;
    private final CampaignRepository campaigns;

    public DashboardEventListener(DashboardEventHub hub, WhatsAppGroupRepository groups, CampaignRepository campaigns) {
        this.hub = hub;
        this.groups = groups;
        this.campaigns = campaigns;
    }

    @TransactionalEventListener
    public void onUpdate(WhatsAppDashboardUpdate event) {
        if (event.groupId() == null) return;
        groups.findByMetaGroupId(event.groupId()).flatMap(group -> campaigns.findById(group.getCampaignId()))
                .ifPresent(campaign -> hub.publish(campaign.getBrandId(), Map.of(
                        "type", event.eventType(),
                        "sourceId", event.sourceId() == null ? "" : event.sourceId().toString(),
                        "groupId", event.groupId())));
    }
}
