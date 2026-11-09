package com.tbm.whatsapp.security;

import com.tbm.whatsapp.controller.AuthController;
import com.tbm.whatsapp.entity.Department;
import com.tbm.whatsapp.entity.Role;
import com.tbm.whatsapp.entity.User;
import com.tbm.whatsapp.repository.AuditLogRepository;
import com.tbm.whatsapp.repository.DepartmentRepository;
import com.tbm.whatsapp.repository.RefreshTokenRepository;
import com.tbm.whatsapp.repository.RoleRepository;
import com.tbm.whatsapp.repository.UserRepository;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AdminBootstrapTest {

    @Mock private AuthenticationManager authenticationManager;
    @Mock private JwtTokenProvider tokenProvider;
    @Mock private UserRepository userRepository;
    @Mock private RoleRepository roleRepository;
    @Mock private DepartmentRepository departmentRepository;
    @Mock private RefreshTokenRepository refreshTokenRepository;
    @Mock private AuditLogRepository auditLogRepository;
    @Mock private AuditLoggingService auditLoggingService;
    @Mock private PasswordEncoder passwordEncoder;
    @Mock private EntityManager entityManager;

    private AdminBootstrapService adminBootstrapService;
    private AuthController authController;
    private final String testBootstrapToken = "secure-env-bootstrap-token-xyz-12345";

    @BeforeEach
    void setUp() {
        adminBootstrapService = new AdminBootstrapService(
                userRepository,
                roleRepository,
                departmentRepository,
                auditLogRepository,
                auditLoggingService,
                passwordEncoder,
                entityManager,
                testBootstrapToken
        );

        authController = new AuthController(
                authenticationManager,
                tokenProvider,
                userRepository,
                roleRepository,
                departmentRepository,
                refreshTokenRepository,
                passwordEncoder,
                auditLoggingService,
                adminBootstrapService,
                7
        );
    }

    @Test
    @DisplayName("1. Successfully bootstrap initial administrator when 0 admins exist and token is valid")
    void shouldBootstrapWhenZeroAdminsExist() {
        when(auditLogRepository.existsByActionAndStatus("SYSTEM_BOOTSTRAP_COMPLETED", "SUCCESS")).thenReturn(false);
        when(userRepository.countTotalAdminsEverCreated()).thenReturn(0L);
        when(userRepository.existsByEmailIgnoreCase(any())).thenReturn(false);

        Role adminRole = new Role(UUID.randomUUID(), "ROLE_ADMIN", "Administrator", true);
        when(roleRepository.findByName("ROLE_ADMIN")).thenReturn(Optional.of(adminRole));
        when(departmentRepository.findByCode("EXECUTIVE")).thenReturn(Optional.empty());
        when(passwordEncoder.encode(any())).thenReturn("$2a$12$hashedPasswordExample");

        User savedUser = new User(UUID.randomUUID(), "admin@tbm.internal", "$2a$12$hashedPasswordExample", "System Administrator", null);
        when(userRepository.saveAndFlush(any(User.class))).thenReturn(savedUser);

        AuthController.BootstrapAdminRequest request = new AuthController.BootstrapAdminRequest(
                "admin@tbm.internal",
                "SuperSecretPassword123!",
                "System Administrator"
        );

        MockHttpServletRequest servletRequest = new MockHttpServletRequest();
        servletRequest.setRemoteAddr("127.0.0.1");
        ResponseEntity<?> response = authController.bootstrapAdmin(testBootstrapToken, request, servletRequest);

        assertEquals(HttpStatus.CREATED, response.getStatusCode());
        verify(passwordEncoder).encode("SuperSecretPassword123!");
        verify(userRepository).saveAndFlush(any(User.class));
        verify(auditLoggingService).record(any(), eq("SYSTEM_BOOTSTRAP_COMPLETED"), eq("SYSTEM"), any(), eq("127.0.0.1"), eq("SUCCESS"), any());
    }

    @Test
    @DisplayName("2. Reject bootstrap attempt when APP_ADMIN_BOOTSTRAP_TOKEN is missing or empty (fail-closed)")
    void shouldFailClosedWhenTokenNotConfiguredOnServer() {
        AdminBootstrapService unconfiguredService = new AdminBootstrapService(
                userRepository,
                roleRepository,
                departmentRepository,
                auditLogRepository,
                auditLoggingService,
                passwordEncoder,
                entityManager,
                "" // Missing / empty token
        );
        AuthController unconfiguredController = new AuthController(
                authenticationManager,
                tokenProvider,
                userRepository,
                roleRepository,
                departmentRepository,
                refreshTokenRepository,
                passwordEncoder,
                auditLoggingService,
                unconfiguredService,
                7
        );

        AuthController.BootstrapAdminRequest request = new AuthController.BootstrapAdminRequest(
                "admin@tbm.internal",
                "Password123!",
                "Admin"
        );

        MockHttpServletRequest servletRequest = new MockHttpServletRequest();
        ResponseEntity<?> response = unconfiguredController.bootstrapAdmin("any-token", request, servletRequest);

        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, response.getStatusCode());
        verify(userRepository, never()).saveAndFlush(any());
    }

    @Test
    @DisplayName("3. Reject bootstrap attempt when supplied token is wrong (constant-time check, no token logged)")
    void shouldRejectInvalidBootstrapToken() {
        AuthController.BootstrapAdminRequest request = new AuthController.BootstrapAdminRequest(
                "admin@tbm.internal",
                "Password123!",
                "Admin"
        );

        MockHttpServletRequest servletRequest = new MockHttpServletRequest();
        servletRequest.setRemoteAddr("10.0.0.1");
        ResponseEntity<?> response = authController.bootstrapAdmin("wrong-token-value", request, servletRequest);

        assertEquals(HttpStatus.UNAUTHORIZED, response.getStatusCode());
        verify(auditLoggingService).record(isNull(), eq("ADMIN_BOOTSTRAP_UNAUTHORIZED"), eq("SYSTEM"), eq("BOOTSTRAP"), eq("10.0.0.1"), eq("DENIED"), any());
        verify(userRepository, never()).saveAndFlush(any());
    }

    @Test
    @DisplayName("4. Reject bootstrap when admin already exists (permanent single-use guarantee)")
    void shouldRejectBootstrapWhenAdminAlreadyExists() {
        when(auditLogRepository.existsByActionAndStatus("SYSTEM_BOOTSTRAP_COMPLETED", "SUCCESS")).thenReturn(false);
        when(userRepository.countTotalAdminsEverCreated()).thenReturn(1L);

        AuthController.BootstrapAdminRequest request = new AuthController.BootstrapAdminRequest(
                "second.admin@tbm.internal",
                "Password123!",
                "Second Admin"
        );

        MockHttpServletRequest servletRequest = new MockHttpServletRequest();
        ResponseEntity<?> response = authController.bootstrapAdmin(testBootstrapToken, request, servletRequest);

        assertEquals(HttpStatus.CONFLICT, response.getStatusCode());
        verify(userRepository, never()).saveAndFlush(any());
    }

    @Test
    @DisplayName("5. Deactivating an administrator MUST NEVER reopen bootstrap (countTotalAdminsEverCreated > 0)")
    void deactivatingAdminDoesNotReopenBootstrap() {
        // Even if activeAdmins is 0 because admin was deactivated, countTotalAdminsEverCreated remains 1
        when(auditLogRepository.existsByActionAndStatus("SYSTEM_BOOTSTRAP_COMPLETED", "SUCCESS")).thenReturn(false);
        when(userRepository.countTotalAdminsEverCreated()).thenReturn(1L);

        AuthController.BootstrapAdminRequest request = new AuthController.BootstrapAdminRequest(
                "rogue.admin@tbm.internal",
                "Password123!",
                "Rogue Admin"
        );

        MockHttpServletRequest servletRequest = new MockHttpServletRequest();
        ResponseEntity<?> response = authController.bootstrapAdmin(testBootstrapToken, request, servletRequest);

        assertEquals(HttpStatus.CONFLICT, response.getStatusCode());
        verify(userRepository, never()).saveAndFlush(any());
    }

    @Test
    @DisplayName("6. Deleting user record MUST NEVER reopen bootstrap when audit completion log exists")
    void deletingUserDoesNotReopenBootstrapIfAuditRecordExists() {
        // Even if user table was truncated or deleted (totalAdmins = 0), audit ledger proves it was completed
        when(auditLogRepository.existsByActionAndStatus("SYSTEM_BOOTSTRAP_COMPLETED", "SUCCESS")).thenReturn(true);

        AuthController.BootstrapAdminRequest request = new AuthController.BootstrapAdminRequest(
                "attacker@tbm.internal",
                "Password123!",
                "Attacker"
        );

        MockHttpServletRequest servletRequest = new MockHttpServletRequest();
        ResponseEntity<?> response = authController.bootstrapAdmin(testBootstrapToken, request, servletRequest);

        assertEquals(HttpStatus.CONFLICT, response.getStatusCode());
        verify(userRepository, never()).saveAndFlush(any());
    }
}
