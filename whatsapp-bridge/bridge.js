import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion
} from "@whiskeysockets/baileys";
import qrcode from "qrcode-terminal";
import pino from "pino";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, "../.env");

let appSecret = "719b4449fd0dff158fa1c2217207a4cf";
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, "utf-8");
  const match = content.match(/^\s*META_APP_SECRET\s*=\s*(.+)$/m);
  if (match) appSecret = match[1].trim();
}

const WEBHOOK_URL = process.env.WEBHOOK_URL || "http://localhost:8081/webhook/whatsapp";
const AUTH_DIR = path.resolve(__dirname, "auth_info_baileys");

async function startBridge() {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: "silent" }),
    printQRInTerminal: false,
    generateHighQualityLinkPreview: false
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log("\n=======================================================");
      console.log(" SCAN THIS QR CODE WITH WHATSAPP ON YOUR PHONE");
      console.log(" (WhatsApp -> Settings / Three Dots -> Linked Devices)");
      console.log("=======================================================\n");
      qrcode.generate(qr, { small: true });
    }

    if (connection === "close") {
      const shouldReconnect =
        lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log(
        "[Bridge] Connection closed due to:",
        lastDisconnect?.error?.message || "Unknown error",
        "| Reconnecting:",
        shouldReconnect
      );
      if (shouldReconnect) {
        setTimeout(startBridge, 3000);
      } else {
        console.log("[Bridge] Logged out. Delete auth_info_baileys and restart.");
      }
    } else if (connection === "open") {
      console.log("\n=======================================================");
      console.log(" [SUCCESS] WHATSAPP BRIDGE CONNECTED & READY!");
      console.log(" Forwarding group messages to: " + WEBHOOK_URL);
      console.log("=======================================================\n");

      try {
        const groups = await sock.groupFetchAllParticipating();
        const groupList = Object.values(groups);
        if (groupList.length > 0) {
          console.log("YOUR AVAILABLE WHATSAPP GROUPS & THEIR JIDs:");
          console.log("-------------------------------------------------------");
          groupList.forEach((g) => {
            console.log(` • Group Name: "${g.subject}"`);
            console.log(`   Group ID:   ${g.id}`);
            console.log("-------------------------------------------------------");
          });
          console.log("\nCopy any Group ID above and paste it into your Pod on:");
          console.log(" -> http://localhost:3000/campaigns\n");
        } else {
          console.log("[Info] No groups found yet. Create a group on your phone and add this number to it.");
        }
      } catch (err) {
        console.log("[Info] Ready to listen for incoming messages.");
      }
    }
  });

  sock.ev.on("messages.upsert", async ({ messages: newMessages, type }) => {
    for (const msg of newMessages) {
      if (!msg.message) continue;

      const remoteJid = msg.key.remoteJid;
      if (!remoteJid) continue;

      const isGroup = remoteJid.endsWith("@g.us");
      if (!isGroup) {
        // Only focus on groups as requested
        continue;
      }

      // Extract message text
      const text =
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        msg.message.imageMessage?.caption ||
        msg.message.videoMessage?.caption ||
        "";

      if (!text.trim()) continue;

      // Clean sender ID
      const rawParticipant = msg.key.participant || remoteJid;
      const cleanSender = rawParticipant.replace(/@.*$/, "").replace(/\D/g, "");

      const msgId = "wamid.live." + (msg.key.id || crypto.randomUUID().substring(0, 8));
      const timestamp = String(
        msg.messageTimestamp
          ? typeof msg.messageTimestamp === "number"
            ? msg.messageTimestamp
            : msg.messageTimestamp.low
          : Math.floor(Date.now() / 1000)
      );

      // Construct standard Meta WhatsApp Cloud API webhook format
      const payloadObj = {
        object: "whatsapp_business_account",
        entry: [
          {
            id: "1249970158206146",
            changes: [
              {
                field: "messages",
                value: {
                  metadata: {
                    phone_number_id: "1310637042128885"
                  },
                  contacts: [
                    {
                      profile: {
                        name: msg.pushName || ("+" + cleanSender)
                      },
                      wa_id: cleanSender
                    }
                  ],
                  messages: [
                    {
                      from: cleanSender,
                      id: msgId,
                      timestamp: timestamp,
                      type: "text",
                      group_id: remoteJid,
                      text: {
                        body: text
                      }
                    }
                  ]
                }
              }
            ]
          }
        ]
      };

      const payloadStr = JSON.stringify(payloadObj);
      const hmac = crypto.createHmac("sha256", appSecret);
      hmac.update(payloadStr, "utf-8");
      const signature = "sha256=" + hmac.digest("hex");

      console.log(`\n[Real Group Message]`);
      console.log(` Group:   ${remoteJid}`);
      console.log(` Sender:  +${cleanSender}`);
      console.log(` Message: "${text}"`);

      try {
        const res = await fetch(WEBHOOK_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Hub-Signature-256": signature
          },
          body: payloadStr
        });

        if (res.ok) {
          console.log(` -> Delivered to Backend Dashboard: HTTP ${res.status} OK`);
        } else {
          console.error(` -> Failed to deliver: HTTP ${res.status}`);
        }
      } catch (err) {
        console.error(` -> Error forwarding to webhook:`, err.message);
      }
    }
  });
}

startBridge().catch((err) => {
  console.error("[Fatal Error in Bridge]", err);
});
