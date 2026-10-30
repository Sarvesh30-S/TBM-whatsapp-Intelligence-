package com.tbm.whatsapp.webhook;

import com.tbm.whatsapp.config.MetaApiProperties;
import com.tbm.whatsapp.service.WhatsAppWebhookIngestionService;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

class WhatsAppWebhookControllerTest {
    private final WhatsAppWebhookController controller = new WhatsAppWebhookController(
            new MetaApiProperties("v23.0", "", "", "", "app-secret", "chosen-verify-token"),
            new MetaWebhookSignatureVerifier(), mock(WhatsAppWebhookIngestionService.class));

    @Test
    void returnsChallengeOnlyForExpectedSubscribeToken() {
        var success = controller.verifyWebhook("subscribe", "chosen-verify-token", "challenge-123");
        var rejected = controller.verifyWebhook("subscribe", "wrong-token", "challenge-123");

        assertThat(success.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(success.getBody()).isEqualTo("challenge-123");
        assertThat(rejected.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    }

    @Test
    void acknowledgesValidSignedWebhookAndRejectsInvalidSignature() throws Exception {
        String body = "{\"object\":\"whatsapp_business_account\"}";
        javax.crypto.Mac mac = javax.crypto.Mac.getInstance("HmacSHA256");
        mac.init(new javax.crypto.spec.SecretKeySpec("app-secret".getBytes(java.nio.charset.StandardCharsets.UTF_8), "HmacSHA256"));
        String signature = "sha256=" + java.util.HexFormat.of().formatHex(
                mac.doFinal(body.getBytes(java.nio.charset.StandardCharsets.UTF_8)));

        assertThat(controller.receiveWebhook(body, signature).getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(controller.receiveWebhook(body, "sha256=00").getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    }
}
