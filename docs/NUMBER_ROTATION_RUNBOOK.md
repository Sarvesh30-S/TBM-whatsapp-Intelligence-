# WhatsApp number rotation runbook

Use this runbook when Meta restricts, disables, or requires replacement of the business phone number. Do not rotate a number just to refresh an access token.

## Before rotation

1. Confirm the incident in Meta Business Manager and record the restriction reason, current number ID, WABA ID, incident time, and affected campaigns.
2. Pause new group creation, invites, outbound messages, and automated processing for the affected number. Preserve inbound webhooks and raw events where available.
3. Export a private backup of the local database and the media object directory. Verify that both can be restored. Never attach message content or credentials to the incident ticket.
4. Inventory each pod by campaign, Meta group ID, current status, consent status, invite status, and participant count. Group IDs and memberships must not be assumed to transfer to another number.
5. Prepare the replacement number through Meta's required onboarding and confirm its WABA, phone-number ID, messaging permissions, webhook subscription, quality, and eligibility before routing traffic to it.

## Cutover

1. Add the replacement number's credentials to the secret store or ignored local environment file. Keep the old values available in the approved secret manager for rollback; do not commit either set.
2. Run the Meta connection check and a signed webhook challenge against the replacement configuration.
3. Send a test message and confirm that its message and status webhooks are verified, deduplicated, and linked to the replacement phone-number ID.
4. Update the number-to-WABA configuration and explicitly map campaigns to the new number. Do not overwrite old message records or group identifiers.
5. For each active pod, determine whether the old group remains reachable. If it cannot be continued, create a replacement pod/group only after the consent gate and Meta eligibility checks pass. Re-invite participants using an approved invite flow; never assume a token change moves a group.
6. Resume traffic in a small pilot. Watch webhook errors, delivery status, media-processing failures, and per-message costs before resuming all campaigns.

## Rollback and closure

- If the replacement number fails its smoke checks, pause routing to it and restore the last known configuration. Preserve both numbers' records for audit and avoid replaying sends automatically.
- Notify campaign owners that need to re-invite participants and record their acknowledgement in the campaign log.
- Close the incident only after the number-health panel is stable, all active pods have an explicit disposition, and the final database/media backup is verified.

## Current project limitation

The current sandbox does not rotate numbers or migrate real groups. This runbook is operational guidance until the number-health panel, per-number routing, and Meta production eligibility are implemented.
