package com.tbm.whatsapp.webhook;

import org.springframework.stereotype.Component;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;

@Component
public class MetaWebhookSignatureVerifier {
    public boolean isValid(String rawBody, String signatureHeader, String appSecret) {
        if (rawBody == null || signatureHeader == null || appSecret == null || appSecret.isBlank()) {
            return false;
        }
        if (!signatureHeader.startsWith("sha256=")) {
            return false;
        }

        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(appSecret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] digest = mac.doFinal(rawBody.getBytes(StandardCharsets.UTF_8));
            byte[] supplied = HexFormat.of().parseHex(signatureHeader.substring("sha256=".length()));
            return MessageDigest.isEqual(digest, supplied);
        } catch (Exception exception) {
            return false;
        }
    }
}
