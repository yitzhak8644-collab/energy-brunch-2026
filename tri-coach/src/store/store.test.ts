import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { createStore } from './useStore';
import { idbAdapter } from './storage';
import { profile } from '../engine/__tests__/helpers';

describe('store', () => {
  it('מחכה להידרציה לפני שהוא מוכן, ושומר/טוען מחדש מ-IndexedDB', async () => {
    const a = createStore(idbAdapter, 'u1');
    await new Promise((r) => setTimeout(r, 50));
    expect(a.getState().hydrated).toBe(true);
    expect(a.getState().profile).toBeUndefined();
    a.getState().onboard(profile(), '2026-11-08');
    expect(a.getState().weeks).toHaveLength(22);
    await new Promise((r) => setTimeout(r, 50));

    const b = createStore(idbAdapter, 'u1');
    expect(b.getState().profile).toBeUndefined(); // עדיין לא נטען
    await new Promise((r) => setTimeout(r, 50));
    expect(b.getState().hydrated).toBe(true);
    expect(b.getState().weeks).toHaveLength(22);
    expect(b.getState().profile?.userId).toBe('u1');
  });
  it('רישום אימון יוצר Log עם id וחותמות זמן ומפעיל התאמה', async () => {
    const s = createStore(idbAdapter, 'u2');
    await new Promise((r) => setTimeout(r, 50));
    s.getState().onboard(profile(), '2026-11-08');
    const first = s.getState().weeks[0].sessions[0];
    s.getState().saveLog({ sessionId: first.id, completed: true, actualMin: 40, rpe: 5 }, '2026-11-09');
    const log = s.getState().logs[first.id];
    expect(log).toMatchObject({ userId: 'u2', completed: true, actualMin: 40, source: 'manual' });
    expect(log.id).toBeTruthy();
    expect(log.createdAt).toBeTruthy();
  });
  it('replan שומר שבועות עבר ומחשב קדימה לפי תאריך מרוץ חדש', async () => {
    const s = createStore(idbAdapter, 'u3');
    await new Promise((r) => setTimeout(r, 50));
    s.getState().onboard(profile(), '2026-11-08');
    s.getState().replan({ raceDate: '2027-03-12' }, '2026-12-01');
    const w = s.getState().weeks;
    expect(w[w.length - 1].end).toBe('2027-03-12');
    expect(w[0].start).toBe('2026-11-09');
    expect(w.map((x) => x.index)).toEqual(w.map((_, i) => i));
  });
});
