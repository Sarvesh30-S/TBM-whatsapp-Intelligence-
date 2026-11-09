package com.tbm.whatsapp.security;

import com.tbm.whatsapp.entity.WhatsAppGroup;
import com.tbm.whatsapp.repository.UserGroupAssignmentRepository;
import com.tbm.whatsapp.repository.WhatsAppGroupRepository;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;

import java.util.Collections;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

/**
 * Enterprise Resource-Level Group Security Evaluator.
 * Enforces explicit group assignments for EMPLOYEES, MANAGERS, C_SUITE, DEVELOPERS, and ADMINS.
 * Prevents IDOR, parameter tampering, and unassigned cross-department data leakage.
 */
@Component("groupSecurity")
public class GroupSecurityEvaluator {
    private final UserGroupAssignmentRepository assignmentRepository;
    private final WhatsAppGroupRepository groupRepository;

    public GroupSecurityEvaluator(UserGroupAssignmentRepository assignmentRepository,
                                  WhatsAppGroupRepository groupRepository) {
        this.assignmentRepository = assignmentRepository;
        this.groupRepository = groupRepository;
    }

    /**
     * Verifies if an authenticated principal has permission to view a specific group's
     * messages, summaries, insights, and media assets.
     */
    public boolean canReadGroup(Authentication authentication, UUID groupId) {
        if (authentication == null || !authentication.isAuthenticated() || groupId == null) {
            return false;
        }

        // Automated system workers / background M2M integrations
        if (hasAuthority(authentication, "M2M_INTEGRATION")) {
            return true;
        }

        if (authentication.getPrincipal() instanceof UserPrincipal principal) {
            // Must possess at least one content/summary reading authority
            boolean hasReadAuthority = hasAuthority(authentication, "WHATSAPP_CONTENT_READ")
                    || hasAuthority(authentication, "SUMMARY_READ")
                    || hasAuthority(authentication, "EXECUTIVE_BI_READ");

            if (!hasReadAuthority) {
                return false;
            }

            // Both Employees, Managers, and C-Suite require explicit group access
            // C_SUITE: Access is strictly scoped to authorized departments/groups (never blanket)
            return assignmentRepository.hasViewAccess(principal.getId(), groupId);
        }

        return false;
    }

    /**
     * Verifies if an authenticated principal can read a group identified by its string Meta Group ID.
     */
    public boolean canReadMetaGroup(Authentication authentication, String metaGroupId) {
        if (metaGroupId == null || metaGroupId.isBlank()) {
            return false;
        }
        Optional<WhatsAppGroup> group = groupRepository.findByMetaGroupId(metaGroupId);
        return group.isPresent() && canReadGroup(authentication, group.get().getId());
    }

    /**
     * Outbound messaging strictly requires WHATSAPP_MESSAGE_SEND permission AND explicit canSend assignment.
     */
    public boolean canSendToGroup(Authentication authentication, UUID groupId) {
        if (authentication == null || !authentication.isAuthenticated() || groupId == null) {
            return false;
        }

        // M2M background services
        if (hasAuthority(authentication, "M2M_INTEGRATION")) {
            return true;
        }

        if (!hasAuthority(authentication, "WHATSAPP_MESSAGE_SEND")) {
            return false;
        }

        if (authentication.getPrincipal() instanceof UserPrincipal principal) {
            return assignmentRepository.hasSendAccess(principal.getId(), groupId);
        }

        return false;
    }

    /**
     * Resolves the list of Meta Group IDs that the authenticated principal is explicitly permitted to read.
     * Used for database-level query filtering.
     */
    public List<String> getPermittedMetaGroupIds(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return Collections.emptyList();
        }

        if (hasAuthority(authentication, "M2M_INTEGRATION")) {
            return groupRepository.findAllByMetaGroupIdIsNotNull().stream()
                    .map(WhatsAppGroup::getMetaGroupId)
                    .filter(Objects::nonNull)
                    .toList();
        }

        if (authentication.getPrincipal() instanceof UserPrincipal principal) {
            List<UUID> accessibleGroupIds = assignmentRepository.findAccessibleGroupIdsByUserId(principal.getId());
            if (accessibleGroupIds.isEmpty()) {
                return Collections.emptyList();
            }

            return groupRepository.findAllById(accessibleGroupIds).stream()
                    .map(WhatsAppGroup::getMetaGroupId)
                    .filter(id -> id != null && !id.isBlank())
                    .toList();
        }

        return Collections.emptyList();
    }

    private boolean hasAuthority(Authentication authentication, String authority) {
        return authentication.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals(authority));
    }
}
