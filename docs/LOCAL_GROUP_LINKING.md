# Linking a Real WhatsApp Group to a Pod (Local Development)

This guide walks you through the manual process of creating a WhatsApp group with your personal number, linking it to a Pod in the dashboard, and testing the end‑to‑end flow.

## Prerequisites
- The backend API (`http://localhost:8081`) and the Next.js dashboard (`http://localhost:3000`) must be running.
- You have a **personal WhatsApp number** (real device) that can create groups.
- You have a **test WhatsApp number** (the Meta test number) configured in the system for the webhook simulator. It cannot join real groups; it is used only for one‑to‑one messages.

## Steps
1. **Create the WhatsApp Group**
   1. Open WhatsApp on your mobile device.
   2. Tap **New Chat → New Group**.
   3. Add at least **your own personal number** (the device you are using) and any other contacts you want for testing.
   4. Give the group a name (e.g., `TestGroup‑Demo`).
   5. Finish creation.

2. **Obtain the Group JID**
   - The group JID has the format `<group-id>@g.us` (e.g., `1234567890-1234567890@g.us`).
   - Since the Meta API is not invoked locally, you can retrieve the JID via one of the following methods:
     - **Meta Groups API (if you have a real access token)**: `GET https://graph.facebook.com/v16.0/<WHATSAPP_BUSINESS_ID>/groups?access_token=YOUR_TOKEN`.
     - **Third‑party tool**: Tools like *WhatsApp Business API Explorer* or the `whatsapp-web.js` library can print the JID when you join the group.
     - **Temporary placeholder**: Use a dummy JID like `mytestgroup@g.us` for initial testing; later replace it with the real JID.

3. **Link the Group to a Pod**
   1. In the dashboard, navigate to **Pods** under the desired **Campaign**.
   2. Locate the pod you want to associate (e.g., `pod 1`). Click **Edit** ➜ **Link Group**.
   3. Paste the **Meta Group ID** (the JID) you obtained.
   4. Optionally paste the **Invite Link** (e.g., `https://chat.whatsapp.com/…`).
   5. Click **Save**.
   6. Click **Record Consent** – this changes the pod status from `PENDING` to `ACTIVE`.

4. **Send a Test Message**
   - From your personal WhatsApp device, send any message to the newly created group.
   - Run the webhook simulator to forward the message to the local backend (or wait for the real webhook if you have a live token):
   ```powershell
   .\\scripts\\test-webhook-message.ps1 -GroupId "<your‑group‑jid>" -From "+<your‑personal‑number>" -Body "Hello from manual group!"
   ```
   - The script posts to `http://localhost:8081/webhook/whatsapp`.

5. **Verify the Dashboard**
   - Refresh the **Inbox** page (`http://localhost:3000`).
   - You should see a new card with:
     - **Brand** badge (e.g., `Glen walk`).
     - **Pod** badge (e.g., `pod 1`).
     - **Campaign** badge (e.g., `gw`).
     - The message text you sent.
   - You can also query the API directly:
   ```bash
   curl -H "X-Dashboard-Admin-Key: <admin‑key>" "http://localhost:8081/api/messages?limit=5"
   ```
   The JSON will contain `brandName`, `brandGroupName`, and `campaignName` fields.

## Troubleshooting
- **Group JID not known**: Re‑run the script with a placeholder JID, then later update the Pod record via the dashboard UI.
- **No messages appear**:
  - Ensure the backend is running (`mvn spring-boot:run`).
  - Check `task-603.log` for any errors.
  - Verify the webhook payload contains `group_id` matching the JID you linked.
- **Pod status stays `PENDING`**: Click **Record Consent** again; the button may be disabled until a valid Group ID is present.

## Clean‑up
- Delete the test group from WhatsApp when you are done.
- Optionally remove the pod or set its status back to `PENDING` via the UI.

---
*This document resides in the repository under `docs/LOCAL_GROUP_LINKING.md` for future reference.*