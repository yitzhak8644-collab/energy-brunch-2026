import type { ImportedActivity } from '../engine/calibrate';
import type { Session } from '../types';

/**
 * ממשק סנכרון חיצוני (types בלבד, ללא רשת). שלב עתידי: מימוש `IntervalsIcuProvider`
 * (API של Intervals.icu כגשר ל-Garmin Connect) בלי לגעת במנוע או ב-UI.
 */
export interface PushResult {
  sessionId: string;
  ok: boolean;
  externalId?: string;
  error?: string;
}

export interface SyncProvider {
  readonly id: string;
  readonly name: string;
  /** מושך פעילויות שבוצעו מאז התאריך (YYYY-MM-DD). */
  pullActivities(since: string): Promise<ImportedActivity[]>;
  /** שולח אימונים מתוכננים (למשל ללוח של Intervals.icu → שעון). */
  pushWorkouts(sessions: Session[]): Promise<PushResult[]>;
}

/** מימוש שלב 1: קבצים ידניים. משיכה = ייבוא FIT/ZIP בממשק; דחיפה = הורדת FIT. */
export const manualFileProvider: SyncProvider = {
  id: 'manual-file',
  name: 'קבצי FIT ידניים',
  async pullActivities() { return []; },
  async pushWorkouts(sessions) {
    return sessions.map((s) => ({ sessionId: s.id, ok: false, error: 'הורדה ידנית בלבד (כפתור FIT בכרטיס האימון)' }));
  },
};
