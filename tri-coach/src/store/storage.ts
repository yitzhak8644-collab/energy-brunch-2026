import { del, get, set } from 'idb-keyval';

/** נקודת ההחלפה לענן: מימוש Supabase יממש את אותו ממשק בשלב 2, בלי לגעת במנוע או ב-UI. */
export interface Blob<T = unknown> { state: T; version: number }
export interface StorageAdapter {
  load(userId: string): Promise<Blob | null>;
  save(userId: string, blob: Blob): Promise<void>;
  clear(userId: string): Promise<void>;
}

const key = (userId: string) => `tri-coach:${userId}`;

export const idbAdapter: StorageAdapter = {
  async load(userId) { return (await get<Blob>(key(userId))) ?? null; },
  async save(userId, blob) { await set(key(userId), blob); },
  async clear(userId) { await del(key(userId)); },
};
