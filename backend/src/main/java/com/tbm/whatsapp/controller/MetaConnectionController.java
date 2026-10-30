package com.tbm.whatsapp.controller;

import com.tbm.whatsapp.config.MetaApiProperties;
import org.springframework.http.HttpStatus;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.client.RestClient;
import org.springframework.http.ResponseEntity;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.Map;

@RestController
@RequestMapping("/api/meta")
public class MetaConnectionController {
    private final MetaApiProperties properties;
    private final RestClient metaRestClient;
    private final ObjectMapper objectMapper;

    public MetaConnectionController(MetaApiProperties properties, RestClient metaRestClient, ObjectMapper objectMapper) {
        this.properties = properties;
        this.metaRestClient = metaRestClient;
        this.objectMapper = objectMapper;
    }

    @GetMapping("/test-connection")
    public ResponseEntity<?> testConnection() {
        if (!StringUtils.hasText(properties.accessToken()) || !StringUtils.hasText(properties.phoneNumberId())) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(Map.of(
                    "connected", false,
                    "message", "Set META_ACCESS_TOKEN and META_PHONE_NUMBER_ID in the local environment first"
            ));
        }
        try {
            String responseBody = metaRestClient.get()
                    .uri("/{phoneNumberId}?fields=display_phone_number,verified_name",
                            properties.phoneNumberId())
                    .headers(headers -> headers.setBearerAuth(properties.accessToken()))
                    .retrieve()
                    .body(String.class);
            JsonNode response = objectMapper.readTree(responseBody);
            return ResponseEntity.ok(Map.of("connected", true, "phoneNumber", response));
        } catch (RestClientResponseException exception) {
            String details = metaErrorDetails(exception);
            System.err.println("[Meta] Test profile lookup rejected: " + details);
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY).body(Map.of(
                    "connected", false,
                    "message", details
            ));
        } catch (Exception exception) {
            System.err.println("[Meta] Test profile lookup failed: " + exception.getClass().getSimpleName());
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY).body(Map.of(
                    "connected", false,
                    "message", "Meta test API request failed (" + exception.getClass().getSimpleName() + ")"
            ));
        }
    }

    private String metaErrorDetails(RestClientResponseException exception) {
        String details = "Graph API HTTP " + exception.getStatusCode().value();
        try {
            JsonNode error = objectMapper.readTree(exception.getResponseBodyAsString()).path("error");
            if (error.hasNonNull("code")) details += ", code " + error.path("code").asText();
            if (error.hasNonNull("error_subcode")) details += ", subcode " + error.path("error_subcode").asText();
            if (error.hasNonNull("message")) details += ": " + error.path("message").asText();
        } catch (Exception ignored) {
            // Don't include raw response content; it may contain account-specific data.
        }
        return details;
    }
}
