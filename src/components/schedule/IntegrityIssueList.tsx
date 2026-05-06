/**
 * IntegrityIssueList — schedule integrity report renderer.
 *
 * Pure presentation. Parent runs `integrityCheck(activities)` and passes
 * the report. The "Logic quality" pill in the Schedule page header keys
 * off `report.status` — render `unanalyzed` neutral, never red.
 */

import React from 'react';
import { colors, typography, spacing } from '../../styles/theme';
import { Eyebrow, Hairline } from '../atoms';
import type {
  IntegrityIssue,
  IntegrityReport,
  IntegrityStatus,
} from '../../lib/schedule/integrityCheck';

interface IntegrityIssueListProps {
  report: IntegrityReport;
}

const STATUS_LABEL: Record<IntegrityStatus, string> = {
  unanalyzed: 'Unanalyzed',
  healthy: 'Healthy',
  watch: 'Watch',
  broken: 'Broken',
};

const STATUS_COLOR: Record<IntegrityStatus, string> = {
  unanalyzed: colors.textTertiary,
  healthy: colors.statusActive,
  watch: colors.statusPending,
  broken: colors.statusCritical,
};

const ISSUE_ORDER: IntegrityIssue['type'][] = [
  'negative_float',
  'constraint_conflict',
  'orphan',
  'open_start',
  'open_finish',
];

const ISSUE_LABEL: Record<IntegrityIssue['type'], string> = {
  open_start: 'Open start',
  open_finish: 'Open finish',
  negative_float: 'Negative float',
  constraint_conflict: 'Constraint conflict',
  orphan: 'Orphan',
};

export const IntegrityIssueList: React.FC<IntegrityIssueListProps> = ({ report }) => {
  const grouped = ISSUE_ORDER.map(type => ({
    type,
    label: ISSUE_LABEL[type],
    issues: report.issues.filter(i => i.type === type),
  })).filter(g => g.issues.length > 0);

  return (
    <section style={{ marginTop: spacing['16'] }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div>
          <Eyebrow>Logic quality</Eyebrow>
          <div style={{
            display: 'flex', gap: 12, alignItems: 'baseline', marginTop: 6,
          }}>
            <span style={{
              ...typography.eyebrow,
              fontSize: 11,
              color: STATUS_COLOR[report.status],
            }}>
              {STATUS_LABEL[report.status]}
            </span>
            {report.status !== 'unanalyzed' && (
              <span style={{
                fontFamily: typography.fontFamilyMono,
                fontSize: 22,
                fontWeight: 500,
                color: STATUS_COLOR[report.status],
              }}>
                {report.score}
              </span>
            )}
          </div>
        </div>
        <div style={{
          fontFamily: typography.fontFamily,
          fontSize: 12,
          color: colors.textSecondary,
        }}>
          {report.activityCount} activit{report.activityCount === 1 ? 'y' : 'ies'} analyzed
        </div>
      </header>

      <Hairline spacing="tight" />

      {report.status === 'unanalyzed' && (
        <p style={{
          fontFamily: typography.fontFamilySerif,
          fontSize: 14,
          color: colors.textSecondary,
          margin: 0,
        }}>
          Schedule has no predecessor or successor metadata yet. Add logic ties
          to enable the integrity check.
        </p>
      )}

      {grouped.length === 0 && report.status !== 'unanalyzed' && (
        <p style={{
          fontFamily: typography.fontFamilySerif,
          fontSize: 14,
          color: colors.textSecondary,
          margin: 0,
        }}>
          No structural issues detected.
        </p>
      )}

      {grouped.map(g => (
        <section key={g.type} style={{ marginBottom: spacing['16'] }}>
          <div style={{
            ...typography.eyebrow,
            fontSize: 10,
            color: colors.textTertiary,
            marginBottom: 6,
          }}>
            {g.label} <span style={{ color: colors.textSecondary }}>({g.issues.length})</span>
          </div>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {g.issues.map(issue => (
              <li key={issue.activityId + issue.type} style={{
                padding: '10px 0',
                borderBottom: `1px solid ${colors.borderSubtle}`,
              }}>
                <div style={{
                  fontFamily: typography.fontFamilySerif,
                  fontSize: 14,
                  color: colors.textPrimary,
                }}>
                  {issue.activityName}
                </div>
                <div style={{
                  fontFamily: typography.fontFamily,
                  fontSize: 12,
                  color: colors.textSecondary,
                  marginTop: 2,
                }}>
                  {issue.message}
                </div>
                <div style={{
                  fontFamily: typography.fontFamilySerif,
                  fontStyle: 'italic',
                  fontSize: 12,
                  color: colors.textTertiary,
                  marginTop: 2,
                }}>
                  {issue.suggestedFix}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </section>
  );
};
