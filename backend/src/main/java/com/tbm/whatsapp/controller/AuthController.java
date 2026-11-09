package com.tbm.whatsapp.controller;

import com.tbm.whatsapp.entity.Department;
import com.tbm.whatsapp.entity.RefreshToken;
import com.tbm.whatsapp.entity.Role;
import com.tbm.whatsapp.entity.User;
import com.tbm.whatsapp.repository.DepartmentRepository;
import com.tbm.whatsapp.repository.RefreshTokenRepository;
import com.tbm.whatsapp.repository.RoleRepository;
import com.tbm.whatsapp.repository.UserRepository;
import com.tbm.whatsapp.security.AdminBootstrapService;
import com.tbm.whatsapp.security.AuditLoggingService;
import com.tbm.whatsapp.security.JwtTokenProvider;
import com.tbm.whatsapp.security.UserPrincipal;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {
    private final AuthenticationManager authenticationManager;
    private final JwtTokenProvider tokenProvider;
    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final DepartmentRepository departmentRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuditLoggingService auditLoggingService;
    private final long refreshTokenExpirationDays;
    private final AdminBootstrapService adminBootstrapService;

    public AuthController(
            AuthenticationManager authenticationManager,
            JwtTokenProvider tokenProvider,
            UserRepository userRepository,
            RoleRepository roleRepository,
            DepartmentRepository departmentRepository,
            RefreshTokenRepository refreshTokenRepository,
            PasswordEncoder passwordEncoder,
            AuditLoggingService auditLoggingService,
            AdminBootstrapService adminBootstrapService,
            @Value("${app.jwt.refresh-token-expiration-days:7}") long refreshTokenExpirationDays) {
        this.authenticationManager = authenticationManager;
        this.tokenProvider = tokenProvider;
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.departmentRepository = departmentRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.passwordEncoder = passwordEncoder;
        this.auditLoggingService = auditLoggingService;
        this.adminBootstrapService = adminBootstrapService;
        this.refreshTokenExpirationDays = refreshTokenExpirationDays;
    }

    public record BootstrapAdminRequest(
            @NotBlank(message = "Email is required") @Email(message = "Invalid email format") String email,
            @NotBlank(message = "Password is required") String password,
            @NotBlank(message = "Full name is required") String fullName
    ) {}

    @PostMapping("/bootstrap")
    public ResponseEntity<?> bootstrapAdmin(
            @RequestHeader(name = "X-Bootstrap-Token", required = false) String suppliedToken,
            @Valid @RequestBody BootstrapAdminRequest request,
            HttpServletRequest servletRequest) {
        try {
            User adminUser = adminBootstrapService.bootstrapInitialAdmin(
                    suppliedToken,
                    request.email(),
                    request.password(),
                    request.fullName(),
                    servletRequest.getRemoteAddr()
            );

            return ResponseEntity.status(HttpStatus.CREATED)
                    .body(Map.of(
                            "message", "Administrator account bootstrapped successfully",
                            "userId", adminUser.getId().toString(),
                            "email", adminUser.getEmail(),
                            "role", "ROLE_ADMIN"
                    ));
        } catch (SecurityException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", e.getMessage()));
        } catch (IllegalStateException e) {
            if (e.getMessage() != null && e.getMessage().contains("not configured")) {
                return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                        .body(Map.of("error", e.getMessage()));
            }
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(Map.of("error", e.getMessage()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    public record LoginRequest(
            @NotBlank(message = "Email is required") @Email(message = "Invalid email format") String email,
            @NotBlank(message = "Password is required") String password
    ) {}

    public record UserProfileDto(
            UUID id,
            String email,
            String fullName,
            String jobTitle,
            String departmentCode,
            String departmentName,
            List<String> roles,
            List<String> permissions,
            boolean mustChangePassword
    ) {}

    public record AuthResponse(
            String accessToken,
            UserProfileDto user
    ) {}

    @PostMapping("/login")
    @Transactional
    public ResponseEntity<?> login(
            @Valid @RequestBody LoginRequest request,
            HttpServletRequest servletRequest,
            HttpServletResponse servletResponse) {
        try {
            Authentication authentication = authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(request.email().trim().toLowerCase(), request.password())
            );

            UserPrincipal principal = (UserPrincipal) authentication.getPrincipal();
            User user = userRepository.findById(principal.getId()).orElseThrow();

            if (!user.isActive()) {
                auditLoggingService.record(user.getId(), "LOGIN_ATTEMPT", "USER", user.getId().toString(),
                        servletRequest.getRemoteAddr(), "DENIED", Map.of("reason", "Account deactivated"));
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(Map.of("error", "Account has been deactivated. Contact your administrator."));
            }

            String accessToken = tokenProvider.generateAccessToken(principal);
            String rawRefreshToken = tokenProvider.generateRawRefreshToken();
            String hashedRefreshToken = tokenProvider.hashToken(rawRefreshToken);

            UUID familyId = UUID.randomUUID();
            Instant expiresAt = Instant.now().plus(refreshTokenExpirationDays, ChronoUnit.DAYS);

            RefreshToken refreshToken = new RefreshToken(
                    UUID.randomUUID(),
                    user,
                    hashedRefreshToken,
                    familyId,
                    1,
                    expiresAt,
                    servletRequest.getRemoteAddr(),
                    servletRequest.getHeader("User-Agent")
            );
            refreshTokenRepository.save(refreshToken);

            // Set HttpOnly, Secure, SameSite=Strict cookie scoped to /api/v1/auth
            ResponseCookie cookie = ResponseCookie.from("refresh_token", rawRefreshToken)
                    .httpOnly(true)
                    .secure(servletRequest.isSecure())
                    .path("/api/v1/auth")
                    .maxAge(refreshTokenExpirationDays * 24 * 60 * 60)
                    .sameSite("Strict")
                    .build();
            servletResponse.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());

            auditLoggingService.record(user.getId(), "LOGIN_SUCCESS", "USER", user.getId().toString(),
                    servletRequest.getRemoteAddr(), "SUCCESS", Map.of("email", user.getEmail()));

            UserProfileDto profile = buildProfileDto(user, principal);
            return ResponseEntity.ok(new AuthResponse(accessToken, profile));
        } catch (BadCredentialsException e) {
            auditLoggingService.record(null, "LOGIN_FAILED", "USER", request.email(),
                    servletRequest.getRemoteAddr(), "DENIED", Map.of("email", request.email()));
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Invalid email or password"));
        }
    }

    @PostMapping("/refresh")
    @Transactional
    public ResponseEntity<?> refresh(
            @CookieValue(name = "refresh_token", required = false) String rawRefreshToken,
            HttpServletRequest servletRequest,
            HttpServletResponse servletResponse) {
        if (rawRefreshToken == null || rawRefreshToken.isBlank()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Refresh token cookie missing"));
        }

        String hashedToken = tokenProvider.hashToken(rawRefreshToken);
        Optional<RefreshToken> tokenOpt = refreshTokenRepository.findByTokenHash(hashedToken);

        if (tokenOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Invalid refresh token"));
        }

        RefreshToken oldToken = tokenOpt.get();

        // THEFT / REPLAY DETECTION: If token was already revoked, revoke entire family!
        if (oldToken.isRevoked() || oldToken.isExpired()) {
            refreshTokenRepository.revokeFamily(oldToken.getFamilyId(), Instant.now());
            auditLoggingService.record(oldToken.getUser().getId(), "TOKEN_THEFT_DETECTED", "REFRESH_TOKEN",
                    oldToken.getFamilyId().toString(), servletRequest.getRemoteAddr(), "DENIED",
                    Map.of("familyId", oldToken.getFamilyId().toString()));

            ResponseCookie clearCookie = ResponseCookie.from("refresh_token", "")
                    .httpOnly(true).secure(servletRequest.isSecure()).path("/api/v1/auth").maxAge(0).sameSite("Strict").build();
            servletResponse.addHeader(HttpHeaders.SET_COOKIE, clearCookie.toString());

            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Compromised or expired session. Please log in again."));
        }

        User user = oldToken.getUser();
        if (!user.isActive()) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", "Account has been deactivated."));
        }

        // Rotate token
        String newRawRefreshToken = tokenProvider.generateRawRefreshToken();
        String newHashedRefreshToken = tokenProvider.hashToken(newRawRefreshToken);

        oldToken.setRevokedAt(Instant.now());
        oldToken.setReplacedByHash(newHashedRefreshToken);
        refreshTokenRepository.save(oldToken);

        Instant expiresAt = Instant.now().plus(refreshTokenExpirationDays, ChronoUnit.DAYS);
        RefreshToken newToken = new RefreshToken(
                UUID.randomUUID(),
                user,
                newHashedRefreshToken,
                oldToken.getFamilyId(),
                oldToken.getSequenceNumber() + 1,
                expiresAt,
                servletRequest.getRemoteAddr(),
                servletRequest.getHeader("User-Agent")
        );
        refreshTokenRepository.save(newToken);

        UserPrincipal principal = UserPrincipal.create(user);
        String newAccessToken = tokenProvider.generateAccessToken(principal);

        ResponseCookie cookie = ResponseCookie.from("refresh_token", newRawRefreshToken)
                .httpOnly(true)
                .secure(servletRequest.isSecure())
                .path("/api/v1/auth")
                .maxAge(refreshTokenExpirationDays * 24 * 60 * 60)
                .sameSite("Strict")
                .build();
        servletResponse.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());

        return ResponseEntity.ok(Map.of("accessToken", newAccessToken));
    }

    @PostMapping("/logout")
    @Transactional
    public ResponseEntity<?> logout(
            @CookieValue(name = "refresh_token", required = false) String rawRefreshToken,
            @AuthenticationPrincipal UserPrincipal principal,
            HttpServletRequest servletRequest,
            HttpServletResponse servletResponse) {
        if (rawRefreshToken != null && !rawRefreshToken.isBlank()) {
            String hashedToken = tokenProvider.hashToken(rawRefreshToken);
            refreshTokenRepository.findByTokenHash(hashedToken).ifPresent(token -> {
                refreshTokenRepository.revokeFamily(token.getFamilyId(), Instant.now());
            });
        }

        if (principal != null) {
            auditLoggingService.record(principal.getId(), "LOGOUT", "USER", principal.getId().toString(),
                    servletRequest.getRemoteAddr(), "SUCCESS", Map.of());
        }

        ResponseCookie clearCookie = ResponseCookie.from("refresh_token", "")
                .httpOnly(true)
                .secure(servletRequest.isSecure())
                .path("/api/v1/auth")
                .maxAge(0)
                .sameSite("Strict")
                .build();
        servletResponse.addHeader(HttpHeaders.SET_COOKIE, clearCookie.toString());

        return ResponseEntity.ok(Map.of("message", "Logged out successfully"));
    }

    @GetMapping("/me")
    public ResponseEntity<?> me(@AuthenticationPrincipal UserPrincipal principal) {
        if (principal == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        User user = userRepository.findById(principal.getId()).orElseThrow();
        return ResponseEntity.ok(buildProfileDto(user, principal));
    }

    public record ChangePasswordRequest(
            @NotBlank(message = "Current password is required") String currentPassword,
            @NotBlank(message = "New password is required") @jakarta.validation.constraints.Size(min = 8, message = "New password must be at least 8 characters") String newPassword
    ) {}

    @PostMapping("/change-password")
    @Transactional
    public ResponseEntity<?> changePassword(
            @AuthenticationPrincipal UserPrincipal principal,
            @Valid @RequestBody ChangePasswordRequest request,
            HttpServletRequest servletRequest,
            HttpServletResponse servletResponse) {
        if (principal == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        User user = userRepository.findById(principal.getId()).orElseThrow();

        if (!passwordEncoder.matches(request.currentPassword(), user.getPasswordHash())) {
            auditLoggingService.record(user.getId(), "PASSWORD_CHANGE_FAILED", "USER", user.getId().toString(),
                    servletRequest.getRemoteAddr(), "DENIED", Map.of("reason", "INVALID_CURRENT_PASSWORD"));
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("error", "Current password does not match"));
        }

        user.setPasswordHash(passwordEncoder.encode(request.newPassword()));
        user.setMustChangePassword(false);
        user.setTokenInvalidBefore(Instant.now());
        userRepository.save(user);

        // Revoke all existing refresh token families for the user
        refreshTokenRepository.revokeAllForUser(user.getId(), Instant.now());

        // Clear refresh cookie
        ResponseCookie clearCookie = ResponseCookie.from("refresh_token", "")
                .httpOnly(true)
                .secure(servletRequest.isSecure())
                .path("/api/v1/auth")
                .maxAge(0)
                .sameSite("Strict")
                .build();
        servletResponse.addHeader(HttpHeaders.SET_COOKIE, clearCookie.toString());

        auditLoggingService.record(user.getId(), "PASSWORD_CHANGED", "USER", user.getId().toString(),
                servletRequest.getRemoteAddr(), "SUCCESS", Map.of());

        return ResponseEntity.ok(Map.of("message", "Password changed successfully. Please log in again with your new password."));
    }

    private UserProfileDto buildProfileDto(User user, UserPrincipal principal) {
        List<String> roles = user.getRoles().stream()
                .map(r -> r.getName())
                .collect(Collectors.toList());

        List<String> permissions = principal.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .filter(auth -> !auth.startsWith("ROLE_"))
                .collect(Collectors.toList());

        Department dept = user.getDepartment();

        return new UserProfileDto(
                user.getId(),
                user.getEmail(),
                user.getFullName(),
                user.getJobTitle(),
                dept != null ? dept.getCode() : null,
                dept != null ? dept.getName() : null,
                roles,
                permissions,
                user.isMustChangePassword()
        );
    }
}
