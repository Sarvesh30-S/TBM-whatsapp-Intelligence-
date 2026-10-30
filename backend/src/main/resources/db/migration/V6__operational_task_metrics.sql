ALTER TABLE important_message_insights ADD COLUMN task_status VARCHAR(24);
ALTER TABLE important_message_insights ADD COLUMN resolved_at TIMESTAMP WITH TIME ZONE;

UPDATE important_message_insights SET task_status = 'OPEN' WHERE category = 'TASK' AND task_status IS NULL;

ALTER TABLE important_message_insights ADD CONSTRAINT ck_insight_task_status
    CHECK (task_status IS NULL OR task_status IN ('OPEN', 'IN_PROGRESS', 'DONE'));
ALTER TABLE important_message_insights ADD CONSTRAINT ck_insight_task_resolution
    CHECK ((task_status = 'DONE' AND resolved_at IS NOT NULL)
        OR (task_status IS DISTINCT FROM 'DONE' AND resolved_at IS NULL));

CREATE INDEX idx_important_insights_task_status_due
    ON important_message_insights (task_status, due_at);
