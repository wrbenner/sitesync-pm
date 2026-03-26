import { useState } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { Dashboard } from './pages/Dashboard';
import { Drawings } from './pages/Drawings';
import { RFIs } from './pages/RFIs';
import { Submittals } from './pages/Submittals';
import { Schedule } from './pages/Schedule';
import { Budget } from './pages/Budget';
import { DailyLog } from './pages/DailyLog';
import { FieldCapture } from './pages/FieldCapture';
import { PunchList } from './pages/PunchList';
import { Crews } from './pages/Crews';
import { Directory } from './pages/Directory';
import { Meetings } from './pages/Meetings';
import { Files } from './pages/Files';
import { AICopilot } from './pages/AICopilot';
import { Vision } from './pages/Vision';
import { colors } from './styles/theme';

function App() {
  const [activeView, setActiveView] = useState('dashboard');

  const handleNavigate = (view: string) => {
    setActiveView(view);
  };

  return (
    <HashRouter>
      <div
        style={{
          display: 'flex',
          height: '100vh',
          backgroundColor: colors.lightBackground,
          fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        }}
      >
        <Sidebar activeView={activeView} onNavigate={handleNavigate} />

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <TopBar />

          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/drawings" element={<Drawings />} />
            <Route path="/rfis" element={<RFIs />} />
            <Route path="/submittals" element={<Submittals />} />
            <Route path="/schedule" element={<Schedule />} />
            <Route path="/budget" element={<Budget />} />
            <Route path="/daily-log" element={<DailyLog />} />
            <Route path="/field-capture" element={<FieldCapture />} />
            <Route path="/punch-list" element={<PunchList />} />
            <Route path="/crews" element={<Crews />} />
            <Route path="/directory" element={<Directory />} />
            <Route path="/meetings" element={<Meetings />} />
            <Route path="/files" element={<Files />} />
            <Route path="/copilot" element={<AICopilot />} />
            <Route path="/vision" element={<Vision />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </div>
    </HashRouter>
  );
}

export default App;
