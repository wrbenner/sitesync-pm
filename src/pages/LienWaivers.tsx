import React, { useState, useEffect } from 'react';
import { FileCheck, AlertTriangle, Clock, CheckCircle } from 'lucide-react';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { PageContainer, MetricBox, Skeleton, Btn } from '../components/Primitives';
import { colors, spacing, typography, borderRadius, shadows, transitions, touchTarget } from '../styles/theme';
import { supabase } from '../lib/supabase';
import { useProjectId } from '../hooks/useProjectId';
import { useNavigate } from 'react-router-dom';
import type { Database } from '../types/database';

type LienWaiver = Database['public']['Tables']['lien_waivers']['Row'];

type WaiverType = LienWaiver['type'] | 'all';
type StatusFilter = 'all' | 'pending' | 'signed';

const WAIVER_TYPE_LABELS: Record<LienWaiver['type'], string> = {
  conditional_progress: 'Conditional Progress',
  unconditional_progress: 'Unconditional Progress',
  conditional_final: 'Conditional Final',
  unconditional_final: 'Unconditional Final',
};

function fmtDollars(n: number | null): string {
  if (n == null) return '$0';
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function isSignedStatus(status: LienWaiver['status']): boolean {
  return status === 'received';
}

function LienWaiversPage() {
  const projectId = useProjectId();
  const navigate = useNavigate();

  const [waivers, setWaivers] = useState<LienWaiver[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<WaiverType>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [hovered, setHovered] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    supabase
      .from('lien_waivers')
      .select('*')
      .eq('project_id', projectId)
      .then(({ data, error }) => {
        if (!error && data) setWaivers(data);
        setLoading(false);
      });
  }, [projectId]);

  const filtered = waivers.filter((w) => {
    if (typeFilter !== 'all' && w.type !== typeFilter) return false;
    if (statusFilter === 'pending' && isSignedStatus(w.status)) return false;
    if (statusFilter === 'signed' && !isSignedStatus(w.status)) return false;
    return true;
  });

  const totalCount = waivers.length;
  const pendingCount = waivers.filter((w) => !isSignedStatus(w.status)).length;
  const signedCount = waivers.filter((w) => isSignedStatus(w.status)).length;
  const missingCount = waivers.filter((w) => w.status === 'missing').length;

  const colWidths = ['22%', '22%', '14%', '16%', '12%', '14%'];
  const colHeaders = ['Vendor', 'Waiver Type', 'Amount Waived', 'Period Covered Through', 'Status', 'Signed Date'];

  const thStyle: React.CSSProperties = {
    textAlign: 'left',
    fontSize: typography.fontSize.label,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    padding: `${spacing['3']} ${spacing['4']}`,
    borderBottom: `1px solid ${colors.borderSubtle}`,
    whiteSpace: 'nowrap',
  };

  const tdStyle: React.CSSProperties = {
    fontSize: typography.fontSize.body,
    color: colors.textPrimary,
    padding: `0 ${spacing['4']}`,
    verticalAlign: 'middle',
  };

  return (
    <PageContainer
      title="Lien Waivers"
      subtitle="Track conditional and unconditional lien waivers from subcontractors and vendors."
    >
      {/* Metric cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: spacing['5'],
          marginBottom: spacing['8'],
        }}
      >
        <MetricBox
          label="Total Waivers"
          value={loading ? '—' : totalCount}
        />
        <MetricBox
          label="Pending Signature"
          value={loading ? '—' : pendingCount}
          colorOverride={pendingCount > 0 ? 'warning' : undefined}
        />
        <MetricBox
          label="Signed This Period"
          value={loading ? '—' : signedCount}
          colorOverride={signedCount > 0 ? 'success' : undefined}
        />
        <MetricBox
          label="Missing Waivers"
          value={loading ? '—' : missingCount}
          colorOverride={missingCount > 0 ? 'danger' : undefined}
        />
      </div>

      {/* Filter bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: spacing['4'],
          marginBottom: spacing['5'],
        }}
      >
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as WaiverType)}
          aria-label="Filter by waiver type"
          style={{
            fontSize: typography.fontSize.body,
            color: colors.textPrimary,
            backgroundColor: colors.surfaceRaised,
            border: `1px solid ${colors.borderDefault}`,
            borderRadius: borderRadius.md,
            padding: `0 ${spacing['3']}`,
            cursor: 'pointer',
            outline: 'none',
            minHeight: touchTarget.field,
          }}
        >
          <option value="all">All Types</option>
          {(Object.keys(WAIVER_TYPE_LABELS) as LienWaiver['type'][]).map((t) => (
            <option key={t} value={t}>{WAIVER_TYPE_LABELS[t]}</option>
          ))}
        </select>

        {/* Status toggle */}
        <div
          role="group"
          aria-label="Filter by status"
          style={{
            display: 'flex',
            backgroundColor: colors.surfaceInset,
            borderRadius: borderRadius.md,
            padding: 2,
            gap: 2,
          }}
        >
          {(['all', 'pending', 'signed'] as StatusFilter[]).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              aria-pressed={statusFilter === s}
              style={{
                fontSize: typography.fontSize.sm,
                fontWeight: typography.fontWeight.medium,
                padding: `0 ${spacing['4']}`,
                minHeight: touchTarget.field,
                borderRadius: borderRadius.base,
                border: 'none',
                cursor: 'pointer',
                transition: transitions.quick,
                backgroundColor: statusFilter === s ? colors.surfaceRaised : 'transparent',
                color: statusFilter === s ? colors.textPrimary : colors.textTertiary,
                boxShadow: statusFilter === s ? shadows.sm : 'none',
                fontFamily: typography.fontFamily,
              }}
            >
              {s === 'all' ? 'All' : s === 'pending' ? 'Pending' : 'Signed'}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div
        style={{
          backgroundColor: colors.surfaceRaised,
          borderRadius: borderRadius.xl,
          boxShadow: shadows.card,
          overflow: 'hidden',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <colgroup>
            {colWidths.map((w, i) => <col key={i} style={{ width: w }} />)}
          </colgroup>
          <thead>
            <tr>
              {colHeaders.map((h) => (
                <th key={h} style={thStyle}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {colWidths.map((_, j) => (
                    <td key={j} style={{ ...tdStyle, height: touchTarget.field }}>
                      <Skeleton
                        width={j === 1 ? '70%' : j === 2 ? '55%' : '80%'}
                        height="14px"
                      />
                    </td>
                  ))}
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  style={{
                    padding: spacing['16'],
                    textAlign: 'center',
                    verticalAlign: 'middle',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: spacing['4'],
                    }}
                  >
                    <FileCheck size={36} color={colors.textTertiary} strokeWidth={1.5} />
                    <p
                      style={{
                        fontSize: typography.fontSize.body,
                        color: colors.textSecondary,
                        margin: 0,
                        maxWidth: 420,
                        lineHeight: 1.6,
                      }}
                    >
                      No lien waivers for this period. Waivers are generated automatically when pay applications are approved.
                    </p>
                    <Btn
                      variant="secondary"
                      onClick={() => navigate('/pay-apps')}
                    >
                      View Pay Applications
                    </Btn>
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map((w) => {
                const signed = isSignedStatus(w.status);
                const isMissing = w.status === 'missing';
                const isHovered = hovered === w.id;

                return (
                  <tr
                    key={w.id}
                    onMouseEnter={() => setHovered(w.id)}
                    onMouseLeave={() => setHovered(null)}
                    style={{
                      height: touchTarget.field,
                      cursor: 'pointer',
                      backgroundColor: isHovered ? colors.surfaceHover : 'transparent',
                      transition: transitions.quick,
                      borderBottom: `1px solid ${colors.borderSubtle}`,
                    }}
                  >
                    {/* Vendor */}
                    <td style={tdStyle}>
                      <span
                        style={{
                          fontSize: typography.fontSize.body,
                          fontWeight: typography.fontWeight.medium,
                          color: colors.textPrimary,
                        }}
                      >
                        {w.subcontractor_id
                          ? w.subcontractor_id.slice(0, 8).toUpperCase()
                          : 'Unknown Vendor'}
                      </span>
                    </td>

                    {/* Waiver Type */}
                    <td style={tdStyle}>
                      <span
                        style={{
                          display: 'inline-block',
                          fontSize: typography.fontSize.sm,
                          fontWeight: typography.fontWeight.medium,
                          color: colors.textSecondary,
                          backgroundColor: colors.surfaceInset,
                          borderRadius: borderRadius.base,
                          padding: `2px ${spacing['2']}`,
                        }}
                      >
                        {WAIVER_TYPE_LABELS[w.type]}
                      </span>
                    </td>

                    {/* Amount */}
                    <td style={{ ...tdStyle, fontVariantNumeric: 'tabular-nums', fontWeight: typography.fontWeight.medium }}>
                      {fmtDollars(w.amount)}
                    </td>

                    {/* Period Covered Through */}
                    <td style={{ ...tdStyle, color: colors.textSecondary }}>
                      {w.payment_period ? fmtDate(w.payment_period) : <span style={{ color: colors.textTertiary }}>Not set</span>}
                    </td>

                    {/* Status */}
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
                        <div
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            flexShrink: 0,
                            backgroundColor: signed
                              ? colors.statusActive
                              : isMissing
                              ? colors.statusCritical
                              : colors.statusPending,
                          }}
                        />
                        <span
                          style={{
                            fontSize: typography.fontSize.sm,
                            fontWeight: typography.fontWeight.medium,
                            color: signed
                              ? colors.statusActive
                              : isMissing
                              ? colors.statusCritical
                              : colors.statusPending,
                          }}
                        >
                          {signed ? 'Signed' : isMissing ? 'Missing' : 'Unsigned'}
                        </span>
                      </div>
                    </td>

                    {/* Signed Date */}
                    <td style={{ ...tdStyle, color: colors.textSecondary }}>
                      {signed && w.received_at
                        ? fmtDate(w.received_at)
                        : <span style={{ color: colors.textTertiary }}>—</span>}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </PageContainer>
  );
}

export const LienWaivers: React.FC = () => (
  <ErrorBoundary message="Lien waivers could not be displayed. Check your connection and try again.">
    <LienWaiversPage />
  </ErrorBoundary>
);

export default LienWaivers;
