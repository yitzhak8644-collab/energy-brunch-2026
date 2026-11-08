import { describe, expect, it } from 'vitest';
import { adaptPlan } from '../adapt';
import { generatePlan } from '../generate';
import { peakCapMin } from '../volume';
import { addDays } from '../../lib/dates';
import type { Log } from '../../types';
import { profile } from './helpers';

const p = profile();
const { weeks, zones } = generatePlan(p, '2026-11-08');
const mkLog = (sessionId: string, over: Partial<Log> = {}): Log => ({
  id: 'l-' + sessionId, userId: 'me', sessionId, completed: true, source: 'manual', createdAt: '', updatedAt: '', ...over,
});
const run = (logs: Record<string, Log>, today: string, notes = [] as ReturnType<typeof adaptPlan>['notes']) =>
  adaptPlan({ profile: p, zones, weeks, logs, notes, today });
const week1Start = weeks[1].start;

describe('adaptPlan', () => {
  it('קושי: מפחית שבועות עתידיים ב-10% ולא נוגע בעבר/בשבוע הנוכחי', () => {
    const logs: Record<string, Log> = {};
    weeks[0].sessions.forEach((s, i) => { logs[s.id] = mkLog(s.id, i < 2 ? { completed: false } : { actualMin: Math.round(s.targetMin * 0.5), rpe: 8 }); });
    const r = run(logs, week1Start);
    expect(r.weeks[0]).toEqual(weeks[0]);
    expect(r.weeks[1]).toEqual(weeks[1]);
    expect(r.weeks[3].adjust).toBeCloseTo(0.9);
    expect(r.weeks[3].targetMin).toBeLessThan(weeks[3].targetMin);
    expect(r.added.some((n) => n.key === 'eval:0')).toBe(true);
  });
  it('חזק: מעלה עד +5% בתוך התקרות ו-10% שבוע-על-שבוע', () => {
    const logs: Record<string, Log> = {};
    weeks[0].sessions.forEach((s) => { logs[s.id] = mkLog(s.id, { actualMin: s.targetMin, rpe: Math.max(1, s.plannedRpe - 1) }); });
    const r = run(logs, week1Start);
    expect(r.weeks[5].adjust).toBeCloseTo(1.05);
    let prev: number | undefined;
    for (const w of r.weeks) {
      expect(w.targetMin).toBeLessThanOrEqual(peakCapMin(p));
      if (!w.isRecovery && w.phase !== 'taper') { if (prev) expect(w.targetMin).toBeLessThanOrEqual(Math.round(prev * 1.1) + 1); prev = w.targetMin; }
    }
  });
  it('אידמפוטנטי — הרצה שנייה לא משנה כלום', () => {
    const logs: Record<string, Log> = {};
    weeks[0].sessions.forEach((s, i) => { logs[s.id] = mkLog(s.id, i < 2 ? { completed: false } : { actualMin: Math.round(s.targetMin * 0.5) }); });
    const a = run(logs, week1Start);
    expect(a.added.length).toBeGreaterThan(0);
    const b = adaptPlan({ profile: p, zones, weeks: a.weeks, logs, notes: a.notes, today: week1Start });
    expect(b.weeks).toEqual(a.weeks);
    expect(b.added).toHaveLength(0);
  });
  it('שבועות בלי שום רישום לא מוערכים כ״קושי״ (אין הצטברות הפחתות)', () => {
    const r = run({}, weeks[8].start);
    expect(r.added.some((n) => n.key.startsWith('eval:'))).toBe(false);
    expect(Math.min(...r.weeks.filter((w) => w.start > weeks[8].start).map((w) => w.adjust))).toBeGreaterThanOrEqual(0.7 - 1e-9);
  });
  it('כאב ברמה 2 בברך: ריצות ב-7 הימים הבאים מוחלפות, והשבוע הבא -20%', () => {
    const today = weeks[1].start;
    const logs: Record<string, Log> = { x: mkLog('x', { completed: false, pain: { area: 'ברך', level: 2 } }) };
    weeks[0].sessions.forEach((s) => { logs[s.id] = mkLog(s.id, { actualMin: Math.round(s.targetMin * 0.8), rpe: s.plannedRpe + 1 }); });
    const r = run(logs, today);
    const horizon = addDays(today, 7);
    const runs = r.weeks.flatMap((w) => w.sessions).filter((s) => s.discipline === 'run' && s.date >= today && s.date <= horizon);
    expect(runs).toHaveLength(0);
    expect(r.weeks[2].adjust).toBeCloseTo(0.8);
    expect(r.weeks[0]).toEqual(weeks[0]);
  });
  it('כאב ברמה 3: שלושה ימי מנוחה והמלצה לאיש מקצוע', () => {
    const today = weeks[1].start;
    const logs: Record<string, Log> = { x: mkLog('x', { completed: false, pain: { area: 'כתף', level: 3 } }) };
    weeks[0].sessions.forEach((s) => { logs[s.id] = mkLog(s.id, { actualMin: Math.round(s.targetMin * 0.8), rpe: s.plannedRpe + 1 }); });
    const r = run(logs, today);
    const until = addDays(today, 2);
    expect(r.weeks.flatMap((w) => w.sessions).filter((s) => s.date >= today && s.date <= until)).toHaveLength(0);
    expect(r.added[0].text).toContain('איש מקצוע');
  });
  it('החמצה של 10 ימים: חזרה הדרגתית 70/80/90', () => {
    const today = addDays(weeks[2].start, 3);
    const r = run({}, today);
    const f = r.weeks.filter((w) => w.start > today);
    expect(f[0].adjust).toBeLessThanOrEqual(0.7 + 1e-9);
    expect(f[1].adjust).toBeLessThanOrEqual(0.8 + 1e-9);
    expect(r.added.some((n) => n.key.startsWith('missed:'))).toBe(true);
  });
});
