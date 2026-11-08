import { describe, expect, it } from 'vitest';
import { adaptPlan } from '../adapt';
import { matchActivities } from '../autolog';
import type { ImportedActivity } from '../calibrate';
import { generatePlan } from '../generate';
import { assessReadiness } from '../readiness';
import { addDays } from '../../lib/dates';
import type { DailyMetrics, Log } from '../../types';
import { profile } from './helpers';

const p = profile();
const { weeks, zones } = generatePlan(p, '2026-11-08');
const sessions = weeks.flatMap((w) => w.sessions);
const act = (over: Partial<ImportedActivity>): ImportedActivity => ({ id: 'a1', sport: 'run', start: sessions[0].date, durationSec: 3000, distanceM: 8000, ...over });

describe('matchActivities', () => {
  const first = sessions[0];
  it('מתאים לפי תאריך+ענף וממלא משך/מרחק/דופק/RPE', () => {
    const [m] = matchActivities([act({ sport: first.discipline as 'run', avgHr: 150, rpe: 6 })], weeks, {});
    expect(m).toMatchObject({ sessionId: first.id, activityId: 'a1', actualMin: 50, actualKm: 8, avgHr: 150, rpe: 6 });
  });
  it('לא מתאים ענף אחר, יום אחר, פעילות קצרה מ-10 דק׳ או "other"', () => {
    const other = first.discipline === 'run' ? 'swim' : 'run';
    expect(matchActivities([act({ sport: other })], weeks, {})).toHaveLength(0);
    expect(matchActivities([act({ sport: first.discipline as 'run', start: addDays(first.date, 40) })], weeks, {})).toHaveLength(0);
    expect(matchActivities([act({ sport: first.discipline as 'run', durationSec: 300 })], weeks, {})).toHaveLength(0);
    expect(matchActivities([act({ sport: 'other' })], weeks, {})).toHaveLength(0);
  });
  it('לא דורס רישום קיים ולא משתמש שוב בפעילות מקושרת', () => {
    const log = { id: 'l', userId: 'me', sessionId: first.id, completed: false, source: 'manual', createdAt: '', updatedAt: '' } as Log;
    expect(matchActivities([act({ sport: first.discipline as 'run' })], weeks, { [first.id]: log })).toHaveLength(0);
    const linked = { ...log, sessionId: 'zzz', activityId: 'a1' } as Log;
    expect(matchActivities([act({ sport: first.discipline as 'run' })], weeks, { zzz: linked })).toHaveLength(0);
  });
  it('שתי פעילויות באותו יום ענף: כל אחת לאימון אחר או נדחית', () => {
    const s = sessions.find((x) => x.discipline === 'run')!;
    const out = matchActivities([act({ id: 'x', sport: 'run', start: s.date, durationSec: s.targetMin * 60 }), act({ id: 'y', sport: 'run', start: s.date, durationSec: 1200 })], weeks, {});
    expect(new Set(out.map((o) => o.sessionId)).size).toBe(out.length);
  });
});

const series = (n: number, f: (i: number) => Partial<DailyMetrics>, today: string, to = 0): Record<string, DailyMetrics> => {
  const m: Record<string, DailyMetrics> = {};
  for (let i = n; i >= to; i--) { const d = addDays(today, -i); m[d] = { date: d, ...f(i) }; }
  return m;
};

describe('assessReadiness', () => {
  const T = '2026-11-20';
  it('דופק מנוחה +7 ב-2 מ-3 ימים → עייף', () => {
    const m = series(30, (i) => ({ restingHr: i <= 1 ? 59 : 50 }), T);
    expect(assessReadiness(m, T)).toMatchObject({ enough: true, fatigued: true });
  });
  it('HRV נמוך 3 ימים ברצף → עייף; יום אחד בלבד → לא', () => {
    expect(assessReadiness(series(30, (i) => ({ hrv: i <= 2 ? 40 : 60 }), T), T).fatigued).toBe(true);
    expect(assessReadiness(series(30, (i) => ({ hrv: i === 0 ? 40 : 60 }), T), T).fatigued).toBe(false);
  });
  it('פחות מ-7 ימי בסיס → לא פועלים', () => {
    const r = assessReadiness(series(5, () => ({ restingHr: 70 }), T), T);
    expect(r).toMatchObject({ enough: false, fatigued: false });
  });
});

describe('adaptPlan — מוכנות', () => {
  const hardDay = sessions.find((s) => s.hard && s.discipline !== 'race')!;
  const T = hardDay.date;
  const metrics = series(30, (i) => ({ restingHr: i <= 1 ? 62 : 50 }), T);
  const run = (notes = [] as ReturnType<typeof adaptPlan>['notes'], logs: Record<string, Log> = {}) =>
    adaptPlan({ profile: p, zones, weeks, logs, notes, today: T, metrics });

  it('מחליף אימון קשה של היום בקל, פעם אחת בהערה, ואידמפוטנטי', () => {
    const r = run();
    const today = r.weeks.flatMap((w) => w.sessions).filter((s) => s.date === T);
    expect(today.some((s) => s.hard)).toBe(false);
    expect(r.added.filter((n) => n.key === `ready:${T}`)).toHaveLength(1);
    const r2 = adaptPlan({ profile: p, zones, weeks: r.weeks, logs: {}, notes: r.notes, today: T, metrics });
    expect(r2.added).toHaveLength(0);
    expect(r2.weeks).toEqual(r.weeks);
  });
  it('לא נוגע באימון שכבר בוצע, ובלי מדדים לא משנה כלום', () => {
    const done = { [hardDay.id]: { id: 'l', userId: 'me', sessionId: hardDay.id, completed: true, source: 'manual', createdAt: '', updatedAt: '' } as Log };
    expect(run([], done).weeks.flatMap((w) => w.sessions).find((s) => s.id === hardDay.id)?.hard).toBe(true);
    expect(adaptPlan({ profile: p, zones, weeks, logs: {}, notes: [], today: T }).added.filter((n) => n.key.startsWith('ready:'))).toHaveLength(0);
  });
});
