# TBM WhatsApp Intelligence

New project for the WhatsApp operations dashboard described in the attached master brief. It lives beside the existing Billbot expense tracker because the two products have different data models and workflows.

## Development sequence

1. Connect to the Meta WhatsApp Cloud API test number and verify credentials.
2. Receive and authenticate webhooks; store the raw events and deduplicate retries.
3. Add Postgres schema, campaign/group records, consent gate, and message ingestion.
4. Add asynchronous media handling and the review-first intelligence pipeline.
5. Add role-scoped dashboard snapshots and SSE updates.
6. Deploy a public HTTPS webhook, then complete Meta account eligibility and production onboarding.

## Current local foundation

- `backend/`: Java 21 + Spring Boot API. Graph API access is isolated in a configurable server-side client. The token is never sent to the browser.
- `frontend/`: Next.js App Router dashboard shell.
- `docker-compose.yml`: local PostgreSQL on port 5433.
- `.env.example`: local variable names only; copy to `.env` and fill in Meta test credentials locally.

The Meta connection check is `GET /api/meta/test-connection`. It reads the test phone-number profile; it does not send a message or create a group. `GET /api/health` is the local API smoke check. The webhook receiver at `/webhook/whatsapp` implements Meta's GET challenge, validates POST `X-Hub-Signature-256` against the raw body, stores valid bodies durably in `raw_webhook_events`, and acknowledges before background normalization. The queue retries failed normalization up to five times and exposes pending/failed counts in health. The local code also includes asynchronous media processing, Sarvam transcription, OpenAI extraction and summaries, plus brand-scoped dashboard events. These AI paths still need provider keys and real test media to verify end to end.

## Start locally

1. Copy `.env.example` to `.env` and supply the test app values from Meta's WhatsApp API Setup page. Spring reads the root `.env` when launched from `backend/`; Next.js uses the configured local API URL by default.
2. Run the API from `backend/` with `mvn "-Dspring-boot.run.profiles=local" spring-boot:run` for an H2-backed smoke run. Docker Compose PostgreSQL is available for integration work when Docker is installed.
3. Create `frontend/.env.local` with `BACKEND_ADMIN_API_KEY` matching `DASHBOARD_ADMIN_API_KEY` in the root `.env`, and `BACKEND_API_URL=http://localhost:8081`. Keep both files local and secret. The Next.js dev server must be restarted after changing environment values.
4. Run the dashboard from `frontend/` with `npm install` then `npm run dev`.

## Campaign, group, and pod planning

Open `http://localhost:3000/campaigns` and create records in this order:

1. **Brand** — the client or organization that owns the work.
2. **Campaign** — a specific initiative under that brand, such as a service pilot.
3. **Pod** — a planned small WhatsApp group under a campaign. For this product, a pod is an internal planning record for one eventual WhatsApp group. The current form allows up to seven planned external participants per pod.

The page calls these protected local API routes through Next.js server actions. The browser never receives the admin key:

- `GET/POST /api/admin/brands`
- `GET/POST /api/admin/campaigns` (optional `brandId` filter on GET)
- `GET/POST /api/admin/campaigns/{campaignId}/pods`

For now, creating a pod only stores a local plan with status `PENDING_CONSENT`, no Meta group ID, and no invite URL. It does not message participants, mark consent as sent, or call Meta's Groups API. Consent must be recorded before a pod can move toward group creation. Meta group creation and invite-link handling are a later adapter step that depends on Meta Groups API access and account eligibility. The Meta test-number messaging flow is separate: use it to verify message sending and webhooks, not to assume group creation is available.

See [`docs/META_TEST_SETUP.md`](docs/META_TEST_SETUP.md) for where to find each Meta test value and how to verify the connection.

See [`docs/AI_PROVIDER_SETUP.md`](docs/AI_PROVIDER_SETUP.md) to configure Sarvam speech transcription and OpenAI summaries and media extraction.
See [`docs/OPERATIONS_METRICS.md`](docs/OPERATIONS_METRICS.md) for server-side overdue, silence, and TAT definitions.

## Sandbox limits

The test number can validate the Cloud API integration path that Meta enables for the test account. The product brief centers on Groups API, which has separate business-account and phone-number eligibility. Local development will therefore keep the Meta API behind an adapter and use captured/synthetic group events until the actual Meta number is confirmed eligible. A successful test-number profile lookup is not evidence that group endpoints are enabled.

Never commit `.env`, access tokens, app secrets, webhook verification tokens, or real customer message payloads.
