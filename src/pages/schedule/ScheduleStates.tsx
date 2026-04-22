import React, { useState, useCallback } from 'react';
import { AlertCircle, CalendarDays } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { PageContainer } from '../../components/Primitives';
import { colors, spacing, typography, borderRadius } from '../../styles/theme';
import { PermissionGate } from '../../components/auth/PermissionGate';
import { ScheduleImportWizard } from '../../components/schedule/ScheduleImportWizard';
import AddPhaseModal from '../../components/forms/AddPhaseModal';
import { supabase } from '../../lib/supabase';
import { useScheduleStore } from '../../stores/scheduleStore';

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
        minHeight: '40vh',
        textAlign: 'center',
        padding: spacing.xl,
      }}
    >
      <AlertCircle size={40} color={colors.statusCritical} style={{ marginBottom: spacing.lg }} />
      <h2 style={{ margin: 0, marginBottom: spacing.sm, fontSize: typography.fontSize.heading, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
        Unable to load schedule
      </h2>
      <p style={{ margin: 0, marginBottom: spacing.xl, fontSize: typography.fontSize.sm, color: colors.textSecondary, maxWidth: 400 }}>
        {error || 'Check your connection and try again.'}
      </p>
      <button
        onClick={() => window.location.reload()}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: spacing.sm,
          padding: `${spacing.md} ${spacing.xl}`,
          minHeight: 56,
          backgroundColor: colors.primaryOrange,
          color: colors.white,
          border: 'none',
          borderRadius: borderRadius.lg,
          fontSize: typography.fontSize.sm,
          fontWeight: typography.fontWeight.semibold,
          fontFamily: typography.fontFamily,
          cursor: 'pointer',
        }}
      >
        Retry
      </button>
    </div>
  </PageContainer>
);

export const ScheduleLoadingState: React.FC = () => {
  const SKEL_ROW_WIDTHS = ['70%', '55%', '85%', '40%', '90%', '60%', '75%', '45%'];
  return (
    <PageContainer title="Schedule" subtitle="Loading...">
      <style>{`
        @keyframes schedShimmer {
          0% { background-position: -600px 0; }
          100% { background-position: 600px 0; }
        }
      `}</style>
      {/* 4 skeleton metric cards */}
      <div role="status" aria-label="Loading schedule data" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: spacing.lg, marginBottom: spacing.xl }}>
        {[0, 1, 2, 3].map(i => (
          <div
            key={i}
            style={{
              height: '120px',
              borderRadius: '12px',
              background: 'linear-gradient(90deg, #E5E7EB 25%, #F3F4F6 50%, #E5E7EB 75%)',
              backgroundSize: '600px 100%',
              animation: 'schedShimmer 1.5s infinite linear',
              animationDelay: `${i * 0.1}s`,
            }}
          />
        ))}
      </div>
      {/* 8 skeleton Gantt activity rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {SKEL_ROW_WIDTHS.map((w, i) => (
          <div
            key={i}
            style={{
              height: '48px',
              width: w,
              borderRadius: '8px',
              background: 'linear-gradient(90deg, #E5E7EB 25%, #F3F4F6 50%, #E5E7EB 75%)',
              backgroundSize: '600px 100%',
              animation: 'schedShimmer 1.5s infinite linear',
              animationDelay: `${i * 0.1}s`,
            }}
          />
        ))}
      </div>
    </PageContainer>
  );
};

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
      <div role="status" aria-label="Build Your Project Schedule" style={{ maxWidth: '480px', margin: '80px auto', textAlign: 'center' }}>
        <CalendarDays size={48} color={colors.textTertiary} style={{ marginBottom: '24px' }} />
        <div style={{ fontSize: '18px', fontWeight: 600, color: colors.textPrimary, marginBottom: '12px' }}>
          Build your schedule to track every phase from mobilization to closeout
        </div>
        <div style={{ fontSize: '14px', color: colors.textSecondary, marginBottom: '32px', lineHeight: typography.lineHeight.normal }}>
          Import your P6 or MS Project schedule, or create phases manually
        </div>
        <PermissionGate
          permission="schedule.edit"
          fallback={
            <div role="note" title="Your role doesn't allow editing the schedule. Request access from your admin." style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, fontStyle: 'italic' }}>
              Contact your project admin to add phases or import a schedule.
            </div>
          }
        >
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <button
              onClick={() => setShowImportModal(true)}
              style={{
                background: colors.primaryOrange,
                color: colors.white,
                border: 'none',
                borderRadius: borderRadius.md,
                padding: `${spacing.sm} ${spacing.lg}`,
                fontSize: typography.fontSize.body,
                fontWeight: typography.fontWeight.medium,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Import from P6/MS Project
            </button>
            <button
              onClick={() => setShowAddPhase(true)}
              style={{
                background: colors.white,
                color: colors.textPrimary,
                border: `1px solid ${colors.borderDefault}`,
                borderRadius: borderRadius.md,
                padding: `${spacing.sm} ${spacing.lg}`,
                fontSize: typography.fontSize.body,
                fontWeight: typography.fontWeight.medium,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Create First Phase
            </button>
          </div>
        </PermissionGate>
      </div>
    </PageContainer>
  );
};
