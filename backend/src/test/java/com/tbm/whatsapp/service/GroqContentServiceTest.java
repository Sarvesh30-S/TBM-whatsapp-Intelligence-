package com.tbm.whatsapp.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.Test;

import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;

class GroqContentServiceTest {
    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void groqSummaryUsesGptOss120bAndValidatesSourceIds() throws Exception {
        UUID knownId = UUID.randomUUID();
        var requestBodies = new CopyOnWriteArrayList<String>();
        AtomicReference<String> authorization = new AtomicReference<>();

        String stage1Response = "{\"choices\":[{\"message\":{\"role\":\"assistant\",\"content\":\"{\\\"conversationSummary\\\":\\\"Urgent timeline update discussed.\\\",\\\"confidence\\\":0.94}\"}}]}";
        String stage2Response = "{\"choices\":[{\"message\":{\"role\":\"assistant\",\"content\":\"{\\\"items\\\":[{\\\"category\\\":\\\"TASK\\\",\\\"title\\\":\\\"Timeline commitment\\\",\\\"detail\\\":\\\"Will share files today 4pm\\\",\\\"confidence\\\":0.95,\\\"source_message_ids\\\":[\\\"" + knownId + "\\\",\\\"" + UUID.randomUUID() + "\\\"],\\\"due_at\\\":\\\"\\\"}]}\"}}]}";

        withStub("/openai/v1/chat/completions", 200, (body, index) -> index == 0 ? stage1Response : stage2Response,
                requestBodies, authorization, server -> {
                    String endpoint = "http://127.0.0.1:" + server.getAddress().getPort() + "/openai/v1/chat/completions";
                    GroqContentService service = new GroqContentService(mapper, "gsk-test-key", "openai/gpt-oss-120b", endpoint);

                    assertThat(service.isConfigured()).isTrue();
                    assertThat(service.modelName()).isEqualTo("openai/gpt-oss-120b");

                    var result = service.summarize("test-group", List.of(
                            new OpenAiContentService.MessageForSummary(knownId, Instant.parse("2026-11-09T06:53:00Z"),
                                    "Will share today 4pm")));

                    assertThat(result.summary()).isEqualTo("Urgent timeline update discussed.");
                    assertThat(result.confidence()).isEqualTo(0.94);
                    assertThat(result.items()).hasSize(1);
                    // Crucial Task 10: Evidence validation filters out unknown IDs
                    assertThat(result.items().getFirst().sourceMessageIds()).containsExactly(knownId.toString());
                    assertThat(authorization.get()).isEqualTo("Bearer gsk-test-key");

                    assertThat(requestBodies).hasSize(2);
                    JsonNode req1 = mapper.readTree(requestBodies.get(0));
                    assertThat(req1.path("model").asText()).isEqualTo("openai/gpt-oss-120b");
                    assertThat(req1.path("response_format").path("type").asText()).isEqualTo("json_object");
                });
    }

    @Test
    void groqHandlesHttp404GracefullyWithFallback() throws Exception {
        UUID knownId = UUID.randomUUID();
        var requestBodies = new CopyOnWriteArrayList<String>();
        AtomicReference<String> authorization = new AtomicReference<>();

        String errResponse = "{\"error\":{\"message\":\"The model `openai/gpt-oss-120b` does not exist or you do not have access to it.\",\"type\":\"invalid_request_error\",\"code\":\"model_not_found\"}}";

        withStub("/openai/v1/chat/completions", 404, (body, index) -> errResponse,
                requestBodies, authorization, server -> {
                    String endpoint = "http://127.0.0.1:" + server.getAddress().getPort() + "/openai/v1/chat/completions";
                    GroqContentService service = new GroqContentService(mapper, "gsk-test-key", "openai/gpt-oss-120b", endpoint);

                    // When 404 occurs, it falls back to heuristic summary without throwing unhandled exception
                    var result = service.summarize("test-group", List.of(
                            new OpenAiContentService.MessageForSummary(knownId, Instant.now(),
                                    "Will share timeline today 4pm")));

                    assertThat(result).isNotNull();
                    assertThat(result.summary()).contains("Operational communication in group test-group");
                    assertThat(result.items()).isNotEmpty();
                });
    }

    @Test
    void unconfiguredGroqUsesHeuristicSummary() throws Exception {
        GroqContentService service = new GroqContentService(mapper, "", "openai/gpt-oss-120b", "https://api.groq.com/openai/v1/chat/completions");
        assertThat(service.isConfigured()).isFalse();

        UUID id = UUID.randomUUID();
        var result = service.summarize("group-123", List.of(
                new OpenAiContentService.MessageForSummary(id, Instant.now(), "Urgent budget invoice approval needed today")));

        assertThat(result.summary()).contains("group-123");
        assertThat(result.items()).hasSizeGreaterThanOrEqualTo(1);
    }

    private void withStub(String path, int statusCode, ResponseProvider responseProvider, CopyOnWriteArrayList<String> requestBodies,
                          AtomicReference<String> credentialHeader, StubCheck check) throws Exception {
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        AtomicInteger requestCount = new AtomicInteger();
        server.createContext(path, exchange -> {
            String body = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
            requestBodies.add(body);
            int requestIndex = requestCount.getAndIncrement();
            credentialHeader.set(exchange.getRequestHeaders().getFirst("Authorization"));
            byte[] bytes = responseProvider.create(body, requestIndex).getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(statusCode, bytes.length);
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
