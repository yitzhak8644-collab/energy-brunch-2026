import { PHASE, PHASE_BAR, PHASE_DESC } from '../../i18n/he';
import { diffDays, todayLocal } from '../../lib/dates';
import { fmtDateHe } from '../../lib/format';
import { useStore } from '../../store/useStore';
import type { Phase } from '../../types';
import { Card } from '../../ui/ui';

export function PlanScreen() {
  const { weeks, adaptNotes } = useStore();
  const today = todayLocal();
  if (!weeks.length) return null;
  const max = Math.max(...weeks.map((w) => w.targetMin));
  const phases = (['base', 'build', 'peak', 'taper'] as Phase[]).map((p) => ({ p, n: weeks.filter((w) => w.phase === p).length })).filter((x) => x.n);

  return (
    <div className="space-y-4">
      <Card>
        <h2 className="mb-1 text-lg font-extrabold">מפת התוכנית</h2>
        <p className="mb-4 text-xs text-muted">גובה העמודה = נפח שבועי מתוכנן. הנקודה = השבוע הנוכחי.</p>
        <div className="flex h-36 items-end gap-[3px]" dir="rtl">
          {weeks.map((w) => {
            const isCur = diffDays(today, w.start) >= 0 && diffDays(today, w.end) <= 0;
            return (
              <div key={w.index} className="flex h-full flex-1 flex-col items-center justify-end gap-1" title={`שבוע ${w.index + 1}: ${w.targetMin} דק׳`}>
                {isCur && <span className="size-1.5 rounded-full bg-fg" />}
                <div className={`w-full rounded-t-md ${PHASE_BAR[w.phase]} ${w.isRecovery ? 'opacity-50' : ''}`} style={{ height: `${Math.max(6, (w.targetMin / max) * 100)}%` }} />
              </div>
            );
          })}
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        {phases.map(({ p, n }) => (
          <Card key={p} className="py-3">
            <div className="flex items-center gap-2"><span className={`size-3 rounded-full ${PHASE_BAR[p]}`} /><span className="font-bold">{PHASE[p]}</span><span className="num ms-auto text-sm text-muted">{n} שב׳</span></div>
            <p className="mt-1 text-xs text-muted">{PHASE_DESC[p]}</p>
          </Card>
        ))}
      </div>

      <section className="space-y-2">
        <h2 className="px-1 text-sm font-bold text-muted">התאמות אחרונות של המאמן</h2>
        {adaptNotes.length === 0 && <Card><p className="text-sm text-muted">עדיין אין התאמות. המאמן יעדכן את התוכנית אחרי שתרשום אימונים.</p></Card>}
        {[...adaptNotes].reverse().slice(0, 12).map((n) => (
          <Card key={n.id} className="py-3">
            <p className="text-sm">{n.text}</p>
            <p className="mt-1 text-xs text-muted">{fmtDateHe(n.date, { day: 'numeric', month: 'long' })}</p>
          </Card>
        ))}
      </section>
    </div>
  );
}
