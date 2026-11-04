import fs from 'fs';
import path from 'path';
import { TwoChatMessage } from './types';
import { clearMessagesFromDb, getMessagesFromDb, saveMessagesToDb } from './db';

/**
 * Supabase Postgres is the single source of truth.
 * The local JSON file is only used as an emergency fallback when the database is unreachable
 * (it is not writable on Vercel, so failures there are ignored).
 */
const FILE_PATH = path.join(process.cwd(), 'data', '2chat_messages.json');

function readFallbackFile(): TwoChatMessage[] {
  try {
    if (fs.existsSync(FILE_PATH)) {
      const parsed = JSON.parse(fs.readFileSync(FILE_PATH, 'utf-8'));
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // ignore
  }
  return [];
}

function writeFallbackFile(newMessages: TwoChatMessage[]) {
  try {
    const list = readFallbackFile();
    const map = new Map(list.map((m) => [m.id, m]));
    for (const m of newMessages) map.set(m.id, m);
    const merged = Array.from(map.values())
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      .slice(-3000);
    fs.mkdirSync(path.dirname(FILE_PATH), { recursive: true });
    fs.writeFileSync(FILE_PATH, JSON.stringify(merged, null, 2), 'utf-8');
  } catch {
    // read-only file system (e.g. Vercel) – ignore
  }
}

export async function loadStoredMessages(channelNumber?: string): Promise<TwoChatMessage[]> {
  try {
    return await getMessagesFromDb(channelNumber);
  } catch (err) {
    console.warn('Postgres read failed, falling back to file:', err);
    const all = readFallbackFile();
    return channelNumber ? all.filter((m) => !m.channelNumber || m.channelNumber === channelNumber) : all;
  }
}

export async function addStoredMessage(msg: TwoChatMessage): Promise<void> {
  await addStoredMessages([msg]);
}

export async function addStoredMessages(newMessages: TwoChatMessage[]): Promise<void> {
  const list = (newMessages || []).filter(Boolean);
  if (list.length === 0) return;
  try {
    await saveMessagesToDb(list);
  } catch (err) {
    console.error('Error saving to Postgres, writing fallback file:', err);
    writeFallbackFile(list);
  }
}

export async function clearStoredMessages(channelNumber?: string): Promise<void> {
  try {
    await clearMessagesFromDb(channelNumber);
  } catch (err) {
    console.error('Failed to clear Postgres:', err);
  }
  try {
    if (fs.existsSync(FILE_PATH)) fs.writeFileSync(FILE_PATH, '[]', 'utf-8');
  } catch {
    // ignore
  }
}
