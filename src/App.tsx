import React, { Suspense, lazy, useState, useEffect, useRef } from 'react';
import { HardHat } from 'lucide-react';
import { HashRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { SidebarContext, ToastProvider } from './components/Primitives';
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
import { colors, colorVars, spacing, typography, borderRadius } from './styles/theme';
import { keyframes as animationKeyframes } from './styles/animations';
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

function lazyWithRetry(importFn: () => Promise<unknown>, retries = 3, delay = 1000) {
  return lazy(() => new Promise<{ default: unknown }>((resolve, reject) => {
    function attempt(retriesLeft: number) {
      importFn().then(resolve).catch((err: Error) => {
        if (retriesLeft > 0) {
          setTimeout(() => attempt(retriesLeft - 1), delay);
        } else {
          reject(err);
        }
      });
    }
    attempt(retries);
  }));
}

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

// TODO: Consider grouping related pages (RFIs + Submittals + ChangeOrders) into a single chunk using webpackChunkName or Vite manual chunks for frequently co-visited pages
// Lazy loaded pages
const Dashboard = lazyWithRetry(() => import('./pages/Dashboard').then((m) => ({ default: m.Dashboard })));
const Tasks = lazy(() => import('./pages/Tasks').then((m) => ({ default: m.Tasks })));
const Drawings = lazy(() => import('./pages/drawings').then((m) => ({ default: m.Drawings })));
const RFIs = lazyWithRetry(() => import('./pages/RFIs').then((m) => ({ default: m.RFIs })));
const Submittals = lazy(() => import('./pages/Submittals').then((m) => ({ default: m.Submittals })));
const Schedule = lazyWithRetry(() => import('./pages/Schedule').then((m) => ({ default: m.Schedule })));
const Budget = lazy(() => import('./pages/Budget').then((m) => ({ default: m.Budget })));
const ChangeOrders = lazy(() => import('./pages/ChangeOrders').then((m) => ({ default: m.ChangeOrders })));
const DailyLog = lazyWithRetry(() => import('./pages/DailyLog').then((m) => ({ default: m.DailyLog })));
const FieldCapture = lazy(() => import('./pages/FieldCapture').then((m) => ({ default: m.FieldCapture })));
const PunchList = lazyWithRetry(() => import('./pages/PunchList').then((m) => ({ default: m.PunchList })));
const Crews = lazy(() => import('./pages/Crews').then((m) => ({ default: m.Crews })));
const Directory = lazy(() => import('./pages/Directory').then((m) => ({ default: m.Directory })));
const Meetings = lazy(() => import('./pages/Meetings').then((m) => ({ default: m.Meetings })));
const Files = lazy(() => import('./pages/files').then((m) => ({ default: m.Files })));
const AICopilot = lazy(() => import('./pages/AICopilot').then((m) => ({ default: m.AICopilot })));
const Lookahead = lazy(() => import('./pages/Lookahead').then((m) => ({ default: m.Lookahead })));
const Activity = lazy(() => import('./pages/Activity').then((m) => ({ default: m.Activity })));
const AuditTrail = lazy(() => import('./pages/AuditTrail').then((m) => ({ default: m.AuditTrail })));
const ProjectHealth = lazy(() => import('./pages/ProjectHealth').then((m) => ({ default: m.ProjectHealth })));
const Safety = lazy(() => import('./pages/safety').then((m) => ({ default: m.Safety })));
const Estimating = lazy(() => import('./pages/Estimating'));
const Procurement = lazy(() => import('./pages/Procurement'));
const EquipmentPage = lazy(() => import('./pages/Equipment'));
const Portfolio = lazy(() => import('./pages/Portfolio'));
const Financials = lazy(() => import('./pages/Financials'));
const PaymentApplications = lazy(() => import('./pages/payment-applications'));
const OwnerPortal = lazy(() => import('./pages/OwnerPortal'));
const AIAgents = lazy(() => import('./pages/AIAgents'));
const Workforce = lazy(() => import('./pages/Workforce'));
const Permits = lazy(() => import('./pages/Permits'));
const Integrations = lazy(() => import('./pages/Integrations'));
const Reports = lazy(() => import('./pages/Reports'));
const OwnerReportPage = lazy(() => import('./pages/OwnerReportPage'));
const LienWaivers = lazy(() => import('./pages/LienWaivers').then((m) => ({ default: m.LienWaivers })));
const Onboarding = lazy(() => import('./pages/Onboarding').then((m) => ({ default: m.Onboarding })));
const NotFound = lazy(() => import('./pages/errors/NotFound').then((m) => ({ default: m.NotFound })));

const typographyConfig = { fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' };

// Prefetch strategy: once the user is authenticated, kick off background downloads
// of the three most visited pages so their chunks are already in the browser cache
// by the time the user navigates to them. We defer to requestIdleCallback (or a
// 1000ms setTimeout fallback) so this never competes with the initial render.
function usePrefetchRoutes(isAuthenticated: boolean) {
  useEffect(() => {
    if (!isAuthenticated) return;
    const prefetch = () => {
      import('./pages/Dashboard');
      import('./pages/RFIs');
      import('./pages/DailyLog');
    };
    if (typeof requestIdleCallback !== 'undefined') {
      const id = requestIdleCallback(prefetch);
      return () => cancelIdleCallback(id);
    } else {
      const id = setTimeout(prefetch, 1000);
      return () => clearTimeout(id);
    }
  }, [isAuthenticated]);
}


function PageSkeleton() {
  const skeletonStyle: React.CSSProperties = {
    backgroundColor: '#E5E7EB',
    borderRadius: '12px',
    animation: 'page-skeleton-pulse 1.5s ease-in-out infinite',
  };
  return (
    <>
      <style>{`@keyframes page-skeleton-pulse { 0%, 100% { opacity: 0.4 } 50% { opacity: 0.7 } }`}</style>
      <div style={{ padding: '32px', flex: 1, minHeight: '100vh' }}>
        <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
          {[1, 2, 3].map((i) => (
            <div key={i} style={{ ...skeletonStyle, height: '100px', flex: '1' }} />
          ))}
        </div>
        <div style={{ ...skeletonStyle, height: '400px', width: '100%' }} />
      </div>
    </>
  );
}

function PageLoadingFallback() {
  return (
    <div role="status" aria-live="polite" aria-label="Loading page content">
      <span style={{ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0,0,0,0)' }}>
        Loading page content
      </span>
      <PageSkeleton />
    </div>
  );
}

function PageSuspense({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <Suspense fallback={<PageLoadingFallback />}>{children}</Suspense>
    </ErrorBoundary>
  );
}

function ChunkLoadFallback() {
  return (
    <div
      role="alert"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: colors.bgLight,
        padding: spacing['8'],
      }}
    >
      <div
        style={{
          backgroundColor: colors.white,
          borderRadius: '12px',
          padding: '32px',
          maxWidth: '480px',
          width: '100%',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: spacing['4'],
        }}
      >
        <h2
          style={{
            fontSize: typography.fontSize.heading,
            fontWeight: typography.fontWeight.semibold,
            color: colors.textPrimary,
            margin: 0,
          }}
        >
          This page failed to load
        </h2>
        <p
          style={{
            fontSize: typography.fontSize.body,
            color: colors.textSecondary,
            margin: 0,
          }}
        >
          A network issue may have interrupted the page. Please reload to try again.
        </p>
        <button
          onClick={() => window.location.reload()}
          style={{
            width: '100%',
            padding: `${spacing['3']} ${spacing['6']}`,
            backgroundColor: colors.primaryOrange,
            color: colors.white,
            border: 'none',
            borderRadius: '6px',
            fontSize: typography.fontSize.body,
            fontWeight: typography.fontWeight.medium,
            fontFamily: typography.fontFamily,
            cursor: 'pointer',
          }}
        >
          Reload Page
        </button>
        <a
          href="#/"
          style={{
            fontSize: typography.fontSize.body,
            color: colors.textSecondary,
            textDecoration: 'none',
          }}
        >
          Go to Dashboard
        </a>
      </div>
    </div>
  );
}

interface ChunkLoadErrorBoundaryState {
  error: Error | null;
}

class ChunkLoadErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ChunkLoadErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): ChunkLoadErrorBoundaryState {
    return { error };
  }

  render() {
    const { error } = this.state;
    if (error) {
      const isChunkError =
        error.message.includes('Loading chunk') ||
        error.message.includes('Failed to fetch dynamically imported module');
      if (isChunkError) {
        return <ChunkLoadFallback />;
      }
      // Not a chunk error: re-throw so the outer Sentry ErrorBoundary handles it
      throw error;
    }
    return this.props.children;
  }
}


function AuthenticatedProviders({ activeView }: { activeView: string }) {
  const { user } = useAuth();
  const projectId = useProjectId();
  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';
  const userInitials = userName.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2) || 'U';
  useRealtimeSubscription(projectId, user?.id);
  usePresence(projectId, user?.id, userName, userInitials, activeView);
  // Subscriptions are scoped to the active project — passing projectId explicitly
  // so the channel is torn down and recreated whenever the user switches projects.
  useRealtimeInvalidation(projectId ?? undefined);
  useNotificationRealtime();
  return null;
}

function AppRoutes() {
  const location = useLocation();

  return (
    <>
      <RouteAnnouncer />
      <LiveRegion />
      <AnimatePresence mode="wait">
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
          style={{ width: '100%', minHeight: '100vh' }}
        >
          <Routes location={location}>
            <Route path="/login" element={<PageSuspense><Login /></PageSuspense>} />
            <Route path="/signup" element={<PageSuspense><Signup /></PageSuspense>} />
            <Route path="/portfolio" element={<PageSuspense><ProtectedRoute moduleId="portfolio" moduleName="Portfolio"><Portfolio /></ProtectedRoute></PageSuspense>} />
            <Route path="/" element={<PageSuspense><ProtectedRoute moduleId="dashboard" moduleName="Dashboard"><Dashboard /></ProtectedRoute></PageSuspense>} />
            <Route path="/dashboard" element={<PageSuspense><ProtectedRoute moduleId="dashboard" moduleName="Dashboard"><Dashboard /></ProtectedRoute></PageSuspense>} />
            <Route path="/tasks" element={<PageSuspense><ProtectedRoute moduleId="tasks" moduleName="Tasks"><Tasks /></ProtectedRoute></PageSuspense>} />
            <Route path="/drawings" element={<PageSuspense><ProtectedRoute moduleId="drawings" moduleName="Drawings"><Drawings /></ProtectedRoute></PageSuspense>} />
            <Route path="/rfis" element={<PageSuspense><ProtectedRoute moduleId="rfis" moduleName="RFIs"><RFIs /></ProtectedRoute></PageSuspense>} />
            <Route path="/submittals" element={<PageSuspense><ProtectedRoute moduleId="submittals" moduleName="Submittals"><Submittals /></ProtectedRoute></PageSuspense>} />
            <Route path="/schedule" element={<PageSuspense><ProtectedRoute moduleId="schedule" moduleName="Schedule"><Schedule /></ProtectedRoute></PageSuspense>} />
            <Route path="/lookahead" element={<PageSuspense><ProtectedRoute moduleId="lookahead" moduleName="Lookahead"><Lookahead /></ProtectedRoute></PageSuspense>} />
            <Route path="/budget" element={<PageSuspense><ProtectedRoute moduleId="budget" moduleName="Budget"><Budget /></ProtectedRoute></PageSuspense>} />
            <Route path="/change-orders" element={<PageSuspense><ProtectedRoute moduleId="change-orders" moduleName="Change Orders"><ChangeOrders /></ProtectedRoute></PageSuspense>} />
            <Route path="/daily-log" element={<PageSuspense><ProtectedRoute moduleId="daily-log" moduleName="Daily Log"><DailyLog /></ProtectedRoute></PageSuspense>} />
            <Route path="/field-capture" element={<PageSuspense><ProtectedRoute moduleId="field-capture" moduleName="Field Capture"><FieldCapture /></ProtectedRoute></PageSuspense>} />
            <Route path="/punch-list" element={<PageSuspense><ProtectedRoute moduleId="punch-list" moduleName="Punch List"><PunchList /></ProtectedRoute></PageSuspense>} />
            <Route path="/crews" element={<PageSuspense><ProtectedRoute moduleId="crews" moduleName="Crews"><Crews /></ProtectedRoute></PageSuspense>} />
            <Route path="/safety" element={<PageSuspense><ProtectedRoute moduleId="safety" moduleName="Safety"><Safety /></ProtectedRoute></PageSuspense>} />
            <Route path="/estimating" element={<PageSuspense><ProtectedRoute moduleId="estimating" moduleName="Estimating"><Estimating /></ProtectedRoute></PageSuspense>} />
            <Route path="/procurement" element={<PageSuspense><ProtectedRoute moduleId="procurement" moduleName="Procurement"><Procurement /></ProtectedRoute></PageSuspense>} />
            <Route path="/equipment" element={<PageSuspense><ProtectedRoute moduleId="equipment" moduleName="Equipment"><EquipmentPage /></ProtectedRoute></PageSuspense>} />
            <Route path="/directory" element={<PageSuspense><ProtectedRoute moduleId="directory" moduleName="Directory"><Directory /></ProtectedRoute></PageSuspense>} />
            <Route path="/meetings" element={<PageSuspense><ProtectedRoute moduleId="meetings" moduleName="Meetings"><Meetings /></ProtectedRoute></PageSuspense>} />
            <Route path="/files" element={<PageSuspense><ProtectedRoute moduleId="files" moduleName="Files"><Files /></ProtectedRoute></PageSuspense>} />
            <Route path="/copilot" element={<PageSuspense><ProtectedRoute moduleId="copilot" moduleName="AI Copilot"><AICopilot /></ProtectedRoute></PageSuspense>} />
            <Route path="/activity" element={<PageSuspense><ProtectedRoute moduleId="activity" moduleName="Activity"><Activity /></ProtectedRoute></PageSuspense>} />
            <Route path="/audit-trail" element={<PageSuspense><ProtectedRoute moduleId="audit-trail" moduleName="Audit Trail"><AuditTrail /></ProtectedRoute></PageSuspense>} />
            <Route path="/project-health" element={<PageSuspense><ProtectedRoute moduleId="project-health" moduleName="Project Health"><ProjectHealth /></ProtectedRoute></PageSuspense>} />
            <Route path="/financials" element={<PageSuspense><ProtectedRoute moduleId="financials" moduleName="Financials"><Financials /></ProtectedRoute></PageSuspense>} />
            <Route path="/pay-apps" element={<PageSuspense><ProtectedRoute moduleId="pay-apps" moduleName="Payment Applications"><PaymentApplications /></ProtectedRoute></PageSuspense>} />
            <Route path="/portal/owner" element={<PageSuspense><ProtectedRoute requiredPermission="project.settings" moduleName="Owner Portal"><OwnerPortal /></ProtectedRoute></PageSuspense>} />
            <Route path="/ai-agents" element={<PageSuspense><ProtectedRoute moduleId="ai-agents" moduleName="AI Agents"><AIAgents /></ProtectedRoute></PageSuspense>} />
            <Route path="/workforce" element={<PageSuspense><ProtectedRoute moduleId="workforce" moduleName="Workforce"><Workforce /></ProtectedRoute></PageSuspense>} />
            <Route path="/permits" element={<PageSuspense><ProtectedRoute moduleId="permits" moduleName="Permits"><Permits /></ProtectedRoute></PageSuspense>} />
            <Route path="/integrations" element={<PageSuspense><ProtectedRoute moduleId="integrations" moduleName="Integrations"><Integrations /></ProtectedRoute></PageSuspense>} />
            <Route path="/reports" element={<PageSuspense><ProtectedRoute moduleId="reports" moduleName="Reports"><Reports /></ProtectedRoute></PageSuspense>} />
            <Route path="/reports/owner" element={<PageSuspense><ProtectedRoute moduleId="reports" moduleName="Reports"><OwnerReportPage /></ProtectedRoute></PageSuspense>} />
            <Route path="/lien-waivers" element={<PageSuspense><ProtectedRoute moduleId="lien-waivers" moduleName="Lien Waivers"><LienWaivers /></ProtectedRoute></PageSuspense>} />
            <Route path="/onboarding" element={<PageSuspense><Onboarding /></PageSuspense>} />
            <Route path="*" element={<PageSuspense><NotFound /></PageSuspense>} />
          </Routes>
        </motion.div>
      </AnimatePresence>
    </>
  );
}

function AppContent() {
  const { sidebarCollapsed, setSidebarCollapsed, setActiveView } = useUiStore();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const isTablet = useMediaQuery('(min-width: 768px) and (max-width: 1024px)');
  useTheme();

  const projectId = useProjectId();
  const { user } = useAuth();
  usePrefetchRoutes(!!user);
  const { conflictCount } = useOfflineStatus();
  const { needRefresh, offlineReady, updateServiceWorker } = useServiceWorkerUpdate();
  const [conflictModalOpen, setConflictModalOpen] = useState(false);

  // Auth pages render without the app shell (no sidebar, no offline banner)
  const isAuthPage = ['/login', '/signup', '/onboarding'].includes(location.pathname);

  useProjectCache(isAuthPage ? undefined : projectId);

  // Listen for background sync completion from SW
  useEffect(() => {
    const handler = () => syncManager.refreshCounts();
    window.addEventListener('background-sync-complete', handler);
    return () => window.removeEventListener('background-sync-complete', handler);
  }, []);

  // Show SW update toast
  useEffect(() => {
    if (needRefresh) {
      toast.info('A new version of SiteSync is available', {
        duration: Infinity,
        action: { label: 'Update Now', onClick: () => updateServiceWorker(true) },
        id: 'sw-update',
      });
    }
  }, [needRefresh, updateServiceWorker]);

  useEffect(() => {
    if (offlineReady) {
      toast.success('SiteSync is ready for offline use');
    }
  }, [offlineReady]);

  // Auto-open conflict modal when conflicts appear
  useEffect(() => {
    if (conflictCount > 0) setConflictModalOpen(true);
  }, [conflictCount]);

  // Move focus to main content on route change for keyboard and screen reader users
  useEffect(() => {
    const id = setTimeout(() => {
      document.getElementById('main-content')?.focus();
    }, 100);
    return () => clearTimeout(id);
  }, [location.pathname]);

  const activeView = location.pathname.replace('/', '') || 'dashboard';

  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  // Remember the desktop sidebar preference so we can restore it when the
  // viewport grows back above the mobile breakpoint.
  const prevDesktopCollapsed = useRef(sidebarCollapsed);

  useEffect(() => {
    if (isMobile) {
      prevDesktopCollapsed.current = sidebarCollapsed;
      setSidebarCollapsed(true);
    } else if (isTablet) {
      prevDesktopCollapsed.current = sidebarCollapsed;
      setSidebarCollapsed(true);
    } else {
      setSidebarCollapsed(prevDesktopCollapsed.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMobile, isTablet]);
  const { toggleContextPanel, contextPanelOpen } = useAIAnnotationStore();
  const { openCopilot: closeCopilot, isOpen: copilotOpen } = useCopilotStore();

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
    return <AppRoutes />;
  }

  // Strictly exclusive layout: mobile uses bottom nav (MobileLayout), desktop uses Sidebar
  return isMobile ? (
    <MobileLayout>
      {user && <AuthenticatedProviders activeView={activeView} />}
      <OfflineBanner />
      <ChunkLoadErrorBoundary>
        <ErrorBoundary fallback={<ErrorFallback />}>
          <AppRoutes />
        </ErrorBoundary>
      </ChunkLoadErrorBoundary>
      <Suspense fallback={null}><FloatingAIButton /></Suspense>
      {copilotOpen && <aside role="complementary" aria-label="AI Assistant"><Suspense fallback={null}><CopilotPanel /></Suspense></aside>}
      <ConflictResolutionModal open={conflictModalOpen} onClose={() => setConflictModalOpen(false)} />
    </MobileLayout>
  ) : (
    <SidebarContext.Provider value={{ collapsed: sidebarCollapsed, setCollapsed: setSidebarCollapsed }}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          height: '100vh',
          backgroundColor: colorVars.surfacePage,
          fontFamily: typographyConfig.fontFamily,
          touchAction: 'manipulation',
        }}
      >
        <SkipToContent />
        {user && <AuthenticatedProviders activeView={activeView} />}
        <nav role="navigation" aria-label="Main navigation">
          <Sidebar activeView={activeView} onNavigate={handleNavigate} />
        </nav>

        <main
          id="main-content"
          role="main"
          aria-label="Page content"
          tabIndex={-1}
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            marginLeft: isMobile ? 0 : (sidebarCollapsed ? 64 : 240),
            overflow: 'auto',
            transition: 'margin-left 150ms ease-out',
          }}
        >
          <OfflineBanner />
          <ChunkLoadErrorBoundary>
            <ErrorBoundary>
              <AppRoutes />
            </ErrorBoundary>
          </ChunkLoadErrorBoundary>
        </main>

        <CommandPalette open={commandPaletteOpen} onClose={() => setCommandPaletteOpen(false)} />
        {notificationsOpen && <Suspense fallback={null}><NotificationCenter open={notificationsOpen} onClose={() => setNotificationsOpen(false)} /></Suspense>}
        {shortcutsOpen && <Suspense fallback={null}><ShortcutOverlay open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} /></Suspense>}
        {exportOpen && <Suspense fallback={null}><ExportCenter open={exportOpen} onClose={() => setExportOpen(false)} /></Suspense>}
        {contextPanelOpen && <Suspense fallback={null}><AIContextPanel currentPage={activeView} /></Suspense>}
        <Suspense fallback={null}><FloatingAIButton /></Suspense>
        {copilotOpen && <aside role="complementary" aria-label="AI Assistant"><Suspense fallback={null}><CopilotPanel /></Suspense></aside>}
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

function ErrorFallback() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: colors.bgLight,
        padding: spacing['8'],
      }}
    >
      <div
        style={{
          backgroundColor: colors.white,
          borderRadius: '12px',
          padding: '24px',
          maxWidth: '480px',
          width: '100%',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: spacing['4'],
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            backgroundColor: colors.statusCriticalSubtle,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <HardHat size={32} color={colors.statusCritical} />
        </div>
        <h2
          style={{
            fontSize: typography.fontSize.heading,
            fontWeight: typography.fontWeight.semibold,
            color: colors.textPrimary,
            margin: 0,
          }}
        >
          Something went wrong
        </h2>
        <p
          style={{
            fontSize: typography.fontSize.body,
            color: colors.textSecondary,
            margin: 0,
          }}
        >
          An unexpected error occurred. Please try again.
        </p>
        <button
          onClick={() => window.location.reload()}
          style={{
            width: '100%',
            padding: `${spacing['3']} ${spacing['6']}`,
            backgroundColor: colors.primaryOrange,
            color: colors.white,
            border: 'none',
            borderRadius: '6px',
            fontSize: typography.fontSize.body,
            fontWeight: typography.fontWeight.medium,
            fontFamily: typography.fontFamily,
            cursor: 'pointer',
          }}
        >
          Reload Page
        </button>
        <a
          href="/"
          style={{
            fontSize: typography.fontSize.body,
            color: colors.textSecondary,
            textDecoration: 'none',
          }}
        >
          Go to Dashboard
        </a>
      </div>
    </div>
  );
}

function App() {
  useEffect(() => {
    const handler = (event: PromiseRejectionEvent) => {
      const reason = event.reason?.message || String(event.reason || '');
      if (reason.includes('Loading chunk') || reason.includes('Failed to fetch dynamically imported module')) {
        toast.error('A new version is available. Please refresh the page.', {
          action: { label: 'Refresh', onClick: () => window.location.reload() },
        });
      }
    };
    window.addEventListener('unhandledrejection', handler);
    return () => window.removeEventListener('unhandledrejection', handler);
  }, []);

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
