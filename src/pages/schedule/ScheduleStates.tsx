import React, { useState, useCallback } from 'react';
import { AlertCircle, CalendarDays, Upload, Plus, ArrowRight, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { PageContainer } from '../../components/Primitives';
import { colors, spacing, typography, borderRadius, transitions } from '../../styles/theme';
import { PermissionGate } from '../../components/auth/PermissionGate';
import { ScheduleImportWizard } from '../../components/schedule/ScheduleImportWizard';
import AddPhaseModal from '../../components/forms/AddPhaseModal';
import { supabase } from '../../lib/supabase';
import { useScheduleStore } from '../../stores/scheduleStore';

// ── Error State ─────────────────────────────────────────────

interface ErrorStateProps {
  error: string | null;
}

export const ScheduleErrorState: React.FC<ErrorStateProps> = ({ error }) => (
  <PageContainer title="Schedule" subtitle="">
    <div
      role="alert"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '50vh',
        textAlign: 'center',
        padding: spacing['8'],
      }}
    >
      {/* Error icon with subtle background circle */}
      <div style={{
        width: 72, height: 72, borderRadius: '50%',
        backgroundColor: '#FEF2F2',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: spacing['6'],
      }}>
        <AlertCircle size={32} color="#DC2626" strokeWidth={1.5} />
      </div>
      <h2 style={{
        margin: 0, marginBottom: spacing['2'],
        fontSize: typography.fontSize.subtitle ?? '1.125rem',
        fontWeight: typography.fontWeight.semibold,
        color: colors.textPrimary,
      }}>
        Unable to load schedule
      </h2>
      <p style={{
        margin: 0, marginBottom: spacing['6'],
        fontSize: typography.fontSize.body,
        color: colors.textSecondary,
        maxWidth: 400, lineHeight: typography.lineHeight.relaxed,
      }}>
        {error || 'Something went wrong. Check your connection and try again.'}
      </p>
      <button
        onClick={() => window.location.reload()}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: spacing['2'],
          padding: `${spacing['3']} ${spacing['6']}`,
          backgroundColor: colors.primaryOrange,
          color: colors.white,
          border: 'none',
          borderRadius: borderRadius.lg,
          fontSize: typography.fontSize.body,
          fontWeight: typography.fontWeight.semibold,
          fontFamily: typography.fontFamily,
          cursor: 'pointer',
          transition: `transform ${transitions.quick}, box-shadow ${transitions.quick}`,
          boxShadow: '0 1px 3px rgba(244,120,32,0.3)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-1px)';
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(244,120,32,0.3)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'none';
          e.currentTarget.style.boxShadow = '0 1px 3px rgba(244,120,32,0.3)';
        }}
      >
        <RefreshCw size={16} />
        Retry
      </button>
    </div>
  </PageContainer>
);

// ── Loading State ───────────────────────────────────────────

export const ScheduleLoadingState: React.FC = () => {
  return (
    <PageContainer title="Schedule" subtitle="Loading...">
      <style>{`
        @keyframes schedShimmer {
          0% { background-position: -600px 0; }
          100% { background-position: 600px 0; }
        }
        @keyframes schedFadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <div role="status" aria-label="Loading schedule data">
        {/* KPI metric card skeletons — match the compact strip layout */}
        <div style={{
          display: 'flex', gap: spacing['3'], marginBottom: spacing['5'],
          animation: 'schedFadeIn 0.3s ease-out',
        }}>
          {[0, 1, 2, 3].map(i => (
            <div
              key={i}
              style={{
                flex: '1 1 0',
                height: 64,
                borderRadius: borderRadius.lg,
                border: `1px solid ${colors.borderSubtle}`,
                background: 'linear-gradient(90deg, #F3F4F6 25%, #FAFAFA 50%, #F3F4F6 75%)',
                backgroundSize: '600px 100%',
                animation: `schedShimmer 1.8s infinite linear`,
                animationDelay: `${i * 0.08}s`,
              }}
            />
          ))}
        </div>

        {/* Toolbar skeleton */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: spacing['4'],
          animation: 'schedFadeIn 0.3s ease-out 0.1s both',
        }}>
          <div style={{
            width: 200, height: 36, borderRadius: borderRadius.full,
            background: 'linear-gradient(90deg, #F3F4F6 25%, #FAFAFA 50%, #F3F4F6 75%)',
            backgroundSize: '600px 100%',
            animation: 'schedShimmer 1.8s infinite linear',
          }} />
          <div style={{ display: 'flex', gap: spacing['2'] }}>
            {[0, 1].map(i => (
              <div key={i} style={{
                width: 80, height: 32, borderRadius: borderRadius.full,
                background: 'linear-gradient(90deg, #F3F4F6 25%, #FAFAFA 50%, #F3F4F6 75%)',
                backgroundSize: '600px 100%',
                animation: 'schedShimmer 1.8s infinite linear',
                animationDelay: `${i * 0.1}s`,
              }} />
            ))}
          </div>
        </div>

        {/* Gantt skeleton — grid layout matching actual component */}
        <div style={{
          display: 'grid', gridTemplateColumns: '320px 1fr',
          border: `1px solid ${colors.borderSubtle}`, borderRadius: borderRadius.xl,
          overflow: 'hidden', height: 'calc(100vh - 320px)', minHeight: 400,
          animation: 'schedFadeIn 0.3s ease-out 0.2s both',
        }}>
          {/* Left rail skeleton */}
          <div style={{ borderRight: `1px solid ${colors.borderSubtle}` }}>
            {/* Header */}
            <div style={{
              height: 52, borderBottom: `1px solid ${colors.borderSubtle}`,
              backgroundColor: colors.surfaceRaised,
              display: 'flex', alignItems: 'center', padding: `0 ${spacing['5']}`,
            }}>
              <div style={{
                width: 60, height: 12, borderRadius: 4,
                background: 'linear-gradient(90deg, #E5E7EB 25%, #F0F0F0 50%, #E5E7EB 75%)',
                backgroundSize: '600px 100%',
                animation: 'schedShimmer 1.8s infinite linear',
              }} />
            </div>
            {/* Row skeletons */}
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(i => (
              <div key={i} style={{
                height: i % 4 === 0 ? 44 : 32,
                display: 'flex', alignItems: 'center', gap: spacing['3'],
                padding: `0 ${spacing['4']}`,
                borderBottom: `1px solid ${colors.borderSubtle}30`,
                backgroundColor: i % 4 === 0 ? colors.surfaceInset : 'transparent',
              }}>
                {i % 4 === 0 ? (
                  <div style={{
                    width: '70%', height: 14, borderRadius: 4,
                    background: 'linear-gradient(90deg, #E5E7EB 25%, #F0F0F0 50%, #E5E7EB 75%)',
                    backgroundSize: '600px 100%',
                    animation: 'schedShimmer 1.8s infinite linear',
                    animationDelay: `${i * 0.06}s`,
                  }} />
                ) : (
                  <>
                    <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#E5E7EB' }} />
                    <div style={{
                      width: `${50 + (i * 7) % 40}%`, height: 12, borderRadius: 4,
                      background: 'linear-gradient(90deg, #E5E7EB 25%, #F0F0F0 50%, #E5E7EB 75%)',
                      backgroundSize: '600px 100%',
                      animation: 'schedShimmer 1.8s infinite linear',
                      animationDelay: `${i * 0.06}s`,
                    }} />
                  </>
                )}
              </div>
            ))}
          </div>

          {/* Timeline skeleton */}
          <div style={{ position: 'relative', overflow: 'hidden' }}>
            {/* Header */}
            <div style={{
              height: 52, borderBottom: `1px solid ${colors.borderSubtle}`,
              backgroundColor: colors.surfaceRaised,
            }} />
            {/* Bar skeletons */}
            {[
              { top: 60, left: '8%', width: '25%' },
              { top: 96, left: '5%', width: '40%' },
              { top: 128, left: '15%', width: '20%' },
              { top: 160, left: '30%', width: '35%' },
              { top: 208, left: '12%', width: '50%' },
              { top: 240, left: '20%', width: '30%' },
              { top: 272, left: '45%', width: '25%' },
              { top: 304, left: '10%', width: '55%' },
              { top: 352, left: '35%', width: '20%' },
              { top: 384, left: '25%', width: '40%' },
            ].map((bar, i) => (
              <div key={i} style={{
                position: 'absolute', top: bar.top, left: bar.left,
                width: bar.width, height: 18, borderRadius: 5,
                background: 'linear-gradient(90deg, #E9E6E1 25%, #F3F1EE 50%, #E9E6E1 75%)',
                backgroundSize: '600px 100%',
                animation: 'schedShimmer 1.8s infinite linear',
                animationDelay: `${i * 0.08}s`,
              }} />
            ))}
          </div>
        </div>
      </div>
    </PageContainer>
  );
};

// ── Empty State ─────────────────────────────────────────────

interface EmptyStateProps {
  showImportModal: boolean;
  setShowImportModal: (v: boolean) => void;
  projectId?: string;
}

export const ScheduleEmptyState: React.FC<EmptyStateProps> = ({ showImportModal, setShowImportModal, projectId }) => {
  const [showAddPhase, setShowAddPhase] = useState(false);
  const queryClient = useQueryClient();
  const { loadSchedule } = useScheduleStore();

  const handleAddPhase = useCallback(async (data: Record<string, unknown>) => {
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
    if (Array.isArray(data.predecessor_ids) && data.predecessor_ids.length > 0) {
      insert.depends_on = data.predecessor_ids[0];
      insert.predecessor_ids = data.predecessor_ids;
    }

    const { error } = await supabase.from('schedule_phases').insert(insert);
    if (error) {
      toast.error(error.message || 'Failed to create phase');
      throw error;
    }
    toast.success('Phase created');
    queryClient.invalidateQueries({ queryKey: ['schedule', projectId] });
    queryClient.invalidateQueries({ queryKey: ['schedule_phases', projectId] });
    loadSchedule(projectId);
  }, [projectId, queryClient, loadSchedule]);

  return (
    <PageContainer title="Schedule" subtitle="">
      <ScheduleImportWizard
        isModal
        open={showImportModal}
        onClose={() => setShowImportModal(false)}
        projectId={projectId}
        onImportComplete={() => {
          setShowImportModal(false);
          if (projectId) {
            queryClient.invalidateQueries({ queryKey: ['schedule', projectId] });
            queryClient.invalidateQueries({ queryKey: ['schedule_phases', projectId] });
            loadSchedule(projectId);
          }
        }}
      />
      <AddPhaseModal
        open={showAddPhase}
        onClose={() => setShowAddPhase(false)}
        onSubmit={handleAddPhase}
      />

      <div
        role="status"
        aria-label="Build Your Project Schedule"
        style={{
          maxWidth: 560, margin: '60px auto', textAlign: 'center',
          padding: spacing['8'],
        }}
      >
        {/* Illustration — abstract Gantt bars */}
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          gap: 6, marginBottom: spacing['8'], opacity: 0.6,
        }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <div style={{ width: 80, height: 8, borderRadius: 4, backgroundColor: colors.brand200 }} />
            <div style={{ width: 120, height: 8, borderRadius: 4, backgroundColor: colors.brand300 }} />
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <div style={{ width: 40, height: 8, borderRadius: 4, backgroundColor: '#C9DBF4' }} />
            <div style={{ width: 160, height: 8, borderRadius: 4, backgroundColor: '#94B8D6' }} />
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <div style={{ width: 100, height: 8, borderRadius: 4, backgroundColor: '#D1EBE3' }} />
            <div style={{ width: 60, height: 8, borderRadius: 4, backgroundColor: '#80C2B1' }} />
            <div style={{ width: 90, height: 8, borderRadius: 4, backgroundColor: '#5BA894' }} />
          </div>
        </div>

        <CalendarDays size={40} color={colors.textTertiary} style={{ marginBottom: spacing['4'] }} />

        <h2 style={{
          fontSize: typography.fontSize.subtitle ?? '1.125rem',
          fontWeight: typography.fontWeight.semibold,
          color: colors.textPrimary,
          margin: 0, marginBottom: spacing['2'],
        }}>
          Build your project schedule
        </h2>
        <p style={{
          fontSize: typography.fontSize.body,
          color: colors.textSecondary,
          margin: 0, marginBottom: spacing['8'],
          lineHeight: typography.lineHeight.relaxed,
          maxWidth: 400, marginLeft: 'auto', marginRight: 'auto',
        }}>
          Track every phase from mobilization to closeout. Import from P6 or MS Project, or create phases manually.
        </p>

        <PermissionGate
          permission="schedule.edit"
          fallback={
            <div role="note" style={{
              fontSize: typography.fontSize.sm, color: colors.textTertiary,
              fontStyle: 'italic', padding: spacing['4'],
              backgroundColor: colors.surfaceInset, borderRadius: borderRadius.lg,
            }}>
              Contact your project admin to add phases or import a schedule.
            </div>
          }
        >
          <div style={{
            display: 'flex', flexDirection: 'column', gap: spacing['3'],
            maxWidth: 360, margin: '0 auto',
          }}>
            {/* Primary CTA — Import */}
            <button
              onClick={() => setShowImportModal(true)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: spacing['2'], width: '100%',
                padding: `${spacing['3']} ${spacing['6']}`,
                backgroundColor: colors.primaryOrange,
                color: colors.white,
                border: 'none',
                borderRadius: borderRadius.lg,
                fontSize: typography.fontSize.body,
                fontWeight: typography.fontWeight.semibold,
                fontFamily: typography.fontFamily,
                cursor: 'pointer',
                transition: `transform ${transitions.quick}, box-shadow ${transitions.quick}`,
                boxShadow: '0 1px 3px rgba(244,120,32,0.3)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(244,120,32,0.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'none';
                e.currentTarget.style.boxShadow = '0 1px 3px rgba(244,120,32,0.3)';
              }}
            >
              <Upload size={16} />
              Import from P6 / MS Project
              <ArrowRight size={14} style={{ marginLeft: spacing['1'], opacity: 0.7 }} />
            </button>

            {/* Secondary CTA — Manual */}
            <button
              onClick={() => setShowAddPhase(true)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: spacing['2'], width: '100%',
                padding: `${spacing['3']} ${spacing['6']}`,
                backgroundColor: 'transparent',
                color: colors.textPrimary,
                border: `1px solid ${colors.borderDefault}`,
                borderRadius: borderRadius.lg,
                fontSize: typography.fontSize.body,
                fontWeight: typography.fontWeight.medium,
                fontFamily: typography.fontFamily,
                cursor: 'pointer',
                transition: `background-color ${transitions.quick}, border-color ${transitions.quick}`,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = colors.surfaceHover;
                e.currentTarget.style.borderColor = colors.borderHover;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.borderColor = colors.borderDefault;
              }}
            >
              <Plus size={16} />
              Create first phase manually
            </button>
          </div>
        </PermissionGate>
      </div>
    </PageContainer>
  );
};
