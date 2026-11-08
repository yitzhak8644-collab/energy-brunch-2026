import { useEffect, useState } from 'react';
import { Onboarding } from './features/onboarding/Onboarding';
import { PlanScreen } from './features/plan/PlanScreen';
import { SettingsScreen } from './features/settings/SettingsScreen';
import { TodayScreen } from './features/today/TodayScreen';
import { WeekScreen } from './features/week/WeekScreen';
import { useStore } from './store/useStore';
import { TabBar, type Tab } from './ui/ui';

export default function App() {
  const hydrated = useStore((s) => s.hydrated);
  const hasProfile = useStore((s) => !!s.profile);
  const runAdapt = useStore((s) => s.runAdapt);
  const configured = useStore((s) => !!s.settings.intervals?.apiKey);
  const [tab, setTab] = useState<Tab>('today');

  // סנכרון אוטומטי: בפתיחה ובחזרה לאפליקציה (מוגבל ל-15 דק׳), ודחיפה מושהית אחרי שינוי תוכנית
  useEffect(() => {
    if (!hydrated || !hasProfile || !configured) return;
    const sync = () => void useStore.getState().syncIntervals({ auto: true });
    sync();
    const onVisible = () => document.visibilityState === 'visible' && sync();
    document.addEventListener('visibilitychange', onVisible);
    let t: ReturnType<typeof setTimeout> | undefined;
    const unsub = useStore.subscribe((s, prev) => {
      if (s.weeks === prev.weeks || s.syncing || !s.settings.autoSync) return;
      clearTimeout(t);
      t = setTimeout(() => void useStore.getState().syncIntervals({ pushOnly: true }), 4000);
    });
    return () => { document.removeEventListener('visibilitychange', onVisible); unsub(); clearTimeout(t); };
  }, [hydrated, hasProfile, configured]);

  useEffect(() => {
    if (!hydrated || !hasProfile) return;
    runAdapt();
    const onVisible = () => document.visibilityState === 'visible' && runAdapt();
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [hydrated, hasProfile, runAdapt]);

  if (!hydrated) return <div className="grid min-h-dvh place-items-center text-muted">טוען…</div>;
  if (!hasProfile) return <Onboarding />;
  return (
    <>
      <main className="mx-auto max-w-md p-4 pb-28">
        {tab === 'today' && <TodayScreen />}
        {tab === 'week' && <WeekScreen />}
        {tab === 'plan' && <PlanScreen />}
        {tab === 'settings' && <SettingsScreen />}
      </main>
      <TabBar tab={tab} onChange={setTab} />
    </>
  );
}
