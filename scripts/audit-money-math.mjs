#!/usr/bin/env node
// B18 — Money Math Audit (Crystalline Standard, Tier 1)
//
// Scans src/ for BinaryExpressions where one operand looks like money
// (Cents-typed, money column name, or money-suggesting identifier) and
// the operator is + - * / outside of the canonical money helpers in
// src/types/money.ts (addCents / subtractCents / multiplyCents /
// applyRateCents).
//
// Outputs a report and exits non-zero if violations exceed the allowlist.
//
// Allowlist: ops/coverage/money-audit-allowlist.json — documented exceptions
// keyed by file:line with reason + owner + expires.
//
// Run: node scripts/audit-money-math.mjs [--json] [--update-allowlist]

import { readFileSync, readdirSync, existsSync, writeFileSync, statSync } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const REPO_ROOT = resolve(__dirname, '..')
const SRC_DIR = join(REPO_ROOT, 'src')
const ALLOWLIST_PATH = join(REPO_ROOT, 'ops/coverage/money-audit-allowlist.json')

const args = process.argv.slice(2)
const OUTPUT_JSON = args.includes('--json')
const UPDATE_ALLOWLIST = args.includes('--update-allowlist')

// ---------- Money detection heuristics ----------

// Suffix patterns that strongly suggest a money-typed value.
// Conservative set: each suffix here should be unambiguously money in this codebase.
// Overloaded suffixes (_due, _completed, _payment, _invoice, _gross, _net, _earned)
// are intentionally excluded — specific money names are listed in MONEY_NAMES instead.
const MONEY_SUFFIXES = [
  '_cents', 'Cents',
  '_amount', 'Amount',
  '_subtotal', 'Subtotal',
  '_price', 'Price',
  '_cost', 'Cost',
  '_balance', 'Balance',
  '_retainage', 'Retainage',
  '_billed', 'Billed',
  '_paid', 'Paid',
  '_fee', 'Fee',
  '_discount', 'Discount',
  '_refund', 'Refund',
  '_revenue', 'Revenue',
]

// Specific names known to be money columns/fields.
const MONEY_NAMES = new Set([
  'amount', 'subtotal', 'tax', 'fee', 'discount', 'refund',
  'unit_price', 'unitPrice', 'line_total', 'lineTotal',
  'gross_completed', 'grossCompleted', 'net_paid', 'netPaid',
  'contract_sum', 'contractSum', 'retainage',
  'this_period', 'thisPeriod', 'previously_billed', 'previouslyBilled',
  'materials_stored', 'materialsStored', 'balance_to_finish', 'balanceToFinish',
  'current_payment_due', 'currentPaymentDue',
  'approved_change_orders', 'approvedChangeOrders',
  'pending_change_orders', 'pendingChangeOrders',
  'scheduled_value', 'scheduledValue', 'total_completed', 'totalCompleted',
  'materials_value', 'materialsValue', 'labor_value', 'laborValue',
  'approved_cost', 'approvedCost', 'submitted_cost', 'submittedCost',
  'actual_cost', 'actualCost', 'committed_cost', 'committedCost',
  'forecast_cost', 'forecastCost',
  'total_earned_less_retainage', 'totalEarnedLessRetainage',
  'retainage_amount', 'retainageAmount',
])

// Names that look money-ish but ARE NOT money — explicit denylist.
const NOT_MONEY = new Set([
  'percent', 'pct', 'rate', 'ratio', 'multiplier',
  'quantity', 'count', 'qty',
  'hours', 'hours_meter', 'hoursMeter', 'mileage',
  'productivity_score', 'productivityScore', 'score',
  'days', 'months', 'years', 'minutes', 'seconds',
  'retainage_percent', 'retainagePercent',
  'tax_rate', 'taxRate',
  'index', 'i', 'j', 'k', 'n',
  'page', 'pageSize', 'offset', 'limit',
  'width', 'height', 'size', 'length',
  'opacity', 'zoom', 'scale',
])

// Suffix patterns that look money-ish but are not — supersede MONEY_SUFFIXES.
const NOT_MONEY_SUFFIXES = [
  '_percent', 'Percent',
  '_pct', 'Pct',
  '_rate', 'Rate',
  '_count', 'Count',
  '_qty', 'Qty',
  '_quantity', 'Quantity',
  '_score', 'Score',
  '_days', 'Days',
  '_hours', 'Hours',
  '_minutes', 'Minutes',
  '_seconds', 'Seconds',
  '_index', 'Index',
  '_id', 'Id', 'ID',
  // Date/time-looking suffixes (rfiDue, createdAt, completedOn, dueDate, paidAt)
  '_at', 'At',
  '_on', 'On',
  '_date', 'Date',
  '_time', 'Time',
  '_due', 'Due',
  // Status-ish booleans
  '_completed', 'Completed',
  '_status', 'Status',
]

function endsWithAny(name, suffixes) {
  return suffixes.some((s) => name.endsWith(s))
}

function isMoneyName(name) {
  if (!name) return false
  if (NOT_MONEY.has(name)) return false
  if (NOT_MONEY.has(name.toLowerCase())) return false
  if (endsWithAny(name, NOT_MONEY_SUFFIXES)) return false
  if (MONEY_NAMES.has(name)) return true
  if (MONEY_NAMES.has(name.toLowerCase())) return true
  if (endsWithAny(name, MONEY_SUFFIXES)) return true
  return false
}

// Walk an expression and extract the rightmost identifier name we can find.
// Examples:
//   foo.bar.amount → "amount"
//   row.unit_price_cents → "unit_price_cents"
//   payApp.contractSum → "contractSum"
//   (a + b) → null (binary expression, recurse to operands)
function nameOf(node) {
  if (!node) return null
  if (ts.isPropertyAccessExpression(node)) return node.name.escapedText.toString()
  if (ts.isIdentifier(node)) return node.escapedText.toString()
  if (ts.isElementAccessExpression(node)) {
    const arg = node.argumentExpression
    if (arg && ts.isStringLiteral(arg)) return arg.text
    return null
  }
  if (ts.isCallExpression(node)) {
    // For myFn().amount, the call returns something and we can't see the
    // shape syntactically. Skip.
    return null
  }
  if (ts.isAsExpression(node) || ts.isTypeAssertionExpression(node)) {
    return nameOf(node.expression)
  }
  if (ts.isParenthesizedExpression(node)) {
    return nameOf(node.expression)
  }
  if (ts.isNonNullExpression(node)) {
    return nameOf(node.expression)
  }
  return null
}

function operandIsMoney(node) {
  const name = nameOf(node)
  if (!name) return false
  return isMoneyName(name)
}

// Type-hint check: does the operand have a `Cents` type assertion or `as Cents` cast?
function operandIsCentsAsserted(node) {
  if (!node) return false
  if (ts.isAsExpression(node)) {
    const type = node.type
    if (type && ts.isTypeReferenceNode(type) && ts.isIdentifier(type.typeName)) {
      return type.typeName.escapedText === 'Cents'
    }
  }
  return false
}

// ---------- Scan files ----------

const MONEY_OPS = new Set([
  ts.SyntaxKind.PlusToken,
  ts.SyntaxKind.MinusToken,
  ts.SyntaxKind.AsteriskToken,
  ts.SyntaxKind.SlashToken,
])

function shouldSkipFile(relPath) {
  // Implementation of the helpers themselves.
  if (relPath === join('src', 'types', 'money.ts')) return true
  // Test files have their own discipline; tests can use raw math on test fixtures.
  if (relPath.endsWith('.test.ts') || relPath.endsWith('.test.tsx')) return true
  if (relPath.endsWith('.spec.ts') || relPath.endsWith('.spec.tsx')) return true
  if (relPath.includes(`${sep}__tests__${sep}`)) return true
  // Story files
  if (relPath.endsWith('.stories.tsx') || relPath.endsWith('.stories.ts')) return true
  return false
}

function listTsFiles(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) {
      if (entry === 'node_modules' || entry === '.git' || entry === 'dist') continue
      listTsFiles(full, out)
    } else if (st.isFile() && (entry.endsWith('.ts') || entry.endsWith('.tsx'))) {
      out.push(full)
    }
  }
  return out
}

function scanFile(filePath) {
  const violations = []
  const src = readFileSync(filePath, 'utf8')
  const sf = ts.createSourceFile(filePath, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)

  function visit(node) {
    if (ts.isBinaryExpression(node) && MONEY_OPS.has(node.operatorToken.kind)) {
      // Skip pure string concatenation (e.g., `'$' + amount` for display).
      // We only flag if at least one operand looks like a money value AND
      // the result is being computed (not stringified).
      const leftMoney = operandIsMoney(node.left) || operandIsCentsAsserted(node.left)
      const rightMoney = operandIsMoney(node.right) || operandIsCentsAsserted(node.right)
      const isStringConcat =
        node.operatorToken.kind === ts.SyntaxKind.PlusToken &&
        (ts.isStringLiteral(node.left) || ts.isStringLiteral(node.right) ||
         ts.isTemplateExpression(node.left) || ts.isTemplateExpression(node.right))

      if ((leftMoney || rightMoney) && !isStringConcat) {
        const start = sf.getLineAndCharacterOfPosition(node.getStart(sf))
        const snippet = src.slice(node.pos, node.end).trim().replace(/\s+/g, ' ').slice(0, 120)
        violations.push({
          file: relative(REPO_ROOT, filePath),
          line: start.line + 1,
          col: start.character + 1,
          op: node.operatorToken.getText(sf),
          leftMoney,
          rightMoney,
          leftName: nameOf(node.left),
          rightName: nameOf(node.right),
          snippet,
        })
      }
    }
    ts.forEachChild(node, visit)
  }

  visit(sf)
  return violations
}

// ---------- Allowlist ----------

function loadAllowlist() {
  if (!existsSync(ALLOWLIST_PATH)) return { entries: [] }
  try {
    return JSON.parse(readFileSync(ALLOWLIST_PATH, 'utf8'))
  } catch (err) {
    console.error(`Failed to parse allowlist: ${err.message}`)
    process.exit(2)
  }
}

function isAllowed(violation, allowlist) {
  const today = new Date().toISOString().slice(0, 10)
  return allowlist.entries.some((entry) => {
    if (entry.file !== violation.file) return false
    if (entry.line !== violation.line) return false
    if (entry.expires && entry.expires < today) return false
    return true
  })
}

// ---------- Main ----------

function main() {
  const allowlist = loadAllowlist()
  const files = listTsFiles(SRC_DIR).filter((f) => !shouldSkipFile(relative(REPO_ROOT, f)))
  const all = []
  for (const f of files) {
    try {
      all.push(...scanFile(f))
    } catch (err) {
      console.error(`scan failed for ${f}: ${err.message}`)
    }
  }

  const live = all.filter((v) => !isAllowed(v, allowlist))
  const allowed = all.filter((v) => isAllowed(v, allowlist))

  if (OUTPUT_JSON) {
    process.stdout.write(JSON.stringify({
      scanned_files: files.length,
      total_violations: all.length,
      live_violations: live.length,
      allowed_violations: allowed.length,
      violations: live,
    }, null, 2))
    process.stdout.write('\n')
  } else {
    console.log(`B18 Money Math Audit`)
    console.log(`====================`)
    console.log(`Scanned: ${files.length} files under src/`)
    console.log(`Total findings: ${all.length}`)
    console.log(`Allowed (in allowlist, unexpired): ${allowed.length}`)
    console.log(`Live violations: ${live.length}`)
    console.log()
    if (live.length === 0) {
      console.log('PASS — no live violations.')
    } else {
      console.log(`FAIL — ${live.length} live violation${live.length === 1 ? '' : 's'}:`)
      console.log()
      // Group by file
      const byFile = new Map()
      for (const v of live) {
        if (!byFile.has(v.file)) byFile.set(v.file, [])
        byFile.get(v.file).push(v)
      }
      for (const [file, vs] of [...byFile.entries()].sort()) {
        console.log(`  ${file}`)
        for (const v of vs) {
          const operandHint = [
            v.leftMoney ? `${v.leftName}` : null,
            v.rightMoney ? `${v.rightName}` : null,
          ].filter(Boolean).join(' & ')
          console.log(`    L${v.line}:${v.col}  ${v.op}  on  ${operandHint}`)
          console.log(`        ${v.snippet}`)
        }
        console.log()
      }
      console.log(`Resolve each by:`)
      console.log(`  - Refactor to addCents/subtractCents/multiplyCents/applyRateCents`)
      console.log(`    (import from src/types/money.ts)`)
      console.log(`  - Or, if intentional, add to ops/coverage/money-audit-allowlist.json`)
      console.log(`    with reason, owner, and expires fields.`)
    }
  }

  if (UPDATE_ALLOWLIST && live.length > 0) {
    const today = new Date().toISOString().slice(0, 10)
    const expiry = new Date(Date.now() + 90 * 86400 * 1000).toISOString().slice(0, 10)
    const entries = [...allowlist.entries]
    for (const v of live) {
      entries.push({
        file: v.file,
        line: v.line,
        reason: 'BASELINE — pre-existing at allowlist creation; migrate per MONEY_CENTS_AUDIT_2026-05-01.md',
        owner: 'unowned',
        added: today,
        expires: expiry,
      })
    }
    writeFileSync(ALLOWLIST_PATH, JSON.stringify({ ...allowlist, entries }, null, 2) + '\n')
    console.log(`\nWrote ${live.length} baseline entries to ${relative(REPO_ROOT, ALLOWLIST_PATH)}`)
  }

  process.exit(live.length > 0 && !UPDATE_ALLOWLIST ? 1 : 0)
}

main()
