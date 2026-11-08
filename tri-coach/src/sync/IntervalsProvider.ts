import type { ImportedActivity } from '../engine/calibrate';
import { addDays } from '../lib/dates';
import type { DailyMetrics, Session } from '../types';
import { eventHash, sessionToEvent, type IntervalsEventInput } from './intervalsText';
import { reconcile, type RemoteEvent } from './reconcile';
import type { PushOptions, PushSummary, SyncProvider } from './SyncProvider';

const BASE = 'https://intervals.icu/api/v1';

export type IntervalsErrorKind = 'auth' | 'notfound' | 'network' | 'http';
export class IntervalsError extends Error {
  constructor(public kind: IntervalsErrorKind, message: string, public status?: number) { super(message); }
}
export const errorText = (e: unknown): string =>
  e instanceof IntervalsError ? e.message : e instanceof Error ? e.message : 'שגיאה לא צפויה';

const BIKE = new Set(['Ride', 'VirtualRide', 'GravelRide', 'MountainBikeRide', 'EBikeRide', 'EMountainBikeRide', 'Cyclocross', 'TrackRide']);
const RUN = new Set(['Run', 'TrailRun', 'VirtualRun']);
const SWIM = new Set(['Swim', 'OpenWaterSwim']);
export const sportOf = (type?: string): ImportedActivity['sport'] =>
  type && RUN.has(type) ? 'run' : type && BIKE.has(type) ? 'bike' : type && SWIM.has(type) ? 'swim' : 'other';

interface RawActivity {
  id?: string | number; start_date_local?: string; type?: string; moving_time?: number; distance?: number;
  average_heartrate?: number; max_heartrate?: number; icu_rpe?: number; name?: string;
}
interface RawWellness { id?: string; restingHR?: number; hrv?: number; sleepSecs?: number; readiness?: number }

export class IntervalsProvider implements SyncProvider {
  readonly id = 'intervals-icu';
  readonly name = 'Intervals.icu';
  constructor(private cfg: { apiKey: string; athleteId: string }, private fetchImpl: typeof fetch = (...a) => fetch(...a)) {}

  private get athlete() { return `/athlete/${encodeURIComponent(this.cfg.athleteId.trim())}`; }

  private async req<T>(method: string, path: string, opts: { query?: Record<string, string | undefined>; body?: unknown } = {}): Promise<T> {
    const qs = Object.entries(opts.query ?? {}).filter(([, v]) => v !== undefined).map(([k, v]) => `${k}=${encodeURIComponent(v!)}`).join('&');
    const url = `${BASE}${path}${qs ? `?${qs}` : ''}`;
    let res: Response;
    try {
      res = await this.fetchImpl(url, {
        method,
        headers: { Authorization: `Basic ${btoa(`API_KEY:${this.cfg.apiKey.trim()}`)}`, ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      });
    } catch {
      throw new IntervalsError('network', 'אין חיבור לאינטרנט או ש-Intervals.icu לא זמין');
    }
    if (res.status === 401) throw new IntervalsError('auth', 'מפתח ה-API שגוי (401)', 401);
    if (res.status === 403 || res.status === 404) throw new IntervalsError('notfound', `בדוק את ה-Athlete ID (${res.status})`, res.status);
    if (!res.ok) throw new IntervalsError('http', `שגיאת שרת ${res.status}`, res.status);
    const text = await res.text();
    return (text ? JSON.parse(text) : undefined) as T;
  }

  async testConnection(today: string): Promise<{ athleteName?: string; wellnessOk: boolean }> {
    const a = await this.req<{ athlete?: { name?: string }; name?: string }>('GET', this.athlete);
    let wellnessOk = true;
    try { await this.req('GET', `${this.athlete}/wellness`, { query: { oldest: today, newest: today } }); } catch { wellnessOk = false; }
    return { athleteName: a?.athlete?.name ?? a?.name, wellnessOk };
  }

  async pullActivities(since: string): Promise<ImportedActivity[]> {
    const raw = await this.req<RawActivity[]>('GET', `${this.athlete}/activities`, {
      query: { oldest: since, fields: 'id,start_date_local,type,moving_time,distance,average_heartrate,max_heartrate,icu_rpe,name' },
    });
    return (raw ?? [])
      .filter((a) => a && a.id !== undefined && a.moving_time && a.start_date_local) // Strava מחזיר אובייקטים ריקים
      .map((a) => ({
        id: String(a.id), sport: sportOf(a.type), start: a.start_date_local!.slice(0, 10),
        durationSec: a.moving_time!, distanceM: a.distance ?? 0,
        avgHr: a.average_heartrate || undefined, maxHr: a.max_heartrate || undefined,
        rpe: a.icu_rpe && a.icu_rpe >= 1 && a.icu_rpe <= 10 ? a.icu_rpe : undefined, // לא feel (סקאלה 1-5)
        name: a.name,
      }));
  }

  async pullMetrics(since: string, today: string): Promise<DailyMetrics[]> {
    const raw = await this.req<RawWellness[]>('GET', `${this.athlete}/wellness`, {
      query: { oldest: since, newest: today, fields: 'id,restingHR,hrv,sleepSecs,readiness' },
    });
    return (raw ?? []).filter((w) => w?.id).map((w) => ({
      date: w.id!.slice(0, 10), restingHr: w.restingHR || undefined, hrv: w.hrv || undefined,
      sleepHours: w.sleepSecs ? Math.round((w.sleepSecs / 3600) * 10) / 10 : undefined, readiness: w.readiness || undefined,
    }));
  }

  listEvents(oldest: string, newest: string): Promise<RemoteEvent[]> {
    // newest מפורש: ברירת המחדל של ה-API היא oldest+6 ימים
    return this.req<RemoteEvent[]>('GET', `${this.athlete}/events`, { query: { oldest, newest, category: 'WORKOUT' } }).then((r) => r ?? []);
  }

  async pushWorkouts(sessions: Session[], opts: PushOptions): Promise<PushSummary> {
    const today = opts.today;
    const end = addDays(today, (opts.windowDays ?? 14) - 1);
    const known = { ...(opts.known ?? {}) };
    const out: PushSummary = { created: 0, updated: 0, deleted: 0, unchanged: 0, errors: [], pushErrors: [], known };

    const desired: IntervalsEventInput[] = sessions
      .filter((s) => (s.discipline === 'swim' || s.discipline === 'bike' || s.discipline === 'run') && s.date >= today && s.date <= end)
      .map((s) => sessionToEvent(s, opts.zones));

    const remote = await this.listEvents(today, end);
    for (const r of remote) for (const pe of r.push_errors ?? []) if (pe?.message) out.pushErrors.push({ name: r.name ?? '', date: (r.start_date_local ?? '').slice(0, 10), message: `${pe.service ?? 'Garmin'}: ${pe.message}` });

    const ops = reconcile(desired, remote, { today, end, known, keep: opts.keep });
    out.unchanged = ops.unchanged;

    const failed = new Set<string>();
    const fatal = (e: unknown) => e instanceof IntervalsError && (e.kind === 'auth' || e.kind === 'network');
    if (ops.create.length) {
      try { await this.req('POST', `${this.athlete}/events/bulk`, { body: ops.create }); out.created = ops.create.length; }
      catch (e) { if (fatal(e)) throw e; out.errors.push(`יצירה: ${errorText(e)}`); ops.create.forEach((c) => failed.add(c.external_id)); }
    }
    for (const u of ops.update) {
      try { await this.req('PUT', `${this.athlete}/events/${u.id}`, { body: u.ev }); out.updated++; }
      catch (e) { if (fatal(e)) throw e; out.errors.push(`עדכון ${u.ev.name}: ${errorText(e)}`); failed.add(u.ev.external_id); }
    }
    if (ops.remove.length) {
      try { await this.req('PUT', `${this.athlete}/events/bulk-delete`, { body: ops.remove.map((id) => ({ id })) }); out.deleted = ops.remove.length; }
      catch (e) { if (fatal(e)) throw e; out.errors.push(`מחיקה: ${errorText(e)}`); }
    }

    // וידוא: האירועים שנוצרו חייבים לחזור עם ה-external_id, אחרת הסנכרון הבא ייצור כפילויות
    if (out.created > 0) {
      const after = await this.listEvents(today, end);
      const ids = new Set(after.map((e) => e.external_id));
      if (ops.create.some((c) => !ids.has(c.external_id))) out.externalIdLost = true;
    }

    const wanted = new Set(desired.map((d) => d.external_id));
    for (const k of Object.keys(known)) if (!wanted.has(k)) delete known[k];
    for (const d of desired) if (!failed.has(d.external_id)) known[d.external_id] = eventHash(d);
    return out;
  }

  /** בדיקת מקצה לקצה: יוצר אירוע בדיקה, קורא אותו חזרה (מנותח? שגיאות Garmin?) ומוחק. */
  async sendTestWorkout(date: string): Promise<{ parsed: boolean; movingTime?: number; steps?: number; pushErrors: string[] }> {
    const ev = {
      category: 'WORKOUT', start_date_local: `${date}T00:00:00`, name: 'Tri-Coach test', type: 'Run', external_id: `tricoach-test:${date}`,
      description: 'Warmup\n- 5m 6:30/km-7:00/km Pace\n\nMain Set 2x\n- 3m 5:50/km-6:10/km Pace\n- 2m 6:50/km-7:20/km Pace\n\nCooldown\n- 5m 6:30/km-7:00/km Pace',
    };
    const created = await this.req<{ id: number }>('POST', `${this.athlete}/events`, { body: ev });
    try {
      const back = await this.req<{ moving_time?: number; workout_doc?: { steps?: unknown[] }; push_errors?: { message?: string }[] }>('GET', `${this.athlete}/events/${created.id}`);
      return {
        parsed: !!back.moving_time && back.moving_time > 0, movingTime: back.moving_time, steps: back.workout_doc?.steps?.length,
        pushErrors: (back.push_errors ?? []).map((p) => p.message ?? '').filter(Boolean),
      };
    } finally {
      await this.req('DELETE', `${this.athlete}/events/${created.id}`).catch(() => undefined);
    }
  }
}

