import fs from 'fs';
import path from 'path';
import { TwoChatMessage } from './types';

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
    console.error('Failed to ensure data file:', err);
  }
}

export function loadStoredMessages(): TwoChatMessage[] {
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
  ensureDataFile();

  try {
    const list = loadStoredMessages();
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
    console.error('Failed to add stored messages:', err);
  }
}

export function clearStoredMessages(): void {
  ensureDataFile();
  try {
    fs.writeFileSync(FILE_PATH, JSON.stringify([], null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to clear messages file:', err);
  }
}
