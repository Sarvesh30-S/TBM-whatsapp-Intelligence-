package com.tbm.whatsapp.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "meta")
public record MetaApiProperties(
        String graphApiVersion,
        String accessToken,
        String phoneNumberId,
        String wabaId,
        String appSecret,
        String webhookVerifyToken
) {
    public String graphApiBaseUrl() {
        return "https://graph.facebook.com/" + graphApiVersion;
    }
}
