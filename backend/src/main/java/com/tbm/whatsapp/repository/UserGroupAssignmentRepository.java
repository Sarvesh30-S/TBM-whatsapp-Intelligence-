package com.tbm.whatsapp.repository;

import com.tbm.whatsapp.entity.UserGroupAssignment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface UserGroupAssignmentRepository extends JpaRepository<UserGroupAssignment, UUID> {
    Optional<UserGroupAssignment> findByUserIdAndWhatsappGroupId(UUID userId, UUID whatsappGroupId);

    @Query("SELECT uga FROM UserGroupAssignment uga WHERE uga.user.id = :userId AND uga.canView = true")
    List<UserGroupAssignment> findAccessibleByUserId(@Param("userId") UUID userId);

    @Query("SELECT uga.whatsappGroup.id FROM UserGroupAssignment uga WHERE uga.user.id = :userId AND uga.canView = true")
    List<UUID> findAccessibleGroupIdsByUserId(@Param("userId") UUID userId);

    @Query("SELECT COUNT(uga) > 0 FROM UserGroupAssignment uga WHERE uga.user.id = :userId AND uga.whatsappGroup.id = :groupId AND uga.canView = true")
    boolean hasViewAccess(@Param("userId") UUID userId, @Param("groupId") UUID groupId);

    @Query("SELECT COUNT(uga) > 0 FROM UserGroupAssignment uga WHERE uga.user.id = :userId AND uga.whatsappGroup.id = :groupId AND uga.canSend = true")
    boolean hasSendAccess(@Param("userId") UUID userId, @Param("groupId") UUID groupId);
}
