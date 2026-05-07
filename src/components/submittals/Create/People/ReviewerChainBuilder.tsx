// Phase 5b — Reviewer chain builder.
//
// Lives inside the UnifiedCreateModal's Full tier "People" section. Lets
// the user define the multi-reviewer chain when creating a submittal:
//   - add reviewers in order (sequence auto-increments)
//   - mark a reviewer as "review in parallel with previous" (parallel_group)
//   - set due-date offset days per step
//   - reorder via up/down arrows (drag-to-reorder lands in Phase 5b-2 with
//     @dnd-kit so the simple-arrow pattern doesn't bloat the bundle today)
//
// On Send, the parent UnifiedCreateModal calls
// submittalReviewerChainService.initialize(submittalId, steps) which fires
// the SECURITY-DEFINER RPC submittal_initialize_chain to materialize the
// chain + flip is_open on step 1.

import React, { useCallback, useMemo, useState } from 'react'
import {
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  GitBranch,
  Sparkles,
} from 'lucide-react'
import {
  renumberChain,
  validateReviewerChain,
} from '../../../../services/submittalReviewerChain'
import type { ReviewerChainStep } from '../../../../services/iris/submittalDraft'

const C = {
  ink: '#1A1613',
  ink2: '#5C5550',
  ink3: '#8C857E',
  ink4: '#C4BDB4',
  border: 'rgba(26, 22, 19, 0.10)',
  borderSubtle: 'rgba(26, 22, 19, 0.05)',
  surface: '#FCFCFA',
  surfaceInset: '#F5F5F1',
  brandOrange: '#F47820',
  active: '#2D8A6E',
  pending: '#C4850C',
  critical: '#C93B3B',
}

const FONT = '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'

const SUGGESTED_TEMPLATES: Array<{ label: string; steps: Array<Omit<ReviewerChainStep, 'uid' | 'sequence'>> }> = [
  {
    label: 'Standard 3-step (GC PE → Architect → Owner)',
    steps: [
      { reviewer_role: 'GC Project Engineer', reviewer_name: '', due_date_offset_days: 3, parallel_group: 0 },
      { reviewer_role: 'Architect of Record', reviewer_name: '', due_date_offset_days: 10, parallel_group: 0 },
      { reviewer_role: 'Owner Rep', reviewer_name: '', due_date_offset_days: 14, parallel_group: 0 },
    ],
  },
  {
    label: 'Architectural + Structural (parallel) + Owner',
    steps: [
      { reviewer_role: 'GC Project Engineer', reviewer_name: '', due_date_offset_days: 3, parallel_group: 0 },
      { reviewer_role: 'Architect of Record', reviewer_name: '', due_date_offset_days: 10, parallel_group: 1 },
      { reviewer_role: 'Structural Engineer', reviewer_name: '', due_date_offset_days: 10, parallel_group: 1 },
      { reviewer_role: 'Owner Rep', reviewer_name: '', due_date_offset_days: 14, parallel_group: 0 },
    ],
  },
  {
    label: 'Quick GC-only review',
    steps: [
      { reviewer_role: 'GC Project Engineer', reviewer_name: '', due_date_offset_days: 5, parallel_group: 0 },
    ],
  },
]

const newUid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `step_${Math.random().toString(36).slice(2)}_${Date.now()}`

export interface ReviewerChainBuilderProps {
  steps: ReviewerChainStep[]
  onChange: (steps: ReviewerChainStep[]) => void
}

export const ReviewerChainBuilder: React.FC<ReviewerChainBuilderProps> = ({ steps, onChange }) => {
  const [showTemplates, setShowTemplates] = useState(steps.length === 0)

  const validation = useMemo(() => validateReviewerChain(steps), [steps])

  const addStep = useCallback(() => {
    const next: ReviewerChainStep = {
      uid: newUid(),
      sequence: steps.length + 1,
      reviewer_role: '',
      reviewer_name: '',
      due_date_offset_days: 7,
      parallel_group: 0,
    }
    onChange([...steps, next])
    setShowTemplates(false)
  }, [steps, onChange])

  const applyTemplate = useCallback((tplIdx: number) => {
    const tpl = SUGGESTED_TEMPLATES[tplIdx]
    if (!tpl) return
    const newSteps: ReviewerChainStep[] = tpl.steps.map((s, idx) => ({
      uid: newUid(),
      sequence: idx + 1,
      ...s,
    }))
    onChange(newSteps)
    setShowTemplates(false)
  }, [onChange])

  const updateStep = useCallback((uid: string, patch: Partial<ReviewerChainStep>) => {
    onChange(renumberChain(steps.map((s) => (s.uid === uid ? { ...s, ...patch } : s))))
  }, [steps, onChange])

  const removeStep = useCallback((uid: string) => {
    onChange(renumberChain(steps.filter((s) => s.uid !== uid)))
  }, [steps, onChange])

  const moveStep = useCallback((uid: string, direction: 'up' | 'down') => {
    const idx = steps.findIndex((s) => s.uid === uid)
    if (idx < 0) return
    const target = direction === 'up' ? idx - 1 : idx + 1
    if (target < 0 || target >= steps.length) return
    const next = [...steps]
    ;[next[idx], next[target]] = [next[target], next[idx]]
    onChange(renumberChain(next))
  }, [steps, onChange])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <GitBranch size={12} color={C.ink2} />
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: C.ink2,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
          }}
        >
          Reviewer chain
        </span>
        {steps.length > 0 && (
          <span
            style={{
              fontSize: 11,
              color: C.ink3,
              fontWeight: 500,
            }}
          >
            · {steps.length} step{steps.length === 1 ? '' : 's'}
          </span>
        )}
        <span style={{ flex: 1 }} />
        {steps.length > 0 && (
          <button
            type="button"
            onClick={() => setShowTemplates((s) => !s)}
            style={ghostBtnStyle}
            title="Iris-suggested chain templates"
          >
            <Sparkles size={10} /> Templates
          </button>
        )}
      </header>

      {(showTemplates || steps.length === 0) && (
        <div
          style={{
            padding: '10px 12px',
            backgroundColor: 'rgba(244, 120, 32, 0.06)',
            border: '1px solid rgba(244, 120, 32, 0.18)',
            borderRadius: 6,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: C.brandOrange,
              letterSpacing: '0.07em',
              textTransform: 'uppercase',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Sparkles size={10} /> Iris suggests
          </span>
          {SUGGESTED_TEMPLATES.map((tpl, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => applyTemplate(idx)}
              style={{
                width: '100%',
                textAlign: 'left',
                padding: '6px 8px',
                fontSize: 12,
                fontWeight: 500,
                color: C.ink,
                backgroundColor: '#fff',
                border: `1px solid ${C.border}`,
                borderRadius: 4,
                cursor: 'pointer',
                fontFamily: FONT,
              }}
            >
              {tpl.label}
            </button>
          ))}
          <p style={{ margin: 0, fontSize: 11, color: C.ink3, lineHeight: 1.4 }}>
            Pick a template or hit + to add reviewers manually. Each step
            auto-advances when its reviewer responds. Parallel-group reviewers
            review at the same time.
          </p>
        </div>
      )}

      {steps.length > 0 && (
        <ol
          role="list"
          aria-label="Reviewer chain steps"
          style={{
            listStyle: 'none',
            padding: 0,
            margin: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          {steps.map((step, idx) => {
            const prev = steps[idx - 1]
            const sharesParallelWithPrev =
              step.parallel_group > 0 && prev?.parallel_group === step.parallel_group
            return (
              <StepRow
                key={step.uid}
                step={step}
                stepIndex={idx}
                lastIndex={steps.length - 1}
                sharesParallelWithPrev={sharesParallelWithPrev}
                onUpdate={(patch) => updateStep(step.uid, patch)}
                onRemove={() => removeStep(step.uid)}
                onMoveUp={() => moveStep(step.uid, 'up')}
                onMoveDown={() => moveStep(step.uid, 'down')}
              />
            )
          })}
        </ol>
      )}

      <button
        type="button"
        onClick={addStep}
        style={{
          alignSelf: 'flex-start',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          padding: '6px 10px',
          fontSize: 12,
          fontWeight: 600,
          color: C.brandOrange,
          backgroundColor: '#fff',
          border: `1px dashed ${C.brandOrange}`,
          borderRadius: 4,
          cursor: 'pointer',
          fontFamily: FONT,
        }}
      >
        <Plus size={11} /> Add reviewer
      </button>

      {!validation.valid && (
        <ul role="list" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {validation.errors.map((err, i) => (
            <li
              key={i}
              style={{
                fontSize: 11,
                color: C.critical,
                fontFamily: FONT,
                marginTop: 2,
              }}
            >
              ⚠ {err}
            </li>
          ))}
        </ul>
      )}

      <p style={{ margin: '4px 0 0', fontSize: 11, color: C.ink3, lineHeight: 1.4 }}>
        Phase 5b: roles + names captured as free-form strings. The typeahead
        picker (resolves to project_member uuids + email notifications) lands
        in Phase 5b-2.
      </p>
    </div>
  )
}

// ── Step row ───────────────────────────────────────────────────────────────

interface StepRowProps {
  step: ReviewerChainStep
  stepIndex: number
  lastIndex: number
  sharesParallelWithPrev: boolean
  onUpdate: (patch: Partial<ReviewerChainStep>) => void
  onRemove: () => void
  onMoveUp: () => void
  onMoveDown: () => void
}

const StepRow: React.FC<StepRowProps> = ({
  step,
  stepIndex,
  lastIndex,
  sharesParallelWithPrev,
  onUpdate,
  onRemove,
  onMoveUp,
  onMoveDown,
}) => (
  <li
    style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: 8,
      padding: '8px 10px',
      backgroundColor: '#fff',
      border: `1px solid ${C.borderSubtle}`,
      borderLeft: sharesParallelWithPrev
        ? `3px solid ${C.pending}`
        : `3px solid ${C.brandOrange}`,
      borderRadius: 4,
      fontFamily: FONT,
    }}
  >
    <span
      aria-hidden
      style={{
        flex: '0 0 22px',
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: sharesParallelWithPrev ? C.pending : C.brandOrange,
        color: '#fff',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 11,
        fontWeight: 700,
        marginTop: 1,
      }}
    >
      {step.sequence}
    </span>
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          type="text"
          value={step.reviewer_role}
          onChange={(e) => onUpdate({ reviewer_role: e.target.value })}
          placeholder="Role (e.g. Architect of Record)"
          aria-label={`Step ${step.sequence} role`}
          style={{ ...inputStyle, flex: 1 }}
        />
        <input
          type="text"
          value={step.reviewer_name}
          onChange={(e) => onUpdate({ reviewer_name: e.target.value })}
          placeholder="Name or email (Phase 5b-2: typeahead)"
          aria-label={`Step ${step.sequence} reviewer`}
          style={{ ...inputStyle, flex: 1 }}
        />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 11, color: C.ink3 }}>Due in</span>
          <input
            type="number"
            min={0}
            max={365}
            value={step.due_date_offset_days}
            onChange={(e) =>
              onUpdate({ due_date_offset_days: Math.max(0, Number(e.target.value) || 0) })
            }
            aria-label={`Step ${step.sequence} due in days`}
            style={{ ...inputStyle, width: 56, textAlign: 'right' }}
          />
          <span style={{ fontSize: 11, color: C.ink3 }}>days</span>
        </label>
        {stepIndex > 0 && (
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: C.ink2, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={sharesParallelWithPrev}
              onChange={(e) =>
                onUpdate({
                  parallel_group: e.target.checked ? (stepIndex || 1) : 0,
                })
              }
              aria-label={`Step ${step.sequence} reviews in parallel with previous`}
            />
            Parallel with previous
          </label>
        )}
      </div>
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 1 }}>
      <button
        type="button"
        onClick={onMoveUp}
        disabled={stepIndex === 0}
        aria-label="Move step up"
        title="Move up"
        style={iconBtnStyle}
      >
        <ChevronUp size={11} />
      </button>
      <button
        type="button"
        onClick={onMoveDown}
        disabled={stepIndex === lastIndex}
        aria-label="Move step down"
        title="Move down"
        style={iconBtnStyle}
      >
        <ChevronDown size={11} />
      </button>
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove step"
        title="Remove"
        style={{ ...iconBtnStyle, color: C.critical }}
      >
        <Trash2 size={11} />
      </button>
    </div>
  </li>
)

// ── Styles ─────────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  padding: '6px 8px',
  border: `1px solid ${C.border}`,
  borderRadius: 3,
  fontSize: 12,
  fontFamily: FONT,
  color: C.ink,
  backgroundColor: '#fff',
  outline: 'none',
}

const iconBtnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 22,
  height: 22,
  border: `1px solid ${C.borderSubtle}`,
  backgroundColor: '#fff',
  color: C.ink2,
  cursor: 'pointer',
  borderRadius: 3,
  padding: 0,
}

const ghostBtnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 3,
  padding: '3px 7px',
  fontSize: 10,
  fontWeight: 600,
  color: C.brandOrange,
  backgroundColor: 'transparent',
  border: 'none',
  cursor: 'pointer',
  fontFamily: FONT,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
}

export default ReviewerChainBuilder
