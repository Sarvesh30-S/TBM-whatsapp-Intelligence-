# WhatsApp Intelligence master checklist

This is the acceptance checklist from the master brief. `[x]` means implemented and locally verified, `[~]` means implemented in part or awaiting external/provider evidence, and `[ ]` means not complete. A local build does not count as Meta production approval.

## Master checklist

- [ ] OBA application submitted day one. **Deferred by the user:** continue with Meta's test API until the sandbox build is validated.
- [~] Pod topology fits 7 external seats, internal team in no pod. The local pod planner enforces at most 7 planned external seats; internal-team membership is not implemented.
- [~] Five credentials in a git-ignored `.env`, token verified. All five Meta variables are present locally, but the current test token is expired and `/api/meta/test-connection` returns HTTP 502; refresh it in `.env` before repeating verification. Never copy secret values into this checklist.
- [x] Webhook answers `hub.challenge`, verifies signature, returns 200 under 200 ms. Challenge/signature integration coverage passes, raw payloads are durably queued before normalization, and 10 persistent-connection local requests returned 200 with a 5.6 ms maximum round trip.
- [~] All five webhook fields subscribed. Message delivery is confirmed; verify the complete five-field subscription in Meta before marking complete.
- [~] Invite link read from `group_lifecycle_update`. The normalizer extracts HTTPS `chat.whatsapp.com` invite URLs and stores them on the matching pod; a signed synthetic lifecycle event verifies this path, while a real Meta event is still needed to confirm Meta's delivered shape.
- [~] Consent message pinned and recorded, pod blocked until `consent_sent` is true. Pods default to `PENDING_CONSENT` and database rules block activation without a consent timestamp; sending, pinning, and recording the real consent message are not implemented.
- [ ] Invite template approved before first onboarding. Requires Meta approval.
- [~] Media downloaded asynchronously, stored, transcribed or OCR'd. Private storage, async worker, Meta media download, Sarvam transcription, and OpenAI extraction are implemented; provider keys and an actual media webhook are needed to verify end-to-end processing.
- [~] LLM output schema-validated, summary first then category split. Two separate strict-schema OpenAI stages now create the conversation summary and then category lines; valid source IDs are filtered against the supplied messages. Provider credentials and a real group conversation are needed for end-to-end evidence.
- [~] Confidence gate at 0.75, sub-threshold goes to review. The threshold and `NEEDS_REVIEW` path are implemented; verify with provider output.
- [x] `sourceMessageIds` stored as a list. Integration coverage verifies summary and insight source IDs are exposed as JSON arrays; dashboard source links open a campaign- and pod-validated detail drawer that shows cited message text and ready attachment text.
- [~] Schema deployed, routing chain intact. Flyway schema version 7 and webhook-to-message integration tests pass on local H2. PostgreSQL deployment could not be checked because Docker and the PostgreSQL client are not installed; production deployment and the complete routing chain remain unfinished.
- [~] Role scoping in SQL, detail routes re-check access. Admin routes and the message snapshot now require the server-side dashboard key, and task updates scope by owning brand in SQL; there is still no authenticated user identity or manager-to-brand role assignment, so this is not complete role security.
- [x] SSE hub scopes events by brand, heartbeat alive, dead connections evicted. Brand-scoped emitters, heartbeat delivery through the frontend proxy, and dead-emitter eviction are covered by local checks.
- [x] Overdue, silence, TAT computed server-side. Open task overdue state, active pod silence, and first-completion TAT are computed in the backend and covered by an integration test. Silence defaults to 24 hours and is configurable.
- [x] Frontend handles loading, empty, error, disconnected. Dashboard loading skeleton and empty, API-error, and disconnected states are implemented; production build and local page response pass.
- [~] Reconnect refetches snapshot. EventSource reconnect refresh behavior is implemented; reconnect has not been induced in the running browser for acceptance evidence.
- [~] Per-message cost captured from status webhooks. The backend stores the status pricing dimensions (`billable`, model, category, type) and any amount/currency if supplied. Meta's current pricing varies by destination market, category, and volume tiers; the webhook dimensions alone do not yield the actual charge, so a versioned account rate card and real status/billing reconciliation are still needed.
- [x] Unsupported events logged. An unknown-field webhook is signed, accepted, normalized asynchronously, and asserted in the unsupported-event audit table.
- [x] Number-rotation runbook exists. See [NUMBER_ROTATION_RUNBOOK.md](NUMBER_ROTATION_RUNBOOK.md); automated number health and routing are not implemented.

## Current count

- Complete: 8
- Partial or awaiting evidence: 11
- Pending: 2

## Working rule

Continue local and synthetic testing with the Meta test API. Do not mark a Meta Groups API, invite-link, template approval, OBA, or production eligibility item complete based on the test-number messaging flow. Revisit the production gates after the sandbox build passes and the user is ready to begin production onboarding.
