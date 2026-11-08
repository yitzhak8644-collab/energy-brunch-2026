import type { Discipline, Session, StepTarget, WorkoutStep, Zones } from '../types';

/**
 * Session → אימון בפורמט המקורי של Intervals.icu (שדה description), לפי Workout Builder Syntax Quick Guide:
 *  - m = דקות, mtr = מטרים; קצב מוחלט `5:00/km-5:30/km Pace`; דופק באחוזי מקס׳ `70-80% HR`
 *  - חזרות: כותרת `Main Set 4x` עם שורה ריקה לפני ואחרי; אין חזרות מקוננות
 *  - כותרות/סימון markdown (`##`) מתעלמים מהן בפענוח → כותרת עברית בטוחה.
 */
export const INTERVALS_PREFIX = 'tricoach:';

const TYPE: Partial<Record<Discipline, string>> = { swim: 'Swim', bike: 'Ride', run: 'Run' };
const EN: Partial<Record<Discipline, string>> = { swim: 'Swim', bike: 'Bike', run: 'Run' };

export function formatDuration(totalSec: number): string {
  const s = Math.max(0, Math.round(totalSec));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  return `${h ? `${h}h` : ''}${m ? `${m}m` : ''}${x ? `${x}s` : ''}` || '0s';
}
const mmss = (sec: number) => `${Math.floor(Math.round(sec) / 60)}:${String(Math.round(sec) % 60).padStart(2, '0')}`;

function targetText(t: StepTarget | undefined, d: Discipline, zones: Zones): string {
  if (!t || !t.low || !t.high) return '';
  if (t.type === 'pace' && d !== 'bike') {
    const unit = d === 'swim' ? '/100m' : '/km';
    return t.low === t.high ? `${mmss(t.low)}${unit} Pace` : `${mmss(t.low)}${unit}-${mmss(t.high)}${unit} Pace`;
  }
  if (t.type === 'hr') {
    const max = zones.hrZones?.[4]?.[1];
    if (!max) return '';
    return `${Math.round((t.low / max) * 100)}-${Math.round((t.high / max) * 100)}% HR`;
  }
  return ''; // rpe / open: אין יעד מספרי
}

function line(s: WorkoutStep, d: Discipline, zones: Zones): string {
  if (s.kind === 'repeat') throw new Error('חזרות מקוננות אינן נתמכות ב-Intervals.icu');
  const amount = s.distanceM
    ? (s.distanceM >= 1000 && s.distanceM % 100 === 0 ? `${s.distanceM / 1000}km` : `${s.distanceM}mtr`)
    : formatDuration(s.durationSec ?? 0);
  return `- ${[amount, targetText(s.target, d, zones)].filter(Boolean).join(' ')}`;
}

export function sessionToIntervalsText(s: Session, zones: Zones): string {
  const blocks: string[] = [`## ${s.title}`];
  let i = 0;
  const steps = s.steps;
  while (i < steps.length) {
    const st = steps[i];
    if (st.kind === 'warmup') {
      blocks.push(`Warmup\n${line(st, s.discipline, zones)}`); i++;
    } else if (st.kind === 'cooldown') {
      blocks.push(`Cooldown\n${line(st, s.discipline, zones)}`); i++;
    } else if (st.kind === 'repeat') {
      const kids = (st.children ?? []).map((c) => line(c, s.discipline, zones));
      blocks.push(`Main Set ${st.repeat ?? 1}x\n${kids.join('\n')}`); i++;
    } else {
      const run: string[] = [];
      while (i < steps.length && (steps[i].kind === 'work' || steps[i].kind === 'recover')) run.push(line(steps[i++], s.discipline, zones));
      blocks.push(`Main Set\n${run.join('\n')}`);
    }
  }
  return blocks.join('\n\n');
}

export interface IntervalsEventInput {
  category: 'WORKOUT';
  start_date_local: string;
  name: string;
  type: string;
  description: string;
  moving_time: number;
  external_id: string;
}

export function sessionToEvent(s: Session, zones: Zones): IntervalsEventInput {
  const type = TYPE[s.discipline];
  if (!type) throw new Error('סוג אימון לא נתמך לדחיפה');
  return {
    category: 'WORKOUT',
    start_date_local: `${s.date}T00:00:00`,
    name: `${EN[s.discipline]} ${s.targetMin}min ${s.intensity}${s.brick ? ' brick' : ''}`,
    type,
    description: sessionToIntervalsText(s, zones),
    moving_time: Math.round(s.targetMin * 60),
    external_id: `${INTERVALS_PREFIX}${s.id}`,
  };
}

/** hash יציב וקצר לזיהוי שינוי (djb2). */
export function eventHash(e: IntervalsEventInput): string {
  const str = JSON.stringify([e.name, e.type, e.start_date_local.slice(0, 10), e.description]);
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}
