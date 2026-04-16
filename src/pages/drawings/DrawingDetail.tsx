import React from 'react';
import { Upload, X } from 'lucide-react';
import { Card, Btn, Tag, useToast } from '../../components/Primitives';
import { PermissionGate } from '../../components/auth/PermissionGate';
import { colors, spacing, typography, borderRadius, transitions } from '../../styles/theme';
import type { DrawingRevision } from '../../types/api';
import { formatRevDate } from './types';

interface DrawingItem {
  id: number;
  title: string;
  setNumber: string;
  discipline: string;
  disciplineColor?: string;
  revision: string;
  date: string;
  status?: string;
  sheetCount?: number;
  currentRevision?: { revision_number: number; issued_date: string | null; issued_by?: string };
  revisions: DrawingRevision[];
}

interface DrawingDetailProps {
  drawing: DrawingItem;
  revisionHistory: DrawingRevision[] | undefined;
  viewingRevisionNum: number | null;
  onClose: () => void;
  onOpenViewer: () => void;
  onAiScan: () => void;
  onUploadRevision: () => void;
  onViewRevision: (rev: DrawingRevision) => void;
  onCompareVersions: () => void;
  setViewingRevisionNum: (n: number | null) => void;
}

export const DrawingDetail: React.FC<DrawingDetailProps> = ({
  drawing,
  revisionHistory,
  viewingRevisionNum,
  onClose,
  onOpenViewer,
  onAiScan,
  onUploadRevision,
  onViewRevision,
  onCompareVersions,
  setViewingRevisionNum,
}) => {
  const { addToast } = useToast();
  void addToast; // suppress unused warning — available if needed

  return (
    <div style={{ position: 'sticky', top: spacing.xl, height: 'fit-content' }}>
      <Card padding={spacing.xl}>
        {viewingRevisionNum !== null && (
          <div style={{ marginBottom: spacing.xl, padding: `${spacing.sm} ${spacing.md}`, backgroundColor: colors.statusPendingSubtle, border: `1px solid ${colors.statusPending}`, borderRadius: borderRadius.base, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }}>
            <span style={{ fontSize: typography.fontSize.sm, color: '#92400E' }}>Viewing Revision {viewingRevisionNum} — not the current version</span>
            <button onClick={() => setViewingRevisionNum(null)} style={{ fontSize: typography.fontSize.sm, color: '#D97706', fontWeight: typography.fontWeight.semibold, border: 'none', background: 'none', cursor: 'pointer', padding: 0, fontFamily: typography.fontFamily, whiteSpace: 'nowrap' }}>
              Back to Current
            </button>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.xl }}>
          <div>
            <p style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, margin: 0, marginBottom: spacing.xs }}>{drawing.setNumber}</p>
            <h3 style={{ fontSize: typography.fontSize['2xl'], fontWeight: typography.fontWeight.bold, color: colors.textPrimary, margin: 0 }}>{drawing.title}</h3>
          </div>
          <button
            aria-label="Close drawing detail panel"
            onClick={onClose}
            style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent', border: 'none', borderRadius: borderRadius.md, cursor: 'pointer', color: colors.textTertiary, transition: `background-color ${transitions.quick}`, flexShrink: 0 }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = colors.surfaceFlat; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'; }}
          >
            <X size={16} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.xl, marginBottom: spacing.xl }}>
          {[
            { label: 'Discipline', value: drawing.discipline },
            { label: 'Revision', value: drawing.revision },
            { label: 'Date', value: drawing.date },
            { label: 'Sheets', value: String(drawing.sheetCount ?? '—') },
          ].map(({ label, value }) => (
            <div key={label}>
              <p style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary, margin: 0, marginBottom: spacing.xs }}>{label}</p>
              <p style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary, margin: 0 }}>{value}</p>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
          <Btn variant="primary" size="md" fullWidth onClick={onOpenViewer}>Open Viewer</Btn>
          <Btn variant="secondary" size="md" fullWidth onClick={onAiScan}>AI Scan</Btn>
          <PermissionGate permission="drawings.upload">
            <Btn variant="secondary" size="md" fullWidth icon={<Upload size={16} />} onClick={onUploadRevision}>
              Upload Revision
            </Btn>
          </PermissionGate>
        </div>

        {revisionHistory && revisionHistory.length > 0 && (
          <div style={{ marginTop: spacing.xl, borderTop: `1px solid ${colors.border}`, paddingTop: spacing.xl }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md }}>
              <p style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0 }}>Revision History</p>
              <button
                onClick={onCompareVersions}
                disabled={revisionHistory.length < 2}
                style={{ fontSize: typography.fontSize.caption, color: revisionHistory.length >= 2 ? colors.primaryOrange : colors.textTertiary, border: `1px solid ${revisionHistory.length >= 2 ? `${colors.primaryOrange}40` : colors.border}`, borderRadius: borderRadius.base, backgroundColor: 'transparent', cursor: revisionHistory.length >= 2 ? 'pointer' : 'default', padding: '3px 8px', fontFamily: typography.fontFamily }}
                onMouseEnter={(e) => { if (revisionHistory.length >= 2) e.currentTarget.style.backgroundColor = `${colors.primaryOrange}10`; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                Compare Versions
              </button>
            </div>
            <div aria-label="Revision history" role="list">
              {revisionHistory.map((rev) => {
                const isCurrent = !rev.superseded_at;
                return (
                  <div
                    key={rev.id}
                    role="listitem"
                    aria-label={`Revision ${rev.revision_number}`}
                    style={{ borderLeft: `2px solid ${isCurrent ? colors.statusActive : '#E5E7EB'}`, paddingLeft: 16, marginBottom: 12, display: 'flex', alignItems: 'flex-start', gap: spacing.sm }}
                  >
                    <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: isCurrent ? colors.statusActive : '#9CA3AF', flexShrink: 0, marginTop: 4 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, marginBottom: 2, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>Rev {rev.revision_number}</span>
                        {isCurrent && <Tag label="Current" color={colors.statusActive} backgroundColor={`${colors.statusActive}18`} />}
                      </div>
                      <p style={{ margin: 0, fontSize: typography.fontSize.caption, color: colors.gray600 }}>
                        {formatRevDate(rev.issued_date)}{rev.issued_by ? ` · ${rev.issued_by}` : ''}
                      </p>
                      {rev.change_description && (
                        <p style={{ margin: 0, marginTop: 2, fontSize: typography.fontSize.caption, color: colors.gray600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rev.change_description}</p>
                      )}
                      <button
                        aria-label={`View revision ${rev.revision_number} of ${drawing.title}`}
                        onClick={() => onViewRevision(rev)}
                        style={{ marginTop: spacing['1'], fontSize: typography.fontSize.caption, color: colors.primaryOrange, background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: typography.fontFamily, fontWeight: typography.fontWeight.medium, textAlign: 'left' }}
                      >
                        View This Revision
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};
