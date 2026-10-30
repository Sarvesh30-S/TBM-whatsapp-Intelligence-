package com.tbm.whatsapp.service;

import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.beans.factory.annotation.Qualifier;

import java.nio.file.Path;

@Service
public class SarvamTranscriptionService {
    private final RestClient client;
    private final String apiKey;
    private final String model;
    private final String mode;

    public SarvamTranscriptionService(@Value("${app.ai.sarvam-api-key:}") String apiKey,
                                     @Value("${app.ai.sarvam-stt-model:saaras:v4}") String model,
                                     @Value("${app.ai.sarvam-stt-mode:codemix}") String mode,
                                     @Qualifier("sarvamRestClient") RestClient client) {
        this.apiKey = apiKey;
        this.model = model;
        this.mode = mode;
        this.client = client;
    }

    public boolean isConfigured() { return StringUtils.hasText(apiKey); }

    public Transcription transcribe(Path audioFile) {
        if (!isConfigured()) throw new MetaMediaDownloadService.MissingProviderCredentialException("SARVAM_API_KEY is not configured");
        MultiValueMap<String, Object> parts = new LinkedMultiValueMap<>();
        parts.add("file", new FileSystemResource(audioFile));
        parts.add("model", model);
        parts.add("mode", mode);
        parts.add("language_code", "unknown");
        try {
            JsonNode response = client.post().uri("/speech-to-text")
                    .contentType(MediaType.MULTIPART_FORM_DATA)
                    .header("api-subscription-key", apiKey)
                    .body(parts)
                    .retrieve().body(JsonNode.class);
            if (response == null || !StringUtils.hasText(response.path("transcript").asText())) {
                throw new IllegalStateException("Sarvam returned an empty transcript");
            }
            return new Transcription(response.path("transcript").asText(), response.path("language_code").asText(null));
        } catch (RestClientResponseException exception) {
            throw new IllegalStateException("Sarvam transcription failed with HTTP " + exception.getStatusCode().value());
        }
    }

    public record Transcription(String text, String language) {}
}
