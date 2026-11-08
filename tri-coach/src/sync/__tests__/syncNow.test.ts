import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { profile } from '../../engine/__tests__/helpers';
import { addDays } from '../../lib/dates';
import { createStore, migrate } from '../../store/useStore';
import { idbAdapter } from '../../store/storage';
import { IntervalsProvider } from '../IntervalsProvider';
import { fakeServer } from './fakeServer';

const TODAY = '2026-11-09';
const wait = () => new Promise((r) => setTimeout(r, 30));
let n = 0;
async function setup(srvOpts = {}, activities?: (s: ReturnType<typeof createStore>) => unknown[]) {
  const store = createStore(idbAdapter, `sync-${++n}`);
  await wait();
  store.getState().onboard(profile(), '2026-11-08');
  store.getState().setIntervals({ athleteId: 'i1', apiKey: 'SECRET' });
  const srv = fakeServer({ ...srvOpts });
  if (activities) (srvOpts as any).activities = activities(store);
  const provider = new IntervalsProvider({ apiKey: 'SECRET', athleteId: 'i1' }, srv.fetchImpl);
  return { store, srv, provider };
}

describe('syncIntervals', () => {
  it('מעבר מלא: רישום אוטומטי מפעילות, התאמה, ודחיפת 14 יום; שמירת דוח', async () => {
    const store = createStore(idbAdapter, 'sync-full');
    await wait();
    store.getState().onboard(profile(), '2026-11-08');
    store.getState().setIntervals({ athleteId: 'i1', apiKey: 'SECRET' });
    const first = store.getState().weeks[0].sessions.find((s) => ['run', 'bike', 'swim'].includes(s.discipline))!;
    const srv = fakeServer({ activities: [{ id: 'i77', start_date_local: `${first.date}T07:00:00`, type: first.discipline === 'bike' ? 'Ride' : first.discipline === 'swim' ? 'Swim' : 'Run', moving_time: first.targetMin * 60, distance: 9000, average_heartrate: 148, icu_rpe: 5 }] });
    const provider = new IntervalsProvider({ apiKey: 'SECRET', athleteId: 'i1' }, srv.fetchImpl);

    const rep = await store.getState().syncIntervals({ today: first.date, provider });
    const log = store.getState().logs[first.id];
    expect(log).toMatchObject({ source: 'intervals', activityId: 'i77', completed: true, rpe: 5, avgHr: 148 });
    expect(rep?.pulled.autoLogged).toBe(1);
    expect(rep?.pushed.created).toBeGreaterThan(0);
    // האימון שבוצע לא נדחף
    expect(srv.events.some((e) => e.external_id === `tricoach:${first.id}`)).toBe(false);
    expect(store.getState().settings.intervals?.lastReport?.errors).toEqual([]);
    expect(store.getState().syncing).toBe(false);
  });
  it('הגבלת תדירות: סנכרון אוטומטי אחרי סנכרון טרי מדולג; ידני לא', async () => {
    const { store, srv, provider } = await setup();
    await store.getState().syncIntervals({ today: TODAY, provider });
    const calls = srv.calls.length;
    await store.getState().syncIntervals({ today: TODAY, provider, auto: true });
    expect(srv.calls.length).toBe(calls);
    await store.getState().syncIntervals({ today: TODAY, provider });
    expect(srv.calls.length).toBeGreaterThan(calls);
  });
  it('external_id לא נשמר → סנכרון אוטומטי נעצר עם הודעה', async () => {
    const { store, provider } = await setup({ dropExternalId: true });
    const rep = await store.getState().syncIntervals({ today: TODAY, provider });
    expect(rep?.errors.join(' ')).toContain('כפילויות');
    expect(store.getState().settings.autoSync).toBe(false);
    expect(store.getState().settings.intervals?.idLost).toBe(true);
  });
  it('אחרי external_id lost גם סנכרון ידני אחרי שינוי תוכנית נחסם — בלי כפילויות', async () => {
    const { store, srv, provider } = await setup({ dropExternalId: true });
    await store.getState().syncIntervals({ today: TODAY, provider });
    const count = srv.events.length;
    store.getState().replan({ weeklyHours: 5 }, '2026-11-10'); // משנה אורכי אימונים → שמות חדשים
    const calls = srv.calls.length;
    expect(await store.getState().syncIntervals({ today: TODAY, provider })).toBeUndefined();
    expect(await store.getState().syncIntervals({ today: TODAY, provider, pushOnly: true })).toBeUndefined();
    expect(srv.calls.length).toBe(calls);
    expect(srv.events).toHaveLength(count);
    // חיבור מחדש מנקה את החסימה
    store.getState().setIntervals({ athleteId: 'i1', apiKey: 'SECRET' });
    expect(store.getState().settings.intervals?.idLost).toBeUndefined();
  });
  it('שגיאת 401: מציג הודעה ולא משנה את התוכנית; רשת לא מפילה', async () => {
    const { store, provider } = await setup({ status: 401 });
    const before = JSON.stringify(store.getState().weeks);
    await store.getState().syncIntervals({ today: TODAY, provider });
    expect(store.getState().settings.intervals?.error).toContain('401');
    expect(JSON.stringify(store.getState().weeks)).toBe(before);
    const off = new IntervalsProvider({ apiKey: 'SECRET', athleteId: 'i1' }, fakeServer({ offline: true }).fetchImpl);
    await store.getState().syncIntervals({ today: TODAY, provider: off });
    expect(store.getState().settings.intervals?.error).toContain('אינטרנט');
    expect(store.getState().syncing).toBe(false);
  });
  it('ללא הגדרות — לא עושה כלום', async () => {
    const store = createStore(idbAdapter, 'sync-none');
    await wait();
    store.getState().onboard(profile(), '2026-11-08');
    expect(await store.getState().syncIntervals({ today: TODAY })).toBeUndefined();
  });
  it('שינוי תוכנית (replan) נדחף: היומן מתיישר לאימונים החדשים בחלון', async () => {
    const { store, srv, provider } = await setup();
    await store.getState().syncIntervals({ today: TODAY, provider });
    store.getState().replan({ weeklyHours: 5 }, '2026-11-10');
    const rep = await store.getState().syncIntervals({ today: TODAY, provider, pushOnly: true });
    const end = addDays(TODAY, 13);
    const planned = store.getState().weeks.flatMap((w) => w.sessions).filter((s) => ['swim', 'bike', 'run'].includes(s.discipline) && s.date >= TODAY && s.date <= end);
    expect(rep!.pushed.updated + rep!.pushed.deleted + rep!.pushed.created).toBeGreaterThan(0);
    expect(srv.events.map((e) => e.external_id).sort()).toEqual(planned.map((s) => `tricoach:${s.id}`).sort());
  });
});

describe('store — הגדרות, ייצוא ומיגרציה', () => {
  it('ייצוא JSON לא כולל את מפתח ה-API; ייבוא לא דורס אותו', async () => {
    const { store } = await setup();
    const json = store.getState().exportState();
    expect(json).not.toContain('SECRET');
    store.getState().importState(json);
    expect(store.getState().settings.intervals?.apiKey).toBe('SECRET');
  });
  it('המפתח נשמר ב-IndexedDB וחוזר אחרי טעינה מחדש', async () => {
    const { store } = await setup();
    store.getState().setAutoSync(false);
    await wait();
    const again = createStore(idbAdapter, `sync-${n}`);
    await wait();
    expect(again.getState().settings.intervals?.apiKey).toBe('SECRET');
    expect(again.getState().settings.autoSync).toBe(false);
  });
  it('saveLog על רישום אוטומטי שומר activityId/avgHr/source', async () => {
    const store = createStore(idbAdapter, 'sync-merge');
    await wait();
    store.getState().onboard(profile(), '2026-11-08');
    const s = store.getState().weeks[0].sessions[0];
    store.setState({ logs: { [s.id]: { id: 'L1', userId: 'sync-merge', sessionId: s.id, completed: true, actualMin: 40, avgHr: 150, source: 'intervals', activityId: 'a9', createdAt: 'c', updatedAt: 'c' } } });
    store.getState().saveLog({ sessionId: s.id, completed: true, actualMin: 45, rpe: 7 }, TODAY);
    expect(store.getState().logs[s.id]).toMatchObject({ id: 'L1', avgHr: 150, source: 'intervals', activityId: 'a9', actualMin: 45, rpe: 7, createdAt: 'c' });
  });
  it('מיגרציה מגרסה 1 מוסיפה settings ו-metrics', () => {
    const v1 = { userId: 'me', weeks: [], logs: {}, adaptNotes: [] };
    expect(migrate(v1)).toMatchObject({ metrics: {}, settings: { autoSync: true } });
  });
});
