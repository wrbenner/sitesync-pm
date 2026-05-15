import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, FileWarning, ClipboardCheck, AlertTriangle, ChevronRight } from 'lucide-react';
import { colors, spacing, typography, borderRadius } from '../../styles/theme';
import { getCOIStatus } from '../../hooks/queries/insurance-certificates';
import {
  useDashboardPayload,
  type DashboardPermitRow,
} from '../../hooks/queries/dashboard-payload';

// ────────────────────────────────────────────────────────────────
// Compliance — expiring permits (<30d), expiring COIs (<30d),
// failed/overdue inspections. Collapsed to a row of alerts.
// ────────────────────────────────────────────────────────────────

interface Props {
  projectId: string | undefined;
}

interface ComplianceRow {
  id: string;
  kind: 'permit' | 'coi' | 'inspection';
  label: string;
  context: string;
  severity: 'critical' | 'warning';
  path: string;
}

// FMEA P.WIDGET.1 (Wave 4): widget now reads from the shared
// useDashboardPayload cache — first paint is one batched RPC across
// the dashboard rather than per-widget REST calls.
type PermitRow = DashboardPermitRow;

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const target = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

export const DashboardCompliance: React.FC<Props> = ({ projectId }) => {
  const navigate = useNavigate();
  const { data: payload } = useDashboardPayload(projectId);
  const data = payload?.compliance;

  const rows = useMemo<ComplianceRow[]>(() => {
    const out: ComplianceRow[] = [];
    for (const p of (data?.permits ?? []) as PermitRow[]) {
      const d = daysUntil(p.expiration_date);
      if (d === null) continue;
      const severity: ComplianceRow['severity'] = d < 0 ? 'critical' : d <= 7 ? 'critical' : 'warning';
      const label = `${p.type ? p.type.replace(/_/g, ' ') : 'Permit'}${p.permit_number ? ` #${p.permit_number}` : ''}`;
      const ctx = d < 0 ? `Expired ${Math.abs(d)}d ago` : `Expires in ${d}d`;
      out.push({ id: `permit-${p.id}`, kind: 'permit', label, context: ctx, severity, path: '/permits' });
    }
    for (const c of data?.certs ?? []) {
      const status = getCOIStatus(c.expiration_date);
      if (status.severity !== 'expired' && status.severity !== 'expiring') continue;
      const severity: ComplianceRow['severity'] = status.severity === 'expired' ? 'critical' : 'warning';
      const label = `${c.company} — ${c.policy_type ? c.policy_type.replace(/_/g, ' ') : 'COI'}`;
      out.push({ id: `coi-${c.id}`, kind: 'coi', label, context: status.label, severity, path: '/contracts' });
    }
    for (const insp of data?.inspections ?? []) {
      const isFailed = insp.status === 'failed' || insp.status === 'corrective_action_required';
      const d = daysUntil(insp.date);
      const overdue = !isFailed && d !== null && d < 0;
      if (!isFailed && !overdue) continue;
      const severity: ComplianceRow['severity'] = isFailed ? 'critical' : 'warning';
      const label = `${insp.type.replace(/_/g, ' ')} inspection`;
      const ctx = isFailed ? insp.status.replace(/_/g, ' ') : `Overdue by ${Math.abs(d ?? 0)}d`;
      out.push({ id: `insp-${insp.id}`, kind: 'inspection', label, context: ctx, severity, path: '/safety' });
    }
    out.sort((a, b) => (a.severity === 'critical' ? 0 : 1) - (b.severity === 'critical' ? 0 : 1));
    return out;
  }, [data]);

  const criticalCount = rows.filter((r) => r.severity === 'critical').length;

  return (
    <div style={{
      padding: spacing['4'],
      backgroundColor: colors.surfaceRaised,
      borderRadius: borderRadius.xl,
      border: `1px solid ${colors.borderSubtle}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing['3'] }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
          <Shield size={12} color={colors.textTertiary} />
          <span style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Compliance
          </span>
        </div>
        {rows.length > 0 ? (
          <span style={{ fontSize: '10px', color: criticalCount > 0 ? colors.statusCritical : colors.statusPending, fontWeight: typography.fontWeight.semibold }}>
            {rows.length} alert{rows.length === 1 ? '' : 's'}
          </span>
        ) : (
          <span style={{ fontSize: '10px', color: colors.statusActive, fontWeight: typography.fontWeight.semibold }}>
            All clear
          </span>
        )}
      </div>

      {rows.length === 0 ? (
        <div style={{
          display: 'flex', alignItems: 'center', gap: spacing['2'],
          padding: spacing['3'], backgroundColor: colors.surfaceInset,
          borderRadius: borderRadius.md, color: colors.textSecondary, fontSize: typography.fontSize.sm,
        }}>
          <ClipboardCheck size={14} />
          <span>No expiring permits, COIs, or failed inspections.</span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['1'] }}>
          {rows.slice(0, 6).map((row) => {
            const Icon = row.kind === 'permit' ? FileWarning : row.kind === 'coi' ? Shield : AlertTriangle;
            const sev = row.severity === 'critical' ? colors.statusCritical : colors.statusPending;
            const sevBg = row.severity === 'critical' ? colors.statusCriticalSubtle : colors.statusPendingSubtle;
            return (
              <button
                key={row.id}
                onClick={() => navigate(row.path)}
                style={{
                  display: 'flex', alignItems: 'center', gap: spacing['3'],
                  padding: `${spacing['2']} ${spacing['2.5']}`,
                  border: 'none',
                  background: 'none',
                  borderRadius: borderRadius.md,
                  cursor: 'pointer',
                  width: '100%',
                  textAlign: 'left',
                  fontFamily: typography.fontFamily,
                  transition: 'background-color 0.15s ease',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = colors.surfaceHover; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                <div style={{
                  width: 22, height: 22, borderRadius: borderRadius.full,
                  backgroundColor: sevBg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <Icon size={11} color={sev} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textTransform: 'capitalize' }}>
                    {row.label}
                  </div>
                  <div style={{ fontSize: '10px', color: sev, marginTop: 1, textTransform: 'capitalize' }}>
                    {row.context}
                  </div>
                </div>
                <ChevronRight size={12} color={colors.textTertiary} style={{ flexShrink: 0 }} />
              </button>
            );
          })}
          {rows.length > 6 && (
            <div style={{ fontSize: '10px', color: colors.textSecondary, textAlign: 'center', paddingTop: spacing['1'] }}>
              +{rows.length - 6} more
            </div>
          )}
        </div>
      )}
    </div>
  );
};

DashboardCompliance.displayName = 'DashboardCompliance';
