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
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <motion.div whileHover={{ y: -1 }}>
        {renderCard(item)}
      </motion.div>
    </div>
  )
}

function KanbanBoardInner<T>({ columns, renderCard, getKey, onMoveItem }: KanbanBoardProps<T>) {
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

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${columns.length}, 1fr)`,
        gap: spacing['4'],
        minHeight: '400px',
        alignItems: 'flex-start',
      }}>
        {columns.map((col) => {
          const itemIds = col.items.map((item) => String(getKey(item)))
          const isDropTarget = overColumnId === col.id && activeId !== null

          return (
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
              <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
                <div style={{
                  display: 'flex', flexDirection: 'column', gap: spacing['2'],
                  padding: spacing['2'], backgroundColor: isDropTarget ? colors.surfaceHover : colors.surfaceInset,
                  borderRadius: borderRadius.md, minHeight: '100px', flex: 1,
                  transition: `background-color ${transitions.quick}`,
                  border: isDropTarget ? `1px dashed ${colors.borderFocus}` : '1px dashed transparent',
                }}>
                  {col.items.map((item) => (
                    <SortableCard key={getKey(item)} item={item} renderCard={renderCard} getKey={getKey} />
                  ))}
                  {col.items.length === 0 && (
                    <div style={{ padding: spacing['4'], textAlign: 'center', color: colors.textTertiary, fontSize: typography.fontSize.caption }}>
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
