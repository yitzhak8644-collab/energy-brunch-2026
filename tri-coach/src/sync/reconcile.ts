import { diffDays } from '../lib/dates';
import { eventHash, INTERVALS_PREFIX, type IntervalsEventInput } from './intervalsText';

export interface RemoteEvent {
  id: number;
  external_id?: string | null;
  start_date_local?: string;
  name?: string;
  type?: string;
  description?: string;
  category?: string;
  push_errors?: { service?: string; message?: string; date?: string }[] | null;
}

export interface Ops {
  create: IntervalsEventInput[];
  update: { id: number; ev: IntervalsEventInput }[];
  remove: number[];
  unchanged: number;
}

const day = (e: { start_date_local?: string }) => (e.start_date_local ?? '').slice(0, 10);
const norm = (s?: string | null) => (s ?? '').replace(/\r/g, '').trim();

/**
 * השוואה מפורשת (בלי upsert, שאינו עובד עם API key): התאמה לפי external_id; אימוץ לפי תאריך+סוג+שם
 * אם external_id לא נשמר; מחיקה רק של אירועים שלנו (קידומת) מהיום ואילך.
 */
export function reconcile(desired: IntervalsEventInput[], remote: RemoteEvent[], opts: { today: string; end: string; known: Record<string, string> }): Ops {
  const ops: Ops = { create: [], update: [], remove: [], unchanged: 0 };
  const claimed = new Set<number>();
  const mine = (r: RemoteEvent) => !!r.external_id && r.external_id.startsWith(INTERVALS_PREFIX);

  for (const d of desired) {
    let r = remote.find((x) => !claimed.has(x.id) && x.external_id === d.external_id);
    if (!r) {
      r = remote.find((x) => !claimed.has(x.id) && !x.external_id && x.name === d.name && x.type === d.type && day(x) === d.start_date_local.slice(0, 10));
    }
    if (!r) { ops.create.push(d); continue; }
    claimed.add(r.id);
    const sameLocal = opts.known[d.external_id] === eventHash(d) && r.external_id === d.external_id;
    const sameRemote = r.external_id === d.external_id && norm(r.description) === norm(d.description) && r.name === d.name && r.type === d.type && day(r) === d.start_date_local.slice(0, 10);
    if (sameLocal || sameRemote) ops.unchanged++;
    else ops.update.push({ id: r.id, ev: d });
  }
  for (const r of remote) {
    if (claimed.has(r.id) || !mine(r)) continue;
    const dt = day(r);
    if (diffDays(dt, opts.today) >= 0 && diffDays(dt, opts.end) <= 0) ops.remove.push(r.id);
  }
  return ops;
}
