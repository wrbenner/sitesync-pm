// Phase 6 — compact workflow chain visualization (Overview tab).
//
// Per spec Phase 6 acceptance bar: "Workflow chain visualization in this
// phase is the **compact** version — names + statuses only. The full chain
// table with sent/due/returned dates per reviewer ships in Phase 7."
//
// Phase 7 replaces this with the dense table in
// `src/components/submittals/detail/Overview/WorkflowChainTable.tsx`.

import React from 'react'
import { CheckCircle2, Circle, Clock, X } from 'lucide-react'

const C = {
  ink: '#1A1613',
  ink2: '#5C5550',
  ink3: '#8C857E',
  ink4: '#C4BDB4',
  border: 'rgba(26, 22, 19, 0.10)',
  borderSubtle: 'rgba(26, 22, 19, 0.05)',
  active: '#2D8A6E',
  pending: '#C4850C',
  critical: '#C93B3B',
  brandOrange: '#F47820',
}

const FONT = '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'

export interface WorkflowChainStep {
  id: string
  sequence: number
  reviewer_name: string | null
  reviewer_role: string | null
  responded_at: string | null
  disposition: string | null
  is_current: boolean
  is_parallel: boolean
}

export interface CompactWorkflowChainProps {
  steps: WorkflowChainStep[]
}

export const CompactWorkflowChain: React.FC<CompactWorkflowChainProps> = ({ steps }) => {
  if (steps.length === 0) {
    return (
      <section
        aria-label="Workflow chain"
        style={{
          backgroundColor: '#fff',
          border: `1px solid ${C.border}`,
          borderRadius: 6,
          padding: '14px 18px',
          fontFamily: FONT,
        }}
      >
        <h3 style={headingStyle}>Workflow Chain</h3>
        <p style={{ margin: 0, fontSize: 12, color: C.ink3 }}>
          No reviewer chain configured yet. Apply a workflow template to begin.
        </p>
      </section>
    )
  }

  return (
    <section
      aria-label="Workflow chain"
      style={{
        backgroundColor: '#fff',
        border: `1px solid ${C.border}`,
        borderRadius: 6,
        padding: '14px 18px',
        fontFamily: FONT,
      }}
    >
      <h3 style={headingStyle}>Workflow Chain</h3>
      <ol
        style={{
          listStyle: 'none',
          padding: 0,
          margin: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}
      >
        {steps.map((step, idx) => (
          <Step key={step.id} step={step} isLast={idx === steps.length - 1} />
        ))}
      </ol>
      <p style={{ margin: '12px 0 0', fontSize: 11, color: C.ink3, lineHeight: 1.4 }}>
        Compact view (names + statuses only). Phase 7 ships the full chain
        table with sent/due/returned dates per reviewer.
      </p>
    </section>
  )
}

const headingStyle: React.CSSProperties = {
  margin: '0 0 10px',
  fontSize: 11,
  fontWeight: 600,
  color: C.ink3,
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
}

interface StepProps {
  step: WorkflowChainStep
  isLast: boolean
}

const Step: React.FC<StepProps> = ({ step, isLast }) => {
  const status = inferStatus(step)
  return (
    <li style={{ position: 'relative' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '8px 10px',
          backgroundColor: step.is_current ? 'rgba(244, 120, 32, 0.05)' : 'transparent',
          borderRadius: 4,
          border: step.is_current ? `1px solid ${C.brandOrange}` : `1px solid transparent`,
        }}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 22,
            height: 22,
            borderRadius: 11,
            backgroundColor: 'rgba(26, 22, 19, 0.05)',
            color: C.ink2,
            fontSize: 11,
            fontWeight: 600,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {step.sequence}
        </span>
        <StatusIcon status={status} />
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: C.ink, lineHeight: 1.2 }}>
            {step.reviewer_name ?? <em style={{ color: C.ink3, fontStyle: 'normal' }}>Unassigned</em>}
            {step.is_parallel && (
              <span
                style={{
                  marginLeft: 6,
                  fontSize: 10,
                  color: C.ink3,
                  fontWeight: 500,
                  padding: '1px 5px',
                  borderRadius: 3,
                  backgroundColor: C.borderSubtle,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
                title="Reviews in parallel with another step"
              >
                parallel
              </span>
            )}
          </span>
          {step.reviewer_role && (
            <span style={{ fontSize: 11, color: C.ink3 }}>
              {step.reviewer_role}
            </span>
          )}
        </div>
        <StatusBadge status={status} disposition={step.disposition} />
      </div>
      {!isLast && (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            left: 21,
            top: '100%',
            width: 1,
            height: 6,
            backgroundColor: C.borderSubtle,
          }}
        />
      )}
    </li>
  )
}

type Status = 'done' | 'current' | 'pending' | 'rejected'

function inferStatus(step: WorkflowChainStep): Status {
  if (step.disposition && /reject|fail/i.test(step.disposition)) return 'rejected'
  if (step.responded_at) return 'done'
  if (step.is_current) return 'current'
  return 'pending'
}

const StatusIcon: React.FC<{ status: Status }> = ({ status }) => {
  if (status === 'done') return <CheckCircle2 size={14} color={C.active} />
  if (status === 'rejected') return <X size={14} color={C.critical} />
  if (status === 'current') return <Clock size={14} color={C.pending} />
  return <Circle size={14} color={C.ink4} />
}

const StatusBadge: React.FC<{ status: Status; disposition: string | null }> = ({ status, disposition }) => {
  if (status === 'done' && disposition) {
    return (
      <span style={{ fontSize: 11, color: C.active, fontWeight: 600 }}>
        {disposition.replace(/_/g, ' ')}
      </span>
    )
  }
  if (status === 'current') {
    return <span style={{ fontSize: 11, color: C.pending, fontWeight: 600 }}>In review</span>
  }
  if (status === 'rejected') {
    return <span style={{ fontSize: 11, color: C.critical, fontWeight: 600 }}>Rejected</span>
  }
  return <span style={{ fontSize: 11, color: C.ink3 }}>Pending</span>
}

export default CompactWorkflowChain
