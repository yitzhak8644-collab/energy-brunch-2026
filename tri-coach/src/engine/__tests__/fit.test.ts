import { describe, expect, it } from 'vitest';
import { Decoder, Encoder, Profile as FP, Stream } from '@garmin/fitsdk';
import { sessionToFit } from '../toFit';
import { generatePlan } from '../generate';
import { calibrate, type ImportedActivity } from '../calibrate';
import { parseFitActivity } from '../../lib/fitImport';
import { profile } from './helpers';

type M = Record<string, Record<string, unknown>[]>;
const put = (e: Encoder, n: number, m: Record<string, unknown>) => e.onMesg(n, m as never);

const { weeks } = generatePlan(profile(), '2026-11-08');
const find = (d: string) => weeks.flatMap((w) => w.sessions).find((s) => s.discipline === d && s.steps.some((x) => x.kind === 'repeat'))!;

describe('toFit', () => {
  for (const d of ['run', 'bike', 'swim'] as const) {
    it(`אימון ${d} מתפענח חזרה עם צעדים, חזרות ויעדים`, () => {
      const s = find(d);
      const bytes = sessionToFit(s, { poolLength: 25 });
      const dec = new Decoder(Stream.fromByteArray(bytes));
      expect(dec.checkIntegrity()).toBe(true);
      const res = dec.read();
      const errors = res.errors;
      const messages = res.messages as unknown as M;
      expect(errors).toHaveLength(0);
      expect(messages.fileIdMesgs[0].type).toBe('workout');
      const steps = messages.workoutStepMesgs as Record<string, unknown>[];
      expect(messages.workoutMesgs[0].numValidSteps).toBe(steps.length);
      expect(steps.some((x) => x.durationType === 'repeatUntilStepsCmplt')).toBe(true);
      const targeted = steps.find((x) => x.targetType === 'speed' || x.targetType === 'heartRate');
      expect(targeted).toBeTruthy();
      if (d === 'swim') expect(messages.workoutMesgs[0].sport).toBe('swimming');
    });
  }
  it('יעד קצב: הגבול התחתון איטי מהעליון', () => {
    const s = find('run');
    const messages = new Decoder(Stream.fromByteArray(sessionToFit(s))).read().messages as unknown as M;
    const st = (messages.workoutStepMesgs as Record<string, number>[]).find((x) => x.customTargetSpeedLow)!;
    expect(st.customTargetSpeedLow).toBeLessThan(st.customTargetSpeedHigh);
    expect(st.customTargetSpeedHigh).toBeLessThan(6); // מ/ש — ריצה
  });
  it('מרוץ לא ניתן לייצוא', () => {
    const race = weeks[weeks.length - 1].sessions.at(-1)!;
    expect(() => sessionToFit(race)).toThrow();
  });
});

function activityFit(sport: string, start: Date, secs: number, meters: number, hr = 150): Uint8Array {
  const e = new Encoder();
  put(e, FP.MesgNum.FILE_ID, { type: 'activity', manufacturer: 'development', product: 0, timeCreated: start });
  put(e, FP.MesgNum.SESSION, { sport, startTime: start, totalElapsedTime: secs, totalTimerTime: secs, totalDistance: meters, avgHeartRate: hr, maxHeartRate: hr + 30, timestamp: new Date(start.getTime() + secs * 1000) });
  return e.close();
}

describe('fitImport + calibrate', () => {
  it('מפענח session של FIT סינתטי', () => {
    const a = parseFitActivity(activityFit('running', new Date('2026-10-20T06:00:00Z'), 1800, 5000));
    expect(a).toHaveLength(1);
    expect(a[0]).toMatchObject({ sport: 'run', start: '2026-10-20', distanceM: 5000 });
    expect(parseFitActivity(new Uint8Array([1, 2, 3]))).toEqual([]);
  });
  const mk = (sport: ImportedActivity['sport'], start: string, secs: number, m: number): ImportedActivity =>
    ({ id: start + sport + m, sport, start, durationSec: secs, distanceM: m, maxHr: 180 });
  const acts = [
    mk('swim', '2026-10-01', 1800, 1500), mk('swim', '2026-10-08', 1500, 1200), mk('swim', '2026-10-15', 600, 400),
    mk('bike', '2026-10-04', 7200, 50_000), mk('bike', '2026-10-11', 5400, 36_000), mk('bike', '2026-09-20', 3600, 10_000),
    mk('run', '2026-10-05', 3000, 10_000), mk('run', '2026-10-12', 1500, 5000), mk('run', '2026-10-19', 1200, 3000),
    mk('swim', '2025-01-01', 1000, 1500),
  ];
  it('מכייל שחייה/אופניים/ריצה ונפח שבועי, ומתעלם מנתונים ישנים', () => {
    const c = calibrate(acts, '2026-11-08');
    expect(c.patch.swimPace1k).toBe(Math.round(((1800 / 1500) * 100) * 0.98)); // הקצב הטוב ביותר 120 → 117.6
    expect(c.patch.bikeLongestKm).toBe(50);
    expect(c.patch.bikeAvgKmh).toBeGreaterThan(24);
    expect(c.patch.run5kSec).toBeLessThan(1500);
    expect(c.patch.run10kSec).toBeLessThan(3000 + 1);
    expect(c.patch.source).toBe('fit-import');
    expect(c.summary.swims).toBe(3);
  });
  it('בלי נתונים — אין patch', () => {
    expect(calibrate([], '2026-11-08').patch).toEqual({});
  });
});
