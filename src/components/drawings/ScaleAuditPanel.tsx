// Phase 7 — ScaleAuditPanel
// Runs cross-modal scale consistency audit between arch/struct drawing pairs
// and surfaces mismatches with auto-RFI workflow.

import React, { useState } from 'react';
import { Ruler, AlertTriangle, Play, FileWarning, CheckCircle2, Wand2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { colors, spacing, typography, borderRadius } from '../../styles/theme';
import { Btn, Card, Tag } from '../Primitives';

interface MismatchedPair {
  pair_id: string;
  arch_sheet: string;
  struct_sheet: string;
  arch_scale: string;
  struct_scale: string;
  arch_ratio: number | null;
  struct_ratio: number | null;
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: string;
}

interface AuditResult {
  match_percentage: number;
  matched_count: number;
  mismatched_count: number;
  mismatched_pairs: MismatchedPair[];
  total_checked: number;
  unscored_count: number;
  rfi_drafts_created: number;
}

interface ScaleAuditPanelProps {
  projectId: string;
}

const severityColor: Record<MismatchedPair['severity'], string> = {
  critical: 'statusCritical',
  high: 'statusPending',
  medium: 'statusPending',
  low: 'statusInfo',
};

export const ScaleAuditPanel: React.FC<ScaleAuditPanelProps> = ({ projectId }) => {
  const [loading, setLoading] = useState(false);
  const [autoRfi, setAutoRfi] = useState(false);
  const [result, setResult] = useState<AuditResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: invokeErr } = await supabase.functions.invoke('audit-scales', {
        body: { project_id: projectId, auto_create_rfi: autoRfi },
      });
      if (invokeErr) throw invokeErr;
      setResult(data as AuditResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const pct = result?.match_percentage ?? 0;
  const hasCritical = (result?.mismatched_pairs ?? []).some((m) => m.severity === 'critical');
  const ringColor = pct >= 95 ? colors.statusActive : pct >= 80 ? colors.statusPending : colors.statusCritical;

  return (
    <Card padding={spacing['5']}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing['4'] }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'] }}>
          <Ruler size={18} color={colors.textPrimary} />
          <div>
            <h3 style={{ margin: 0, fontSize: typography.fontSize.title, color: colors.textPrimary }}>Scale Consistency Audit</h3>
            <p style={{ margin: 0, fontSize: typography.fontSize.sm, color: colors.textSecondary }}>
              Compares scale between paired architectural and structural sheets.
            </p>
          </div>
        </div>
        <Btn variant="primary" onClick={run} disabled={loading} icon={<Play size={14} />}>
          {loading ? 'Auditing…' : 'Run Audit'}
        </Btn>
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], fontSize: typography.fontSize.sm, color: colors.textSecondary, marginBottom: spacing['4'] }}>
        <input type="checkbox" checked={autoRfi} onChange={(e) => setAutoRfi(e.target.checked)} />
        <Wand2 size={14} /> Auto-create RFI drafts for critical mismatches
      </label>

      {error && (
        <div style={{ padding: spacing['3'], background: colors.statusCriticalSubtle, borderRadius: borderRadius.md, color: colors.statusCritical, fontSize: typography.fontSize.sm, marginBottom: spacing['3'] }}>
          {error}
        </div>
      )}

      {result && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: spacing['3'], marginBottom: spacing['4'] }}>
            <Metric label="Match %" value={`${pct}%`} color={ringColor} />
            <Metric label="Matched" value={String(result.matched_count)} />
            <Metric label="Mismatched" value={String(result.mismatched_count)} color={result.mismatched_count > 0 ? colors.statusCritical : undefined} />
            <Metric label="Total Checked" value={String(result.total_checked)} />
          </div>

          {result.rfi_drafts_created > 0 && (
            <div style={{ padding: spacing['3'], background: colors.statusInfoSubtle, borderRadius: borderRadius.md, color: colors.statusInfo, fontSize: typography.fontSize.sm, marginBottom: spacing['3'], display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
              <FileWarning size={14} />
              Created {result.rfi_drafts_created} RFI draft{result.rfi_drafts_created === 1 ? '' : 's'} for critical scale mismatches. Review in the RFI queue.
            </div>
          )}

          {result.mismatched_pairs.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], color: colors.statusActive, fontSize: typography.fontSize.sm }}>
              <CheckCircle2 size={16} /> All paired sheets have consistent scales.
            </div>
          ) : (
            <div style={{ borderTop: `1px solid ${colors.borderSubtle}`, paddingTop: spacing['3'] }}>
              <div style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, marginBottom: spacing['2'], display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
                <AlertTriangle size={14} color={hasCritical ? colors.statusCritical : colors.statusPending} />
                {result.mismatched_pairs.length} mismatched pair{result.mismatched_pairs.length === 1 ? '' : 's'}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2'] }}>
                {result.mismatched_pairs.map((m) => (
                  <div
                    key={m.pair_id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr auto',
                      gap: spacing['3'],
                      padding: spacing['3'],
                      border: `1px solid ${colors.borderSubtle}`,
                      borderRadius: borderRadius.md,
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: typography.fontSize.xs, color: colors.textSecondary }}>Architectural</div>
                      <div style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary, fontWeight: 600 }}>
                        {m.arch_sheet}
                      </div>
                      <div style={{ fontSize: typography.fontSize.xs, color: colors.textSecondary }}>{m.arch_scale}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: typography.fontSize.xs, color: colors.textSecondary }}>Structural</div>
                      <div style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary, fontWeight: 600 }}>
                        {m.struct_sheet}
                      </div>
                      <div style={{ fontSize: typography.fontSize.xs, color: colors.textSecondary }}>{m.struct_scale}</div>
                    </div>
                    <Tag color={colors[severityColor[m.severity] as keyof typeof colors] as string} label={m.severity.toUpperCase()} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </Card>
  );
};

const Metric: React.FC<{ label: string; value: string; color?: string }> = ({ label, value, color }) => (
  <div style={{ padding: spacing['3'], border: `1px solid ${colors.borderSubtle}`, borderRadius: borderRadius.md }}>
    <div style={{ fontSize: typography.fontSize.xs, color: colors.textSecondary }}>{label}</div>
    <div style={{ fontSize: typography.fontSize.heading, color: color ?? colors.textPrimary, fontWeight: 600 }}>{value}</div>
  </div>
);

export default ScaleAuditPanel;
