import { useRef, useState } from 'react';
import { calibrate, type Calibration } from '../../engine/calibrate';
import { addDays, todayLocal } from '../../lib/dates';
import type { Profile } from '../../types';
import { Button } from '../../ui/ui';

/** ייבוא היסטוריה מקבצי FIT / ZIP של Garmin (6 חודשים אחרונים) וכיול. */
export function ImportFit({ onResult }: { onResult: (patch: Partial<Profile>, cal: Calibration) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string>();
  const [cal, setCal] = useState<Calibration>();
  const [err, setErr] = useState<string>();

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setErr(undefined); setBusy('קורא קבצים…');
    try {
      const today = todayLocal();
      const { importFiles } = await import('../../lib/fitImport');
      const acts = await importFiles([...files], { sinceDate: addDays(today, -26 * 7), onProgress: (d, t) => setBusy(`מפענח ${d}/${t}`) });
      const c = calibrate(acts, today);
      setCal(c);
      if (!Object.keys(c.patch).length) setErr('לא נמצאו פעילויות שחייה/אופניים/ריצה ב-6 החודשים האחרונים.');
      else onResult(c.patch, c);
    } catch {
      setErr('לא הצלחתי לקרוא את הקבצים. ודא שזה ZIP/FIT מייצוא הנתונים של Garmin.');
    } finally { setBusy(undefined); if (ref.current) ref.current.value = ''; }
  };

  return (
    <div className="space-y-3">
      <input ref={ref} type="file" multiple accept=".fit,.zip" className="hidden" onChange={(e) => onFiles(e.target.files)} />
      <Button className="w-full" disabled={!!busy} onClick={() => ref.current?.click()}>{busy ?? 'ייבוא קבצי FIT / ZIP מ-Garmin'}</Button>
      {err && <p className="text-sm text-danger">{err}</p>}
      {cal && !err && (
        <ul className="space-y-1 rounded-2xl bg-surface2 p-3 text-sm">
          <li className="font-bold">נמצאו <span className="num">{cal.summary.activities}</span> פעילויות</li>
          {cal.notes.map((n) => <li key={n} className="text-muted">{n}</li>)}
        </ul>
      )}
      <p className="text-xs text-muted">איך מייצאים? ב-Garmin Connect (אתר): הגדרות ← ניהול נתונים ← ייצוא הנתונים שלך. מעלים כאן את קובץ ה-ZIP שמגיע במייל.</p>
    </div>
  );
}
