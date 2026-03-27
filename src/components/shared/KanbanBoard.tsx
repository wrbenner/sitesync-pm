import React from 'react';
import { colors, spacing, typography, borderRadius, shadows, transitions } from '../../styles/theme';

export interface KanbanColumn<T> {
  id: string;
  label: string;
  color: string;
  items: T[];
}

interface KanbanBoardProps<T> {
  columns: KanbanColumn<T>[];
  renderCard: (item: T) => React.ReactNode;
  getKey: (item: T) => string | number;
}

export function KanbanBoard<T>({ columns, renderCard, getKey }: KanbanBoardProps<T>) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(${columns.length}, 1fr)`,
      gap: spacing['4'],
      minHeight: '400px',
      alignItems: 'flex-start',
    }}>
      {columns.map((col) => (
        <div key={col.id} style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          {/* Column header */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: spacing['2'],
            padding: `${spacing['2']} ${spacing['3']}`, marginBottom: spacing['3'],
          }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: col.color }} />
            <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>{col.label}</span>
            <span style={{
              fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium,
              color: colors.textTertiary, backgroundColor: colors.surfaceInset,
              padding: `0 ${spacing['2']}`, borderRadius: borderRadius.full, minWidth: '20px', textAlign: 'center',
            }}>
              {col.items.length}
            </span>
          </div>

          {/* Cards */}
          <div style={{
            display: 'flex', flexDirection: 'column', gap: spacing['2'],
            padding: spacing['2'], backgroundColor: colors.surfaceInset,
            borderRadius: borderRadius.md, minHeight: '100px', flex: 1,
          }}>
            {col.items.map((item) => (
              <div key={getKey(item)} style={{
                backgroundColor: colors.surfaceRaised,
                borderRadius: borderRadius.md,
                boxShadow: shadows.card,
                overflow: 'hidden',
                transition: `box-shadow ${transitions.instant}`,
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = shadows.cardHover; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = shadows.card; }}
              >
                {renderCard(item)}
              </div>
            ))}
            {col.items.length === 0 && (
              <div style={{ padding: spacing['4'], textAlign: 'center', color: colors.textTertiary, fontSize: typography.fontSize.caption }}>
                No items
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
