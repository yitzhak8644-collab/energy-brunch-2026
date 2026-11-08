import { useMemo, useState } from 'react';
import { generatePlan } from '../../engine/generate';
import { AREAS, DISCLAIMER, PHASE, WEEKDAYS } from '../../i18n/he';
import { todayLocal } from '../../lib/dates';
import { fmtPace, fmtTime, parseTime } from '../../lib/format';
import { useStore } from '../../store/useStore';
import { DEFAULT_USER, type Experience, type Injury, type Profile, type Weekday } from '../../types';
import { Button, Card, Chip, inputCls, Label } from '../../ui/ui';
import { ImportFit } from '../settings/ImportFit';

const MINUTES = [0, 45, 60, 90, 120, 150, 180, 240];
const ORDER: Weekday[] = [6, 0, 1, 2, 3, 4, 5]; // ראשון … שבת
const DEFAULT_DAYS: Record<Weekday, number> = { 0: 60, 1: 60, 2: 60, 3: 60, 4: 150, 5: 120, 6: 60 };

const base = (): Profile => ({
  userId: DEFAULT_USER, raceDate: '2027-04-09', swimPace1k: 130, poolLength: 25, bikeLongestKm: 40, bikeAvgKmh: 25,
  run5kSec: 1680, weeklyHours: 8, longDay: 4, injuries: [], experience: 'some', source: 'manual',
  availableDays: Object.fromEntries(ORDER.map((d) => [d, { minutes: DEFAULT_DAYS[d] }])) as Profile['availableDays'],
});

export function Onboarding() {
  const onboard = useStore((s) => s.onboard);
  const [step, setStep] = useState(0);
  const [p, setP] = useState<Profile>(base);
  const [swimT, setSwimT] = useState('');
  const [run5, setRun5] = useState('');
  const [run10, setRun10] = useState('');
  const set = (patch: Partial<Profile>) => setP((x) => ({ ...x, ...patch }));
  const swimTime = swimT || fmtTime(p.swimPace1k * 10);
  const r5 = run5 || (p.run5kSec ? fmtTime(p.run5kSec) : '');
  const r10 = run10 || (p.run10kSec ? fmtTime(p.run10kSec) : '');

  const final = useMemo<Profile>(() => ({
    ...p,
    swimPace1k: (parseTime(swimTime) ?? p.swimPace1k * 10) / 10,
    run5kSec: parseTime(r5), run10kSec: parseTime(r10),
  }), [p, swimTime, r5, r10]);
  const preview = useMemo(() => (step === 6 ? generatePlan(final, todayLocal()) : undefined), [step, final]);

  const steps = ['ברוך הבא', 'שחייה', 'אופניים', 'ריצה', 'זמינות', 'פציעות', 'סיכום'];
  const toggleInjury = (area: string) => set({ injuries: p.injuries.some((i) => i.area === area) ? p.injuries.filter((i) => i.area !== area) : [...p.injuries, { area, severity: 1, active: true } as Injury] });

  return (
    <main className="mx-auto min-h-dvh max-w-md space-y-5 p-5">
      <div className="flex gap-1.5" aria-label={`שלב ${step + 1} מתוך ${steps.length}`}>
        {steps.map((_, i) => <span key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-accent' : 'bg-line'}`} />)}
      </div>
      <h1 className="font-display text-3xl font-extrabold">{steps[step]}</h1>

      {step === 0 && (
        <Card className="space-y-4">
          <p className="text-lg font-semibold">נבנה לך תוכנית אישית לטריאתלון אולימפי — <span className="text-accent-ink">9 באפריל 2027</span>.</p>
          <p className="text-sm text-muted">כמה שאלות קצרות על הכושר שלך. אפשר גם לייבא היסטוריה מ-Garmin כדי למלא הכל אוטומטית.</p>
          <ImportFit onResult={(patch) => { set(patch); setSwimT(''); setRun5(''); setRun10(''); }} />
          <div><Label>תאריך המרוץ</Label><input type="date" className={inputCls} value={p.raceDate} onChange={(e) => set({ raceDate: e.target.value })} /></div>
        </Card>
      )}
      {step === 1 && (
        <Card className="space-y-4">
          <div><Label>כמה זמן לוקח לך לשחות 1 ק״מ? (דק׳:שנ׳)</Label><input className={inputCls} dir="ltr" inputMode="numeric" placeholder="21:40" value={swimTime} onChange={(e) => setSwimT(e.target.value)} /></div>
          <p className="text-sm text-muted">קצב: <span className="num font-bold text-fg">{fmtPace(final.swimPace1k)}</span> ל-100 מ׳</p>
          <div><Label>אורך הבריכה</Label>
            <div className="grid grid-cols-2 gap-2">{([25, 50] as const).map((l) => <Button key={l} variant={p.poolLength === l ? 'primary' : 'ghost'} onClick={() => set({ poolLength: l })}>{l} מ׳</Button>)}</div>
          </div>
        </Card>
      )}
      {step === 2 && (
        <Card className="space-y-4">
          <div><Label>הרכיבה הארוכה ביותר לאחרונה (ק״מ)</Label><input className={inputCls} inputMode="decimal" value={p.bikeLongestKm} onChange={(e) => set({ bikeLongestKm: Number(e.target.value) || 0 })} /></div>
          <div><Label>מהירות ממוצעת באותה רכיבה (קמ״ש)</Label><input className={inputCls} inputMode="decimal" value={p.bikeAvgKmh} onChange={(e) => set({ bikeAvgKmh: Number(e.target.value) || 0 })} /></div>
        </Card>
      )}
      {step === 3 && (
        <Card className="space-y-4">
          <div><Label>זמן 5 ק״מ אחרון (דק׳:שנ׳)</Label><input className={inputCls} dir="ltr" inputMode="numeric" placeholder="28:00" value={r5} onChange={(e) => setRun5(e.target.value)} /></div>
          <div><Label>זמן 10 ק״מ (אם יש)</Label><input className={inputCls} dir="ltr" inputMode="numeric" placeholder="58:30" value={r10} onChange={(e) => setRun10(e.target.value)} /></div>
          <div><Label>דופק מרבי (אם ידוע)</Label><input className={inputCls} inputMode="numeric" value={p.maxHr ?? ''} onChange={(e) => set({ maxHr: Number(e.target.value) || undefined })} /></div>
        </Card>
      )}
      {step === 4 && (
        <Card className="space-y-4">
          <div><Label>כמה שעות בשבוע אתה יכול להתאמן?</Label><input className={inputCls} inputMode="decimal" value={p.weeklyHours} onChange={(e) => set({ weeklyHours: Number(e.target.value) || 0 })} /></div>
          <div><Label>ניסיון</Label>
            <div className="grid grid-cols-3 gap-2">{([['new', 'מתחיל'], ['some', 'בינוני'], ['experienced', 'מנוסה']] as [Experience, string][]).map(([k, t]) => <Button key={k} className="px-0" variant={p.experience === k ? 'primary' : 'ghost'} onClick={() => set({ experience: k })}>{t}</Button>)}</div>
          </div>
          <div>
            <Label>דקות זמינות בכל יום (0 = יום חופשי מאימון)</Label>
            <div className="space-y-2">
              {ORDER.map((d) => (
                <div key={d} className="flex items-center gap-3">
                  <span className="w-14 text-sm font-semibold">{WEEKDAYS[d]}</span>
                  <select className={`${inputCls} min-h-11 flex-1`} value={p.availableDays[d].minutes} onChange={(e) => set({ availableDays: { ...p.availableDays, [d]: { minutes: Number(e.target.value) } } })}>
                    {MINUTES.map((m) => <option key={m} value={m}>{m ? `${m} דק׳` : 'מנוחה'}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>
          <div><Label>יום לאימון הארוך</Label>
            <select className={inputCls} value={p.longDay} onChange={(e) => set({ longDay: Number(e.target.value) as Weekday })}>{ORDER.map((d) => <option key={d} value={d}>{WEEKDAYS[d]}</option>)}</select>
          </div>
        </Card>
      )}
      {step === 5 && (
        <Card className="space-y-4">
          <p className="text-sm text-muted">יש פציעה או כאב פעיל? סמן — נתאים את העומס.</p>
          <div className="flex flex-wrap gap-2">{AREAS.map((a) => <Button key={a} variant={p.injuries.some((i) => i.area === a) ? 'primary' : 'ghost'} className="min-h-10 px-4" onClick={() => toggleInjury(a)}>{a}</Button>)}</div>
          {p.injuries.map((i) => (
            <div key={i.area} className="flex items-center gap-3"><span className="w-16 text-sm font-semibold">{i.area}</span>
              <select className={`${inputCls} min-h-11 flex-1`} value={i.severity} onChange={(e) => set({ injuries: p.injuries.map((x) => (x.area === i.area ? { ...x, severity: Number(e.target.value) as Injury['severity'] } : x)) })}>
                <option value={1}>קל</option><option value={2}>בינוני</option><option value={3}>חזק</option>
              </select>
            </div>
          ))}
        </Card>
      )}
      {step === 6 && preview && (
        <Card className="space-y-3">
          <p className="font-semibold">התוכנית שלך: <span className="num">{preview.weeks.length}</span> שבועות עד המרוץ</p>
          <div className="flex flex-wrap gap-2">{(['base', 'build', 'peak', 'taper'] as const).map((ph) => <Chip key={ph}>{PHASE[ph]} · <span className="num ms-1">{preview.weeks.filter((w) => w.phase === ph).length}</span></Chip>)}</div>
          <p className="text-sm text-muted">שבוע ראשון: <span className="num">{Math.round(preview.weeks[0]?.targetMin / 6) / 10}</span> שעות · שיא: <span className="num">{Math.round(Math.max(...preview.weeks.map((w) => w.targetMin)) / 6) / 10}</span> שעות</p>
          <p className="text-xs text-muted">{DISCLAIMER}</p>
        </Card>
      )}

      <div className="flex gap-3">
        {step > 0 && <Button onClick={() => setStep(step - 1)}>חזרה</Button>}
        {step < 6 ? <Button variant="primary" className="flex-1" onClick={() => setStep(step + 1)}>המשך</Button> : <Button variant="primary" className="flex-1" onClick={() => onboard(final)}>התחל להתאמן 🚀</Button>}
      </div>
    </main>
  );
}
