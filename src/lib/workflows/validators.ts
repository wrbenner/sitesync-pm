/**
 * Workflow graph validators.
 *
 * Enforces:
 *   • Every step is reachable from start_step.
 *   • No cycles (every path from start eventually reaches a terminal step).
 *   • At least one terminal step exists.
 *   • No duplicate step ids.
 *   • Every transition target exists.
 *   • Expressions parse (caller validates them via runner.evaluateExpression
 *     when they want a specific entity-shape sanity check).
 *   • WARN: a step whose transitions all carry `when` clauses with no
 *     fallback (no unconditional transition) — risk of "stuck" entity.
 */

import type {
  WorkflowDefinition,
  ValidationResult,
  ValidationIssue,
} from '../../types/workflows'
import { evaluateExpression } from './runner'

export function validateGraph(def: WorkflowDefinition): ValidationResult {
  const issues: ValidationIssue[] = []

  // 1. Duplicate step ids.
  const seen = new Set<string>()
  for (const s of def.steps) {
    if (seen.has(s.id)) {
      issues.push({
        level: 'error',
        code: 'DUPLICATE_STEP',
        message: `Duplicate step id: ${s.id}`,
        step_id: s.id,
      })
    }
    seen.add(s.id)
  }

  // 2. Start step exists.
  if (!seen.has(def.start_step)) {
    issues.push({
      level: 'error',
      code: 'MISSING_START',
      message: `start_step '${def.start_step}' is not defined in steps[]`,
    })
    return { valid: false, issues }
  }

  // 3. Terminal step exists.
  const hasTerminal = def.steps.some((s) => s.terminal === true)
  if (!hasTerminal) {
    issues.push({
      level: 'error',
      code: 'NO_TERMINAL',
      message: 'Workflow has no terminal step',
    })
  }

  // 4. Every transition target exists.
  const stepMap = new Map(def.steps.map((s) => [s.id, s]))
  for (const s of def.steps) {
    s.transitions.forEach((t, idx) => {
      if (!stepMap.has(t.to)) {
        issues.push({
          level: 'error',
          code: 'BAD_TRANSITION_TARGET',
          message: `Transition ${idx} on step ${s.id} targets unknown step '${t.to}'`,
          step_id: s.id,
          transition_index: idx,
        })
      }
      if (t.when) {
        // Probe-evaluate against an empty entity to check parse only. We
        // ignore the truthy result; we only care whether it parses.
        const probe = evaluateExpression(t.when, {})
        if (!probe.ok) {
          issues.push({
            level: 'error',
            code: 'BAD_EXPRESSION',
            message: `Transition ${idx} on step ${s.id} has malformed expression: ${probe.error}`,
            step_id: s.id,
            transition_index: idx,
          })
        }
      }
    })
  }

  // 5. Reachability from start.
  const reachable = new Set<string>()
  const stack = [def.start_step]
  while (stack.length > 0) {
    const cur = stack.pop()!
    if (reachable.has(cur)) continue
    reachable.add(cur)
    const step = stepMap.get(cur)
    if (!step) continue
    for (const t of step.transitions) {
      if (stepMap.has(t.to)) stack.push(t.to)
    }
  }
  for (const s of def.steps) {
    if (!reachable.has(s.id)) {
      issues.push({
        level: 'error',
        code: 'UNREACHABLE_STEP',
        message: `Step '${s.id}' is unreachable from start_step '${def.start_step}'`,
        step_id: s.id,
      })
    }
  }

  // 6. Cycle detection — every path from start must reach a terminal.
  // We do this by walking forward and asserting no node is revisited on the
  // current path. Branches reconverging is fine; a back edge is a cycle.
  function hasCycleFrom(stepId: string, onPath: Set<string>, memo: Map<string, boolean>): boolean {
    if (onPath.has(stepId)) return true
    const cached = memo.get(stepId)
    if (cached !== undefined) return cached
    const step = stepMap.get(stepId)
    if (!step) return false
    if (step.terminal) { memo.set(stepId, false); return false }
    onPath.add(stepId)
    let foundCycle = false
    for (const t of step.transitions) {
      if (!stepMap.has(t.to)) continue
      if (hasCycleFrom(t.to, onPath, memo)) { foundCycle = true; break }
    }
    onPath.delete(stepId)
    memo.set(stepId, foundCycle)
    return foundCycle
  }
  if (hasCycleFrom(def.start_step, new Set<string>(), new Map<string, boolean>())) {
    issues.push({
      level: 'error',
      code: 'CYCLE_DETECTED',
      message: 'Workflow graph contains a cycle',
    })
  }

  // 7. Warn: non-terminal steps where every transition is conditional (no
  // unconditional fallback). The entity could get stuck if all branches fail.
  for (const s of def.steps) {
    if (s.terminal) continue
    if (s.transitions.length === 0) {
      issues.push({
        level: 'error',
        code: 'NO_OUTGOING',
        message: `Non-terminal step '${s.id}' has no outgoing transitions`,
        step_id: s.id,
      })
      continue
    }
    const hasFallback = s.transitions.some((t) => !t.when)
    if (!hasFallback) {
      issues.push({
        level: 'warning',
        code: 'NO_FALLBACK_BRANCH',
        message: `Step '${s.id}' has no unconditional fallback; entity may get stuck if no branch matches`,
        step_id: s.id,
      })
    }
  }

  const valid = issues.every((i) => i.level !== 'error')
  return { valid, issues }
}
