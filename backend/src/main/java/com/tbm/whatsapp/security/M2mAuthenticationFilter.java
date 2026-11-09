package com.tbm.whatsapp.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.List;

@Component
public class M2mAuthenticationFilter extends OncePerRequestFilter {
    private static final String HEADER = "X-Dashboard-Admin-Key";
    private final String expectedKey;

    public M2mAuthenticationFilter(@Value("${app.dashboard-admin-key:}") String expectedKey) {
        this.expectedKey = expectedKey;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        String suppliedKey = request.getHeader(HEADER);

        if (StringUtils.hasText(expectedKey) && StringUtils.hasText(suppliedKey) &&
                SecurityContextHolder.getContext().getAuthentication() == null) {
            if (MessageDigest.isEqual(expectedKey.getBytes(StandardCharsets.UTF_8), suppliedKey.getBytes(StandardCharsets.UTF_8))) {
                // Grant technical M2M integration and automated background processing authorities
                UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(
                        "m2m-system-worker",
                        null,
                        List.of(
                                new SimpleGrantedAuthority("ROLE_M2M"),
                                new SimpleGrantedAuthority("M2M_INTEGRATION"),
                                new SimpleGrantedAuthority("ROLE_ADMIN"),
                                new SimpleGrantedAuthority("WHATSAPP_CONTENT_READ"),
                                new SimpleGrantedAuthority("SUMMARY_READ"),
                                new SimpleGrantedAuthority("TELEMETRY_READ")
                        )
                );
                SecurityContextHolder.getContext().setAuthentication(auth);
            }
        }

        filterChain.doFilter(request, response);
    }
}
