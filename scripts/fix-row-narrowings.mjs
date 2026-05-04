#!/usr/bin/env node
// Common row-narrowing fixes for query results.
// Patterns:
//   .filter((x: Record<string, unknown>) => ...)  -> cast source
//   data?.length  on union with SelectQueryError  -> cast source
//   item.foo as string                            -> already typed via cast
// Plus: as Foo[] or as Foo without `unknown as` prefix on `data` results.

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const args = process.argv.slice(2)
let changed = 0

for (const rel of args) {
  const abs = resolve(rel)
  if (!existsSync(abs)) continue
  const original = readFileSync(abs, 'utf8')
  let text = original

  // Pattern 1: `(data ?? []) as Foo[]` -> `(data ?? []) as unknown as Foo[]`  (already covered earlier)
  text = text.replace(/(?<!unknown )(\(data \?\? \[\])\) as ([A-Z]\w+\[\])/g, '$1) as unknown as $2')
  // Pattern 2: `data as Foo[]`  ->  `data as unknown as Foo[]`
  text = text.replace(/(?<!unknown )\bdata as ([A-Z]\w+\[\])/g, 'data as unknown as $1')
  // Pattern 3: `... as XxxRow[]` etc on RHS without `unknown as`
  text = text.replace(/(\)\s*) as ([A-Z]\w+(?:Row)?\[\])(?!\s*as)/g, (m, before, type) => {
    if (m.includes('unknown as')) return m
    return `${before} as unknown as ${type}`
  })
  // Pattern 4: bare `as Record<string, unknown>` -> `as unknown as Record<string, unknown>`
  text = text.replace(/(?<!unknown )as Record<string, unknown>/g, 'as unknown as Record<string, unknown>')

  if (text !== original) {
    writeFileSync(abs, text)
    changed++
    console.log(`[updated] ${rel}`)
  }
}

console.log(`\n${changed} files changed.`)
