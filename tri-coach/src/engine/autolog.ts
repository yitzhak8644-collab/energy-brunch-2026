import type { ImportedActivity } from './calibrate';
import type { Log, Week } from '../types';

export interface AutoLog {
  sessionId: string;
  activityId: string;
  actualMin: number;
  actualKm?: number;
  avgHr?: number;
  rpe?: number;
}

/**
 * מתאים פעילויות שבוצעו לאימונים מתוכננים: אותו תאריך ואותו ענף, הקרוב ביותר במשך.
 * לא כותב על רישום קיים, ולא משתמש בפעילות שכבר מקושרת.
 */
export function matchActivities(acts: ImportedActivity[], weeks: Week[], logs: Record<string, Log>): AutoLog[] {
  const linked = new Set(Object.values(logs).map((l) => l.activityId).filter(Boolean));
  const free = weeks.flatMap((w) => w.sessions).filter((s) => !logs[s.id] && (s.discipline === 'swim' || s.discipline === 'bike' || s.discipline === 'run'));
  const used = new Set<string>();
  const out: AutoLog[] = [];
  for (const a of [...acts].sort((x, y) => x.start.localeCompare(y.start))) {
    if (a.sport === 'other' || linked.has(a.id) || a.durationSec < 600) continue;
    const mins = a.durationSec / 60;
    const cands = free.filter((s) => !used.has(s.id) && s.date === a.start && s.discipline === a.sport);
    if (!cands.length) continue;
    const best = cands.reduce((p, c) => (Math.abs(c.targetMin - mins) < Math.abs(p.targetMin - mins) ? c : p));
    used.add(best.id);
    out.push({
      sessionId: best.id, activityId: a.id, actualMin: Math.round(mins),
      actualKm: a.distanceM ? Math.round(a.distanceM / 100) / 10 : undefined, avgHr: a.avgHr, rpe: a.rpe,
    });
  }
  return out;
}
