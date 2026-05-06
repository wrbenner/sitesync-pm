#!/usr/bin/env node
// Aggressive boundary-cast migration for inline-object insert/update/upsert payloads.
//
// Handles patterns the simpler script missed:
//   .insert({ ... })         -> .insert({ ... } as never)
//   .update({ ... })         -> .update({ ... } as never)
//   .upsert({ ... }, opts)   -> .upsert({ ... } as never, opts)
//
// Walks brace depth so it correctly closes multi-line objects.

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const args = process.argv.slice(2)
if (args.length === 0) {
  console.error('Usage: node scripts/migrate-inline-payloads.mjs <file1> [file2 ...]')
  process.exit(1)
}

let filesChanged = 0
let totalSites = 0

for (const rel of args) {
  const abs = resolve(rel)
  if (!existsSync(abs)) continue
  const original = readFileSync(abs, 'utf8')
  let text = original

  const methodRe = /\.(insert|update|upsert)\(\{/g
  let match
  const replacements = []
  while ((match = methodRe.exec(text)) !== null) {
    const startBrace = match.index + match[0].length - 1
    let depth = 1
    let i = startBrace + 1
    let inString = null
    let escape = false
    while (i < text.length && depth > 0) {
      const ch = text[i]
      if (escape) {
        escape = false
      } else if (inString) {
        if (ch === '\\') escape = true
        else if (ch === inString) inString = null
      } else {
        if (ch === '"' || ch === "'" || ch === '`') inString = ch
        else if (ch === '{') depth++
        else if (ch === '}') depth--
      }
      i++
    }
    if (depth !== 0) continue
    const closeBrace = i - 1
    const after = text.slice(closeBrace + 1)
    if (/^\s*as\s+never\b/.test(after)) continue
    let needsAsNever = false
    if (match[1] === 'upsert') {
      if (/^\s*,/.test(after)) needsAsNever = true
    } else {
      if (/^\s*\)/.test(after)) needsAsNever = true
    }
    if (!needsAsNever) continue
    replacements.push({ pos: closeBrace + 1, insert: ' as never' })
  }

  replacements.sort((a, b) => b.pos - a.pos)
  for (const r of replacements) {
    text = text.slice(0, r.pos) + r.insert + text.slice(r.pos)
  }

  if (text !== original) {
    writeFileSync(abs, text)
    filesChanged++
    totalSites += replacements.length
    console.log(`[migrated] ${rel} (${replacements.length} payload sites)`)
  }
}

console.log(`\nDone: ${filesChanged} files changed, ${totalSites} payload sites tagged.`)
