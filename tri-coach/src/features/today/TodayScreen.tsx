import { useState } from 'react';
import { PHASE, PHASE_DESC } from '../../i18n/he';
import { diffDays, todayLocal } from '../../lib/dates';
import { fmtDateHe } from '../../lib/format';
import { useStore } from '../../store/useStore';
import type { Session } from '../../types';
import { Card, Chip, Ring } from '../../ui/ui';
import { LogSheet } from './LogSheet';
import { SessionCard } from './SessionCard';

export function TodayScreen() {
  const { profile, weeks, logs, saveLog } = useStore();
  const [editing, setEditing] = useState<Session>();
  const today = todayLocal();
  if (!profile || !weeks.length) return null;

  const race = profile.raceDate;
  const daysLeft = diffDays(race, today);
  const total = Math.max(1, diffDays(race, weeks[0].start));
  const progress = Math.max(0, Math.min(1, diffDays(today, weeks[0].start) / total));
  const week = weeks.find((w) => diffDays(today, w.start) >= 0 && diffDays(today, w.end) <= 0);
  const all = weeks.flatMap((w) => w.sessions);
  const todays = all.filter((s) => s.date === today);
  const next = all.filter((s) => s.date > today).slice(0, 3);
  const notStarted = diffDays(weeks[0].start, today) > 0;

  return (
    <div className="space-y-4">
      <Card className="flex items-center gap-5">
        <Ring value={daysLeft < 0 ? 1 : progress} size={132} stroke={12}>
          <div>
            <div className="num font-display text-4xl font-extrabold leading-none">{Math.max(0, daysLeft)}</div>
            <div className="mt-1 text-xs text-muted">ימים למרוץ</div>
          </div>
        </Ring>
        <div className="min-w-0 flex-1">
          <div className="text-sm text-muted">{fmtDateHe(race, { day: 'numeric', month: 'long', year: 'numeric' })}</div>
          <h1 className="text-xl font-extrabold leading-tight">טריאתלון אולימפי</h1>
          {week ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Chip className="bg-accent text-[#10140a]">{PHASE[week.phase]}</Chip>
              <Chip>שבוע <span className="num ms-1">{week.index + 1}/{weeks.length}</span></Chip>
              {week.isRecovery && <Chip>התאוששות</Chip>}
            </div>
          ) : null}
          {week && <p className="mt-2 text-xs text-muted">{PHASE_DESC[week.phase]}</p>}
        </div>
      </Card>

      {daysLeft < 0 && <Card><p className="font-bold">המרוץ מאחוריך — כל הכבוד! 🏁</p></Card>}
      {notStarted && <Card><p className="font-bold">התוכנית מתחילה ב{fmtDateHe(weeks[0].start)}</p><p className="text-sm text-muted">עד אז — מנוחה ופעילות קלה לפי הרצון.</p></Card>}

      {!notStarted && daysLeft >= 0 && (
        <section className="space-y-3">
          <h2 className="px-1 text-sm font-bold text-muted">האימון להיום</h2>
          {todays.length ? (
            todays.map((s) => <SessionCard key={s.id} session={s} log={logs[s.id]} onLog={() => setEditing(s)} />)
          ) : (
            <Card><p className="text-lg font-bold">יום מנוחה 😴</p><p className="text-sm text-muted">התאוששות היא חלק מהאימון. שתה, אכול, תישן.</p></Card>
          )}
        </section>
      )}

      {next.length > 0 && (
        <section className="space-y-2">
          <h2 className="px-1 text-sm font-bold text-muted">בקרוב</h2>
          {next.map((s) => (
            <Card key={s.id} className="flex items-center justify-between py-3">
              <div><div className="font-bold">{s.title}</div><div className="text-xs text-muted">{fmtDateHe(s.date)}</div></div>
              <span className="num text-sm text-muted">{s.targetMin}′</span>
            </Card>
          ))}
        </section>
      )}

      <LogSheet session={editing} log={editing ? logs[editing.id] : undefined} onClose={() => setEditing(undefined)} onSave={(l) => { saveLog(l); setEditing(undefined); }} />
    </div>
  );
}
