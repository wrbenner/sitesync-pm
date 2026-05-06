import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Camera, ChevronUp, ChevronDown } from 'lucide-react';
import { colors, typography, spacing } from '../../styles/theme';
import type { PunchItem } from './types';
import { StatusDot } from './PunchListPrimitives';

interface PunchListDenseTableProps {
  items: PunchItem[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  onMarkComplete?: (item: PunchItem) => void;
}

type SortKey =
  | 'number'
  | 'title'
  | 'trade'
  | 'location'
  | 'assigned'
  | 'due'
  | 'status'
  | 'photos'
  | 'verifiedBy'
  | 'daysOpen';
type SortDir = 'asc' | 'desc';

interface ColDef {
  key: SortKey;
  label: string;
  width: string;
  align?: 'left' | 'right' | 'center';
}

const COLUMNS: ColDef[] = [
  { key: 'number', label: '#', width: '90px' },
  { key: 'title', label: 'Title', width: 'minmax(220px, 2fr)' },
  { key: 'trade', label: 'Trade', width: '120px' },
  { key: 'location', label: 'Location', width: 'minmax(140px, 1fr)' },
  { key: 'assigned', label: 'Assigned', width: 'minmax(140px, 1fr)' },
  { key: 'due', label: 'Due', width: '88px' },
  { key: 'status', label: 'Status', width: '128px' },
  { key: 'photos', label: 'Photos', width: '72px', align: 'right' },
  { key: 'verifiedBy', label: 'Verified by', width: '140px' },
  { key: 'daysOpen', label: 'Days Open', width: '88px', align: 'right' },
];

const ROW_HEIGHT = 36;

function daysOpen(item: PunchItem): number {
  if (!item.createdDate) return 0;
  const created = new Date(item.createdDate).getTime();
  if (Number.isNaN(created)) return 0;
  return Math.max(0, Math.floor((Date.now() - created) / 86_400_000));
}

function formatDueDate(item: PunchItem): string {
  if (!item.dueDate) return '—';
  const d = new Date(item.dueDate);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function sortItems(items: PunchItem[], key: SortKey, dir: SortDir): PunchItem[] {
  const mult = dir === 'asc' ? 1 : -1;
  const arr = [...items];
  arr.sort((a, b) => {
    let av: string | number = '';
    let bv: string | number = '';
    switch (key) {
      case 'number':
        av = a.itemNumber;
        bv = b.itemNumber;
        break;
      case 'title':
        av = (a.description ?? '').toLowerCase();
        bv = (b.description ?? '').toLowerCase();
        break;
      case 'trade':
        av = (a.trade ?? '').toLowerCase();
        bv = (b.trade ?? '').toLowerCase();
        break;
      case 'location':
        av = (a.area ?? a.location ?? '').toLowerCase();
        bv = (b.area ?? b.location ?? '').toLowerCase();
        break;
      case 'assigned':
        av = (a.assigned ?? '').toLowerCase();
        bv = (b.assigned ?? '').toLowerCase();
        break;
      case 'due':
        av = a.dueDate || '9999-99-99';
        bv = b.dueDate || '9999-99-99';
        break;
      case 'status':
        av = a.verification_status;
        bv = b.verification_status;
        break;
      case 'photos':
        av = a.photoCount ?? 0;
        bv = b.photoCount ?? 0;
        break;
      case 'verifiedBy':
        av = (a.verified_by ?? '').toLowerCase();
        bv = (b.verified_by ?? '').toLowerCase();
        break;
      case 'daysOpen':
        av = daysOpen(a);
        bv = daysOpen(b);
        break;
    }
    if (av < bv) return -1 * mult;
    if (av > bv) return 1 * mult;
    return 0;
  });
  return arr;
}

export const PunchListDenseTable: React.FC<PunchListDenseTableProps> = ({
  items,
  selectedId,
  onSelect,
  onMarkComplete: _onMarkComplete,
}) => {
  const [sortKey, setSortKey] = useState<SortKey>('daysOpen');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const sorted = useMemo(() => sortItems(items, sortKey, sortDir), [items, sortKey, sortDir]);
  const focusedRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (focusedRef.current) focusedRef.current.scrollIntoView({ block: 'nearest' });
  }, [selectedId]);

  const onHeaderClick = (key: SortKey) => {
    if (key === sortKey) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const gridTemplate = COLUMNS.map((c) => c.width).join(' ');

  return (
    <div
      role="grid"
      aria-label="Punch list items"
      aria-rowcount={sorted.length}
      style={{
        background: colors.surfaceRaised,
        border: `1px solid ${colors.borderSubtle}`,
        borderRadius: 6,
        overflow: 'hidden',
      }}
    >
      {/* Sticky header */}
      <div
        role="row"
        style={{
          display: 'grid',
          gridTemplateColumns: gridTemplate,
          alignItems: 'center',
          height: 36,
          background: '#FCFCFA',
          borderBottom: `1px solid ${colors.borderSubtle}`,
          position: 'sticky',
          top: 0,
          zIndex: 1,
        }}
      >
        {COLUMNS.map((col) => {
          const active = sortKey === col.key;
          return (
            <button
              key={col.key}
              type="button"
              role="columnheader"
              aria-sort={active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
              onClick={() => onHeaderClick(col.key)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                justifyContent: col.align === 'right' ? 'flex-end' : 'flex-start',
                padding: `0 ${spacing[3]}`,
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontFamily: typography.fontFamily,
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                color: active ? colors.textPrimary : colors.textTertiary,
                height: '100%',
              }}
            >
              {col.label}
              {active &&
                (sortDir === 'asc' ? (
                  <ChevronUp size={11} aria-hidden="true" />
                ) : (
                  <ChevronDown size={11} aria-hidden="true" />
                ))}
            </button>
          );
        })}
      </div>

      {/* Body */}
      {sorted.length === 0 ? (
        <div
          style={{
            padding: spacing[6],
            textAlign: 'center',
            color: colors.textTertiary,
            fontFamily: typography.fontFamily,
            fontSize: 13,
          }}
        >
          No punch items match the current filters.
        </div>
      ) : (
        sorted.map((item, idx) => {
          const focused = selectedId === item.id;
          const dueColor =
            item.verification_status === 'verified'
              ? colors.textTertiary
              : item.dueDate && new Date(item.dueDate) < new Date()
                ? colors.statusCritical
                : colors.textSecondary;

          return (
            <div
              key={item.id}
              role="row"
              aria-rowindex={idx + 1}
              aria-selected={focused}
              data-punch-id={item.id}
              ref={focused ? focusedRef : undefined}
              tabIndex={focused ? 0 : -1}
              onClick={() => onSelect(item.id)}
              style={{
                display: 'grid',
                gridTemplateColumns: gridTemplate,
                alignItems: 'center',
                height: ROW_HEIGHT,
                borderBottom: `1px solid ${colors.borderSubtle}`,
                background: focused ? '#F4F2EF' : 'transparent',
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              {/* # */}
              <div
                style={{
                  padding: `0 ${spacing[3]}`,
                  fontFamily: typography.fontFamilyMono,
                  fontSize: 12,
                  fontWeight: 500,
                  color: colors.textSecondary,
                  fontVariantNumeric: 'tabular-nums',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {item.itemNumber}
              </div>

              {/* Title */}
              <div
                style={{
                  padding: `0 ${spacing[3]}`,
                  fontFamily: typography.fontFamily,
                  fontSize: 13,
                  fontWeight: 500,
                  color: colors.textPrimary,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
                title={item.description}
              >
                {item.description || '(untitled)'}
              </div>

              {/* Trade */}
              <div
                style={{
                  padding: `0 ${spacing[3]}`,
                  fontFamily: typography.fontFamily,
                  fontSize: 12,
                  color: colors.textSecondary,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {item.trade || '—'}
              </div>

              {/* Location */}
              <div
                style={{
                  padding: `0 ${spacing[3]}`,
                  fontFamily: typography.fontFamily,
                  fontSize: 12,
                  color: colors.textSecondary,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
                title={item.area || item.location}
              >
                {item.area || item.location || '—'}
              </div>

              {/* Assigned */}
              <div
                style={{
                  padding: `0 ${spacing[3]}`,
                  fontFamily: typography.fontFamily,
                  fontSize: 12,
                  color: colors.textSecondary,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {item.assigned || '—'}
              </div>

              {/* Due */}
              <div
                style={{
                  padding: `0 ${spacing[3]}`,
                  fontFamily: typography.fontFamily,
                  fontSize: 12,
                  color: dueColor,
                  fontVariantNumeric: 'tabular-nums',
                  whiteSpace: 'nowrap',
                }}
              >
                {formatDueDate(item)}
              </div>

              {/* Status */}
              <div style={{ padding: `0 ${spacing[3]}` }}>
                <StatusDot status={item.verification_status} />
              </div>

              {/* Photos */}
              <div
                style={{
                  padding: `0 ${spacing[3]}`,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  justifyContent: 'flex-end',
                  fontFamily: typography.fontFamily,
                  fontSize: 12,
                  color: (item.photoCount ?? 0) > 0 ? colors.textSecondary : colors.textTertiary,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                <Camera size={12} aria-hidden="true" />
                {item.photoCount ?? 0}
              </div>

              {/* Verified by */}
              <div
                style={{
                  padding: `0 ${spacing[3]}`,
                  fontFamily: typography.fontFamily,
                  fontSize: 12,
                  color: colors.textSecondary,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {item.verified_by || (item.verification_status === 'verified' ? '—' : '')}
              </div>

              {/* Days Open */}
              <div
                style={{
                  padding: `0 ${spacing[3]}`,
                  textAlign: 'right',
                  fontFamily: typography.fontFamily,
                  fontSize: 12,
                  color:
                    daysOpen(item) > 14 && item.verification_status !== 'verified'
                      ? colors.statusCritical
                      : colors.textSecondary,
                  fontVariantNumeric: 'tabular-nums',
                  fontWeight:
                    daysOpen(item) > 14 && item.verification_status !== 'verified' ? 600 : 400,
                }}
              >
                {item.verification_status === 'verified' ? '—' : `${daysOpen(item)}d`}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
};

export default PunchListDenseTable;
