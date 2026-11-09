package com.tbm.whatsapp.security;

import com.tbm.whatsapp.entity.Department;
import com.tbm.whatsapp.entity.Role;
import com.tbm.whatsapp.entity.User;
import com.tbm.whatsapp.repository.AuditLogRepository;
import com.tbm.whatsapp.repository.DepartmentRepository;
import com.tbm.whatsapp.repository.RoleRepository;
import com.tbm.whatsapp.repository.UserRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.Query;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.locks.ReentrantLock;

/**
 * Hardened Admin Bootstrap Service.
 * Ensures the initial system administrator can only ever be bootstrapped once.
 * Enforces database-level advisory locking, JVM locking, permanent audit ledger sealing,
 * and fail-closed security.
 */
@Service
public class AdminBootstrapService {
    private static final Logger log = LoggerFactory.getLogger(AdminBootstrapService.class);
    private static final long BOOTSTRAP_ADVISORY_LOCK_KEY = 884719203L;
    private static final ReentrantLock JVM_BOOTSTRAP_LOCK = new ReentrantLock();

    public static final String BOOTSTRAP_COMPLETED_ACTION = "SYSTEM_BOOTSTRAP_COMPLETED";

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final DepartmentRepository departmentRepository;
    private final AuditLogRepository auditLogRepository;
    private final AuditLoggingService auditLoggingService;
    private final PasswordEncoder passwordEncoder;
    private final EntityManager entityManager;
    private final String bootstrapToken;

    public AdminBootstrapService(
            UserRepository userRepository,
            RoleRepository roleRepository,
            DepartmentRepository departmentRepository,
            AuditLogRepository auditLogRepository,
            AuditLoggingService auditLoggingService,
            PasswordEncoder passwordEncoder,
            EntityManager entityManager,
            @Value("${app.admin.bootstrap-token:}") String bootstrapToken) {
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.departmentRepository = departmentRepository;
        this.auditLogRepository = auditLogRepository;
        this.auditLoggingService = auditLoggingService;
        this.passwordEncoder = passwordEncoder;
        this.entityManager = entityManager;
        this.bootstrapToken = bootstrapToken;
    }

    /**
     * Checks if initial administrator setup is permanently completed.
     * Evaluates both immutable audit ledger and existing administrator accounts.
     */
    @Transactional(readOnly = true)
    public boolean isBootstrapPermanentlyCompleted() {
        boolean auditCompleted = auditLogRepository.existsByActionAndStatus(BOOTSTRAP_COMPLETED_ACTION, "SUCCESS");
        boolean adminEverCreated = userRepository.countTotalAdminsEverCreated() > 0;
        return auditCompleted || adminEverCreated;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void onApplicationReady() {
        if (isBootstrapPermanentlyCompleted()) {
            log.info("Initial system bootstrap status: PERMANENTLY SEALED. Endpoint is disabled.");
        } else if (StringUtils.hasText(bootstrapToken)) {
            log.info("Initial system bootstrap status: PENDING. Endpoint active via POST /api/v1/auth/bootstrap.");
        } else {
            log.warn("Initial system bootstrap status: UNCONFIGURED. Set APP_ADMIN_BOOTSTRAP_TOKEN in environment.");
        }
    }

    /**
     * Atomically bootstraps the initial system administrator.
     * Cannot be re-run once executed.
     */
    @Transactional(isolation = Isolation.SERIALIZABLE)
    public User bootstrapInitialAdmin(String suppliedToken, String email, String password, String fullName, String ipAddress) {
        // 1. Fail closed if bootstrap token is missing in server environment
        if (!StringUtils.hasText(bootstrapToken)) {
            log.error("Bootstrap attempt rejected: APP_ADMIN_BOOTSTRAP_TOKEN is not configured on server.");
            throw new IllegalStateException("Admin bootstrap is not configured on this server");
        }

        // 2. Constant-time token verification (never logs token)
        if (suppliedToken == null || !MessageDigest.isEqual(
                bootstrapToken.getBytes(StandardCharsets.UTF_8),
                suppliedToken.trim().getBytes(StandardCharsets.UTF_8))) {
            log.warn("Bootstrap attempt rejected: Invalid or missing token from IP: {}", ipAddress);
            auditLoggingService.record(null, "ADMIN_BOOTSTRAP_UNAUTHORIZED", "SYSTEM", "BOOTSTRAP",
                    ipAddress, "DENIED", Map.of("reason", "INVALID_BOOTSTRAP_TOKEN"));
            throw new SecurityException("Invalid or missing bootstrap token");
        }

        // 3. Concurrency Protection: JVM level
        if (!JVM_BOOTSTRAP_LOCK.tryLock()) {
            log.warn("Concurrent JVM bootstrap attempt detected from IP: {}", ipAddress);
            throw new IllegalStateException("Bootstrap request already in progress");
        }

        try {
            // 4. Concurrency Protection: PostgreSQL database transaction advisory lock
            try {
                Query lockQuery = entityManager.createNativeQuery("SELECT pg_try_advisory_xact_lock(:lockKey)");
                lockQuery.setParameter("lockKey", BOOTSTRAP_ADVISORY_LOCK_KEY);
                Object lockAcquired = lockQuery.getSingleResult();
                if (Boolean.FALSE.equals(lockAcquired)) {
                    log.warn("Concurrent DB advisory lock conflict during bootstrap from IP: {}", ipAddress);
                    throw new IllegalStateException("Concurrent bootstrap request in progress across instances");
                }
            } catch (IllegalStateException e) {
                throw e;
            } catch (Exception ex) {
                // Ignore for non-Postgres environments (e.g. in-memory H2 tests)
                log.debug("Advisory lock check skipped or not supported by DB engine: {}", ex.getMessage());
            }

            // 5. Check permanent setup-completed state
            if (isBootstrapPermanentlyCompleted()) {
                log.warn("Bootstrap attempt rejected: Setup already permanently sealed. IP: {}", ipAddress);
                auditLoggingService.record(null, "ADMIN_BOOTSTRAP_REJECTED_ALREADY_SEALED", "SYSTEM", "BOOTSTRAP",
                        ipAddress, "DENIED", Map.of("reason", "PERMANENTLY_COMPLETED"));
                throw new IllegalStateException("Administrator account already exists. Bootstrap endpoint is permanently disabled.");
            }

            // 6. Validate uniqueness
            String cleanEmail = email.trim().toLowerCase();
            if (userRepository.existsByEmailIgnoreCase(cleanEmail)) {
                throw new IllegalArgumentException("User with email already exists: " + cleanEmail);
            }

            Role adminRole = roleRepository.findByName("ROLE_ADMIN")
                    .orElseThrow(() -> new IllegalStateException("ROLE_ADMIN role definition not found in database"));
            Department execDept = departmentRepository.findByCode("EXECUTIVE")
                    .orElse(null);

            // 7. Persist Initial Administrator
            User adminUser = new User(
                    UUID.randomUUID(),
                    cleanEmail,
                    passwordEncoder.encode(password),
                    fullName.trim(),
                    execDept
            );
            adminUser.setRoles(Set.of(adminRole));
            adminUser.setMustChangePassword(false);
            User savedAdmin = userRepository.saveAndFlush(adminUser);

            // 8. Seal the bootstrap permanently in immutable audit ledger
            auditLoggingService.record(savedAdmin.getId(), BOOTSTRAP_COMPLETED_ACTION, "SYSTEM",
                    savedAdmin.getId().toString(), ipAddress, "SUCCESS",
                    Map.of("email", savedAdmin.getEmail(), "role", "ROLE_ADMIN"));

            log.info("Initial system administrator successfully bootstrapped and sealed for: {}", savedAdmin.getEmail());
            return savedAdmin;
        } finally {
            JVM_BOOTSTRAP_LOCK.unlock();
        }
    }
}
