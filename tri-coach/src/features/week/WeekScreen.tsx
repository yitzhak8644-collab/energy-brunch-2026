import { useEffect, useState } from 'react';
import { DISC_COLOR, DISCIPLINE, PHASE } from '../../i18n/he';
import { diffDays, todayLocal } from '../../lib/dates';
import { fmtDateHe } from '../../lib/format';
import { useStore } from '../../store/useStore';
import type { Discipline, Session } from '../../types';
import { Button, Card, Chip, Dur } from '../../ui/ui';
import { LogSheet } from '../today/LogSheet';

const DISCS: Discipline[] = ['swim', 'bike', 'run'];

export function WeekScreen() {
  const { weeks, logs, saveLog } = useStore();
  const today = todayLocal();
  const cur = Math.max(0, weeks.findIndex((w) => diffDays(today, w.start) >= 0 && diffDays(today, w.end) <= 0));
  const [idx, setIdx] = useState(cur);
  const [editing, setEditing] = useState<Session>();
  useEffect(() => setIdx(cur), [cur]);
  const w = weeks[idx];
  if (!w) return null;

  const planned: Record<string, number> = {};
  const done: Record<string, number> = {};
  for (const s of w.sessions) {
    planned[s.discipline] = (planned[s.discipline] ?? 0) + s.targetMin;
    const l = logs[s.id];
    if (l?.completed) done[s.discipline] = (done[s.discipline] ?? 0) + (l.actualMin ?? s.targetMin);
  }
  const totalPlanned = DISCS.reduce((a, d) => a + (planned[d] ?? 0), 0);
  const totalDone = DISCS.reduce((a, d) => a + (done[d] ?? 0), 0);
  const maxBar = Math.max(1, ...DISCS.map((d) => planned[d] ?? 0));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button onClick={() => setIdx(Math.max(0, idx - 1))} disabled={idx === 0} aria-label="שבוע קודם">→</Button>
        <div className="text-center">
          <div className="font-display text-lg font-extrabold">שבוע <span className="num">{w.index + 1}</span></div>
          <div className="text-xs text-muted">{fmtDateHe(w.start, { day: 'numeric', month: 'short' })} – {fmtDateHe(w.end, { day: 'numeric', month: 'short' })}</div>
        </div>
        <Button onClick={() => setIdx(Math.min(weeks.length - 1, idx + 1))} disabled={idx === weeks.length - 1} aria-label="שבוע הבא">←</Button>
      </div>

      <Card>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Chip className="bg-accent text-[#10140a]">{PHASE[w.phase]}</Chip>
          {w.isRecovery && <Chip>שבוע התאוששות</Chip>}
          {w.adjust !== 1 && <Chip>התאמה <span className="num ms-1">{Math.round(w.adjust * 100)}%</span></Chip>}
        </div>
        <div className="mb-4 flex items-baseline gap-2">
          <span className="font-display text-3xl font-extrabold"><Dur min={totalDone} /></span>
          <span className="text-sm text-muted">מתוך <Dur min={totalPlanned} /></span>
        </div>
        <div className="space-y-3">
          {DISCS.map((d) => (
            <div key={d}>
              <div className="mb-1 flex justify-between text-xs"><span className="font-semibold">{DISCIPLINE[d]}</span><span className="num text-muted">{done[d] ?? 0} / {planned[d] ?? 0}′</span></div>
              <div className="relative h-3 overflow-hidden rounded-full bg-surface2">
                <div className={`absolute inset-y-0 start-0 rounded-full opacity-35 ${DISC_COLOR[d]}`} style={{ width: `${((planned[d] ?? 0) / maxBar) * 100}%` }} />
                <div className={`absolute inset-y-0 start-0 rounded-full ${DISC_COLOR[d]}`} style={{ width: `${((done[d] ?? 0) / maxBar) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </Card>

      <section className="space-y-2">
        {w.sessions.map((s) => {
          const l = logs[s.id];
          return (
            <button key={s.id} onClick={() => s.discipline !== 'race' && setEditing(s)} className="block w-full text-start">
              <Card className="relative flex items-center gap-3 overflow-hidden py-3">
                <span className={`absolute inset-y-0 start-0 w-1.5 ${DISC_COLOR[s.discipline]}`} />
                <div className="ms-1 min-w-0 flex-1">
                  <div className="truncate font-bold">{s.title}</div>
                  <div className="text-xs text-muted">{fmtDateHe(s.date)}</div>
                </div>
                <div className="text-end">
                  <div className="num text-sm font-bold">{s.targetMin}′</div>
                  <div className="text-xs">{l?.completed ? '✓' : l ? 'דולג' : ''}</div>
                </div>
              </Card>
            </button>
          );
        })}
        {!w.sessions.length && <Card><p className="text-muted">אין אימונים בשבוע הזה.</p></Card>}
      </section>
      <LogSheet session={editing} log={editing ? logs[editing.id] : undefined} onClose={() => setEditing(undefined)} onSave={(l) => { saveLog(l); setEditing(undefined); }} />
    </div>
  );
}
