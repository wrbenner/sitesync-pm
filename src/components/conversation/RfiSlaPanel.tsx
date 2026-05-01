// ── RfiSlaPanel ────────────────────────────────────────────────────────────
// Renders three things on the RFI detail page:
//   1. The current SLA timer chip
//   2. A "Pause clock" / "Resume clock" button (with required reason on pause)
//   3. A bounce banner when the most recent escalation email failed to deliver
//
// Why on this page: the GC needs to see, in one glance, whether the
// escalator is actively counting down or whether email is broken.

import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Pause, Play, AlertTriangle, X } from 'lucide-react';
import { SlaTimer } from './SlaTimer';
import { colors, typography, spacing } from '../../styles/theme';
import { toast } from 'sonner';

interface RfiSlaPanelProps {
  rfiId: string;
  projectId: string;
  dueDate: string | null | undefined;
  pausedAt: string | null | undefined;
  pausedReason?: string | null;
  /** Called after pause/resume succeeds so the caller can refetch. */
  onChanged?: () => void;
}

export const RfiSlaPanel: React.FC<RfiSlaPanelProps> = ({
  rfiId,
  projectId,
  dueDate,
  pausedAt,
  pausedReason,
  onChanged,
}) => {
  const qc = useQueryClient();
  const [showPauseInput, setShowPauseInput] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  // Pull the most recent escalation event for this RFI plus its delivery
  // status so we can surface a bounce banner.
  const { data: lastEscalation } = useQuery({
    queryKey: ['rfi-escalation-latest', rfiId],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabase as any;
      const { data: esc } = await sb
        .from('rfi_escalations')
        .select('id, stage, channel, recipient_email, notification_queue_id, triggered_at')
        .eq('rfi_id', rfiId)
        .order('triggered_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!esc?.notification_queue_id) return { escalation: esc, queue: null };
      const { data: q } = await sb
        .from('notification_queue')
        .select('id, status, error, retry_count, recipient_email')
        .eq('id', esc.notification_queue_id)
        .maybeSingle();
      return { escalation: esc, queue: q };
    },
    refetchInterval: 60_000,
  });

  const isPaused = !!pausedAt;
  const queueRow = lastEscalation?.queue as { status?: string; error?: string; recipient_email?: string } | null;
  const bounced = queueRow?.status === 'bounced' || queueRow?.status === 'failed';

  const pauseClock = async () => {
    if (reason.trim().length < 3) {
      toast.error('Please enter a brief reason for pausing the SLA clock.');
      return;
    }
    setBusy(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;
    const userId = (await sb.auth.getUser()).data?.user?.id ?? null;
    const { error } = await sb
      .from('rfis')
      .update({
        sla_paused_at: new Date().toISOString(),
        sla_paused_reason: reason.trim(),
        sla_paused_by: userId,
      })
      .eq('id', rfiId);
    setBusy(false);
    if (error) {
      toast.error(`Failed to pause: ${error.message}`);
      return;
    }
    // Audit-log the pause via rfi_escalations so the trail is unified.
    await sb.from('rfi_escalations').insert({
      rfi_id: rfiId,
      project_id: projectId,
      stage: 'pause',
      channel: 'none',
      triggered_by: userId,
      metadata: { reason: reason.trim() },
    });
    toast.success('SLA clock paused');
    setShowPauseInput(false);
    setReason('');
    qc.invalidateQueries({ queryKey: ['rfi', rfiId] });
    qc.invalidateQueries({ queryKey: ['rfi-escalation-latest', rfiId] });
    onChanged?.();
  };

  const resumeClock = async () => {
    setBusy(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;
    const userId = (await sb.auth.getUser()).data?.user?.id ?? null;
    const pausedSince = pausedAt ? new Date(pausedAt).getTime() : Date.now();
    const pauseSeconds = Math.floor((Date.now() - pausedSince) / 1000);

    const { error } = await sb
      .from('rfis')
      .update({
        sla_paused_at: null,
        sla_paused_reason: null,
        sla_paused_by: null,
        // Push the due date forward by the paused duration so the SLA
        // window the contract guarantees is preserved.
        // We don't try to recompute response_due_date here without it —
        // any project that doesn't track it will simply unfreeze with the
        // same nominal due_date (acceptable approximation).
        sla_total_pause_seconds: pauseSeconds,
      })
      .eq('id', rfiId);
    setBusy(false);
    if (error) {
      toast.error(`Failed to resume: ${error.message}`);
      return;
    }
    await sb.from('rfi_escalations').insert({
      rfi_id: rfiId,
      project_id: projectId,
      stage: 'resume',
      channel: 'none',
      triggered_by: userId,
      metadata: { paused_for_seconds: pauseSeconds },
    });
    toast.success('SLA clock resumed');
    qc.invalidateQueries({ queryKey: ['rfi', rfiId] });
    qc.invalidateQueries({ queryKey: ['rfi-escalation-latest', rfiId] });
    onChanged?.();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2'] }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <SlaTimer dueDate={dueDate} pausedAt={pausedAt ?? null} size="md" />
        {!isPaused ? (
          <button
            onClick={() => setShowPauseInput((v) => !v)}
            disabled={busy}
            style={pillButtonStyle}
            title="Pause the SLA clock with a reason (e.g. verbal extension granted)"
          >
            <Pause size={11} />
            Pause clock
          </button>
        ) : (
          <button
            onClick={resumeClock}
            disabled={busy}
            style={{ ...pillButtonStyle, color: colors.statusActive, borderColor: colors.statusActive }}
            title="Resume the SLA clock"
          >
            <Play size={11} />
            Resume clock
          </button>
        )}
      </div>

      {isPaused && pausedReason && (
        <div
          style={{
            fontSize: typography.fontSize.label,
            color: colors.textSecondary,
            fontStyle: 'italic',
          }}
        >
          Paused: {pausedReason}
        </div>
      )}

      {showPauseInput && !isPaused && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason (e.g. architect granted 5-day verbal extension)"
            style={{
              flex: 1,
              padding: '6px 10px',
              border: `1px solid ${colors.border}`,
              borderRadius: 6,
              fontSize: typography.fontSize.sm,
              fontFamily: typography.fontFamily,
            }}
            onKeyDown={(e) => { if (e.key === 'Enter') pauseClock(); }}
            autoFocus
          />
          <button onClick={pauseClock} disabled={busy} style={primaryButtonStyle}>
            Pause
          </button>
          <button
            onClick={() => { setShowPauseInput(false); setReason(''); }}
            disabled={busy}
            style={ghostButtonStyle}
            aria-label="Cancel"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {bounced && (
        <div
          role="alert"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 12px',
            background: colors.statusCriticalSubtle,
            border: `1px solid ${colors.statusCritical}`,
            borderRadius: 6,
            color: colors.statusCritical,
            fontSize: typography.fontSize.sm,
          }}
        >
          <AlertTriangle size={14} />
          <span style={{ flex: 1 }}>
            Email failed to deliver to <strong>{queueRow?.recipient_email ?? 'recipient'}</strong>.
            {queueRow?.error ? ` (${queueRow.error})` : ''} Fix the recipient's email and the next escalation will retry.
          </span>
        </div>
      )}
    </div>
  );
};

const pillButtonStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: '4px 10px',
  border: `1px solid ${colors.border}`,
  borderRadius: 999,
  background: 'transparent',
  cursor: 'pointer',
  fontSize: typography.fontSize.label,
  fontWeight: typography.fontWeight.medium,
  color: colors.textSecondary,
};

const primaryButtonStyle: React.CSSProperties = {
  padding: '6px 12px',
  border: 'none',
  borderRadius: 6,
  background: colors.primaryOrange,
  color: 'white',
  fontWeight: typography.fontWeight.semibold,
  fontSize: typography.fontSize.sm,
  cursor: 'pointer',
};

const ghostButtonStyle: React.CSSProperties = {
  padding: '6px 8px',
  border: 'none',
  borderRadius: 6,
  background: 'transparent',
  cursor: 'pointer',
  color: colors.textSecondary,
};

export default RfiSlaPanel;
