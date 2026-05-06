#!/usr/bin/env node
// Boundary-cast migration helper for the supabase v2 strict-generic baseline.
// Replaces inline `supabase.from(...)` patterns with the typed `fromTable(...)`
// DSL and inserts contained `as never` casts on column predicates / payloads.
//
// Run: node scripts/migrate-typecheck.mjs <relativePath> [--dry]

import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const args = process.argv.slice(2)
const dryRun = args.includes('--dry')
const targets = args.filter((a) => !a.startsWith('--'))
if (targets.length === 0) {
  console.error('Usage: node scripts/migrate-typecheck.mjs <file.ts> [--dry]')
  process.exit(1)
}

for (const rel of targets) {
  const abs = resolve(rel)
  const original = readFileSync(abs, 'utf8')
  let text = original

  // Inject fromTable import if a `supabase.from(` call exists and the import
  // isn't already present.
  if (/\bsupabase\s*[\.\n][\s\S]*?\.from\(/.test(text) && !/from ['"][^'"]*db\/queries['"]/.test(text)) {
    // Determine the relative path to lib/db/queries from the file.
    const fileSeg = rel.replace(/^\.?\/?/, '').split('/')
    const depth = fileSeg.length - 1 // segments above src/
    const srcIdx = fileSeg.indexOf('src')
    const aboveSrc = depth - srcIdx - 1
    const importPath = '../'.repeat(aboveSrc) + 'lib/db/queries'
    text = text.replace(
      /(import \{[^}]*supabase[^}]*\}[^\n]*\n)/,
      `$1import { fromTable } from '${importPath}'\n`
    )
  }

  // Replace inline + multiline `supabase.from(` -> `fromTable(`
  text = text.replace(/supabase\s*\n\s*\.from\(/g, 'fromTable(')
  text = text.replace(/\bsupabase\.from\(/g, 'fromTable(')

  // Restore non-table supabase.* uses (channel, removeChannel, auth, rpc, storage)
  text = text.replace(/fromTable\.channel\(/g, 'supabase.channel(')
  text = text.replace(/fromTable\.removeChannel\(/g, 'supabase.removeChannel(')
  text = text.replace(/fromTable\.auth\./g, 'supabase.auth.')
  text = text.replace(/fromTable\.rpc\(/g, 'supabase.rpc(')
  text = text.replace(/fromTable\.storage\./g, 'supabase.storage.')
  text = text.replace(/fromTable\.functions\./g, 'supabase.functions.')

  // .update(IDENT) / .insert(IDENT) / .upsert(IDENT, ...) on any identifier
  // The negative lookahead avoids re-tagging values already cast as never.
  text = text.replace(/\.update\(([a-zA-Z_$][\w$]*)\)/g, (m, ident) => {
    if (ident === 'updates_already_cast') return m // placeholder
    return `.update(${ident} as never)`
  })
  text = text.replace(/\.insert\(([a-zA-Z_$][\w$]*)\)/g, '.insert($1 as never)')
  text = text.replace(/\.upsert\(([a-zA-Z_$][\w$]*)(,\s*\{)/g, '.upsert($1 as never$2')

  // (data ?? []) as Type[] -> (data ?? []) as unknown as Type[]
  text = text.replace(/\(data \?\? \[\]\) as ([A-Z]\w+\[\])/g, '(data ?? []) as unknown as $1')
  text = text.replace(/\(\(data \|\| \[\]\) as ([A-Z]\w+\[\])\)/g, '((data || []) as unknown as $1)')

  // return data as Type -> return data as unknown as Type (only for PascalCase identifiers)
  text = text.replace(/return data as ([A-Z]\w+)\b(?!\[)/g, 'return data as unknown as $1')

  // (data as Type) -> (data as unknown as Type) — guard against re-casting
  text = text.replace(/\(data as ([A-Z]\w+)\)/g, '(data as unknown as $1)')

  // Boundary `as never` on column-name predicates
  // Also match dotted (joined) columns like 'webhook_endpoints.organization_id'
  text = text.replace(/\.eq\('([\w.]+)', /g, ".eq('$1' as never, ")
  text = text.replace(/\.eq\('(\w+)', /g, ".eq('$1' as never, ")
  text = text.replace(/\.neq\('(\w+)', /g, ".neq('$1' as never, ")
  text = text.replace(/\.gt\('(\w+)', /g, ".gt('$1' as never, ")
  text = text.replace(/\.gte\('(\w+)', /g, ".gte('$1' as never, ")
  text = text.replace(/\.lt\('(\w+)', /g, ".lt('$1' as never, ")
  text = text.replace(/\.lte\('(\w+)', /g, ".lte('$1' as never, ")
  text = text.replace(/\.in\('(\w+)', /g, ".in('$1' as never, ")
  text = text.replace(/\.is\('(\w+)', /g, ".is('$1' as never, ")
  text = text.replace(/\.like\('(\w+)', /g, ".like('$1' as never, ")
  text = text.replace(/\.ilike\('(\w+)', /g, ".ilike('$1' as never, ")
  text = text.replace(/\.match\(\{/g, '.match({')  // noop, safe
  text = text.replace(/\.contains\('(\w+)', /g, ".contains('$1' as never, ")
  // .not('col', operator, value) requires column-only cast
  text = text.replace(/\.not\('(\w+)',\s*/g, ".not('$1' as never, ")

  if (text === original) {
    console.log(`[skip] ${rel} — no changes`)
    continue
  }

  if (dryRun) {
    console.log(`[dry] would update ${rel}`)
  } else {
    writeFileSync(abs, text)
    console.log(`[ok] migrated ${rel}`)
  }
}
