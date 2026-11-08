import { useState } from 'react';
import { AREAS } from '../../i18n/he';
import type { Log, Session } from '../../types';
import { Button, inputCls, Label, Sheet } from '../../ui/ui';
import type { LogInput } from '../../store/useStore';

export function LogSheet({ session, log, onClose, onSave }: { session?: Session; log?: Log; onClose: () => void; onSave: (l: LogInput) => void }) {
  return (
    <Sheet open={!!session} onClose={onClose}>
      {session && <LogForm key={session.id} session={session} log={log} onClose={onClose} onSave={onSave} />}
    </Sheet>
  );
}

function LogForm({ session, log, onClose, onSave }: { session: Session; log?: Log; onClose: () => void; onSave: (l: LogInput) => void }) {
  const [completed, setCompleted] = useState(log?.completed ?? true);
  const [min, setMin] = useState(String(log?.actualMin ?? session.targetMin));
  const [km, setKm] = useState(String(log?.actualKm ?? session.targetKm ?? ''));
  const [rpe, setRpe] = useState(log?.rpe ?? session.plannedRpe);
  const [area, setArea] = useState(log?.pain?.area ?? '');
  const [level, setLevel] = useState<0 | 1 | 2 | 3>(log?.pain?.level ?? 0);

  const save = () =>
    onSave({
      sessionId: session.id, completed,
      actualMin: completed ? Number(min) || undefined : undefined,
      actualKm: completed && km ? Number(km) : undefined,
      rpe: completed ? rpe : undefined,
      pain: level > 0 && area ? { area, level } : undefined,
    });

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">{session.title}</h2>
      <div className="grid grid-cols-2 gap-2">
        <Button variant={completed ? 'primary' : 'ghost'} onClick={() => setCompleted(true)}>בוצע</Button>
        <Button variant={!completed ? 'danger' : 'ghost'} onClick={() => setCompleted(false)}>דולג</Button>
      </div>
      {completed && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>משך בפועל (דק׳)</Label><input className={inputCls} inputMode="numeric" value={min} onChange={(e) => setMin(e.target.value)} /></div>
            <div><Label>מרחק (ק״מ)</Label><input className={inputCls} inputMode="decimal" value={km} onChange={(e) => setKm(e.target.value)} /></div>
          </div>
          <div>
            <Label>עד כמה היה קשה? (RPE) — <span className="num font-bold text-fg">{rpe}/10</span></Label>
            <input type="range" min={1} max={10} value={rpe} onChange={(e) => setRpe(Number(e.target.value))} className="w-full accent-[var(--accent)]" />
            <div className="flex justify-between text-xs text-muted"><span>קל מאוד</span><span>מקסימלי</span></div>
          </div>
        </>
      )}
      <div>
        <Label>כאב?</Label>
        <div className="grid grid-cols-4 gap-2">
          {(['ללא', 'קל', 'בינוני', 'חזק'] as const).map((t, i) => (
            <Button key={t} variant={level === i ? 'primary' : 'ghost'} className="px-0 text-sm" onClick={() => setLevel(i as 0 | 1 | 2 | 3)}>{t}</Button>
          ))}
        </div>
        {level > 0 && (
          <select className={`${inputCls} mt-2`} value={area} onChange={(e) => setArea(e.target.value)}>
            <option value="">איפה?</option>
            {AREAS.map((a) => <option key={a}>{a}</option>)}
          </select>
        )}
      </div>
      <div className="flex gap-2">
        <Button className="flex-1" onClick={onClose}>ביטול</Button>
        <Button variant="primary" className="flex-[2]" disabled={level > 0 && !area} onClick={save}>שמור</Button>
      </div>
    </div>
  );
}
