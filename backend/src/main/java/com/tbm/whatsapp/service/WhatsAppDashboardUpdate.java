package com.tbm.whatsapp.service;

import java.util.UUID;

public record WhatsAppDashboardUpdate(String groupId, String eventType, UUID sourceId) {}
