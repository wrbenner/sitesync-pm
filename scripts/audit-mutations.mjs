#!/usr/bin/env node
// B17 mutation audit (Crystalline Standard, Tier 1 Correctness).
//
// Walks src/ with the TypeScript AST and produces two things:
//
// 1. ops/coverage/buttons-actions.json — manifest of every audited mutation
//    discovered (file, entityType, action, permission, line). This is the
//    inventory the B17 Playwright spec will iterate over once recorded.
//
// 2. A violations report: any call to `useMutation(...)` outside the wrapper
//    file `src/hooks/mutations/createAuditedMutation.ts`. Every mutation in
//    src/ MUST flow through createAuditedMutation so the audit trail,
//    permission check, optimistic update, invalidation, and Sentry capture
//    happen uniformly. Direct useMutation calls bypass that contract.
//
// Allowlist: ops/coverage/mutation-audit-allowlist.json with 90-day expiry
// entries for known direct-useMutation call sites pending refactor.
//
// Flags: --json, --update-allowlist.

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, resolve, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const REPO_ROOT = resolve(__dirname, '..')
const SRC = join(REPO_ROOT, 'src')
const MANIFEST_PATH = join(REPO_ROOT, 'ops/coverage/buttons-actions.json')
const ALLOWLIST_PATH = join(REPO_ROOT, 'ops/coverage/mutation-audit-allowlist.json')
const WRAPPER_REL = 'src/hooks/mutations/createAuditedMutation.ts'

const args = process.argv.slice(2)
const OUTPUT_JSON = args.includes('--json')
const UPDATE_ALLOWLIST = args.includes('--update-allowlist')

const SKIP_DIRS = new Set(['node_modules', '__tests__', 'test', 'tests', '__mocks__'])
const SKIP_SUFFIX = ['.test.ts', '.test.tsx', '.spec.ts', '.spec.tsx', '.stories.tsx']

function walkFiles(dir, results = []) {
  for (const entry of readdirSync(dir)) {
    if (entry.startsWith('.')) continue
    if (SKIP_DIRS.has(entry)) continue
    const full = join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) {
      walkFiles(full, results)
    } else if (st.isFile() && (entry.endsWith('.ts') || entry.endsWith('.tsx'))) {
      if (SKIP_SUFFIX.some((s) => entry.endsWith(s))) continue
      results.push(full)
    }
  }
  return results
}

function loadAllowlist() {
  if (!existsSync(ALLOWLIST_PATH)) {
    return { entries: [], by_key: new Map() }
  }
  const raw = JSON.parse(readFileSync(ALLOWLIST_PATH, 'utf8'))
  const by_key = new Map()
  for (const e of raw.entries || []) {
    by_key.set(`${e.file}:${e.line}`, e)
  }
  return { entries: raw.entries || [], by_key, _raw: raw }
}

function objectLiteralStringProp(node, name) {
  if (!node || !ts.isObjectLiteralExpression(node)) return undefined
  for (const prop of node.properties) {
    if (
      ts.isPropertyAssignment(prop) &&
      prop.name &&
      (ts.isIdentifier(prop.name) || ts.isStringLiteral(prop.name)) &&
      prop.name.text === name
    ) {
      const init = prop.initializer
      if (ts.isStringLiteral(init) || ts.isNoSubstitutionTemplateLiteral(init)) {
        return init.text
      }
      if (ts.isIdentifier(init)) return `<ref:${init.text}>`
      return '<expr>'
    }
  }
  return undefined
}

function lineOf(node, sourceFile) {
  return ts.getLineAndCharacterOfPosition(sourceFile, node.getStart(sourceFile)).line + 1
}

function inspectFile(filePath, audited, raw) {
  const text = readFileSync(filePath, 'utf8')
  const sourceFile = ts.createSourceFile(filePath, text, ts.ScriptTarget.Latest, true)
  const rel = relative(REPO_ROOT, filePath)

  function visit(node) {
    if (ts.isCallExpression(node)) {
      const callee = node.expression
      if (ts.isIdentifier(callee)) {
        if (callee.text === 'useAuditedMutation' || callee.text === 'createAuditedMutation') {
          const arg = node.arguments[0]
          const entityType = objectLiteralStringProp(arg, 'entityType')
          const action = objectLiteralStringProp(arg, 'action')
          const permission = objectLiteralStringProp(arg, 'permission')
          audited.push({
            file: rel,
            line: lineOf(node, sourceFile),
            entityType: entityType ?? null,
            action: action ?? null,
            permission: permission ?? null,
          })
        } else if (callee.text === 'useMutation' && rel !== WRAPPER_REL) {
          raw.push({ file: rel, line: lineOf(node, sourceFile) })
        }
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
}

const audited = []
const raw = []
const files = walkFiles(SRC)
for (const f of files) inspectFile(f, audited, raw)

const allowlist = loadAllowlist()
const today = new Date().toISOString().slice(0, 10)

const live = []
const allowed = []
for (const v of raw) {
  const key = `${v.file}:${v.line}`
  const entry = allowlist.by_key.get(key)
  if (!entry) {
    live.push(v)
    continue
  }
  if (entry.expires && entry.expires < today) {
    live.push({ ...v, _note: `allowlist entry expired ${entry.expires}` })
  } else {
    allowed.push(v)
  }
}

if (UPDATE_ALLOWLIST) {
  const expires = new Date()
  expires.setDate(expires.getDate() + 90)
  const expiresStr = expires.toISOString().slice(0, 10)
  const entries = [
    ...(allowlist._raw?.entries || []),
    ...live.map((v) => ({
      file: v.file,
      line: v.line,
      reason: 'baselined via --update-allowlist',
      owner: 'walker@sitesyncai.com',
      added: today,
      expires: expiresStr,
    })),
  ]
  const out = {
    _schema: {
      description:
        'B17 mutation audit allowlist. Each entry exempts one raw useMutation() call site for a documented reason, scoped to the file/line. Entries expire 90 days from added.',
    },
    entries,
  }
  writeFileSync(ALLOWLIST_PATH, JSON.stringify(out, null, 2) + '\n')
  console.log(`Updated allowlist with ${live.length} new entries (expires ${expiresStr}).`)
  process.exit(0)
}

const manifest = {
  _schema: {
    description:
      'B17 button-behavior manifest. Inventory of every createAuditedMutation() call site discovered in src/. Each entry pairs a mutation with its expected audit kind, action, and required permission — the contract a UI button must satisfy.',
    fields: {
      file: 'Path relative to repo root',
      line: '1-indexed line number of createAuditedMutation(',
      entityType: 'Entity domain (string from config)',
      action: "One of: create|update|delete|status_change|approve|reject|submit|close",
      permission: 'usePermissions permission key required to execute',
    },
  },
  generated_at: today,
  total: audited.length,
  entries: audited.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line),
}
writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n')

if (OUTPUT_JSON) {
  process.stdout.write(
    JSON.stringify(
      {
        total_audited_mutations: audited.length,
        raw_useMutation_total: raw.length,
        allowed: allowed.length,
        live: live.length,
        violations: live,
      },
      null,
      2,
    ),
  )
  process.stdout.write('\n')
} else {
  console.log('B17 Mutation Audit')
  console.log('==================')
  console.log(`Audited mutations:    ${audited.length}`)
  console.log(`Raw useMutation():    ${raw.length}`)
  console.log(`  - allowlisted:      ${allowed.length}`)
  console.log(`  - live violations:  ${live.length}`)
  console.log()
  if (live.length > 0) {
    console.log(`FAIL — ${live.length} raw useMutation call(s) not in allowlist:`)
    for (const v of live.slice(0, 25)) {
      console.log(`  ${v.file}:${v.line}${v._note ? ` (${v._note})` : ''}`)
    }
    if (live.length > 25) console.log(`  ... and ${live.length - 25} more`)
    console.log()
    console.log('Resolve by:')
    console.log('  - Refactoring to createAuditedMutation(), OR')
    console.log('  - Running `node scripts/audit-mutations.mjs --update-allowlist` to baseline.')
  } else {
    console.log('PASS — every mutation in src/ flows through createAuditedMutation.')
  }
  console.log()
  console.log(`Manifest written to ${relative(REPO_ROOT, MANIFEST_PATH)}.`)
}

process.exit(live.length > 0 ? 1 : 0)
