#!/usr/bin/env node
// ── validate-rfi-audit-coverage ─────────────────────────────────────────
// Walks every RFI mutation hook and asserts that each useMutation block
// either calls logAuditEntry, calls a known cross-cutting auditing
// helper (logFromBus / runRfiResponseChain), or is exempt with a
// `// AUDIT-EXEMPT: <reason>` comment within ~600 chars before the
// mutation.
//
// Exit 1 on any unexempted mutation without a logAuditEntry call.

import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(fileURLToPath(import.meta.url), '../..')
const HOOK_DIR = resolve(ROOT, 'src/hooks/queries')

const GLOBS = [
  /^useRFI.*\.ts$/,
  /^useSpecBook\.ts$/,
  /^rfis\.ts$/,
  /^rfi-watchers\.ts$/,
]

const AUDITING_TOKENS = [
  'logAuditEntry',
  'runRfiResponseChain',
  'logFromBus',
  'auditFromTrigger',
]

const AUDIT_EXEMPT_RE = /\/\/\s*AUDIT-EXEMPT:\s*([^\n]+)/

function* findMutationBlocks(text) {
  const re = /useMutation\s*\(\s*\{/g
  for (const match of text.matchAll(re)) {
    const start = match.index
    const afterToken = start + match[0].length
    let depth = 1
    let i = afterToken
    while (i < text.length && depth > 0) {
      const ch = text[i]
      if (ch === '{') depth++
      else if (ch === '}') depth--
      i++
    }
    const body = text.slice(start, i)
    const preceding = text.slice(Math.max(0, start - 600), start)
    yield { start, end: i, body, preceding }
  }
}

function lineNumberAt(text, offset) {
  return text.slice(0, offset).split('\n').length
}

const findings = []

for (const file of readdirSync(HOOK_DIR)) {
  if (!GLOBS.some((re) => re.test(file))) continue
  const path = resolve(HOOK_DIR, file)
  const text = readFileSync(path, 'utf8')
  for (const { body, preceding, start } of findMutationBlocks(text)) {
    const audited = AUDITING_TOKENS.some((t) => body.includes(t))
    const exemptMatch = preceding.match(AUDIT_EXEMPT_RE)
    if (!audited && !exemptMatch) {
      findings.push({
        file,
        line: lineNumberAt(text, start),
        snippet: body.slice(0, 160).replace(/\n/g, ' '),
      })
    }
  }
}

if (findings.length === 0) {
  console.log('✓ RFI audit coverage: every mutation logs an audit row or is marked AUDIT-EXEMPT.')
  process.exit(0)
}

console.error('✗ RFI audit coverage gaps found:')
for (const f of findings) {
  console.error(`  ${f.file}:${f.line}  ${f.snippet}…`)
}
console.error('')
console.error('Each useMutation in an RFI hook must either call logAuditEntry')
console.error('(or a known auditing helper), or be preceded by a')
console.error('`// AUDIT-EXEMPT: <reason>` comment within ~600 chars.')
process.exit(1)
