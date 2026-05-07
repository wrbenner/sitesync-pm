#!/usr/bin/env tsx
// ── lint-rfi-voice ──────────────────────────────────────────────────────
// Phase 5.2 — Voice linter sweep on every user-facing string in RFI
// files. Extracts strings from JSX (button text, placeholders, labels),
// toast.success/error/info, aria-label/title attrs, and the empty-state
// `emptyMessage` prop. Runs `lintVoice` on each.
//
// Conservative extraction: catches the common shapes, misses dynamic
// templates (`Hello ${name}`). The job is to flag low-effort copy that
// breaks voice rules — not to be a full i18n extractor.
//
// Exit 1 on any failure. Run via `npm run lint:rfi-voice`.

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { lintVoice } from '../src/lib/iris/voiceLinter'

const ROOTS = [
  'src/components/rfi',
  'src/components/rfis',
  'src/pages/rfis',
]
const FILES = [
  'src/pages/RFIs.tsx',
]

const EXTRACTORS: Array<{ name: string; re: RegExp }> = [
  { name: 'placeholder', re: /placeholder=\{?["'`]([^"'`]+)["'`]\}?/g },
  { name: 'aria-label', re: /aria-label=\{?["'`]([^"'`]+)["'`]\}?/g },
  { name: 'title-attr', re: /title=\{?["'`]([^"'`]+)["'`]\}?/g },
  { name: 'toast-success', re: /toast\.success\(\s*["'`]([^"'`]+)["'`]/g },
  { name: 'toast-error', re: /toast\.error\(\s*["'`]([^"'`]+)["'`]/g },
  { name: 'toast-info', re: /toast\(\s*["'`]([^"'`]+)["'`]/g },
  { name: 'description', re: /description:\s*["'`]([^"'`]+)["'`]/g },
  { name: 'emptyMessage', re: /emptyMessage=\{?["'`]([^"'`]+)["'`]\}?/g },
  { name: 'label-prop', re: /\blabel=["'`]([^"'`]+)["'`]/g },
]

interface Hit {
  file: string
  line: number
  source: string
  text: string
  rule: string
  message: string
}

function* walk(root: string): Generator<string> {
  let entries: string[]
  try {
    entries = readdirSync(root)
  } catch {
    return
  }
  for (const e of entries) {
    const full = join(root, e)
    const s = statSync(full)
    if (s.isDirectory()) yield* walk(full)
    else if (/\.(tsx|ts)$/.test(e)) yield full
  }
}

function lineNumberAt(text: string, offset: number): number {
  return text.slice(0, offset).split('\n').length
}

const hits: Hit[] = []
let stringsChecked = 0

const targets: string[] = []
for (const r of ROOTS) targets.push(...walk(r))
for (const f of FILES) targets.push(f)

for (const file of targets) {
  let text: string
  try { text = readFileSync(file, 'utf8') } catch { continue }
  for (const { name, re } of EXTRACTORS) {
    for (const m of text.matchAll(re)) {
      const str = m[1]
      if (!str || str.length < 3) continue
      // Skip obvious template placeholders / keys / paths.
      if (/^[a-z_][a-z0-9_-]*$/i.test(str)) continue
      if (str.startsWith('/') || str.startsWith('http')) continue
      stringsChecked++
      // Strip `${...}` template interpolations before linting — variable
      // names like `rfis.length` are not user-facing text and trigger
      // false-positive acronym-casing failures.
      const displayed = str.replace(/\$\{[^}]*\}/g, ' ')
      if (displayed.trim().length < 3) continue
      const result = lintVoice(displayed, { citations: [] }, { autofix: false })
      if (!result.passed) {
        for (const f of result.failedRules) {
          hits.push({
            file,
            line: lineNumberAt(text, m.index ?? 0),
            source: name,
            text: str,
            rule: f.ruleId,
            message: f.message,
          })
        }
      }
    }
  }
}

console.log(`Voice linter swept ${stringsChecked} strings across ${targets.length} RFI files.`)

if (hits.length === 0) {
  console.log('✓ No voice violations.')
  process.exit(0)
}

console.error(`✗ ${hits.length} voice violation(s):`)
for (const h of hits) {
  console.error(`  ${h.file}:${h.line}  [${h.source}] (${h.rule}) "${h.text}"`)
  if (h.message) console.error(`     ↳ ${h.message}`)
}
process.exit(1)
