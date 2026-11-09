package com.tbm.whatsapp.security;

import com.tbm.whatsapp.entity.Department;
import com.tbm.whatsapp.entity.Role;
import com.tbm.whatsapp.entity.User;
import com.tbm.whatsapp.repository.DepartmentRepository;
import com.tbm.whatsapp.repository.RoleRepository;
import com.tbm.whatsapp.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.security.SecureRandom;
import java.util.Base64;
import java.util.Set;
import java.util.UUID;

@Service
public class AdminBootstrapService {
    private static final Logger log = LoggerFactory.getLogger(AdminBootstrapService.class);
    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final DepartmentRepository departmentRepository;
    private final PasswordEncoder passwordEncoder;
    private final String bootstrapToken;

    public AdminBootstrapService(
            UserRepository userRepository,
            RoleRepository roleRepository,
            DepartmentRepository departmentRepository,
            PasswordEncoder passwordEncoder,
            @Value("${app.admin.bootstrap-token:}") String bootstrapToken) {
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.departmentRepository = departmentRepository;
        this.passwordEncoder = passwordEncoder;
        this.bootstrapToken = bootstrapToken;
    }

    @EventListener(ApplicationReadyEvent.class)
    @Transactional
    public void onApplicationReady() {
        long activeAdmins = userRepository.countActiveAdmins();
        if (activeAdmins > 0) {
            log.info("System has {} active administrator account(s). Bootstrap skipped.", activeAdmins);
            return;
        }

        if (!StringUtils.hasText(bootstrapToken)) {
            log.warn("===============================================================================");
            log.warn("WARNING: Zero active admin accounts exist, and APP_ADMIN_BOOTSTRAP_TOKEN is not set.");
            log.warn("Set APP_ADMIN_BOOTSTRAP_TOKEN to bootstrap the initial enterprise administrator.");
            log.warn("===============================================================================");
            return;
        }

        Role adminRole = roleRepository.findByName("ROLE_ADMIN")
                .orElseThrow(() -> new IllegalStateException("ROLE_ADMIN not found in database"));
        Department execDept = departmentRepository.findByCode("EXECUTIVE")
                .orElse(null);

        // Generate cryptographically secure 24-character random password
        byte[] randomBytes = new byte[18];
        new SecureRandom().nextBytes(randomBytes);
        String generatedPassword = Base64.getUrlEncoder().withoutPadding().encodeToString(randomBytes);

        String adminEmail = "admin@tbm.internal";
        User adminUser = new User(
                UUID.randomUUID(),
                adminEmail,
                passwordEncoder.encode(generatedPassword),
                "System Administrator",
                execDept
        );
        adminUser.setMustChangePassword(true);
        adminUser.setRoles(Set.of(adminRole));
        userRepository.save(adminUser);

        log.info("===============================================================================");
        log.info("SUCCESS: Initial enterprise administrator bootstrapped successfully!");
        log.info("Email:    {}", adminEmail);
        log.info("One-Time Password: {}", generatedPassword);
        log.info("NOTE: Password change is required upon first login.");
        log.info("===============================================================================");
    }
}
