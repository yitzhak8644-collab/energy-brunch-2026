import { Encoder, Profile as FitProfile } from '@garmin/fitsdk';
import type { Session, WorkoutStep } from '../types';

type Sport = 'running' | 'cycling' | 'swimming';
const put = (e: Encoder, num: number, m: Record<string, unknown>) => e.onMesg(num, m as never);
const SPORT: Record<string, Sport> = { run: 'running', bike: 'cycling', swim: 'swimming' };
const INTENSITY: Record<string, string> = { warmup: 'warmup', work: 'active', recover: 'recovery', cooldown: 'cooldown' };

interface FitStep { [k: string]: unknown }

function paceToSpeedMs(sec: number, perMeters: number) { return perMeters / sec; }

function stepMesg(s: WorkoutStep, idx: number, discipline: 'run' | 'bike' | 'swim'): FitStep {
  const m: FitStep = { messageIndex: idx, intensity: INTENSITY[s.kind] ?? 'active' };
  if (s.label) m.notes = clipBytes(s.label, 50);
  if (s.distanceM) { m.durationType = 'distance'; m.durationValue = Math.round(s.distanceM * 100); }
  else { m.durationType = 'time'; m.durationValue = Math.round((s.durationSec ?? 0) * 1000); }
  const t = s.target;
  if (t?.type === 'pace' && t.low && t.high && discipline !== 'bike') {
    const per = discipline === 'swim' ? 100 : 1000;
    m.targetType = 'speed';
    m.targetValue = 0;
    m.customTargetValueLow = Math.round(paceToSpeedMs(t.high, per) * 1000); // איטי = מהירות נמוכה
    m.customTargetValueHigh = Math.round(paceToSpeedMs(t.low, per) * 1000);
  } else if (t?.type === 'hr' && t.low && t.high) {
    m.targetType = 'heartRate';
    m.targetValue = 0;
    m.customTargetValueLow = Math.round(t.low) + 100; // ב-FIT דופק מוזז ב-100
    m.customTargetValueHigh = Math.round(t.high) + 100;
  } else {
    m.targetType = 'open';
    m.targetValue = 0;
  }
  return m;
}

function clipBytes(str: string, max: number): string {
  const enc = new TextEncoder();
  let out = '';
  for (const ch of str) {
    if (enc.encode(out + ch).length > max) break;
    out += ch;
  }
  return out;
}

function flatten(steps: WorkoutStep[], d: 'run' | 'bike' | 'swim', out: FitStep[] = []): FitStep[] {
  for (const s of steps) {
    if (s.kind === 'repeat') {
      const first = out.length;
      flatten(s.children ?? [], d, out);
      out.push({ messageIndex: out.length, durationType: 'repeatUntilStepsCmplt', durationValue: first, targetType: 'open', targetValue: s.repeat ?? 1 });
    } else out.push(stepMesg(s, out.length, d));
  }
  return out;
}

export function fitFileName(s: Session): string {
  return `${s.date}-${s.discipline}.fit`;
}

/** מייצר קובץ FIT של אימון מובנה (Workout) מ-Session. מרוץ אינו נתמך. */
export function sessionToFit(session: Session, opts: { poolLength?: 25 | 50 } = {}): Uint8Array {
  if (session.discipline === 'race' || session.discipline === 'rest') throw new Error('לא ניתן לייצא אימון מסוג זה');
  const d = session.discipline;
  const steps = flatten(session.steps, d);
  const enc = new Encoder();
  put(enc, FitProfile.MesgNum.FILE_ID, { type: 'workout', manufacturer: 'development', product: 0, serialNumber: 1, timeCreated: new Date() });
  const wkt: Record<string, unknown> = {
    sport: SPORT[d], capabilities: 32, numValidSteps: steps.length,
    wktName: clipBytes(`${d} ${session.date}`, 15),
  };
  if (d === 'swim') { wkt.subSport = 'lapSwimming'; wkt.poolLength = opts.poolLength ?? 25; wkt.poolLengthUnit = 'metric'; }
  put(enc, FitProfile.MesgNum.WORKOUT, wkt);
  for (const st of steps) put(enc, FitProfile.MesgNum.WORKOUT_STEP, st);
  return enc.close();
}
