#!/usr/bin/env node
// Auto-fix TS6133 ('declared but its value is never read') by underscore-prefixing
// the offending identifier where it's declared. Skips imports unless trivially
// removable from a comma-separated list.
//
// Usage: node scripts/fix-unused.mjs <tsc-output-file>

import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

let tscOut = ''
const inputFile = process.argv[2]
if (inputFile && existsSync(inputFile)) {
  tscOut = readFileSync(inputFile, 'utf8')
} else {
  console.error('[fix-unused] Running tsc to collect errors...')
  try {
    tscOut = execFileSync('npx', ['tsc', '--noEmit', '-p', 'tsconfig.app.json'], {
      encoding: 'utf8',
      env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=8192' },
      stdio: ['ignore', 'pipe', 'ignore'],
    })
  } catch (e) {
    tscOut = e.stdout?.toString() || ''
  }
}

const lines = tscOut.split('\n')
const errors = []
for (const line of lines) {
  const m = line.match(/^(.+?)\((\d+),(\d+)\): error TS6133: '([^']+)' is declared but its value is never read\./)
  if (m) {
    errors.push({ file: m[1], line: Number(m[2]), col: Number(m[3]), name: m[4] })
  }
}

console.error(`[fix-unused] Found ${errors.length} TS6133 errors`)

const byFile = new Map()
for (const err of errors) {
  if (!byFile.has(err.file)) byFile.set(err.file, [])
  byFile.get(err.file).push(err)
}

let imports = 0
let renamed = 0
let skipped = 0

for (const [file, errs] of byFile) {
  const abs = resolve(file)
  if (!existsSync(abs)) { skipped += errs.length; continue }
  const text = readFileSync(abs, 'utf8')
  const linesArr = text.split('\n')
  let modified = false

  errs.sort((a, b) => b.line - a.line || b.col - a.col)

  for (const err of errs) {
    const lineIdx = err.line - 1
    const lineText = linesArr[lineIdx]
    if (!lineText) continue

    const trimmed = lineText.trim()
    // Detect if we're inside a multi-line import block
    const insideMultilineImport = (() => {
      // Walk backwards to find a line starting with `import` and no closing brace yet
      for (let i = lineIdx; i >= 0; i--) {
        const ln = linesArr[i]
        if (/^\s*import\s/.test(ln)) {
          // Check if this import was already closed before our line
          let depth = 0
          let foundOpen = false
          for (let j = i; j <= lineIdx; j++) {
            const t = linesArr[j]
            for (const ch of t) {
              if (ch === '{') { depth++; foundOpen = true }
              else if (ch === '}') depth--
            }
          }
          if (foundOpen && depth > 0) return true
          return false
        }
        if (ln.trim() && !ln.includes(',') && !ln.includes('{') && !ln.includes('}') && !ln.startsWith(' ')) break
      }
      return false
    })()

    if (insideMultilineImport) {
      // Remove `, NAME` or `NAME, ` or just `NAME,` on the line
      const name = err.name
      const beforeComma = new RegExp(`,\\s*${name}\\b`)
      const afterComma = new RegExp(`\\b${name}\\s*,\\s*`)
      const onlyOnLine = new RegExp(`^\\s*${name}\\s*,?\\s*$`)
      if (onlyOnLine.test(lineText)) {
        // Whole line is just this import — blank it
        linesArr[lineIdx] = ''
        imports++
        modified = true
        continue
      }
      if (beforeComma.test(lineText)) {
        linesArr[lineIdx] = lineText.replace(beforeComma, '')
        imports++
        modified = true
        continue
      }
      if (afterComma.test(lineText)) {
        linesArr[lineIdx] = lineText.replace(afterComma, '')
        imports++
        modified = true
        continue
      }
      skipped++
      continue
    }

    if (trimmed.startsWith('import ')) {
      const name = err.name
      let newLine = lineText
      const beforeComma = new RegExp(`,\\s*${name}\\b`)
      const afterComma = new RegExp(`\\b${name}\\s*,\\s*`)
      const onlyName = new RegExp(`\\{\\s*${name}\\s*\\}`)
      // Whole-line import: `import { NAME } from '...'` or `import NAME from '...'`
      const wholeLineNamed = new RegExp(`^\\s*import\\s+\\{\\s*${name}\\s*\\}\\s+from\\s+['"][^'"]+['"]\\s*;?\\s*$`)
      const wholeLineDefault = new RegExp(`^\\s*import\\s+${name}\\s+from\\s+['"][^'"]+['"]\\s*;?\\s*$`)
      const wholeLineTypeNamed = new RegExp(`^\\s*import\\s+type\\s+\\{\\s*${name}\\s*\\}\\s+from\\s+['"][^'"]+['"]\\s*;?\\s*$`)
      if (wholeLineNamed.test(newLine) || wholeLineDefault.test(newLine) || wholeLineTypeNamed.test(newLine)) {
        // Replace with empty line to preserve line numbers for remaining errors
        linesArr[lineIdx] = ''
        imports++
        modified = true
        continue
      }
      if (onlyName.test(newLine)) {
        skipped++
        continue
      }
      if (afterComma.test(newLine)) {
        newLine = newLine.replace(afterComma, '')
        linesArr[lineIdx] = newLine
        imports++
        modified = true
        continue
      }
      if (beforeComma.test(newLine)) {
        newLine = newLine.replace(beforeComma, '')
        linesArr[lineIdx] = newLine
        imports++
        modified = true
        continue
      }
      skipped++
      continue
    }

    const col = err.col - 1
    const before = lineText.slice(0, col)
    const after = lineText.slice(col)
    if (after.startsWith(err.name)) {
      const nextChar = after[err.name.length]
      if (nextChar && /[\w$]/.test(nextChar)) {
        skipped++
        continue
      }
      if (err.name.startsWith('_')) {
        // Already-underscored: TS still flags top-level const/let. Delete the line if it's a single-statement declaration.
        const match = lineText.match(/^(\s*)(const|let|var)\s+(\w+)\s*=/)
        if (match && match[3] === err.name && lineText.trim().endsWith(';') || (match && match[3] === err.name && (after.includes(';') || after.includes(' = ')))) {
          // Try a single-line const with assignment ending in `;`
          if (/^\s*(const|let|var)\s+\w+\s*=[^;]*;\s*$/.test(lineText)) {
            linesArr[lineIdx] = ''
            renamed++
            modified = true
            continue
          }
        }
        // Otherwise: add `void <name>` immediately after the declaration line to mark used.
        // This works for destructured params/locals too.
        // Insert before next non-empty line, but only if not already inserted.
        const insertLine = `${' '.repeat(Math.max(0, col))}void ${err.name};`
        // Don't insert if next line already has it
        if (linesArr[lineIdx + 1] && linesArr[lineIdx + 1].includes(`void ${err.name}`)) {
          skipped++
          continue
        }
        // Find end of statement (semicolon or = ...; or `,` in destructure)
        // Simplest: append `; void <name>;` to the same line if no semicolon, else after
        // Actually, easiest: just insert a `void <name>;` line immediately after lineIdx.
        linesArr.splice(lineIdx + 1, 0, insertLine)
        renamed++
        modified = true
        continue
      }
      const trimmedBefore = before.trimEnd()
      const allowed = (
        trimmedBefore.endsWith('[') ||
        trimmedBefore.endsWith('{') ||
        trimmedBefore.endsWith('(') ||
        trimmedBefore.endsWith(',') ||
        trimmedBefore.endsWith(':') ||
        /\b(let|const|var|function|async function)\s*\*?$/.test(trimmedBefore)
      )
      if (!allowed) {
        skipped++
        continue
      }
      const newLine = before + '_' + err.name + after.slice(err.name.length)
      linesArr[lineIdx] = newLine
      renamed++
      modified = true
    } else {
      skipped++
    }
  }

  if (modified) {
    writeFileSync(abs, linesArr.join('\n'))
  }
}

console.error(`[fix-unused] imports removed: ${imports}, renamed: ${renamed}, skipped: ${skipped}`)
