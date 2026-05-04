import React, { useMemo, useState } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { colors, typography, spacing } from '../../styles/theme';
import type { PunchItem } from './types';
import { PunchListDenseTable } from './PunchListDenseTable';

interface PunchListGroupedProps {
  items: PunchItem[];
  groupBy: 'trade' | 'location';
  selectedId: number | null;
  onSelect: (id: number) => void;
}

interface Group {
  key: string;
  label: string;
  items: PunchItem[];
  verifiedCount: number;
}

function groupItems(items: PunchItem[], groupBy: 'trade' | 'location'): Group[] {
  const map = new Map<string, PunchItem[]>();
  for (const item of items) {
    const key =
      groupBy === 'trade'
        ? (item.trade || 'Unassigned trade').trim()
        : (item.area || item.location || 'No location').trim();
    const arr = map.get(key) ?? [];
    arr.push(item);
    map.set(key, arr);
  }
  const groups: Group[] = [];
  for (const [key, arr] of map.entries()) {
    const verifiedCount = arr.filter((i) => i.verification_status === 'verified').length;
    groups.push({ key, label: key, items: arr, verifiedCount });
  }
  groups.sort((a, b) => a.label.localeCompare(b.label));
  return groups;
}

export const PunchListGrouped: React.FC<PunchListGroupedProps> = ({
  items,
  groupBy,
  selectedId,
  onSelect,
}) => {
  const groups = useMemo(() => groupItems(items, groupBy), [items, groupBy]);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const toggle = (key: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  if (groups.length === 0) {
    return (
      <div
        style={{
          padding: spacing[6],
          textAlign: 'center',
          color: colors.textTertiary,
          fontFamily: typography.fontFamily,
          fontSize: 13,
          background: colors.surfaceRaised,
          border: `1px solid ${colors.borderSubtle}`,
          borderRadius: 6,
        }}
      >
        No punch items match the current filters.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[3] }}>
      {groups.map((group) => {
        const isCollapsed = collapsed.has(group.key);
        const completionPct =
          group.items.length > 0
            ? Math.round((group.verifiedCount / group.items.length) * 100)
            : 0;
        return (
          <section
            key={group.key}
            aria-label={`${groupBy} group ${group.label}`}
            style={{
              background: colors.surfaceRaised,
              border: `1px solid ${colors.borderSubtle}`,
              borderRadius: 6,
              overflow: 'hidden',
            }}
          >
            <header
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: spacing[3],
                padding: `${spacing[2]} ${spacing[4]}`,
                borderBottom: isCollapsed ? 'none' : `1px solid ${colors.borderSubtle}`,
                background: '#FCFCFA',
                cursor: 'pointer',
              }}
              onClick={() => toggle(group.key)}
            >
              {isCollapsed ? (
                <ChevronRight size={14} color={colors.textTertiary} aria-hidden="true" />
              ) : (
                <ChevronDown size={14} color={colors.textTertiary} aria-hidden="true" />
              )}
              <span
                style={{
                  fontFamily: typography.fontFamily,
                  fontSize: 13,
                  fontWeight: 600,
                  color: colors.textPrimary,
                  letterSpacing: '0.01em',
                }}
              >
                {group.label}
              </span>
              <span
                style={{
                  fontFamily: typography.fontFamily,
                  fontSize: 11,
                  fontWeight: 500,
                  color: colors.textTertiary,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {group.items.length} {group.items.length === 1 ? 'item' : 'items'}
              </span>
              <div style={{ flex: 1 }} />
              <span
                style={{
                  fontFamily: typography.fontFamily,
                  fontSize: 12,
                  fontWeight: 500,
                  color: completionPct === 100 ? colors.moss : colors.textSecondary,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {completionPct}% verified
              </span>
              <div
                aria-hidden="true"
                style={{
                  width: 80,
                  height: 4,
                  background: '#EFE9DD',
                  borderRadius: 2,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${completionPct}%`,
                    height: '100%',
                    background: completionPct === 100 ? colors.moss : colors.textSecondary,
                  }}
                />
              </div>
            </header>
            {!isCollapsed && (
              <div>
                <PunchListDenseTable
                  items={group.items}
                  selectedId={selectedId}
                  onSelect={onSelect}
                />
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
};

export default PunchListGrouped;
