import { describe, expect, it } from 'vitest';
import { generatePlan } from '../../engine/generate';
import { profile } from '../../engine/__tests__/helpers';
import { addDays } from '../../lib/dates';
import type { Session, WorkoutStep, Zones } from '../../types';
import { IntervalsError, IntervalsProvider } from '../IntervalsProvider';
import { formatDuration, sessionToIntervalsText } from '../intervalsText';
import { fakeServer } from './fakeServer';

const TODAY = '2026-11-09';
const { weeks, zones } = generatePlan(profile(), '2026-11-08');
const sessions = weeks.flatMap((w) => w.sessions);
const inWindow = (s: Session) => s.date >= TODAY && s.date <= addDays(TODAY, 13) && ['swim', 'bike', 'run'].includes(s.discipline);
const N = sessions.filter(inWindow).length;
const mk = (srv = fakeServer()) => ({ srv, p: new IntervalsProvider({ apiKey: 'KEY', athleteId: 'i1' }, srv.fetchImpl) });

const sess = (discipline: Session['discipline'], steps: WorkoutStep[]): Session => ({
  id: 'x', userId: 'me', date: TODAY, discipline, title: 'כותרת', targetMin: 60, intensity: 'Z2', plannedRpe: 4, hard: false, steps,
});
const P = (low: number, high: number) => ({ type: 'pace' as const, low, high });

describe('פורמט האימון (Workout Builder Syntax)', () => {
  it('ריצה: Warmup / Main Set Nx עם שורות ריקות / Cooldown, קצב מוחלט ומהיר קודם', () => {
    const t = sessionToIntervalsText(sess('run', [
      { kind: 'warmup', durationSec: 600, target: P(410, 440) },
      { kind: 'repeat', repeat: 4, children: [{ kind: 'work', durationSec: 480, target: P(370, 385) }, { kind: 'recover', durationSec: 120, target: P(440, 460) }] },
      { kind: 'cooldown', durationSec: 300, target: P(410, 440) },
    ]), zones);
    expect(t).toBe('## כותרת\n\nWarmup\n- 10m 6:50/km-7:20/km Pace\n\nMain Set 4x\n- 8m 6:10/km-6:25/km Pace\n- 2m 7:20/km-7:40/km Pace\n\nCooldown\n- 5m 6:50/km-7:20/km Pace');
  });
  it('שחייה: מטרים הם mtr (לא m), ק״מ שלם, מנוחה בלי יעד, קצב /100m', () => {
    const t = sessionToIntervalsText(sess('swim', [
      { kind: 'warmup', distanceM: 400, target: P(120, 130) },
      { kind: 'repeat', repeat: 6, children: [{ kind: 'work', distanceM: 100, target: P(110, 115) }, { kind: 'recover', durationSec: 20 }] },
      { kind: 'work', distanceM: 1500, target: P(115, 120) },
    ]), zones);
    expect(t).toContain('- 400mtr 2:00/100m-2:10/100m Pace');
    expect(t).toContain('Main Set 6x\n- 100mtr 1:50/100m-1:55/100m Pace\n- 20s');
    expect(t).toContain('- 1.5km 1:55/100m-2:00/100m Pace');
  });
  it('אופניים: דופק כאחוזי מקס׳ (מ-hrZones), ובלי דופק — בלי יעד', () => {
    const z: Zones = { ...zones, hrZones: [[95, 114], [114, 133], [133, 152], [152, 171], [171, 190]] };
    const hr = sess('bike', [{ kind: 'work', durationSec: 1200, target: { type: 'hr', low: 130, high: 150 } }]);
    expect(sessionToIntervalsText(hr, z)).toContain('- 20m 68-79% HR');
    const rpe = sess('bike', [{ kind: 'work', durationSec: 1200, target: { type: 'rpe', low: 3, high: 4 } }]);
    expect(sessionToIntervalsText(rpe, z)).toContain('- 20m\n'.trim());
    expect(sessionToIntervalsText(rpe, z)).not.toMatch(/HR|Pace/);
  });
  it('משכים בשלמים בלבד, חזרות מקוננות נזרקות', () => {
    expect(formatDuration(3600)).toBe('1h');
    expect(formatDuration(5400)).toBe('1h30m');
    expect(formatDuration(2052)).toBe('34m12s');
    expect(formatDuration(19.6)).toBe('20s');
    expect(() => sessionToIntervalsText(sess('run', [{ kind: 'repeat', repeat: 2, children: [{ kind: 'repeat', repeat: 2, children: [] }] }]), zones)).toThrow();
  });
  it('כל האימונים בתוכנית המלאה מייצרים שורות צעד תקינות', () => {
    const re = /^- (?:(?:\d+h)?(?:\d+m)?(?:\d+s)?|\d+mtr|\d+(?:\.\d+)?km)(?: .*)?$/;
    for (const s of sessions) {
      if (!['swim', 'bike', 'run'].includes(s.discipline)) continue;
      const text = sessionToIntervalsText(s, zones);
      expect(text).toMatch(/Warmup|Main Set/);
      for (const l of text.split('\n').filter((x) => x.startsWith('- '))) expect(l, s.title).toMatch(re);
    }
  });
});

describe('IntervalsProvider — משיכה', () => {
  it('Basic auth עם API_KEY ופרמטרים נכונים', async () => {
    const { srv, p } = mk();
    await p.pullActivities('2026-10-01');
    const c = srv.calls[0];
    expect(c.headers.Authorization).toBe(`Basic ${btoa('API_KEY:KEY')}`);
    expect(c.path).toBe('/activities');
    expect(c.query.get('oldest')).toBe('2026-10-01');
  });
  it('מסנן Strava ריק, ממפה סוגים ולוקח icu_rpe (לא feel)', async () => {
    const { p } = mk(fakeServer({ activities: [
      { id: 'i1', start_date_local: '2026-11-02T07:10:00', type: 'VirtualRun', moving_time: 2400, distance: 7000, average_heartrate: 150, max_heartrate: 171, icu_rpe: 6, feel: 2 },
      { id: 'i2', start_date_local: '2026-11-03T07:10:00', type: 'OpenWaterSwim', moving_time: 1800, distance: 1200 },
      { id: 'i3' }, { id: 'i4', start_date_local: '2026-11-04T07:10:00', type: 'GravelRide', moving_time: 3600, distance: 30000 },
      { id: 'i5', start_date_local: '2026-11-04T09:10:00', type: 'Yoga', moving_time: 3600 },
    ] }));
    const a = await p.pullActivities('2026-10-01');
    expect(a.map((x) => [x.id, x.sport])).toEqual([['i1', 'run'], ['i2', 'swim'], ['i4', 'bike'], ['i5', 'other']]);
    expect(a[0]).toMatchObject({ rpe: 6, avgHr: 150, start: '2026-11-02', distanceM: 7000 });
    expect(a[1].rpe).toBeUndefined();
  });
  it('מדדי wellness', async () => {
    const { p } = mk(fakeServer({ wellness: [{ id: '2026-11-08', restingHR: 52, hrv: 61.5, sleepSecs: 27000 }] }));
    expect(await p.pullMetrics('2026-10-01', TODAY)).toEqual([{ date: '2026-11-08', restingHr: 52, hrv: 61.5, sleepHours: 7.5, readiness: undefined }]);
  });
  it('שגיאות: 401 → auth, 404 → notfound, רשת → network', async () => {
    const kinds: string[] = [];
    for (const o of [{ status: 401 }, { status: 404 }, { offline: true }]) {
      try { await mk(fakeServer(o)).p.pullActivities('2026-10-01'); } catch (e) { kinds.push((e as IntervalsError).kind); }
    }
    expect(kinds).toEqual(['auth', 'notfound', 'network']);
  });
  it('בדיקת חיבור: שם הספורטאי, ו-wellness שנכשל לא מפיל את הבדיקה', async () => {
    expect(await mk().p.testConnection(TODAY)).toEqual({ athleteName: 'Test Athlete', wellnessOk: true });
    expect((await mk(fakeServer({ wellnessStatus: 404 })).p.testConnection(TODAY)).wellnessOk).toBe(false);
  });
});

describe('IntervalsProvider — דחיפה (התאמה מפורשת)', () => {
  const push = (p: IntervalsProvider, list = sessions, known: Record<string, string> = {}) => p.pushWorkouts(list, { zones, today: TODAY, known });

  it('סנכרון ראשון יוצר את כל אימוני 14 הימים; השני לא עושה כלום (בלי POST/PUT)', async () => {
    const { srv, p } = mk();
    const r1 = await push(p);
    expect(r1.created).toBe(N);
    expect(srv.events).toHaveLength(N);
    expect(srv.events.every((e) => e.external_id.startsWith('tricoach:') && e.category === 'WORKOUT')).toBe(true);
    expect(srv.calls.find((c) => c.path === '/events')?.query.get('newest')).toBe(addDays(TODAY, 13));
    const before = srv.calls.length;
    const r2 = await push(p, sessions, r1.known);
    expect(r2).toMatchObject({ created: 0, updated: 0, deleted: 0, unchanged: N });
    expect(srv.calls.slice(before).every((c) => c.method === 'GET')).toBe(true);
    expect(srv.events).toHaveLength(N);
  });
  it('שינוי אימון → עדכון אחד; אימון שהוסר → מחיקה; אירועים זרים ועבר לא נוגעים', async () => {
    const { srv, p } = mk();
    const r1 = await push(p);
    srv.events.push({ id: 900, name: 'My own ride', category: 'WORKOUT', type: 'Ride', start_date_local: `${addDays(TODAY, 2)}T00:00:00`, external_id: 'other:1' });
    srv.events.push({ id: 901, name: 'old', category: 'WORKOUT', type: 'Run', start_date_local: '2026-11-01T00:00:00', external_id: 'tricoach:old' });
    const list = sessions.filter((s) => inWindow(s));
    const changed = list.map((s, i) => (i === 0 ? { ...s, title: 'שונה', steps: [{ kind: 'work' as const, durationSec: 600 }] } : s)).slice(0, -1);
    const r2 = await push(p, changed, r1.known);
    expect(r2.updated).toBe(1);
    expect(r2.deleted).toBe(1);
    expect(srv.events.some((e) => e.id === 900)).toBe(true);
    expect(srv.events.some((e) => e.id === 901)).toBe(true);
    expect(srv.events).toHaveLength(N - 1 + 2);
  });
  it('אימון שבוצע לא נדחף מחדש אבל גם לא נמחק מהיומן (keep); אימון שהוסר מהתוכנית נמחק', async () => {
    const { srv, p } = mk();
    const r1 = await push(p);
    const [done, dropped] = sessions.filter(inWindow);
    const rest = sessions.filter((s) => s.id !== done.id && s.id !== dropped.id);
    const r2 = await p.pushWorkouts(rest, { zones, today: TODAY, known: r1.known, keep: [`tricoach:${done.id}`] });
    expect(r2.deleted).toBe(1);
    expect(srv.events.some((e) => e.external_id === `tricoach:${done.id}`)).toBe(true);
    expect(srv.events.some((e) => e.external_id === `tricoach:${dropped.id}`)).toBe(false);
  });
  it('external_id לא נשמר → externalIdLost, והסנכרון הבא מאמץ לפי תאריך+סוג+שם בלי כפילויות', async () => {
    const { srv, p } = mk(fakeServer({ dropExternalId: true }));
    const r1 = await push(p);
    expect(r1.externalIdLost).toBe(true);
    expect(srv.events).toHaveLength(N);
    const r2 = await push(p, sessions, r1.known);
    expect(r2.created).toBe(0);
    expect(srv.events).toHaveLength(N);
  });
  it('שגיאות Garmin מאירועים מדווחות', async () => {
    const { srv, p } = mk();
    await push(p);
    srv.events[0].push_errors = [{ service: 'GARMIN_CONNECT', message: 'Workout too long', date: '2026-11-09T01:00:00Z' }];
    const r = await push(p, sessions);
    expect(r.pushErrors).toEqual([{ name: srv.events[0].name, date: srv.events[0].start_date_local.slice(0, 10), message: 'GARMIN_CONNECT: Workout too long' }]);
  });
  it('אימון בדיקה: נוצר, נקרא חזרה ונמחק', async () => {
    const { srv, p } = mk();
    const r = await p.sendTestWorkout(addDays(TODAY, 1));
    expect(r.steps).toBe(2);
    expect(srv.events).toHaveLength(0);
  });
});
