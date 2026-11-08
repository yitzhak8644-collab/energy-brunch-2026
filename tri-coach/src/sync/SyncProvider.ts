import type { ImportedActivity } from '../engine/calibrate';
import type { DailyMetrics, Session, Zones } from '../types';

/** ממשק סנכרון חיצוני. מימושים: ידני (שלב 1) ו-Intervals.icu (גשר ל-Garmin Connect). */
export interface PushOptions {
  zones: Zones;
  today: string; // YYYY-MM-DD
  windowDays?: number; // ברירת מחדל 14
  known?: Record<string, string>; // external_id → hash שנדחף בעבר
}

export interface PushSummary {
  created: number;
  updated: number;
  deleted: number;
  unchanged: number;
  errors: string[];
  pushErrors: { name: string; date: string; message: string }[]; // שגיאות Garmin שדווחו על אירועים
  known: Record<string, string>;
  /** external_id לא חזר בקריאה חוזרת — לעצור סנכרון אוטומטי כדי לא ליצור כפילויות */
  externalIdLost?: boolean;
}

export interface SyncProvider {
  readonly id: string;
  readonly name: string;
  pullActivities(since: string): Promise<ImportedActivity[]>;
  pullMetrics?(since: string, today: string): Promise<DailyMetrics[]>;
  /** מיישר את לוח השנה החיצוני בחלון [today, today+windowDays) עם האימונים שניתנו. */
  pushWorkouts(sessions: Session[], opts: PushOptions): Promise<PushSummary>;
}

const empty = (known: Record<string, string> = {}): PushSummary => ({ created: 0, updated: 0, deleted: 0, unchanged: 0, errors: [], pushErrors: [], known });

/** מימוש שלב 1: קבצים ידניים. משיכה = ייבוא FIT/ZIP בממשק; דחיפה = הורדת FIT. */
export const manualFileProvider: SyncProvider = {
  id: 'manual-file',
  name: 'קבצי FIT ידניים',
  async pullActivities() { return []; },
  async pushWorkouts(_sessions, opts) {
    return { ...empty(opts.known), errors: ['הורדה ידנית בלבד (כפתור FIT בכרטיס האימון)'] };
  },
};
