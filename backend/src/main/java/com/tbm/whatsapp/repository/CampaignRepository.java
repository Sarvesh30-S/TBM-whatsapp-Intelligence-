package com.tbm.whatsapp.repository;

import com.tbm.whatsapp.entity.Campaign;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface CampaignRepository extends JpaRepository<Campaign, UUID> {
    List<Campaign> findAllByBrandIdOrderByCreatedAtDesc(UUID brandId);
    List<Campaign> findAllByOrderByCreatedAtDesc();
    boolean existsByBrandIdAndSlug(UUID brandId, String slug);
}
