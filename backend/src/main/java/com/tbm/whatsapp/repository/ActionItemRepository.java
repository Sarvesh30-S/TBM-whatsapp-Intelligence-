package com.tbm.whatsapp.repository;

import com.tbm.whatsapp.entity.ActionItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface ActionItemRepository extends JpaRepository<ActionItem, UUID> {
    List<ActionItem> findByAssignedToUserId(UUID assignedToUserId);
    List<ActionItem> findByWhatsappGroupId(UUID whatsappGroupId);

    @Query("SELECT a FROM ActionItem a WHERE a.whatsappGroup.id IN :groupIds ORDER BY a.createdAt DESC")
    List<ActionItem> findByGroupIds(@Param("groupIds") List<UUID> groupIds);

    @Query("SELECT a FROM ActionItem a WHERE a.approvalStatus = 'PENDING_APPROVAL' AND a.whatsappGroup.id IN :groupIds ORDER BY a.createdAt DESC")
    List<ActionItem> findPendingApprovalByGroupIds(@Param("groupIds") List<UUID> groupIds);
}
