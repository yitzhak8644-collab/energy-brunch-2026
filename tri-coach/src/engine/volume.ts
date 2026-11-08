import type { Experience, Profile } from '../types';
import type { WeekSkeleton } from './periodize';

const PEAK_CAP_H: Record<Experience, number> = { new: 9, some: 10, experienced: 11 };
const CURRENT_H: Record<Experience, number> = { new: 3, some: 5, experienced: 7 };

export function peakCapMin(p: Profile): number {
  return Math.round(Math.min(p.weeklyHours, PEAK_CAP_H[p.experience]) * 60);
}

export function startMin(p: Profile): number {
  const current = (p.currentWeeklyHours ?? CURRENT_H[p.experience]) * 60;
  return Math.max(120, Math.round(Math.min(p.weeklyHours * 60 * 0.7, current)));
}

/** יעד דקות שבועי בסיסי לכל שבוע (לפני התאמות). 3:1, עלייה ≤8%, Taper 65%→40%. */
export function weeklyTargets(p: Profile, skeleton: WeekSkeleton[]): number[] {
  const cap = peakCapMin(p);
  const start = Math.min(startMin(p), cap);
  const loadingBeforePeak = skeleton.filter(
    (w) => (w.phase === 'base' || w.phase === 'build') && !w.isRecovery,
  ).length;
  const rate =
    loadingBeforePeak > 0 ? Math.min(1.08, Math.pow(cap / start, 1 / loadingBeforePeak)) : 1;

  const out: number[] = [];
  let lastLoad = start;
  let first = true;
  let peakLevel = start;
  for (const w of skeleton) {
    if (w.phase === 'taper') {
      const idx = skeleton.filter((x) => x.phase === 'taper').indexOf(w);
      const taperCount = skeleton.filter((x) => x.phase === 'taper').length;
      // שבוע Taper אחרון (שבוע המרוץ) = 40%; ראשון = 65%
      const factor = taperCount === 1 ? 0.5 : idx === taperCount - 1 ? 0.4 : 0.65;
      out.push(Math.round(peakLevel * factor));
      continue;
    }
    if (w.isRecovery) {
      out.push(Math.round(lastLoad * 0.7));
      continue;
    }
    if (w.phase === 'peak') {
      lastLoad = Math.min(cap, Math.max(lastLoad, Math.round(lastLoad * 1.05)));
    } else if (!first) {
      lastLoad = Math.min(cap, Math.round(lastLoad * rate));
    }
    first = false;
    peakLevel = Math.max(peakLevel, lastLoad);
    out.push(lastLoad);
  }
  return enforceCaps(out, skeleton, cap);
}

/** מגבלות קשיחות: ≤10% מעל השבוע הטעון הקודם, ≤30% מעל ממוצע 4 שבועות, ≤ תקרה. */
export function enforceCaps(vals: number[], skeleton: WeekSkeleton[], capMin: number): number[] {
  const out = [...vals];
  let prevLoad: number | undefined;
  for (let i = 0; i < out.length; i++) {
    const w = skeleton[i];
    let v = Math.min(out[i], capMin);
    const prior = out.slice(Math.max(0, i - 4), i);
    if (prior.length) {
      const avg = prior.reduce((a, b) => a + b, 0) / prior.length;
      v = Math.min(v, Math.round(avg * 1.3));
    }
    if (!w.isRecovery && w.phase !== 'taper' && prevLoad !== undefined) {
      v = Math.min(v, Math.round(prevLoad * 1.1));
    }
    out[i] = v;
    if (!w.isRecovery && w.phase !== 'taper') prevLoad = v;
  }
  return out;
}
