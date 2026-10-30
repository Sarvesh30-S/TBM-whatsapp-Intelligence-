ALTER TABLE whatsapp_groups
    ADD COLUMN planned_external_seats INTEGER NOT NULL DEFAULT 0;

ALTER TABLE whatsapp_groups
    ADD CONSTRAINT ck_group_planned_external_seats CHECK (planned_external_seats BETWEEN 0 AND 7);
