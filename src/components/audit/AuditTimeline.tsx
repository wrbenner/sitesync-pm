// ── AuditTimeline ──────────────────────────────────────────────────────────
// Chronological timeline of every state change for an entity. Each row is
// rendered as a card with: who, what action, when, what changed (diff
// of changed_fields). Gaps in the hash chain are highlighted inline with
// a red rail so reviewers can see exactly which rows lost integrity.
//
// Pagination: 50 events/page. The viewer fetches one page at a time.
// Virtualization (windowing) is overkill at this scale and would
// complicate the PDF export; pagination is the right primitive.

import React from 'react';
import { Clock, ArrowRight, AlertTriangle } from 'lucide-react';
import { colors, typography, spacing } from '../../styles/theme';
import type { AuditLogRow, ChainGap } from '../../lib/audit/hashChainVerifier';

interface AuditTimelineProps {
  rows: ReadonlyArray<AuditLogRow>;
  /** Set of row_ids flagged as part of a chain gap; rendered with a red rail. */
  gaps?: ReadonlyArray<ChainGap>;
  /** Pagination state; the parent component controls page navigation. */
  page: number;
  pageSize?: number;
  onChangePage: (next: number) => void;
}

function fmtTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString([], {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function actionLabel(action: string): string {
  const map: Record<string, string> = {
    create: 'Created',
    update: 'Updated',
    delete: 'Deleted',
    submit: 'Submitted',
    approve: 'Approved',
    reject: 'Rejected',
    close: 'Closed',
    status_change: 'Status changed',
    comment: 'Commented',
    mention: 'Mentioned',
    attach: 'Attached file',
  };
  return map[action] ?? action;
}

export const AuditTimeline: React.FC<AuditTimelineProps> = ({
  rows,
  gaps,
  page,
  pageSize = 50,
  onChangePage,
}) => {
  const gapIds = new Set((gaps ?? []).map((g) => g.row_id));
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const start = page * pageSize;
  const visible = rows.slice(start, start + pageSize);

  if (rows.length === 0) {
    return (
      <p style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, fontStyle: 'italic' }}>
        No audit events yet for this entity.
      </p>
    );
  }

  return (
    <div>
      <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: spacing['2'] }}>
        {visible.map((row) => {
          const inGap = gapIds.has(row.id);
          return (
            <li
              key={row.id}
              style={{
                display: 'flex',
                gap: 10,
                padding: spacing['2'],
                borderLeft: `3px solid ${inGap ? colors.statusCritical : colors.borderSubtle}`,
                background: inGap ? colors.statusCriticalSubtle : 'transparent',
                borderRadius: 4,
              }}
            >
              <Clock size={12} style={{ color: colors.textTertiary, marginTop: 2, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold }}>
                    {actionLabel(row.action)}
                  </span>
                  <span style={{ fontSize: typography.fontSize.label, color: colors.textSecondary }}>
                    by {row.user_name ?? row.user_email ?? 'system'}
                  </span>
                  <span style={{ fontSize: typography.fontSize.label, color: colors.textTertiary }}>
                    {fmtTimestamp(row.created_at)}
                  </span>
                  {inGap && (
                    <span
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 3,
                        fontSize: typography.fontSize.label,
                        fontWeight: typography.fontWeight.semibold,
                        color: colors.statusCritical,
                      }}
                    >
                      <AlertTriangle size={11} />
                      Chain gap
                    </span>
                  )}
                </div>
                {row.changed_fields && row.changed_fields.length > 0 && (
                  <ChangeDiff
                    fields={row.changed_fields}
                    before={row.before_state}
                    after={row.after_state}
                  />
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {totalPages > 1 && (
        <div
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginTop: spacing['3'],
            fontSize: typography.fontSize.label,
            color: colors.textSecondary,
          }}
        >
          <button
            onClick={() => onChangePage(Math.max(0, page - 1))}
            disabled={page === 0}
            style={pageBtn}
          >
            ← Previous
          </button>
          <span>
            Page {page + 1} of {totalPages} · {rows.length} events
          </span>
          <button
            onClick={() => onChangePage(Math.min(totalPages - 1, page + 1))}
            disabled={page >= totalPages - 1}
            style={pageBtn}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
};

interface ChangeDiffProps {
  fields: ReadonlyArray<string>;
  before: unknown;
  after: unknown;
}

const ChangeDiff: React.FC<ChangeDiffProps> = ({ fields, before, after }) => {
  const beforeObj = (before ?? {}) as Record<string, unknown>;
  const afterObj = (after ?? {}) as Record<string, unknown>;

  return (
    <ul style={{ margin: '6px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 2 }}>
      {fields.slice(0, 6).map((f) => (
        <li key={f} style={{ fontSize: typography.fontSize.label, color: colors.textSecondary }}>
          <span style={{ fontFamily: 'monospace', color: colors.textPrimary }}>{f}</span>
          <span style={{ margin: '0 6px' }}>
            <code style={{ color: colors.statusCritical }}>{stringify(beforeObj[f])}</code>
            <ArrowRight size={9} style={{ margin: '0 4px', color: colors.textTertiary, verticalAlign: 'middle' }} />
            <code style={{ color: colors.statusActive }}>{stringify(afterObj[f])}</code>
          </span>
        </li>
      ))}
      {fields.length > 6 && (
        <li style={{ fontSize: typography.fontSize.label, color: colors.textTertiary, fontStyle: 'italic' }}>
          + {fields.length - 6} more field{fields.length - 6 === 1 ? '' : 's'}
        </li>
      )}
    </ul>
  );
};

function stringify(v: unknown): string {
  if (v == null) return '∅';
  if (typeof v === 'string') return v.length > 40 ? `${v.slice(0, 40)}…` : v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return JSON.stringify(v).slice(0, 60);
}

const pageBtn: React.CSSProperties = {
  padding: '4px 10px',
  border: `1px solid ${colors.border}`,
  borderRadius: 6,
  background: 'transparent',
  cursor: 'pointer',
  fontSize: typography.fontSize.label,
  color: colors.textSecondary,
};

export default AuditTimeline;
