import { useState } from 'react';
import { DISC_COLOR, DISCIPLINE } from '../../i18n/he';
import { fmtDur, fmtPace } from '../../lib/format';
import type { Log, Session, StepTarget, WorkoutStep } from '../../types';
import { Button, Card, Chip, Dur } from '../../ui/ui';

function targetText(t: StepTarget | undefined, d: Session['discipline']): string {
  if (!t) return '';
  // LRI/PDI: טווח מספרים נקרא משמאל לימין גם בתוך טקסט עברי
  const rng = (a: number | string, b: number | string) => `\u2066${a}–${b}\u2069`;
  if (t.type === 'pace' && t.low && t.high) return `${rng(fmtPace(t.low), fmtPace(t.high))} ${d === 'swim' ? 'ל-100 מ׳' : 'לק״מ'}`;
  if (t.type === 'hr' && t.low && t.high) return `דופק ${rng(t.low, t.high)}`;
  if (t.type === 'rpe' && t.low && t.high) return `מאמץ ${rng(t.low, t.high)} מתוך 10`;
  return '';
}
function stepLine(s: WorkoutStep, d: Session['discipline']): string {
  const amount = s.distanceM ? (s.distanceM >= 1000 ? `${s.distanceM / 1000} ק״מ` : `${s.distanceM} מ׳`) : s.durationSec ? fmtDur(s.durationSec / 60) : '';
  return [s.label, amount, targetText(s.target, d)].filter(Boolean).join(' · ');
}
function Steps({ steps, d }: { steps: WorkoutStep[]; d: Session['discipline'] }) {
  return (
    <ol className="space-y-1.5 text-sm">
      {steps.map((s, i) =>
        s.kind === 'repeat' ? (
          <li key={i} className="rounded-2xl bg-surface2 p-3">
            <div className="mb-1 font-display font-bold"><span className="num">{s.repeat}×</span></div>
            <Steps steps={s.children ?? []} d={d} />
          </li>
        ) : (
          <li key={i} className="text-muted"><span className="font-semibold text-fg">{stepLine(s, d)}</span></li>
        ),
      )}
    </ol>
  );
}

export function SessionCard({ session, log, onLog }: { session: Session; log?: Log; onLog: () => void }) {
  const [open, setOpen] = useState(false);
  const done = !!log?.completed;
  const download = async () => {
    const { fitFileName, sessionToFit } = await import('../../engine/toFit');
    const blob = new Blob([sessionToFit(session) as BlobPart], { type: 'application/octet-stream' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = fitFileName(session);
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  return (
    <Card className="relative overflow-hidden">
      <span className={`absolute inset-y-0 start-0 w-1.5 ${DISC_COLOR[session.discipline]}`} />
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold text-muted">{DISCIPLINE[session.discipline]}{session.brick ? ' · Brick' : ''}</div>
          <h3 className="text-lg font-bold leading-tight">{session.title}</h3>
        </div>
        {done && <Chip className="bg-accent text-[#10140a]">בוצע ✓</Chip>}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Chip><Dur min={session.targetMin} /></Chip>
        {!!session.targetKm && <Chip><span className="num">{session.targetKm}</span>&nbsp;ק״מ</Chip>}
        <Chip>מאמץ <span className="num ms-1">{session.plannedRpe}/10</span></Chip>
      </div>
      {done && log && (
        <p className="mt-2 text-sm text-muted">
          בפועל: <span className="num">{log.actualMin ?? session.targetMin}</span> דק׳{log.rpe ? <> · RPE <span className="num">{log.rpe}</span></> : null}
        </p>
      )}
      <button className="mt-3 text-sm font-semibold text-accent-ink" onClick={() => setOpen(!open)}>{open ? 'הסתר פירוט' : 'הצג פירוט אימון'}</button>
      {open && <div className="mt-2"><Steps steps={session.steps} d={session.discipline} /></div>}
      <div className="mt-4 flex gap-2">
        {session.discipline !== 'race' && <Button variant={done ? 'ghost' : 'primary'} className="flex-1" onClick={onLog}>{done ? 'עדכן רישום' : 'רשום אימון'}</Button>}
        {session.discipline !== 'race' && <Button onClick={download} aria-label="הורד קובץ FIT לשעון">⬇ FIT</Button>}
        {session.discipline === 'race' && <Button variant="primary" className="flex-1" onClick={onLog}>רשום תוצאה</Button>}
      </div>
    </Card>
  );
}
