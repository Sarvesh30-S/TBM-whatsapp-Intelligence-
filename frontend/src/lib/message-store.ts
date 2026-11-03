import fs from 'fs';
import path from 'path';
import { TwoChatMessage } from './types';
import { clearMessagesFromDb, getMessagesFromDb, saveMessagesToDb } from './db';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const FILE_PATH = path.join(DATA_DIR, '2chat_messages.json');

function ensureDataFile() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(FILE_PATH)) {
      fs.writeFileSync(FILE_PATH, JSON.stringify([], null, 2), 'utf-8');
    }
  } catch (err) {
    // ignore
  }
}

export function loadStoredMessagesFromFile(): TwoChatMessage[] {
  ensureDataFile();
  try {
    if (fs.existsSync(FILE_PATH)) {
      const content = fs.readFileSync(FILE_PATH, 'utf-8');
      if (content && content.trim()) {
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    }
  } catch (err) {
    console.error('Failed to read messages file:', err);
  }
  return [];
}

export async function loadStoredMessages(): Promise<TwoChatMessage[]> {
  try {
    const dbMessages = await getMessagesFromDb();
    if (dbMessages && dbMessages.length > 0) {
      return dbMessages;
    }
  } catch (err) {
    console.warn('Postgres read failed, falling back to file:', err);
  }
  return loadStoredMessagesFromFile();
}

function getMessageKey(m: TwoChatMessage): string {
  if (m.id && !m.id.startsWith('api-') && !m.id.startsWith('webhook-') && !m.id.startsWith('group-msg-')) {
    return m.id;
  }
  return `${m.isGroup ? 'grp' : 'dir'}_${m.chatName}_${m.senderNumber}_${m.timestamp}_${m.text}`;
}

export async function addStoredMessage(msg: TwoChatMessage): Promise<void> {
  await addStoredMessages([msg]);
}

export async function addStoredMessages(newMessages: TwoChatMessage[]): Promise<void> {
  if (!newMessages || newMessages.length === 0) return;

  // 1. Save to Supabase PostgreSQL database
  try {
    await saveMessagesToDb(newMessages);
  } catch (err) {
    console.error('Error saving to Postgres:', err);
  }

  // 2. Also sync to local JSON backup
  try {
    ensureDataFile();
    const list = loadStoredMessagesFromFile();
    const existingKeys = new Set(list.map(getMessageKey));

    let added = false;
    for (const msg of newMessages) {
      if (!msg) continue;
      const key = getMessageKey(msg);
      if (!existingKeys.has(key)) {
        existingKeys.add(key);
        list.push(msg);
        added = true;
      }
    }

    if (added) {
      list.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      if (list.length > 3000) {
        list.splice(0, list.length - 3000);
      }
      fs.writeFileSync(FILE_PATH, JSON.stringify(list, null, 2), 'utf-8');
    }
  } catch (err) {
    console.error('Failed to write messages backup:', err);
  }
}

export async function clearStoredMessages(): Promise<void> {
  try {
    await clearMessagesFromDb();
  } catch (err) {
    console.error('Failed to clear Postgres:', err);
  }

  ensureDataFile();
  try {
    fs.writeFileSync(FILE_PATH, JSON.stringify([], null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to clear messages file:', err);
  }
}
