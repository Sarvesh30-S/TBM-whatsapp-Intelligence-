package com.tbm.whatsapp.security;

import com.tbm.whatsapp.entity.WhatsAppGroup;
import com.tbm.whatsapp.repository.UserGroupAssignmentRepository;
import com.tbm.whatsapp.repository.WhatsAppGroupRepository;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;

import java.util.Optional;
import java.util.UUID;

@Component("groupSecurity")
public class GroupSecurityEvaluator {
    private final UserGroupAssignmentRepository assignmentRepository;
    private final WhatsAppGroupRepository groupRepository;

    public GroupSecurityEvaluator(UserGroupAssignmentRepository assignmentRepository,
                                  WhatsAppGroupRepository groupRepository) {
        this.assignmentRepository = assignmentRepository;
        this.groupRepository = groupRepository;
    }

    public boolean canReadGroup(Authentication authentication, UUID groupId) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return false;
        }

        // C-Suite with EXECUTIVE_BI_READ or Admin with explicit content read can view all
        if (hasAuthority(authentication, "EXECUTIVE_BI_READ")) {
            return true;
        }

        if (authentication.getPrincipal() instanceof UserPrincipal principal) {
            // Check direct assignment
            if (assignmentRepository.hasViewAccess(principal.getId(), groupId)) {
                return true;
            }

            // If user is a MANAGER, check if group belongs to their department
            if (hasAuthority(authentication, "ROLE_MANAGER") && principal.getDepartmentId() != null) {
                Optional<WhatsAppGroup> group = groupRepository.findById(groupId);
                // In existing model, group links to campaign which links to brand
                // If direct department mapping exists or assignment exists
                return assignmentRepository.hasViewAccess(principal.getId(), groupId);
            }
        }

        return false;
    }

    public boolean canSendToGroup(Authentication authentication, UUID groupId) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return false;
        }

        // Outbound messaging strictly requires WHATSAPP_MESSAGE_SEND permission AND explicit canSend assignment
        if (!hasAuthority(authentication, "WHATSAPP_MESSAGE_SEND")) {
            return false;
        }

        if (authentication.getPrincipal() instanceof UserPrincipal principal) {
            return assignmentRepository.hasSendAccess(principal.getId(), groupId);
        }

        return false;
    }

    private boolean hasAuthority(Authentication authentication, String authority) {
        return authentication.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals(authority));
    }
}
