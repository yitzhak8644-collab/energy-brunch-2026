import { addDays } from '../lib/dates';
import type { DailyMetrics } from '../types';

export interface Readiness {
  enough: boolean; // יש מספיק נתוני בסיס (≥7 ימים) כדי לשפוט
  fatigued: boolean;
  reasons: string[];
}

const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/** עייפות לפי דופק מנוחה (+7 ב-2 מתוך 3 ימים) או HRV (<80% מהבסיס ב-3 ימים רצופים). דורש ≥7 ימי בסיס. */
export function assessReadiness(metrics: Record<string, DailyMetrics>, today: string): Readiness {
  const rangeDays = (from: number, to: number) => Array.from({ length: from - to + 1 }, (_, i) => addDays(today, -(from - i)));
  const baseDays = rangeDays(31, 4).map((d) => metrics[d]).filter(Boolean) as DailyMetrics[];
  const recent = rangeDays(2, 0).map((d) => metrics[d]);
  const rhrBase = baseDays.map((m) => m.restingHr).filter((x): x is number => !!x);
  const hrvBase = baseDays.map((m) => m.hrv).filter((x): x is number => !!x);
  const reasons: string[] = [];
  const enough = rhrBase.length >= 7 || hrvBase.length >= 7;

  if (rhrBase.length >= 7) {
    const base = median(rhrBase);
    const high = recent.filter((m) => m?.restingHr && m.restingHr >= base + 7).length;
    if (high >= 2) reasons.push(`דופק מנוחה גבוה ב-7+ פעימות מהרגיל (${Math.round(base)})`);
  }
  if (hrvBase.length >= 7 && recent.every((m) => m?.hrv)) {
    const base = mean(hrvBase);
    if (recent.every((m) => m!.hrv! < base * 0.8)) reasons.push('HRV נמוך ב-20%+ מהרגיל שלושה ימים ברצף');
  }
  return { enough, fatigued: reasons.length > 0, reasons };
}
