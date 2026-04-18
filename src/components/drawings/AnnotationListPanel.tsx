import React, { useMemo, useState } from 'react';
import { ChevronRight, Trash2, FileText, Link as LinkIcon } from 'lucide-react';
import { colors, spacing, borderRadius, shadows } from '../../styles/theme';
import type { AnnotationShape } from './AnnotationHistory';

interface AnnotationListPanelProps {
  open: boolean;
  annotations: AnnotationShape[];
  selectedId?: string | null;
  onClose: () => void;
  onSelect: (id: string) => void;
  onDelete?: (id: string) => void;
  loading?: boolean;
  error?: string | null;
}

type FilterType = 'all' | AnnotationShape['type'];

const TYPE_LABELS: Record<AnnotationShape['type'], string> = {
  rectangle: 'Rectangle',
  text: 'Text',
  polygon: 'Polygon',
  pin: 'Pin',
  measure: 'Measure',
  highlight: 'Highlight',
  draw: 'Draw',
};

export const AnnotationListPanel: React.FC<AnnotationListPanelProps> = ({
  open,
  annotations,
  selectedId,
  onClose,
  onSelect,
  onDelete,
  loading = false,
  error = null,
}) => {
  const [filterType, setFilterType] = useState<FilterType>('all');

  const filtered = useMemo(() => {
    if (filterType === 'all') return annotations;
    return annotations.filter((a) => a.type === filterType);
  }, [annotations, filterType]);

  const grouped = useMemo(() => {
    const map = new Map<number, AnnotationShape[]>();
    filtered.forEach((a) => {
      const arr = map.get(a.pageNumber) || [];
      arr.push(a);
      map.set(a.pageNumber, arr);
    });
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  }, [filtered]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-label="Annotations list"
      style={{ position: 'fixed', inset: 0, zIndex: 40 }}
    >
      <div
        onClick={onClose}
        aria-hidden="true"
        style={{ position: 'absolute', inset: 0, backgroundColor: colors.overlayBackdrop }}
      />
      <aside
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          height: '100%',
          width: 380,
          backgroundColor: colors.surfacePage,
          boxShadow: shadows.cardHover,
          borderLeft: `1px solid ${colors.borderSubtle}`,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: spacing.md,
            borderBottom: `1px solid ${colors.borderSubtle}`,
          }}
        >
          <div>
            <h3 style={{ margin: 0, color: colors.textPrimary, fontSize: 18, fontWeight: 700 }}>Annotations</h3>
            <p style={{ margin: 0, marginTop: 2, color: colors.textTertiary, fontSize: 12 }}>
              {annotations.length} item{annotations.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close annotations panel"
            style={{
              minWidth: 56,
              minHeight: 56,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: 'none',
              background: 'transparent',
              color: colors.textSecondary,
              cursor: 'pointer',
              borderRadius: borderRadius.md,
            }}
          >
            <ChevronRight size={20} />
          </button>
        </header>

        {/* Filter */}
        <div style={{ padding: spacing.sm, display: 'flex', gap: spacing.xs, flexWrap: 'wrap', borderBottom: `1px solid ${colors.borderSubtle}` }}>
          {(['all', 'pin', 'highlight', 'measure', 'text', 'draw', 'rectangle'] as FilterType[]).map((t) => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              style={{
                padding: '6px 12px',
                border: 'none',
                borderRadius: borderRadius.full,
                backgroundColor: filterType === t ? colors.primaryOrange : colors.surfaceRaised,
                color: filterType === t ? colors.white : colors.textSecondary,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {t === 'all' ? 'All' : TYPE_LABELS[t as AnnotationShape['type']]}
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: spacing.sm }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: spacing.lg, color: colors.textTertiary }}>Loading annotations...</div>
          ) : error ? (
            <div
              role="alert"
              style={{
                padding: spacing.md,
                backgroundColor: colors.statusCriticalSubtle,
                borderRadius: borderRadius.md,
                color: colors.statusCritical,
                fontSize: 14,
              }}
            >
              {error}
            </div>
          ) : annotations.length === 0 ? (
            <div style={{ textAlign: 'center', padding: spacing.xl, color: colors.textTertiary }}>
              <FileText size={48} style={{ marginBottom: spacing.sm, opacity: 0.5 }} />
              <p style={{ margin: 0, fontWeight: 600, color: colors.textSecondary }}>No annotations yet</p>
              <p style={{ margin: 0, marginTop: spacing.xs, fontSize: 13 }}>Create annotations using the toolbar.</p>
            </div>
          ) : (
            grouped.map(([page, items]) => (
              <section key={page} style={{ marginBottom: spacing.md }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: colors.textTertiary, padding: `${spacing.xs} 0`, textTransform: 'uppercase' }}>
                  Page {page}
                </div>
                {items.map((a) => (
                  <div
                    key={a.id}
                    onClick={() => onSelect(a.id)}
                    role="button"
                    tabIndex={0}
                    aria-selected={selectedId === a.id}
                    style={{
                      padding: spacing.sm,
                      marginBottom: spacing.xs,
                      backgroundColor: selectedId === a.id ? colors.surfaceSelected : colors.surfaceRaised,
                      border: selectedId === a.id ? `2px solid ${colors.primaryOrange}` : `1px solid ${colors.borderSubtle}`,
                      borderRadius: borderRadius.md,
                      cursor: 'pointer',
                      minHeight: 56,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
                        <span
                          aria-hidden="true"
                          style={{
                            width: 14,
                            height: 14,
                            borderRadius: '50%',
                            backgroundColor: a.color,
                            border: `2px solid ${colors.borderDefault}`,
                            flexShrink: 0,
                          }}
                        />
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: colors.textPrimary }}>
                            {TYPE_LABELS[a.type]}
                          </div>
                          {a.text && (
                            <div style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                              &ldquo;{a.text}&rdquo;
                            </div>
                          )}
                        </div>
                      </div>
                      {onDelete && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDelete(a.id);
                          }}
                          aria-label={`Delete ${TYPE_LABELS[a.type]} annotation`}
                          style={{
                            minWidth: 56,
                            minHeight: 56,
                            border: 'none',
                            background: 'transparent',
                            color: colors.statusCritical,
                            cursor: 'pointer',
                            borderRadius: borderRadius.md,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                    {(a.linkedRfiId || a.linkedPunchItemId) && (
                      <div style={{ display: 'flex', gap: spacing.xs, marginTop: spacing.xs, flexWrap: 'wrap' }}>
                        {a.linkedRfiId && (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              padding: '2px 8px',
                              borderRadius: borderRadius.full,
                              backgroundColor: colors.statusInfoSubtle,
                              color: colors.statusInfo,
                              fontSize: 11,
                              fontWeight: 600,
                            }}
                          >
                            <LinkIcon size={12} /> RFI
                          </span>
                        )}
                        {a.linkedPunchItemId && (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              padding: '2px 8px',
                              borderRadius: borderRadius.full,
                              backgroundColor: colors.statusPendingSubtle,
                              color: colors.statusPending,
                              fontSize: 11,
                              fontWeight: 600,
                            }}
                          >
                            <LinkIcon size={12} /> Punch
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </section>
            ))
          )}
        </div>
      </aside>
    </div>
  );
};

export default AnnotationListPanel;
