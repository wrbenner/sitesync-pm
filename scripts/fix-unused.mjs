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
    if (trimmed.startsWith('import ')) {
      const name = err.name
      let newLine = lineText
      const beforeComma = new RegExp(`,\\s*${name}\\b`)
      const afterComma = new RegExp(`\\b${name}\\s*,\\s*`)
      const onlyName = new RegExp(`\\{\\s*${name}\\s*\\}`)
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
        skipped++
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
