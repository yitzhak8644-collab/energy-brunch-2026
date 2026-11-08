import type { Intensity, Phase, Profile, StepTarget, WorkoutStep, Zones } from '../types';

export type Role = 'long' | 'quality' | 'aerobic' | 'easy';
export type TplDiscipline = 'swim' | 'bike' | 'run';

export interface Built {
  title: string;
  steps: WorkoutStep[];
  intensity: Intensity;
  plannedRpe: number;
  hard: boolean;
}

interface Ctx {
  phase: Phase;
  role: Role;
  min: number;
  zones: Zones;
  profile: Profile;
  brickRun?: boolean;
}

const sec = (min: number) => Math.round(min * 60);
const time = (kind: WorkoutStep['kind'], min: number, label: string, target?: StepTarget, speedKmh?: number): WorkoutStep => ({
  kind, label, durationSec: sec(min), target, speedKmh,
});
const dist = (kind: WorkoutStep['kind'], m: number, label: string, target?: StepTarget): WorkoutStep => ({
  kind, label, distanceM: m, target,
});
const rep = (n: number, children: WorkoutStep[]): WorkoutStep => ({ kind: 'repeat', repeat: n, children });
const paceT = (p: number, tol = 0.03): StepTarget => ({ type: 'pace', low: Math.round(p * (1 - tol)), high: Math.round(p * (1 + tol)) });
const effort = (z: Zones, zone: 1 | 2 | 3 | 4 | 5, rpe: [number, number]): StepTarget => {
  const hz = z.hrZones?.[zone - 1];
  return hz ? { type: 'hr', low: hz[0], high: hz[1] } : { type: 'rpe', low: rpe[0], high: rpe[1] };
};
const roundTo = (n: number, step: number) => Math.max(step, Math.round(n / step) * step);

// ───────── שחייה ─────────
function swim(c: Ctx): Built {
  const { zones: z, profile: p, min, phase, role } = c;
  const css = z.cssPer100;
  const easy = css * 1.12;
  const poolStep = p.poolLength;
  const metersAt = (m: number, pace: number) => roundTo((m * 60) / pace * 100, poolStep);
  const warm = roundTo(Math.min(400, metersAt(min * 0.18, easy)), 50);
  const cool = roundTo(Math.min(300, metersAt(min * 0.1, easy)), 50);
  const mainMin = Math.max(5, min - min * 0.28);

  if (phase === 'taper') {
    return {
      title: 'שחייה — חידוד קצר', intensity: 'Z3', plannedRpe: 5, hard: false,
      steps: [dist('warmup', warm, 'חימום קל', paceT(easy)), rep(6, [dist('work', 50, '50 מ׳ מהיר', paceT(css * 0.96)), time('recover', 0.33, 'מנוחה 20 שנ׳')]), dist('cooldown', cool, 'קירור', paceT(easy))],
    };
  }
  if (role === 'quality' && phase === 'base') {
    const n = Math.max(4, Math.min(12, Math.floor(metersAt(mainMin * 0.4, easy) / 50)));
    return {
      title: 'שחייה — טכניקה ואירובי', intensity: 'Z2', plannedRpe: 4, hard: false,
      steps: [dist('warmup', warm, 'חימום', paceT(easy)), rep(n, [dist('work', 50, 'תרגילי טכניקה', paceT(easy)), time('recover', 0.25, 'מנוחה 15 שנ׳')]), dist('work', metersAt(mainMin * 0.5, easy), 'שחייה רציפה נוחה', paceT(css * 1.1)), dist('cooldown', cool, 'קירור', paceT(easy))],
    };
  }
  if (role === 'quality' && phase === 'build') {
    const n = Math.max(4, Math.min(16, Math.floor(metersAt(mainMin, css * 1.05) / 100)));
    return {
      title: 'שחייה — אינטרוולי CSS', intensity: 'Z4', plannedRpe: 7, hard: true,
      steps: [dist('warmup', warm, 'חימום', paceT(easy)), rep(n, [dist('work', 100, '100 מ׳ בקצב CSS', paceT(css, 0.02)), time('recover', 0.25, 'מנוחה 15 שנ׳')]), dist('cooldown', cool, 'קירור', paceT(easy))],
    };
  }
  if (role === 'quality') {
    const total = Math.min(1500, metersAt(mainMin, css * 1.04));
    return {
      title: 'שחייה — קצב מרוץ', intensity: 'Z3', plannedRpe: 6, hard: true,
      steps: [dist('warmup', warm, 'חימום', paceT(easy)), dist('work', roundTo(total, 50), 'שחייה רציפה בקצב מרוץ', paceT(css * 1.02, 0.02)), dist('cooldown', cool, 'קירור', paceT(easy))],
    };
  }
  return {
    title: 'שחייה — סיבולת אירובית', intensity: 'Z2', plannedRpe: 4, hard: false,
    steps: [dist('warmup', warm, 'חימום', paceT(easy)), dist('work', metersAt(mainMin, easy), 'שחייה רציפה נוחה', paceT(css * 1.1)), dist('cooldown', cool, 'קירור', paceT(easy))],
  };
}

// ───────── אופניים ─────────
function bike(c: Ctx): Built {
  const { zones: z, min, phase, role } = c;
  const E = z.bikeEasyKmh, T = z.bikeTempoKmh, R = z.bikeRaceKmh;
  const z2 = effort(z, 2, [3, 4]), z3 = effort(z, 3, [5, 6]), z4 = effort(z, 4, [6, 7]), z1 = effort(z, 1, [2, 3]);
  const warm = Math.min(15, Math.max(8, Math.round(min * 0.15)));
  const cool = 5;
  const main = Math.max(5, min - warm - cool);

  if (phase === 'taper') {
    const mainTaper = Math.max(5, min - 15);
    return {
      title: 'אופניים — פתיחה קלה', intensity: 'Z2', plannedRpe: 4, hard: false,
      steps: [time('warmup', 10, 'חימום', z2, E), time('work', mainTaper * 0.6, 'רכיבה נוחה', z2, E), rep(3, [time('work', 1, 'דקה חזקה', z4, R), time('recover', 2, 'התאוששות', z1, E)]), time('cooldown', 5, 'קירור', z1, E)],
    };
  }
  if (role === 'long') {
    const blocks = phase === 'peak' ? 2 : phase === 'build' ? 2 : 0;
    const blockMin = phase === 'peak' ? 15 : 12;
    if (blocks && main > blocks * (blockMin + 8) + 10) {
      const easyRest = main - blocks * (blockMin + 5);
      return {
        title: phase === 'peak' ? 'אופניים — ארוך עם קצב מרוץ' : 'אופניים — ארוך עם טמפו', intensity: 'mixed', plannedRpe: 5, hard: false,
        steps: [time('warmup', warm, 'חימום', z2, E), time('work', easyRest / 2, 'סיבולת', z2, E), rep(blocks, [time('work', blockMin, phase === 'peak' ? 'קצב מרוץ' : 'טמפו', phase === 'peak' ? z4 : z3, phase === 'peak' ? R : T), time('recover', 5, 'התאוששות', z1, E)]), time('work', easyRest / 2, 'סיבולת', z2, E), time('cooldown', cool, 'קירור', z1, E)],
      };
    }
    return { title: 'אופניים — ארוך סיבולת', intensity: 'Z2', plannedRpe: 4, hard: false, steps: [time('warmup', warm, 'חימום', z2, E), time('work', main, 'סיבולת אירובית קבועה', z2, E), time('cooldown', cool, 'קירור', z1, E)] };
  }
  if (role === 'quality') {
    if (phase === 'base') {
      return { title: 'אופניים — סיבולת וקדנס', intensity: 'Z2', plannedRpe: 4, hard: false, steps: [time('warmup', warm, 'חימום', z2, E), rep(4, [time('work', 1, 'קדנס גבוה', z3, E), time('recover', 4, 'נוח', z2, E)]), time('work', Math.max(5, main - 20), 'סיבולת', z2, E), time('cooldown', cool, 'קירור', z1, E)] };
    }
    if (phase === 'build') {
      const n = Math.max(3, Math.min(6, Math.floor(main / 8)));
      return { title: 'אופניים — אינטרוולי טמפו', intensity: 'Z4', plannedRpe: 7, hard: true, steps: [time('warmup', warm, 'חימום', z2, E), rep(n, [time('work', 5, 'טמפו חזק', z4, T), time('recover', 3, 'התאוששות', z1, E)]), time('cooldown', cool, 'קירור', z1, E)] };
    }
    const n = Math.max(2, Math.min(4, Math.floor(main / 15)));
    return { title: 'אופניים — קצב מרוץ', intensity: 'Z4', plannedRpe: 7, hard: true, steps: [time('warmup', warm, 'חימום', z2, E), rep(n, [time('work', 10, 'קצב מרוץ', z4, R), time('recover', 5, 'התאוששות', z1, E)]), time('cooldown', cool, 'קירור', z1, E)] };
  }
  return { title: 'אופניים — רכיבה קלה', intensity: role === 'easy' ? 'Z1' : 'Z2', plannedRpe: 3, hard: false, steps: [time('warmup', 5, 'חימום', z1, E), time('work', Math.max(5, min - 10), 'רכיבה קלה', role === 'easy' ? z1 : z2, E), time('cooldown', 5, 'קירור', z1, E)] };
}

// ───────── ריצה ─────────
function run(c: Ctx): Built {
  const { zones: z, min, phase, role } = c;
  const E = z.runEasyPace, T = z.runThreshPace, R = z.runRacePace;
  const warm = Math.min(10, Math.max(5, Math.round(min * 0.15)));
  const cool = 5;
  const main = Math.max(5, min - warm - cool);

  if (c.brickRun) {
    return { title: 'ריצה אחרי אופניים (Brick)', intensity: 'Z3', plannedRpe: 6, hard: true, steps: [time('work', min, 'ריצה בקצב מרוץ — רגליים כבדות בהתחלה זה נורמלי', paceT(R * 1.02))] };
  }
  if (phase === 'taper') {
    return { title: 'ריצה — חידוד קצר', intensity: 'Z3', plannedRpe: 5, hard: false, steps: [time('warmup', warm, 'חימום', paceT(E)), time('work', Math.max(5, main - 6), 'ריצה קלה', paceT(E)), rep(4, [time('work', 0.33, 'האצה 20 שנ׳', paceT(R * 0.95)), time('recover', 0.67, 'הליכה/ג׳וג', paceT(E * 1.1))]), time('cooldown', cool, 'קירור', paceT(E))] };
  }
  if (role === 'long') {
    if (phase === 'peak' && main > 35) {
      return { title: 'ריצה — ארוכה עם קצב מרוץ', intensity: 'mixed', plannedRpe: 5, hard: false, steps: [time('warmup', warm, 'חימום', paceT(E)), time('work', main - 20, 'ריצה קלה', paceT(E)), time('work', 20, 'קצב מרוץ 10 ק״מ', paceT(R)), time('cooldown', cool, 'קירור', paceT(E))] };
    }
    if (phase === 'build' && main > 40) {
      return { title: 'ריצה — ארוכה עם סיום מהיר', intensity: 'mixed', plannedRpe: 5, hard: false, steps: [time('warmup', warm, 'חימום', paceT(E)), time('work', main - 12, 'ריצה קלה', paceT(E)), time('work', 12, 'סיום בקצב בינוני', paceT((E + T) / 2)), time('cooldown', cool, 'קירור', paceT(E))] };
    }
    return { title: 'ריצה — ארוכה סיבולת', intensity: 'Z2', plannedRpe: 4, hard: false, steps: [time('warmup', warm, 'חימום', paceT(E)), time('work', main, 'ריצה אירובית נוחה', paceT(E)), time('cooldown', cool, 'קירור', paceT(E))] };
  }
  if (role === 'quality') {
    if (phase === 'base') {
      return { title: 'ריצה — קלה עם האצות', intensity: 'Z2', plannedRpe: 4, hard: false, steps: [time('warmup', warm, 'חימום', paceT(E)), time('work', Math.max(5, main - 6), 'ריצה קלה', paceT(E)), rep(6, [time('work', 0.33, 'האצה 20 שנ׳', paceT(R * 0.95)), time('recover', 0.67, 'ג׳וג', paceT(E * 1.1))]), time('cooldown', cool, 'קירור', paceT(E))] };
    }
    if (phase === 'build') {
      const n = Math.max(2, Math.min(4, Math.floor(main / 11)));
      return { title: 'ריצה — טמפו', intensity: 'Z4', plannedRpe: 7, hard: true, steps: [time('warmup', warm, 'חימום', paceT(E)), rep(n, [time('work', 8, 'קצב סף', paceT(T, 0.02)), time('recover', 2, 'ג׳וג', paceT(E * 1.1))]), time('cooldown', cool, 'קירור', paceT(E))] };
    }
    const n = Math.max(2, Math.min(4, Math.floor(main / 10)));
    return { title: 'ריצה — קצב מרוץ', intensity: 'Z3', plannedRpe: 6, hard: true, steps: [time('warmup', warm, 'חימום', paceT(E)), rep(n, [time('work', 8, 'קצב מרוץ 10 ק״מ', paceT(R, 0.02)), time('recover', 2, 'ג׳וג', paceT(E * 1.1))]), time('cooldown', cool, 'קירור', paceT(E))] };
  }
  return { title: 'ריצה — קלה', intensity: 'Z1', plannedRpe: 3, hard: false, steps: [time('work', min, 'ריצה קלה ורגועה', paceT(E * 1.05))] };
}

export function buildTemplate(d: TplDiscipline, c: Ctx): Built {
  return d === 'swim' ? swim(c) : d === 'bike' ? bike(c) : run(c);
}

/** שניות משוערות לצעד (לשחייה לפי מרחק וקצב, לשאר לפי משך). */
export function stepSeconds(s: WorkoutStep, d: TplDiscipline | 'rest' | 'race'): number {
  if (s.kind === 'repeat') return (s.repeat ?? 1) * (s.children ?? []).reduce((a, x) => a + stepSeconds(x, d), 0);
  if (s.durationSec) return s.durationSec;
  if (s.distanceM) {
    const pace = s.target?.type === 'pace' ? ((s.target.low ?? 0) + (s.target.high ?? 0)) / 2 : 120;
    return Math.round((s.distanceM / 100) * (pace || 120));
  }
  return 0;
}

export function stepKm(s: WorkoutStep, d: TplDiscipline): number {
  if (s.kind === 'repeat') return (s.repeat ?? 1) * (s.children ?? []).reduce((a, x) => a + stepKm(x, d), 0);
  if (d === 'swim') return (s.distanceM ?? 0) / 1000;
  const secs = s.durationSec ?? 0;
  if (d === 'bike') return (secs / 3600) * (s.speedKmh ?? 25);
  const pace = s.target?.type === 'pace' ? ((s.target.low ?? 0) + (s.target.high ?? 0)) / 2 : 360;
  return secs / pace;
}
