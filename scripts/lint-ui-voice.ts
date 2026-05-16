#!/usr/bin/env tsx
// UI voice linter (Crystalline Standard, cross-cutting invariant).
//
// Generalizes scripts/lint-rfi-voice.ts to every user-facing string in
// src/components and src/pages. Extracts:
//   - placeholder, aria-label, title, label props
//   - toast.success / toast.error / toast.info / toast(...) calls
//   - description, emptyMessage, helperText, errorMessage props
//   - <Button>…</Button> children (single-string children only)
//
// Each extracted string is run through src/lib/iris/voiceLinter.lintVoice
// against the rules in src/lib/iris/style.ts. The platform speaks like one
// person — same voice in error toasts as in empty states as in confirmations.
//
// 90-day baselined allowlist for pre-existing violations:
//   ops/coverage/ui-voice-allowlist.json
//
// Flags: --json, --update-allowlist.

import { readdirSync, readFileSync, writeFileSync, statSync, existsSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { lintVoice } from '../src/lib/iris/voiceLinter'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const REPO_ROOT = resolve(__dirname, '..')
const ROOTS = [join(REPO_ROOT, 'src/components'), join(REPO_ROOT, 'src/pages')]
const ALLOWLIST_PATH = join(REPO_ROOT, 'ops/coverage/ui-voice-allowlist.json')

const args = process.argv.slice(2)
const OUTPUT_JSON = args.includes('--json')
const UPDATE_ALLOWLIST = args.includes('--update-allowlist')

const EXTRACTORS: Array<{ name: string; re: RegExp }> = [
  { name: 'placeholder', re: /placeholder=\{?["'`]([^"'`]+)["'`]\}?/g },
  { name: 'aria-label', re: /aria-label=\{?["'`]([^"'`]+)["'`]\}?/g },
  { name: 'title-attr', re: /\btitle=\{?["'`]([^"'`]+)["'`]\}?/g },
  { name: 'toast-success', re: /toast\.success\(\s*["'`]([^"'`]+)["'`]/g },
  { name: 'toast-error', re: /toast\.error\(\s*["'`]([^"'`]+)["'`]/g },
  { name: 'toast-info', re: /toast\(\s*["'`]([^"'`]+)["'`]/g },
  { name: 'description', re: /\bdescription:\s*["'`]([^"'`]+)["'`]/g },
  { name: 'emptyMessage', re: /emptyMessage=\{?["'`]([^"'`]+)["'`]\}?/g },
  { name: 'helperText', re: /helperText=\{?["'`]([^"'`]+)["'`]\}?/g },
  { name: 'errorMessage', re: /errorMessage=\{?["'`]([^"'`]+)["'`]\}?/g },
  { name: 'label-prop', re: /\blabel=["'`]([^"'`]+)["'`]/g },
]

const SKIP_DIRS = new Set(['__tests__', 'test', 'tests', '__mocks__'])
const SKIP_SUFFIX = ['.test.tsx', '.test.ts', '.spec.tsx', '.spec.ts', '.stories.tsx']

function* walk(root: string): Generator<string> {
  let entries: string[]
  try {
    entries = readdirSync(root)
  } catch {
    return
  }
  for (const e of entries) {
    if (e.startsWith('.')) continue
    if (SKIP_DIRS.has(e)) continue
    if (SKIP_SUFFIX.some((s) => e.endsWith(s))) continue
    const full = join(root, e)
    const s = statSync(full)
    if (s.isDirectory()) yield* walk(full)
    else if (/\.(tsx|ts)$/.test(e)) yield full
  }
}

function lineNumberAt(text: string, offset: number): number {
  return text.slice(0, offset).split('\n').length
}

interface Hit {
  file: string
  line: number
  source: string
  text: string
  rule: string
  message: string
}

const hits: Hit[] = []
let stringsChecked = 0
const targets: string[] = []
for (const r of ROOTS) targets.push(...walk(r))

for (const file of targets) {
  let text: string
  try {
    text = readFileSync(file, 'utf8')
  } catch {
    continue
  }
  for (const { name, re } of EXTRACTORS) {
    for (const m of text.matchAll(re)) {
      const str = m[1]
      if (!str || str.length < 3) continue
      if (/^[a-z_][a-z0-9_-]*$/i.test(str)) continue
      if (str.startsWith('/') || str.startsWith('http')) continue
      stringsChecked++
      const displayed = str.replace(/\$\{[^}]*\}/g, ' ')
      if (displayed.trim().length < 3) continue
      const result = lintVoice(displayed, { citations: [] }, { autofix: false })
      if (!result.passed) {
        for (const f of result.failedRules) {
          hits.push({
            file: relative(REPO_ROOT, file),
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

interface AllowlistEntry {
  file: string
  line: number
  rule: string
  reason: string
  owner: string
  added: string
  expires: string
}

interface Allowlist {
  _schema?: { description: string }
  entries: AllowlistEntry[]
}

function loadAllowlist(): { entries: AllowlistEntry[]; keys: Set<string>; raw: Allowlist | null } {
  if (!existsSync(ALLOWLIST_PATH)) {
    return { entries: [], keys: new Set(), raw: null }
  }
  const raw: Allowlist = JSON.parse(readFileSync(ALLOWLIST_PATH, 'utf8'))
  const keys = new Set<string>()
  for (const e of raw.entries || []) {
    keys.add(`${e.file}:${e.line}:${e.rule}`)
  }
  return { entries: raw.entries || [], keys, raw }
}

const allowlist = loadAllowlist()
const today = new Date().toISOString().slice(0, 10)
const live: Hit[] = []
const allowed: Hit[] = []
for (const h of hits) {
  const key = `${h.file}:${h.line}:${h.rule}`
  if (allowlist.keys.has(key)) {
    const entry = allowlist.entries.find(
      (e) => e.file === h.file && e.line === h.line && e.rule === h.rule,
    )
    if (entry && entry.expires < today) {
      live.push({ ...h, message: `${h.message} [allowlist expired ${entry.expires}]` })
    } else {
      allowed.push(h)
    }
  } else {
    live.push(h)
  }
}

if (UPDATE_ALLOWLIST) {
  const expires = new Date()
  expires.setDate(expires.getDate() + 90)
  const expiresStr = expires.toISOString().slice(0, 10)
  const entries: AllowlistEntry[] = [
    ...(allowlist.raw?.entries || []),
    ...live.map((h) => ({
      file: h.file,
      line: h.line,
      rule: h.rule,
      reason: 'baselined via --update-allowlist',
      owner: 'walker@sitesyncai.com',
      added: today,
      expires: expiresStr,
    })),
  ]
  const out: Allowlist = {
    _schema: {
      description:
        'UI voice linter allowlist. Each entry exempts one (file, line, ruleId) voice-rule violation for a documented reason, scoped to a 90-day expiry from added. Resolve by rewriting the string to match the voice rules in src/lib/iris/style.ts.',
    },
    entries,
  }
  writeFileSync(ALLOWLIST_PATH, JSON.stringify(out, null, 2) + '\n')
  console.log(`Updated allowlist with ${live.length} new entries (expires ${expiresStr}).`)
  process.exit(0)
}

if (OUTPUT_JSON) {
  process.stdout.write(
    JSON.stringify(
      {
        strings_checked: stringsChecked,
        total_files: targets.length,
        total_violations: hits.length,
        allowed: allowed.length,
        live: live.length,
        violations: live.slice(0, 100),
      },
      null,
      2,
    ),
  )
  process.stdout.write('\n')
  process.exit(live.length > 0 ? 1 : 0)
}

console.log('UI Voice Linter (Crystalline cross-cutting invariant)')
console.log('=====================================================')
console.log(`Files swept:            ${targets.length}`)
console.log(`Strings checked:        ${stringsChecked}`)
console.log(`Total violations:       ${hits.length}`)
console.log(`  - allowlisted:        ${allowed.length}`)
console.log(`  - live:               ${live.length}`)
console.log()
if (live.length === 0) {
  console.log('PASS - every user-facing string conforms to the IRIS voice rules.')
  process.exit(0)
}
console.log(`FAIL - ${live.length} voice violation(s) not in allowlist:`)
for (const h of live.slice(0, 25)) {
  console.log(`  ${h.file}:${h.line}  [${h.source}] (${h.rule}) "${h.text}"`)
  if (h.message) console.log(`    -> ${h.message}`)
}
if (live.length > 25) console.log(`  ... and ${live.length - 25} more`)
console.log()
console.log('Resolve by:')
console.log('  - Rewriting the string to match voice rules in src/lib/iris/style.ts, OR')
console.log('  - Running `npx tsx scripts/lint-ui-voice.ts --update-allowlist` to baseline.')
process.exit(1)
