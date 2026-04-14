import React, { useState, useCallback } from 'react'
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { motion } from 'framer-motion'
import { colors, spacing, typography, borderRadius, shadows, transitions } from '../../styles/theme'

export interface KanbanColumn<T> {
  id: string
  label: string
  color: string
  items: T[]
}

interface KanbanBoardProps<T> {
  columns: KanbanColumn<T>[]
  renderCard: (item: T) => React.ReactNode
  getKey: (item: T) => string | number
  onMoveItem?: (itemId: string | number, fromColumn: string, toColumn: string) => void
  loading?: boolean
}

const SKELETON_PULSE: React.CSSProperties = {
  backgroundColor: colors.surfaceInset,
  animation: 'pulse 1.5s ease-in-out infinite',
  borderRadius: borderRadius.base,
}

function KanbanSkeleton({ columnCount = 4, cardsPerColumn = 3 }: { columnCount?: number; cardsPerColumn?: number }) {
  return (
    <div
      aria-hidden="true"
      aria-label="Loading board"
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${columnCount}, 1fr)`,
        gap: spacing['4'],
        minHeight: '400px',
        alignItems: 'flex-start',
      }}
    >
      {Array.from({ length: columnCount }).map((_, ci) => (
        <div key={ci} style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], padding: `${spacing['2']} ${spacing['3']}`, marginBottom: spacing['3'] }}>
            <div style={{ ...SKELETON_PULSE, width: 8, height: 8, borderRadius: '50%' }} />
            <div style={{ ...SKELETON_PULSE, width: '60%', height: 14 }} />
            <div style={{ ...SKELETON_PULSE, width: 20, height: 16, borderRadius: borderRadius.full }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2'], padding: spacing['2'], backgroundColor: colors.surfaceInset, borderRadius: borderRadius.md, minHeight: '100px' }}>
            {Array.from({ length: cardsPerColumn }).map((_, ri) => (
              <div key={ri} style={{ ...SKELETON_PULSE, height: 72, borderRadius: borderRadius.md }} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function SortableCard<T>({ item, renderCard, getKey }: { item: T; renderCard: (item: T) => React.ReactNode; getKey: (item: T) => string | number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: String(getKey(item)),
  })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    backgroundColor: colors.surfaceRaised,
    borderRadius: borderRadius.md,
    boxShadow: isDragging ? shadows.cardHover : shadows.card,
    overflow: 'hidden',
    cursor: 'grab',
    outline: 'none',
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onFocus={(e) => {
        // Show a visible focus ring on keyboard focus (not pointer focus)
        e.currentTarget.style.boxShadow = `0 0 0 2px ${colors.primaryOrange}`;
      }}
      onBlur={(e) => {
        e.currentTarget.style.boxShadow = isDragging ? shadows.cardHover : shadows.card;
      }}
    >
      <motion.div whileHover={{ y: -1 }}>
        {renderCard(item)}
      </motion.div>
    </div>
  )
}

function KanbanBoardInner<T>({ columns, renderCard, getKey, onMoveItem, loading = false }: KanbanBoardProps<T>) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [overColumnId, setOverColumnId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  )

  const findColumnForItem = useCallback((itemId: string): string | undefined => {
    for (const col of columns) {
      if (col.items.some((item) => String(getKey(item)) === itemId)) {
        return col.id
      }
    }
    return undefined
  }, [columns, getKey])

  const findItem = useCallback((itemId: string): T | undefined => {
    for (const col of columns) {
      const found = col.items.find((item) => String(getKey(item)) === itemId)
      if (found) return found
    }
    return undefined
  }, [columns, getKey])

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(String(event.active.id))
  }, [])

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { over } = event
    if (!over) {
      setOverColumnId(null)
      return
    }

    const overId = String(over.id)

    // Check if hovering over a column directly
    const directColumn = columns.find((col) => col.id === overId)
    if (directColumn) {
      setOverColumnId(directColumn.id)
      return
    }

    // Otherwise find which column the hovered item belongs to
    const targetColumn = findColumnForItem(overId)
    setOverColumnId(targetColumn ?? null)
  }, [columns, findColumnForItem])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)
    setOverColumnId(null)

    if (!over || !onMoveItem) return

    const activeItemId = String(active.id)
    const sourceColumn = findColumnForItem(activeItemId)
    if (!sourceColumn) return

    const overId = String(over.id)

    // Determine destination column: either a column id or the column of the target item
    let destColumn = columns.find((col) => col.id === overId)?.id
    if (!destColumn) {
      destColumn = findColumnForItem(overId)
    }

    if (destColumn && destColumn !== sourceColumn) {
      const originalKey = columns
        .flatMap((col) => col.items)
        .find((item) => String(getKey(item)) === activeItemId)
      if (originalKey !== undefined) {
        onMoveItem(getKey(originalKey), sourceColumn, destColumn)
      }
    }
  }, [columns, findColumnForItem, getKey, onMoveItem])

  const activeItem = activeId ? findItem(activeId) : undefined

  if (loading) {
    return <KanbanSkeleton columnCount={columns.length || 4} />
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      accessibility={{
        announcements: {
          onDragStart: ({ active }) => `Picked up item ${active.id}. Use arrow keys to move between columns.`,
          onDragOver: ({ active, over }) => over ? `Item ${active.id} is over ${over.id}.` : `Item ${active.id} is no longer over a drop zone.`,
          onDragEnd: ({ active, over }) => over ? `Item ${active.id} was dropped into ${over.id}.` : `Item ${active.id} was dropped.`,
          onDragCancel: ({ active }) => `Drag cancelled. Item ${active.id} was returned to its original position.`,
        },
      }}
    >
      <div
        role="group"
        aria-label="Kanban board"
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${columns.length}, 1fr)`,
          gap: spacing['4'],
          minHeight: '400px',
          alignItems: 'flex-start',
        }}
      >
        {columns.map((col) => {
          const itemIds = col.items.map((item) => String(getKey(item)))
          const isDropTarget = overColumnId === col.id && activeId !== null

          return (
            <div
              key={col.id}
              role="region"
              aria-label={`${col.label} column, ${col.items.length} item${col.items.length !== 1 ? 's' : ''}`}
              style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}
            >
              {/* Column header */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: spacing['2'],
                padding: `${spacing['2']} ${spacing['3']}`, marginBottom: spacing['3'],
              }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: col.color }} aria-hidden="true" />
                <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>{col.label}</span>
                <span
                  aria-hidden="true"
                  style={{
                    fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium,
                    color: colors.textTertiary, backgroundColor: colors.surfaceInset,
                    padding: `0 ${spacing['2']}`, borderRadius: borderRadius.full, minWidth: '20px', textAlign: 'center',
                  }}
                >
                  {col.items.length}
                </span>
              </div>

              {/* Cards */}
              <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
                <div
                  role="list"
                  aria-label={`${col.label} items`}
                  style={{
                    display: 'flex', flexDirection: 'column', gap: spacing['2'],
                    padding: spacing['2'], backgroundColor: isDropTarget ? colors.surfaceHover : colors.surfaceInset,
                    borderRadius: borderRadius.md, minHeight: '100px', flex: 1,
                    transition: `background-color ${transitions.quick}`,
                    border: isDropTarget ? `1px dashed ${colors.borderFocus}` : '1px dashed transparent',
                  }}
                >
                  {col.items.map((item) => (
                    <SortableCard key={getKey(item)} item={item} renderCard={renderCard} getKey={getKey} />
                  ))}
                  {col.items.length === 0 && (
                    <div
                      role="status"
                      aria-label={`No items in ${col.label}`}
                      style={{ padding: spacing['4'], textAlign: 'center', color: colors.textTertiary, fontSize: typography.fontSize.caption }}
                    >
                      No items
                    </div>
                  )}
                </div>
              </SortableContext>
            </div>
          )
        })}
      </div>

      <DragOverlay>
        {activeItem ? (
          <div style={{
            backgroundColor: colors.surfaceRaised,
            borderRadius: borderRadius.md,
            boxShadow: shadows.dropdown,
            overflow: 'hidden',
            transform: 'scale(1.03)',
            cursor: 'grabbing',
          }}>
            {renderCard(activeItem)}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}

export const KanbanBoard = React.memo(KanbanBoardInner) as typeof KanbanBoardInner
