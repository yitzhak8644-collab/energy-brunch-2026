import { useRef, useState } from 'react';
import { DISCLAIMER } from '../../i18n/he';
import { useStore } from '../../store/useStore';
import { Button, Card, inputCls, Label } from '../../ui/ui';
import { ImportFit } from './ImportFit';

export function SettingsScreen() {
  const { profile, replan, exportState, importState, reset } = useStore();
  const [race, setRace] = useState(profile?.raceDate ?? '');
  const [hours, setHours] = useState(String(profile?.weeklyHours ?? 8));
  const [msg, setMsg] = useState<string>();
  const fileRef = useRef<HTMLInputElement>(null);
  if (!profile) return null;

  const download = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([exportState()], { type: 'application/json' }));
    a.download = 'tri-coach-backup.json';
    a.click();
  };
  const restore = async (f?: File) => {
    if (!f) return;
    try { importState(await f.text()); setMsg('הגיבוי נטען.'); } catch { setMsg('קובץ גיבוי לא תקין.'); }
  };

  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <h2 className="text-lg font-extrabold">המרוץ והזמינות</h2>
        <div><Label>תאריך המרוץ</Label><input type="date" className={inputCls} value={race} onChange={(e) => setRace(e.target.value)} /></div>
        <div><Label>שעות אימון זמינות בשבוע</Label><input className={inputCls} inputMode="decimal" value={hours} onChange={(e) => setHours(e.target.value)} /></div>
        <Button variant="primary" className="w-full" onClick={() => { replan({ raceDate: race, weeklyHours: Number(hours) || profile.weeklyHours }); setMsg('התוכנית חושבה מחדש מהיום והלאה.'); }}>חשב תוכנית מחדש</Button>
        <p className="text-xs text-muted">שבועות שכבר עברו נשמרים; השבועות הבאים נבנים מחדש עד תאריך המרוץ.</p>
      </Card>

      <Card className="space-y-3">
        <h2 className="text-lg font-extrabold">כיול מ-Garmin</h2>
        <ImportFit onResult={(patch) => { replan(patch); setMsg('הפרופיל עודכן מההיסטוריה והתוכנית חושבה מחדש.'); }} />
      </Card>

      <Card className="space-y-3">
        <h2 className="text-lg font-extrabold">גיבוי</h2>
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={download}>ייצוא JSON</Button>
          <Button onClick={() => fileRef.current?.click()}>ייבוא JSON</Button>
        </div>
        <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={(e) => restore(e.target.files?.[0])} />
        <Button variant="danger" className="w-full" onClick={() => { if (confirm('למחוק את כל הנתונים והתוכנית?')) reset(); }}>איפוס מלא</Button>
      </Card>

      {msg && <p className="px-1 text-sm font-semibold text-accent-ink">{msg}</p>}
      <p className="px-1 text-xs text-muted">{DISCLAIMER}</p>
    </div>
  );
}
