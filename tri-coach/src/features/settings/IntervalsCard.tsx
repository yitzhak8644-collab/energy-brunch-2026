import { useState } from 'react';
import { todayLocal } from '../../lib/dates';
import { errorText, IntervalsProvider, type VerifyResult } from '../../sync/IntervalsProvider';
import { useStore } from '../../store/useStore';
import { Button, Card, inputCls, Label } from '../../ui/ui';

export const fmtWhen = (iso?: string) =>
  iso ? new Date(iso).toLocaleString('he-IL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'עדיין לא';

export function IntervalsCard() {
  const { settings, setIntervals, setAutoSync, syncIntervals, syncing, lockIntervals } = useStore();
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

  const NAMES = { swim: 'שחייה', bike: 'אופניים', run: 'ריצה' } as const;
  const summarize = (r: VerifyResult[]) => r.map((x) => `${NAMES[x.discipline]}: ${x.parsed ? `פוענח (${x.steps ?? '?'} צעדים)` : 'לא פוענח'}${x.externalIdOk ? '' : ', המזהה לא נשמר'}${x.pushErrors.length ? `, Garmin: ${x.pushErrors.join('; ')}` : ''}`).join(' · ');

  /** בדיקת מקצה לקצה על אימון אמיתי מכל ענף (נוצר רחוק בעתיד ונמחק מיד). */
  const verify = async (p: IntervalsProvider) => {
    const { weeks, zones } = useStore.getState();
    const today = todayLocal();
    const all = weeks.flatMap((w) => w.sessions);
    const samples = (['swim', 'bike', 'run'] as const).map((d) => all.find((x) => x.discipline === d && x.date >= today) ?? all.find((x) => x.discipline === d)).filter((x) => !!x);
    const res = await p.verifyWorkouts(samples, zones!, 45, today);
    return { res, idOk: res.every((x) => x.externalIdOk), allParsed: res.length > 0 && res.every((x) => x.parsed && !x.pushErrors.length) };
  };

  const connect = () => run(async () => {
    const key = apiKey.trim(), id = athleteId.trim();
    if (!key || !id) return { ok: false, text: 'צריך גם Athlete ID וגם API Key.' };
    const p = new IntervalsProvider({ athleteId: id, apiKey: key });
    const r = await p.testConnection(todayLocal());
    const v = await verify(p); // לפני הדחיפה הראשונה: external_id חייב לחזור, אחרת יווצרו כפילויות
    if (!v.idOk) return { ok: false, text: `החיבור תקין אך Intervals.icu לא שומר מזהה לאירועים, ולכן לא אדחוף אימונים (כדי לא ליצור כפילויות). ${summarize(v.res)}` };
    setIntervals({ athleteId: id, apiKey: key });
    setApiKey('');
    void syncIntervals();
    return { ok: v.allParsed, text: `מחובר${r.athleteName ? ` כ-${r.athleteName}` : ''}${r.wellnessOk ? '' : ' (מדדי התאוששות לא נגישים)'}. ${summarize(v.res)}. מסנכרן…` };
  });
  const test = () => run(async () => {
    const r = await provider().testConnection(todayLocal());
    return { ok: true, text: `החיבור תקין${r.athleteName ? ` (${r.athleteName})` : ''}${r.wellnessOk ? '' : ' — אבל מדדי ההתאוששות לא נגישים'}.` };
  });
  const testWorkout = () => run(async () => {
    const v = await verify(provider());
    if (!v.idOk) { lockIntervals('Intervals.icu לא שומר מזהה לאירועים — הדחיפה נחסמה כדי לא ליצור כפילויות. נתק וחבר מחדש.'); }
    return { ok: v.idOk && v.allParsed, text: `${summarize(v.res)}. אימוני הבדיקה נוצרו בעוד 45 יום ונמחקו מיד.` };
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
            <Button variant="primary" disabled={syncing || busy || !!cfg.idLost} onClick={() => void syncIntervals()}>{syncing ? 'מסנכרן…' : 'סנכרן עכשיו'}</Button>
            <Button disabled={busy} onClick={test}>בדוק חיבור</Button>
            <Button disabled={busy} onClick={testWorkout}>בדיקת אימונים (שחייה/אופניים/ריצה)</Button>
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
