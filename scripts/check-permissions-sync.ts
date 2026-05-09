#!/usr/bin/env tsx
// CI gate: fails if the generated migration + edge mirror have drifted from
// what `npm run permissions:generate` would produce given the current
// src/permissions.ts. Run as part of test.yml.

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildSql, buildEdgeMirror } from './lib/permissions-codegen'

const REPO_ROOT = join(import.meta.dirname, '..')
const SQL_PATH = join(REPO_ROOT, 'supabase/migrations/20260511000000_role_constraint_15_roles.sql')
const EDGE_PATH = join(REPO_ROOT, 'supabase/functions/shared/permissions.ts')

function main(): never {
  const expectedSql = buildSql()
  const expectedEdge = buildEdgeMirror()

  const errors: string[] = []

  if (!existsSync(SQL_PATH)) {
    errors.push(`Missing migration: ${SQL_PATH}\n  Run: npm run permissions:generate`)
  } else {
    const actualSql = readFileSync(SQL_PATH, 'utf8')
    if (actualSql !== expectedSql) {
      errors.push(
        `Migration drift detected: ${SQL_PATH}\n` +
          `  Run: npm run permissions:generate\n` +
          `  (src/permissions.ts and the migration disagree on ROLES or ROLE_HIERARCHY.)`,
      )
    }
  }

  if (!existsSync(EDGE_PATH)) {
    errors.push(`Missing edge mirror: ${EDGE_PATH}\n  Run: npm run permissions:generate`)
  } else {
    const actualEdge = readFileSync(EDGE_PATH, 'utf8')
    if (actualEdge !== expectedEdge) {
      errors.push(
        `Edge mirror drift detected: ${EDGE_PATH}\n` +
          `  Run: npm run permissions:generate\n` +
          `  (src/permissions.ts and the edge mirror disagree.)`,
      )
    }
  }

  if (errors.length > 0) {
    // eslint-disable-next-line no-console
    console.error('✗ permissions:check failed:\n')
    for (const err of errors) {
      // eslint-disable-next-line no-console
      console.error(err + '\n')
    }
    process.exit(1)
  }

  // eslint-disable-next-line no-console
  console.log('✓ permissions in sync — SQL migration + edge mirror match src/permissions.ts')
  process.exit(0)
}

main()
