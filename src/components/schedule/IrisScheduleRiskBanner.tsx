// ─────────────────────────────────────────────────────────────────────────────
// IrisScheduleRiskBanner
// ─────────────────────────────────────────────────────────────────────────────
// Surfaces the `ai-schedule-risk` edge-function output as a compact banner at
// the top of /schedule. Each risk row shows: activity, level (high/med/low),
// projected days of impact, plain-language reason, and a one-line mitigation.
// All clicks are no-ops in this banner — the risks already link back to the
// schedule below; the banner is a glance-and-go surface.
//
// The function is invoked manually via "Run AI risk scan" so the demo can
// trigger it on stage. Once cached (15 min staleTime) it auto-renders on
// subsequent loads — feels like the system already knows.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Sparkles, AlertTriangle, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { colors, typography, spacing } from '../../styles/theme';

interface ScheduleRisk {
  activity_id?: string;
  activity_name: string;
  task_name?: string;        // alternate field name from older response shape
  risk_level: 'high' | 'medium' | 'low';
  probability?: number;
  impact_days?: number;
  days_impact?: number;       // alternate field name
  reason: string;
  mitigation?: string;
}

const IRIS_INDIGO = '#4F46E5';
const IRIS_BG = 'rgba(79, 70, 229, 0.04)';
const IRIS_BORDER = 'rgba(79, 70, 229, 0.20)';

const LEVEL_TONE: Record<ScheduleRisk['risk_level'], { bg: string; fg: string; label: string }> = {
  high:   { bg: 'rgba(201, 59, 59, 0.10)',   fg: '#C93B3B', label: 'HIGH' },
  medium: { bg: 'rgba(196, 133, 12, 0.10)',  fg: '#C4850C', label: 'MED'  },
  low:    { bg: 'rgba(45, 138, 110, 0.10)',  fg: '#2D8A6E', label: 'LOW'  },
};

interface Props {
  projectId: string | undefined;
}

export const IrisScheduleRiskBanner: React.FC<Props> = ({ projectId }) => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(true);
  // Auto-fetch on mount so Iris is already running when the user lands
  // on /schedule during a demo. The query has a 15-minute staleTime so
  // repeat visits within the demo window are cached and instant.
  const [autoFetch, setAutoFetch] = useState(true);

  const { data: risks, isFetching, error, refetch } = useQuery<ScheduleRisk[]>({
    queryKey: ['ai-schedule-risk', projectId],
    enabled: !!projectId && !!user && autoFetch,
    staleTime: 15 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke('ai-schedule-risk', {
        body: { project_id: projectId },
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined,
      });
      if (res.error) throw res.error;
      return (res.data?.risks ?? []) as ScheduleRisk[];
    },
  });

  const handleRun = () => {
    setAutoFetch(true);
    // If query was already cached, force a refetch so the demo always feels live.
    qc.invalidateQueries({ queryKey: ['ai-schedule-risk', projectId] });
    setTimeout(() => refetch(), 50);
  };

  const sorted = (risks ?? []).slice().sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 } as const;
    return order[a.risk_level] - order[b.risk_level];
  });
  const visible = sorted.slice(0, 3);
  const overflow = sorted.length - visible.length;

  // Initial state — show a "run scan" CTA, no banner content yet
  if (!autoFetch || (!risks && !isFetching && !error)) {
    return (
      <div
        role="region"
        aria-label="Iris schedule risk"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: spacing[3],
          padding: `${spacing[3]} ${spacing[4]}`,
          marginBottom: spacing[4],
          backgroundColor: IRIS_BG,
          border: `1px solid ${IRIS_BORDER}`,
          borderRadius: 8,
          fontFamily: typography.fontFamily,
        }}
      >
        <Sparkles size={16} color={IRIS_INDIGO} strokeWidth={2.25} aria-hidden />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: IRIS_INDIGO }}>
            Iris · Schedule risk
          </div>
          <div style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>
            AI scan over critical-path activities + weather + crew availability + open RFIs. Runs on demand; cached for 15 minutes.
          </div>
        </div>
        <button
          type="button"
          onClick={handleRun}
          disabled={!projectId}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 14px',
            background: IRIS_INDIGO,
            border: 'none',
            borderRadius: 6,
            color: '#FFFFFF',
            fontSize: 13,
            fontWeight: 600,
            cursor: projectId ? 'pointer' : 'not-allowed',
            opacity: projectId ? 1 : 0.5,
          }}
        >
          <Sparkles size={13} aria-hidden /> Run risk scan
        </button>
      </div>
    );
  }

  // Loading state
  if (isFetching && !risks) {
    return (
      <div
        role="status"
        style={{
          display: 'flex', alignItems: 'center', gap: spacing[3],
          padding: `${spacing[3]} ${spacing[4]}`, marginBottom: spacing[4],
          backgroundColor: IRIS_BG, border: `1px solid ${IRIS_BORDER}`, borderRadius: 8,
          fontFamily: typography.fontFamily,
        }}
      >
        <Sparkles size={16} color={IRIS_INDIGO} aria-hidden />
        <span style={{ fontSize: 13, color: colors.textSecondary }}>
          Iris is analyzing schedule risk — reading activities, weather, crew availability, open RFIs…
        </span>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div
        role="alert"
        style={{
          display: 'flex', alignItems: 'center', gap: spacing[3],
          padding: `${spacing[3]} ${spacing[4]}`, marginBottom: spacing[4],
          backgroundColor: '#FCE7E7', border: '1px solid rgba(201, 59, 59, 0.20)',
          borderRadius: 8, fontFamily: typography.fontFamily,
        }}
      >
        <AlertTriangle size={16} color="#C93B3B" aria-hidden />
        <span style={{ fontSize: 13, color: '#9A2929', flex: 1 }}>
          Risk scan failed. {(error as Error).message ?? 'Try again in a minute.'}
        </span>
        <button
          type="button"
          onClick={() => refetch()}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '6px 12px', background: 'transparent',
            border: '1px solid #C93B3B', borderRadius: 6,
            color: '#C93B3B', fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}
        >
          <RefreshCw size={12} aria-hidden /> Retry
        </button>
      </div>
    );
  }

  // Empty result — no risks detected
  if (sorted.length === 0) {
    return (
      <div
        role="status"
        style={{
          display: 'flex', alignItems: 'center', gap: spacing[3],
          padding: `${spacing[3]} ${spacing[4]}`, marginBottom: spacing[4],
          backgroundColor: 'rgba(45, 138, 110, 0.04)',
          border: '1px solid rgba(45, 138, 110, 0.20)',
          borderRadius: 8, fontFamily: typography.fontFamily,
        }}
      >
        <Sparkles size={16} color="#2D8A6E" aria-hidden />
        <span style={{ fontSize: 13, color: '#2D8A6E', fontWeight: 500 }}>
          Iris found no high-risk activities on the critical path.
        </span>
      </div>
    );
  }

  return (
    <section
      role="region"
      aria-label="Iris detected schedule risks"
      style={{
        marginBottom: spacing[4],
        backgroundColor: IRIS_BG,
        border: `1px solid ${IRIS_BORDER}`,
        borderRadius: 8,
        fontFamily: typography.fontFamily,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <header
        style={{
          display: 'flex', alignItems: 'center', gap: spacing[3],
          padding: `${spacing[3]} ${spacing[4]}`,
          borderBottom: expanded ? `1px solid ${IRIS_BORDER}` : 'none',
        }}
      >
        <Sparkles size={14} color={IRIS_INDIGO} strokeWidth={2.25} aria-hidden />
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: IRIS_INDIGO }}>
          Iris · {sorted.length} schedule risk{sorted.length === 1 ? '' : 's'} detected
        </span>
        <span style={{ fontSize: 11, color: colors.textTertiary, marginLeft: spacing[2] }}>
          Anthropic Claude over schedule + weather + crew + RFIs · cached 15 min
        </span>
        <div style={{ flex: 1 }} />
        <button
          type="button"
          onClick={() => refetch()}
          aria-label="Re-run scan"
          title="Re-run scan"
          disabled={isFetching}
          style={{
            display: 'inline-flex', alignItems: 'center',
            padding: 4, background: 'transparent', border: 'none', borderRadius: 4,
            color: colors.textTertiary, cursor: 'pointer',
            opacity: isFetching ? 0.4 : 1,
          }}
        >
          <RefreshCw size={13} aria-hidden style={{ animation: isFetching ? 'spin 1s linear infinite' : undefined }} />
        </button>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-label={expanded ? 'Collapse' : 'Expand'}
          style={{
            display: 'inline-flex', alignItems: 'center',
            padding: 4, background: 'transparent', border: 'none', borderRadius: 4,
            color: colors.textTertiary, cursor: 'pointer',
          }}
        >
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </header>

      {/* Risk rows */}
      {expanded && (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {visible.map((r, i) => {
            const tone = LEVEL_TONE[r.risk_level];
            const days = r.impact_days ?? r.days_impact ?? 0;
            const name = r.activity_name ?? r.task_name ?? 'Unknown activity';
            return (
              <li
                key={r.activity_id ?? `${name}-${i}`}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '60px minmax(0, 1.4fr) 70px minmax(0, 2.4fr)',
                  gap: spacing[3],
                  alignItems: 'center',
                  padding: `${spacing[3]} ${spacing[4]}`,
                  borderTop: i === 0 ? 'none' : `1px solid ${IRIS_BORDER}`,
                }}
              >
                <span
                  style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    padding: '2px 6px', borderRadius: 4,
                    backgroundColor: tone.bg, color: tone.fg,
                    fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
                  }}
                >
                  {tone.label}
                </span>
                <span style={{ fontSize: 13, fontWeight: 600, color: colors.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {name}
                </span>
                <span style={{ fontSize: 12, fontWeight: 600, color: tone.fg, fontFamily: typography.fontFamilyMono }}>
                  {days > 0 ? `+${days}d` : '—'}
                </span>
                <span style={{ fontSize: 12, color: colors.textSecondary, lineHeight: 1.45, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  <strong style={{ color: colors.textPrimary, fontWeight: 500 }}>Why:</strong> {r.reason}
                  {r.mitigation && (<>{'  ·  '}<strong style={{ color: colors.textPrimary, fontWeight: 500 }}>Mitigation:</strong> {r.mitigation}</>)}
                </span>
              </li>
            );
          })}
          {overflow > 0 && (
            <li
              style={{
                padding: `${spacing[2]} ${spacing[4]}`,
                borderTop: `1px solid ${IRIS_BORDER}`,
                fontSize: 12, color: colors.textTertiary, textAlign: 'center',
              }}
            >
              +{overflow} more risk{overflow === 1 ? '' : 's'} detected
            </li>
          )}
        </ul>
      )}
    </section>
  );
};

export default IrisScheduleRiskBanner;
