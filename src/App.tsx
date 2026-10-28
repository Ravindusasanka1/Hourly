import { useState } from 'react';
import { BottomNav, type TabId } from './components/BottomNav';
import { HistoryPage } from './pages/HistoryPage';
import { SettingsPage } from './pages/SettingsPage';
import { StatsPage } from './pages/StatsPage';
import { TimerPage } from './pages/TimerPage';

export default function App() {
  const [tab, setTab] = useState<TabId>('timer');

  return (
    <div className="min-h-full">
      <main className="mx-auto w-full max-w-md px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-28">
        {tab === 'timer' && <TimerPage onOpenSettings={() => setTab('settings')} />}
        {tab === 'history' && <HistoryPage />}
        {tab === 'stats' && <StatsPage />}
        {tab === 'settings' && <SettingsPage />}
      </main>
      <BottomNav active={tab} onChange={setTab} />
    </div>
  );
}
