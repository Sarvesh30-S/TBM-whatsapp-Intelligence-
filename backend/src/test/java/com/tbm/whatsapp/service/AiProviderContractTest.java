package com.tbm.whatsapp.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.web.client.RestClient;

import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;

class AiProviderContractTest {
    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void openAiSummaryUsesStructuredSchemaAndOnlyReturnsKnownSourceIds() throws Exception {
        UUID knownId = UUID.randomUUID();
        var item = mapper.createObjectNode();
        item.put("category", "TASK");
        item.put("title", "Replace device");
        item.put("detail", "Arrange a replacement device.");
        item.put("confidence", 0.88);
        item.set("source_message_ids", mapper.createArrayNode()
                .add(knownId.toString()).add(UUID.randomUUID().toString()));
        item.put("due_at", "");
        var requestBodies = new CopyOnWriteArrayList<String>();
        String summaryResponse = "{\"output_text\":" + mapper.writeValueAsString(
                "{\"conversationSummary\":\"Device replacement is needed.\",\"confidence\":0.92}") + "}";
        String categoriesResponse = "{\"output_text\":" + mapper.writeValueAsString(
                mapper.writeValueAsString(payloadWithItem(item))) + "}";
        AtomicReference<String> authorization = new AtomicReference<>();

        withStub("/v1/responses", (body, index) -> index == 0 ? summaryResponse : categoriesResponse,
                requestBodies, authorization, server -> {
                    OpenAiContentService service = new OpenAiContentService(mapper, "test-openai-key", "test-model",
                            RestClient.builder().baseUrl("http://127.0.0.1:" + server.getAddress().getPort()).build());
                    var result = service.summarize("test-group", List.of(
                            new OpenAiContentService.MessageForSummary(knownId, Instant.parse("2026-10-27T00:00:00Z"),
                                    "Please replace the device.")));

                    assertThat(result.summary()).isEqualTo("Device replacement is needed.");
                    assertThat(result.confidence()).isEqualTo(0.92);
                    assertThat(result.items()).hasSize(1);
                    assertThat(result.items().getFirst().sourceMessageIds()).containsExactly(knownId.toString());
                    assertThat(authorization.get()).isEqualTo("Bearer test-openai-key");
                    assertThat(requestBodies).hasSize(2);
                    JsonNode firstRequest = mapper.readTree(requestBodies.get(0));
                    JsonNode secondRequest = mapper.readTree(requestBodies.get(1));
                    assertThat(firstRequest.path("model").asText()).isEqualTo("test-model");
                    assertThat(firstRequest.path("text").path("format").path("name").asText())
                            .isEqualTo("whatsapp_conversation_summary");
                    assertThat(secondRequest.path("text").path("format").path("name").asText())
                            .isEqualTo("whatsapp_category_lines");
                    assertThat(firstRequest.path("text").path("format").path("strict").asBoolean()).isTrue();
                    assertThat(firstRequest.toString()).contains(knownId.toString());
                    assertThat(secondRequest.toString()).contains(knownId.toString(), "Device replacement is needed.");
                });
    }

    @Test
    void sarvamTranscriptionSendsHindiHinglishModeAndReturnsTranscript(@TempDir Path tempDir) throws Exception {
        var requestBodies = new CopyOnWriteArrayList<String>();
        AtomicReference<String> subscriptionKey = new AtomicReference<>();
        Path audio = tempDir.resolve("voice-note.ogg");
        Files.write(audio, new byte[]{1, 2, 3, 4});

        withStub("/speech-to-text", (body, index) -> "{\"transcript\":\"kal subah meeting hai\",\"language_code\":\"hi-IN\"}",
                requestBodies, subscriptionKey, server -> {
                    SarvamTranscriptionService service = new SarvamTranscriptionService("test-sarvam-key",
                            "saaras:v4", "codemix",
                            RestClient.builder().baseUrl("http://127.0.0.1:" + server.getAddress().getPort()).build());
                    var result = service.transcribe(audio);

                    assertThat(result.text()).isEqualTo("kal subah meeting hai");
                    assertThat(result.language()).isEqualTo("hi-IN");
                    assertThat(subscriptionKey.get()).isEqualTo("test-sarvam-key");
                    assertThat(requestBodies.getFirst()).contains("saaras:v4", "codemix", "unknown", "voice-note.ogg");
                });
    }

    private JsonNode payloadWithItem(JsonNode item) {
        var payload = mapper.createObjectNode();
        payload.set("items", mapper.createArrayNode().add(item));
        return payload;
    }

    private void withStub(String path, ResponseProvider responseProvider, CopyOnWriteArrayList<String> requestBodies,
                          AtomicReference<String> credentialHeader, StubCheck check) throws Exception {
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        AtomicInteger requestCount = new AtomicInteger();
        server.createContext(path, exchange -> {
            String body = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
            requestBodies.add(body);
            int requestIndex = requestCount.getAndIncrement();
            credentialHeader.set(path.equals("/speech-to-text")
                    ? exchange.getRequestHeaders().getFirst("api-subscription-key")
                    : exchange.getRequestHeaders().getFirst("Authorization"));
            byte[] bytes = responseProvider.create(body, requestIndex).getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, bytes.length);
            exchange.getResponseBody().write(bytes);
            exchange.close();
        });
        server.start();
        try {
            check.run(server);
        } finally {
            server.stop(0);
        }
    }

    @FunctionalInterface
    private interface StubCheck {
        void run(HttpServer server) throws Exception;
    }

    @FunctionalInterface
    private interface ResponseProvider {
        String create(String requestBody, int requestIndex);
    }
}
