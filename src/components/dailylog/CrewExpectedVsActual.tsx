// ── CrewExpectedVsActual ────────────────────────────────────────────────────
// Tab A widget for the daily log: shows each crew scheduled for today, their
// planned arrival time, their actual check-in time (if recorded), and a
// no-show flag if they're > 60 min late with no check-in.
//
// "Check in" tap writes a row to crew_attendance.actual_check_in_at.
// The +60min no-show flag is computed on render — there's no separate
// timer. When the user opens the daily log at 8:30 and a 7:00 crew has
// no check-in, the widget renders the "60 min late" state and offers
// an "Auto-create action item" button. Clicking it fires the
// runCrewNoShowChain (idempotent — won't double-create).

import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { Clock, Check, AlertTriangle, Phone } from 'lucide-react';
import { colors, spacing, typography } from '../../styles/theme';
import { toast } from 'sonner';

interface CrewExpectedVsActualProps {
  projectId: string;
  /** ISO date 'YYYY-MM-DD' — usually today. */
  date: string;
}

interface CrewRow {
  id: string;
  name: string;
  trade: string | null;
  lead_id: string | null;
  planned_arrival_time: string | null;
  status: string | null;
}
interface AttendanceRow {
  id: string;
  crew_id: string;
  attendance_date: string;
  planned_arrival_time: string | null;
  actual_check_in_at: string | null;
  no_show_flagged_at: string | null;
  meeting_action_item_id: string | null;
}

/** "07:00" + 60 min = "08:00", returned as a Date for today. */
function plannedDateOnDay(time: string, date: string): Date | null {
  if (!/^[0-2]\d:[0-5]\d$/.test(time)) return null;
  return new Date(`${date}T${time}:00`);
}

export const CrewExpectedVsActual: React.FC<CrewExpectedVsActualProps> = ({
  projectId,
  date,
}) => {
  const qc = useQueryClient();
  const [busyCrew, setBusyCrew] = useState<string | null>(null);

  // Pull crews with a planned arrival (skip the rest — no schedule, no widget).
  const { data: crews } = useQuery({
    queryKey: ['crews-with-arrival', projectId],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabase as any;
      const { data } = await sb
        .from('crews')
        .select('id, name, trade, lead_id, planned_arrival_time, status')
        .eq('project_id', projectId)
        .not('planned_arrival_time', 'is', null);
      return (data as unknown as CrewRow[] | null) ?? [];
    },
    refetchInterval: 5 * 60_000,
  });

  // Today's attendance rows.
  const { data: attendance } = useQuery({
    queryKey: ['crew-attendance', projectId, date],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabase as any;
      const { data } = await sb
        .from('crew_attendance')
        .select('id, crew_id, attendance_date, planned_arrival_time, actual_check_in_at, no_show_flagged_at, meeting_action_item_id')
        .eq('project_id', projectId)
        .eq('attendance_date', date);
      return (data as unknown as AttendanceRow[] | null) ?? [];
    },
    refetchInterval: 60_000,
  });

  const attendanceByCrew = useMemo(() => {
    const map = new Map<string, AttendanceRow>();
    for (const row of attendance ?? []) map.set(row.crew_id, row);
    return map;
  }, [attendance]);

  const now = new Date();
  const visibleCrews = (crews ?? []).filter((c) => c.status !== 'inactive');
  if (visibleCrews.length === 0) return null;

  const checkIn = async (crew: CrewRow) => {
    setBusyCrew(crew.id);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;
    const existing = attendanceByCrew.get(crew.id);
    if (existing) {
      const { error } = await sb
        .from('crew_attendance')
        .update({ actual_check_in_at: new Date().toISOString() } as never)
        .eq('id', existing.id);
      if (error) toast.error(error.message);
    } else {
      const { error } = await sb.from('crew_attendance').insert({
        project_id: projectId,
        crew_id: crew.id,
        attendance_date: date,
        planned_arrival_time: crew.planned_arrival_time,
        actual_check_in_at: new Date().toISOString(),
      } as never);
      if (error) toast.error(error.message);
    }
    setBusyCrew(null);
    qc.invalidateQueries({ queryKey: ['crew-attendance', projectId, date] });
    toast.success(`${crew.name} checked in`);
  };

  const flagNoShow = async (crew: CrewRow) => {
    setBusyCrew(crew.id);
    const result = await import('../../lib/crossFeatureWorkflows')
      .then(({ runCrewNoShowChain }) => runCrewNoShowChain({ crewId: crew.id, projectId, date }))
      .catch((err) => ({ workflow: 'crew_no_show', error: (err as Error).message }));
    setBusyCrew(null);
    qc.invalidateQueries({ queryKey: ['crew-attendance', projectId, date] });
    qc.invalidateQueries({ queryKey: ['meeting_action_items'] });
    if (result.error) {
      toast.error(`Action item not created: ${result.error}`);
    } else if ('created' in result && result.created) {
      toast.success(`Action item created for ${crew.name}`);
    } else if ('skipped' in result && result.skipped) {
      toast.info(result.skipped.reason);
    }
  };

  return (
    <div
      style={{
        marginTop: spacing['3'],
        padding: spacing['3'],
        background: colors.surfaceRaised,
        border: `1px solid ${colors.border}`,
        borderRadius: 8,
      }}
    >
      <div
        style={{
          fontSize: typography.fontSize.label,
          fontWeight: typography.fontWeight.medium,
          textTransform: 'uppercase',
          letterSpacing: 0.4,
          color: colors.textSecondary,
          marginBottom: spacing['2'],
        }}
      >
        Crew expected vs actual — {date}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {visibleCrews.map((crew) => {
          const att = attendanceByCrew.get(crew.id);
          const planned = crew.planned_arrival_time;
          const plannedAt = planned ? plannedDateOnDay(planned, date) : null;
          const minutesLate = plannedAt
            ? Math.floor((now.getTime() - plannedAt.getTime()) / 60_000)
            : 0;
          const checkedIn = !!att?.actual_check_in_at;
          const noShowReady = !checkedIn && minutesLate >= 60;
          const alreadyFlagged = !!att?.no_show_flagged_at || !!att?.meeting_action_item_id;

          return (
            <div
              key={crew.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '8px 0',
                borderTop: `1px solid ${colors.borderSubtle}`,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold }}>
                  {crew.name}
                  {crew.trade && (
                    <span style={{ color: colors.textSecondary, fontWeight: typography.fontWeight.normal, marginLeft: 6 }}>
                      · {crew.trade}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: typography.fontSize.label, color: colors.textSecondary }}>
                  Planned: {planned ?? '—'}
                  {checkedIn
                    ? ` · Checked in ${new Date(att!.actual_check_in_at!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                    : ''}
                </div>
              </div>

              {checkedIn ? (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '2px 8px',
                    borderRadius: 999,
                    background: colors.statusActiveSubtle,
                    color: colors.statusActive,
                    fontSize: typography.fontSize.label,
                    fontWeight: typography.fontWeight.semibold,
                  }}
                >
                  <Check size={11} /> On site
                </span>
              ) : noShowReady ? (
                <>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '2px 8px',
                      borderRadius: 999,
                      background: colors.statusCriticalSubtle,
                      color: colors.statusCritical,
                      fontSize: typography.fontSize.label,
                      fontWeight: typography.fontWeight.semibold,
                    }}
                  >
                    <AlertTriangle size={11} /> {minutesLate} min late
                  </span>
                  {alreadyFlagged ? (
                    <span style={{ fontSize: typography.fontSize.label, color: colors.textSecondary }}>
                      Flagged
                    </span>
                  ) : (
                    <button
                      onClick={() => flagNoShow(crew)}
                      disabled={busyCrew === crew.id}
                      style={pillBtn(colors.statusCritical)}
                    >
                      <Phone size={11} /> Create action item
                    </button>
                  )}
                </>
              ) : (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '2px 8px',
                    borderRadius: 999,
                    background: colors.statusPendingSubtle,
                    color: colors.statusPending,
                    fontSize: typography.fontSize.label,
                    fontWeight: typography.fontWeight.semibold,
                  }}
                >
                  <Clock size={11} /> {minutesLate > 0 ? `${minutesLate} min late` : 'Pending'}
                </span>
              )}

              <button
                onClick={() => checkIn(crew)}
                disabled={busyCrew === crew.id || checkedIn}
                style={pillBtn(checkedIn ? colors.textTertiary : colors.primaryOrange)}
              >
                {checkedIn ? 'Checked in' : 'Check in'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

function pillBtn(fg: string): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '4px 10px',
    border: `1px solid ${fg}`,
    borderRadius: 999,
    background: 'transparent',
    cursor: 'pointer',
    fontSize: typography.fontSize.label,
    fontWeight: typography.fontWeight.semibold,
    color: fg,
  };
}

export default CrewExpectedVsActual;
