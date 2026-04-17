import React, { useMemo } from 'react';
import { createColumnHelper } from '@tanstack/react-table';
import { VirtualDataTable } from '../../components/shared/VirtualDataTable';
import { Card, PriorityTag } from '../../components/Primitives';
import EmptyState from '../../components/ui/EmptyState';
import { Search } from 'lucide-react';
import { colors, spacing, typography, borderRadius } from '../../styles/theme';
import { InlineEditCell } from '../../components/forms/EditableField';
import { AIAnnotationIndicator } from '../../components/ai/AIAnnotation';
import { getAnnotationsForEntity } from '../../data/aiAnnotations';
import { toast } from 'sonner';
import type { PunchItem } from './types';
import {
  STATUS_COLORS,
  statusLabel,
  responsibleColors,
  responsibleLabel,
  getDaysRemaining,
  getDueDateColor,
  formatDate,
} from './types';

const plColHelper = createColumnHelper<PunchItem>();

export const StatusDot: React.FC<{ status: string }> = ({ status }) => {
  const color = STATUS_COLORS[status] ?? STATUS_COLORS.open;
  const label = statusLabel[status] ?? status;
  return (
    <div
      role="img"
      aria-label={`Status: ${label}`}
      style={{ display: 'flex', alignItems: 'center', gap: 6 }}
    >
      <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: color, flexShrink: 0 }} />
      <span style={{ fontSize: 12, fontWeight: 500, color }}>{label}</span>
    </div>
  );
};

export const PhotoThumbnail: React.FC<{ url: string; alt: string }> = ({ url, alt }) => {
  const [hovered, setHovered] = React.useState(false);
  return (
    <div style={{ position: 'relative', display: 'inline-block', flexShrink: 0 }}>
      <img
        src={url}
        alt={alt}
        loading="lazy"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{ width: 32, height: 32, objectFit: 'cover', borderRadius: borderRadius.base, border: `1px solid ${colors.borderDefault}`, cursor: 'zoom-in', display: 'block' }}
      />
      {hovered && (
        <div
          style={{
            position: 'absolute',
            bottom: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            marginBottom: 6,
            zIndex: 50,
            pointerEvents: 'none',
          }}
        >
          <img
            src={url}
            alt={alt}
            loading="lazy"
            style={{ width: 120, height: 120, objectFit: 'cover', borderRadius: borderRadius.md, border: `1px solid ${colors.borderDefault}`, boxShadow: '0 4px 16px rgba(0,0,0,0.18)', display: 'block' }}
          />
        </div>
      )}
    </div>
  );
};

interface PunchListTableProps {
  filteredList: PunchItem[];
  hasActiveFilters: boolean;
  clearAllFilters: () => void;
  isMobile: boolean;
  selectedId: number | null;
  setSelectedId: (id: number | null) => void;
  bulkSelected: Set<string>;
  setBulkSelected: (s: Set<string>) => void;
  hasPermission: (p: string) => boolean;
  updatePunchItem: {
    mutateAsync: (args: { id: string; updates: Record<string, unknown>; projectId: string }) => Promise<unknown>;
  };
  projectId: string | null;
  inlineRejectId: number | null;
  setInlineRejectId: (id: number | null) => void;
  inlineRejectNote: string;
  setInlineRejectNote: (n: string) => void;
  handleMarkInProgressById: (item: PunchItem) => void;
  handleMarkSubCompleteById: (item: PunchItem) => void;
  handleVerifyById: (item: PunchItem) => void;
  handleRejectById: (item: PunchItem, reason: string) => void;
}

export const PunchListTable: React.FC<PunchListTableProps> = ({
  filteredList,
  hasActiveFilters,
  clearAllFilters,
  isMobile,
  selectedId,
  setSelectedId,
  bulkSelected,
  setBulkSelected,
  hasPermission,
  updatePunchItem,
  projectId,
  inlineRejectId,
  setInlineRejectId,
  inlineRejectNote,
  setInlineRejectNote,
  handleMarkInProgressById,
  handleMarkSubCompleteById,
  handleVerifyById,
  handleRejectById,
}) => {
  const plColumns = useMemo(() => [
    plColHelper.display({
      id: 'select',
      size: 40,
      header: () => null,
      cell: (info) => {
        const item = info.row.original;
        return (
          <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <input
              type="checkbox"
              checked={bulkSelected.has(String(item.id))}
              onChange={(e) => {
                const next = new Set(bulkSelected);
                if (e.target.checked) next.add(String(item.id));
                else next.delete(String(item.id));
                setBulkSelected(next);
              }}
              style={{ width: 16, height: 16, accentColor: colors.primaryOrange, cursor: 'pointer' }}
              aria-label={`Select ${item.itemNumber}`}
            />
          </div>
        );
      },
    }),
    plColHelper.accessor('itemNumber', {
      header: 'Item',
      size: 80,
      cell: (info) => <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.orangeText }}>{info.getValue()}</span>,
    }),
    plColHelper.accessor('description', {
      header: 'Description',
      size: 300,
      cell: (info) => {
        const item = info.row.original;
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: spacing['2'] }}>
              <span style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary, fontWeight: typography.fontWeight.medium, lineHeight: typography.lineHeight.snug, flex: 1, display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
                {info.getValue()}
                {getAnnotationsForEntity('punch_item', item.id).map((ann: unknown) => (
                  <AIAnnotationIndicator key={(ann as { id: string | number }).id} annotation={ann as never} inline />
                ))}
              </span>
              {item.before_photo_url && <PhotoThumbnail url={item.before_photo_url} alt="Before photo" />}
            </div>
            <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
              {item.reportedBy && <span>{item.reportedBy}</span>}
              {item.createdDate && <span> · {formatDate(item.createdDate)}</span>}
            </span>
          </div>
        );
      },
    }),
    plColHelper.accessor('area', {
      header: 'Location',
      size: 180,
      cell: (info) => {
        const item = info.row.original;
        const parts = [info.getValue(), item.location].filter(Boolean).join(', ').split(',').map((s: string) => s.trim()).filter(Boolean);
        if (parts.length <= 1) {
          return <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>{parts[0] || '\u2014'}</span>;
        }
        return (
          <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap' as const }}>
            {parts.map((part, i) => (
              <React.Fragment key={i}>
                {i > 0 && <span style={{ color: colors.textTertiary, fontSize: 10 }}>{'>'}</span>}
                <span>{part}</span>
              </React.Fragment>
            ))}
          </span>
        );
      },
    }),
    plColHelper.accessor('assigned', {
      header: 'Assigned',
      size: 120,
      cell: (info) => {
        const item = info.row.original;
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>{info.getValue()}</span>
            <span style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium, color: responsibleColors[item.responsible]?.text || colors.textTertiary }}>
              {responsibleLabel[item.responsible] || ''}
            </span>
          </div>
        );
      },
    }),
    plColHelper.accessor('priority', {
      header: 'Priority',
      size: 90,
      cell: (info) => <PriorityTag priority={info.getValue() as 'low' | 'medium' | 'high' | 'critical'} />,
    }),
    plColHelper.accessor('verification_status', {
      header: 'Status',
      size: 130,
      cell: (info) => {
        const item = info.row.original;
        return (
          <div onClick={(e) => e.stopPropagation()}>
            <InlineEditCell
              value={info.getValue()}
              type="select"
              options={[
                { value: 'open', label: 'Open' },
                { value: 'in_progress', label: 'In Progress' },
                { value: 'sub_complete', label: 'Sub Complete' },
                { value: 'verified', label: 'Verified' },
                { value: 'rejected', label: 'Rejected' },
              ]}
              onSave={async (val) => {
                await updatePunchItem.mutateAsync({ id: String(item.id), updates: { verification_status: val }, projectId: projectId! });
                toast.success(`${item.itemNumber} status updated`);
              }}
              displayComponent={<StatusDot status={info.getValue()} />}
            />
          </div>
        );
      },
    }),
    plColHelper.accessor('dueDate', {
      header: 'Due',
      size: 110,
      cell: (info) => {
        const val = info.getValue();
        if (!val) return null;
        const days = getDaysRemaining(val);
        const color = getDueDateColor(val);
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color, fontVariantNumeric: 'tabular-nums' as const }}>
              {formatDate(val)}
            </span>
            {days <= 0 ? (
              <span style={{ fontSize: 10, fontWeight: 600, color: colors.statusCritical }}>{Math.abs(days)} days overdue</span>
            ) : days <= 4 ? (
              <span style={{ fontSize: 10, color: colors.statusPending }}>{days}d left</span>
            ) : (
              <span style={{ fontSize: 10, color: colors.textTertiary }}>{days}d left</span>
            )}
          </div>
        );
      },
    }),
    plColHelper.accessor('trade', {
      header: 'Responsible',
      size: 110,
      cell: (info) => {
        const trade = info.getValue()?.toLowerCase() ?? '';
        const item = info.row.original;
        let bg = 'transparent';
        const label = item.responsible === 'gc' ? 'GC' : item.responsible === 'owner' ? 'Owner' : trade || 'Sub';
        const isSubTrade = trade.includes('electric') || trade.includes('plumb') || trade.includes('hvac') || trade.includes('drywall') || trade.includes('paint');
        let textColor = colors.statusPending;
        if (item.responsible === 'gc') {
          bg = 'rgba(59,130,246,0.10)';
          textColor = colors.statusInfo;
        } else if (item.responsible === 'owner') {
          bg = 'rgba(244,120,32,0.10)';
          textColor = colors.primaryOrange as string;
        } else if (isSubTrade || item.responsible === 'subcontractor') {
          bg = 'rgba(245,166,35,0.12)';
          textColor = colors.statusPending;
        }
        return (
          <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: borderRadius.full, backgroundColor: bg, fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: textColor, whiteSpace: 'nowrap' as const }}>
            {label}
          </span>
        );
      },
    }),
    plColHelper.display({
      id: 'inline_actions',
      header: '',
      size: 160,
      cell: (info) => {
        const item = info.row.original;
        return (
          <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            {item.verification_status === 'open' && hasPermission('punch_list.edit') && (
              <button
                onClick={() => handleMarkInProgressById(item)}
                style={{ padding: '3px 8px', fontSize: 11, fontWeight: 600, fontFamily: 'inherit', backgroundColor: colors.statusInfoSubtle, color: STATUS_COLORS.in_progress, border: `1px solid ${STATUS_COLORS.in_progress}40`, borderRadius: borderRadius.base, cursor: 'pointer', whiteSpace: 'nowrap' as const }}
              >
                Start
              </button>
            )}
            {item.verification_status === 'in_progress' && hasPermission('punch_list.edit') && (
              <button
                onClick={() => handleMarkSubCompleteById(item)}
                style={{ padding: '3px 8px', fontSize: 11, fontWeight: 600, fontFamily: 'inherit', backgroundColor: colors.statusReviewSubtle, color: STATUS_COLORS.sub_complete, border: `1px solid ${STATUS_COLORS.sub_complete}40`, borderRadius: borderRadius.base, cursor: 'pointer', whiteSpace: 'nowrap' as const }}
              >
                Mark Complete
              </button>
            )}
            {item.verification_status === 'sub_complete' && hasPermission('punch_list.verify') && (
              <>
                <button
                  onClick={() => handleVerifyById(item)}
                  style={{ padding: '3px 8px', fontSize: 11, fontWeight: 600, fontFamily: 'inherit', backgroundColor: colors.statusActiveSubtle, color: colors.statusActive, border: `1px solid ${colors.statusActive}40`, borderRadius: borderRadius.base, cursor: 'pointer', whiteSpace: 'nowrap' as const }}
                >
                  Verify
                </button>
                {inlineRejectId === item.id ? (
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    <input
                      type="text"
                      placeholder="Reason..."
                      value={inlineRejectNote}
                      autoFocus
                      onChange={(e) => setInlineRejectNote(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRejectById(item, inlineRejectNote);
                        if (e.key === 'Escape') { setInlineRejectId(null); setInlineRejectNote(''); }
                      }}
                      style={{ padding: '2px 6px', fontSize: 11, fontFamily: 'inherit', border: `1px solid ${colors.statusCritical}80`, borderRadius: borderRadius.base, width: 110, outline: 'none', color: colors.textPrimary }}
                    />
                    <button
                      onClick={() => handleRejectById(item, inlineRejectNote)}
                      style={{ padding: '3px 8px', fontSize: 11, fontWeight: 600, fontFamily: 'inherit', backgroundColor: colors.statusCriticalSubtle, color: colors.statusCritical, border: `1px solid ${colors.statusCritical}40`, borderRadius: borderRadius.base, cursor: 'pointer' }}
                    >
                      Send
                    </button>
                    <button
                      onClick={() => { setInlineRejectId(null); setInlineRejectNote(''); }}
                      style={{ padding: '3px 6px', fontSize: 11, fontFamily: 'inherit', backgroundColor: 'transparent', color: colors.textTertiary, border: `1px solid ${colors.borderDefault}`, borderRadius: borderRadius.base, cursor: 'pointer' }}
                    >
                      x
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => { setInlineRejectId(item.id); setInlineRejectNote(''); }}
                    style={{ padding: '3px 8px', fontSize: 11, fontWeight: 600, fontFamily: 'inherit', backgroundColor: colors.statusCriticalSubtle, color: colors.statusCritical, border: `1px solid ${colors.statusCritical}40`, borderRadius: borderRadius.base, cursor: 'pointer', whiteSpace: 'nowrap' as const }}
                  >
                    Reject
                  </button>
                )}
              </>
            )}
          </div>
        );
      },
    }),
  ], [bulkSelected, setBulkSelected, updatePunchItem, projectId, hasPermission, handleMarkInProgressById, handleMarkSubCompleteById, handleVerifyById, handleRejectById, inlineRejectId, inlineRejectNote, setInlineRejectId, setInlineRejectNote]);

  // Suppress unused warning (EmptyState reserved for potential future enhancement)
  void EmptyState;

  if (isMobile) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['3'] }}>
        {filteredList.length === 0 && hasActiveFilters && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: spacing['3'], padding: `${spacing['8']} ${spacing['4']}`, textAlign: 'center' }}>
            <Search size={32} color={colors.textTertiary} />
            <p style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, margin: 0 }}>No punch items match your current filters</p>
            <button
              onClick={clearAllFilters}
              style={{ padding: `${spacing['2']} ${spacing['4']}`, fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily, fontWeight: typography.fontWeight.medium, backgroundColor: colors.primaryOrange, color: colors.white, border: 'none', borderRadius: borderRadius.base, cursor: 'pointer' }}
            >
              Clear All Filters
            </button>
          </div>
        )}
        {filteredList.map((item) => {
          const statusDotColor = STATUS_COLORS[item.verification_status] ?? STATUS_COLORS.open;
          return (
            <div
              key={item.id}
              onClick={() => setSelectedId(item.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedId(item.id); } }}
              style={{
                backgroundColor: colors.white,
                borderRadius: borderRadius.md,
                border: `1px solid ${colors.borderDefault}`,
                padding: '16px',
                minHeight: '72px',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
              }}
            >
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ fontSize: '16px', fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, lineHeight: 1.3 }}>
                    {item.description}
                  </div>
                  {item.area && (
                    <div style={{ fontSize: '14px', color: colors.textTertiary }}>{item.area}</div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' as const }}>
                    <div
                      style={{ display: 'flex', alignItems: 'center', gap: '4px', minHeight: '44px', minWidth: '44px' }}
                      aria-label={`Status: ${statusLabel[item.verification_status] ?? item.verification_status}`}
                    >
                      <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: statusDotColor, flexShrink: 0 }} aria-hidden="true" />
                      <span style={{ fontSize: '13px', color: statusDotColor, fontWeight: 500 }} aria-hidden="true">
                        {statusLabel[item.verification_status] ?? item.verification_status}
                      </span>
                    </div>
                    <PriorityTag priority={item.priority as 'low' | 'medium' | 'high' | 'critical'} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '2px' }}>
                    {item.assigned && (
                      <span style={{ fontSize: '13px', color: colors.textSecondary }}>{item.assigned}</span>
                    )}
                    {item.dueDate && (
                      <span style={{ fontSize: '13px', fontWeight: 500, color: getDueDateColor(item.dueDate) }}>
                        Due {formatDate(item.dueDate)}
                      </span>
                    )}
                  </div>
                </div>
                {item.before_photo_url && (
                  <div style={{ flexShrink: 0 }}>
                    <img loading="lazy"
                      src={item.before_photo_url}
                      alt="Before"
                      style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: borderRadius.base, border: `1px solid ${colors.borderDefault}` }}
                    />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <Card padding="0">
      {filteredList.length === 0 && hasActiveFilters ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: spacing['3'], padding: `${spacing['12']} ${spacing['4']}`, textAlign: 'center' }}>
          <Search size={36} color={colors.textTertiary} />
          <p style={{ fontSize: typography.fontSize.base, color: colors.textSecondary, margin: 0 }}>No punch items match your current filters</p>
          <button
            onClick={clearAllFilters}
            style={{ padding: `${spacing['2']} ${spacing['4']}`, fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily, fontWeight: typography.fontWeight.medium, backgroundColor: colors.primaryOrange, color: colors.white, border: 'none', borderRadius: borderRadius.base, cursor: 'pointer' }}
          >
            Clear All Filters
          </button>
        </div>
      ) : (
        <VirtualDataTable
          aria-label="Punch list items"
          data={filteredList}
          columns={plColumns}
          rowHeight={48}
          containerHeight={600}
          onRowClick={(row) => setSelectedId(row.id)}
          selectedRowId={selectedId}
          getRowId={(row) => String(row.id)}
          emptyMessage="No items match your filters"
        />
      )}
    </Card>
  );
};
