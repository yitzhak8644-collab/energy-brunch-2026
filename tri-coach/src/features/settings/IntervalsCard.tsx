import { useState } from 'react';
import { todayLocal, addDays } from '../../lib/dates';
import { errorText, IntervalsProvider } from '../../sync/IntervalsProvider';
import { useStore } from '../../store/useStore';
import { Button, Card, inputCls, Label } from '../../ui/ui';

export const fmtWhen = (iso?: string) =>
  iso ? new Date(iso).toLocaleString('he-IL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'עדיין לא';

export function IntervalsCard() {
  const { settings, setIntervals, setAutoSync, syncIntervals, syncing } = useStore();
  const cfg = settings.intervals;
  const [athleteId, setAthleteId] = useState(cfg?.athleteId ?? '');
  const [apiKey, setApiKey] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string }>();
  const [busy, setBusy] = useState(false);

  const provider = () => new IntervalsProvider({ athleteId: cfg!.athleteId, apiKey: cfg!.apiKey });
  const run = async (f: () => Promise<{ ok: boolean; text: string }>) => {
    setBusy(true); setMsg(undefined);
    try { setMsg(await f()); } catch (e) { setMsg({ ok: false, text: errorText(e) }); } finally { setBusy(false); }
  };

  const connect = () => run(async () => {
    const key = apiKey.trim(), id = athleteId.trim();
    if (!key || !id) return { ok: false, text: 'צריך גם Athlete ID וגם API Key.' };
    const p = new IntervalsProvider({ athleteId: id, apiKey: key });
    const r = await p.testConnection(todayLocal());
    setIntervals({ athleteId: id, apiKey: key });
    setApiKey('');
    void syncIntervals();
    return { ok: true, text: `מחובר${r.athleteName ? ` כ-${r.athleteName}` : ''}${r.wellnessOk ? '' : ' (מדדי התאוששות לא נגישים)'} — מסנכרן…` };
  });
  const test = () => run(async () => {
    const r = await provider().testConnection(todayLocal());
    return { ok: true, text: `החיבור תקין${r.athleteName ? ` (${r.athleteName})` : ''}${r.wellnessOk ? '' : ' — אבל מדדי ההתאוששות לא נגישים'}.` };
  });
  const testWorkout = () => run(async () => {
    const r = await provider().sendTestWorkout(addDays(todayLocal(), 1));
    if (r.pushErrors.length) return { ok: false, text: `אימון הבדיקה נוצר אך Garmin דיווח: ${r.pushErrors.join('; ')}` };
    return r.parsed
      ? { ok: true, text: `אימון בדיקה נוצר ונקרא בהצלחה (${Math.round((r.movingTime ?? 0) / 60)} דק׳, ${r.steps ?? '?'} צעדים) ונמחק. הפורמט תקין.` }
      : { ok: false, text: 'האימון נוצר אך Intervals.icu לא פענח אותו (אין משך). בדוק בלוח השנה שם.' };
  });

  const rep = cfg?.lastReport;
  return (
    <Card className="space-y-3">
      <h2 className="text-lg font-extrabold">סנכרון אוטומטי לשעון (Intervals.icu)</h2>
      {!cfg ? (
        <>
          <p className="text-sm text-muted">מחבר את האפליקציה ל-Intervals.icu, שמסונכרן ל-Garmin Connect והשעון. המפתח נשמר רק בדפדפן הזה.</p>
          <div><Label>Athlete ID (למשל i12345)</Label><input className={inputCls} dir="ltr" autoCapitalize="none" autoCorrect="off" value={athleteId} onChange={(e) => setAthleteId(e.target.value)} /></div>
          <div><Label>API Key</Label><input className={inputCls} dir="ltr" type="password" autoComplete="off" value={apiKey} onChange={(e) => setApiKey(e.target.value)} /></div>
          <Button variant="primary" className="w-full" disabled={busy} onClick={connect}>{busy ? 'מתחבר…' : 'חבר ובדוק'}</Button>
        </>
      ) : (
        <>
          <p className="text-sm">מחובר · <span className="num">{cfg.athleteId}</span> · סנכרון אחרון: <b>{fmtWhen(cfg.lastSyncAt)}</b></p>
          {cfg.error && <p className="rounded-2xl bg-danger/15 p-3 text-sm text-danger">{cfg.error}</p>}
          {rep && (
            <ul className="space-y-1 rounded-2xl bg-surface2 p-3 text-sm">
              <li>נמשכו <span className="num">{rep.pulled.activities}</span> פעילויות · נרשמו אוטומטית <span className="num">{rep.pulled.autoLogged}</span> · מדדי התאוששות <span className="num">{rep.pulled.metrics}</span></li>
              <li>ביומן: <span className="num">{rep.pushed.created}</span> נוספו · <span className="num">{rep.pushed.updated}</span> עודכנו · <span className="num">{rep.pushed.deleted}</span> הוסרו · <span className="num">{rep.pushed.unchanged}</span> ללא שינוי</li>
              {rep.errors.map((e) => <li key={e} className="text-danger">{e}</li>)}
              {rep.pushErrors.map((p, i) => <li key={i} className="text-danger">{p.date} {p.name}: {p.message}</li>)}
            </ul>
          )}
          <label className="flex items-center justify-between gap-3 rounded-2xl bg-surface2 px-4 py-3 text-sm font-semibold">
            סנכרון אוטומטי בפתיחת האפליקציה
            <input type="checkbox" className="size-5 accent-[var(--accent)]" checked={settings.autoSync} onChange={(e) => setAutoSync(e.target.checked)} />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="primary" disabled={syncing || busy} onClick={() => void syncIntervals()}>{syncing ? 'מסנכרן…' : 'סנכרן עכשיו'}</Button>
            <Button disabled={busy} onClick={test}>בדוק חיבור</Button>
            <Button disabled={busy} onClick={testWorkout}>שלח אימון בדיקה</Button>
            <Button variant="danger" disabled={busy} onClick={() => { if (confirm('לנתק? המפתח יימחק מהמכשיר (אימונים שכבר ביומן יישארו).')) setIntervals(undefined); }}>נתק</Button>
          </div>
          <p className="text-xs text-muted">הסנכרון רץ בכל פתיחה של האפליקציה (עד פעם ב-15 דקות) ואחרי שינוי תוכנית. אפליקציית אינטרנט לא יכולה לסנכרן ברקע כשהיא סגורה.</p>
        </>
      )}
      {msg && <p className={`text-sm font-semibold ${msg.ok ? 'text-accent-ink' : 'text-danger'}`}>{msg.text}</p>}
      <details className="rounded-2xl bg-surface2 p-3 text-sm">
        <summary className="cursor-pointer font-bold">איך מחברים? (3 צעדים)</summary>
        <ol className="mt-2 list-decimal space-y-2 ps-5 text-muted">
          <li>פתח חשבון חינמי ב-intervals.icu ובתפריט Settings מצא את ה-<b>Athlete ID</b> ואת ה-<b>API Key</b> (אפשר ליצור שם מפתח חדש).</li>
          <li>באותו מסך Settings חבר את <b>Garmin</b> ישירות ל-Intervals.icu (לא דרך Strava), ואשר העלאה של אימונים מתוכננים ל-Garmin Connect.</li>
          <li>הדבק כאן את שני הערכים ולחץ "חבר ובדוק", ואז "שלח אימון בדיקה" כדי לוודא שהכל תקין. הוסף גם דופק מרבי ב-Intervals.icu כדי שיעדי הדופק יתאימו.</li>
        </ol>
      </details>
    </Card>
  );
}
