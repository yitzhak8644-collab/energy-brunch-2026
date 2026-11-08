import { addDays, diffDays } from '../lib/dates';
import type { Profile } from '../types';

export interface ImportedActivity {
  id: string;
  sport: 'swim' | 'bike' | 'run' | 'other';
  start: string; // YYYY-MM-DD
  durationSec: number;
  distanceM: number;
  avgHr?: number;
  maxHr?: number;
}

export interface Calibration {
  patch: Partial<Profile>;
  summary: { activities: number; swims: number; rides: number; runs: number; weeklyHours: number };
  notes: string[];
}

const RIEGEL = 1.06;
const riegel = (t: number, d: number, target: number) => t * Math.pow(target / d, RIEGEL);

/** מכייל פרופיל מהיסטוריה (ברירת מחדל: 26 שבועות). הערכות — המשתמש מאשר/מתקן ב-onboarding. */
export function calibrate(acts: ImportedActivity[], today: string, weeks = 26): Calibration {
  const since = addDays(today, -weeks * 7);
  const a = acts.filter((x) => x.start >= since && diffDays(x.start, today) <= 0 && x.durationSec > 0);
  const swims = a.filter((x) => x.sport === 'swim');
  const rides = a.filter((x) => x.sport === 'bike');
  const runs = a.filter((x) => x.sport === 'run');
  const patch: Partial<Profile> = {};
  const notes: string[] = [];

  // שחייה: הקצב הטוב ביותר באימון של ≥800 מ׳, בניכוי 2% (אימון שלם איטי יותר ממאמץ 1 ק״מ)
  const longSwims = swims.filter((x) => x.distanceM >= 800);
  if (longSwims.length) {
    const best = Math.min(...longSwims.map((x) => (x.durationSec / x.distanceM) * 100));
    patch.swimPace1k = Math.round(best * 0.98);
    notes.push(`שחייה: הקצב הטוב ביותר ${fmtPace(best)} ל-100 מ׳ מ-${longSwims.length} אימונים.`);
  }
  // אופניים: הרכיבה הארוכה ביותר; מהירות ממוצעת של 3 הרכיבות הארוכות (≥20 ק״מ)
  const longRides = rides.filter((x) => x.distanceM >= 20_000).sort((p, q) => q.distanceM - p.distanceM);
  if (longRides.length) {
    patch.bikeLongestKm = Math.round(longRides[0].distanceM / 100) / 10;
    const top = longRides.slice(0, 3);
    patch.bikeAvgKmh = Math.round((top.reduce((s, x) => s + (x.distanceM / 1000) / (x.durationSec / 3600), 0) / top.length) * 10) / 10;
    notes.push(`אופניים: רכיבה ארוכה ${patch.bikeLongestKm} ק״מ, מהירות ${patch.bikeAvgKmh} קמ״ש.`);
  }
  // ריצה: הערכת 5K/10K מהריצה הטובה ביותר לפי Riegel (≥4.8 / ≥8 ק״מ)
  const est = (minD: number, target: number) => {
    const c = runs.filter((x) => x.distanceM >= minD);
    return c.length ? Math.round(Math.min(...c.map((x) => riegel(x.durationSec, x.distanceM, target)))) : undefined;
  };
  const t5 = est(4800, 5000), t10 = est(8000, 10000);
  if (t5) patch.run5kSec = t5;
  if (t10) patch.run10kSec = t10;
  if (t5 || t10) notes.push(`ריצה: הערכת 5K ${t5 ? fmtTime(t5) : '—'}, 10K ${t10 ? fmtTime(t10) : '—'} (מאימונים, לא ממרוץ).`);

  // נפח שבועי: 8 השבועות האחרונים
  const since8 = addDays(today, -56);
  const sec8 = a.filter((x) => x.start >= since8 && x.sport !== 'other').reduce((s, x) => s + x.durationSec, 0);
  const weeklyHours = Math.round((sec8 / 3600 / 8) * 10) / 10;
  if (sec8 > 0) { patch.currentWeeklyHours = weeklyHours; notes.push(`נפח שבועי ממוצע ב-8 השבועות האחרונים: ${weeklyHours} שעות.`); }

  const hrs = a.map((x) => x.maxHr ?? 0).filter((h) => h >= 120 && h <= 220).sort((x, y) => x - y);
  if (hrs.length >= 5) patch.maxHr = hrs[Math.floor(hrs.length * 0.98)] ?? hrs[hrs.length - 1];

  if (Object.keys(patch).length) patch.source = 'fit-import';
  return { patch, summary: { activities: a.length, swims: swims.length, rides: rides.length, runs: runs.length, weeklyHours }, notes };
}

export const fmtPace = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`;
export const fmtTime = (sec: number) => {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = Math.round(sec % 60);
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
};
