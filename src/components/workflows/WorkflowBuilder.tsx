/**
 * WorkflowBuilder — drag-drop visual workflow builder.
 *
 * Native pointer events only (no external dnd library — repo doesn't pull
 * in dnd-kit's whole graph for one editor; we use the lightweight pattern).
 *
 * Validation is run on every change; the Save button is disabled if
 * validateGraph reports errors. Cyclic edges get a red ring.
 */

import React, { useMemo, useState, useCallback, useRef } from 'react'
import { colors, spacing, typography, borderRadius } from '../../styles/theme'
import { Eyebrow, Hairline, SectionHeading } from '../atoms'
import { WorkflowStep } from './WorkflowStep'
import { validateGraph } from '../../lib/workflows/validators'
import type { WorkflowDefinition, ValidationIssue } from '../../types/workflows'

export interface WorkflowBuilderProps {
  initial: WorkflowDefinition
  onSave: (def: WorkflowDefinition) => Promise<void> | void
}

interface NodePos {
  [stepId: string]: { x: number; y: number }
}

function autoLayout(def: WorkflowDefinition): NodePos {
  // Simple BFS layered layout.
  const layers: string[][] = []
  const seen = new Set<string>()
  let frontier = [def.start_step]
  while (frontier.length > 0) {
    layers.push(frontier)
    frontier.forEach((id) => seen.add(id))
    const next: string[] = []
    for (const id of frontier) {
      const step = def.steps.find((s) => s.id === id)
      if (!step) continue
      for (const t of step.transitions) {
        if (!seen.has(t.to) && !next.includes(t.to)) next.push(t.to)
      }
    }
    frontier = next
  }
  // Place orphans on a final row.
  const orphans = def.steps.filter((s) => !seen.has(s.id)).map((s) => s.id)
  if (orphans.length > 0) layers.push(orphans)

  const pos: NodePos = {}
  layers.forEach((row, rowIdx) => {
    row.forEach((id, colIdx) => {
      pos[id] = { x: 60 + colIdx * 240, y: 40 + rowIdx * 130 }
    })
  })
  return pos
}

export const WorkflowBuilder: React.FC<WorkflowBuilderProps> = ({ initial, onSave }) => {
  const [def, setDef] = useState<WorkflowDefinition>(initial)
  const [positions, setPositions] = useState<NodePos>(() => autoLayout(initial))
  const [selectedStep, setSelectedStep] = useState<string | null>(null)
  const draggingRef = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  const validation = useMemo(() => validateGraph(def), [def])
  const errorIssues = validation.issues.filter((i) => i.level === 'error')
  const warnIssues = validation.issues.filter((i) => i.level === 'warning')

  const stepHasError = useCallback(
    (stepId: string): boolean => errorIssues.some((i) => i.step_id === stepId),
    [errorIssues],
  )

  const handlePointerDown = useCallback(
    (e: React.PointerEvent, stepId: string) => {
      if (!containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const pos = positions[stepId]
      if (!pos) return
      draggingRef.current = {
        id: stepId,
        offsetX: e.clientX - rect.left - pos.x,
        offsetY: e.clientY - rect.top - pos.y,
      }
    },
    [positions],
  )

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!draggingRef.current || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const id = draggingRef.current.id
    const x = e.clientX - rect.left - draggingRef.current.offsetX
    const y = e.clientY - rect.top - draggingRef.current.offsetY
    setPositions((p) => ({ ...p, [id]: { x: Math.max(0, x), y: Math.max(0, y) } }))
  }, [])

  const handlePointerUp = useCallback(() => {
    draggingRef.current = null
  }, [])

  const updateStepName = useCallback((stepId: string, name: string) => {
    setDef((d) => ({
      ...d,
      steps: d.steps.map((s) => (s.id === stepId ? { ...s, name } : s)),
    }))
  }, [])

  const updateStepCondition = useCallback((stepId: string, transitionIndex: number, when: string) => {
    setDef((d) => ({
      ...d,
      steps: d.steps.map((s) => {
        if (s.id !== stepId) return s
        const transitions = s.transitions.map((t, i) => (i === transitionIndex ? { ...t, when: when || undefined } : t))
        return { ...s, transitions }
      }),
    }))
  }, [])

  const addStep = useCallback(() => {
    const id = `step_${Date.now()}`
    setDef((d) => ({
      ...d,
      steps: [...d.steps, { id, name: 'New step', transitions: [] }],
    }))
    setPositions((p) => ({ ...p, [id]: { x: 60, y: 60 + Object.keys(p).length * 130 } }))
  }, [])

  const handleSave = useCallback(async () => {
    if (!validation.valid) return
    await onSave(def)
  }, [def, validation.valid, onSave])

  const selected = selectedStep ? def.steps.find((s) => s.id === selectedStep) : null

  return (
    <div style={{ display: 'flex', height: '100%', minHeight: 600 }}>
      {/* Canvas */}
      <div
        ref={containerRef}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        style={{
          flex: 1,
          position: 'relative',
          overflow: 'auto',
          backgroundColor: colors.surfaceInset,
          backgroundImage: 'radial-gradient(circle, rgba(0,0,0,0.04) 1px, transparent 1px)',
          backgroundSize: '20px 20px',
        }}
      >
        {/* SVG layer for transition arrows */}
        <svg
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
          }}
        >
          {def.steps.flatMap((step) =>
            step.transitions.map((t, i) => {
              const from = positions[step.id]
              const to = positions[t.to]
              if (!from || !to) return null
              const x1 = from.x + 90
              const y1 = from.y + 50
              const x2 = to.x + 90
              const y2 = to.y
              const isError = errorIssues.some((iss) => iss.step_id === step.id && iss.transition_index === i)
              return (
                <line
                  key={`${step.id}-${i}`}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={isError ? '#dc2626' : '#94a3b8'}
                  strokeWidth={isError ? 2 : 1}
                  strokeDasharray={t.when ? '4,3' : undefined}
                />
              )
            }),
          )}
        </svg>

        {def.steps.map((step) => (
          <WorkflowStep
            key={step.id}
            step={step}
            position={positions[step.id] ?? { x: 60, y: 60 }}
            selected={selectedStep === step.id}
            hasError={stepHasError(step.id)}
            onPointerDown={(e) => handlePointerDown(e, step.id)}
            onClick={() => setSelectedStep(step.id)}
          />
        ))}
      </div>

      {/* Side panel */}
      <aside
        style={{
          width: 320,
          padding: spacing['4'],
          borderLeft: `1px solid ${colors.borderSubtle}`,
          backgroundColor: colors.surfaceRaised,
          overflow: 'auto',
        }}
      >
        <Eyebrow>Workflow · v{def.version}</Eyebrow>
        <SectionHeading level={3} style={{ marginTop: spacing['2'] }}>{def.name}</SectionHeading>
        <Hairline spacing="tight" />

        {selected ? (
          <>
            <Eyebrow>Selected step</Eyebrow>
            <input
              type="text"
              value={selected.name}
              onChange={(e) => updateStepName(selected.id, e.target.value)}
              aria-label="Step name"
              style={{
                width: '100%',
                marginTop: spacing['2'],
                padding: spacing['2'],
                fontSize: typography.fontSize.sm,
                border: `1px solid ${colors.borderSubtle}`,
                borderRadius: borderRadius.sm,
              }}
            />
            <div style={{ marginTop: spacing['3'], fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
              ID: {selected.id}
            </div>
            <Hairline spacing="tight" />
            <Eyebrow>Transitions</Eyebrow>
            {selected.transitions.length === 0 && (
              <div style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, marginTop: spacing['2'] }}>
                No outgoing transitions.
              </div>
            )}
            {selected.transitions.map((t, i) => (
              <div key={i} style={{ marginTop: spacing['3'] }}>
                <div style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
                  → {t.to} {t.on_event ? `(${t.on_event.join(', ')})` : ''}
                </div>
                <input
                  type="text"
                  placeholder="Conditional (e.g. cost_impact > 50000)"
                  value={t.when ?? ''}
                  onChange={(e) => updateStepCondition(selected.id, i, e.target.value)}
                  aria-label={`Condition for transition ${i}`}
                  style={{
                    width: '100%',
                    marginTop: spacing['1'],
                    padding: spacing['2'],
                    fontSize: typography.fontSize.sm,
                    border: `1px solid ${colors.borderSubtle}`,
                    borderRadius: borderRadius.sm,
                    fontFamily: 'ui-monospace, monospace',
                  }}
                />
              </div>
            ))}
          </>
        ) : (
          <div style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary }}>
            Click a step on the canvas to edit it.
          </div>
        )}

        <Hairline />
        <Eyebrow>Validation</Eyebrow>
        {errorIssues.length === 0 && warnIssues.length === 0 && (
          <div style={{ marginTop: spacing['2'], fontSize: typography.fontSize.sm, color: colors.textTertiary }}>
            No issues.
          </div>
        )}
        {errorIssues.map((iss, i) => (
          <ValidationLine key={`e-${i}`} issue={iss} />
        ))}
        {warnIssues.map((iss, i) => (
          <ValidationLine key={`w-${i}`} issue={iss} />
        ))}

        <Hairline />
        <button
          type="button"
          onClick={addStep}
          style={buttonStyle('ghost')}
        >
          + Add step
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!validation.valid}
          style={{
            ...buttonStyle(validation.valid ? 'primary' : 'disabled'),
            marginTop: spacing['2'],
          }}
        >
          Save workflow
        </button>
      </aside>
    </div>
  )
}

const ValidationLine: React.FC<{ issue: ValidationIssue }> = ({ issue }) => (
  <div
    style={{
      marginTop: spacing['1'],
      fontSize: typography.fontSize.caption,
      color: issue.level === 'error' ? '#dc2626' : colors.textSecondary,
    }}
  >
    {issue.level === 'error' ? '✗' : '!'} {issue.message}
  </div>
)

function buttonStyle(variant: 'primary' | 'ghost' | 'disabled'): React.CSSProperties {
  if (variant === 'primary') {
    return {
      width: '100%',
      padding: spacing['2'],
      backgroundColor: colors.primaryOrange,
      color: colors.white,
      border: 'none',
      borderRadius: borderRadius.md,
      fontSize: typography.fontSize.sm,
      fontWeight: typography.fontWeight.semibold,
      cursor: 'pointer',
      fontFamily: typography.fontFamily,
    }
  }
  if (variant === 'disabled') {
    return {
      width: '100%',
      padding: spacing['2'],
      backgroundColor: colors.surfaceDisabled,
      color: colors.textDisabled,
      border: 'none',
      borderRadius: borderRadius.md,
      fontSize: typography.fontSize.sm,
      cursor: 'not-allowed',
      fontFamily: typography.fontFamily,
    }
  }
  return {
    width: '100%',
    padding: spacing['2'],
    backgroundColor: 'transparent',
    color: colors.textSecondary,
    border: `1px solid ${colors.borderDefault}`,
    borderRadius: borderRadius.md,
    fontSize: typography.fontSize.sm,
    cursor: 'pointer',
    fontFamily: typography.fontFamily,
  }
}

export default WorkflowBuilder
