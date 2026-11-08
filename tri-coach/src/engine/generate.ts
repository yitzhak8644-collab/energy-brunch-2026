import { addDays, diffDays, weekday } from '../lib/dates';
import type { Discipline, Phase, Profile, Session, Week, Weekday, Zones } from '../types';
import { periodize, type WeekSkeleton } from './periodize';
import { buildTemplate, stepKm, stepSeconds, type Role, type TplDiscipline } from './templates';
import { weeklyTargets } from './volume';
import { computeZones, weakestDiscipline } from './zones';

type D3 = TplDiscipline;
interface Slot { disc: D3; role: Role }
interface Planned { slot: Slot; min: number; brickRun?: number; date?: string }

// סדר עדיפות: מה נשאר כשיש מעט ימים או זמן
const PRIORITY: Slot[] = [
  { disc: 'bike', role: 'long' }, { disc: 'run', role: 'long' }, { disc: 'swim', role: 'quality' },
  { disc: 'run', role: 'quality' }, { disc: 'bike', role: 'quality' }, { disc: 'swim', role: 'aerobic' },
  { disc: 'run', role: 'easy' }, { disc: 'bike', role: 'easy' },
];
const W: Record<Role, number> = { long: 2, quality: 1.3, aerobic: 1, easy: 0.8 };
const MIN_MIN: Record<D3, number> = { swim: 30, bike: 40, run: 25 };
const CAP_MIN: Record<D3, { long: number; other: number }> = {
  swim: { long: 75, other: 75 }, bike: { long: 210, other: 120 }, run: { long: 110, other: 75 },
};
const r1 = (n: number) => Math.round(n * 10) / 10;

export function sharesFor(p: Profile): Record<D3, number> {
  const s: Record<D3, number> = { swim: 0.2, bike: 0.45, run: 0.35 };
  const weak = weakestDiscipline(p);
  for (const d of ['swim', 'bike', 'run'] as D3[]) {
    if (d === weak) s[d] += 0.05;
    else s[d] -= 0.025;
  }
  const runInjured = p.injuries.some((i) => i.active && i.severity >= 2 && /ברך|ירך|שוק|קרסול|כף רגל|אכילס|רגל/.test(i.area));
  if (runInjured) { s.run -= 0.1; s.bike += 0.06; s.swim += 0.04; }
  return s;
}

/** שיבוץ בחיפוש ממצה (≤6 סלוטים × ≤7 ימים): מקסימום ניקוד כולל, עם קנסות סמיכות בין אימונים. */
function place(planned: Planned[], dates: string[], avail: Profile['availableDays'], longDay: Weekday) {
  const cap = (d: string) => avail[weekday(d)]?.minutes ?? 0;
  const free = dates.filter((d) => cap(d) > 0);
  const isHard = (p: Planned) => p.slot.role === 'quality';
  const isLong = (p: Planned) => p.slot.role === 'long';

  const unary = (p: Planned, date: string) => {
    const wd = weekday(date);
    let s = Math.min(cap(date), p.min) / 20;
    if (cap(date) < p.min) s -= (p.min - cap(date)) / 4;
    if (isLong(p) && p.slot.disc === 'bike') s += (wd === longDay ? 40 : 0) + (wd >= 5 ? 10 : 0);
    if (isLong(p) && p.slot.disc === 'run') s += wd >= 5 ? 6 : 0;
    return s;
  };
  const pair = (a: Planned, da: string, b: Planned, db: string) => {
    const gap = Math.abs(diffDays(da, db));
    let s = 0;
    if (gap === 1) {
      if ((isHard(a) || isLong(a)) && (isHard(b) || isLong(b))) s -= isHard(a) && isHard(b) ? 60 : 40;
      else if (isHard(a) || isLong(a) || isHard(b) || isLong(b)) s -= 5;
      if (a.slot.disc === b.slot.disc) s -= 12;
    }
    if (isLong(a) && isLong(b) && a.slot.disc !== b.slot.disc) s += Math.min(gap, 3) * 8;
    return s;
  };

  let best = -Infinity;
  let bestAssign: (string | undefined)[] = [];
  const cur: (string | undefined)[] = [];
  const dfs = (i: number, score: number) => {
    if (i === planned.length) {
      if (score > best) { best = score; bestAssign = [...cur]; }
      return;
    }
    for (const d of free) {
      if (cur.some((x) => x === d)) continue;
      let s = unary(planned[i], d);
      for (let j = 0; j < i; j++) if (cur[j]) s += pair(planned[i], d, planned[j], cur[j]!);
      cur[i] = d;
      dfs(i + 1, score + s);
      cur.pop();
    }
    if (i >= free.length) { // אין מספיק ימים: מדלגים על הסלוט
      cur[i] = undefined;
      dfs(i + 1, score - 100);
      cur.pop();
    }
  };
  dfs(0, 0);
  planned.forEach((p, i) => { p.date = bestAssign[i]; });
}

const clampN = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

export function buildWeekSessions(profile: Profile, zones: Zones, sk: Pick<WeekSkeleton, 'start' | 'end' | 'phase'>, targetMin: number): Session[] {
  if (sk.phase === 'taper' && sk.end === profile.raceDate) return raceWeekSessions(profile, zones, sk);

  const dates: string[] = [];
  for (let d = sk.start; diffDays(d, sk.end) <= 0; d = addDays(d, 1)) dates.push(d);
  const availDays = dates.filter((d) => (profile.availableDays[weekday(d)]?.minutes ?? 0) > 0).length;
  const maxDays = Math.min(availDays, 6);
  const nByTime = clampN(Math.round(targetMin / 55), 4, 8);
  const n = Math.min(nByTime, maxDays);
  if (n <= 0) return [];

  const slots = PRIORITY.slice(0, n);
  const shares = sharesFor(profile);
  const brick = (sk.phase === 'build' || sk.phase === 'peak') && slots.some((s) => s.disc === 'bike' && s.role === 'quality');

  const sum = (d: D3) => slots.filter((s) => s.disc === d).reduce((a, s) => a + W[s.role], 0);
  const bikeQ = brick ? (shares.bike * targetMin * W.quality) / sum('bike') : 0;
  const brickRun = brick ? clampN(Math.round(bikeQ * 0.25), 15, 30) : 0;
  const budget: Record<D3, number> = { swim: shares.swim * targetMin, bike: shares.bike * targetMin, run: Math.max(0, shares.run * targetMin - brickRun) };

  const planned: Planned[] = slots.map((slot) => {
    const raw = (budget[slot.disc] * W[slot.role]) / sum(slot.disc);
    const cap = slot.role === 'long' ? CAP_MIN[slot.disc].long : CAP_MIN[slot.disc].other;
    return { slot, min: Math.round(clampN(raw, MIN_MIN[slot.disc], cap)), brickRun: brick && slot.disc === 'bike' && slot.role === 'quality' ? brickRun : undefined };
  });
  place(planned, dates, profile.availableDays, profile.longDay);

  const out: Session[] = [];
  for (const p of planned) {
    if (!p.date) continue;
    const dayCap = profile.availableDays[weekday(p.date)].minutes;
    const isBrick = p.brickRun !== undefined;
    const min = Math.max(isBrick ? 40 : 20, Math.min(p.min, dayCap - (p.brickRun ?? 0)));
    out.push(makeSession(profile, zones, sk.phase, p.date, p.slot.disc, p.slot.role, min, isBrick));
    if (isBrick) out.push(makeSession(profile, zones, sk.phase, p.date, 'run', 'quality', p.brickRun!, true, true));
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || (a.discipline === 'bike' ? -1 : 1));
}

export function makeSession(profile: Profile, zones: Zones, phase: Phase, date: string, disc: D3, role: Role, min: number, brick = false, brickRun = false): Session {
  const b = buildTemplate(disc, { phase, role, min, zones, profile, brickRun });
  const secs = b.steps.reduce((a, s) => a + stepSeconds(s, disc), 0);
  const km = b.steps.reduce((a, s) => a + stepKm(s, disc), 0);
  return {
    id: `${date}-${disc}${brickRun ? '-brickrun' : ''}`, userId: profile.userId, date, discipline: disc,
    title: brick && !brickRun ? `${b.title} + Brick` : b.title,
    targetMin: Math.round(secs / 60) || min, targetKm: r1(km), intensity: b.intensity, plannedRpe: b.plannedRpe,
    hard: b.hard, brick: brick || undefined, steps: b.steps,
  };
}

function raceWeekSessions(profile: Profile, zones: Zones, sk: Pick<WeekSkeleton, 'start' | 'end' | 'phase'>): Session[] {
  const race = profile.raceDate;
  const plan: [number, D3, number][] = [[-4, 'swim', 20], [-3, 'run', 25], [-2, 'bike', 30]];
  const out: Session[] = [];
  for (const [off, disc, min] of plan) {
    const date = addDays(race, off);
    if (diffDays(date, sk.start) < 0) continue;
    if ((profile.availableDays[weekday(date)]?.minutes ?? 1) <= 0) continue;
    out.push(makeSession(profile, zones, 'taper', date, disc, 'quality', min));
  }
  out.push({
    id: `${race}-race`, userId: profile.userId, date: race, discipline: 'race', title: 'יום המרוץ — טריאתלון אולימפי',
    targetMin: 150, targetKm: 51.5, intensity: 'Z4', plannedRpe: 8, hard: true,
    steps: [
      { kind: 'work', label: 'שחייה 1.5 ק״מ', distanceM: 1500 },
      { kind: 'work', label: 'אופניים 40 ק״מ', distanceM: 40000 },
      { kind: 'work', label: 'ריצה 10 ק״מ', distanceM: 10000 },
    ],
  });
  return out;
}

export function buildWeek(profile: Profile, zones: Zones, sk: WeekSkeleton, baseTargetMin: number, adjust = 1, targetMin = baseTargetMin): Week {
  return {
    userId: profile.userId, index: sk.index, start: sk.start, end: sk.end, phase: sk.phase, isRecovery: sk.isRecovery,
    baseTargetMin, adjust, targetMin, sessions: buildWeekSessions(profile, zones, sk, targetMin),
  };
}

export function generatePlan(profile: Profile, today: string): { zones: Zones; weeks: Week[] } {
  const zones = computeZones(profile);
  const sk = periodize(today, profile.raceDate);
  const targets = weeklyTargets(profile, sk);
  return { zones, weeks: sk.map((s, i) => buildWeek(profile, zones, s, targets[i])) };
}

export const sessionDisciplineMinutes = (week: Week): Record<Discipline, number> => {
  const r: Record<Discipline, number> = { swim: 0, bike: 0, run: 0, race: 0, rest: 0 };
  for (const s of week.sessions) r[s.discipline] += s.targetMin;
  return r;
};
