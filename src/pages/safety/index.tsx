import React, { useState, useEffect } from 'react';
import { AlertTriangle, ClipboardCheck, Award, Users, Plus, Wrench } from 'lucide-react';
import { PageContainer, Card, Btn } from '../../components/Primitives';
import { ExportButton } from '../../components/shared/ExportButton';
import { colors, spacing, typography, borderRadius, transitions } from '../../styles/theme';
import { useProjectId } from '../../hooks/useProjectId';
import { useSafetyInspections, useIncidents, useToolboxTalks, useSafetyCertifications, useCorrectiveActions, useDailyLogs } from '../../hooks/queries';
import { supabase } from '../../lib/supabase';
import type { TabKey } from './safetyTypes';
import { SafetyMetrics } from './SafetyMetrics';
import { IncidentList } from './IncidentList';
import { IncidentForm } from './IncidentForm';
import { ToolboxTalksList, ToolboxTalkForm } from './ToolboxTalks';
import { InspectionsTab, CertificationsTab, CorrectiveActionsTab } from './InspectionsAndCerts';

const tabs: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: 'incidents', label: 'Incidents', icon: AlertTriangle },
  { key: 'inspections', label: 'Inspections', icon: ClipboardCheck },
  { key: 'toolbox', label: 'Toolbox Talks', icon: Users },
  { key: 'certifications', label: 'Certifications', icon: Award },
  { key: 'corrective_actions', label: 'Corrective Actions', icon: Wrench },
];

const recordableSeverities = ['medical_treatment', 'lost_time', 'fatality'];

export const Safety: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabKey>('incidents');
  const [nowMs] = useState(() => Date.now());
  const [showIncidentModal, setShowIncidentModal] = useState(false);
  const [showTalkModal, setShowTalkModal] = useState(false);
  const [windowWidth, setWindowWidth] = useState(() => window.innerWidth);

  const projectId = useProjectId();

  const { data: inspections, isLoading: loadingInspections, isError: errorInspections } = useSafetyInspections(projectId);
  const { data: incidents, isLoading: loadingIncidents, isError: errorIncidents, refetch: refetchIncidents } = useIncidents(projectId);
  const { data: talks, isLoading: loadingTalks, isError: errorTalks, refetch: refetchTalks } = useToolboxTalks(projectId);
  const { data: certifications, isLoading: loadingCerts, isError: errorCerts, refetch: refetchCerts } = useSafetyCertifications(projectId);
  const { data: correctiveActions, isLoading: loadingCAs, isError: errorCAs, refetch: refetchCAs } = useCorrectiveActions(projectId);
  const { data: dailyLogsResult } = useDailyLogs(projectId);
  const dailyLogs = dailyLogsResult?.data;

  const displayIncidents: unknown[] = (incidents || []).length > 0 ? (incidents || []) : [];
  const displayCAs: unknown[] = (correctiveActions || []).length > 0 ? (correctiveActions || []) : [];

  // ── Real-time subscriptions ───────────────────────────────────
  useEffect(() => {
    if (!projectId) return;
    const ch1 = supabase
      .channel(`safety-incidents-rt-${projectId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'incidents', filter: `project_id=eq.${projectId}` }, () => { refetchIncidents(); })
      .subscribe();
    const ch2 = supabase
      .channel(`safety-corrective-rt-${projectId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'corrective_actions', filter: `project_id=eq.${projectId}` }, () => { refetchCAs(); })
      .subscribe();
    return () => { supabase.removeChannel(ch1); supabase.removeChannel(ch2); };
  }, [projectId, refetchIncidents, refetchCAs]);

  // ── Window width ──────────────────────────────────────────────
  useEffect(() => {
    const onResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  const isMobile = windowWidth < 768;

  // ── KPI calculations ──────────────────────────────────────────
  const lastRecordableIncident = displayIncidents
    .filter((i: unknown) => recordableSeverities.includes((i as Record<string, unknown>).severity as string))
    .sort((a: unknown, b: unknown) => new Date((b as Record<string, unknown>).date as string).getTime() - new Date((a as Record<string, unknown>).date as string).getTime())[0] ?? null;

  const daysSinceIncident = lastRecordableIncident
    ? Math.floor((nowMs - new Date((lastRecordableIncident as Record<string, unknown>).date as string).getTime()) / 86400000)
    : null;

  const computedHours = dailyLogs?.reduce((s: number, l: unknown) => s + ((l as Record<string, unknown>).total_hours as number || 0), 0) ?? 0;
  const totalHoursWorked = computedHours > 0 ? computedHours : null;
  const recordableCount = displayIncidents.filter((i: unknown) => recordableSeverities.includes((i as Record<string, unknown>).severity as string)).length;
  const trirRaw = totalHoursWorked !== null && totalHoursWorked > 0 ? (recordableCount * 200000) / totalHoursWorked : null;
  const trir = trirRaw !== null ? trirRaw.toFixed(2) : null;

  const openCorrectiveActions = correctiveActions?.filter((ca: unknown) => (ca as Record<string, unknown>).status !== 'closed' && (ca as Record<string, unknown>).status !== 'verified').length ?? 0;

  const now = new Date();
  const expiringCerts = certifications?.filter((c: unknown) => {
    const cert = c as Record<string, unknown>;
    if (!cert.expiration_date) return false;
    const daysUntil = (new Date(cert.expiration_date as string).getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return daysUntil > 0 && daysUntil <= 30;
  }).length ?? 0;

  const passCount = inspections?.filter((i: unknown) => (i as Record<string, unknown>).status === 'passed').length ?? 0;
  const failCount = inspections?.filter((i: unknown) => (i as Record<string, unknown>).status === 'failed').length ?? 0;

  const weekStart = new Date(now);
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);
  const inspectionsThisWeek = inspections?.filter((insp: unknown) => {
    const i = insp as Record<string, unknown>;
    if (!i.date) return false;
    const d = new Date(i.date as string);
    return d >= weekStart && d < weekEnd;
  }).length ?? 0;

  const daysColor: 'success' | 'warning' | 'danger' | undefined = daysSinceIncident === null ? 'success' : daysSinceIncident > 30 ? 'success' : daysSinceIncident >= 10 ? 'warning' : 'danger';
  const trirValue = trir !== null ? parseFloat(trir) : null;
  const trirColor: 'success' | 'warning' | 'danger' | undefined = trirValue === null ? undefined : trirValue <= 2.0 ? 'success' : trirValue <= 3.0 ? 'warning' : 'danger';
  const caColor: 'success' | 'warning' | 'danger' | undefined = openCorrectiveActions === 0 ? 'success' : openCorrectiveActions <= 5 ? 'warning' : 'danger';
  const certColor: 'success' | 'warning' | 'danger' | undefined = expiringCerts === 0 ? 'success' : 'warning';

  const isLoading = loadingInspections || loadingIncidents || loadingTalks || loadingCerts || loadingCAs;
  const hasError = errorInspections || errorIncidents || errorTalks || errorCerts || errorCAs;

  const handleRetry = () => { refetchIncidents(); refetchTalks(); refetchCerts(); refetchCAs(); };

  return (
    <PageContainer
      title="Safety"
      subtitle="Site safety management, inspections, incidents, and compliance tracking"
      actions={
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'] }}>
          <ExportButton pdfFilename="SiteSync_Safety_Report" />
          {activeTab === 'incidents' && <Btn variant="primary" icon={<Plus size={16} />} onClick={() => setShowIncidentModal(true)} style={{ minHeight: 56 }}>Report Incident</Btn>}
          {activeTab === 'toolbox' && <Btn variant="primary" icon={<Plus size={16} />} onClick={() => setShowTalkModal(true)} style={{ minHeight: 56 }}>New Talk</Btn>}
        </div>
      }
    >
      <style>{`@keyframes safety-pulse { 0% { opacity: 0.3; } 50% { opacity: 0.7; } 100% { opacity: 0.3; } }`}</style>

      <SafetyMetrics
        isLoading={isLoading}
        isMobile={isMobile}
        daysSinceIncident={daysSinceIncident}
        daysColor={daysColor}
        trir={trir}
        trirColor={trirColor}
        openCorrectiveActions={openCorrectiveActions}
        caColor={caColor}
        expiringCerts={expiringCerts}
        certColor={certColor}
        inspectionsThisWeek={inspectionsThisWeek}
      />

      {/* Tab Switcher */}
      <div style={{ display: 'flex', gap: spacing['1'], backgroundColor: colors.surfaceInset, borderRadius: borderRadius.lg, padding: spacing['1'], marginBottom: spacing['2xl'], overflowX: 'auto' }}>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              aria-pressed={isActive}
              onClick={() => setActiveTab(tab.key)}
              style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], padding: `${spacing['2']} ${spacing['4']}`, border: 'none', borderRadius: borderRadius.base, cursor: 'pointer', fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily, fontWeight: isActive ? typography.fontWeight.medium : typography.fontWeight.normal, color: isActive ? colors.orangeText : colors.textSecondary, backgroundColor: isActive ? colors.surfaceRaised : 'transparent', transition: `all ${transitions.instant}`, whiteSpace: 'nowrap', minHeight: '56px' }}
            >
              {React.createElement(Icon, { size: 14 })}
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Skeleton loaders */}
      {isLoading && (
        <Card>
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['3'] }}>
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} style={{ display: 'flex', gap: spacing['3'] }}>
                {[100, 140, 120, undefined, 90].map((w, j) => (
                  <div key={j} style={{ flex: w ? `0 0 ${w}px` : '1', height: 20, backgroundColor: '#E5E7EB', borderRadius: borderRadius.sm, animation: 'safety-pulse 1.5s ease-in-out infinite', animationDelay: `${i * 0.1 * (j + 1)}s` }} />
                ))}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Error state */}
      {!isLoading && hasError && (
        <div style={{ backgroundColor: colors.statusCriticalSubtle, border: `1px solid ${colors.statusCritical}40`, borderRadius: borderRadius.md, padding: `${spacing['4']} ${spacing['5']}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: spacing['4'], marginBottom: spacing['4'] }}>
          <div>
            <p style={{ margin: 0, fontWeight: typography.fontWeight.medium, color: '#991B1B', fontSize: typography.fontSize.sm }}>Unable to load safety data</p>
            <p style={{ margin: '2px 0 0', color: '#B91C1C', fontSize: typography.fontSize.caption }}>Check your connection and try again.</p>
          </div>
          <Btn variant="secondary" onClick={handleRetry} style={{ flexShrink: 0 }}>Retry</Btn>
        </div>
      )}

      {/* Tab content */}
      {!isLoading && !hasError && (
        <>
          {activeTab === 'incidents' && <IncidentList incidents={displayIncidents} onReportIncident={() => setShowIncidentModal(true)} />}
          {activeTab === 'inspections' && <InspectionsTab inspections={inspections || []} passCount={passCount} failCount={failCount} />}
          {activeTab === 'toolbox' && <ToolboxTalksList talks={talks || []} onNewTalk={() => setShowTalkModal(true)} />}
          {activeTab === 'certifications' && <CertificationsTab certifications={certifications || []} />}
          {activeTab === 'corrective_actions' && <CorrectiveActionsTab correctiveActions={displayCAs} />}
        </>
      )}

      {/* Modals */}
      {showIncidentModal && (
        <IncidentForm
          projectId={projectId}
          onClose={() => setShowIncidentModal(false)}
          onSubmitSuccess={() => { refetchIncidents(); }}
        />
      )}
      {showTalkModal && (
        <ToolboxTalkForm onClose={() => setShowTalkModal(false)} />
      )}
    </PageContainer>
  );
};

export default Safety;
