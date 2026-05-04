/**
import { fromTable } from '../../lib/db/queries'

 * Schedule — the timeline of truth.
 *
 * Investor-readiness rewrite per `specs/homepage-redesign/DESIGN-RESET.md`:
 * full viewport, sticky page header, three lean views (Timeline, List,
 * Critical Path), dense P6/MS-Project credibility. No artistic surfaces.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, FileUp, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

import { ErrorBoundary } from '../../components/ErrorBoundary';
import { useScheduleStore } from '../../stores/scheduleStore';
import { useProjectStore } from '../../stores/projectStore';
import { useCopilotStore } from '../../stores/copilotStore';
import AddPhaseModal from '../../components/forms/AddPhaseModal';
import { ScheduleImportWizard } from '../../components/schedule/ScheduleImportWizard';
import { colors, typography, spacing } from '../../styles/theme';
import type { SchedulePhase } from '../../stores/scheduleStore';
import { ScheduleTimeline } from './ScheduleTimeline';
import { ScheduleList } from './ScheduleList';
import { ScheduleStatusChip } from './ScheduleStatusChip';
import { isBehind, daysBehind } from './ScheduleHelpers';
import { IrisScheduleRiskBanner } from '../../components/schedule/IrisScheduleRiskBanner';

type ViewKey = 'timeline' | 'list' | 'critical';

const VIEWS: Array<{ key: ViewKey; label: string }> = [
  { key: 'timeline', label: 'Timeline' },
  { key: 'list', label: 'List' },
  { key: 'critical', label: 'Critical Path' },
];

// ── Project status chip — derived from phase data ───────────────

interface ProjectStatus {
  state: 'on_track' | 'behind' | 'at_risk';
  label: string;
}

function projectStatusFor(phases: SchedulePhase[]): ProjectStatus {
  if (phases.length === 0) return { state: 'on_track', label: 'No activities' };
  const behindCount = phases.filter((p) => isBehind(p)).length;
  if (behindCount === 0) return { state: 'on_track', label: 'On track' };
  const noun = behindCount === 1 ? 'activity' : 'activities';
  if (behindCount / phases.length > 0.2)
    return { state: 'at_risk', label: `${behindCount} ${noun} behind` };
  return { state: 'behind', label: `${behindCount} ${noun} behind` };
}

// ── Iris-risk inline note popover ──────────────────────────────

interface IrisNoteProps {
  phase: SchedulePhase | null;
  onClose: () => void;
}

function IrisNote({ phase, onClose }: IrisNoteProps) {
  if (!phase) return null;
  const float = Number(phase.float_days ?? 0);
  const lag = daysBehind(phase);
  const reasons: string[] = [];
  if (phase.status === 'delayed') reasons.push('Activity is currently flagged as delayed.');
  if (float >= 0 && float < 3) reasons.push(`Only ${float} day${float === 1 ? '' : 's'} of float — small slip cascades.`);
  if (lag > 0) reasons.push(`Trending ${lag} day${lag === 1 ? '' : 's'} behind expected progress.`);
  if (reasons.length === 0) reasons.push('On the critical path; small disruptions push the project end date.');

  return (
    <div
      role="dialog"
      aria-label="Iris risk note"
      style={{
        position: 'fixed',
        top: 80,
        right: 24,
        width: 360,
        background: colors.surfaceRaised,
        border: `1px solid ${colors.borderSubtle}`,
        borderRadius: 8,
        boxShadow: '0 8px 32px rgba(26, 22, 19, 0.10)',
        zIndex: 1050,
        padding: spacing[4],
        fontFamily: typography.fontFamily,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          color: colors.indigo,
          marginBottom: spacing[2],
        }}
      >
        <AlertTriangle size={12} aria-hidden="true" />
        Iris detected risk
      </div>
      <div
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: colors.textPrimary,
          marginBottom: spacing[2],
        }}
      >
        {phase.name}
      </div>
      <ul
        style={{
          margin: 0,
          paddingLeft: 18,
          color: colors.textSecondary,
          fontSize: 13,
          lineHeight: 1.55,
        }}
      >
        {reasons.map((r, i) => (
          <li key={i}>{r}</li>
        ))}
      </ul>
      <button
        type="button"
        onClick={onClose}
        style={{
          marginTop: spacing[3],
          padding: `${spacing[1]} ${spacing[3]}`,
          background: 'transparent',
          border: `1px solid ${colors.borderSubtle}`,
          borderRadius: 4,
          color: colors.textSecondary,
          fontSize: 12,
          fontWeight: 500,
          cursor: 'pointer',
        }}
      >
        Dismiss
      </button>
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────

const SchedulePage: React.FC = () => {
  const { activeProject } = useProjectStore();
  const projectId = activeProject?.id;
  const queryClient = useQueryClient();
  const { setPageContext } = useCopilotStore();
  const { phases, loading, error, loadSchedule, updatePhase } = useScheduleStore();

  const [view, setView] = useState<ViewKey>('timeline');
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [irisNotePhase, setIrisNotePhase] = useState<SchedulePhase | null>(null);
  // Hide completed activities by default — large imported P6 schedules
  // (e.g. Merritt Crossing has 219/247 complete) overwhelm the timeline
  // and bury the active/upcoming work the PM cares about.
  const [showCompleted, setShowCompleted] = useState(false);

  useEffect(() => {
    setPageContext('schedule');
  }, [setPageContext]);

  useEffect(() => {
    if (activeProject?.id) loadSchedule(activeProject.id);
  }, [activeProject?.id, loadSchedule]);

  const completedCount = useMemo(
    () => phases.filter((p) => p.status === 'completed').length,
    [phases],
  );

  const visiblePhases = useMemo(() => {
    const sorted = [...phases].sort((a, b) => {
      const sa = a.start_date ?? '9999-12-31';
      const sb = b.start_date ?? '9999-12-31';
      return sa.localeCompare(sb);
    });
    let filtered = showCompleted ? sorted : sorted.filter((p) => p.status !== 'completed');
    if (view === 'critical') filtered = filtered.filter((p) => p.is_critical_path === true);
    return filtered;
  }, [phases, view, showCompleted]);

  const status = useMemo(() => projectStatusFor(phases), [phases]);

  // ── Keyboard nav: j/k/Enter/e ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
      if (visiblePhases.length === 0) return;

      if (e.key === 'j' || e.key === 'k') {
        e.preventDefault();
        const idx = focusedId ? visiblePhases.findIndex((p) => p.id === focusedId) : -1;
        const nextIdx =
          e.key === 'j'
            ? Math.min(visiblePhases.length - 1, idx < 0 ? 0 : idx + 1)
            : Math.max(0, idx < 0 ? 0 : idx - 1);
        setFocusedId(visiblePhases[nextIdx].id);
      } else if (e.key === 'Enter') {
        if (!focusedId) return;
        e.preventDefault();
        const el = document.querySelector<HTMLElement>(`[data-phase-id="${focusedId}"]`);
        el?.focus();
      } else if (e.key === 'e') {
        if (!focusedId) return;
        const phase = visiblePhases.find((p) => p.id === focusedId);
        if (phase) handleEditPhase(phase);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [focusedId, visiblePhases]);

  const handleEditPhase = useCallback(
    (phase: SchedulePhase) => {
      // Wave 1 inline edit: bump %-complete to next 25%-step. Full edit modal
      // lands when the schedule mutation surface is unified (out of scope here).
      const current = Number(phase.percent_complete ?? 0);
      const next = current >= 100 ? 100 : Math.min(100, Math.floor(current / 25) * 25 + 25);
      updatePhase(phase.id, { percent_complete: next }).then((r) => {
        if (r.error) toast.error(`Couldn't update progress: ${r.error}`);
        else toast.success(`${phase.name} → ${next}% complete`);
      });
    },
    [updatePhase],
  );

  const handleAddPhase = useCallback(
    async (data: Record<string, unknown>) => {
      const projectId = activeProject?.id;
      if (!projectId) {
        toast.error('No project selected');
        throw new Error('No project selected');
      }
      const insert: Record<string, unknown> = {
        project_id: projectId,
        name: data.name,
        start_date: data.start_date,
        end_date: data.end_date,
        status: data.status ?? 'upcoming',
        percent_complete: data.percent_complete ?? 0,
      };
      if (data.is_critical_path != null) insert.is_critical_path = data.is_critical_path;
      if (data.assigned_crew_id) insert.assigned_crew_id = data.assigned_crew_id;
      if (data.float_days != null) insert.float_days = data.float_days;
      if (Array.isArray(data.predecessor_ids) && data.predecessor_ids.length > 0) {
        insert.depends_on = data.predecessor_ids[0];
        insert.predecessor_ids = data.predecessor_ids;
      }
      const { error: insertError } = await fromTable('schedule_phases').insert(insert as never);
      if (insertError) {
        toast.error(insertError.message || 'Failed to create activity');
        throw insertError;
      }
      toast.success('Activity created');
      queryClient.invalidateQueries({ queryKey: ['schedule', projectId] });
      queryClient.invalidateQueries({ queryKey: ['schedule_phases', projectId] });
      loadSchedule(projectId);
    },
    [activeProject?.id, queryClient, loadSchedule],
  );

  const handleIrisClick = useCallback((phase: SchedulePhase) => {
    setIrisNotePhase(phase);
  }, []);

  const handlePhaseClick = useCallback(
    (phase: SchedulePhase) => {
      setFocusedId(phase.id);
    },
    [],
  );

  return (
    <div
      style={{
        width: '100%',
        minHeight: '100vh',
        background: '#FCFCFA',
        fontFamily: typography.fontFamily,
      }}
    >
      {/* ── Sticky page header ── */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          background: '#FCFCFA',
          borderBottom: `1px solid ${colors.borderSubtle}`,
          paddingLeft: spacing[6],
          paddingRight: spacing[6],
          paddingTop: spacing[4],
          paddingBottom: spacing[4],
          display: 'flex',
          alignItems: 'center',
          gap: spacing[4],
          flexWrap: 'wrap',
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: 18,
            fontWeight: 600,
            color: colors.textPrimary,
            letterSpacing: '-0.01em',
          }}
        >
          Schedule
        </h1>
        <ScheduleStatusChip
          status={
            status.state === 'on_track'
              ? 'on_track'
              : status.state === 'at_risk'
                ? 'delayed'
                : 'behind'
          }
          label={status.label}
          size="md"
        />

        {/* View toggle */}
        <div
          role="tablist"
          aria-label="Schedule views"
          style={{
            display: 'inline-flex',
            background: '#F1ECE2',
            borderRadius: 6,
            padding: 2,
          }}
        >
          {VIEWS.map((v) => {
            const active = view === v.key;
            return (
              <button
                key={v.key}
                role="tab"
                type="button"
                aria-selected={active}
                onClick={() => setView(v.key)}
                style={{
                  padding: '6px 14px',
                  border: 'none',
                  borderRadius: 4,
                  background: active ? colors.surfaceRaised : 'transparent',
                  color: active ? colors.textPrimary : colors.textSecondary,
                  fontSize: 13,
                  fontWeight: active ? 600 : 500,
                  fontFamily: typography.fontFamily,
                  cursor: 'pointer',
                  boxShadow: active ? '0 1px 2px rgba(26, 22, 19, 0.04)' : 'none',
                }}
              >
                {v.label}
              </button>
            );
          })}
        </div>

        <div style={{ flex: 1 }} />

        {completedCount > 0 && (
          <label
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 10px',
              border: `1px solid ${colors.borderSubtle}`,
              borderRadius: 6,
              background: showCompleted ? '#F4F2EF' : 'transparent',
              color: colors.textSecondary,
              fontFamily: typography.fontFamily,
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
              userSelect: 'none',
            }}
          >
            <input
              type="checkbox"
              checked={showCompleted}
              onChange={(e) => setShowCompleted(e.target.checked)}
              style={{ accentColor: colors.primaryOrange, cursor: 'pointer' }}
              aria-label={`Show ${completedCount} completed activities`}
            />
            Show completed ({completedCount})
          </label>
        )}

        <button
          type="button"
          onClick={() => setShowImportModal(true)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 12px',
            background: 'transparent',
            border: `1px solid ${colors.borderSubtle}`,
            borderRadius: 6,
            color: colors.textSecondary,
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          <FileUp size={14} aria-hidden="true" />
          Import
        </button>
        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 14px',
            background: colors.primaryOrange,
            border: 'none',
            borderRadius: 6,
            color: '#FFFFFF',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <Plus size={14} aria-hidden="true" />
          New Activity
        </button>
      </header>

      <main
        style={{
          paddingLeft: spacing[6],
          paddingRight: spacing[6],
          paddingTop: spacing[4],
          paddingBottom: spacing[8],
        }}
      >
        {error && !loading && (
          <div
            role="alert"
            style={{
              padding: spacing[3],
              marginBottom: spacing[4],
              background: '#FCE7E7',
              border: '1px solid rgba(201, 59, 59, 0.20)',
              borderRadius: 6,
              color: '#9A2929',
              fontSize: 13,
            }}
          >
            Failed to load schedule: {error}
          </div>
        )}

        {/* Iris AI schedule-risk banner — calls the ai-schedule-risk edge
            function (Anthropic Claude over schedule + weather + crew + RFIs).
            Manual trigger so the demo can run it on stage. */}
        <IrisScheduleRiskBanner projectId={projectId ?? undefined} />

        {loading && phases.length === 0 ? (
          <div
            role="status"
            style={{
              padding: spacing[8],
              textAlign: 'center',
              color: colors.textTertiary,
              fontSize: 13,
            }}
          >
            Loading schedule…
          </div>
        ) : phases.length === 0 ? (
          <div
            style={{
              padding: spacing[8],
              textAlign: 'center',
              color: colors.textSecondary,
              fontSize: 14,
            }}
          >
            No activities yet. Import a P6/MS Project file or add the first activity.
          </div>
        ) : view === 'list' ? (
          <ScheduleList
            phases={visiblePhases}
            focusedId={focusedId}
            onFocusChange={setFocusedId}
            onEditPhase={handleEditPhase}
            onIrisClick={handleIrisClick}
          />
        ) : (
          <ScheduleTimeline
            phases={visiblePhases}
            focusedId={focusedId}
            onFocusChange={setFocusedId}
            onPhaseClick={handlePhaseClick}
            onIrisClick={handleIrisClick}
          />
        )}

        {/* Keyboard hint */}
        {phases.length > 0 && (
          <div
            style={{
              marginTop: spacing[3],
              fontSize: 11,
              color: colors.textTertiary,
              fontFamily: typography.fontFamily,
            }}
          >
            <kbd style={kbd}>j</kbd>/<kbd style={kbd}>k</kbd> move ·{' '}
            <kbd style={kbd}>Enter</kbd> focus · <kbd style={kbd}>e</kbd> edit
          </div>
        )}
      </main>

      <IrisNote phase={irisNotePhase} onClose={() => setIrisNotePhase(null)} />

      <AddPhaseModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSubmit={handleAddPhase}
      />

      <ScheduleImportWizard
        isModal
        open={showImportModal}
        onClose={() => setShowImportModal(false)}
        projectId={activeProject?.id}
        projectName={activeProject?.name}
        onImportComplete={() => {
          setShowImportModal(false);
          if (activeProject?.id) {
            loadSchedule(activeProject.id);
            queryClient.invalidateQueries({ queryKey: ['schedule', activeProject.id] });
            queryClient.invalidateQueries({ queryKey: ['schedule_phases', activeProject.id] });
          }
        }}
      />
    </div>
  );
};

const kbd: React.CSSProperties = {
  display: 'inline-block',
  padding: '0 4px',
  margin: '0 2px',
  fontFamily: typography.fontFamilyMono,
  fontSize: 10,
  background: '#F1ECE2',
  border: `1px solid ${colors.borderSubtle}`,
  borderRadius: 3,
  color: colors.textSecondary,
};

export const Schedule: React.FC = () => (
  <ErrorBoundary message="Failed to load schedule. Retry">
    <SchedulePage />
  </ErrorBoundary>
);

export default Schedule;
