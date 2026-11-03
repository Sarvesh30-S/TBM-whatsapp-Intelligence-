import fs from 'fs';
import path from 'path';
import { TwoChatMessage } from './types';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const FILE_PATH = path.join(DATA_DIR, '2chat_messages.json');

// In-memory cache
let cachedMessages: TwoChatMessage[] | null = null;

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) {
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    } catch {
      // ignore
    }
  }
  if (!fs.existsSync(FILE_PATH)) {
    try {
      fs.writeFileSync(FILE_PATH, JSON.stringify([], null, 2), 'utf-8');
    } catch {
      // ignore
    }
  }
}

export function loadStoredMessages(): TwoChatMessage[] {
  if (cachedMessages !== null) {
    return cachedMessages;
  }
  ensureDataFile();
  try {
    if (fs.existsSync(FILE_PATH)) {
      const content = fs.readFileSync(FILE_PATH, 'utf-8');
      cachedMessages = JSON.parse(content);
      return cachedMessages || [];
    }
  } catch (err) {
    console.error('Failed to read messages file:', err);
  }
  cachedMessages = [];
  return cachedMessages;
}

function persistMessages() {
  if (!cachedMessages) return;
  ensureDataFile();
  try {
    fs.writeFileSync(FILE_PATH, JSON.stringify(cachedMessages, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to write messages file:', err);
  }
}

function getMessageKey(m: TwoChatMessage): string {
  if (m.id && !m.id.startsWith('api-') && !m.id.startsWith('webhook-') && !m.id.startsWith('group-msg-')) {
    return m.id;
  }
  return `${m.isGroup ? 'grp' : 'dir'}_${m.chatName}_${m.senderNumber}_${m.timestamp}_${m.text}`;
}

export function addStoredMessage(msg: TwoChatMessage): void {
  addStoredMessages([msg]);
}

export function addStoredMessages(newMessages: TwoChatMessage[]): void {
  if (!newMessages || newMessages.length === 0) return;
  const list = loadStoredMessages();
  const existingKeys = new Set(list.map(getMessageKey));

  let added = false;
  for (const msg of newMessages) {
    const key = getMessageKey(msg);
    if (!existingKeys.has(key)) {
      existingKeys.add(key);
      list.push(msg);
      added = true;
    }
  }

  if (added) {
    // Sort chronologically ascending
    list.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    // Keep max 2000 messages
    if (list.length > 2000) {
      list.splice(0, list.length - 2000);
    }
    persistMessages();
  }
}

export function clearStoredMessages(): void {
  cachedMessages = [];
  persistMessages();
}
