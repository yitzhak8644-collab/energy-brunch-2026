import { create } from 'zustand';
import { persist, type PersistStorage } from 'zustand/middleware';
import { adaptPlan } from '../engine/adapt';
import { buildWeek, generatePlan } from '../engine/generate';
import { periodize } from '../engine/periodize';
import { weeklyTargets } from '../engine/volume';
import { computeZones } from '../engine/zones';
import { diffDays, todayLocal } from '../lib/dates';
import { newId } from '../lib/id';
import { syncIntervals, type SyncOpts } from '../sync/syncNow';
import { idbAdapter, type StorageAdapter } from './storage';
import { DEFAULT_USER, type IntervalsSettings, type Log, type PlanState, type Profile } from '../types';

export const STATE_VERSION = 2;

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
  setIntervals(cfg?: { athleteId: string; apiKey: string }): void;
  setAutoSync(on: boolean): void;
  lockIntervals(message: string): void;
  syncIntervals(opts?: SyncOpts): ReturnType<typeof syncIntervals>;
  importState(json: string): void;
  exportState(): string;
  reset(): void;
}
export type Store = PlanState & Actions & { hydrated: boolean; syncing: boolean };

const empty = (userId: string): PlanState => ({ userId, weeks: [], logs: {}, adaptNotes: [], metrics: {}, settings: { autoSync: true } });
const stateOf = (s: Store): PlanState => ({ userId: s.userId, profile: s.profile, zones: s.zones, weeks: s.weeks, logs: s.logs, adaptNotes: s.adaptNotes, metrics: s.metrics, settings: s.settings });

/** מיגרציה: גרסה 1 (שלב 1) לא הכילה settings/metrics. */
export function migrate(persisted: unknown): PlanState {
  const p = (persisted ?? {}) as Partial<PlanState>;
  return { ...empty(p.userId ?? DEFAULT_USER), ...p, metrics: p.metrics ?? {}, settings: { autoSync: true, ...(p.settings ?? {}) } } as PlanState;
}

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
        syncing: false,
        onboard(profile, today = todayLocal()) {
          const { zones, weeks } = generatePlan({ ...profile, userId }, today);
          set({ ...empty(userId), settings: get().settings, profile: { ...profile, userId }, zones, weeks });
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
          // ממזגים את הרישום הקודם כדי לא לאבד activityId / avgHr / source של רישום אוטומטי
          const log: Log = { ...prev, source: prev?.source ?? 'manual', id: prev?.id ?? newId(), userId, createdAt: prev?.createdAt ?? now, updatedAt: now, ...input };
          set({ logs: { ...get().logs, [input.sessionId]: log } });
          get().runAdapt(today);
        },
        runAdapt(today = todayLocal()) {
          const s = get();
          if (!s.profile || !s.zones) return;
          const r = adaptPlan({ profile: s.profile, zones: s.zones, weeks: s.weeks, logs: s.logs, notes: s.adaptNotes, today, metrics: s.metrics });
          if (r.added.length || JSON.stringify(r.weeks) !== JSON.stringify(s.weeks)) set({ weeks: r.weeks, adaptNotes: r.notes });
        },
        setIntervals(cfg) {
          const cur = get().settings;
          const intervals: IntervalsSettings | undefined = cfg ? { athleteId: cfg.athleteId.trim(), apiKey: cfg.apiKey.trim(), known: cur.intervals?.apiKey === cfg.apiKey.trim() && cur.intervals.athleteId === cfg.athleteId.trim() ? cur.intervals.known : {} } : undefined;
          set({ settings: { ...cur, intervals } });
        },
        lockIntervals(message) {
          const cur = get().settings;
          if (cur.intervals) set({ settings: { ...cur, autoSync: false, intervals: { ...cur.intervals, idLost: true, error: message } } });
        },
        setAutoSync(on) { set({ settings: { ...get().settings, autoSync: on } }); },
        syncIntervals: (opts) => syncIntervals(get, set as never, opts),
        importState(json) {
          const data = JSON.parse(json) as PlanState;
          if (!data || !Array.isArray(data.weeks)) throw new Error('קובץ לא תקין');
          // ההגדרות (כולל מפתח ה-API) נשארות כפי שהן במכשיר הזה
          set({ ...empty(userId), ...data, userId, metrics: data.metrics ?? {}, settings: get().settings });
        },
        exportState() {
          const s = stateOf(get());
          const settings = { ...s.settings, intervals: s.settings.intervals ? { ...s.settings.intervals, apiKey: '', lastReport: undefined } : undefined };
          return JSON.stringify({ ...s, settings }, null, 2);
        },
        reset() { set({ ...empty(userId), settings: get().settings }); },
      }),
      {
        name: 'tri-coach',
        version: STATE_VERSION,
        storage,
        partialize: (s) => stateOf(s as Store) as never,
        migrate: (persisted) => migrate(persisted) as never,
      },
    ),
  );
  useStore.persist.onFinishHydration(() => useStore.setState({ hydrated: true }));
  if (useStore.persist.hasHydrated()) useStore.setState({ hydrated: true });
  return useStore;
}

export const useStore = createStore();
