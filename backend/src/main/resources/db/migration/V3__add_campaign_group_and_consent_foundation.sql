CREATE TABLE brands (
    id UUID PRIMARY KEY,
    slug VARCHAR(120) NOT NULL UNIQUE,
    name VARCHAR(160) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE TABLE campaigns (
    id UUID PRIMARY KEY,
    brand_id UUID NOT NULL REFERENCES brands(id),
    slug VARCHAR(120) NOT NULL,
    name VARCHAR(160) NOT NULL,
    status VARCHAR(24) NOT NULL DEFAULT 'DRAFT',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT uq_campaign_brand_slug UNIQUE (brand_id, slug),
    CONSTRAINT ck_campaign_status CHECK (status IN ('DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED'))
);

CREATE INDEX idx_campaigns_brand_status ON campaigns (brand_id, status);

CREATE TABLE whatsapp_groups (
    id UUID PRIMARY KEY,
    campaign_id UUID NOT NULL REFERENCES campaigns(id),
    meta_group_id VARCHAR(128) UNIQUE,
    subject VARCHAR(255) NOT NULL,
    invite_link TEXT,
    join_approval_mode VARCHAR(24) NOT NULL DEFAULT 'approval_required',
    status VARCHAR(24) NOT NULL DEFAULT 'PENDING_CONSENT',
    consent_sent_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT ck_group_approval_mode CHECK (join_approval_mode IN ('approval_required', 'auto_approve')),
    CONSTRAINT ck_group_status CHECK (status IN ('PENDING_CONSENT', 'INVITE_PENDING', 'ACTIVE', 'PAUSED', 'ARCHIVED')),
    CONSTRAINT ck_group_requires_consent CHECK (status <> 'ACTIVE' OR consent_sent_at IS NOT NULL)
);

CREATE INDEX idx_whatsapp_groups_campaign_status ON whatsapp_groups (campaign_id, status);

CREATE TABLE people (
    id UUID PRIMARY KEY,
    wa_id VARCHAR(64) NOT NULL UNIQUE,
    display_name VARCHAR(160),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE TABLE whatsapp_group_participants (
    id UUID PRIMARY KEY,
    whatsapp_group_id UUID NOT NULL REFERENCES whatsapp_groups(id),
    person_id UUID NOT NULL REFERENCES people(id),
    is_external BOOLEAN NOT NULL,
    status VARCHAR(24) NOT NULL,
    joined_at TIMESTAMP WITH TIME ZONE,
    left_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT uq_group_person UNIQUE (whatsapp_group_id, person_id),
    CONSTRAINT ck_participant_status CHECK (status IN ('INVITED', 'ACTIVE', 'LEFT', 'REMOVED', 'REJECTED'))
);

CREATE INDEX idx_group_participants_person_status ON whatsapp_group_participants (person_id, status);

ALTER TABLE whatsapp_messages ADD COLUMN group_id VARCHAR(128);
CREATE INDEX idx_whatsapp_messages_group_id ON whatsapp_messages (group_id);
