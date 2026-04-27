import { describe, it, expect, beforeEach } from 'vitest'
import { AnnotationHistory, type AnnotationShape } from './AnnotationHistory'

function shape(id: string): AnnotationShape {
  return {
    id,
    type: 'rectangle',
    coordinates: { x: 0, y: 0, width: 10, height: 10 },
    color: '#000',
    pageNumber: 1,
    createdBy: 'user',
    createdAt: '2026-01-01T00:00:00Z',
  }
}

let history: AnnotationHistory

beforeEach(() => {
  history = new AnnotationHistory()
})

describe('AnnotationHistory — initial state', () => {
  it('cannot undo or redo', () => {
    expect(history.canUndo).toBe(false)
    expect(history.canRedo).toBe(false)
  })

  it('undo returns null when stack is empty', () => {
    expect(history.undo()).toBeNull()
  })

  it('redo returns null when stack is empty', () => {
    expect(history.redo()).toBeNull()
  })
})

describe('AnnotationHistory — push', () => {
  it('after one push, canUndo is still false (need ≥2 entries to undo)', () => {
    history.push([shape('a')])
    expect(history.canUndo).toBe(false)
  })

  it('after two pushes, canUndo is true', () => {
    history.push([shape('a')])
    history.push([shape('a'), shape('b')])
    expect(history.canUndo).toBe(true)
  })

  it('push clears the redo stack (forward history is invalidated)', () => {
    history.push([shape('a')])
    history.push([shape('a'), shape('b')])
    history.undo()
    expect(history.canRedo).toBe(true)
    history.push([shape('c')])
    expect(history.canRedo).toBe(false)
  })

  it('snapshots are deep-copied (mutation of pushed state does not affect history)', () => {
    const live: AnnotationShape[] = [shape('a')]
    history.push(live)
    history.push([shape('a'), shape('b')])

    // Mutate the original array reference.
    live.push(shape('mutation'))

    // Undoing should return the original 1-element snapshot, not the mutated array.
    const after = history.undo()
    expect(after).toHaveLength(1)
    expect(after?.[0].id).toBe('a')
  })
})

describe('AnnotationHistory — undo / redo cycle', () => {
  it('undo returns the previous state', () => {
    history.push([shape('a')])
    history.push([shape('a'), shape('b')])
    const undone = history.undo()
    expect(undone).toHaveLength(1)
    expect(undone?.[0].id).toBe('a')
  })

  it('redo restores the most recently undone state', () => {
    history.push([shape('a')])
    history.push([shape('a'), shape('b')])
    history.undo()
    const redone = history.redo()
    expect(redone).toHaveLength(2)
    expect(redone?.[1].id).toBe('b')
  })

  it('multiple undo/redo cycles maintain consistency', () => {
    history.push([shape('a')])
    history.push([shape('a'), shape('b')])
    history.push([shape('a'), shape('b'), shape('c')])

    expect(history.canUndo).toBe(true)
    const after1Undo = history.undo()
    expect(after1Undo).toHaveLength(2)

    const after2Undo = history.undo()
    expect(after2Undo).toHaveLength(1)
    expect(history.canUndo).toBe(false)

    const after1Redo = history.redo()
    expect(after1Redo).toHaveLength(2)

    const after2Redo = history.redo()
    expect(after2Redo).toHaveLength(3)
    expect(history.canRedo).toBe(false)
  })
})

describe('AnnotationHistory — bounded by MAX_HISTORY', () => {
  it('does not exceed 50 entries on the undo stack', () => {
    for (let i = 0; i < 100; i++) history.push([shape(`s${i}`)])
    // canUndo === undoStack.length > 1, so still true.
    expect(history.canUndo).toBe(true)
    // After 99 undos, the stack should still produce values for at most ~49 of them.
    let undoneCount = 0
    while (history.canUndo) {
      history.undo()
      undoneCount++
      if (undoneCount > 100) break
    }
    expect(undoneCount).toBeLessThanOrEqual(49)
  })
})

describe('AnnotationHistory — clear', () => {
  it('resets both undo and redo stacks', () => {
    history.push([shape('a')])
    history.push([shape('a'), shape('b')])
    history.undo()
    expect(history.canUndo).toBe(false) // 1 left after undo (need ≥2)
    expect(history.canRedo).toBe(true)
    history.clear()
    expect(history.canUndo).toBe(false)
    expect(history.canRedo).toBe(false)
  })
})
