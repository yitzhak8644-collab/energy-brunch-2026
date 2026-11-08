import { matchActivities } from '../engine/autolog';
import { addDays, todayLocal } from '../lib/dates';
import { newId } from '../lib/id';
import type { Store } from '../store/useStore';
import type { Log, SyncReport } from '../types';
import { errorText, IntervalsError, IntervalsProvider } from './IntervalsProvider';
import type { SyncProvider } from './SyncProvider';

export interface SyncOpts {
  auto?: boolean; // הפעלה אוטומטית (פתיחה/חזרה לאפליקציה): חלה הגבלת תדירות
  pushOnly?: boolean; // רק דחיפה (אחרי שינוי תוכנית)
  today?: string;
  provider?: SyncProvider;
}

export const THROTTLE_MS = 15 * 60 * 1000;
let inflight = false;

/** מעבר סנכרון אחד: מושך פעילויות ומדדים → רישום אוטומטי → התאמה → דחיפת 14 ימים. נעילה מונעת חפיפות. */
export async function syncIntervals(get: () => Store, set: (p: Partial<Store>) => void, opts: SyncOpts = {}): Promise<SyncReport | undefined> {
  const s0 = get();
  const cfg = s0.settings.intervals;
  if (!cfg?.apiKey || !cfg.athleteId || !s0.zones || !s0.profile) return;
  if (cfg.idLost) return; // נחסם: external_id לא חוזר — לא דוחפים (גם לא ידנית) עד חיבור מחדש
  if (opts.auto && !s0.settings.autoSync) return;
  if (opts.auto && cfg.lastSyncAt && Date.now() - Date.parse(cfg.lastSyncAt) < THROTTLE_MS) return;
  if (inflight) return;
  inflight = true;
  set({ syncing: true });

  const today = opts.today ?? todayLocal();
  const provider = opts.provider ?? new IntervalsProvider(cfg);
  const report: SyncReport = { at: new Date().toISOString(), pulled: { activities: 0, autoLogged: 0, metrics: 0 }, pushed: { created: 0, updated: 0, deleted: 0, unchanged: 0 }, errors: [], pushErrors: [] };
  const patchCfg = (p: Partial<NonNullable<Store['settings']['intervals']>>, extra: Partial<Store['settings']> = {}) => {
    const cur = get().settings;
    set({ settings: { ...cur, ...extra, intervals: { ...cur.intervals!, ...p } } });
  };

  try {
    if (!opts.pushOnly) {
      const acts = await provider.pullActivities(addDays(today, -28));
      const metrics = (await provider.pullMetrics?.(addDays(today, -35), today)) ?? [];
      report.pulled.activities = acts.length;
      report.pulled.metrics = metrics.length;

      const st = get();
      const autos = matchActivities(acts, st.weeks, st.logs);
      const logs = { ...st.logs };
      const now = new Date().toISOString();
      for (const a of autos) {
        logs[a.sessionId] = {
          id: newId(), userId: st.userId, sessionId: a.sessionId, completed: true, actualMin: a.actualMin, actualKm: a.actualKm,
          avgHr: a.avgHr, rpe: a.rpe, source: 'intervals', activityId: a.activityId, createdAt: now, updatedAt: now,
        } satisfies Log;
      }
      const mm = { ...st.metrics };
      for (const m of metrics) mm[m.date] = m;
      report.pulled.autoLogged = autos.length;
      set({ logs, metrics: mm });
      get().runAdapt(today);
    }

    const st = get();
    const sessions = st.weeks.flatMap((w) => w.sessions).filter((x) => !st.logs[x.id]);
    const keep = st.weeks.flatMap((w) => w.sessions).filter((x) => st.logs[x.id]).map((x) => `tricoach:${x.id}`);
    const sum = await provider.pushWorkouts(sessions, { zones: st.zones!, today, known: get().settings.intervals?.known ?? {}, keep });
    report.pushed = { created: sum.created, updated: sum.updated, deleted: sum.deleted, unchanged: sum.unchanged };
    report.errors.push(...sum.errors);
    report.pushErrors = sum.pushErrors;

    if (sum.externalIdLost) {
      const msg = 'האירועים שנוצרו ב-Intervals.icu לא חזרו עם מזהה — הסנכרון נעצר כדי לא ליצור כפילויות. נתק וחבר מחדש כדי לנסות שוב.';
      report.errors.push(msg);
      patchCfg({ known: sum.known, lastSyncAt: report.at, lastReport: report, error: msg, idLost: true }, { autoSync: false });
    } else {
      patchCfg({ known: sum.known, lastSyncAt: report.at, lastReport: report, error: undefined });
    }
  } catch (e) {
    const msg = errorText(e);
    report.errors.push(msg);
    // שגיאת רשת: לא משנים כלום ולא "שורפים" את ההגבלה, כדי שניסיון הבא יהיה מהיר
    patchCfg(e instanceof IntervalsError && e.kind === 'network' ? { error: msg } : { error: msg, lastReport: report });
  } finally {
    inflight = false;
    set({ syncing: false });
  }
  return report;
}
