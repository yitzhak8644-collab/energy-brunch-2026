import { fmtPace, fmtTime } from '../engine/calibrate';
export { fmtPace, fmtTime };

export function parseTime(s: string): number | undefined {
  const parts = s.trim().split(':').map(Number);
  if (!parts.length || parts.some((n) => Number.isNaN(n))) return undefined;
  return parts.reduce((a, n) => a * 60 + n, 0) || undefined;
}
export const fmtDur = (min: number) => (min >= 60 ? `${Math.floor(min / 60)}:${String(Math.round(min % 60)).padStart(2, '0')} ש׳` : `${Math.round(min)} דק׳`);
export function fmtDateHe(s: string, opts: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long' }) {
  const [y, m, d] = s.split('-').map(Number);
  return new Intl.DateTimeFormat('he-IL', { ...opts, timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, d)));
}
