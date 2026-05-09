#!/usr/bin/env tsx
// Generates the role-permission DB migration + edge mirror from src/permissions.ts.
//
// Outputs:
//   1. supabase/migrations/20260511000000_role_constraint_15_roles.sql
//      — drops the legacy 6-role CHECK on project_members.role and replaces it
//        with the 15-role list from permissions.ts. Rewrites
//        has_project_permission() with the matching hierarchy.
//   2. supabase/functions/shared/permissions.ts
//      — Deno-compatible mirror containing ROLES, Role, ROLE_HIERARCHY,
//        PERMISSION_MATRIX, can(), canAny(), isAtLeast(), getAllowedActions().
//        Edge functions (agent-runner, iris-ground) import from here.
//
// Run: `npm run permissions:generate`
// Drift CI:   `npm run permissions:check`
//
// Why generate the SQL: Postgres has no native way to enforce that the CHECK
// constraint matches a TS enum. The codegen + sync-check makes the drift
// impossible without a CI failure.

import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { ROLES, PERMISSION_MATRIX } from '../src/permissions'
import { buildSql, buildEdgeMirror } from './lib/permissions-codegen'

const REPO_ROOT = join(import.meta.dirname, '..')
const SQL_PATH = join(REPO_ROOT, 'supabase/migrations/20260511000000_role_constraint_15_roles.sql')
const EDGE_PATH = join(REPO_ROOT, 'supabase/functions/shared/permissions.ts')

function main() {
  const sql = buildSql()
  const edge = buildEdgeMirror()

  writeFileSync(SQL_PATH, sql, 'utf8')
  writeFileSync(EDGE_PATH, edge, 'utf8')

  // eslint-disable-next-line no-console
  console.log(`✓ wrote ${SQL_PATH} (${sql.length} bytes)`)
  // eslint-disable-next-line no-console
  console.log(`✓ wrote ${EDGE_PATH} (${edge.length} bytes)`)
  // eslint-disable-next-line no-console
  console.log(`  ROLES: ${ROLES.length}, PERMISSION_MATRIX rows: ${Object.keys(PERMISSION_MATRIX).length}`)
}

main()
