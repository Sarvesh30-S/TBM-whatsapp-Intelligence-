package com.tbm.whatsapp.repository;

import com.tbm.whatsapp.entity.PriorityInboxItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface PriorityInboxItemRepository extends JpaRepository<PriorityInboxItem, UUID> {
    List<PriorityInboxItem> findByStatus(String status);

    @Query("SELECT p FROM PriorityInboxItem p WHERE p.whatsappGroup.id IN :groupIds ORDER BY p.urgencyScore DESC, p.createdAt DESC")
    List<PriorityInboxItem> findByGroupIds(@Param("groupIds") List<UUID> groupIds);

    @Query("SELECT p FROM PriorityInboxItem p WHERE p.whatsappGroup.id IN :groupIds AND p.status = :status ORDER BY p.urgencyScore DESC")
    List<PriorityInboxItem> findByGroupIdsAndStatus(@Param("groupIds") List<UUID> groupIds, @Param("status") String status);

    @Query("SELECT COUNT(p) FROM PriorityInboxItem p WHERE p.whatsappGroup.id IN :groupIds AND p.status IN ('NEW', 'VIEWED')")
    long countUnresolvedByGroupIds(@Param("groupIds") List<UUID> groupIds);
}
