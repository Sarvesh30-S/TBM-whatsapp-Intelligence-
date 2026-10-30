# Operations metrics

The operations board is served by Spring Boot, so clients display values computed from persisted message, pod, and task records instead of calculating deadlines in the browser.

## Definitions

- **Overdue task:** an AI insight with category `TASK`, status `OPEN` or `IN_PROGRESS`, and a due time earlier than the backend's current time.
- **Task turnaround time (TAT):** seconds from the task insight's `created_at` to the first time it is marked `DONE`. The first completion time is retained in `resolved_at`; completed tasks are terminal until an audited reopen flow is designed.
- **Silent pod:** an `ACTIVE` pod with a linked Meta group ID whose most recent stored message is at least the configured silence threshold old. If the group has no stored messages yet, silence is measured from its consent timestamp, falling back to pod creation time.
- **Silence threshold:** `OPS_SILENCE_AFTER_HOURS`, default `24`, clamped to 1 hour through 30 days.

## API

- `GET /api/admin/brands/{brandId}/operations` returns task and silent-pod rows plus aggregate counts and average TAT.
- `PUT /api/admin/brands/{brandId}/operations/tasks/{taskId}` accepts `{"status":"OPEN"}`, `{"status":"IN_PROGRESS"}`, or `{"status":"DONE"}`. The backend query requires the task to belong to the requested brand; a task from another brand returns 404.

These routes currently use the shared local dashboard key. The brand filter is a data boundary, not a substitute for authenticated user roles; role-to-brand authorization remains an outstanding checklist item.
