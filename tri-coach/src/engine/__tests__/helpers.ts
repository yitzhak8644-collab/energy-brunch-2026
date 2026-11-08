import type { Profile, Weekday } from '../../types';

export const days = (m: Partial<Record<Weekday, number>>): Profile['availableDays'] => {
  const o = {} as Profile['availableDays'];
  for (let i = 0 as Weekday; i < 7; i++) o[i as Weekday] = { minutes: m[i as Weekday] ?? 0 };
  return o;
};

export const profile = (over: Partial<Profile> = {}): Profile => ({
  userId: 'me', raceDate: '2027-04-09', swimPace1k: 125, poolLength: 25, bikeLongestKm: 45, bikeAvgKmh: 25,
  run5kSec: 1650, run10kSec: undefined, maxHr: 188, currentWeeklyHours: 4, weeklyHours: 9,
  availableDays: days({ 0: 60, 1: 75, 2: 60, 3: 75, 4: 0, 5: 180, 6: 150 }), longDay: 5,
  injuries: [], experience: 'some', source: 'manual', ...over,
});
