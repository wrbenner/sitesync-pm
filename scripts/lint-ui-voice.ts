#!/usr/bin/env tsx
// ── lint-ui-voice ─────────────────────────────────────────────────────────
// Bugatti Phase L extension of the RFI-only voice linter to cover every
// user-facing string across `src/**/*.tsx`. Re-uses lintVoice() and the
// same extractor regexes; widens the scan surface.
//
// The original `scripts/lint-rfi-voice.ts` covered only RFI files; this
// covers the rest of the app so a voice violation anywhere in the UI
// (em-dash in a toast, ChatGPT-y "Certainly" phrasing, emoji glyph in
// a label) fails CI before it can land. The RFI-specific gate stays as
// the canonical regression check for RFI files; this gate is the broad
// floor for everything else.
//
// Exit 1 on any failure. Run via `npm run lint:ui-voice`.

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { lintVoice } from '../src/lib/iris/voiceLinter'

// Scan all of src/, then exclude the RFI subtree (covered by lint-rfi-voice)
// + test files + generated files. Excluding rather than including means new
// code under src/ is covered by default — opt-out, not opt-in.
const ROOT = 'src'
const EXCLUDE_PATTERNS: RegExp[] = [
  /^src\/components\/rfi(\/|$)/,
  /^src\/components\/rfis(\/|$)/,
  /^src\/pages\/rfis(\/|$)/,
  /^src\/pages\/RFIs\.tsx$/,
  /(^|\/)__tests__\//,
  /(^|\/)__fixtures__\//,
  /\.test\.(ts|tsx)$/,
  /\.spec\.(ts|tsx)$/,
  /\.stories\.(ts|tsx)$/,
  /\.d\.ts$/,
  /(^|\/)test\//,
  // Generated files — anything claimed as auto-generated should be exempt.
  /(^|\/)generated\//,
  /\.generated\.(ts|tsx)$/,
]

const EXTRACTORS: Array<{ name: string; re: RegExp }> = [
  { name: 'placeholder', re: /placeholder=\{?["'`]([^"'`]+)["'`]\}?/g },
  { name: 'aria-label', re: /aria-label=\{?["'`]([^"'`]+)["'`]\}?/g },
  { name: 'title-attr', re: /title=\{?["'`]([^"'`]+)["'`]\}?/g },
  { name: 'toast-success', re: /toast\.success\(\s*["'`]([^"'`]+)["'`]/g },
  { name: 'toast-error', re: /toast\.error\(\s*["'`]([^"'`]+)["'`]/g },
  { name: 'toast-info', re: /toast\(\s*["'`]([^"'`]+)["'`]/g },
  { name: 'addToast', re: /addToast\(\s*["'`]\w+["'`]\s*,\s*["'`]([^"'`]+)["'`]/g },
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

function isExcluded(path: string): boolean {
  return EXCLUDE_PATTERNS.some((p) => p.test(path))
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
    let s
    try { s = statSync(full) } catch { continue }
    if (s.isDirectory()) {
      if (isExcluded(full + '/')) continue
      yield* walk(full)
    } else if (/\.(tsx|ts)$/.test(e) && !isExcluded(full)) {
      yield full
    }
  }
}

function lineNumberAt(text: string, offset: number): number {
  return text.slice(0, offset).split('\n').length
}

const hits: Hit[] = []
let stringsChecked = 0
let filesScanned = 0

for (const file of walk(ROOT)) {
  filesScanned++
  let text: string
  try { text = readFileSync(file, 'utf8') } catch { continue }
  for (const { name, re } of EXTRACTORS) {
    for (const m of text.matchAll(re)) {
      const str = m[1]
      if (!str || str.length < 3) continue
      // Skip obvious template placeholders / keys / paths / permission IDs.
      if (/^[a-z_][a-z0-9_-]*$/i.test(str)) continue
      if (str.startsWith('/') || str.startsWith('http') || str.startsWith('#')) continue
      if (/^[A-Z][A-Z_]+$/.test(str)) continue
      // Skip captures that contain webhook event names or OAuth scopes —
      // these are wire identifiers, not user-facing prose. The acronym
      // rule would falsely flag e.g. "read:rfis write:submittals" or
      // "rfi.*". Pattern-match the identifier shapes anywhere in the
      // captured string (not anchored — these can have an English prefix
      // like "e.g." or "Event types:" or "comma-separated").
      if (/\b[a-z_]+:[a-z_]+\b/.test(str)) continue
      if (/\b[a-z_]+\.\*/.test(str)) continue
      stringsChecked++
      const displayed = str.replace(/\$\{[^}]*\}/g, ' ')
      // Skip captures that still contain `${` after stripping — the
      // extractor caught only a fragment of a template literal (e.g. the
      // regex closed at an inner quote inside the template). These
      // fragments are not user-facing complete strings.
      if (displayed.includes('${')) continue
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

console.log(`UI voice linter swept ${stringsChecked} strings across ${filesScanned} files (RFI files excluded — covered by lint-rfi-voice).`)

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
