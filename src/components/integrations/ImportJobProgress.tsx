/**
 * ImportJobProgress — live progress bar for an in-flight or completed
 * import_jobs row. The admin Procore-import page polls this.
 */

import React from 'react';
import { Eyebrow } from '../atoms';
import { colors, typography } from '../../styles/theme';

export interface ImportJobRow {
  id: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'partial';
  total_count: number;
  processed_count: number;
  error_log?: Array<{ project_id?: string; entity?: string; error?: string }>;
  started_at?: string;
  completed_at?: string | null;
}

interface ImportJobProgressProps {
  job: ImportJobRow;
}

export const ImportJobProgress: React.FC<ImportJobProgressProps> = ({ job }) => {
  const pct =
    job.total_count > 0
      ? Math.min(100, Math.round((job.processed_count / job.total_count) * 100))
      : job.status === 'succeeded'
        ? 100
        : 0;
  return (
    <div style={{ padding: '20px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Eyebrow>Job · {job.id.slice(0, 8)}</Eyebrow>
        <span
          style={{
            fontFamily: typography.fontFamily,
            fontSize: 12,
            textTransform: 'uppercase',
            letterSpacing: 0.6,
            color: statusColor(job.status),
          }}
        >
          {job.status}
        </span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        style={{
          marginTop: 12,
          height: 4,
          background: 'var(--hairline)',
          position: 'relative',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            background: colors.primaryOrange,
            transition: 'width 240ms ease',
          }}
        />
      </div>
      <div
        style={{
          marginTop: 8,
          fontFamily: typography.fontFamily,
          fontSize: 12,
          color: colors.textTertiary,
        }}
      >
        {job.processed_count} of {job.total_count || '—'} entities processed
      </div>
      {job.error_log && job.error_log.length > 0 && (
        <details style={{ marginTop: 12 }}>
          <summary
            style={{
              fontFamily: typography.fontFamily,
              fontSize: 12,
              color: colors.statusReview,
              cursor: 'pointer',
            }}
          >
            {job.error_log.length} errors
          </summary>
          <ul style={{ marginTop: 8, paddingLeft: 20, fontSize: 12 }}>
            {job.error_log.slice(0, 20).map((e, i) => (
              <li key={i} style={{ color: colors.textSecondary, fontFamily: typography.fontFamily }}>
                {e.project_id ?? '?'} · {e.entity ?? '?'} · {e.error ?? ''}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
};

function statusColor(s: ImportJobRow['status']): string {
  if (s === 'succeeded') return colors.statusActive;
  if (s === 'failed') return colors.statusCritical;
  if (s === 'running') return colors.primaryOrange;
  return colors.textTertiary;
}
