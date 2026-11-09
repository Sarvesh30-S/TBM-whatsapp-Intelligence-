package com.tbm.whatsapp.security;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

class JwtTokenProviderTest {
    private JwtTokenProvider tokenProvider;
    private final String secret = "404E635266556A586E3272357538782F413F4428472B4B6250645367566B5970";
    private final long expirationMs = 900000; // 15 minutes

    @BeforeEach
    void setUp() {
        tokenProvider = new JwtTokenProvider(secret, expirationMs);
    }

    @Test
    @DisplayName("Generate access token and extract claims successfully")
    void shouldGenerateAndValidateAccessToken() {
        UUID userId = UUID.randomUUID();
        UUID deptId = UUID.randomUUID();
        UserPrincipal principal = new UserPrincipal(
                userId,
                "manager@tbm.internal",
                "hash",
                "Operations Manager",
                deptId,
                true,
                Instant.now().minusSeconds(60),
                List.of(new SimpleGrantedAuthority("ROLE_MANAGER"), new SimpleGrantedAuthority("SUMMARY_GENERATE"))
        );

        String token = tokenProvider.generateAccessToken(principal);
        assertNotNull(token);
        assertTrue(tokenProvider.validateToken(token));
        assertEquals(userId, tokenProvider.getUserIdFromToken(token));
        assertNotNull(tokenProvider.getIssuedAtFromToken(token));
    }

    @Test
    @DisplayName("Reject invalid or tampered JWT token")
    void shouldRejectInvalidToken() {
        assertFalse(tokenProvider.validateToken("invalid.jwt.token"));
        assertFalse(tokenProvider.validateToken(""));
        assertFalse(tokenProvider.validateToken(null));
    }

    @Test
    @DisplayName("Generate unique raw refresh tokens and deterministic SHA-256 hashes")
    void shouldGenerateRawTokenAndHash() {
        String rawToken1 = tokenProvider.generateRawRefreshToken();
        String rawToken2 = tokenProvider.generateRawRefreshToken();

        assertNotNull(rawToken1);
        assertNotNull(rawToken2);
        assertNotEquals(rawToken1, rawToken2);

        String hash1a = tokenProvider.hashToken(rawToken1);
        String hash1b = tokenProvider.hashToken(rawToken1);
        String hash2 = tokenProvider.hashToken(rawToken2);

        assertEquals(hash1a, hash1b);
        assertNotEquals(hash1a, hash2);
        assertEquals(64, hash1a.length()); // 256-bit hex
    }
}
