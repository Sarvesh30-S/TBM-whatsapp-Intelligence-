package com.tbm.whatsapp.config;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.servlet.HandlerInterceptor;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

@Component
public class DashboardAdminKeyInterceptor implements HandlerInterceptor {
    private static final String HEADER = "X-Dashboard-Admin-Key";
    private final String expectedKey;

    public DashboardAdminKeyInterceptor(@Value("${app.dashboard-admin-key:}") String expectedKey) {
        this.expectedKey = expectedKey;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        if (!StringUtils.hasText(expectedKey)) {
            response.sendError(HttpServletResponse.SC_SERVICE_UNAVAILABLE, "Dashboard admin key is not configured");
            return false;
        }

        String suppliedKey = request.getHeader(HEADER);
        if (suppliedKey == null || !MessageDigest.isEqual(
                expectedKey.getBytes(StandardCharsets.UTF_8), suppliedKey.getBytes(StandardCharsets.UTF_8))) {
            response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "Dashboard authentication required");
            return false;
        }
        return true;
    }
}
