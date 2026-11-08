import { addDays, diffDays, mondayOf, mondayOnOrAfter } from '../lib/dates';
import type { Phase } from '../types';

export interface WeekSkeleton {
  index: number;
  start: string; // יום שני
  end: string; // יום ראשון, או יום המרוץ בשבוע האחרון
  phase: Phase;
  isRecovery: boolean;
}

/** שבועות מהיום שני הראשון (ביום או אחרי `today`) ועד שבוע המרוץ. דטרמיניסטי: today מועבר כפרמטר. */
export function periodize(today: string, raceDate: string): WeekSkeleton[] {
  if (diffDays(raceDate, today) < 0) return [];
  const raceMonday = mondayOf(raceDate);
  // אם המרוץ בשבוע הנוכחי והיום שני כבר עבר – השבוע מתחיל היום
  const start = mondayOnOrAfter(today) > raceMonday ? today : mondayOnOrAfter(today);
  const first = mondayOnOrAfter(today) > raceMonday ? raceMonday : start;
  const n = diffDays(raceMonday, first) / 7 + 1;

  const taper = Math.min(2, n);
  const rest = n - taper;
  const peak = rest >= 9 ? 3 : rest >= 6 ? 2 : rest >= 3 ? 1 : 0;
  const body = rest - peak;
  const build = body <= 1 ? 0 : Math.round(body * 0.45);
  const base = body - build;

  const phases: Phase[] = [
    ...Array<Phase>(base).fill('base'),
    ...Array<Phase>(build).fill('build'),
    ...Array<Phase>(peak).fill('peak'),
    ...Array<Phase>(taper).fill('taper'),
  ];
  return phases.map((phase, index) => {
    const weekStart = addDays(first, index * 7);
    const last = index === n - 1;
    return {
      index,
      start: weekStart,
      end: last ? raceDate : addDays(weekStart, 6),
      phase,
      isRecovery: (phase === 'base' || phase === 'build') && (index + 1) % 4 === 0,
    };
  });
}
