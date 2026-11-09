-- V8__role_based_access_control.sql
-- Enterprise Role-Based Access Control (RBAC), Session Security,
-- Priority Inbox, Separated Action Items & Approvals, and Audit Logging

-- 1. Departments
CREATE TABLE IF NOT EXISTS departments (
    id UUID PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(120) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 2. Users
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY,
    department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    email VARCHAR(180) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(160) NOT NULL,
    job_title VARCHAR(100),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
    token_invalid_before TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deactivated_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_users_department ON users(department_id);
CREATE INDEX IF NOT EXISTS idx_users_email_active ON users(email, is_active);

-- 3. Roles and Permissions
CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    description VARCHAR(255) NOT NULL,
    is_system_role BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS permissions (
    id UUID PRIMARY KEY,
    code VARCHAR(80) NOT NULL UNIQUE,
    category VARCHAR(40) NOT NULL,
    description VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_roles (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, role_id)
);

CREATE TABLE IF NOT EXISTS role_permissions (
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

-- 4. User Group Assignments (Resource-level access boundary)
CREATE TABLE IF NOT EXISTS user_group_assignments (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    whatsapp_group_id UUID NOT NULL REFERENCES whatsapp_groups(id) ON DELETE CASCADE,
    can_view BOOLEAN NOT NULL DEFAULT TRUE,
    can_send BOOLEAN NOT NULL DEFAULT FALSE,
    assigned_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_user_group UNIQUE (user_id, whatsapp_group_id)
);
CREATE INDEX IF NOT EXISTS idx_uga_user_view ON user_group_assignments(user_id, can_view);
CREATE INDEX IF NOT EXISTS idx_uga_group ON user_group_assignments(whatsapp_group_id);

-- 5. Refresh Tokens (Single-use with family theft detection)
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    family_id UUID NOT NULL,
    sequence_number INTEGER NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    revoked_at TIMESTAMP WITH TIME ZONE,
    replaced_by_hash VARCHAR(64),
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_refresh_token_lookup ON refresh_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_refresh_token_family ON refresh_tokens(family_id);

-- 6. Action Items (Separated Task Status from Approval Status)
CREATE TABLE IF NOT EXISTS action_items (
    id UUID PRIMARY KEY,
    whatsapp_group_id UUID NOT NULL REFERENCES whatsapp_groups(id) ON DELETE RESTRICT,
    whatsapp_message_id UUID REFERENCES whatsapp_messages(id) ON DELETE SET NULL,
    twochat_message_id VARCHAR(255) REFERENCES twochat_messages(id) ON DELETE SET NULL,
    assigned_to_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_by_user_id UUID NOT NULL REFERENCES users(id),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    priority VARCHAR(20) NOT NULL DEFAULT 'MEDIUM' CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    due_date TIMESTAMP WITH TIME ZONE,
    task_status VARCHAR(32) NOT NULL DEFAULT 'PENDING' CHECK (task_status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
    approval_status VARCHAR(32) NOT NULL DEFAULT 'NOT_REQUIRED' CHECK (approval_status IN ('NOT_REQUIRED', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_action_item_source CHECK (whatsapp_message_id IS NOT NULL OR twochat_message_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_action_items_assigned ON action_items(assigned_to_user_id, task_status);
CREATE INDEX IF NOT EXISTS idx_action_items_group ON action_items(whatsapp_group_id, approval_status);

-- 7. Approval Requests
CREATE TABLE IF NOT EXISTS approval_requests (
    id UUID PRIMARY KEY,
    action_item_id UUID NOT NULL REFERENCES action_items(id) ON DELETE CASCADE,
    requested_by_user_id UUID NOT NULL REFERENCES users(id),
    reviewed_by_user_id UUID REFERENCES users(id),
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    review_notes TEXT,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_approval_requests_pending ON approval_requests(status, created_at);

-- 8. Priority Inbox Items
CREATE TABLE IF NOT EXISTS priority_inbox_items (
    id UUID PRIMARY KEY,
    whatsapp_group_id UUID NOT NULL REFERENCES whatsapp_groups(id) ON DELETE RESTRICT,
    whatsapp_message_id UUID REFERENCES whatsapp_messages(id) ON DELETE SET NULL,
    twochat_message_id VARCHAR(255) REFERENCES twochat_messages(id) ON DELETE SET NULL,
    priority_category VARCHAR(32) NOT NULL CHECK (priority_category IN ('CRITICAL', 'FINANCIAL', 'DEADLINE', 'OPERATIONAL')),
    urgency_score NUMERIC(3,2) NOT NULL,
    summary_excerpt TEXT NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'NEW' CHECK (status IN ('NEW', 'VIEWED', 'ACKNOWLEDGED', 'RESOLVED', 'ESCALATED')),
    assigned_to_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_priority_item_source CHECK (whatsapp_message_id IS NOT NULL OR twochat_message_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_priority_inbox_status ON priority_inbox_items(status, urgency_score DESC);
CREATE INDEX IF NOT EXISTS idx_priority_inbox_group ON priority_inbox_items(whatsapp_group_id);

-- 9. Notifications and Preferences
CREATE TABLE IF NOT EXISTS user_notifications (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    notification_type VARCHAR(40) NOT NULL,
    reference_id UUID,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_user_notifications_read ON user_notifications(user_id, is_read, created_at DESC);

CREATE TABLE IF NOT EXISTS notification_preferences (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    notify_priority_inbox BOOLEAN NOT NULL DEFAULT TRUE,
    notify_approvals BOOLEAN NOT NULL DEFAULT TRUE,
    notify_task_assigned BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 10. Redacted Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(80) NOT NULL,
    resource_type VARCHAR(64) NOT NULL,
    resource_id VARCHAR(128),
    ip_address VARCHAR(45),
    correlation_id VARCHAR(64) NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('SUCCESS', 'DENIED', 'FAILED')),
    redacted_metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_action ON audit_logs(user_id, action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_correlation ON audit_logs(correlation_id);

-- =========================================================================
-- SEED DATA: Roles, Permissions, Initial Mapping, and Default Department
-- Using strictly valid hexadecimal characters (0-9, a-f) for UUIDs
-- =========================================================================

-- Seed Default Department
INSERT INTO departments (id, code, name, description)
VALUES 
    ('d1000000-0000-0000-0000-000000000001', 'OPERATIONS', 'Fleet & General Operations', 'Core operational workflows and fleet coordination'),
    ('d2000000-0000-0000-0000-000000000002', 'ENGINEERING', 'Engineering & Technology', 'Platform technical maintenance and systems'),
    ('d3000000-0000-0000-0000-000000000003', 'EXECUTIVE', 'Executive Management', 'Strategic leadership and company governance')
ON CONFLICT (code) DO NOTHING;

-- Seed Roles
INSERT INTO roles (id, name, description)
VALUES 
    ('a1000000-0000-0000-0000-000000000001', 'ROLE_EMPLOYEE', 'Standard staff member with read-only access to assigned groups'),
    ('a2000000-0000-0000-0000-000000000002', 'ROLE_MANAGER', 'Department manager with summarization, task assignment, and approval privileges'),
    ('a3000000-0000-0000-0000-000000000003', 'ROLE_C_SUITE', 'Executive leader with cross-department business intelligence and strategic sign-offs'),
    ('a4000000-0000-0000-0000-000000000004', 'ROLE_DEVELOPER', 'Technical engineer with system health, logs, database, and telemetry monitoring'),
    ('a5000000-0000-0000-0000-000000000005', 'ROLE_ADMIN', 'Platform administrator managing users, roles, departments, and access scoping')
ON CONFLICT (name) DO NOTHING;

-- Seed Permissions
INSERT INTO permissions (id, code, category, description)
VALUES 
    -- System & Telemetry
    ('b0100000-0000-0000-0000-000000000001', 'TELEMETRY_READ', 'SYSTEM', 'View JVM, HikariCP, Actuator metrics and system health'),
    ('b0200000-0000-0000-0000-000000000002', 'SYSTEM_CONFIG_READ', 'SYSTEM', 'View non-sensitive platform configurations'),
    ('b0300000-0000-0000-0000-000000000003', 'SYSTEM_CONFIG_MANAGE', 'SYSTEM', 'Update runtime thresholds and integrations'),
    ('b0400000-0000-0000-0000-000000000004', 'LOGS_READ', 'SYSTEM', 'View redacted application and worker logs'),
    ('b0500000-0000-0000-0000-000000000005', 'AUDIT_READ', 'SYSTEM', 'Inspect security and access audit trails'),
    
    -- User & Access Control
    ('b0600000-0000-0000-0000-000000000006', 'USER_READ', 'ADMIN', 'List user profiles and department members'),
    ('b0700000-0000-0000-0000-000000000007', 'USER_MANAGE', 'ADMIN', 'Create, deactivate, and modify user accounts'),
    ('b0800000-0000-0000-0000-000000000008', 'ROLE_ASSIGN', 'ADMIN', 'Assign or revoke roles to users'),
    ('b0900000-0000-0000-0000-000000000009', 'GROUP_ASSIGNMENT_MANAGE', 'ADMIN', 'Map users to WhatsApp groups and assign messaging rights'),
    ('b1000000-0000-0000-0000-000000000010', 'DEPARTMENT_MANAGE', 'ADMIN', 'Create and structure organizational departments'),

    -- Business Content & Messaging
    ('b1100000-0000-0000-0000-000000000011', 'WHATSAPP_CONTENT_READ', 'BUSINESS', 'Read original WhatsApp messages and conversation feeds in assigned groups'),
    ('b1200000-0000-0000-0000-000000000012', 'WHATSAPP_MESSAGE_SEND', 'BUSINESS', 'Send outbound WhatsApp messages to permitted groups'),
    ('b1300000-0000-0000-0000-000000000013', 'SUMMARY_READ', 'BUSINESS', 'View AI-generated summaries and structured insights'),
    ('b1400000-0000-0000-0000-000000000014', 'SUMMARY_GENERATE', 'BUSINESS', 'Trigger on-demand Groq summarization workflows for authorized groups'),
    ('b1500000-0000-0000-0000-000000000015', 'EXECUTIVE_BI_READ', 'BUSINESS', 'Access cross-department aggregated business intelligence'),

    -- Tasks & Approvals
    ('b1600000-0000-0000-0000-000000000016', 'PRIORITY_INBOX_READ', 'TASKS', 'View urgent, financial, and operational alerts'),
    ('b1700000-0000-0000-0000-000000000017', 'PRIORITY_INBOX_TRIAGE', 'TASKS', 'Transition priority item lifecycle (Acknowledge, Resolve, Escalate)'),
    ('b1800000-0000-0000-0000-000000000018', 'ACTION_ITEM_CREATE', 'TASKS', 'Create actionable tasks linked to messages'),
    ('b1900000-0000-0000-0000-000000000019', 'ACTION_ITEM_ASSIGN', 'TASKS', 'Assign action items to departmental employees'),
    ('b2000000-0000-0000-0000-000000000020', 'ACTION_ITEM_UPDATE', 'TASKS', 'Update execution status of assigned tasks'),
    ('b2100000-0000-0000-0000-000000000021', 'ACTION_ITEM_APPROVE', 'TASKS', 'Review, approve, or reject tasks requiring manager sign-off'),
    ('b2200000-0000-0000-0000-000000000022', 'EXECUTIVE_APPROVE', 'TASKS', 'Review and sign off on high-impact strategic actions')
ON CONFLICT (code) DO NOTHING;

-- Map Role -> Permissions according to strict five-role matrix

-- ROLE_EMPLOYEE (b11, b13, b16, b20)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'ROLE_EMPLOYEE' AND p.code IN (
    'WHATSAPP_CONTENT_READ', 'SUMMARY_READ', 'PRIORITY_INBOX_READ', 'ACTION_ITEM_UPDATE'
) ON CONFLICT DO NOTHING;

-- ROLE_MANAGER (b11, b13, b14, b16, b17, b18, b19, b20, b21)
-- Note: WHATSAPP_MESSAGE_SEND is strictly granted via user_group_assignments.can_send
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'ROLE_MANAGER' AND p.code IN (
    'WHATSAPP_CONTENT_READ', 'SUMMARY_READ', 'SUMMARY_GENERATE', 
    'PRIORITY_INBOX_READ', 'PRIORITY_INBOX_TRIAGE', 
    'ACTION_ITEM_CREATE', 'ACTION_ITEM_ASSIGN', 'ACTION_ITEM_UPDATE', 'ACTION_ITEM_APPROVE'
) ON CONFLICT DO NOTHING;

-- ROLE_C_SUITE (b13, b15, b16, b17, b22)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'ROLE_C_SUITE' AND p.code IN (
    'EXECUTIVE_BI_READ', 'SUMMARY_READ', 'PRIORITY_INBOX_READ', 'PRIORITY_INBOX_TRIAGE', 'EXECUTIVE_APPROVE'
) ON CONFLICT DO NOTHING;

-- ROLE_DEVELOPER (b01, b02, b03, b04, b05)
-- NO automatic business content or sending privileges
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'ROLE_DEVELOPER' AND p.code IN (
    'TELEMETRY_READ', 'SYSTEM_CONFIG_READ', 'SYSTEM_CONFIG_MANAGE', 'LOGS_READ', 'AUDIT_READ'
) ON CONFLICT DO NOTHING;

-- ROLE_ADMIN (b01, b05, b06, b07, b08, b09, b10)
-- NO automatic business content or sending privileges
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'ROLE_ADMIN' AND p.code IN (
    'TELEMETRY_READ', 'AUDIT_READ', 'USER_READ', 'USER_MANAGE', 'ROLE_ASSIGN', 'GROUP_ASSIGNMENT_MANAGE', 'DEPARTMENT_MANAGE'
) ON CONFLICT DO NOTHING;
