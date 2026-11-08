// תאריכים כמחרוזות YYYY-MM-DD, חישוב לפי UTC כדי להימנע מבעיות אזור זמן וקיץ/חורף.
import type { Weekday } from '../types';

const MS = 86_400_000;

export function dayNum(s: string): number {
  const [y, m, d] = s.split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / MS);
}
export function fromDayNum(n: number): string {
  const d = new Date(n * MS);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}
export const addDays = (s: string, n: number) => fromDayNum(dayNum(s) + n);
export const diffDays = (a: string, b: string) => dayNum(a) - dayNum(b); // a - b
/** 0 = שני … 6 = ראשון */
export function weekday(s: string): Weekday {
  return ((((dayNum(s) + 3) % 7) + 7) % 7) as Weekday;
}
export const mondayOf = (s: string) => addDays(s, -weekday(s));
export function mondayOnOrAfter(s: string): string {
  const w = weekday(s);
  return w === 0 ? s : addDays(s, 7 - w);
}
/** התאריך המקומי של המכשיר כמחרוזת (לשימוש ב-UI בלבד; המנוע מקבל today כפרמטר). */
export function todayLocal(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
