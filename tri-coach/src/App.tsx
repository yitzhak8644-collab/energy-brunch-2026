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
  const [tab, setTab] = useState<Tab>('today');

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
