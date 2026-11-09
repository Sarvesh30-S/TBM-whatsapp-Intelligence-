package com.tbm.whatsapp.repository;

import com.tbm.whatsapp.entity.UserNotification;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface UserNotificationRepository extends JpaRepository<UserNotification, UUID> {
    List<UserNotification> findByUserIdOrderByCreatedAtDesc(UUID userId);
    List<UserNotification> findByUserIdAndReadFalseOrderByCreatedAtDesc(UUID userId);
    long countByUserIdAndReadFalse(UUID userId);
}
