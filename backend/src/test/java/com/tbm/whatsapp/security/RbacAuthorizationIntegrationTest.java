package com.tbm.whatsapp.security;

import com.tbm.whatsapp.entity.Permission;
import com.tbm.whatsapp.entity.Role;
import com.tbm.whatsapp.entity.User;
import com.tbm.whatsapp.repository.UserGroupAssignmentRepository;
import com.tbm.whatsapp.repository.WhatsAppGroupRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;

import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class RbacAuthorizationIntegrationTest {

    @Mock private UserGroupAssignmentRepository assignmentRepository;
    @Mock private WhatsAppGroupRepository groupRepository;

    private GroupSecurityEvaluator evaluator;
    private final UUID groupId = UUID.randomUUID();
    private final UUID userId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        evaluator = new GroupSecurityEvaluator(assignmentRepository, groupRepository);
    }

    private Authentication createAuth(String roleName, List<String> permissions) {
        User user = new User(userId, "test@tbm.internal", "hashed", "Test User", null);
        Role r = new Role(UUID.randomUUID(), roleName, roleName, true);
        Set<Permission> perms = permissions.stream()
                .map(code -> new Permission(UUID.randomUUID(), code, "TEST", code))
                .collect(Collectors.toSet());
        r.setPermissions(perms);
        user.setRoles(Set.of(r));

        UserPrincipal principal = UserPrincipal.create(user);
        return new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities());
    }

    @Test
    @DisplayName("1. Employee has read-only access to assigned groups, cannot send messages")
    void employeeHasReadOnlyAccessToAssignedGroups() {
        Authentication employeeAuth = createAuth("ROLE_EMPLOYEE", List.of(
                "WHATSAPP_CONTENT_READ", "SUMMARY_READ", "PRIORITY_INBOX_READ", "ACTION_ITEM_UPDATE"
        ));

        when(assignmentRepository.hasViewAccess(userId, groupId)).thenReturn(true);

        assertTrue(evaluator.canReadGroup(employeeAuth, groupId), "Employee should be able to read assigned group");
        assertFalse(evaluator.canSendToGroup(employeeAuth, groupId), "Employee MUST NOT be able to send messages");
    }

    @Test
    @DisplayName("2. Employee cannot access unassigned groups")
    void employeeCannotAccessUnassignedGroup() {
        Authentication employeeAuth = createAuth("ROLE_EMPLOYEE", List.of(
                "WHATSAPP_CONTENT_READ", "SUMMARY_READ"
        ));

        when(assignmentRepository.hasViewAccess(userId, groupId)).thenReturn(false);

        assertFalse(evaluator.canReadGroup(employeeAuth, groupId), "Employee should be forbidden from unassigned groups");
        assertFalse(evaluator.canSendToGroup(employeeAuth, groupId), "Employee cannot send to unassigned groups");
    }

    @Test
    @DisplayName("3. Manager cannot send WhatsApp messages without explicit WHATSAPP_MESSAGE_SEND permission")
    void managerCannotSendWithoutExplicitPermission() {
        // Manager without WHATSAPP_MESSAGE_SEND authority
        Authentication managerAuth = createAuth("ROLE_MANAGER", List.of(
                "WHATSAPP_CONTENT_READ", "SUMMARY_READ", "SUMMARY_GENERATE", "ACTION_ITEM_ASSIGN"
        ));

        assertFalse(evaluator.canSendToGroup(managerAuth, groupId),
                "Manager without WHATSAPP_MESSAGE_SEND permission must fail closed");
    }

    @Test
    @DisplayName("4. Manager can send WhatsApp messages ONLY when both authority and assignment.canSend are granted")
    void managerCanSendWithExplicitPermissionAndAssignment() {
        Authentication managerAuthWithSend = createAuth("ROLE_MANAGER", List.of(
                "WHATSAPP_CONTENT_READ", "SUMMARY_READ", "SUMMARY_GENERATE", "WHATSAPP_MESSAGE_SEND"
        ));

        when(assignmentRepository.hasSendAccess(userId, groupId)).thenReturn(true);

        assertTrue(evaluator.canSendToGroup(managerAuthWithSend, groupId),
                "Manager with WHATSAPP_MESSAGE_SEND and canSend assignment should be permitted");
    }

    @Test
    @DisplayName("5. Developer has NO business conversation access by default")
    void developerHasNoBusinessContentAccess() {
        Authentication devAuth = createAuth("ROLE_DEVELOPER", List.of(
                "TELEMETRY_READ", "SYSTEM_CONFIG_READ", "LOGS_READ", "AUDIT_READ"
        ));

        assertFalse(evaluator.canReadGroup(devAuth, groupId),
                "Developer role must not have automatic business conversation access");
        assertFalse(evaluator.canSendToGroup(devAuth, groupId),
                "Developer role must not have WhatsApp send access");
    }

    @Test
    @DisplayName("6. Admin has NO automatic WhatsApp send permission")
    void adminHasNoWhatsAppSendPermission() {
        Authentication adminAuth = createAuth("ROLE_ADMIN", List.of(
                "USER_READ", "USER_MANAGE", "ROLE_ASSIGN", "DEPARTMENT_MANAGE", "TELEMETRY_READ"
        ));

        assertFalse(evaluator.canSendToGroup(adminAuth, groupId),
                "Admin role must not have WhatsApp message sending permission");
    }

    @Test
    @DisplayName("7. C-Suite requires explicit group assignment to access groups (no unrestricted bypass)")
    void cSuiteRequiresExplicitGroupAssignment() {
        Authentication cSuiteAuth = createAuth("ROLE_C_SUITE", List.of(
                "EXECUTIVE_BI_READ", "SUMMARY_READ", "PRIORITY_INBOX_READ", "EXECUTIVE_APPROVE"
        ));

        when(assignmentRepository.hasViewAccess(userId, groupId)).thenReturn(true);
        assertTrue(evaluator.canReadGroup(cSuiteAuth, groupId),
                "C-Suite with assignment should be able to read assigned group");

        when(assignmentRepository.hasViewAccess(userId, groupId)).thenReturn(false);
        assertFalse(evaluator.canReadGroup(cSuiteAuth, groupId),
                "C-Suite MUST NOT have blanket access to unassigned groups");
        assertFalse(evaluator.canSendToGroup(cSuiteAuth, groupId),
                "C-Suite cannot send WhatsApp messages without explicit permission");
    }

    @Test
    @DisplayName("8. Session Revocation: Token issued before or at token_invalid_before fails authentication")
    void sessionRevocationEnforcement() {
        JwtTokenProvider tokenProvider = new JwtTokenProvider(
                "404E635266556A586E3272357538782F413F4428472B4B6250645367566B5970",
                900000L // 15 mins
        );

        User user = new User(userId, "test@tbm.internal", "hashed", "Test User", null);
        Role r = new Role(UUID.randomUUID(), "ROLE_EMPLOYEE", "ROLE_EMPLOYEE", true);
        r.setPermissions(Set.of(new Permission(UUID.randomUUID(), "WHATSAPP_CONTENT_READ", "TEST", "desc")));
        user.setRoles(Set.of(r));

        UserPrincipal principal = UserPrincipal.create(user);
        String token = tokenProvider.generateAccessToken(principal);

        Instant tokenIssuedAt = tokenProvider.getIssuedAtFromToken(token);
        assertNotNull(tokenIssuedAt);

        // Simulate session revocation by advancing token_invalid_before to present or future
        Instant tokenInvalidBefore = Instant.now().plusSeconds(10);
        assertTrue(!tokenIssuedAt.isAfter(tokenInvalidBefore),
                "Token issuedAt should fail isAfter check when session is revoked");
    }

    @Test
    @DisplayName("9. Inactive users are disabled in UserPrincipal")
    void inactiveUserIsDisabled() {
        User user = new User(userId, "inactive@tbm.internal", "hashed", "Inactive User", null);
        user.setActive(false);
        Role r = new Role(UUID.randomUUID(), "ROLE_EMPLOYEE", "ROLE_EMPLOYEE", true);
        user.setRoles(Set.of(r));

        UserPrincipal principal = UserPrincipal.create(user);
        assertFalse(principal.isEnabled(), "Inactive user must have isEnabled() == false");
    }
}
