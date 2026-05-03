import React, { Suspense, lazy, useState, useEffect, useRef } from 'react';
import { HardHat } from 'lucide-react';
import { HashRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { SidebarContext, ToastProvider } from './components/Primitives';
import { CommandPalette } from './components/CommandPalette';
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
import { MfaRequiredBanner } from './components/auth/MfaRequiredBanner';
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
import { useProjectInit } from './hooks/useProjectInit';
import { ProjectGate } from './components/ProjectGate';
import { useAuth } from './hooks/useAuth';
import { useFieldSession } from './hooks/useFieldSession';
import { SkipToContent } from './components/ui/SkipToContent';
import { RouteAnnouncer } from './components/ui/RouteAnnouncer';
import { LiveRegion } from './components/ui/LiveRegion';
import { ConflictResolutionModal } from './components/ui/ConflictResolutionModal';
import { useProjectCache } from './hooks/useProjectCache';
import { useOfflineStatus } from './hooks/useOfflineStatus';
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
// Public, unauthenticated trust center page used by procurement reviewers.
const SecurityOverview = lazy(() => import('./pages/SecurityOverview'));
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { FLAGS } from './lib/featureFlags';
const MagicLinkSubRoute = lazy(() => import('./components/MagicLinkSubRoute'));
const MagicLinkOwnerRoute = lazy(() => import('./components/MagicLinkOwnerRoute'));

// Lazy loaded overlay panels (only render when opened)
const AIContextPanel = lazy(() => import('./components/ai/AIContextPanel').then((m) => ({ default: m.AIContextPanel })));
const FloatingAIButton = lazy(() => import('./components/ai/FloatingAIButton').then((m) => ({ default: m.FloatingAIButton })));
const CopilotPanel = lazy(() => import('./components/ai/CopilotPanel').then((m) => ({ default: m.CopilotPanel })));
// NotificationList from this same module is statically imported by
// MobileLayout, which pulls the whole file into the eager bundle anyway.
// Keeping NotificationCenter lazy here would just trigger a duplicate
// chunking warning without saving bytes — import directly instead.
import { NotificationCenter } from './components/notifications/NotificationCenter';
const ShortcutOverlay = lazy(() => import('./components/ui/ShortcutOverlay').then((m) => ({ default: m.ShortcutOverlay })));
const ExportCenter = lazy(() => import('./components/export/ExportCenter').then((m) => ({ default: m.ExportCenter })));

// ── Lazy loaded pages ─────────────────────────────────────
// The Nine
const DayPage = lazyWithRetry(() => import('./pages/day/index'));
const FieldPage = lazyWithRetry(() => import('./pages/field/index'));
// /conversation and /site now redirect to /day (Wave 1 homepage redesign);
// their page components are no longer routed.
const PlanPage = lazyWithRetry(() => import('./pages/plan/index'));
const LedgerPage = lazyWithRetry(() => import('./pages/ledger/index'));
const CrewPage = lazyWithRetry(() => import('./pages/crew/index'));
const SetPage = lazyWithRetry(() => import('./pages/set/index'));
const FilePage = lazyWithRetry(() => import('./pages/file/index'));
// Core 10
// /dashboard redirects to /day (Wave 1 homepage redesign), so the legacy
// Dashboard component no longer needs to be lazy-imported. The page file is
// retained (smoke tests still reference it) but is unrouted.
const DailyLog = lazyWithRetry(() => import('./pages/daily-log').then((m) => ({ default: m.DailyLog })));
const Schedule = lazyWithRetry(() => import('./pages/schedule').then((m) => ({ default: m.Schedule })));
const Budget = lazy(() => import('./pages/Budget').then((m) => ({ default: m.Budget })));
const RFIs = lazyWithRetry(() => import('./pages/RFIs').then((m) => ({ default: m.RFIs })));
const RFIDetail = lazy(() => import('./pages/rfis/RFIDetail').then((m) => ({ default: m.RFIDetail })));
const Submittals = lazy(() => import('./pages/submittals').then((m) => ({ default: m.Submittals })));
const SubmittalDetailPage = lazy(() => import('./pages/submittals/SubmittalDetailPage'));
const SpecParserPage = lazy(() => import('./pages/submittals/SpecParserPage'));
const PunchList = lazyWithRetry(() => import('./pages/punch-list').then((m) => ({ default: m.PunchList })));
const PunchItemDetailPage = lazy(() => import('./pages/punch-list/PunchItemDetailPage'));
const Drawings = lazy(() => import('./pages/drawings/index').then((m) => ({ default: m.Drawings })));
const ChangeOrders = lazy(() => import('./pages/ChangeOrders').then((m) => ({ default: m.ChangeOrders })));
const Tasks = lazyWithRetry(() => import('./pages/Tasks').then((m) => ({ default: m.Tasks })));
const Commitments = lazyWithRetry(() => import('./pages/Commitments').then((m) => ({ default: m.Commitments })));
const Safety = lazy(() => import('./pages/safety/index').then((m) => ({ default: m.Safety })));
const FieldCapture = lazy(() => import('./pages/field-capture/index').then((m) => ({ default: m.FieldCapturePage })));
// People & Labor
const Workforce = lazy(() => import('./pages/Workforce'));
const Crews = lazy(() => import('./pages/Crews').then((m) => ({ default: m.Crews })));
const TimeTracking = lazy(() => import('./pages/TimeTracking'));
const Directory = lazy(() => import('./pages/Directory').then((m) => ({ default: m.Directory })));
const Meetings = lazy(() => import('./pages/Meetings').then((m) => ({ default: m.Meetings })));
// Financial
const PaymentApplications = lazy(() => import('./pages/payment-applications'));
const Contracts = lazy(() => import('./pages/Contracts').then((m) => ({ default: m.Contracts })));
const Estimating = lazy(() => import('./pages/Estimating'));
// Field Ops
const EquipmentPage = lazy(() => import('./pages/Equipment'));
const Procurement = lazy(() => import('./pages/Procurement'));
const Permits = lazy(() => import('./pages/Permits'));
// Documents & Closeout
const Files = lazy(() => import('./pages/files').then((m) => ({ default: m.Files })));
const Reports = lazy(() => import('./pages/Reports'));
const Closeout = lazy(() => import('./pages/Closeout').then((m) => ({ default: m.Closeout })));
const BIMViewerPage = lazy(() => import('./pages/bim/BIMViewerPage'));
// Intelligence
const AIAssistant = lazy(() => import('./pages/AIAssistant'));
const IrisInbox = lazy(() => import('./pages/iris/IrisInboxPage'));
// Utility & Admin
const AuditTrail = lazy(() => import('./pages/AuditTrail').then((m) => ({ default: m.AuditTrail })));
const Integrations = lazy(() => import('./pages/Integrations'));
const OwnerReportPage = lazy(() => import('./pages/OwnerReportPage'));
const WorkflowSettings = lazy(() => import('./pages/Settings/WorkflowSettings'));
const ProjectSettings = lazy(() => import('./pages/admin/ProjectSettings').then((m) => ({ default: m.ProjectSettings })));
const UserManagement = lazy(() => import('./pages/admin/UserManagement').then((m) => ({ default: m.UserManagement })));
const NotificationSettings = lazy(() => import('./pages/Settings/NotificationSettings'));
const UserProfile = lazy(() => import('./pages/UserProfile'));
const ProjectBrain = lazy(() => import('./components/ai/ProjectBrain').then((m) => ({ default: m.ProjectBrain })));
const Onboarding = lazy(() => import('./pages/Onboarding').then((m) => ({ default: m.Onboarding })));
const NotFound = lazy(() => import('./pages/errors/NotFound').then((m) => ({ default: m.NotFound })));
const BulkInvitePage = lazy(() => import('./pages/admin/bulk-invite'));
const CostCodeLibraryPage = lazy(() => import('./pages/admin/cost-code-library'));
const ProjectTemplatesPage = lazy(() => import('./pages/admin/project-templates'));
const ProcoreImportPage = lazy(() => import('./pages/admin/procore-import'));
const ComplianceCockpit = lazy(() => import('./pages/admin/compliance'));
const WalkthroughPage = lazy(() => import('./pages/walkthrough'));
const OwnerPayAppPreviewPage = lazy(() => import('./pages/share/OwnerPayAppPreview'));

const typographyConfig = { fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' };

// Prefetch strategy: once the user is authenticated, kick off background downloads
// of the three most visited pages so their chunks are already in the browser cache
// by the time the user navigates to them. We defer to requestIdleCallback (or a
// 1000ms setTimeout fallback) so this never competes with the initial render.
function usePrefetchRoutes(isAuthenticated: boolean) {
  useEffect(() => {
    if (!isAuthenticated) return;
    const prefetch = () => {
      import('./pages/day/index');
      import('./pages/field/index');
      import('./pages/plan/index');
      import('./pages/ledger/index');
      import('./pages/RFIs');
      import('./pages/daily-log');
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
          Go home
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
            <Route path="/security" element={<PageSuspense><SecurityOverview /></PageSuspense>} />

            {/* ── The Nine ── */}
            <Route path="/day" element={<PageSuspense><ProtectedRoute moduleId="day" moduleName="The Day"><DayPage /></ProtectedRoute></PageSuspense>} />
            <Route path="/field" element={<PageSuspense><ProtectedRoute moduleId="field" moduleName="The Field"><FieldPage /></ProtectedRoute></PageSuspense>} />
            {/* /conversation merges into the Command stream — Wave 1 redirect */}
            <Route path="/conversation" element={<Navigate to="/day" replace />} />
            <Route path="/plan" element={<PageSuspense><ProtectedRoute moduleId="plan" moduleName="The Plan"><PlanPage /></ProtectedRoute></PageSuspense>} />
            <Route path="/ledger" element={<PageSuspense><ProtectedRoute moduleId="ledger" moduleName="The Ledger"><LedgerPage /></ProtectedRoute></PageSuspense>} />
            <Route path="/crew" element={<PageSuspense><ProtectedRoute moduleId="crew" moduleName="The Crew"><CrewPage /></ProtectedRoute></PageSuspense>} />
            <Route path="/set" element={<PageSuspense><ProtectedRoute moduleId="set" moduleName="The Set"><SetPage /></ProtectedRoute></PageSuspense>} />
            <Route path="/file" element={<PageSuspense><ProtectedRoute moduleId="file" moduleName="The File"><FilePage /></ProtectedRoute></PageSuspense>} />
            {/* /site merges into the Command stream — Wave 1 redirect */}
            <Route path="/site" element={<Navigate to="/day" replace />} />

            {/* Magic-link sub access — renders the same DayPage with an
                ActorContext of kind 'magic_link'. Token validation is handled
                by the wrapper; no auth session required. */}
            <Route path="/sub/:token" element={<PageSuspense><MagicLinkSubRoute /></PageSuspense>} />
            <Route path="/owner/:token" element={<PageSuspense><MagicLinkOwnerRoute /></PageSuspense>} />

            {/* ── Core 10 ── */}
            <Route path="/" element={<PageSuspense><ProtectedRoute moduleId="day" moduleName="The Day"><DayPage /></ProtectedRoute></PageSuspense>} />
            {/* /dashboard merges into the Command stream — Wave 1 redirect */}
            <Route path="/dashboard" element={<Navigate to="/day" replace />} />
            <Route path="/daily-log" element={<PageSuspense><ProtectedRoute moduleId="daily-log" moduleName="Daily Log"><DailyLog /></ProtectedRoute></PageSuspense>} />
            <Route path="/schedule" element={<PageSuspense><ProtectedRoute moduleId="schedule" moduleName="Schedule"><Schedule /></ProtectedRoute></PageSuspense>} />
            <Route path="/budget" element={<PageSuspense><ProtectedRoute moduleId="budget" moduleName="Budget"><Budget /></ProtectedRoute></PageSuspense>} />
            <Route path="/rfis" element={<PageSuspense><ProtectedRoute moduleId="rfis" moduleName="RFIs"><RFIs /></ProtectedRoute></PageSuspense>} />
            <Route path="/rfis/:rfiId" element={<PageSuspense><ProtectedRoute moduleId="rfis" moduleName="RFI Detail"><RFIDetail /></ProtectedRoute></PageSuspense>} />
            <Route path="/submittals" element={<PageSuspense><ProtectedRoute moduleId="submittals" moduleName="Submittals"><Submittals /></ProtectedRoute></PageSuspense>} />
            <Route path="/submittals/:submittalId" element={<PageSuspense><ProtectedRoute moduleId="submittals" moduleName="Submittal Detail"><SubmittalDetailPage /></ProtectedRoute></PageSuspense>} />
            <Route path="/submittals/spec-parser" element={FLAGS.specParser ? <PageSuspense><ProtectedRoute moduleId="submittals" moduleName="Spec Parser"><SpecParserPage /></ProtectedRoute></PageSuspense> : <Navigate to="/submittals" replace />} />
            <Route path="/punch-list" element={<PageSuspense><ProtectedRoute moduleId="punch-list" moduleName="Punch List"><PunchList /></ProtectedRoute></PageSuspense>} />
            <Route path="/punch-list/:itemId" element={<PageSuspense><ProtectedRoute moduleId="punch-list" moduleName="Punch Item Detail"><PunchItemDetailPage /></ProtectedRoute></PageSuspense>} />
            <Route path="/drawings" element={<PageSuspense><ProtectedRoute moduleId="drawings" moduleName="Drawings"><Drawings /></ProtectedRoute></PageSuspense>} />
            <Route path="/change-orders" element={<PageSuspense><ProtectedRoute moduleId="change-orders" moduleName="Change Orders"><ChangeOrders /></ProtectedRoute></PageSuspense>} />
            <Route path="/safety" element={<PageSuspense><ProtectedRoute moduleId="safety" moduleName="Safety"><Safety /></ProtectedRoute></PageSuspense>} />

            {/* ── People & Labor ── */}
            <Route path="/workforce" element={<PageSuspense><ProtectedRoute moduleId="workforce" moduleName="Workforce"><Workforce /></ProtectedRoute></PageSuspense>} />
            <Route path="/crews" element={<PageSuspense><ProtectedRoute moduleId="crews" moduleName="Crews"><Crews /></ProtectedRoute></PageSuspense>} />
            <Route path="/time-tracking" element={<PageSuspense><ProtectedRoute moduleId="time-tracking" moduleName="Time Tracking"><TimeTracking /></ProtectedRoute></PageSuspense>} />
            <Route path="/directory" element={<PageSuspense><ProtectedRoute moduleId="directory" moduleName="Directory"><Directory /></ProtectedRoute></PageSuspense>} />
            <Route path="/meetings" element={<PageSuspense><ProtectedRoute moduleId="meetings" moduleName="Meetings"><Meetings /></ProtectedRoute></PageSuspense>} />

            {/* ── Financial ── */}
            <Route path="/pay-apps" element={<PageSuspense><ProtectedRoute moduleId="pay-apps" moduleName="Payment Applications"><PaymentApplications /></ProtectedRoute></PageSuspense>} />
            <Route path="/payment-applications" element={<Navigate to="/pay-apps" replace />} />
            <Route path="/contracts" element={<PageSuspense><ProtectedRoute moduleId="contracts" moduleName="Contracts"><Contracts /></ProtectedRoute></PageSuspense>} />
            <Route path="/estimating" element={<PageSuspense><ProtectedRoute moduleId="estimating" moduleName="Estimating"><Estimating /></ProtectedRoute></PageSuspense>} />

            {/* ── Field Ops ── */}
            <Route path="/equipment" element={<PageSuspense><ProtectedRoute moduleId="equipment" moduleName="Equipment"><EquipmentPage /></ProtectedRoute></PageSuspense>} />
            <Route path="/procurement" element={<PageSuspense><ProtectedRoute moduleId="procurement" moduleName="Procurement"><Procurement /></ProtectedRoute></PageSuspense>} />
            <Route path="/permits" element={<PageSuspense><ProtectedRoute moduleId="permits" moduleName="Permits"><Permits /></ProtectedRoute></PageSuspense>} />

            {/* ── Documents & Closeout ── */}
            <Route path="/files" element={<PageSuspense><ProtectedRoute moduleId="files" moduleName="Files"><Files /></ProtectedRoute></PageSuspense>} />
            <Route path="/reports" element={<PageSuspense><ProtectedRoute moduleId="reports" moduleName="Reports"><Reports /></ProtectedRoute></PageSuspense>} />
            <Route path="/reports/owner" element={FLAGS.ownerReport ? <PageSuspense><ProtectedRoute moduleId="reports" moduleName="Reports"><OwnerReportPage /></ProtectedRoute></PageSuspense> : <Navigate to="/reports" replace />} />
            <Route path="/closeout" element={<PageSuspense><ProtectedRoute moduleId="closeout" moduleName="Closeout"><Closeout /></ProtectedRoute></PageSuspense>} />
            <Route path="/bim" element={FLAGS.bimViewer ? <PageSuspense><ProtectedRoute moduleId="bim" moduleName="3D Model Viewer"><BIMViewerPage /></ProtectedRoute></PageSuspense> : <Navigate to="/dashboard" replace />} />

            {/* ── Intelligence ── */}
            <Route path="/ai" element={<PageSuspense><ProtectedRoute moduleId="ai" moduleName="AI Assistant"><AIAssistant /></ProtectedRoute></PageSuspense>} />
            <Route path="/iris/inbox" element={FLAGS.irisInbox ? <PageSuspense><ProtectedRoute moduleId="ai" moduleName="Iris Inbox"><IrisInbox /></ProtectedRoute></PageSuspense> : <Navigate to="/ai" replace />} />

            {/* ── Utility & Admin ── */}
            <Route path="/audit-trail" element={<PageSuspense><ProtectedRoute moduleId="audit-trail" moduleName="Audit Trail"><AuditTrail /></ProtectedRoute></PageSuspense>} />
            <Route path="/integrations" element={<PageSuspense><ProtectedRoute moduleId="integrations" moduleName="Integrations"><Integrations /></ProtectedRoute></PageSuspense>} />
            <Route path="/settings/workflows" element={FLAGS.approvalWorkflows ? <PageSuspense><ProtectedRoute moduleId="settings" moduleName="Workflow Settings"><WorkflowSettings /></ProtectedRoute></PageSuspense> : <Navigate to="/settings" replace />} />
            <Route path="/settings" element={<PageSuspense><ProjectSettings /></PageSuspense>} />
            <Route path="/settings/team" element={<PageSuspense><UserManagement /></PageSuspense>} />
            <Route path="/settings/notifications" element={<PageSuspense><NotificationSettings /></PageSuspense>} />
            <Route path="/admin/bulk-invite" element={FLAGS.bulkInvite ? <PageSuspense><ProtectedRoute moduleId="settings" moduleName="Bulk Invite"><BulkInvitePage /></ProtectedRoute></PageSuspense> : <Navigate to="/settings/team" replace />} />
            <Route path="/admin/cost-code-library" element={<PageSuspense><ProtectedRoute moduleId="settings" moduleName="Cost Code Library"><CostCodeLibraryPage /></ProtectedRoute></PageSuspense>} />
            <Route path="/admin/project-templates" element={FLAGS.projectTemplates ? <PageSuspense><ProtectedRoute moduleId="settings" moduleName="Project Templates"><ProjectTemplatesPage /></ProtectedRoute></PageSuspense> : <Navigate to="/dashboard" replace />} />
            <Route path="/admin/procore-import" element={FLAGS.procoreImport ? <PageSuspense><ProtectedRoute moduleId="integrations" moduleName="Procore Import"><ProcoreImportPage /></ProtectedRoute></PageSuspense> : <Navigate to="/integrations" replace />} />
            <Route path="/admin/compliance" element={FLAGS.complianceCockpit ? <PageSuspense><ProtectedRoute moduleId="settings" moduleName="Compliance"><ComplianceCockpit /></ProtectedRoute></PageSuspense> : <Navigate to="/dashboard" replace />} />
            <Route path="/walkthrough" element={FLAGS.walkthrough ? <PageSuspense><ProtectedRoute moduleId="field-capture" moduleName="Walk-Through"><WalkthroughPage /></ProtectedRoute></PageSuspense> : <Navigate to="/field-capture" replace />} />
            <Route path="/share/owner-payapp/:token" element={<PageSuspense><OwnerPayAppPreviewPage /></PageSuspense>} />
            <Route path="/profile" element={<PageSuspense><UserProfile /></PageSuspense>} />
            <Route path="/onboarding" element={<PageSuspense><Onboarding /></PageSuspense>} />

            {/* Catch-all PM/super inbox + commitment register. */}
            <Route path="/tasks" element={<PageSuspense><ProtectedRoute moduleId="tasks" moduleName="Tasks"><Tasks /></ProtectedRoute></PageSuspense>} />
            <Route path="/commitments" element={<PageSuspense><ProtectedRoute moduleId="commitments" moduleName="Commitments"><Commitments /></ProtectedRoute></PageSuspense>} />

            {/* ── Redirects: merged pages ── */}
            <Route path="/lookahead" element={<Navigate to="/schedule" replace />} />
            <Route path="/field-capture" element={<PageSuspense><ProtectedRoute moduleId="field-capture" moduleName="Field Capture"><FieldCapture /></ProtectedRoute></PageSuspense>} />
            <Route path="/financials" element={<Navigate to="/budget" replace />} />
            <Route path="/cost-management" element={<Navigate to="/budget" replace />} />
            <Route path="/vendors" element={<Navigate to="/contracts" replace />} />

            {/* ── Redirects: cut pages ── */}
            <Route path="/portfolio" element={<Navigate to="/dashboard" replace />} />
            <Route path="/digital-twin" element={<Navigate to="/bim" replace />} />
            <Route path="/carbon" element={<Navigate to="/dashboard" replace />} />
            <Route path="/compliance" element={<Navigate to="/dashboard" replace />} />
            <Route path="/wiki" element={<Navigate to="/files" replace />} />
            <Route path="/site-map" element={<Navigate to="/dashboard" replace />} />
            <Route path="/portal/owner" element={<Navigate to="/reports" replace />} />
            <Route path="/ai-agents" element={<Navigate to="/ai" replace />} />
            <Route path="/copilot" element={<Navigate to="/ai" replace />} />

            {/* ── Redirects: legacy aliases ── */}
            <Route path="/activity" element={<Navigate to="/dashboard" replace />} />
            <Route path="/project-health" element={<Navigate to="/dashboard" replace />} />
            <Route path="/lien-waivers" element={<Navigate to="/pay-apps" replace />} />
            <Route path="/transmittals" element={<Navigate to="/files" replace />} />
            <Route path="/specifications" element={<Navigate to="/files" replace />} />
            <Route path="/preconstruction" element={<Navigate to="/estimating" replace />} />
            <Route path="/resources" element={<Navigate to="/estimating" replace />} />
            <Route path="/deliveries" element={<Navigate to="/procurement" replace />} />
            <Route path="/site-intelligence" element={<Navigate to="/dashboard" replace />} />

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
  const { isLoading: projectsLoading } = useProjectInit(); // Sync React Query projects → Zustand store + auto-select first project
  const { user } = useAuth();
  usePrefetchRoutes(!!user);
  const { conflictCount } = useOfflineStatus();
  const [conflictModalOpen, setConflictModalOpen] = useState(false);
  // PMF telemetry: the metric that decides whether the vision is working.
  // See VISION.md and useFieldSuperPMF — target is 8+ field sessions/day
  // per super within 30 days of onboarding.
  useFieldSession('view');

  // Auth pages render without the app shell (no sidebar, no offline banner)
  const isAuthPage = ['/login', '/signup', '/onboarding'].includes(location.pathname);

  useProjectCache(isAuthPage ? undefined : projectId);

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
    // Mobile uses MobileLayout entirely — collapse so any flicker through the
    // desktop tree doesn't widen the layout. iPad keeps the full sidebar
    // because (a) the Sidebar component renders at a fixed 252px regardless of
    // the `collapsed` flag, so collapsing only desyncs the main margin and
    // hides content behind the sidebar, and (b) 1024px viewports comfortably
    // fit 252px sidebar + 772px content.
    if (isMobile) {
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
    { key: '1', meta: true, description: 'Command (The Day)', action: () => handleNavigate('day') },
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
    { keys: ['g', 'd'], sequential: true, action: () => navigate('/day') },
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
      {user && <MfaRequiredBanner />}
      <OfflineBanner />
      <ChunkLoadErrorBoundary>
        {/* key={pathname} resets the boundary on navigation so a crash on one page
            doesn't lock the user out of every other page. */}
        <ErrorBoundary key={location.pathname} fallback={<ErrorFallback />}>
          {!projectId && !projectsLoading && !['portfolio', 'settings'].some(p => activeView.startsWith(p))
            ? <ProjectGate />
            : <AppRoutes />
          }
        </ErrorBoundary>
      </ChunkLoadErrorBoundary>
      <Suspense fallback={null}><FloatingAIButton /></Suspense>
      {user && <Suspense fallback={null}><ProjectBrain /></Suspense>}
      {copilotOpen && <aside role="complementary" aria-label="AI Assistant"><Suspense fallback={null}><CopilotPanel /></Suspense></aside>}
      <ConflictResolutionModal open={conflictModalOpen} onClose={() => setConflictModalOpen(false)} />
    </MobileLayout>
  ) : (
    <SidebarContext.Provider value={{ collapsed: sidebarCollapsed, setCollapsed: setSidebarCollapsed }}>
      <div
        style={{
          // CSS Grid is the layout's single source of truth: the sidebar
          // lives in the first track sized by --sidebar-w, the main column
          // takes the rest. Sidebar width and main offset cannot desync
          // because they are literally the same grid track. Both children
          // explicitly pin themselves to their column so adding any future
          // sibling (overlays, providers, dev banners) cannot perturb the
          // auto-flow and push <main> into column 1 — that exact bug
          // collapsed the entire viewport when the sidebar was hidden.
          display: 'grid',
          gridTemplateColumns: `${sidebarCollapsed ? '0' : '252px'} minmax(0, 1fr)`,
          height: '100vh',
          backgroundColor: colorVars.surfacePage,
          fontFamily: typographyConfig.fontFamily,
          touchAction: 'manipulation',
          transition: 'grid-template-columns 150ms ease-out',
        }}
      >
        <SkipToContent />
        {user && <AuthenticatedProviders activeView={activeView} />}
        {!sidebarCollapsed && (
          <div style={{ gridColumn: '1 / 2', minWidth: 0, overflow: 'hidden' }}>
            <Sidebar activeView={activeView} onNavigate={handleNavigate} />
          </div>
        )}

        <main
          id="main-content"
          role="main"
          aria-label="Page content"
          tabIndex={-1}
          style={{
            // Always live in column 2 regardless of which siblings are
            // mounted. Without this, when <Sidebar> is unmounted on
            // collapse, <main> auto-flows into column 1 (which is 0px
            // wide while collapsed) and the viewport goes blank.
            gridColumn: '2 / 3',
            display: 'flex',
            flexDirection: 'column',
            minWidth: 0,
            overflow: 'auto',
            position: 'relative',
          }}
        >
          {/* Floating "show menu" button when sidebar is collapsed.
              Without this, hiding the sidebar via Cmd+B left the user
              with no visible affordance to bring it back. */}
          {sidebarCollapsed && !isMobile && (
            <button
              type="button"
              onClick={() => setSidebarCollapsed(false)}
              aria-label="Show navigation menu"
              title="Show navigation (⌘B)"
              style={{
                position: 'fixed',
                top: 16,
                left: 16,
                width: 40,
                height: 40,
                borderRadius: 12,
                border: `1px solid var(--color-borderSubtle)`,
                backgroundColor: 'var(--color-surfaceRaised)',
                color: 'var(--color-textSecondary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 50,
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
              }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
          )}
          {user && <MfaRequiredBanner />}
      <OfflineBanner />
          <ChunkLoadErrorBoundary>
            {/* key={pathname} resets the boundary on navigation so a crash on one page
                doesn't lock the user out of every other page. */}
            <ErrorBoundary key={location.pathname}>
              {!projectId && !projectsLoading && !['portfolio', 'settings'].some(p => activeView.startsWith(p))
                ? <ProjectGate />
                : <AppRoutes />
              }
            </ErrorBoundary>
          </ChunkLoadErrorBoundary>
        </main>

        <CommandPalette open={commandPaletteOpen} onClose={() => setCommandPaletteOpen(false)} />
        {notificationsOpen && <NotificationCenter open={notificationsOpen} onClose={() => setNotificationsOpen(false)} />}
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

function SentryFallback() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', textAlign: 'center', padding: spacing['8'] }}>
      <h1 style={{ fontSize: typography.fontSize.large, fontWeight: typography.fontWeight.semibold, margin: 0, marginBottom: spacing['2'] }}>Something went wrong</h1>
      <p style={{ fontSize: typography.fontSize.body, color: colors.textTertiary, margin: 0, marginBottom: spacing['4'] }}>An unexpected error has been reported. Please reload to continue.</p>
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
          Go home
        </a>
      </div>
    </div>
  );
}

function App() {
  // Seed demo data into React Query cache when dev bypass is active

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
    <Sentry.ErrorBoundary fallback={<SentryFallback />}>
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
