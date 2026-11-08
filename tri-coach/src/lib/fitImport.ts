import { Decoder, Stream } from '@garmin/fitsdk';
import type { ImportedActivity } from '../engine/calibrate';

const SPORT: Record<string, ImportedActivity['sport']> = { running: 'run', cycling: 'bike', swimming: 'swim' };
const iso = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;

/** מפענח קובץ FIT של פעילות ומחזיר פעילות לכל session (טריאתלון = כמה). */
export function parseFitActivity(bytes: Uint8Array): ImportedActivity[] {
  try {
    const decoder = new Decoder(Stream.fromByteArray(bytes));
    if (!decoder.isFIT()) return [];
    const { messages } = decoder.read({ mergeHeartRates: false });
    const sessions = (messages.sessionMesgs ?? []) as Record<string, unknown>[];
    return sessions.flatMap((s) => {
      const sport = SPORT[String(s.sport)] ?? 'other';
      const start = s.startTime instanceof Date ? s.startTime : undefined;
      const dur = Number(s.totalTimerTime ?? s.totalElapsedTime ?? 0);
      if (!start || !dur) return [];
      return [{
        id: `${start.toISOString()}-${sport}`, sport, start: iso(start), durationSec: dur,
        distanceM: Number(s.totalDistance ?? 0),
        avgHr: s.avgHeartRate ? Number(s.avgHeartRate) : undefined,
        maxHr: s.maxHeartRate ? Number(s.maxHeartRate) : undefined,
      } satisfies ImportedActivity];
    });
  } catch {
    return [];
  }
}

const tick = () => new Promise<void>((r) => setTimeout(r, 0));

/** קורא קבצי .fit ו-.zip (כולל zip מקונן כמו בייצוא הנתונים של Garmin). טעינה עצלה של fflate. */
export async function importFiles(
  files: File[],
  opts: { sinceDate?: string; onProgress?: (done: number, total: number) => void } = {},
): Promise<ImportedActivity[]> {
  const { unzipSync } = await import('fflate');
  const queue: Uint8Array[] = [];
  const collect = (name: string, data: Uint8Array) => {
    const n = name.toLowerCase();
    if (n.endsWith('.fit')) queue.push(data);
    else if (n.endsWith('.zip')) {
      const inner = unzipSync(data, { filter: (f) => /\.(fit|zip)$/i.test(f.name) });
      for (const [k, v] of Object.entries(inner)) collect(k, v);
    }
  };
  for (const f of files) collect(f.name, new Uint8Array(await f.arrayBuffer()));

  const out: ImportedActivity[] = [];
  for (let i = 0; i < queue.length; i++) {
    for (const a of parseFitActivity(queue[i])) if (!opts.sinceDate || a.start >= opts.sinceDate) out.push(a);
    if (i % 20 === 0) { opts.onProgress?.(i, queue.length); await tick(); }
  }
  opts.onProgress?.(queue.length, queue.length);
  return out;
}
