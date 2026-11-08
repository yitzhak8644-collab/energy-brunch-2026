import { addDays, diffDays } from '../lib/dates';
import type { AdaptNote, DailyMetrics, Log, Profile, Session, Week, Zones } from '../types';
import { buildWeekSessions, makeSession } from './generate';
import { assessReadiness } from './readiness';
import { enforceCaps, peakCapMin } from './volume';

export interface AdaptInput {
  profile: Profile;
  zones: Zones;
  weeks: Week[];
  logs: Record<string, Log>;
  notes: AdaptNote[];
  today: string;
  metrics?: Record<string, DailyMetrics>;
}
export interface AdaptResult { weeks: Week[]; notes: AdaptNote[]; added: AdaptNote[] }

const LEG = /ברך|ירך|שוק|קרסול|כף רגל|אכילס|רגל|שריר|ארבע|המסטרינג/;
const SHOULDER = /כתף|שכמה/;
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

export function adaptPlan(input: AdaptInput): AdaptResult {
  const { profile, zones, logs, today } = input;
  const weeks: Week[] = input.weeks.map((w) => ({ ...w, sessions: [...w.sessions] }));
  const notes = [...input.notes];
  const added: AdaptNote[] = [];
  const has = (key: string) => notes.some((n) => n.key === key);
  const note = (key: string, weekIndex: number, text: string) => {
    const n: AdaptNote = { id: `${profile.userId}:${key}`, userId: profile.userId, date: today, weekIndex, key, text };
    notes.push(n);
    added.push(n);
  };
  const weekAt = (date: string) => weeks.find((w) => diffDays(date, w.start) >= 0 && diffDays(date, w.end) <= 0);
  const futureWeeks = () => weeks.filter((w) => diffDays(w.start, today) > 0);
  const touched = new Set<number>();

  // ── 1. כאב (תגובה מיידית, פעם אחת לכל רישום): רושמים הערה; ההחלפות מיושמות בסוף ──
  for (const log of Object.values(logs)) {
    const level = log.pain?.level ?? 0;
    if (level < 2 || has(`pain:${log.id}`)) continue;
    const area = log.pain!.area;
    const kind = painKind(area);
    const nextWeek = futureWeeks()[0];
    if (nextWeek) { nextWeek.adjust = clamp(nextWeek.adjust * 0.8, 0.5, 1.15); touched.add(nextWeek.index); }
    note(`pain:${log.id}`, weekAt(today)?.index ?? 0,
      level === 3
        ? `כאב חזק ב${area}: 3 ימי מנוחה, והשבוע הבא מופחת ב-20%. מומלץ להיוועץ באיש מקצוע.`
        : `כאב ב${area}: אימוני ${kind === 'run' ? 'ריצה' : kind === 'swim' ? 'שחייה' : 'השבוע'} הוחלפו באימון קל יותר, והשבוע הבא מופחת ב-20%.`);
    added[added.length - 1].pain = { area, level: level as 2 | 3, from: today, until: addDays(today, 7), restUntil: level === 3 ? addDays(today, 2) : undefined };
  }

  // ── 2. הערכת שבועות שהסתיימו ──
  for (const w of weeks) {
    if (diffDays(w.end, today) >= 0) continue; // לא הסתיים
    const key = `eval:${w.index}`;
    const planned = w.sessions.filter((s) => s.discipline !== 'rest');
    if (has(key) || planned.length < 2) continue;
    if (diffDays(today, w.end) > 21) continue; // ישן מדי: לא מעריכים רטרואקטיבית
    let plannedMin = 0, actualMin = 0, under70 = 0, easyHigh = 0, logged = 0, rpeDiff = 0, rpeCount = 0;
    for (const s of planned) {
      const l = logs[s.id];
      const a = l?.completed ? (l.actualMin ?? s.targetMin) : 0;
      plannedMin += s.targetMin; actualMin += a;
      if (a / s.targetMin < 0.7) under70++;
      if (l?.completed) logged++;
      if (l?.completed && l.rpe) {
        rpeDiff += l.rpe - s.plannedRpe; rpeCount++;
        if (s.plannedRpe <= 4 && l.rpe >= s.plannedRpe + 2) easyHigh++;
      }
    }
    if (logged === 0) continue; // אין רישומים: לא ניתן להבדיל בין "לא התאמן" ל"לא רשם" — כלל ההחמצה מטפל בהיעדרות
    const compliance = actualMin / plannedMin;
    const struggle = under70 >= 2 || easyHigh >= 2;
    const strong = !struggle && compliance >= 0.9 && logged >= 3 && (rpeCount === 0 || rpeDiff / rpeCount <= 0);
    const pct = Math.round(compliance * 100);
    if (struggle) {
      futureWeeks().forEach((f) => { f.adjust = clamp(f.adjust * 0.9, 0.6, 1.15); touched.add(f.index); });
      note(key, w.index, `שבוע ${w.index + 1}: ביצוע ${pct}% מהתוכנית (${under70} אימונים מתחת ל-70%${easyHigh ? `, ${easyHigh} אימונים קלים מאמצים מהצפוי` : ''}). הנפח בשבועות הבאים הופחת ב-10%.`);
    } else if (strong) {
      futureWeeks().forEach((f) => { f.adjust = clamp(f.adjust * 1.05, 0.6, 1.15); touched.add(f.index); });
      note(key, w.index, `שבוע ${w.index + 1}: ביצוע ${pct}% במאמץ נמוך מהצפוי. הנפח בשבועות הבאים עלה ב-5% (בתוך מגבלות העומס).`);
    } else {
      note(key, w.index, `שבוע ${w.index + 1}: ביצוע ${pct}% מהתוכנית — ממשיכים לפי התוכנית.`);
    }
  }

  // ── 3. החמצה של 10 ימים ומעלה ──
  const cur = weekAt(today);
  if (cur && !has(`missed:${cur.index}`)) {
    const windowStart = addDays(today, -10);
    const elapsed = weeks.flatMap((w) => w.sessions).filter((s) => diffDays(s.date, windowStart) >= 0 && diffDays(s.date, today) < 0);
    const anyDone = elapsed.some((s) => logs[s.id]?.completed);
    if (elapsed.length >= 3 && !anyDone) {
      futureWeeks().slice(0, 3).forEach((f, k) => { f.adjust = clamp(Math.min(f.adjust, 0.7 + 0.1 * k), 0.5, 1.15); touched.add(f.index); });
      note(`missed:${cur.index}`, cur.index, 'לא נרשמו אימונים 10 ימים — חוזרים בהדרגה: 70%, 80%, 90% מהנפח בשלושת השבועות הבאים.');
    }
  }

  // ── 4. חישוב מחדש של שבועות עתידיים בלבד, עם מגבלות העומס ──
  const fut = futureWeeks();
  if (fut.length && fut.some((f) => touched.has(f.index))) {
    const raw = weeks.map((w) => (diffDays(w.start, today) > 0 ? Math.round(w.baseTargetMin * w.adjust) : w.targetMin));
    const capped = enforceCaps(raw, weeks, peakCapMin(profile));
    for (const w of fut) {
      const t = capped[w.index];
      if (t !== w.targetMin || touched.has(w.index)) {
        w.targetMin = t;
        w.sessions = buildWeekSessions(profile, zones, w, t);
      }
    }
  }

  // ── 5. החלפות כאב על אימונים שטרם בוצעו (אידמפוטנטי; חל גם על שבועות שנבנו מחדש) ──
  for (const n of notes) {
    if (!n.pain) continue;
    const { area, from, until, restUntil } = n.pain;
    const kind = painKind(area);
    for (const w of weeks) {
      const out: Session[] = [];
      for (const s of w.sessions) {
        const inWindow = diffDays(s.date, today) >= 0 && diffDays(s.date, from) >= 0 && diffDays(s.date, until) <= 0 && !logs[s.id];
        if (!inWindow) { out.push(s); continue; }
        if (restUntil && diffDays(s.date, restUntil) <= 0) continue;
        if (kind !== 'general' && s.discipline === kind) {
          if (s.brick) continue;
          out.push(makeSession(profile, zones, w.phase, s.date, kind === 'run' ? 'bike' : 'run', 'easy', Math.round(s.targetMin * 0.9)));
        } else out.push(s);
      }
      if (out.length !== w.sessions.length || out.some((s, i) => s !== w.sessions[i])) w.sessions = out;
    }
  }

  // ── 6. מוכנות יומית (אחרי החישוב מחדש, אידמפוטנטי): מורידים אימון קשה של היום/מחר לקל ──
  const ready = assessReadiness(input.metrics ?? {}, today);
  if (ready.fatigued) {
    const tomorrow = addDays(today, 1);
    let changed = false;
    for (const w of weeks) {
      const out = w.sessions.map((s) => {
        if (!s.hard || logs[s.id] || (s.date !== today && s.date !== tomorrow)) return s;
        if (s.discipline !== 'swim' && s.discipline !== 'bike' && s.discipline !== 'run') return s;
        changed = true;
        return makeSession(profile, zones, w.phase, s.date, s.discipline, 'easy', Math.max(20, Math.round(s.targetMin * 0.8)));
      });
      if (out.some((s, i) => s !== w.sessions[i])) w.sessions = out;
    }
    if (changed && !has(`ready:${today}`)) note(`ready:${today}`, weekAt(today)?.index ?? 0, `סימני עייפות (${ready.reasons.join('; ')}): אימון קשה להיום/מחר הוחלף באימון קל.`);
  }
  return { weeks, notes, added };
}

function painKind(area: string): 'run' | 'swim' | 'general' {
  return LEG.test(area) ? 'run' : SHOULDER.test(area) ? 'swim' : 'general';
}
