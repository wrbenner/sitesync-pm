import React, { useMemo, useState, useCallback } from 'react';
import { createColumnHelper } from '@tanstack/react-table';
import { VirtualDataTable } from '../../components/shared/VirtualDataTable';
import { Card, PriorityTag } from '../../components/Primitives';
import { Search, Camera, MapPin, ChevronRight, X } from 'lucide-react';
import { colors, spacing, typography } from '../../styles/theme';
import { InlineEditCell } from '../../components/forms/EditableField';
import { toast } from 'sonner';
import type { PunchItem } from './types';
import {
  STATUS_COLORS,
  statusLabel,
  getDaysRemaining,
  getDueDateColor,
  formatDate,
} from './types';

const plColHelper = createColumnHelper<PunchItem>();

// ── Status Badge ────────────────────────────────────────
export const StatusDot: React.FC<{ status: string }> = ({ status }) => {
  const color = STATUS_COLORS[status] ?? STATUS_COLORS.open;
  const label = statusLabel[status] ?? status;
  return (
    <div
      role="img"
      aria-label={`Status: ${label}`}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '3px 10px', borderRadius: '100px',
        backgroundColor: `${color}14`,
      }}
    >
      <div style={{
        width: 7, height: 7, borderRadius: '50%',
        backgroundColor: color, flexShrink: 0,
      }} />
      <span style={{ fontSize: 12, fontWeight: 600, color, whiteSpace: 'nowrap' }}>
        {label}
      </span>
    </div>
  );
};

// ── Photo Thumbnail ─────────────────────────────────────
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
        style={{
          width: 36, height: 36, objectFit: 'cover',
          borderRadius: 8,
          border: `1.5px solid ${colors.borderSubtle}`,
          cursor: 'zoom-in', display: 'block',
          transition: 'transform 0.15s, box-shadow 0.15s',
          ...(hovered ? { transform: 'scale(1.05)', boxShadow: '0 4px 12px rgba(0,0,0,0.12)' } : {}),
        }}
      />
      {hovered && (
        <div style={{
          position: 'absolute', bottom: 'calc(100% + 8px)', left: '50%',
          transform: 'translateX(-50%)', zIndex: 50, pointerEvents: 'none',
        }}>
          <img src={url} alt={alt} loading="lazy" style={{
            width: 180, height: 140, objectFit: 'cover',
            borderRadius: 12, border: `1px solid ${colors.borderDefault}`,
            boxShadow: '0 8px 32px rgba(0,0,0,0.2)', display: 'block',
          }} />
        </div>
      )}
    </div>
  );
};

// ── Search Bar ──────────────────────────────────────────
const SearchBar: React.FC<{
  value: string;
  onChange: (v: string) => void;
  count: number;
  total: number;
}> = ({ value, onChange, count, total }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '0 20px', height: 48,
    borderBottom: `1px solid ${colors.borderSubtle}`,
    backgroundColor: colors.surfaceRaised,
  }}>
    <Search size={15} style={{ color: colors.textTertiary, flexShrink: 0 }} />
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Search punch items..."
      style={{
        flex: 1, border: 'none', outline: 'none',
        fontSize: 14, color: colors.textPrimary,
        backgroundColor: 'transparent',
        fontFamily: 'inherit',
      }}
    />
    {value && (
      <button onClick={() => onChange('')} style={{
        background: 'none', border: 'none', cursor: 'pointer',
        color: colors.textTertiary, padding: 2, display: 'flex',
      }}>
        <X size={14} />
      </button>
    )}
    <span style={{
      fontSize: 12, color: colors.textTertiary,
      fontVariantNumeric: 'tabular-nums', flexShrink: 0,
    }}>
      {count === total ? `${total} items` : `${count} of ${total}`}
    </span>
  </div>
);

// ── Props ───────────────────────────────────────────────
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
  const [searchQuery, setSearchQuery] = useState('');

  // Search filtering
  const searchedList = useMemo(() => {
    if (!searchQuery.trim()) return filteredList;
    const q = searchQuery.toLowerCase();
    return filteredList.filter(item =>
      item.description.toLowerCase().includes(q) ||
      item.itemNumber.toLowerCase().includes(q) ||
      item.area.toLowerCase().includes(q) ||
      item.assigned.toLowerCase().includes(q) ||
      item.trade.toLowerCase().includes(q) ||
      item.location.toLowerCase().includes(q)
    );
  }, [filteredList, searchQuery]);

  // ── Inline action button ──────────────────────────────
  const ActionBtn: React.FC<{
    label: string;
    color: string;
    bg: string;
    onClick: () => void;
  }> = useCallback(({ label, color, bg, onClick }: { label: string; color: string; bg: string; onClick: () => void }) => (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      style={{
        padding: '4px 10px', fontSize: 11, fontWeight: 600,
        fontFamily: 'inherit',
        backgroundColor: bg, color,
        border: `1px solid ${color}30`,
        borderRadius: 6, cursor: 'pointer',
        whiteSpace: 'nowrap',
        transition: 'all 0.15s',
      }}
    >
      {label}
    </button>
  ), []);

  const plColumns = useMemo(() => [
    // Checkbox
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

    // Photo + Description (combined for visual impact)
    plColHelper.accessor('description', {
      header: 'Item',
      size: 380,
      cell: (info) => {
        const item = info.row.original;
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* Photo or placeholder */}
            {item.before_photo_url ? (
              <PhotoThumbnail url={item.before_photo_url} alt={item.description} />
            ) : (
              <div style={{
                width: 36, height: 36, borderRadius: 8,
                backgroundColor: colors.surfaceInset,
                border: `1.5px dashed ${colors.borderDefault}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <Camera size={14} style={{ color: colors.textTertiary }} />
              </div>
            )}
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                <span style={{
                  fontSize: 11, fontWeight: 600,
                  color: colors.primaryOrange,
                  fontFamily: typography.fontFamilyMono,
                  flexShrink: 0,
                }}>
                  {item.itemNumber}
                </span>
                <span style={{
                  fontSize: 13, fontWeight: 600,
                  color: colors.textPrimary,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {info.getValue()}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: colors.textTertiary }}>
                {item.area && (
                  <>
                    <MapPin size={9} style={{ flexShrink: 0 }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.area}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        );
      },
    }),

    // Assigned
    plColHelper.accessor('assigned', {
      header: 'Assigned To',
      size: 140,
      cell: (info) => {
        const val = info.getValue();
        const item = info.row.original;
        if (!val) return <span style={{ fontSize: 12, color: colors.textTertiary }}>—</span>;
        const initials = val.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 26, height: 26, borderRadius: '50%',
              backgroundColor: colors.orangeSubtle,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10, fontWeight: 700,
              color: colors.primaryOrange,
              flexShrink: 0,
            }}>
              {initials}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: colors.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {val}
              </div>
              {item.trade && (
                <div style={{ fontSize: 11, color: colors.textTertiary }}>
                  {item.trade}
                </div>
              )}
            </div>
          </div>
        );
      },
    }),

    // Priority
    plColHelper.accessor('priority', {
      header: 'Priority',
      size: 90,
      cell: (info) => <PriorityTag priority={info.getValue() as 'low' | 'medium' | 'high' | 'critical'} />,
    }),

    // Status
    plColHelper.accessor('verification_status', {
      header: 'Status',
      size: 140,
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

    // Due Date
    plColHelper.accessor('dueDate', {
      header: 'Due',
      size: 100,
      cell: (info) => {
        const val = info.getValue();
        if (!val) return <span style={{ fontSize: 12, color: colors.textTertiary }}>—</span>;
        const days = getDaysRemaining(val);
        const color = getDueDateColor(val);
        const item = info.row.original;
        const isVerified = item.verification_status === 'verified';
        return (
          <div>
            <span style={{
              fontSize: 13, fontWeight: 500,
              color: isVerified ? colors.textTertiary : color,
              fontVariantNumeric: 'tabular-nums',
            }}>
              {formatDate(val)}
            </span>
            {!isVerified && (
              <div style={{
                fontSize: 10, fontWeight: days <= 0 ? 700 : 500,
                color: days <= 0 ? colors.statusCritical : days <= 4 ? colors.statusPending : colors.textTertiary,
                marginTop: 1,
              }}>
                {days <= 0 ? `${Math.abs(days)}d overdue` : `${days}d left`}
              </div>
            )}
          </div>
        );
      },
    }),

    // Quick Actions
    plColHelper.display({
      id: 'actions',
      header: '',
      size: 140,
      cell: (info) => {
        const item = info.row.original;
        return (
          <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            {item.verification_status === 'open' && hasPermission('punch_list.edit') && (
              <ActionBtn label="Start" color={STATUS_COLORS.in_progress} bg={colors.statusInfoSubtle}
                onClick={() => handleMarkInProgressById(item)} />
            )}
            {item.verification_status === 'in_progress' && hasPermission('punch_list.edit') && (
              <ActionBtn label="Complete" color={STATUS_COLORS.sub_complete} bg={colors.statusReviewSubtle}
                onClick={() => handleMarkSubCompleteById(item)} />
            )}
            {item.verification_status === 'sub_complete' && hasPermission('punch_list.verify') && (
              <>
                <ActionBtn label="Verify" color={colors.statusActive} bg={colors.statusActiveSubtle}
                  onClick={() => handleVerifyById(item)} />
                {inlineRejectId === item.id ? (
                  <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
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
                      style={{
                        padding: '3px 8px', fontSize: 11, fontFamily: 'inherit',
                        border: `1.5px solid ${colors.statusCritical}60`,
                        borderRadius: 6, width: 100, outline: 'none',
                        color: colors.textPrimary, backgroundColor: colors.statusCriticalSubtle,
                      }}
                    />
                    <button
                      onClick={() => handleRejectById(item, inlineRejectNote)}
                      style={{
                        padding: '3px 8px', fontSize: 11, fontWeight: 600, fontFamily: 'inherit',
                        backgroundColor: colors.statusCritical, color: colors.white,
                        border: 'none', borderRadius: 6, cursor: 'pointer',
                      }}
                    >
                      ↵
                    </button>
                  </div>
                ) : (
                  <ActionBtn label="Reject" color={colors.statusCritical} bg={colors.statusCriticalSubtle}
                    onClick={() => { setInlineRejectId(item.id); setInlineRejectNote(''); }} />
                )}
              </>
            )}
            {/* Arrow indicator for row click */}
            <ChevronRight size={14} style={{ color: colors.textTertiary, marginLeft: 'auto', opacity: 0.4 }} />
          </div>
        );
      },
    }),
  ], [bulkSelected, setBulkSelected, updatePunchItem, projectId, hasPermission,
      handleMarkInProgressById, handleMarkSubCompleteById, handleVerifyById, handleRejectById,
      inlineRejectId, inlineRejectNote, setInlineRejectId, setInlineRejectNote, ActionBtn]);

  // ── Mobile Card View ──────────────────────────────────
  if (isMobile) {
    return (
      <div>
        {/* Mobile Search */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 16px', marginBottom: 12,
          backgroundColor: colors.surfaceRaised,
          borderRadius: 12,
          border: `1px solid ${colors.borderSubtle}`,
        }}>
          <Search size={16} style={{ color: colors.textTertiary }} />
          <input
            type="text" value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search items..."
            style={{
              flex: 1, border: 'none', outline: 'none',
              fontSize: 15, color: colors.textPrimary,
              backgroundColor: 'transparent', fontFamily: 'inherit',
            }}
          />
        </div>

        {searchedList.length === 0 && (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            gap: 12, padding: '48px 24px', textAlign: 'center',
          }}>
            <Search size={28} color={colors.textTertiary} />
            <p style={{ fontSize: 15, color: colors.textSecondary, margin: 0 }}>
              {hasActiveFilters || searchQuery ? 'No items match your search' : 'No punch items yet'}
            </p>
            {(hasActiveFilters || searchQuery) && (
              <button onClick={() => { clearAllFilters(); setSearchQuery(''); }}
                style={{
                  padding: '8px 20px', fontSize: 14, fontFamily: 'inherit',
                  fontWeight: 600, backgroundColor: colors.primaryOrange,
                  color: colors.white, border: 'none', borderRadius: 8, cursor: 'pointer',
                }}
              >
                Clear Filters
              </button>
            )}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {searchedList.map((item) => {
            const _statusColor = STATUS_COLORS[item.verification_status] ?? STATUS_COLORS.open;
            const days = item.dueDate ? getDaysRemaining(item.dueDate) : null;
            const isOverdue = days !== null && days <= 0 && item.verification_status !== 'verified';

            return (
              <div
                key={item.id}
                onClick={() => setSelectedId(item.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedId(item.id); } }}
                style={{
                  backgroundColor: colors.surfaceRaised,
                  borderRadius: 14,
                  border: `1px solid ${colors.borderSubtle}`,
                  padding: 16,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  display: 'flex', gap: 12,
                }}
              >
                {/* Photo */}
                {item.before_photo_url ? (
                  <img loading="lazy" src={item.before_photo_url} alt=""
                    style={{
                      width: 56, height: 56, objectFit: 'cover',
                      borderRadius: 10, flexShrink: 0,
                      border: `1px solid ${colors.borderSubtle}`,
                    }}
                  />
                ) : (
                  <div style={{
                    width: 56, height: 56, borderRadius: 10,
                    backgroundColor: colors.surfaceInset,
                    border: `1.5px dashed ${colors.borderDefault}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <Camera size={18} style={{ color: colors.textTertiary }} />
                  </div>
                )}

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: colors.primaryOrange, fontFamily: typography.fontFamilyMono }}>
                      {item.itemNumber}
                    </span>
                    {isOverdue && (
                      <span style={{
                        fontSize: 10, fontWeight: 700, color: colors.statusCritical,
                        backgroundColor: colors.statusCriticalSubtle,
                        padding: '1px 6px', borderRadius: 4,
                      }}>
                        OVERDUE
                      </span>
                    )}
                  </div>
                  <div style={{
                    fontSize: 15, fontWeight: 600, color: colors.textPrimary,
                    lineHeight: 1.3, marginBottom: 6,
                    overflow: 'hidden', textOverflow: 'ellipsis',
                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                  }}>
                    {item.description}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <StatusDot status={item.verification_status} />
                    <PriorityTag priority={item.priority as 'low' | 'medium' | 'high' | 'critical'} />
                  </div>
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    marginTop: 8, fontSize: 12, color: colors.textTertiary,
                  }}>
                    {item.assigned && <span>{item.assigned}</span>}
                    {item.dueDate && (
                      <span style={{ fontWeight: 500, color: getDueDateColor(item.dueDate) }}>
                        Due {formatDate(item.dueDate)}
                      </span>
                    )}
                  </div>
                </div>

                <ChevronRight size={16} style={{ color: colors.textTertiary, alignSelf: 'center', flexShrink: 0, opacity: 0.4 }} />
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Desktop Table ─────────────────────────────────────
  return (
    <Card padding="0">
      <div style={{ borderRadius: 14, overflow: 'hidden' }}>
        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          count={searchedList.length}
          total={filteredList.length}
        />
        {searchedList.length === 0 ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            gap: 12, padding: '56px 24px', textAlign: 'center',
          }}>
            <Search size={32} color={colors.textTertiary} />
            <p style={{ fontSize: 15, color: colors.textSecondary, margin: 0 }}>
              {searchQuery ? 'No items match your search' : 'No punch items match your filters'}
            </p>
            <button onClick={() => { clearAllFilters(); setSearchQuery(''); }}
              style={{
                padding: '8px 20px', fontSize: 13, fontFamily: 'inherit',
                fontWeight: 600, backgroundColor: colors.primaryOrange,
                color: colors.white, border: 'none', borderRadius: 8, cursor: 'pointer',
              }}
            >
              Clear Filters
            </button>
          </div>
        ) : (
          <VirtualDataTable
            aria-label="Punch list items"
            data={searchedList}
            columns={plColumns}
            rowHeight={56}
            containerHeight={600}
            onRowClick={(row) => setSelectedId(row.id)}
            selectedRowId={selectedId}
            getRowId={(row) => String(row.id)}
            emptyMessage="No items match your filters"
          />
        )}
      </div>
    </Card>
  );
};
