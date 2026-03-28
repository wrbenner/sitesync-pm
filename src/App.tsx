import React, { Suspense, lazy, useState, useEffect } from 'react';
import { HashRouter, Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Home, LayoutGrid, FileText, HelpCircle, ClipboardList, Calendar,
  DollarSign, Users, CheckSquare, BookOpen, Zap, Eye, Briefcase, ListChecks, MessageCircle,
  Heart, Clock,
} from 'lucide-react';
import { SidebarContext, ToastProvider, CommandPalette, Skeleton } from './components/Primitives';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Sidebar } from './components/Sidebar';
import { MobileLayout } from './components/layout/MobileLayout';
import { OfflineBanner } from './components/ui/OfflineBanner';
import { useUiStore, useAIAnnotationStore, useAuthStore, useProjectContext } from './stores';
import { tasks, rfis, directory } from './data/mockData';
import { colors, layout } from './styles/theme';
import { pageTransition } from './components/transitions/variants';
import { AIContextPanel } from './components/ai/AIContextPanel';
import { FloatingAIButton } from './components/ai/FloatingAIButton';
import { NotificationCenter } from './components/notifications/NotificationCenter';
import { ShortcutOverlay } from './components/ui/ShortcutOverlay';
import { ExportCenter } from './components/export/ExportCenter';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import type { Shortcut } from './hooks/useKeyboardShortcuts';
import { isSupabaseConfigured } from './lib/supabase';
import { queryClient } from './api/queryClient';

// Lazy loaded pages
const Dashboard = lazy(() => import('./pages/Dashboard').then((m) => ({ default: m.Dashboard })));
const Tasks = lazy(() => import('./pages/Tasks').then((m) => ({ default: m.Tasks })));
const Drawings = lazy(() => import('./pages/Drawings').then((m) => ({ default: m.Drawings })));
const RFIs = lazy(() => import('./pages/RFIs').then((m) => ({ default: m.RFIs })));
const Submittals = lazy(() => import('./pages/Submittals').then((m) => ({ default: m.Submittals })));
const Schedule = lazy(() => import('./pages/Schedule').then((m) => ({ default: m.Schedule })));
const Budget = lazy(() => import('./pages/Budget').then((m) => ({ default: m.Budget })));
const DailyLog = lazy(() => import('./pages/DailyLog').then((m) => ({ default: m.DailyLog })));
const FieldCapture = lazy(() => import('./pages/FieldCapture').then((m) => ({ default: m.FieldCapture })));
const PunchList = lazy(() => import('./pages/PunchList').then((m) => ({ default: m.PunchList })));
const Crews = lazy(() => import('./pages/Crews').then((m) => ({ default: m.Crews })));
const Directory = lazy(() => import('./pages/Directory').then((m) => ({ default: m.Directory })));
const Meetings = lazy(() => import('./pages/Meetings').then((m) => ({ default: m.Meetings })));
const Files = lazy(() => import('./pages/Files').then((m) => ({ default: m.Files })));
const AICopilot = lazy(() => import('./pages/AICopilot').then((m) => ({ default: m.AICopilot })));
const Vision = lazy(() => import('./pages/Vision').then((m) => ({ default: m.Vision })));
const Lookahead = lazy(() => import('./pages/Lookahead').then((m) => ({ default: m.Lookahead })));
const Activity = lazy(() => import('./pages/Activity').then((m) => ({ default: m.Activity })));
const TimeMachine = lazy(() => import('./pages/TimeMachine').then((m) => ({ default: m.TimeMachine })));
const ProjectHealth = lazy(() => import('./pages/ProjectHealth').then((m) => ({ default: m.ProjectHealth })));
const Onboarding = lazy(() => import('./pages/Onboarding').then((m) => ({ default: m.Onboarding })));
const NotFound = lazy(() => import('./pages/errors/NotFound').then((m) => ({ default: m.NotFound })));

// Auth pages
const Login = lazy(() => import('./pages/auth/Login').then((m) => ({ default: m.Login })));
const Register = lazy(() => import('./pages/auth/Register').then((m) => ({ default: m.Register })));

// Admin pages
const UserManagement = lazy(() => import('./pages/admin/UserManagement').then((m) => ({ default: m.UserManagement })));
const ProjectSettingsPage = lazy(() => import('./pages/admin/ProjectSettings').then((m) => ({ default: m.ProjectSettings })));

const typographyConfig = { fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' };

const MOBILE_BREAKPOINT = 768;

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < MOBILE_BREAKPOINT);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return isMobile;
}

function PageLoader() {
  return (
    <div style={{ padding: '32px', maxWidth: layout.contentMaxWidth, margin: '0 auto' }}>
      <Skeleton width="200px" height="28px" />
      <div style={{ marginTop: '16px' }}><Skeleton width="100%" height="16px" /></div>
      <div style={{ marginTop: '8px' }}><Skeleton width="80%" height="16px" /></div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginTop: '32px' }}>
        {[1, 2, 3, 4].map((i) => <Skeleton key={i} width="100%" height="100px" />)}
      </div>
      <div style={{ marginTop: '24px' }}><Skeleton width="100%" height="300px" /></div>
    </div>
  );
}

function AnimatedPage({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={pageTransition.initial}
      animate={pageTransition.animate}
      exit={pageTransition.exit}
      transition={pageTransition.transition}
    >
      {children}
    </motion.div>
  );
}

// Auth guard: redirects to login if not authenticated (only when Supabase is configured)
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { profile, loading, initialized } = useAuthStore();

  if (!initialized || loading) {
    return <PageLoader />;
  }

  // If Supabase is not configured, allow access (development mode)
  if (!isSupabaseConfigured) {
    return <>{children}</>;
  }

  if (!profile) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Suspense fallback={<PageLoader />}>
        <Routes location={location} key={location.pathname}>
          {/* Auth routes (no guard) */}
          <Route path="/login" element={<AnimatedPage><Login /></AnimatedPage>} />
          <Route path="/register" element={<AnimatedPage><Register /></AnimatedPage>} />

          {/* Protected routes */}
          <Route path="/" element={<RequireAuth><AnimatedPage><Dashboard /></AnimatedPage></RequireAuth>} />
          <Route path="/dashboard" element={<RequireAuth><AnimatedPage><Dashboard /></AnimatedPage></RequireAuth>} />
          <Route path="/tasks" element={<RequireAuth><AnimatedPage><Tasks /></AnimatedPage></RequireAuth>} />
          <Route path="/drawings" element={<RequireAuth><AnimatedPage><Drawings /></AnimatedPage></RequireAuth>} />
          <Route path="/rfis" element={<RequireAuth><AnimatedPage><RFIs /></AnimatedPage></RequireAuth>} />
          <Route path="/submittals" element={<RequireAuth><AnimatedPage><Submittals /></AnimatedPage></RequireAuth>} />
          <Route path="/schedule" element={<RequireAuth><AnimatedPage><Schedule /></AnimatedPage></RequireAuth>} />
          <Route path="/lookahead" element={<RequireAuth><AnimatedPage><Lookahead /></AnimatedPage></RequireAuth>} />
          <Route path="/budget" element={<RequireAuth><AnimatedPage><Budget /></AnimatedPage></RequireAuth>} />
          <Route path="/daily-log" element={<RequireAuth><AnimatedPage><DailyLog /></AnimatedPage></RequireAuth>} />
          <Route path="/field-capture" element={<RequireAuth><AnimatedPage><FieldCapture /></AnimatedPage></RequireAuth>} />
          <Route path="/punch-list" element={<RequireAuth><AnimatedPage><PunchList /></AnimatedPage></RequireAuth>} />
          <Route path="/crews" element={<RequireAuth><AnimatedPage><Crews /></AnimatedPage></RequireAuth>} />
          <Route path="/directory" element={<RequireAuth><AnimatedPage><Directory /></AnimatedPage></RequireAuth>} />
          <Route path="/meetings" element={<RequireAuth><AnimatedPage><Meetings /></AnimatedPage></RequireAuth>} />
          <Route path="/files" element={<RequireAuth><AnimatedPage><Files /></AnimatedPage></RequireAuth>} />
          <Route path="/copilot" element={<RequireAuth><AnimatedPage><AICopilot /></AnimatedPage></RequireAuth>} />
          <Route path="/activity" element={<RequireAuth><AnimatedPage><Activity /></AnimatedPage></RequireAuth>} />
          <Route path="/time-machine" element={<RequireAuth><AnimatedPage><TimeMachine /></AnimatedPage></RequireAuth>} />
          <Route path="/project-health" element={<RequireAuth><AnimatedPage><ProjectHealth /></AnimatedPage></RequireAuth>} />
          <Route path="/onboarding" element={<RequireAuth><AnimatedPage><Onboarding /></AnimatedPage></RequireAuth>} />
          <Route path="/vision" element={<RequireAuth><AnimatedPage><Vision /></AnimatedPage></RequireAuth>} />

          {/* Admin routes */}
          <Route path="/admin/team" element={<RequireAuth><AnimatedPage><UserManagement /></AnimatedPage></RequireAuth>} />
          <Route path="/admin/project-settings" element={<RequireAuth><AnimatedPage><ProjectSettingsPage /></AnimatedPage></RequireAuth>} />

          <Route path="*" element={<AnimatedPage><NotFound /></AnimatedPage>} />
        </Routes>
      </Suspense>
    </AnimatePresence>
  );
}

function AppContent() {
  const { sidebarCollapsed, setSidebarCollapsed, setActiveView } = useUiStore();
  const { initialize, company } = useAuthStore();
  const { loadProjects } = useProjectContext();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();

  // Initialize auth on mount
  useEffect(() => {
    initialize();
  }, []);

  // Load projects when company is available
  useEffect(() => {
    if (company?.id) {
      loadProjects(company.id);
    }
  }, [company?.id]);

  const activeView = location.pathname.replace('/', '') || 'dashboard';

  // Show auth pages without layout
  const isAuthPage = location.pathname === '/login' || location.pathname === '/register';
  if (isAuthPage) {
    return (
      <Suspense fallback={<PageLoader />}>
        <AppRoutes />
      </Suspense>
    );
  }

  const handleNavigate = (view: string) => {
    setActiveView(view);
    navigate(`/${view}`);
  };

  const commandItems = [
    { id: 'nav-dashboard', label: 'Dashboard', section: 'Pages', icon: <Home size={16} />, onSelect: () => handleNavigate('dashboard') },
    { id: 'nav-tasks', label: 'Tasks', section: 'Pages', icon: <LayoutGrid size={16} />, onSelect: () => handleNavigate('tasks') },
    { id: 'nav-rfis', label: 'RFIs', section: 'Pages', icon: <HelpCircle size={16} />, onSelect: () => handleNavigate('rfis') },
    { id: 'nav-submittals', label: 'Submittals', section: 'Pages', icon: <ClipboardList size={16} />, onSelect: () => handleNavigate('submittals') },
    { id: 'nav-schedule', label: 'Schedule', section: 'Pages', icon: <Calendar size={16} />, onSelect: () => handleNavigate('schedule') },
    { id: 'nav-lookahead', label: 'Lookahead', section: 'Pages', icon: <ListChecks size={16} />, onSelect: () => handleNavigate('lookahead') },
    { id: 'nav-budget', label: 'Budget', section: 'Pages', icon: <DollarSign size={16} />, onSelect: () => handleNavigate('budget') },
    { id: 'nav-drawings', label: 'Drawings', section: 'Pages', icon: <FileText size={16} />, onSelect: () => handleNavigate('drawings') },
    { id: 'nav-crews', label: 'Crews', section: 'Pages', icon: <Users size={16} />, onSelect: () => handleNavigate('crews') },
    { id: 'nav-daily-log', label: 'Daily Log', section: 'Pages', icon: <BookOpen size={16} />, onSelect: () => handleNavigate('daily-log') },
    { id: 'nav-punch-list', label: 'Punch List', section: 'Pages', icon: <CheckSquare size={16} />, onSelect: () => handleNavigate('punch-list') },
    { id: 'nav-directory', label: 'Directory', section: 'Pages', icon: <Briefcase size={16} />, onSelect: () => handleNavigate('directory') },
    { id: 'nav-meetings', label: 'Meetings', section: 'Pages', icon: <Calendar size={16} />, onSelect: () => handleNavigate('meetings') },
    { id: 'nav-files', label: 'Files', section: 'Pages', icon: <FileText size={16} />, onSelect: () => handleNavigate('files') },
    { id: 'nav-activity', label: 'Activity', section: 'Pages', icon: <MessageCircle size={16} />, onSelect: () => handleNavigate('activity') },
    { id: 'nav-copilot', label: 'AI Copilot', section: 'Pages', icon: <Zap size={16} />, onSelect: () => handleNavigate('copilot') },
    { id: 'nav-field-capture', label: 'Field Capture', section: 'Pages', icon: <Briefcase size={16} />, onSelect: () => handleNavigate('field-capture') },
    { id: 'nav-vision', label: 'Vision', section: 'Pages', icon: <Eye size={16} />, onSelect: () => handleNavigate('vision') },
    { id: 'nav-time-machine', label: 'Time Machine', section: 'Pages', icon: <Clock size={16} />, onSelect: () => handleNavigate('time-machine') },
    { id: 'nav-project-health', label: 'Project Health', section: 'Pages', icon: <Heart size={16} />, onSelect: () => handleNavigate('project-health') },
    ...tasks.slice(0, 6).map((t) => ({
      id: `task-${t.id}`, label: t.title, section: 'Tasks',
      icon: <LayoutGrid size={16} />, onSelect: () => handleNavigate('tasks'),
    })),
    ...rfis.map((r) => ({
      id: `rfi-${r.id}`, label: `${r.rfiNumber}: ${r.title}`, section: 'RFIs',
      icon: <HelpCircle size={16} />, onSelect: () => handleNavigate('rfis'),
    })),
    ...directory.slice(0, 5).map((d) => ({
      id: `person-${d.id}`, label: `${d.contactName} (${d.company})`, section: 'People',
      icon: <Users size={16} />, onSelect: () => handleNavigate('directory'),
    })),
  ];

  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const { toggleContextPanel } = useAIAnnotationStore();
  const sidebarWidth = sidebarCollapsed ? layout.sidebarCollapsed : layout.sidebarWidth;

  // Keyboard shortcuts
  const shortcuts: Shortcut[] = [
    { key: '/', meta: true, description: 'Keyboard shortcuts', action: () => setShortcutsOpen((p) => !p) },
    { key: 'b', meta: true, description: 'Toggle sidebar', action: () => setSidebarCollapsed(!sidebarCollapsed) },
    { key: '.', meta: true, description: 'Toggle AI panel', action: toggleContextPanel },
    { key: 'n', meta: true, description: 'New item', action: () => handleNavigate('tasks') },
    { key: 'e', meta: true, description: 'Export', action: () => setExportOpen(true) },
    { key: '1', meta: true, description: 'Dashboard', action: () => handleNavigate('dashboard') },
    { key: '2', meta: true, description: 'Tasks', action: () => handleNavigate('tasks') },
    { key: '3', meta: true, description: 'Schedule', action: () => handleNavigate('schedule') },
    { key: '4', meta: true, description: 'Budget', action: () => handleNavigate('budget') },
    { key: 'Escape', description: 'Close panels', action: () => { setNotificationsOpen(false); setShortcutsOpen(false); setExportOpen(false); } },
  ];
  useKeyboardShortcuts(shortcuts);

  // Mobile layout
  if (isMobile) {
    return (
      <MobileLayout>
        <OfflineBanner />
        <ErrorBoundary>
          <AppRoutes />
        </ErrorBoundary>
        <FloatingAIButton />
      </MobileLayout>
    );
  }

  // Desktop layout
  return (
    <SidebarContext.Provider value={{ collapsed: sidebarCollapsed, setCollapsed: setSidebarCollapsed }}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          height: '100vh',
          backgroundColor: colors.surfacePage,
          fontFamily: typographyConfig.fontFamily,
        }}
      >
        <Sidebar activeView={activeView} onNavigate={handleNavigate} />

        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            marginLeft: sidebarWidth,
            overflow: 'auto',
            transition: 'margin-left 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
          }}
        >
          <OfflineBanner />
          <ErrorBoundary>
            <AppRoutes />
          </ErrorBoundary>
        </div>

        <CommandPalette items={commandItems} />
        <NotificationCenter open={notificationsOpen} onClose={() => setNotificationsOpen(false)} />
        <ShortcutOverlay open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
        <ExportCenter open={exportOpen} onClose={() => setExportOpen(false)} />
        <AIContextPanel currentPage={activeView} />
        <FloatingAIButton />
      </div>
    </SidebarContext.Provider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <HashRouter>
          <AppContent />
        </HashRouter>
      </ToastProvider>
    </QueryClientProvider>
  );
}

export default App;
