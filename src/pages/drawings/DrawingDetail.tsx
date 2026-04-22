import React, { useState } from 'react';
import {
  X, Upload, Eye, Sparkles, Clock, User, FileText, History,
  Link2, AlertTriangle, ChevronRight, MessageSquare, Check, Pencil,
} from 'lucide-react';
import { Btn } from '../../components/Primitives';
import { PermissionGate } from '../../components/auth/PermissionGate';
import { colors, spacing, typography, borderRadius, transitions } from '../../styles/theme';
import { DISCIPLINE_COLORS, DISCIPLINE_LABELS, STATUS_CONFIG } from './constants';
import type { DrawingRevision } from '../../types/api';
import type { DrawingClassification, DrawingDiscrepancy } from '../../types/ai';
import { formatRevDate } from './types';

// ─── Types ──────────────────────────────────────────────────────────────────

interface DrawingItem {
  id: string;
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

type DetailTab = 'overview' | 'revisions' | 'linked' | 'ai';

interface DrawingDetailProps {
  drawing: DrawingItem;
  revisionHistory: DrawingRevision[] | undefined;
  viewingRevisionNum: number | null;
  onClose: () => void;
  onOpenViewer: () => void;
  onUploadRevision: () => void;
  onViewRevision: (rev: DrawingRevision) => void;
  onCompareVersions: () => void;
  setViewingRevisionNum: (n: number | null) => void;
  classification?: DrawingClassification | null;
  classificationStatus?: string | null;
  discrepancies?: DrawingDiscrepancy[];
  onCreateRFI?: () => void;
  /**
   * Commit an edit to the drawing row. The parent handles persistence
   * (drawingService.updateDrawing) + refetch. Used by the inline-edit UI
   * on sheet number and title.
   */
  onFieldUpdate?: (drawingId: string, patch: { sheet_number?: string; title?: string }) => Promise<void>;
}

// ─── Styles (slide-over panel, 420px) ───────────────────────────────────────

const PANEL_WIDTH = 420;

const S = {
  overlay: {
    position: 'fixed' as const,
    inset: 0,
    zIndex: 150,
    display: 'flex',
    justifyContent: 'flex-end',
  } as React.CSSProperties,
  backdrop: {
    position: 'absolute' as const,
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.18)',
    backdropFilter: 'blur(2px)',
  } as React.CSSProperties,
  panel: {
    position: 'relative' as const,
    width: `${PANEL_WIDTH}px`,
    maxWidth: '90vw',
    height: '100%',
    backgroundColor: colors.surfaceRaised,
    borderLeft: `1px solid ${colors.borderSubtle}`,
    boxShadow: '-8px 0 32px rgba(0,0,0,0.08)',
    display: 'flex',
    flexDirection: 'column' as const,
    animation: 'slideInRight 200ms ease-out',
    overflow: 'hidden',
  } as React.CSSProperties,

  // Header
  header: {
    padding: '20px 24px 16px',
    borderBottom: `1px solid ${colors.borderSubtle}`,
    flexShrink: 0,
  } as React.CSSProperties,
  headerTop: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '12px',
  } as React.CSSProperties,
  closeBtn: {
    width: '28px',
    height: '28px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    color: colors.textTertiary,
    flexShrink: 0,
    transition: 'background-color 150ms ease-out',
  } as React.CSSProperties,
  sheetNum: {
    margin: 0,
    fontSize: '12px',
    color: colors.textTertiary,
    fontFamily: typography.fontFamilyMono,
    fontWeight: 500,
    marginBottom: '3px',
  } as React.CSSProperties,
  title: {
    margin: 0,
    fontSize: '16px',
    fontWeight: 700,
    color: colors.textPrimary,
    lineHeight: 1.3,
    letterSpacing: '-0.2px',
  } as React.CSSProperties,

  // Badges row
  badges: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginTop: '12px',
    flexWrap: 'wrap' as const,
  } as React.CSSProperties,
  disciplineBadge: (color: string) => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '2px 8px',
    borderRadius: '100px',
    backgroundColor: color + '10',
    color,
    fontSize: '10px',
    fontWeight: 600,
    textTransform: 'capitalize' as const,
  } as React.CSSProperties),
  statusBadge: (bg: string, color: string) => ({
    padding: '2px 8px',
    borderRadius: '100px',
    backgroundColor: bg,
    color,
    fontSize: '10px',
    fontWeight: 600,
  } as React.CSSProperties),
  revLabel: {
    fontSize: '11px',
    color: colors.textTertiary,
    fontFamily: typography.fontFamilyMono,
    fontWeight: 500,
  } as React.CSSProperties,

  // Actions row
  actions: {
    display: 'flex',
    gap: '8px',
    marginTop: '16px',
  } as React.CSSProperties,

  // Revision banner
  revBanner: {
    margin: '0 0 12px',
    padding: '8px 12px',
    backgroundColor: '#FEF3C7',
    border: '1px solid #FDE68A',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
  } as React.CSSProperties,
  revBannerText: {
    fontSize: '11px',
    color: '#92400E',
    fontWeight: 500,
  } as React.CSSProperties,
  revBannerBtn: {
    fontSize: '11px',
    color: '#D97706',
    fontWeight: 600,
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    fontFamily: typography.fontFamily,
  } as React.CSSProperties,

  // Tabs
  tabBar: {
    display: 'flex',
    borderBottom: `1px solid ${colors.borderSubtle}`,
    flexShrink: 0,
  } as React.CSSProperties,
  tab: (isActive: boolean) => ({
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '4px',
    padding: '10px 8px',
    border: 'none',
    cursor: 'pointer',
    backgroundColor: 'transparent',
    borderBottom: isActive ? `2px solid ${colors.primaryOrange}` : '2px solid transparent',
    color: isActive ? colors.primaryOrange : colors.textTertiary,
    fontSize: '11px',
    fontWeight: isActive ? 600 : 500,
    fontFamily: typography.fontFamily,
    transition: 'all 150ms ease-out',
  } as React.CSSProperties),
  tabBadge: (bg: string, color: string) => ({
    minWidth: '14px',
    height: '14px',
    borderRadius: '50%',
    backgroundColor: bg,
    color,
    fontSize: '8px',
    fontWeight: 700,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 3px',
  } as React.CSSProperties),

  // Tab content scroll area
  content: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '20px 24px',
  } as React.CSSProperties,

  // Metadata row
  metaRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '8px 0',
  } as React.CSSProperties,
  metaIcon: {
    width: '24px',
    height: '24px',
    borderRadius: '6px',
    backgroundColor: colors.surfaceInset,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: colors.textTertiary,
    flexShrink: 0,
  } as React.CSSProperties,
  metaLabel: {
    margin: 0,
    fontSize: '10px',
    color: colors.textTertiary,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.4px',
    fontWeight: 600,
  } as React.CSSProperties,
  metaValue: {
    margin: 0,
    fontSize: '13px',
    color: colors.textPrimary,
    fontWeight: 500,
    textTransform: 'capitalize' as const,
  } as React.CSSProperties,

  // Revision timeline
  timelineLine: {
    position: 'absolute' as const,
    left: '6px',
    top: '6px',
    bottom: '6px',
    width: '2px',
    backgroundColor: colors.borderSubtle,
  } as React.CSSProperties,
  timelineDot: (isCurrent: boolean) => ({
    position: 'absolute' as const,
    left: '-20px',
    top: '3px',
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    backgroundColor: isCurrent ? colors.primaryOrange : colors.surfaceRaised,
    border: `2px solid ${isCurrent ? colors.primaryOrange : colors.borderDefault}`,
    zIndex: 1,
  } as React.CSSProperties),
  timelineItem: (isCurrent: boolean) => ({
    position: 'relative' as const,
    padding: '8px 12px',
    borderRadius: '8px',
    backgroundColor: isCurrent ? colors.primaryOrange + '05' : 'transparent',
    border: isCurrent ? `1px solid ${colors.primaryOrange}15` : '1px solid transparent',
    marginBottom: '16px',
  } as React.CSSProperties),

  // Empty state
  empty: {
    textAlign: 'center' as const,
    padding: '40px 20px',
    color: colors.textTertiary,
  } as React.CSSProperties,

  // AI section
  aiSection: {
    marginBottom: '16px',
  } as React.CSSProperties,
  aiSectionLabel: {
    margin: 0,
    marginBottom: '8px',
    fontSize: '10px',
    fontWeight: 600,
    color: colors.textTertiary,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.4px',
  } as React.CSSProperties,
  aiCard: {
    padding: '12px',
    borderRadius: '8px',
    backgroundColor: colors.surfaceInset,
  } as React.CSSProperties,
  discrepancyCard: {
    padding: '10px 12px',
    borderRadius: '8px',
    border: `1px solid ${colors.borderSubtle}`,
    backgroundColor: colors.surfaceRaised,
    marginBottom: '8px',
  } as React.CSSProperties,
} as const;

const TABS: { key: DetailTab; label: string; icon: React.ReactNode }[] = [
  { key: 'overview', label: 'Overview', icon: <FileText size={12} /> },
  { key: 'revisions', label: 'Revisions', icon: <History size={12} /> },
  { key: 'linked', label: 'Linked', icon: <Link2 size={12} /> },
  { key: 'ai', label: 'AI', icon: <Sparkles size={12} /> },
];

// ─── Component ──────────────────────────────────────────────────────────────

export const DrawingDetail: React.FC<DrawingDetailProps> = ({
  drawing,
  revisionHistory,
  viewingRevisionNum,
  onClose,
  onOpenViewer,
  onUploadRevision,
  onViewRevision,
  onCompareVersions,
  setViewingRevisionNum,
  classification,
  classificationStatus,
  discrepancies = [],
  onCreateRFI,
  onFieldUpdate,
}) => {
  const [activeTab, setActiveTab] = useState<DetailTab>('overview');
  const discColor = DISCIPLINE_COLORS[drawing.discipline] || DISCIPLINE_COLORS.unclassified;
  const statusKey = drawing.status || 'current';
  const statusCfg = STATUS_CONFIG[statusKey] || STATUS_CONFIG.current;

  // Inline-edit state for sheet number + title. `editing` is the field
  // currently in edit mode; `editValue` holds the draft. A `saving` flag
  // disables controls during the async commit.
  const [editing, setEditing] = useState<'sheet_number' | 'title' | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);

  const startEdit = (field: 'sheet_number' | 'title') => {
    if (!onFieldUpdate) return;
    setEditing(field);
    setEditValue(field === 'sheet_number' ? drawing.setNumber : drawing.title);
  };
  const cancelEdit = () => { setEditing(null); setEditValue(''); };
  const commitEdit = async () => {
    if (!onFieldUpdate || !editing) return;
    const value = editValue.trim();
    if (!value) { cancelEdit(); return; }
    const current = editing === 'sheet_number' ? drawing.setNumber : drawing.title;
    if (value === current) { cancelEdit(); return; }
    setSaving(true);
    try {
      await onFieldUpdate(drawing.id, { [editing]: value } as { sheet_number?: string; title?: string });
      cancelEdit();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={S.overlay}>
      {/* Backdrop click to close */}
      <div style={S.backdrop} onClick={onClose} />

      {/* Panel */}
      <div style={S.panel} role="dialog" aria-label={`${drawing.setNumber} details`}>
        <style>{`@keyframes slideInRight{from{transform:translateX(100%)}to{transform:translateX(0)}}`}</style>

        {/* Header */}
        <div style={S.header}>
          {viewingRevisionNum !== null && (
            <div style={S.revBanner}>
              <span style={S.revBannerText}>Viewing Revision {viewingRevisionNum}</span>
              <button onClick={() => setViewingRevisionNum(null)} style={S.revBannerBtn}>Back to Current</button>
            </div>
          )}

          <div style={S.headerTop}>
            <div style={{ flex: 1, minWidth: 0 }}>
              {/* Inline-edit sheet number */}
              {editing === 'sheet_number' ? (
                <input
                  autoFocus
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={commitEdit}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); commitEdit(); }
                    if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
                  }}
                  disabled={saving}
                  style={{
                    ...S.sheetNum,
                    width: '100%',
                    border: `1px solid ${colors.primaryOrange}`,
                    borderRadius: 6,
                    padding: '4px 8px',
                    outline: 'none',
                    background: colors.surfaceRaised,
                  }}
                />
              ) : (
                <p
                  style={{
                    ...S.sheetNum,
                    cursor: onFieldUpdate ? 'text' : 'default',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                  title={onFieldUpdate ? 'Click to edit sheet number' : undefined}
                  onClick={() => onFieldUpdate && startEdit('sheet_number')}
                >
                  {drawing.setNumber}
                  {onFieldUpdate && <Pencil size={11} style={{ opacity: 0.4 }} />}
                </p>
              )}

              {/* Inline-edit title */}
              {editing === 'title' ? (
                <input
                  autoFocus
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={commitEdit}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); commitEdit(); }
                    if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
                  }}
                  disabled={saving}
                  style={{
                    ...S.title,
                    width: '100%',
                    marginTop: 4,
                    border: `1px solid ${colors.primaryOrange}`,
                    borderRadius: 6,
                    padding: '4px 8px',
                    outline: 'none',
                    background: colors.surfaceRaised,
                  }}
                />
              ) : (
                <h3
                  style={{
                    ...S.title,
                    cursor: onFieldUpdate ? 'text' : 'default',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                  title={onFieldUpdate ? 'Click to edit title' : undefined}
                  onClick={() => onFieldUpdate && startEdit('title')}
                >
                  {drawing.title}
                  {onFieldUpdate && <Pencil size={13} style={{ opacity: 0.4 }} />}
                </h3>
              )}
            </div>
            <button
              aria-label="Close detail panel"
              onClick={onClose}
              style={S.closeBtn}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = colors.surfaceInset; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              <X size={14} />
            </button>
          </div>

          {/* Needs-review warning — prompts the user to verify & fix */}
          {(classificationStatus === 'needs_review' ||
            (drawing as unknown as { processing_status?: string }).processing_status === 'needs_review') && (
            <div
              style={{
                marginTop: spacing['2'],
                padding: `${spacing['2']} ${spacing['3']}`,
                background: '#FEF3C7',
                border: '1px solid #FCD34D',
                borderRadius: borderRadius.base,
                display: 'flex',
                alignItems: 'center',
                gap: spacing['2'],
                fontSize: typography.fontSize.sm,
                color: '#92400E',
              }}
            >
              <AlertTriangle size={14} />
              <span style={{ flex: 1 }}>
                Title couldn't be extracted automatically. Click the sheet number or title above to edit.
              </span>
              {saving && <Check size={14} style={{ opacity: 0.5 }} />}
            </div>
          )}

          {/* Badges */}
          <div style={S.badges}>
            <span style={S.disciplineBadge(discColor)}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: discColor }} />
              {DISCIPLINE_LABELS[drawing.discipline] || drawing.discipline?.replace(/_/g, ' ') || 'Unclassified'}
            </span>
            <span style={S.statusBadge(statusCfg.bg, statusCfg.color)}>
              {statusCfg.label}
            </span>
            <span style={S.revLabel}>
              Rev {drawing.currentRevision?.revision_number ?? drawing.revision}
            </span>
          </div>

          {/* Action buttons */}
          <div style={S.actions}>
            <Btn variant="primary" size="sm" icon={<Eye size={13} />} onClick={onOpenViewer} fullWidth>
              Open Viewer
            </Btn>
            <PermissionGate permission="drawings.upload">
              <Btn variant="secondary" size="sm" icon={<Upload size={13} />} onClick={onUploadRevision}>
                New Rev
              </Btn>
            </PermissionGate>
          </div>
        </div>

        {/* Tabs */}
        <div style={S.tabBar}>
          {TABS.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={S.tab(activeTab === tab.key)}>
              {tab.icon}
              {tab.label}
              {tab.key === 'revisions' && revisionHistory && revisionHistory.length > 0 && (
                <span style={S.tabBadge(activeTab === tab.key ? colors.primaryOrange + '20' : colors.surfaceInset, activeTab === tab.key ? colors.primaryOrange : colors.textTertiary)}>
                  {revisionHistory.length}
                </span>
              )}
              {tab.key === 'ai' && discrepancies.length > 0 && (
                <span style={S.tabBadge('#FEE2E2', '#DC2626')}>
                  {discrepancies.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div style={S.content}>
          {activeTab === 'overview' && <OverviewTab drawing={drawing} discColor={discColor} />}
          {activeTab === 'revisions' && (
            <RevisionsTab
              revisionHistory={revisionHistory}
              onViewRevision={onViewRevision}
              onCompareVersions={onCompareVersions}
            />
          )}
          {activeTab === 'linked' && <LinkedTab />}
          {activeTab === 'ai' && (
            <AITab
              classification={classification}
              classificationStatus={classificationStatus}
              discrepancies={discrepancies}
              onCreateRFI={onCreateRFI}
            />
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Tab: Overview ──────────────────────────────────────────────────────────

const OverviewTab: React.FC<{ drawing: DrawingItem; discColor: string }> = ({ drawing, discColor }) => {
  const metadata = [
    { label: 'Sheet Number', value: drawing.setNumber, icon: <FileText size={12} /> },
    { label: 'Discipline', value: DISCIPLINE_LABELS[drawing.discipline] || drawing.discipline?.replace(/_/g, ' ') || 'Unclassified', icon: <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: discColor, display: 'inline-block' }} /> },
    { label: 'Current Revision', value: `Rev ${drawing.currentRevision?.revision_number ?? drawing.revision}`, icon: <History size={12} /> },
    { label: 'Issued Date', value: drawing.currentRevision?.issued_date ? formatRevDate(drawing.currentRevision.issued_date) : drawing.date || '—', icon: <Clock size={12} /> },
    { label: 'Issued By', value: drawing.currentRevision?.issued_by || '—', icon: <User size={12} /> },
    { label: 'Sheet Count', value: drawing.sheetCount ? String(drawing.sheetCount) : '1', icon: <FileText size={12} /> },
  ];

  return (
    <div>
      {metadata.map(({ label, value, icon }) => (
        <div key={label} style={S.metaRow}>
          <div style={S.metaIcon}>{icon}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={S.metaLabel}>{label}</p>
            <p style={S.metaValue}>{value}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

// ─── Tab: Revisions ─────────────────────────────────────────────────────────

const RevisionsTab: React.FC<{
  revisionHistory: DrawingRevision[] | undefined;
  onViewRevision: (rev: DrawingRevision) => void;
  onCompareVersions: () => void;
}> = ({ revisionHistory, onViewRevision }) => {
  if (!revisionHistory || revisionHistory.length === 0) {
    return (
      <div style={S.empty}>
        <History size={20} style={{ marginBottom: '8px', opacity: 0.4 }} />
        <p style={{ margin: 0, fontSize: '13px' }}>No revision history yet</p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ position: 'relative', paddingLeft: '24px' }}>
        <div style={S.timelineLine} />
        {revisionHistory.map((rev, idx) => {
          const isCurrent = !rev.superseded_at;
          return (
            <div key={rev.id} style={S.timelineItem(isCurrent)}>
              <div style={S.timelineDot(isCurrent)} />
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: colors.textPrimary }}>
                  Rev {rev.revision_number}
                </span>
                {isCurrent && (
                  <span style={{
                    fontSize: '9px', fontWeight: 700, textTransform: 'uppercase',
                    padding: '1px 6px', borderRadius: '100px',
                    backgroundColor: colors.primaryOrange + '12', color: colors.primaryOrange,
                  }}>Current</span>
                )}
              </div>
              <p style={{ margin: 0, fontSize: '11px', color: colors.textTertiary }}>
                {formatRevDate(rev.issued_date)}{rev.issued_by ? ` · ${rev.issued_by}` : ''}
              </p>
              {rev.change_description && (
                <p style={{ margin: '4px 0 0', fontSize: '11px', color: colors.textSecondary, lineHeight: 1.4 }}>
                  {rev.change_description}
                </p>
              )}
              <button
                onClick={() => onViewRevision(rev)}
                style={{
                  marginTop: '6px', display: 'flex', alignItems: 'center', gap: '3px',
                  fontSize: '11px', color: colors.primaryOrange,
                  background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                  fontFamily: typography.fontFamily, fontWeight: 500,
                }}
              >
                <Eye size={10} /> View
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── Tab: Linked Items ──────────────────────────────────────────────────────

const LinkedTab: React.FC = () => (
  <div style={S.empty}>
    <Link2 size={20} style={{ marginBottom: '8px', opacity: 0.4 }} />
    <p style={{ margin: 0, fontSize: '13px', fontWeight: 500, color: colors.textPrimary, marginBottom: '4px' }}>
      No linked items yet
    </p>
    <p style={{ margin: 0, fontSize: '11px', color: colors.textTertiary, maxWidth: '240px', marginLeft: 'auto', marginRight: 'auto' }}>
      Create markups on this drawing to link RFIs, punch items, and submittals.
    </p>
  </div>
);

// ─── Tab: AI ────────────────────────────────────────────────────────────────

const AITab: React.FC<{
  classification?: DrawingClassification | null;
  classificationStatus?: string | null;
  discrepancies?: DrawingDiscrepancy[];
  onCreateRFI?: () => void;
}> = ({ classification, classificationStatus, discrepancies = [], onCreateRFI }) => {
  const isProcessing = classificationStatus === 'processing' || classificationStatus === 'pending';
  const hasFailed = classificationStatus === 'failed';

  return (
    <div>
      {/* Classification */}
      <div style={S.aiSection}>
        <p style={S.aiSectionLabel}>AI Classification</p>

        {isProcessing && (
          <div style={{ ...S.aiCard, display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: colors.primaryOrange + '06', border: `1px solid ${colors.primaryOrange}15` }}>
            <Sparkles size={13} color={colors.primaryOrange} style={{ animation: 'pulse 2s ease-in-out infinite' }} />
            <span style={{ fontSize: '12px', color: colors.textSecondary }}>Classifying...</span>
          </div>
        )}

        {hasFailed && (
          <div style={{ ...S.aiCard, backgroundColor: '#FEF2F2', border: '1px solid #FECACA' }}>
            <p style={{ margin: 0, fontSize: '12px', color: '#991B1B' }}>Classification failed. Re-upload to retry.</p>
          </div>
        )}

        {!isProcessing && !hasFailed && classification && (
          <div style={S.aiCard}>
            {classification.discipline && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <span style={{ fontSize: '11px', color: colors.textTertiary, width: '60px' }}>Discipline</span>
                <span style={{ fontSize: '11px', fontWeight: 600, color: DISCIPLINE_COLORS[classification.discipline] || colors.textPrimary, textTransform: 'capitalize' }}>
                  {classification.discipline.replace(/_/g, ' ')}
                </span>
              </div>
            )}
            {classification.plan_type && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <span style={{ fontSize: '11px', color: colors.textTertiary, width: '60px' }}>Type</span>
                <span style={{ fontSize: '11px', fontWeight: 500, color: colors.textPrimary, textTransform: 'capitalize' }}>
                  {classification.plan_type.replace(/_/g, ' ')}
                </span>
              </div>
            )}
            {classification.scale_text && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <span style={{ fontSize: '11px', color: colors.textTertiary, width: '60px' }}>Scale</span>
                <span style={{ fontSize: '11px', fontWeight: 500, color: colors.textPrimary }}>{classification.scale_text}</span>
              </div>
            )}
            {classification.confidence != null && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '11px', color: colors.textTertiary, width: '60px' }}>Confidence</span>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ flex: 1, height: '3px', borderRadius: '2px', backgroundColor: colors.borderSubtle, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${Math.round(classification.confidence * 100)}%`,
                      backgroundColor: classification.confidence > 0.8 ? '#10B981' : classification.confidence > 0.5 ? '#F59E0B' : '#EF4444',
                      borderRadius: '2px',
                    }} />
                  </div>
                  <span style={{ fontSize: '10px', fontWeight: 600, color: colors.textSecondary }}>
                    {Math.round(classification.confidence * 100)}%
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {!isProcessing && !hasFailed && !classification && (
          <p style={{ margin: 0, fontSize: '11px', color: colors.textTertiary }}>No classification data.</p>
        )}
      </div>

      {/* Discrepancies */}
      {discrepancies.length > 0 && (
        <div style={S.aiSection}>
          <p style={S.aiSectionLabel}>Discrepancies ({discrepancies.length})</p>
          {discrepancies.slice(0, 5).map((d, i) => (
            <div key={d.id || i} style={S.discrepancyCard}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <AlertTriangle
                  size={11}
                  color={d.severity === 'high' ? '#EF4444' : d.severity === 'medium' ? '#F59E0B' : '#6B7280'}
                  style={{ marginTop: '2px', flexShrink: 0 }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: '11px', color: colors.textPrimary, fontWeight: 500, lineHeight: 1.4 }}>
                    {d.description || 'Coordination conflict detected'}
                  </p>
                  {d.location && (
                    <p style={{ margin: '2px 0 0', fontSize: '10px', color: colors.textTertiary }}>at {d.location}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
          {onCreateRFI && (
            <button
              onClick={onCreateRFI}
              style={{
                marginTop: '8px', display: 'flex', alignItems: 'center', gap: '4px',
                fontSize: '11px', color: colors.primaryOrange,
                background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                fontFamily: typography.fontFamily, fontWeight: 500,
              }}
            >
              <MessageSquare size={10} /> Create RFI from discrepancy
            </button>
          )}
        </div>
      )}
    </div>
  );
};
