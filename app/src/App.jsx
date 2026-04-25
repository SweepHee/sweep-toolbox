import { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import Sidebar from '@/components/layout/Sidebar';
import TitleBar from '@/components/layout/TitleBar';
import Home from '@/pages/Home';
import History from '@/pages/History';
import Settings from '@/pages/Settings';
import { useConverterStore } from '@/store';

export default function App() {
  const loadHistory = useConverterStore(s => s.loadHistory);
  useEffect(() => {
    loadHistory();
    window.electronAPI?.onHistoryUpdated(() => loadHistory());
  }, []);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#0f0f1a]">
      <TitleBar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/history" element={<History />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
