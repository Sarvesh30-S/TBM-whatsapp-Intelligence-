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
      // ignore if already exists
    }
  }
  if (!fs.existsSync(FILE_PATH)) {
    try {
      fs.writeFileSync(FILE_PATH, JSON.stringify([], null, 2), 'utf-8');
    } catch {
      // fallback to memory
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

export function addStoredMessage(msg: TwoChatMessage): void {
  const list = loadStoredMessages();
  // Check duplicates by ID or timestamp + text + remoteNumber
  const exists = list.some(
    (m) =>
      m.id === msg.id ||
      (m.remoteNumber === msg.remoteNumber &&
        m.timestamp === msg.timestamp &&
        m.text === msg.text)
  );

  if (!exists) {
    list.unshift(msg);
    // Keep max 1000 messages
    if (list.length > 1000) {
      list.pop();
    }
    persistMessages();
  }
}

export function clearStoredMessages(): void {
  cachedMessages = [];
  persistMessages();
}
