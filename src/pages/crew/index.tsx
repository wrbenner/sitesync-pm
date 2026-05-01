/**
 * The Crew — "Who is on site?"
 *
 * Shape: Place — a map you can explore.
 * Calm by default, urgent only when safety demands it.
 * The orange dot appears when safety incidents > 0.
 *
 * This is the view that answers "who showed up today?"
 * in under three seconds.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { ProjectGate } from '../../components/ProjectGate';
import { PageState } from '../../components/shared/PageState';
import { useCopilotStore } from '../../stores/copilotStore';
import { useIsOnline } from '../../hooks/useOfflineStatus';
import { useIsMobile } from '../../hooks/useWindowSize';
import { useProjectId } from '../../hooks/useProjectId';
import { useProject, useWorkforceMembers, useCrews, useIncidents } from '../../hooks/queries';
import { useProjectMetrics } from '../../hooks/useProjectMetrics';
import { colors, typography, transitions } from '../../styles/theme';
import {
  OrangeDot,
  Eyebrow,
} from '../../components/atoms';
import { WifiOff, ChevronRight, Users, Layers } from 'lucide-react';
import { QuickCreateFAB } from '../../components/QuickCreateFAB';
import CreateCrewModal from '../../components/forms/CreateCrewModal';
import { useCreateCrew } from '../../hooks/mutations/crews';

// ── Status badge helpers ──────────────────────────────────

const statusColor: Record<string, string> = {
  active: colors.statusActive,
  pending: colors.statusPending,
  inactive: colors.ink4,
  critical: colors.statusCritical,
};

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const color = statusColor[status] ?? colors.ink4;
  return (
    <span
      style={{
        fontFamily: typography.fontFamily,
        fontSize: '10px',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.12em',
        color,
        border: `1px solid ${color}`,
        borderRadius: '4px',
        padding: '2px 6px',
        whiteSpace: 'nowrap',
      }}
    >
      {status}
    </span>
  );
};

// ── Crew Card ────────────────────────────────────────────

interface CrewRecord {
  id: string | number;
  name?: string;
  trade?: string;
  foreman?: string;
  member_count?: number;
  status?: string;
}

const CrewCard: React.FC<{ crew: CrewRecord }> = ({ crew }) => (
  <a
    href="#/crews"
    style={{
      display: 'block',
      padding: '16px 18px',
      backgroundColor: '#FFFFFF',
      border: '1px solid var(--hairline)',
      borderRadius: '10px',
      textDecoration: 'none',
      color: 'inherit',
      transition: transitions.quick,
    }}
  >
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: typography.fontFamilySerif,
            fontSize: '18px',
            fontWeight: 400,
            color: colors.ink,
            lineHeight: 1.2,
            marginBottom: 4,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {crew.name ?? 'Unnamed Crew'}
        </div>
        {crew.trade && (
          <Eyebrow style={{ display: 'block', marginBottom: 8 }}>{crew.trade}</Eyebrow>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {crew.foreman && (
            <span style={{ fontFamily: typography.fontFamily, fontSize: '12px', color: colors.ink3 }}>
              Foreman: {crew.foreman}
            </span>
          )}
          {crew.member_count != null && (
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                fontFamily: typography.fontFamily,
                fontSize: '12px',
                color: colors.ink3,
              }}
            >
              <Users size={11} style={{ flexShrink: 0 }} />
              {crew.member_count} member{crew.member_count !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
        {crew.status && <StatusBadge status={crew.status} />}
        <ChevronRight size={14} style={{ color: colors.ink4 }} />
      </div>
    </div>
  </a>
);

// ── Headcount Strip ──────────────────────────────────────

const HeadcountStrip: React.FC<{
  workersOnsite: number | undefined;
  crewsActive: number | undefined;
  safetyIncidents: number | undefined;
  isMobile: boolean;
}> = ({ workersOnsite, crewsActive, safetyIncidents, isMobile }) => {
  const hasSafetyAlert = (safetyIncidents ?? 0) > 0;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? 'repeat(3, 1fr)' : 'repeat(3, minmax(0, 200px))',
        gap: 16,
        marginTop: 24,
        marginBottom: 8,
      }}
    >
      {/* Workers on site */}
      <div>
        <Eyebrow style={{ display: 'block', marginBottom: 4 }}>On Site</Eyebrow>
        <div
          style={{
            fontFamily: typography.fontFamilySerif,
            fontSize: isMobile ? '40px' : '52px',
            fontWeight: 400,
            color: colors.ink,
            lineHeight: 1,
          }}
        >
          {workersOnsite ?? 0}
        </div>
        <div style={{ fontFamily: typography.fontFamily, fontSize: '12px', color: colors.ink3, marginTop: 4 }}>
          workers
        </div>
      </div>

      {/* Active crews */}
      <div>
        <Eyebrow style={{ display: 'block', marginBottom: 4 }}>Crews Active</Eyebrow>
        <div
          style={{
            fontFamily: typography.fontFamilySerif,
            fontSize: isMobile ? '40px' : '52px',
            fontWeight: 400,
            color: colors.ink,
            lineHeight: 1,
          }}
        >
          {crewsActive ?? 0}
        </div>
        <div style={{ fontFamily: typography.fontFamily, fontSize: '12px', color: colors.ink3, marginTop: 4 }}>
          crews
        </div>
      </div>

      {/* Safety incidents */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <Eyebrow>Safety This Month</Eyebrow>
          {hasSafetyAlert && (
            <OrangeDot size={7} haloSpread={3} label="Safety incidents this month" />
          )}
        </div>
        <div
          style={{
            fontFamily: typography.fontFamilySerif,
            fontSize: isMobile ? '40px' : '52px',
            fontWeight: 400,
            color: hasSafetyAlert ? colors.statusCritical : colors.ink,
            lineHeight: 1,
          }}
        >
          {safetyIncidents ?? 0}
        </div>
        <div style={{ fontFamily: typography.fontFamily, fontSize: '12px', color: colors.ink3, marginTop: 4 }}>
          incident{(safetyIncidents ?? 0) !== 1 ? 's' : ''}
        </div>
      </div>
    </div>
  );
};

// ── Trade Row ────────────────────────────────────────────

const TradeRow: React.FC<{ trade: string; count: number }> = ({ trade, count }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '10px 0',
      borderBottom: '1px solid var(--hairline)',
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <Layers size={13} style={{ color: colors.ink4, flexShrink: 0 }} />
      <span style={{ fontFamily: typography.fontFamily, fontSize: '14px', color: colors.ink }}>
        {trade}
      </span>
    </div>
    <span
      style={{
        fontFamily: typography.fontFamilySerif,
        fontSize: '20px',
        fontWeight: 400,
        color: colors.ink2,
        lineHeight: 1,
      }}
    >
      {count}
    </span>
  </div>
);

// ── Quick Link ───────────────────────────────────────────

const QuickLink: React.FC<{ href: string; label: string; sub?: string }> = ({ href, label, sub }) => (
  <a
    href={href}
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '13px 16px',
      backgroundColor: '#FFFFFF',
      border: '1px solid var(--hairline)',
      borderRadius: '10px',
      textDecoration: 'none',
      color: 'inherit',
      transition: transitions.quick,
    }}
  >
    <div>
      <div style={{ fontFamily: typography.fontFamily, fontSize: '14px', fontWeight: 500, color: colors.ink }}>
        {label}
      </div>
      {sub && (
        <div style={{ fontFamily: typography.fontFamily, fontSize: '12px', color: colors.ink3, marginTop: 1 }}>
          {sub}
        </div>
      )}
    </div>
    <ChevronRight size={14} style={{ color: colors.ink4 }} />
  </a>
);

// ── The Crew Page ─────────────────────────────────────────

const CrewPage: React.FC = () => {
  const projectId = useProjectId();
  const { data: project } = useProject(projectId);
  const { setPageContext } = useCopilotStore();
  const isMobile = useIsMobile();
  const isOnline = useIsOnline();

  const [showCreateCrew, setShowCreateCrew] = useState(false);

  useEffect(() => { setPageContext('crew'); }, [setPageContext]);

  // ── Data ─────────────────────────────────────────────
  const { data: metrics } = useProjectMetrics(projectId);
  const { data: workforceData, isPending: workforceLoading } = useWorkforceMembers(projectId);
  const { data: crewData, isPending: crewsLoading } = useCrews(projectId);
  const { data: incidentData } = useIncidents(projectId);

  const workforceMembers = useMemo(
    () => (workforceData ?? []) as Array<Record<string, unknown>>,
    [workforceData],
  );
  const crews = useMemo(
    () => (crewData ?? []) as CrewRecord[],
    [crewData],
  );
  const incidents = useMemo(
    () => (incidentData ?? []) as Array<Record<string, unknown>>,
    [incidentData],
  );

  // ── Derived counts from actual data ─────────────────
  const activeCrews = useMemo(() => crews.filter((c) => (c.status ?? '').toLowerCase() === 'active'), [crews]);

  const thisMonthIncidents = useMemo(() => {
    const monthStr = new Date().toISOString().slice(0, 7);
    return incidents.filter((i) => {
      const d = (i.date as string) ?? (i.created_at as string) ?? '';
      return d.startsWith(monthStr);
    });
  }, [incidents]);

  // ── Trade summary ────────────────────────────────────
  const tradeCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const member of workforceMembers) {
      const trade = (member.trade as string) || 'Unknown';
      map[trade] = (map[trade] ?? 0) + 1;
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [workforceMembers]);

  const isLoading = workforceLoading || crewsLoading;

  // ── Guard ────────────────────────────────────────────
  if (!projectId) return <ProjectGate />;

  return (
    <ErrorBoundary>
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          minHeight: 0,
          backgroundColor: colors.parchment,
        }}
      >
        <div
          style={{
            maxWidth: 1080,
            margin: '0 auto',
            padding: isMobile ? '16px 16px 0' : '36px 36px 0',
          }}
        >
          {/* ── Compact Header ──────────────────────── */}
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontFamily: typography.fontFamilySerif, fontSize: isMobile ? '20px' : '24px', color: colors.ink, lineHeight: 1.2 }}>
                The Crew
              </span>
              <span style={{ fontFamily: typography.fontFamily, fontSize: '12px', color: colors.ink4 }}>
                {project?.name ?? 'Project'}
              </span>
            </div>
            <span style={{ fontFamily: typography.fontFamily, fontSize: '12px', color: colors.ink4 }}>
              {!isOnline ? 'Offline' : 'Today'}
            </span>
          </div>

          {/* ── Headcount Strip ───────────── */}
          {isLoading ? (
            <div style={{ marginTop: 24, marginBottom: 8 }}>
              <PageState status="loading" />
            </div>
          ) : (
            <HeadcountStrip
              workersOnsite={workforceMembers.length}
              crewsActive={activeCrews.length}
              safetyIncidents={thisMonthIncidents.length}
              isMobile={isMobile}
            />
          )}

          {/* ── Crew Cards ───────────────── */}
          <Eyebrow style={{ marginBottom: 12, marginTop: 16 }}>Crews on Site</Eyebrow>

          {isLoading ? (
            <PageState status="loading" />
          ) : crews.length === 0 ? (
            <div style={{ marginBottom: 32 }}>
              <span
                style={{
                  fontFamily: typography.fontFamilySerif,
                  fontStyle: 'italic',
                  fontSize: '16px',
                  color: colors.ink3,
                }}
              >
                No crews assigned yet.
              </span>
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
                gap: 12,
                marginBottom: 36,
              }}
            >
              {crews.map((crew) => (
                <CrewCard key={crew.id} crew={crew} />
              ))}
            </div>
          )}

          {/* ── Workforce by Trade ─────── */}
          <Eyebrow style={{ marginBottom: 12, marginTop: 16 }}>Workforce by Trade</Eyebrow>

          {isLoading ? (
            <PageState status="loading" />
          ) : tradeCounts.length === 0 ? (
            <div style={{ marginBottom: 32 }}>
              <span
                style={{
                  fontFamily: typography.fontFamilySerif,
                  fontStyle: 'italic',
                  fontSize: '16px',
                  color: colors.ink3,
                }}
              >
                No workforce data available.
              </span>
            </div>
          ) : (
            <div style={{ marginBottom: 36 }}>
              {tradeCounts.map(([trade, count]) => (
                <TradeRow key={trade} trade={trade} count={count} />
              ))}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 0 0',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Users size={13} style={{ color: colors.ink3 }} />
                  <Eyebrow>Total</Eyebrow>
                </div>
                <span
                  style={{
                    fontFamily: typography.fontFamilySerif,
                    fontSize: '22px',
                    fontWeight: 400,
                    color: colors.ink,
                    lineHeight: 1,
                  }}
                >
                  {workforceMembers.length}
                </span>
              </div>
            </div>
          )}

          {/* ── Quick Links ──────────────── */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 8,
              marginTop: 20,
              marginBottom: 56,
            }}
          >
            {[
              { href: '#/workforce', label: 'Workforce' },
              { href: '#/crews', label: 'Crews' },
              { href: '#/directory', label: 'Directory' },
              { href: '#/time-tracking', label: 'Time Tracking' },
            ].map(({ href, label }) => (
              <a key={href} href={href} style={{
                fontFamily: typography.fontFamily, fontSize: '12px', fontWeight: 500,
                color: colors.ink3, textDecoration: 'none', padding: '6px 14px',
                borderRadius: 100, border: '1px solid var(--hairline)',
                transition: transitions.quick,
              }}>{label}</a>
            ))}
          </div>
        </div>
      </div>

      {/* ── Quick-Create FAB ─────────────────────── */}
      <QuickCreateFAB
        onPrimaryAction={() => setShowCreateCrew(true)}
      />

      {/* ── Create Crew Modal ────────────────────── */}
      <CreateCrewModalWrapper
        open={showCreateCrew}
        onClose={() => setShowCreateCrew(false)}
        projectId={projectId}
      />
    </ErrorBoundary>
  );
};

// ── Create Crew Modal Wrapper ──────────────────────────────

const CreateCrewModalWrapper: React.FC<{ open: boolean; onClose: () => void; projectId: string }> = ({ open, onClose, projectId }) => {
  const createCrew = useCreateCrew();
  const handleSubmit = (data: Record<string, unknown>) => {
    createCrew.mutate({ data: { ...data, project_id: projectId }, projectId });
    onClose();
  };
  return <CreateCrewModal open={open} onClose={onClose} onSubmit={handleSubmit as any} />;
};

// ── Export ────────────────────────────────────────────────

export default CrewPage;
