import React, { Suspense, lazy, useState, useEffect } from 'react';
import { HashRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { SidebarContext, ToastProvider, Skeleton } from './components/Primitives';
import { CommandPalette } from './components/shared/CommandPalette';
import { ErrorBoundary } from './components/ErrorBoundary';
import Sentry from './lib/sentry';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { queryClient } from './lib/queryClient';
import { Toaster, toast } from 'sonner';
import './lib/i18n';
import { Sidebar } from './components/Sidebar';
import { MobileLayout } from './components/layout/MobileLayout';
import { OfflineBanner } from './components/ui/OfflineBanner';
import { useUiStore, useAIAnnotationStore } from './stores';
import { colors, colorVars, layout } from './styles/theme';
import { pageTransition } from './components/transitions/variants';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import type { Shortcut } from './hooks/useKeyboardShortcuts';
import { useTheme } from './hooks/useTheme';
import { useRealtimeSubscription, usePresence } from './hooks/useRealtimeSubscription';
import { useProjectId } from './hooks/useProjectId';
import { useAuth } from './hooks/useAuth';
import { SkipToContent } from './components/ui/SkipToContent';
import { RouteAnnouncer } from './components/ui/RouteAnnouncer';
import { ConflictResolutionModal } from './components/ui/ConflictResolutionModal';
import { useServiceWorkerUpdate } from './hooks/useServiceWorkerUpdate';
import { useProjectCache } from './hooks/useProjectCache';
import { useOfflineStatus } from './hooks/useOfflineStatus';
import { syncManager } from './lib/syncManager';

// Auth pages
const Login = lazy(() => import('./pages/auth/Login').then((m) => ({ default: m.Login })));
const Signup = lazy(() => import('./pages/auth/Signup').then((m) => ({ default: m.Signup })));
import { ProtectedRoute } from './components/auth/ProtectedRoute';

// Lazy loaded overlay panels (only render when opened)
const AIContextPanel = lazy(() => import('./components/ai/AIContextPanel').then((m) => ({ default: m.AIContextPanel })));
const FloatingAIButton = lazy(() => import('./components/ai/FloatingAIButton').then((m) => ({ default: m.FloatingAIButton })));
const NotificationCenter = lazy(() => import('./components/notifications/NotificationCenter').then((m) => ({ default: m.NotificationCenter })));
const ShortcutOverlay = lazy(() => import('./components/ui/ShortcutOverlay').then((m) => ({ default: m.ShortcutOverlay })));
const ExportCenter = lazy(() => import('./components/export/ExportCenter').then((m) => ({ default: m.ExportCenter })));

// Lazy loaded pages
const Dashboard = lazy(() => import('./pages/Dashboard').then((m) => ({ default: m.Dashboard })));
const Tasks = lazy(() => import('./pages/Tasks').then((m) => ({ default: m.Tasks })));
const Drawings = lazy(() => import('./pages/Drawings').then((m) => ({ default: m.Drawings })));
const RFIs = lazy(() => import('./pages/RFIs').then((m) => ({ default: m.RFIs })));
const Submittals = lazy(() => import('./pages/Submittals').then((m) => ({ default: m.Submittals })));
const Schedule = lazy(() => import('./pages/Schedule').then((m) => ({ default: m.Schedule })));
const Budget = lazy(() => import('./pages/Budget').then((m) => ({ default: m.Budget })));
const ChangeOrders = lazy(() => import('./pages/ChangeOrders').then((m) => ({ default: m.ChangeOrders })));
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
const AuditTrail = lazy(() => import('./pages/AuditTrail').then((m) => ({ default: m.AuditTrail })));
const TimeMachine = lazy(() => import('./pages/TimeMachine').then((m) => ({ default: m.TimeMachine })));
const ProjectHealth = lazy(() => import('./pages/ProjectHealth').then((m) => ({ default: m.ProjectHealth })));
const Safety = lazy(() => import('./pages/Safety').then((m) => ({ default: m.Safety })));
const Estimating = lazy(() => import('./pages/Estimating'));
const Procurement = lazy(() => import('./pages/Procurement'));
const EquipmentPage = lazy(() => import('./pages/Equipment'));
const Portfolio = lazy(() => import('./pages/Portfolio'));
const Financials = lazy(() => import('./pages/Financials'));
const Insurance = lazy(() => import('./pages/Insurance'));
const OwnerPortal = lazy(() => import('./pages/OwnerPortal'));
const AIAgents = lazy(() => import('./pages/AIAgents'));
const Workforce = lazy(() => import('./pages/Workforce'));
const Permits = lazy(() => import('./pages/Permits'));
const Integrations = lazy(() => import('./pages/Integrations'));
const Reports = lazy(() => import('./pages/Reports'));
const Sustainability = lazy(() => import('./pages/Sustainability'));
const WarrantiesPage = lazy(() => import('./pages/Warranties'));
const Onboarding = lazy(() => import('./pages/Onboarding').then((m) => ({ default: m.Onboarding })));
const NotFound = lazy(() => import('./pages/errors/NotFound').then((m) => ({ default: m.NotFound })));

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

function AppRoutes() {
  const location = useLocation();

  return (
    <>
    <RouteAnnouncer />
    <AnimatePresence mode="wait">
      <Suspense fallback={<PageLoader />}>
        <Routes location={location} key={location.pathname}>
          <Route path="/login" element={<AnimatedPage><Login /></AnimatedPage>} />
          <Route path="/signup" element={<AnimatedPage><Signup /></AnimatedPage>} />
          <Route path="/portfolio" element={<ProtectedRoute><AnimatedPage><Portfolio /></AnimatedPage></ProtectedRoute>} />
          <Route path="/" element={<ProtectedRoute><AnimatedPage><Dashboard /></AnimatedPage></ProtectedRoute>} />
          <Route path="/dashboard" element={<ProtectedRoute><AnimatedPage><Dashboard /></AnimatedPage></ProtectedRoute>} />
          <Route path="/tasks" element={<ProtectedRoute><AnimatedPage><Tasks /></AnimatedPage></ProtectedRoute>} />
          <Route path="/drawings" element={<ProtectedRoute><AnimatedPage><Drawings /></AnimatedPage></ProtectedRoute>} />
          <Route path="/rfis" element={<ProtectedRoute><AnimatedPage><RFIs /></AnimatedPage></ProtectedRoute>} />
          <Route path="/submittals" element={<ProtectedRoute><AnimatedPage><Submittals /></AnimatedPage></ProtectedRoute>} />
          <Route path="/schedule" element={<ProtectedRoute><AnimatedPage><Schedule /></AnimatedPage></ProtectedRoute>} />
          <Route path="/lookahead" element={<ProtectedRoute><AnimatedPage><Lookahead /></AnimatedPage></ProtectedRoute>} />
          <Route path="/budget" element={<ProtectedRoute><AnimatedPage><Budget /></AnimatedPage></ProtectedRoute>} />
          <Route path="/change-orders" element={<ProtectedRoute><AnimatedPage><ChangeOrders /></AnimatedPage></ProtectedRoute>} />
          <Route path="/daily-log" element={<ProtectedRoute><AnimatedPage><DailyLog /></AnimatedPage></ProtectedRoute>} />
          <Route path="/field-capture" element={<ProtectedRoute><AnimatedPage><FieldCapture /></AnimatedPage></ProtectedRoute>} />
          <Route path="/punch-list" element={<ProtectedRoute><AnimatedPage><PunchList /></AnimatedPage></ProtectedRoute>} />
          <Route path="/crews" element={<ProtectedRoute><AnimatedPage><Crews /></AnimatedPage></ProtectedRoute>} />
          <Route path="/safety" element={<ProtectedRoute><AnimatedPage><Safety /></AnimatedPage></ProtectedRoute>} />
          <Route path="/estimating" element={<ProtectedRoute><AnimatedPage><Estimating /></AnimatedPage></ProtectedRoute>} />
          <Route path="/procurement" element={<ProtectedRoute><AnimatedPage><Procurement /></AnimatedPage></ProtectedRoute>} />
          <Route path="/equipment" element={<ProtectedRoute><AnimatedPage><EquipmentPage /></AnimatedPage></ProtectedRoute>} />
          <Route path="/directory" element={<ProtectedRoute><AnimatedPage><Directory /></AnimatedPage></ProtectedRoute>} />
          <Route path="/meetings" element={<ProtectedRoute><AnimatedPage><Meetings /></AnimatedPage></ProtectedRoute>} />
          <Route path="/files" element={<ProtectedRoute><AnimatedPage><Files /></AnimatedPage></ProtectedRoute>} />
          <Route path="/copilot" element={<ProtectedRoute><AnimatedPage><AICopilot /></AnimatedPage></ProtectedRoute>} />
          <Route path="/activity" element={<ProtectedRoute><AnimatedPage><Activity /></AnimatedPage></ProtectedRoute>} />
          <Route path="/audit-trail" element={<ProtectedRoute><AnimatedPage><AuditTrail /></AnimatedPage></ProtectedRoute>} />
          <Route path="/time-machine" element={<ProtectedRoute><AnimatedPage><TimeMachine /></AnimatedPage></ProtectedRoute>} />
          <Route path="/project-health" element={<ProtectedRoute><AnimatedPage><ProjectHealth /></AnimatedPage></ProtectedRoute>} />
          <Route path="/financials" element={<ProtectedRoute><AnimatedPage><Financials /></AnimatedPage></ProtectedRoute>} />
          <Route path="/insurance" element={<ProtectedRoute><AnimatedPage><Insurance /></AnimatedPage></ProtectedRoute>} />
          <Route path="/portal/owner" element={<ProtectedRoute><AnimatedPage><OwnerPortal /></AnimatedPage></ProtectedRoute>} />
          <Route path="/ai-agents" element={<ProtectedRoute><AnimatedPage><AIAgents /></AnimatedPage></ProtectedRoute>} />
          <Route path="/workforce" element={<ProtectedRoute><AnimatedPage><Workforce /></AnimatedPage></ProtectedRoute>} />
          <Route path="/permits" element={<ProtectedRoute><AnimatedPage><Permits /></AnimatedPage></ProtectedRoute>} />
          <Route path="/integrations" element={<ProtectedRoute><AnimatedPage><Integrations /></AnimatedPage></ProtectedRoute>} />
          <Route path="/reports" element={<ProtectedRoute><AnimatedPage><Reports /></AnimatedPage></ProtectedRoute>} />
          <Route path="/sustainability" element={<ProtectedRoute><AnimatedPage><Sustainability /></AnimatedPage></ProtectedRoute>} />
          <Route path="/warranties" element={<ProtectedRoute><AnimatedPage><WarrantiesPage /></AnimatedPage></ProtectedRoute>} />
          <Route path="/onboarding" element={<AnimatedPage><Onboarding /></AnimatedPage>} />
          <Route path="/vision" element={<ProtectedRoute><AnimatedPage><Vision /></AnimatedPage></ProtectedRoute>} />
          <Route path="*" element={<AnimatedPage><NotFound /></AnimatedPage>} />
        </Routes>
      </Suspense>
    </AnimatePresence>
    </>
  );
}

function AppContent() {
  const { sidebarCollapsed, setSidebarCollapsed, setActiveView } = useUiStore();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  useTheme();

  const projectId = useProjectId();
  const { user } = useAuth();
  useRealtimeSubscription(projectId, user?.id);
  useProjectCache(projectId);
  const { conflictCount } = useOfflineStatus();
  const { updateAvailable, applyUpdate } = useServiceWorkerUpdate();
  const [conflictModalOpen, setConflictModalOpen] = useState(false);

  // Listen for background sync completion from SW
  useEffect(() => {
    const handler = () => syncManager.refreshCounts();
    window.addEventListener('background-sync-complete', handler);
    return () => window.removeEventListener('background-sync-complete', handler);
  }, []);

  // Show SW update toast
  useEffect(() => {
    if (updateAvailable) {
      toast('A new version is available.', {
        action: { label: 'Update', onClick: applyUpdate },
        duration: Infinity,
      });
    }
  }, [updateAvailable, applyUpdate]);

  // Auto-open conflict modal when conflicts appear
  useEffect(() => {
    if (conflictCount > 0) setConflictModalOpen(true);
  }, [conflictCount]);

  const activeView = location.pathname.replace('/', '') || 'dashboard';

  // Track presence (who is on which page)
  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';
  const userInitials = userName.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2) || 'U';
  usePresence(projectId, user?.id, userName, userInitials, activeView);

  const handleNavigate = (view: string) => {
    setActiveView(view);
    navigate(`/${view}`);
  };

  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const { toggleContextPanel } = useAIAnnotationStore();
  const sidebarWidth = sidebarCollapsed ? layout.sidebarCollapsed : layout.sidebarWidth;

  // Keyboard shortcuts — every action reachable by keyboard
  const shortcuts: Shortcut[] = [
    // Navigation
    { key: '/', meta: true, description: 'Keyboard shortcuts', action: () => setShortcutsOpen((p) => !p) },
    { key: 'b', meta: true, description: 'Toggle sidebar', action: () => setSidebarCollapsed(!sidebarCollapsed) },
    { key: '.', meta: true, description: 'Toggle AI panel', action: toggleContextPanel },
    { key: 'n', meta: true, description: 'New item', action: () => handleNavigate(activeView === 'rfis' ? 'rfis' : activeView === 'submittals' ? 'submittals' : activeView === 'punch-list' ? 'punch-list' : 'tasks') },
    { key: 's', meta: true, description: 'Save current form', action: () => {} },
    { key: 'e', meta: true, description: 'Export', action: () => setExportOpen(true) },
    { key: 'f', meta: true, description: 'Focus search', action: () => { /* Command palette handles its own Cmd+K; Cmd+F is browser find override */ } },
    // Page navigation: Cmd+1 through Cmd+9
    { key: '1', meta: true, description: 'Dashboard', action: () => handleNavigate('dashboard') },
    { key: '2', meta: true, description: 'Tasks', action: () => handleNavigate('tasks') },
    { key: '3', meta: true, description: 'Schedule', action: () => handleNavigate('schedule') },
    { key: '4', meta: true, description: 'Budget', action: () => handleNavigate('budget') },
    { key: '5', meta: true, description: 'RFIs', action: () => handleNavigate('rfis') },
    { key: '6', meta: true, description: 'Submittals', action: () => handleNavigate('submittals') },
    { key: '7', meta: true, description: 'Daily Log', action: () => handleNavigate('daily-log') },
    { key: '8', meta: true, description: 'Punch List', action: () => handleNavigate('punch-list') },
    { key: '9', meta: true, description: 'Drawings', action: () => handleNavigate('drawings') },
    // General
    { key: '?', description: 'Shortcut help', action: () => setShortcutsOpen(true) },
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
        <Suspense fallback={null}><FloatingAIButton /></Suspense>
        <ConflictResolutionModal open={conflictModalOpen} onClose={() => setConflictModalOpen(false)} />
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
          backgroundColor: colorVars.surfacePage,
          fontFamily: typographyConfig.fontFamily,
        }}
      >
        <SkipToContent />
        <div role="navigation" aria-label="Main navigation">
          <Sidebar activeView={activeView} onNavigate={handleNavigate} />
        </div>

        <div
          id="main-content"
          role="main"
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

        <CommandPalette />
        <Suspense fallback={null}>
          {notificationsOpen && <NotificationCenter open={notificationsOpen} onClose={() => setNotificationsOpen(false)} />}
          {shortcutsOpen && <ShortcutOverlay open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />}
          {exportOpen && <ExportCenter open={exportOpen} onClose={() => setExportOpen(false)} />}
          <AIContextPanel currentPage={activeView} />
          <FloatingAIButton />
        </Suspense>
        <ConflictResolutionModal open={conflictModalOpen} onClose={() => setConflictModalOpen(false)} />
      </div>
    </SidebarContext.Provider>
  );
}

function SentryFallback() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', textAlign: 'center', padding: '32px' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 600, margin: 0, marginBottom: '8px' }}>Something went wrong</h1>
      <p style={{ fontSize: '14px', color: '#666', margin: 0, marginBottom: '16px' }}>An unexpected error has been reported. Please reload to continue.</p>
      <button onClick={() => window.location.reload()} style={{ padding: '8px 24px', backgroundColor: '#F47820', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '14px', cursor: 'pointer' }}>
        Reload Page
      </button>
    </div>
  );
}

function App() {
  return (
    <Sentry.ErrorBoundary fallback={<SentryFallback />}>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <HashRouter>
            <AppContent />
          </HashRouter>
          <Toaster position="bottom-right" richColors closeButton />
        </ToastProvider>
        {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
      </QueryClientProvider>
    </Sentry.ErrorBoundary>
  );
}

export default App;
