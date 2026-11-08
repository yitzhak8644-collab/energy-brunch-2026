import { create } from 'zustand';
import { persist, type PersistStorage } from 'zustand/middleware';
import { adaptPlan } from '../engine/adapt';
import { buildWeek, generatePlan } from '../engine/generate';
import { periodize } from '../engine/periodize';
import { weeklyTargets } from '../engine/volume';
import { computeZones } from '../engine/zones';
import { diffDays, todayLocal } from '../lib/dates';
import { idbAdapter, type StorageAdapter } from './storage';
import { DEFAULT_USER, type Log, type PlanState, type Profile } from '../types';

export const STATE_VERSION = 1;

export interface LogInput {
  sessionId: string;
  completed: boolean;
  actualMin?: number;
  actualKm?: number;
  rpe?: number;
  pain?: Log['pain'];
}

interface Actions {
  onboard(profile: Profile, today?: string): void;
  replan(patch: Partial<Profile>, today?: string): void;
  saveLog(input: LogInput, today?: string): void;
  runAdapt(today?: string): void;
  importState(json: string): void;
  exportState(): string;
  reset(): void;
}
export type Store = PlanState & Actions & { hydrated: boolean };

const empty = (userId: string): PlanState => ({ userId, weeks: [], logs: {}, adaptNotes: [] });
const newId = () => (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`);
const stateOf = (s: Store): PlanState => ({ userId: s.userId, profile: s.profile, zones: s.zones, weeks: s.weeks, logs: s.logs, adaptNotes: s.adaptNotes });

export function createStore(adapter: StorageAdapter = idbAdapter, userId = DEFAULT_USER) {
  const storage: PersistStorage<PlanState> = {
    getItem: async () => (await adapter.load(userId)) as never,
    setItem: async (_n, value) => { await adapter.save(userId, value as never); },
    removeItem: async () => { await adapter.clear(userId); },
  };

  const useStore = create<Store>()(
    persist(
      (set, get) => ({
        ...empty(userId),
        hydrated: false,
        onboard(profile, today = todayLocal()) {
          const { zones, weeks } = generatePlan({ ...profile, userId }, today);
          set({ ...empty(userId), profile: { ...profile, userId }, zones, weeks });
        },
        replan(patch, today = todayLocal()) {
          const cur = get().profile;
          if (!cur) return;
          const profile = { ...cur, ...patch, userId };
          const sk = periodize(today, profile.raceDate);
          const zones = computeZones(profile);
          const kept = get().weeks.filter((w) => !sk.length || diffDays(w.start, sk[0].start) < 0);
          const targets = weeklyTargets(profile, sk);
          const fresh = sk.map((s, i) => buildWeek(profile, zones, { ...s, index: kept.length + i }, targets[i]));
          set({ profile, zones, weeks: [...kept, ...fresh] });
        },
        saveLog(input, today = todayLocal()) {
          const prev = get().logs[input.sessionId];
          const now = new Date().toISOString();
          const log: Log = {
            id: prev?.id ?? newId(), userId, source: 'manual', createdAt: prev?.createdAt ?? now, updatedAt: now,
            ...input,
          };
          set({ logs: { ...get().logs, [input.sessionId]: log } });
          get().runAdapt(today);
        },
        runAdapt(today = todayLocal()) {
          const s = get();
          if (!s.profile || !s.zones) return;
          const r = adaptPlan({ profile: s.profile, zones: s.zones, weeks: s.weeks, logs: s.logs, notes: s.adaptNotes, today });
          if (r.added.length || JSON.stringify(r.weeks) !== JSON.stringify(s.weeks)) set({ weeks: r.weeks, adaptNotes: r.notes });
        },
        importState(json) {
          const data = JSON.parse(json) as PlanState;
          if (!data || !Array.isArray(data.weeks)) throw new Error('קובץ לא תקין');
          set({ ...empty(userId), ...data, userId });
        },
        exportState: () => JSON.stringify(stateOf(get()), null, 2),
        reset() { set({ ...empty(userId) }); },
      }),
      {
        name: 'tri-coach',
        version: STATE_VERSION,
        storage,
        partialize: (s) => stateOf(s as Store) as never,
        migrate: (persisted) => persisted as never,
      },
    ),
  );
  useStore.persist.onFinishHydration(() => useStore.setState({ hydrated: true }));
  if (useStore.persist.hasHydrated()) useStore.setState({ hydrated: true });
  return useStore;
}

export const useStore = createStore();
