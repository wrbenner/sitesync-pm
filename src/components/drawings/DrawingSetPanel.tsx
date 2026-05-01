/**
 * DrawingSetPanel — Slide-over panel for managing drawing sets.
 *
 * Drawing sets group drawings for issuance (IFC, issued-for-review, record sets).
 * This panel lets users:
 *  - View existing sets with their drawings
 *  - Create new sets (working, issued, record, IFC)
 *  - Add/remove drawings from a set
 *  - Issue a set (creates a transmittal)
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  X, Plus, FolderOpen, FileText, Send, Calendar,
  ChevronRight, ChevronDown, Check,
} from 'lucide-react';
import { colors, spacing, typography, borderRadius, shadows, transitions } from '../../styles/theme';
import { Btn } from '../Primitives';

// ── Types ──────────────────────────────────────────────────────────────────

export type SetType = 'working' | 'issued' | 'record' | 'ifc';

export interface DrawingSetItem {
  id: string;
  name: string;
  set_type: SetType;
  description?: string;
  drawing_ids: string[];
  issued_date?: string;
  issued_by?: string;
  created_at: string;
}

interface DrawingRef {
  id: string;
  setNumber: string;
  title: string;
  discipline: string;
  revision: string;
}

interface DrawingSetPanelProps {
  sets: DrawingSetItem[];
  availableDrawings: DrawingRef[];
  projectId: string;
  onClose: () => void;
  onCreateSet: (data: { name: string; set_type: SetType; description?: string; drawing_ids: string[] }) => void;
  onUpdateSet: (setId: string, data: { drawing_ids: string[] }) => void;
  onIssueSet: (setId: string) => void;
  onOpenDrawing: (drawingId: string) => void;
}

// ── Constants ──────────────────────────────────────────────────────────────

const SET_TYPE_CONFIG: Record<SetType, { label: string; color: string; bgColor: string }> = {
  working: { label: 'Working', color: colors.statusInfo, bgColor: 'rgba(21,101,192,0.08)' },
  issued: { label: 'Issued', color: colors.statusActive, bgColor: 'rgba(78,200,150,0.08)' },
  record: { label: 'Record', color: colors.statusPending, bgColor: 'rgba(251,146,60,0.08)' },
  ifc: { label: 'IFC', color: colors.statusReview, bgColor: 'rgba(124,58,237,0.08)' },
};

const PANEL_WIDTH = 440;

// ── Styles ─────────────────────────────────────────────────────────────────

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
    width: PANEL_WIDTH,
    maxWidth: '92vw',
    height: '100%',
    backgroundColor: colors.surfaceRaised,
    borderLeft: `1px solid ${colors.borderSubtle}`,
    boxShadow: '-8px 0 32px rgba(0,0,0,0.08)',
    display: 'flex',
    flexDirection: 'column' as const,
    animation: 'slideInRight 200ms ease-out',
    overflow: 'hidden',
  } as React.CSSProperties,
  header: {
    padding: '20px 24px 16px',
    borderBottom: `1px solid ${colors.borderSubtle}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexShrink: 0,
  } as React.CSSProperties,
  headerTitle: {
    ...typography.heading,
    color: colors.textPrimary,
    display: 'flex',
    alignItems: 'center',
    gap: spacing['2'],
  } as React.CSSProperties,
  closeBtn: {
    width: 28,
    height: 28,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: borderRadius.sm,
    color: colors.textTertiary,
    cursor: 'pointer',
    transition: `background-color ${transitions.fast}`,
  } as React.CSSProperties,
  content: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '16px 24px',
  } as React.CSSProperties,
  section: {
    marginBottom: 24,
  } as React.CSSProperties,
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  } as React.CSSProperties,
  sectionTitle: {
    ...typography.subheading,
    color: colors.textPrimary,
  } as React.CSSProperties,
  setCard: {
    padding: '14px 16px',
    backgroundColor: colors.surfacePage,
    border: `1px solid ${colors.borderSubtle}`,
    borderRadius: borderRadius.md,
    marginBottom: 10,
    cursor: 'pointer',
    transition: `border-color ${transitions.fast}, box-shadow ${transitions.fast}`,
  } as React.CSSProperties,
  setCardHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing['2'],
  } as React.CSSProperties,
  setName: {
    ...typography.subheading,
    color: colors.textPrimary,
    flex: 1,
  } as React.CSSProperties,
  typeBadge: (type: SetType) => ({
    ...typography.caption,
    padding: '2px 8px',
    borderRadius: borderRadius.sm,
    color: SET_TYPE_CONFIG[type].color,
    backgroundColor: SET_TYPE_CONFIG[type].bgColor,
    fontWeight: 600,
  }) as React.CSSProperties,
  drawingCount: {
    ...typography.caption,
    color: colors.textTertiary,
    marginTop: 4,
  } as React.CSSProperties,
  drawingRow: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing['2'],
    padding: '8px 12px',
    borderRadius: borderRadius.sm,
    cursor: 'pointer',
    transition: `background-color ${transitions.fast}`,
  } as React.CSSProperties,
  drawingNumber: {
    ...typography.caption,
    color: colors.primaryOrange,
    fontWeight: 600,
    minWidth: 60,
  } as React.CSSProperties,
  drawingTitle: {
    ...typography.caption,
    color: colors.textPrimary,
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  } as React.CSSProperties,
  emptyState: {
    textAlign: 'center' as const,
    padding: '32px 16px',
    color: colors.textTertiary,
  } as React.CSSProperties,
  // Create set modal
  modalOverlay: {
    position: 'absolute' as const,
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  } as React.CSSProperties,
  modalCard: {
    width: 380,
    maxWidth: '90%',
    backgroundColor: colors.surfaceRaised,
    borderRadius: borderRadius.lg,
    boxShadow: shadows.cardHover,
    padding: 24,
  } as React.CSSProperties,
  formGroup: {
    marginBottom: 16,
  } as React.CSSProperties,
  label: {
    ...typography.caption,
    color: colors.textSecondary,
    display: 'block',
    marginBottom: 6,
    fontWeight: 600,
  } as React.CSSProperties,
  input: {
    width: '100%',
    padding: '8px 12px',
    border: `1px solid ${colors.borderDefault}`,
    borderRadius: borderRadius.md,
    fontSize: 14,
    color: colors.textPrimary,
    backgroundColor: colors.surfacePage,
    outline: 'none',
    transition: `border-color ${transitions.fast}`,
    boxSizing: 'border-box' as const,
  } as React.CSSProperties,
  select: {
    width: '100%',
    padding: '8px 12px',
    border: `1px solid ${colors.borderDefault}`,
    borderRadius: borderRadius.md,
    fontSize: 14,
    color: colors.textPrimary,
    backgroundColor: colors.surfacePage,
    outline: 'none',
    boxSizing: 'border-box' as const,
  } as React.CSSProperties,
  checkboxRow: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing['2'],
    padding: '6px 0',
    cursor: 'pointer',
  } as React.CSSProperties,
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: borderRadius.sm,
    border: `1.5px solid ${colors.borderDefault}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    transition: `all ${transitions.fast}`,
  } as React.CSSProperties,
  checkboxChecked: {
    backgroundColor: colors.primaryOrange,
    borderColor: colors.primaryOrange,
  } as React.CSSProperties,
};

// ── Component ──────────────────────────────────────────────────────────────

export const DrawingSetPanel: React.FC<DrawingSetPanelProps> = ({
  sets,
  availableDrawings,
  projectId: _projectId,
  onClose,
  onCreateSet,
  onUpdateSet: _onUpdateSet,
  onIssueSet,
  onOpenDrawing,
}) => {
  const [expandedSetId, setExpandedSetId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Create set form state
  const [newSetName, setNewSetName] = useState('');
  const [newSetType, setNewSetType] = useState<SetType>('working');
  const [newSetDescription, setNewSetDescription] = useState('');
  const [selectedDrawingIds, setSelectedDrawingIds] = useState<Set<string>>(new Set());

  const toggleDrawing = useCallback((id: string) => {
    setSelectedDrawingIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleCreate = useCallback(() => {
    if (!newSetName.trim()) return;
    onCreateSet({
      name: newSetName.trim(),
      set_type: newSetType,
      description: newSetDescription.trim() || undefined,
      drawing_ids: Array.from(selectedDrawingIds),
    });
    setShowCreateModal(false);
    setNewSetName('');
    setNewSetType('working');
    setNewSetDescription('');
    setSelectedDrawingIds(new Set());
  }, [newSetName, newSetType, newSetDescription, selectedDrawingIds, onCreateSet]);

  // Group sets by type
  const groupedSets = useMemo(() => {
    const groups: Record<SetType, DrawingSetItem[]> = { working: [], issued: [], record: [], ifc: [] };
    for (const s of sets) {
      groups[s.set_type]?.push(s);
    }
    return groups;
  }, [sets]);

  // Quick lookup for drawings
  const drawingMap = useMemo(() => {
    const map = new Map<string, DrawingRef>();
    for (const d of availableDrawings) map.set(d.id, d);
    return map;
  }, [availableDrawings]);

  return (
    <div style={S.overlay}>
      <div style={S.backdrop} onClick={onClose} />
      <div style={S.panel}>
        {/* Header */}
        <div style={S.header}>
          <div style={S.headerTitle}>
            <FolderOpen size={18} color={colors.primaryOrange} />
            Drawing Sets
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
            <Btn
              size="sm"
              onClick={() => setShowCreateModal(true)}
              style={{ gap: 6, fontSize: 13, fontWeight: 600 }}
            >
              <Plus size={14} />
              New Set
            </Btn>
            <button
              style={S.closeBtn}
              onClick={onClose}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = colors.surfaceHover; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={S.content}>
          {sets.length === 0 ? (
            <div style={S.emptyState}>
              <FolderOpen size={40} color={colors.textTertiary} style={{ marginBottom: 12, opacity: 0.4 }} />
              <p style={{ ...typography.subheading, color: colors.textSecondary, marginBottom: 6 }}>
                No drawing sets yet
              </p>
              <p style={{ ...typography.caption, color: colors.textTertiary, marginBottom: 16 }}>
                Create a set to organize drawings for issuance, review, or record keeping.
              </p>
              <Btn size="sm" onClick={() => setShowCreateModal(true)}>
                <Plus size={14} /> Create First Set
              </Btn>
            </div>
          ) : (
            (Object.entries(groupedSets) as [SetType, DrawingSetItem[]][]).map(([type, typeSets]) => {
              if (typeSets.length === 0) return null;
              return (
                <div key={type} style={S.section}>
                  <div style={S.sectionHeader}>
                    <span style={S.sectionTitle}>
                      <span style={S.typeBadge(type)}>{SET_TYPE_CONFIG[type].label}</span>
                      {' '}{typeSets.length} set{typeSets.length !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {typeSets.map((set) => {
                    const isExpanded = expandedSetId === set.id;
                    return (
                      <div
                        key={set.id}
                        style={{
                          ...S.setCard,
                          borderColor: isExpanded ? colors.primaryOrange : colors.borderSubtle,
                        }}
                      >
                        <div
                          style={S.setCardHeader}
                          onClick={() => setExpandedSetId(isExpanded ? null : set.id)}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                            {isExpanded ? <ChevronDown size={14} color={colors.textTertiary} /> : <ChevronRight size={14} color={colors.textTertiary} />}
                            <span style={S.setName}>{set.name}</span>
                          </div>
                          <span style={S.drawingCount}>
                            {set.drawing_ids.length} sheet{set.drawing_ids.length !== 1 ? 's' : ''}
                          </span>
                          {set.set_type !== 'working' && !set.issued_date && (
                            <button
                              onClick={(e) => { e.stopPropagation(); onIssueSet(set.id); }}
                              title="Issue this set"
                              style={{
                                display: 'flex', alignItems: 'center', gap: 4,
                                padding: '4px 10px', fontSize: 12, fontWeight: 600,
                                border: `1px solid ${colors.primaryOrange}`,
                                borderRadius: borderRadius.sm,
                                backgroundColor: 'transparent',
                                color: colors.primaryOrange,
                                cursor: 'pointer',
                                transition: `all ${transitions.fast}`,
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = colors.primaryOrange;
                                e.currentTarget.style.color = '#fff';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'transparent';
                                e.currentTarget.style.color = colors.primaryOrange;
                              }}
                            >
                              <Send size={12} /> Issue
                            </button>
                          )}
                          {set.issued_date && (
                            <span style={{ ...typography.caption, color: colors.statusActive, display: 'flex', alignItems: 'center', gap: 4 }}>
                              <Calendar size={12} /> {new Date(set.issued_date).toLocaleDateString()}
                            </span>
                          )}
                        </div>

                        {isExpanded && (
                          <div style={{ marginTop: 10, borderTop: `1px solid ${colors.borderSubtle}`, paddingTop: 8 }}>
                            {set.description && (
                              <p style={{ ...typography.caption, color: colors.textTertiary, marginBottom: 8 }}>
                                {set.description}
                              </p>
                            )}
                            {set.drawing_ids.length === 0 ? (
                              <p style={{ ...typography.caption, color: colors.textTertiary, fontStyle: 'italic' }}>
                                No drawings in this set yet
                              </p>
                            ) : (
                              set.drawing_ids.map((dId) => {
                                const d = drawingMap.get(dId);
                                if (!d) return null;
                                return (
                                  <div
                                    key={dId}
                                    style={S.drawingRow}
                                    onClick={() => onOpenDrawing(dId)}
                                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = colors.surfaceHover; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                                  >
                                    <FileText size={14} color={colors.textTertiary} />
                                    <span style={S.drawingNumber}>{d.setNumber}</span>
                                    <span style={S.drawingTitle}>{d.title}</span>
                                    <span style={{ ...typography.caption, color: colors.textTertiary }}>
                                      Rev {d.revision}
                                    </span>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>

        {/* Create Set Modal */}
        {showCreateModal && (
          <div style={S.modalOverlay} onClick={() => setShowCreateModal(false)}>
            <div style={S.modalCard} onClick={(e) => e.stopPropagation()}>
              <h3 style={{ ...typography.heading, color: colors.textPrimary, marginBottom: 20 }}>
                Create Drawing Set
              </h3>

              <div style={S.formGroup}>
                <label style={S.label}>Set Name</label>
                <input
                  style={S.input}
                  value={newSetName}
                  onChange={(e) => setNewSetName(e.target.value)}
                  placeholder="e.g. IFC Set - Phase 1 Foundations"
                  autoFocus
                  onFocus={(e) => { e.currentTarget.style.borderColor = colors.primaryOrange; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = colors.borderDefault; }}
                />
              </div>

              <div style={S.formGroup}>
                <label style={S.label}>Set Type</label>
                <select
                  style={S.select}
                  value={newSetType}
                  onChange={(e) => setNewSetType(e.target.value as SetType)}
                >
                  <option value="working">Working</option>
                  <option value="issued">Issued for Review</option>
                  <option value="record">Record Set</option>
                  <option value="ifc">Issued for Construction (IFC)</option>
                </select>
              </div>

              <div style={S.formGroup}>
                <label style={S.label}>Description (optional)</label>
                <input
                  style={S.input}
                  value={newSetDescription}
                  onChange={(e) => setNewSetDescription(e.target.value)}
                  placeholder="Brief description of this set"
                />
              </div>

              <div style={S.formGroup}>
                <label style={S.label}>
                  Drawings ({selectedDrawingIds.size} selected)
                </label>
                <div style={{ maxHeight: 200, overflowY: 'auto', border: `1px solid ${colors.borderSubtle}`, borderRadius: borderRadius.md, padding: 8 }}>
                  {availableDrawings.map((d) => {
                    const isSelected = selectedDrawingIds.has(d.id);
                    return (
                      <div
                        key={d.id}
                        style={S.checkboxRow}
                        onClick={() => toggleDrawing(d.id)}
                      >
                        <div style={{
                          ...S.checkbox,
                          ...(isSelected ? S.checkboxChecked : {}),
                        }}>
                          {isSelected && <Check size={12} color="#fff" />}
                        </div>
                        <span style={{ ...typography.caption, color: colors.primaryOrange, fontWeight: 600, minWidth: 50 }}>
                          {d.setNumber}
                        </span>
                        <span style={{ ...typography.caption, color: colors.textPrimary, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {d.title}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: 'flex', gap: spacing['2'], justifyContent: 'flex-end', marginTop: 20 }}>
                <Btn
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </Btn>
                <Btn
                  size="sm"
                  onClick={handleCreate}
                  disabled={!newSetName.trim()}
                >
                  Create Set
                </Btn>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DrawingSetPanel;
