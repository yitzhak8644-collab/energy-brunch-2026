import { describe, expect, it } from 'vitest';
import { generatePlan } from '../generate';
import { peakCapMin } from '../volume';
import { diffDays, weekday } from '../../lib/dates';
import { profile, days } from './helpers';

const TODAY = '2026-11-08';
const { weeks, zones } = generatePlan(profile(), TODAY);

describe('volume', () => {
  it('אין עלייה >10% לעומת השבוע הטעון הקודם, ו-Peak ≤ תקרה', () => {
    let prev: number | undefined;
    for (const w of weeks) {
      if (w.targetMin > peakCapMin(profile())) throw new Error('over cap ' + w.index);
      if (!w.isRecovery && w.phase !== 'taper') {
        if (prev) expect(w.targetMin).toBeLessThanOrEqual(Math.round(prev * 1.1) + 1);
        prev = w.targetMin;
      }
    }
  });
  it('≤30% מעל ממוצע 4 שבועות קודמים', () => {
    weeks.forEach((w, i) => {
      const pr = weeks.slice(Math.max(0, i - 4), i).map((x) => x.targetMin);
      if (pr.length) expect(w.targetMin).toBeLessThanOrEqual(Math.round((pr.reduce((a, b) => a + b) / pr.length) * 1.3) + 1);
    });
  });
  it('שבוע התאוששות נמוך מהקודם; Taper יורד', () => {
    weeks.filter((w) => w.isRecovery).forEach((w) => expect(w.targetMin).toBeLessThan(weeks[w.index - 1].targetMin));
    const t = weeks.filter((w) => w.phase === 'taper');
    expect(t[0].targetMin).toBeLessThan(weeks[weeks.length - 3].targetMin);
    expect(t[1].targetMin).toBeLessThan(t[0].targetMin);
  });
});

describe('sessions', () => {
  it('כל האימונים בתוך השבוע, בימים זמינים, ויום המרוץ הוא האחרון', () => {
    for (const w of weeks) for (const s of w.sessions) {
      expect(diffDays(s.date, w.start)).toBeGreaterThanOrEqual(0);
      expect(diffDays(s.date, w.end)).toBeLessThanOrEqual(0);
      if (s.discipline !== 'race') expect(profile().availableDays[weekday(s.date)].minutes).toBeGreaterThan(0);
    }
    const last = weeks[weeks.length - 1];
    expect(last.sessions[last.sessions.length - 1]).toMatchObject({ date: '2027-04-09', discipline: 'race' });
  });
  it('יום מנוחה אחד לפחות בכל שבוע מלא, ואימונים קשים לא ביומיים רצופים', () => {
    for (const w of weeks.slice(0, -1)) {
      const dates = new Set(w.sessions.map((s) => s.date));
      expect(dates.size).toBeLessThanOrEqual(6);
      const hard = [...new Set(w.sessions.filter((s) => s.hard).map((s) => s.date))].sort();
      for (let i = 1; i < hard.length; i++) expect(diffDays(hard[i], hard[i - 1])).toBeGreaterThan(1);
    }
  });
  it('אימון ארוך באופניים ביום המועדף; בריק מ-Build', () => {
    const w = weeks[0];
    const long = w.sessions.find((s) => s.discipline === 'bike' && s.title.includes('ארוך'))!;
    expect(weekday(long.date)).toBe(5);
    const build = weeks.find((x) => x.phase === 'build')!;
    expect(build.sessions.some((s) => s.brick)).toBe(true);
  });
  it('כל האימונים כוללים צעדים; חלוקה בין ענפים סבירה', () => {
    for (const w of weeks) for (const s of w.sessions) expect(s.steps.length).toBeGreaterThan(0);
    const m = { swim: 0, bike: 0, run: 0 } as Record<string, number>;
    weeks.slice(0, 18).forEach((w) => w.sessions.forEach((s) => { if (s.discipline in m) m[s.discipline] += s.targetMin; }));
    const tot = m.swim + m.bike + m.run;
    expect(m.swim / tot).toBeGreaterThan(0.12);
    expect(m.bike / tot).toBeGreaterThan(0.35);
    expect(m.run / tot).toBeGreaterThan(0.25);
  });
  it('אזורים: קצב סף ≤ קצב קל, ו-HR zones כשיש maxHr', () => {
    expect(zones.runThreshPace).toBeLessThan(zones.runEasyPace);
    expect(zones.hrZones).toHaveLength(5);
  });
  it('זמינות נמוכה (3 ימים) לא שוברת את התוכנית', () => {
    const p = profile({ availableDays: days({ 1: 60, 3: 60, 5: 120 }), weeklyHours: 4 });
    const g = generatePlan(p, TODAY);
    g.weeks.slice(0, -1).forEach((w) => expect(new Set(w.sessions.map((s) => s.date)).size).toBeLessThanOrEqual(3));
  });
  it('פציעת ריצה פעילה מפחיתה נפח ריצה', () => {
    const base = generatePlan(profile(), TODAY).weeks[10];
    const inj = generatePlan(profile({ injuries: [{ area: 'ברך', severity: 2, active: true }] }), TODAY).weeks[10];
    const run = (w: typeof base) => w.sessions.filter((s) => s.discipline === 'run').reduce((a, s) => a + s.targetMin, 0);
    expect(run(inj)).toBeLessThan(run(base));
  });
});
