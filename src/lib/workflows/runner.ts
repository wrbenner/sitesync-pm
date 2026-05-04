/**
 * Workflow runner — pure, deterministic.
 *
 * Inputs:
 *   • WorkflowDefinition (versioned, immutable graph)
 *   • EntityState (current step + entity payload)
 *   • WorkflowEvent (the action triggering a transition)
 *
 * Output: Result<WorkflowTransition> describing the next state + the
 * participants required for that step.
 *
 * Guarantees:
 *   • Hand-written safe expression parser (no dynamic-code evaluation).
 *     Supports > < >= <= == != && || and dotted-path access into
 *     entity.* plus numeric/string/boolean literals.
 *   • Items in flight pin to the version effective at start. Editing a
 *     workflow creates a new version; old versions stay alive.
 *   • If multiple transitions match, the FIRST listed wins (definition order).
 */

import { ok, fail, validationError, notFoundError, permissionError } from '../../services/errors'
import type { Result } from '../../services/errors'
import type {
  WorkflowDefinition,
  WorkflowStep,
  WorkflowTransitionDef,
  EntityState,
  WorkflowEvent,
  WorkflowTransition,
} from '../../types/workflows'

// ── Public entry point ────────────────────────────────────────────────

export function transition(
  definition: WorkflowDefinition,
  state: EntityState,
  event: WorkflowEvent,
): Result<WorkflowTransition> {
  // Verify pinned version matches. In flight items must use their pinned version.
  if (state.pinned_definition_id !== definition.id) {
    return fail(
      validationError(
        `Pinned definition ${state.pinned_definition_id} does not match definition ${definition.id}`,
        { pinned: state.pinned_definition_id, given: definition.id },
      ),
    )
  }
  if (state.pinned_version !== definition.version) {
    return fail(
      validationError(
        `Pinned version ${state.pinned_version} does not match definition version ${definition.version}`,
        { pinned: state.pinned_version, given: definition.version },
      ),
    )
  }

  const currentStep = findStep(definition, state.current_step)
  if (!currentStep) {
    return fail(notFoundError('Workflow step', state.current_step))
  }

  if (currentStep.terminal) {
    return fail(
      validationError(
        `Workflow is already in terminal step ${currentStep.id}`,
        { step: currentStep.id },
      ),
    )
  }

  // Role gate at the source step.
  if (currentStep.required_role && currentStep.required_role.length > 0) {
    if (!currentStep.required_role.includes(event.actor_role)) {
      return fail(
        permissionError(
          `Role ${event.actor_role} is not allowed to act on step ${currentStep.id} (requires ${currentStep.required_role.join(', ')})`,
        ),
      )
    }
  }

  // Find the first matching transition.
  const eventName = event.type === 'custom' ? event.name : event.type
  for (let i = 0; i < currentStep.transitions.length; i++) {
    const t = currentStep.transitions[i]
    if (!matchesEvent(t, eventName)) continue
    if (!matchesRole(t, event.actor_role)) continue
    if (t.when) {
      const exprResult = evaluateExpression(t.when, state.entity)
      if (!exprResult.ok) {
        return fail(
          validationError(
            `Malformed expression on transition ${i} of step ${currentStep.id}: ${exprResult.error}`,
            { step: currentStep.id, transition_index: i, expression: t.when },
          ),
        )
      }
      if (!exprResult.value) continue
    }
    const nextStep = findStep(definition, t.to)
    if (!nextStep) {
      return fail(notFoundError('Workflow step', t.to))
    }
    return ok({
      next_step: nextStep.id,
      terminal: nextStep.terminal === true,
      notify_severity: nextStep.notify_severity,
      next_required_role: nextStep.required_role ?? [],
      reason: t.when
        ? `Took transition ${i} (when ${t.when}) from ${currentStep.id} → ${nextStep.id}`
        : `Took transition ${i} from ${currentStep.id} → ${nextStep.id}`,
    })
  }

  return fail(
    validationError(
      `No transition matched event '${eventName}' from step ${currentStep.id}`,
      { step: currentStep.id, event: eventName },
    ),
  )
}

// ── Helpers ───────────────────────────────────────────────────────────

export function findStep(def: WorkflowDefinition, id: string): WorkflowStep | undefined {
  return def.steps.find((s) => s.id === id)
}

function matchesEvent(t: WorkflowTransitionDef, eventName: string): boolean {
  if (!t.on_event || t.on_event.length === 0) return true
  return t.on_event.includes(eventName)
}

function matchesRole(t: WorkflowTransitionDef, role: string): boolean {
  if (!t.required_role || t.required_role.length === 0) return true
  return t.required_role.includes(role)
}

// ── Safe expression evaluator ─────────────────────────────────────────
// Hand-written parser. Supports: > < >= <= == != && || ! ()
// Numeric/string/boolean/null literals and dotted-path access into the
// entity object (e.g. `cost_impact > 50000`,
// `entity.priority == 'critical'`, `cost > 50000 && approved == false`).
//
// Top-level identifiers (no `entity.` prefix) resolve against `entity`.

type ExprResult = { ok: true; value: boolean } | { ok: false; error: string }

export function evaluateExpression(expr: string, entity: Record<string, unknown>): ExprResult {
  try {
    const tokens = tokenize(expr)
    const parser = new Parser(tokens)
    const ast = parser.parseOr()
    if (!parser.atEnd()) {
      return { ok: false, error: `Unexpected token at position ${parser.pos}` }
    }
    const value = evalNode(ast, entity)
    return { ok: true, value: Boolean(value) }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

type Token =
  | { kind: 'NUM'; value: number }
  | { kind: 'STR'; value: string }
  | { kind: 'BOOL'; value: boolean }
  | { kind: 'NULL' }
  | { kind: 'IDENT'; value: string }
  | { kind: 'OP'; value: string }
  | { kind: 'LPAREN' }
  | { kind: 'RPAREN' }
  | { kind: 'BANG' }

function tokenize(input: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  while (i < input.length) {
    const c = input[i]
    if (c === ' ' || c === '\t' || c === '\n' || c === '\r') { i++; continue }
    if (c === '(') { tokens.push({ kind: 'LPAREN' }); i++; continue }
    if (c === ')') { tokens.push({ kind: 'RPAREN' }); i++; continue }
    if (c === '"' || c === "'") {
      const quote = c
      let s = ''
      i++
      while (i < input.length && input[i] !== quote) {
        if (input[i] === '\\' && i + 1 < input.length) { s += input[i + 1]; i += 2; continue }
        s += input[i]; i++
      }
      if (i >= input.length) throw new Error('Unterminated string literal')
      i++
      tokens.push({ kind: 'STR', value: s })
      continue
    }
    if ((c >= '0' && c <= '9') || (c === '-' && i + 1 < input.length && input[i + 1] >= '0' && input[i + 1] <= '9' && (tokens.length === 0 || tokens[tokens.length - 1].kind === 'OP' || tokens[tokens.length - 1].kind === 'LPAREN' || tokens[tokens.length - 1].kind === 'BANG'))) {
      let s = ''
      if (c === '-') { s += c; i++ }
      while (i < input.length && ((input[i] >= '0' && input[i] <= '9') || input[i] === '.')) { s += input[i]; i++ }
      const num = Number(s)
      if (Number.isNaN(num)) throw new Error(`Invalid number: ${s}`)
      tokens.push({ kind: 'NUM', value: num })
      continue
    }
    // Two-char ops
    const two = input.slice(i, i + 2)
    if (two === '>=' || two === '<=' || two === '==' || two === '!=' || two === '&&' || two === '||') {
      tokens.push({ kind: 'OP', value: two })
      i += 2
      continue
    }
    if (c === '>' || c === '<') { tokens.push({ kind: 'OP', value: c }); i++; continue }
    if (c === '!') { tokens.push({ kind: 'BANG' }); i++; continue }
    // Identifier or keyword
    if ((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c === '_') {
      let s = ''
      while (i < input.length && ((input[i] >= 'a' && input[i] <= 'z') || (input[i] >= 'A' && input[i] <= 'Z') || (input[i] >= '0' && input[i] <= '9') || input[i] === '_' || input[i] === '.')) { s += input[i]; i++ }
      if (s === 'true') { tokens.push({ kind: 'BOOL', value: true }); continue }
      if (s === 'false') { tokens.push({ kind: 'BOOL', value: false }); continue }
      if (s === 'null') { tokens.push({ kind: 'NULL' }); continue }
      tokens.push({ kind: 'IDENT', value: s })
      continue
    }
    throw new Error(`Unexpected character '${c}' at position ${i}`)
  }
  return tokens
}

type AstNode =
  | { type: 'lit'; value: number | string | boolean | null }
  | { type: 'ident'; path: string }
  | { type: 'unary'; op: '!'; operand: AstNode }
  | { type: 'binary'; op: string; left: AstNode; right: AstNode }

class Parser {
  pos = 0
  private readonly tokens: Token[]
  constructor(tokens: Token[]) { this.tokens = tokens }

  atEnd(): boolean { return this.pos >= this.tokens.length }
  peek(): Token | undefined { return this.tokens[this.pos] }
  advance(): Token { return this.tokens[this.pos++] }

  parseOr(): AstNode {
    let left = this.parseAnd()
    while (this.peek()?.kind === 'OP' && (this.peek() as { value: string }).value === '||') {
      this.advance()
      const right = this.parseAnd()
      left = { type: 'binary', op: '||', left, right }
    }
    return left
  }
  parseAnd(): AstNode {
    let left = this.parseCmp()
    while (this.peek()?.kind === 'OP' && (this.peek() as { value: string }).value === '&&') {
      this.advance()
      const right = this.parseCmp()
      left = { type: 'binary', op: '&&', left, right }
    }
    return left
  }
  parseCmp(): AstNode {
    let left = this.parseUnary()
    while (this.peek()?.kind === 'OP') {
      const op = (this.peek() as { value: string }).value
      if (op === '==' || op === '!=' || op === '>' || op === '<' || op === '>=' || op === '<=') {
        this.advance()
        const right = this.parseUnary()
        left = { type: 'binary', op, left, right }
      } else break
    }
    return left
  }
  parseUnary(): AstNode {
    if (this.peek()?.kind === 'BANG') {
      this.advance()
      return { type: 'unary', op: '!', operand: this.parseUnary() }
    }
    return this.parsePrimary()
  }
  parsePrimary(): AstNode {
    const t = this.advance()
    if (!t) throw new Error('Unexpected end of expression')
    if (t.kind === 'NUM') return { type: 'lit', value: t.value }
    if (t.kind === 'STR') return { type: 'lit', value: t.value }
    if (t.kind === 'BOOL') return { type: 'lit', value: t.value }
    if (t.kind === 'NULL') return { type: 'lit', value: null }
    if (t.kind === 'IDENT') return { type: 'ident', path: t.value }
    if (t.kind === 'LPAREN') {
      const inner = this.parseOr()
      const close = this.advance()
      if (close?.kind !== 'RPAREN') throw new Error('Expected )')
      return inner
    }
    throw new Error(`Unexpected token: ${t.kind}`)
  }
}

function evalNode(node: AstNode, entity: Record<string, unknown>): unknown {
  if (node.type === 'lit') return node.value
  if (node.type === 'ident') return resolvePath(node.path, entity)
  if (node.type === 'unary') return !evalNode(node.operand, entity)
  // binary
  if (node.op === '&&') return Boolean(evalNode(node.left, entity)) && Boolean(evalNode(node.right, entity))
  if (node.op === '||') return Boolean(evalNode(node.left, entity)) || Boolean(evalNode(node.right, entity))
  const l = evalNode(node.left, entity)
  const r = evalNode(node.right, entity)
  switch (node.op) {
    case '==': return l === r
    case '!=': return l !== r
    case '>': return (typeof l === 'number' && typeof r === 'number') ? l > r : String(l) > String(r)
    case '<': return (typeof l === 'number' && typeof r === 'number') ? l < r : String(l) < String(r)
    case '>=': return (typeof l === 'number' && typeof r === 'number') ? l >= r : String(l) >= String(r)
    case '<=': return (typeof l === 'number' && typeof r === 'number') ? l <= r : String(l) <= String(r)
  }
  throw new Error(`Unknown operator: ${node.op}`)
}

function resolvePath(path: string, entity: Record<string, unknown>): unknown {
  const parts = path.split('.')
  // Allow `entity.foo` AND bare `foo` to both resolve against the entity object.
  let current: unknown = parts[0] === 'entity' ? entity : entity
  const startIdx = parts[0] === 'entity' ? 1 : 0
  for (let i = startIdx; i < parts.length; i++) {
    if (current === null || current === undefined) return undefined
    if (typeof current !== 'object') return undefined
    current = (current as unknown as Record<string, unknown>)[parts[i]]
  }
  return current
}
