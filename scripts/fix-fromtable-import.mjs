#!/usr/bin/env node
// For each file using `fromTable(` but not importing it from lib/db/queries,
// inject the import line. Computes the relative path from src/.

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve, dirname, relative } from 'node:path'

const inputFile = process.argv[2]
if (!inputFile) {
  console.error('Usage: node scripts/fix-fromtable-import.mjs <list-file>')
  process.exit(1)
}

const files = readFileSync(inputFile, 'utf8').split('\n').filter(Boolean)
const queriesPath = resolve('/Users/walkerbenner/Desktop/sitesync-pm/src/lib/db/queries')

let added = 0
for (const file of files) {
  if (!existsSync(file)) continue
  const text = readFileSync(file, 'utf8')

  // Skip if already imports
  if (/from\s+['"][^'"]*\/db\/queries['"]/.test(text)) continue
  // Skip if doesn't use fromTable
  if (!/\bfromTable\(/.test(text)) continue

  // Compute relative import path
  const fileDir = dirname(file)
  let rel = relative(fileDir, queriesPath)
  if (!rel.startsWith('.')) rel = './' + rel
  // Ensure POSIX style
  rel = rel.replace(/\\/g, '/')

  const importLine = `import { fromTable } from '${rel}'\n`

  // Insert after first import block (find first non-import line and insert before)
  const lines = text.split('\n')
  let insertAt = 0
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i]
    if (/^import\s/.test(ln) || /^\/\/|^\/\*|^\s*$/.test(ln)) {
      insertAt = i + 1
    } else {
      break
    }
  }

  lines.splice(insertAt, 0, importLine)
  writeFileSync(file, lines.join('\n'))
  added++
}

console.error(`[fix-fromtable-import] Added imports to ${added} files`)
