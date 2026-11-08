import { fmtWhen } from '../settings/IntervalsCard';
import { useStore } from '../../store/useStore';

/** שורת מצב סנכרון קטנה במסך היום. */
export function SyncBadge() {
  const { settings, syncing, syncIntervals } = useStore();
  const cfg = settings.intervals;
  if (!cfg) return null;
  return (
    <button onClick={() => void syncIntervals()} disabled={syncing} className="flex w-full items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-4 py-2 text-start text-xs">
      <span className={cfg.error ? 'text-danger' : 'text-muted'}>
        {syncing ? 'מסנכרן עם Intervals.icu…' : cfg.error ? cfg.error : `סונכרן ${fmtWhen(cfg.lastSyncAt)}${cfg.lastReport?.pushed.created ? ` · ${cfg.lastReport.pushed.created} אימונים נוספו לשעון` : ''}`}
      </span>
      <span className="font-bold text-accent-ink">סנכרן</span>
    </button>
  );
}
