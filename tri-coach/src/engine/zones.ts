import type { Profile, Zones } from '../types';

const RIEGEL = 1.06;
const DEFAULT_10K_PACE = 390; // 6:30/ק״מ אם אין נתונים

export function pace10k(p: Pick<Profile, 'run5kSec' | 'run10kSec'>): number {
  if (p.run10kSec) return p.run10kSec / 10;
  if (p.run5kSec) return (p.run5kSec * Math.pow(2, RIEGEL)) / 10;
  return DEFAULT_10K_PACE;
}

export function computeZones(p: Profile): Zones {
  const p10 = pace10k(p);
  const thresh = p10 * 0.99;
  const zones: Zones = {
    cssPer100: Math.round(p.swimPace1k * 1.03),
    runThreshPace: Math.round(thresh),
    runEasyPace: Math.round(thresh * 1.22),
    runRacePace: Math.round(p10 * 1.03),
    bikeEasyKmh: round1(p.bikeAvgKmh * 0.9),
    bikeTempoKmh: round1(p.bikeAvgKmh * 1.03),
    bikeRaceKmh: round1(p.bikeAvgKmh * 1.07),
  };
  if (p.maxHr) {
    const cuts = [0.5, 0.6, 0.7, 0.8, 0.9, 1];
    zones.hrZones = [0, 1, 2, 3, 4].map(
      (i) => [Math.round(p.maxHr! * cuts[i]), Math.round(p.maxHr! * cuts[i + 1])] as [number, number],
    );
  }
  return zones;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** ציון 0..1 לכל ענף מול בנצ׳מרק לאולימפי; הנמוך ביותר הוא הענף החלש. */
export function weakestDiscipline(p: Profile): 'swim' | 'bike' | 'run' {
  const clamp = (x: number) => Math.max(0, Math.min(1, x));
  const swim = clamp((160 - p.swimPace1k) / 60); // 1:40 → 1, 2:40 → 0
  const bike = clamp((p.bikeAvgKmh - 18) / 12) * 0.6 + clamp(p.bikeLongestKm / 60) * 0.4;
  const run = clamp((450 - pace10k(p)) / 150); // 5:00 → 1, 7:30 → 0
  const m = Math.min(swim, bike, run);
  return m === swim ? 'swim' : m === bike ? 'bike' : 'run';
}
