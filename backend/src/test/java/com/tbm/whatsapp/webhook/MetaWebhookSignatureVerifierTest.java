package com.tbm.whatsapp.webhook;

import org.junit.jupiter.api.Test;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.HexFormat;

import static org.assertj.core.api.Assertions.assertThat;

class MetaWebhookSignatureVerifierTest {
    private final MetaWebhookSignatureVerifier verifier = new MetaWebhookSignatureVerifier();

    @Test
    void acceptsCorrectRawBodySignature() throws Exception {
        String body = "{\"object\":\"whatsapp_business_account\"}";
        String secret = "local-test-secret";
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        String signature = "sha256=" + HexFormat.of().formatHex(mac.doFinal(body.getBytes(StandardCharsets.UTF_8)));

        assertThat(verifier.isValid(body, signature, secret)).isTrue();
    }

    @Test
    void rejectsWrongSignatureAndMissingSecret() {
        assertThat(verifier.isValid("{}", "sha256=00", "secret")).isFalse();
        assertThat(verifier.isValid("{}", "sha256=00", "")).isFalse();
        assertThat(verifier.isValid("{}", null, "secret")).isFalse();
    }
}
