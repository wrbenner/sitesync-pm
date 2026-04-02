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
import { useCopilotStore } from './stores/copilotStore';
import { colors, colorVars, layout, spacing, typography, borderRadius, transitions } from './styles/theme';
import { keyframes as animationKeyframes } from './styles/animations';
import { pageTransition } from './components/transitions/variants';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import type { Shortcut } from './hooks/useKeyboardShortcuts';
import { useMediaQuery } from './hooks/useMediaQuery';
import { useTheme } from './hooks/useTheme';
import { useRealtimeSubscription, usePresence } from './hooks/useRealtimeSubscription';
import { useRealtimeInvalidation } from './hooks/useRealtimeInvalidation';
import { useNotificationRealtime } from './hooks/useNotificationRealtime';
import { useProjectId } from './hooks/useProjectId';
import { useAuth } from './hooks/useAuth';
import { SkipToContent } from './components/ui/SkipToContent';
import { RouteAnnouncer } from './components/ui/RouteAnnouncer';
import { LiveRegion } from './components/ui/LiveRegion';
import { ConflictResolutionModal } from './components/ui/ConflictResolutionModal';
import { useServiceWorkerUpdate } from './hooks/useServiceWorkerUpdate';
import { useProjectCache } from './hooks/useProjectCache';
import { useOfflineStatus } from './hooks/useOfflineStatus';
import { syncManager } from './lib/syncManager';
import { OrganizationProvider } from './hooks/useOrganization';

// Auth pages
const Login = lazy(() => import('./pages/auth/Login').then((m) => ({ default: m.Login })));
const Signup = lazy(() => import('./pages/auth/Signup').then((m) => ({ default: m.Signup })));
import { ProtectedRoute } from './components/auth/ProtectedRoute';

// Lazy loaded overlay panels (only render when opened)
const AIContextPanel = lazy(() => import('./components/ai/AIContextPanel').then((m) => ({ default: m.AIContextPanel })));
const FloatingAIButton = lazy(() => import('./components/ai/FloatingAIButton').then((m) => ({ default: m.FloatingAIButton })));
const CopilotPanel = lazy(() => import('./components/ai/CopilotPanel').then((m) => ({ default: m.CopilotPanel })));
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
const PaymentApplications = lazy(() => import('./pages/PaymentApplications'));
const Insurance = lazy(() => import('./pages/Insurance'));
const OwnerPortal = lazy(() => import('./pages/OwnerPortal'));
const AIAgents = lazy(() => import('./pages/AIAgents'));
const Workforce = lazy(() => import('./pages/Workforce'));
const Permits = lazy(() => import('./pages/Permits'));
const Integrations = lazy(() => import('./pages/Integrations'));
const Marketplace = lazy(() => import('./pages/Marketplace'));
const Developers = lazy(() => import('./pages/Developers'));
const Reports = lazy(() => import('./pages/Reports'));
const Sustainability = lazy(() => import('./pages/Sustainability'));
const Benchmarks = lazy(() => import('./pages/Benchmarks'));
const WarrantiesPage = lazy(() => import('./pages/Warranties'));
const Onboarding = lazy(() => import('./pages/Onboarding').then((m) => ({ default: m.Onboarding })));
const NotFound = lazy(() => import('./pages/errors/NotFound').then((m) => ({ default: m.NotFound })));

const typographyConfig = { fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' };


function PageLoader() {
  const skeletonStyle: React.CSSProperties = {
    backgroundColor: '#E5E7EB',
    borderRadius: '12px',
    animation: 'page-loader-pulse 1.5s ease-in-out infinite',
  };
  return (
    <>
      <style>{`@keyframes page-loader-pulse { 0%, 100% { opacity: 0.4 } 50% { opacity: 0.7 } }`}</style>
      <div style={{ padding: '32px', flex: 1 }}>
        <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} style={{ ...skeletonStyle, height: '100px', flex: '1' }} />
          ))}
        </div>
        <div style={{ ...skeletonStyle, height: '400px', width: '100%' }} />
      </div>
    </>
  );
}


function AppRoutes() {
  const location = useLocation();

  return (
    <>
      <RouteAnnouncer />
      <AnimatePresence mode="wait">
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
          style={{ width: '100%', minHeight: '100vh' }}
        >
          <Suspense fallback={<PageLoader />}>
            <Routes location={location}>
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/portfolio" element={<ProtectedRoute moduleId="portfolio" moduleName="Portfolio"><Portfolio /></ProtectedRoute>} />
              <Route path="/" element={<ProtectedRoute moduleId="dashboard" moduleName="Dashboard"><Dashboard /></ProtectedRoute>} />
              <Route path="/dashboard" element={<ProtectedRoute moduleId="dashboard" moduleName="Dashboard"><Dashboard /></ProtectedRoute>} />
              <Route path="/tasks" element={<ProtectedRoute moduleId="tasks" moduleName="Tasks"><Tasks /></ProtectedRoute>} />
              <Route path="/drawings" element={<ProtectedRoute moduleId="drawings" moduleName="Drawings"><Drawings /></ProtectedRoute>} />
              <Route path="/rfis" element={<ProtectedRoute moduleId="rfis" moduleName="RFIs"><RFIs /></ProtectedRoute>} />
              <Route path="/submittals" element={<ProtectedRoute moduleId="submittals" moduleName="Submittals"><Submittals /></ProtectedRoute>} />
              <Route path="/schedule" element={<ProtectedRoute moduleId="schedule" moduleName="Schedule"><Schedule /></ProtectedRoute>} />
              <Route path="/lookahead" element={<ProtectedRoute moduleId="lookahead" moduleName="Lookahead"><Lookahead /></ProtectedRoute>} />
              <Route path="/budget" element={<ProtectedRoute moduleId="budget" moduleName="Budget"><Budget /></ProtectedRoute>} />
              <Route path="/change-orders" element={<ProtectedRoute moduleId="change-orders" moduleName="Change Orders"><ChangeOrders /></ProtectedRoute>} />
              <Route path="/daily-log" element={<ProtectedRoute moduleId="daily-log" moduleName="Daily Log"><DailyLog /></ProtectedRoute>} />
              <Route path="/field-capture" element={<ProtectedRoute moduleId="field-capture" moduleName="Field Capture"><FieldCapture /></ProtectedRoute>} />
              <Route path="/punch-list" element={<ProtectedRoute moduleId="punch-list" moduleName="Punch List"><PunchList /></ProtectedRoute>} />
              <Route path="/crews" element={<ProtectedRoute moduleId="crews" moduleName="Crews"><Crews /></ProtectedRoute>} />
              <Route path="/safety" element={<ProtectedRoute moduleId="safety" moduleName="Safety"><Safety /></ProtectedRoute>} />
              <Route path="/estimating" element={<ProtectedRoute moduleId="estimating" moduleName="Estimating"><Estimating /></ProtectedRoute>} />
              <Route path="/procurement" element={<ProtectedRoute moduleId="procurement" moduleName="Procurement"><Procurement /></ProtectedRoute>} />
              <Route path="/equipment" element={<ProtectedRoute moduleId="equipment" moduleName="Equipment"><EquipmentPage /></ProtectedRoute>} />
              <Route path="/directory" element={<ProtectedRoute moduleId="directory" moduleName="Directory"><Directory /></ProtectedRoute>} />
              <Route path="/meetings" element={<ProtectedRoute moduleId="meetings" moduleName="Meetings"><Meetings /></ProtectedRoute>} />
              <Route path="/files" element={<ProtectedRoute moduleId="files" moduleName="Files"><Files /></ProtectedRoute>} />
              <Route path="/copilot" element={<ProtectedRoute moduleId="copilot" moduleName="AI Copilot"><AICopilot /></ProtectedRoute>} />
              <Route path="/activity" element={<ProtectedRoute moduleId="activity" moduleName="Activity"><Activity /></ProtectedRoute>} />
              <Route path="/audit-trail" element={<ProtectedRoute moduleId="audit-trail" moduleName="Audit Trail"><AuditTrail /></ProtectedRoute>} />
              <Route path="/time-machine" element={<ProtectedRoute moduleId="time-machine" moduleName="Time Machine"><TimeMachine /></ProtectedRoute>} />
              <Route path="/project-health" element={<ProtectedRoute moduleId="project-health" moduleName="Project Health"><ProjectHealth /></ProtectedRoute>} />
              <Route path="/financials" element={<ProtectedRoute moduleId="financials" moduleName="Financials"><Financials /></ProtectedRoute>} />
              <Route path="/pay-apps" element={<ProtectedRoute moduleId="pay-apps" moduleName="Payment Applications"><PaymentApplications /></ProtectedRoute>} />
              <Route path="/insurance" element={<ProtectedRoute moduleId="insurance" moduleName="Insurance"><Insurance /></ProtectedRoute>} />
              <Route path="/portal/owner" element={<ProtectedRoute requiredPermission="project.settings" moduleName="Owner Portal"><OwnerPortal /></ProtectedRoute>} />
              <Route path="/ai-agents" element={<ProtectedRoute moduleId="ai-agents" moduleName="AI Agents"><AIAgents /></ProtectedRoute>} />
              <Route path="/workforce" element={<ProtectedRoute moduleId="workforce" moduleName="Workforce"><Workforce /></ProtectedRoute>} />
              <Route path="/permits" element={<ProtectedRoute moduleId="permits" moduleName="Permits"><Permits /></ProtectedRoute>} />
              <Route path="/integrations" element={<ProtectedRoute moduleId="integrations" moduleName="Integrations"><Integrations /></ProtectedRoute>} />
              <Route path="/marketplace" element={<ProtectedRoute moduleId="marketplace" moduleName="App Marketplace"><Marketplace /></ProtectedRoute>} />
              <Route path="/developers" element={<ProtectedRoute moduleId="developers" moduleName="Developer Portal"><Developers /></ProtectedRoute>} />
              <Route path="/reports" element={<ProtectedRoute moduleId="reports" moduleName="Reports"><Reports /></ProtectedRoute>} />
              <Route path="/sustainability" element={<ProtectedRoute moduleId="sustainability" moduleName="Sustainability"><Sustainability /></ProtectedRoute>} />
              <Route path="/benchmarks" element={<ProtectedRoute moduleId="benchmarks" moduleName="Platform Intelligence"><Benchmarks /></ProtectedRoute>} />
              <Route path="/warranties" element={<ProtectedRoute moduleId="warranties" moduleName="Warranties"><WarrantiesPage /></ProtectedRoute>} />
              <Route path="/onboarding" element={<Onboarding />} />
              <Route path="/vision" element={<ProtectedRoute><Vision /></ProtectedRoute>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </motion.div>
      </AnimatePresence>
    </>
  );
}

function AppContent() {
  const { sidebarCollapsed, setSidebarCollapsed, setActiveView } = useUiStore();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useMediaQuery('(max-width: 767px)');
  useTheme();

  const projectId = useProjectId();
  const { user } = useAuth();
  const { conflictCount } = useOfflineStatus();
  const { updateAvailable, applyUpdate } = useServiceWorkerUpdate();
  const [conflictModalOpen, setConflictModalOpen] = useState(false);

  // Auth pages render without the app shell (no sidebar, no offline banner)
  const isAuthPage = ['/login', '/signup', '/onboarding'].includes(location.pathname);

  useRealtimeSubscription(isAuthPage ? undefined : projectId, isAuthPage ? undefined : user?.id);
  useRealtimeInvalidation();
  useProjectCache(isAuthPage ? undefined : projectId);
  useNotificationRealtime();

  // Listen for background sync completion from SW
  useEffect(() => {
    const handler = () => syncManager.refreshCounts();
    window.addEventListener('background-sync-complete', handler);
    return () => window.removeEventListener('background-sync-complete', handler);
  }, []);

  // Show SW update toast
  useEffect(() => {
    if (updateAvailable) {
      toast('New version available', {
        action: { label: 'Update Now', onClick: () => applyUpdate() },
        duration: Infinity,
        id: 'sw-update',
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
  usePresence(isAuthPage ? undefined : projectId, isAuthPage ? undefined : user?.id, userName, userInitials, activeView);

  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const { toggleContextPanel } = useAIAnnotationStore();
  const { openCopilot, closeCopilot } = useCopilotStore();
  const sidebarWidth = sidebarCollapsed ? layout.sidebarCollapsed : layout.sidebarWidth;

  const handleNavigate = (view: string) => {
    setActiveView(view);
    navigate(`/${view}`);
  };

  // Keyboard shortcuts — every action reachable by keyboard
  const shortcuts: Shortcut[] = [
    // Navigation
    { key: 'b', meta: true, description: 'Toggle sidebar', action: () => setSidebarCollapsed(!sidebarCollapsed) },
    { key: '.', meta: true, description: 'Toggle AI panel', action: toggleContextPanel },
    { key: 'n', meta: true, description: 'New item', action: () => handleNavigate(activeView === 'rfis' ? 'rfis' : activeView === 'submittals' ? 'submittals' : activeView === 'punch-list' ? 'punch-list' : 'tasks') },
    { key: 's', meta: true, description: 'Save current form', action: () => {} },
    { key: 'e', meta: true, description: 'Export', action: () => setExportOpen(true) },
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
    { key: '?', description: 'Shortcut help', action: () => setShortcutsOpen(true) },
  ];
  useKeyboardShortcuts(shortcuts);

  // Global chord shortcuts — Cmd+/, sequential g+x navigation, Escape
  useKeyboardShortcuts([
    { keys: ['meta+/'], action: () => setShortcutsOpen((p) => !p) },
    { keys: ['meta+k'], action: () => setCommandPaletteOpen(prev => !prev) },
    { keys: ['g', 'd'], sequential: true, action: () => navigate('/dashboard') },
    { keys: ['g', 'r'], sequential: true, action: () => navigate('/rfis') },
    { keys: ['g', 'b'], sequential: true, action: () => navigate('/budget') },
    { keys: ['g', 's'], sequential: true, action: () => navigate('/schedule') },
    { keys: ['escape'], action: () => { setCommandPaletteOpen(false); setNotificationsOpen(false); setShortcutsOpen(false); setExportOpen(false); closeCopilot(); } },
  ]);

  // Auth pages render without the app shell (no sidebar, no offline banner)
  if (isAuthPage) {
    return (
      <Suspense fallback={<PageLoader />}>
        <AppRoutes />
      </Suspense>
    );
  }

  // Mobile layout
  if (isMobile) {
    return (
      <MobileLayout>
        <OfflineBanner />
        <ErrorBoundary>
          <AppRoutes />
        </ErrorBoundary>
        <Suspense fallback={null}><FloatingAIButton /></Suspense>
        <Suspense fallback={null}><CopilotPanel /></Suspense>
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
        <Sidebar activeView={activeView} onNavigate={handleNavigate} />

        <main
          id="main-content"
          role="main"
          tabIndex={-1}
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            marginLeft: sidebarWidth,
            overflow: 'auto',
            transition: `margin-left ${transitions.smooth}`,
          }}
        >
          <OfflineBanner />
          <ErrorBoundary>
            <AppRoutes />
          </ErrorBoundary>
        </main>

        <CommandPalette open={commandPaletteOpen} onClose={() => setCommandPaletteOpen(false)} />
        <Suspense fallback={null}>
          {notificationsOpen && <NotificationCenter open={notificationsOpen} onClose={() => setNotificationsOpen(false)} />}
          {shortcutsOpen && <ShortcutOverlay open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />}
          {exportOpen && <ExportCenter open={exportOpen} onClose={() => setExportOpen(false)} />}
          <AIContextPanel currentPage={activeView} />
          <FloatingAIButton />
          <CopilotPanel />
        </Suspense>
        <ConflictResolutionModal open={conflictModalOpen} onClose={() => setConflictModalOpen(false)} />
      </div>
    </SidebarContext.Provider>
  );
}

function SentryFallback({ error }: { error?: Error }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', textAlign: 'center', padding: spacing['8'] }}>
      <h1 style={{ fontSize: typography.fontSize.large, fontWeight: typography.fontWeight.semibold, margin: 0, marginBottom: spacing['2'] }}>Something went wrong</h1>
      <p style={{ fontSize: typography.fontSize.body, color: colors.textTertiary, margin: 0, marginBottom: spacing['4'] }}>An unexpected error has been reported. Please reload to continue.</p>
      {error && <pre style={{ fontSize: typography.fontSize.label, color: colors.statusCritical, margin: `0 0 ${spacing['4']}`, maxWidth: '600px', textAlign: 'left', whiteSpace: 'pre-wrap', wordBreak: 'break-word', background: colors.surfaceInset, padding: spacing['3'], borderRadius: borderRadius.base }}>{error.message}{'\n'}{error.stack}</pre>}
      <button onClick={() => window.location.reload()} style={{ padding: `${spacing['2']} ${spacing['6']}`, backgroundColor: colors.primaryOrange, color: colors.white, border: 'none', borderRadius: borderRadius.base, fontSize: typography.fontSize.body, cursor: 'pointer' }}>
        Reload Page
      </button>
    </div>
  );
}

function App() {
  return (
    <Sentry.ErrorBoundary fallback={({ error }: { error?: Error }) => <SentryFallback error={error} />}>
      <style>{animationKeyframes}</style>
      <QueryClientProvider client={queryClient}>
        <OrganizationProvider>
          <ToastProvider>
            <LiveRegion />
            <HashRouter>
              <AppContent />
            </HashRouter>
            <Toaster position="bottom-right" richColors closeButton />
          </ToastProvider>
          {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
        </OrganizationProvider>
      </QueryClientProvider>
    </Sentry.ErrorBoundary>
  );
}

export default App;
