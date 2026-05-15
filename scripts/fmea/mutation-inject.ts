#!/usr/bin/env tsx
/**
 * mutation-inject.ts — proves a test catches the hazard it claims to catch.
 *
 * Workflow:
 *   1. Read the test file + target source line(s) the test asserts against.
 *   2. Create an isolated git worktree.
 *   3. Apply a small mutation to the target (comment out, invert, return null).
 *   4. Run the test — assert FAILURE.
 *   5. Revert the mutation (worktree thrown away).
 *   6. Run the test in main — assert PASS.
 *   7. If both hold → status: VALIDATED. Otherwise → PARTIAL.
 *
 * Designed for the fmea-validator sub-agent to call after a new test PR merges.
 * Refuses to touch main; only operates in a throwaway worktree.
 *
 * Usage:
 *   npx tsx scripts/fmea/mutation-inject.ts \
 *     --test tests/security/jwt.spec.ts \
 *     --target src/auth/verifyJwt.ts:42 \
 *     --mutation comment-out  # | invert | return-null
 *
 * Exit codes:
 *   0 = mutation confirmed test catches hazard (test fails with mutation, passes without)
 *   1 = test passes even with mutation injected (test is not actually validating the hazard)
 *   2 = test fails without mutation (test is broken; not a validation issue)
 *   3 = setup error (worktree, file not found, etc.)
 *
 * Uses execFileSync (no shell) to prevent command injection.
 */

import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, existsSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '../..')

type Mutation = 'comment-out' | 'invert' | 'return-null'

interface Args {
  test: string
  target: string // path:line
  mutation: Mutation
}

function parseArgs(): Args {
  const args = process.argv.slice(2)
  const opt = (flag: string): string | undefined => {
    const i = args.indexOf(flag)
    if (i === -1 || i === args.length - 1) return undefined
    return args[i + 1]
  }
  const test = opt('--test')
  const target = opt('--target')
  const mutation = (opt('--mutation') ?? 'comment-out') as Mutation
  if (!test || !target) {
    console.error('usage: mutation-inject.ts --test <path> --target <path:line> [--mutation comment-out|invert|return-null]')
    process.exit(3)
  }
  if (!['comment-out', 'invert', 'return-null'].includes(mutation)) {
    console.error(`invalid mutation: ${mutation}`)
    process.exit(3)
  }
  return { test, target, mutation }
}

function parseTarget(target: string): { file: string; line: number } {
  const [file, lineStr] = target.split(':')
  const line = parseInt(lineStr, 10)
  if (!file || !Number.isFinite(line)) {
    throw new Error(`invalid target: ${target}`)
  }
  return { file, line }
}

function mutateLine(content: string, line: number, mutation: Mutation): string {
  const lines = content.split('\n')
  if (line < 1 || line > lines.length) {
    throw new Error(`line ${line} out of range (file has ${lines.length} lines)`)
  }
  const original = lines[line - 1]
  let mutated: string
  switch (mutation) {
    case 'comment-out':
      mutated = `// MUTATION_INJECT: ${original}`
      break
    case 'invert':
      // Crude: flip `===` to `!==`, `true` to `false`, etc.
      mutated = original
        .replace(/===/g, '___EQ3___')
        .replace(/!==/g, '===')
        .replace(/___EQ3___/g, '!==')
        .replace(/\btrue\b/g, '___TRUE___')
        .replace(/\bfalse\b/g, 'true')
        .replace(/___TRUE___/g, 'false')
      if (mutated === original) {
        mutated = `// MUTATION_INJECT_INVERT_NOOP: ${original}`
      }
      break
    case 'return-null':
      // Inject `return null;` before this line
      mutated = `return null; // MUTATION_INJECT\n${original}`
      break
  }
  lines[line - 1] = mutated
  return lines.join('\n')
}

function runTest(worktreeDir: string, testPath: string): boolean {
  // returns true if test passes, false if fails
  try {
    execFileSync(
      'npx',
      ['vitest', 'run', testPath, '--reporter=dot'],
      { cwd: worktreeDir, stdio: 'pipe', encoding: 'utf-8' },
    )
    return true
  } catch {
    return false
  }
}

function main(): void {
  const { test, target, mutation } = parseArgs()
  const { file, line } = parseTarget(target)

  const testFullPath = resolve(REPO_ROOT, test)
  const targetFullPath = resolve(REPO_ROOT, file)

  if (!existsSync(testFullPath)) {
    console.error(`test not found: ${testFullPath}`)
    process.exit(3)
  }
  if (!existsSync(targetFullPath)) {
    console.error(`target not found: ${targetFullPath}`)
    process.exit(3)
  }

  // Step 1: run test in main (no mutation) — must pass for validation to be possible
  console.log('step 1: running test in main (no mutation)...')
  const mainPasses = runTest(REPO_ROOT, test)
  if (!mainPasses) {
    console.error(`::error::test ${test} fails in main without mutation. Test is broken.`)
    process.exit(2)
  }
  console.log('  PASS')

  // Step 2: create worktree
  const wtDir = mkdtempSync(join(tmpdir(), 'fmea-mutation-'))
  console.log(`step 2: creating worktree at ${wtDir}...`)
  execFileSync('git', ['worktree', 'add', wtDir, 'HEAD'], { cwd: REPO_ROOT, stdio: 'pipe' })

  try {
    // Step 3: apply mutation in worktree
    const worktreeTarget = join(wtDir, file)
    const original = readFileSync(worktreeTarget, 'utf-8')
    const mutated = mutateLine(original, line, mutation)
    writeFileSync(worktreeTarget, mutated, 'utf-8')
    console.log(`step 3: mutated ${file}:${line} (${mutation})`)

    // Step 4: install deps (use main's node_modules via symlink to avoid double-install)
    const nmLink = join(wtDir, 'node_modules')
    try {
      execFileSync('ln', ['-s', join(REPO_ROOT, 'node_modules'), nmLink])
    } catch {
      // already exists
    }

    // Step 5: run test in worktree
    console.log('step 5: running test with mutation...')
    const mutationPasses = runTest(wtDir, test)

    if (mutationPasses) {
      console.log(`::error::test ${test} STILL PASSES with mutation. Test is PARTIAL (doesn't catch hazard).`)
      process.exit(1)
    }
    console.log('  test FAILED with mutation (as expected)')

    // Step 6: final check — confirm reverting also works (sanity)
    console.log('step 6: reverting mutation in worktree (sanity)...')
    writeFileSync(worktreeTarget, original, 'utf-8')
    const revertedPasses = runTest(wtDir, test)
    if (!revertedPasses) {
      console.error('::error::test still fails after revert — worktree state corrupted')
      process.exit(3)
    }
    console.log('  test PASSES after revert')

    console.log('::notice::mutation confirms test catches hazard. Catalog status → VALIDATED')
  } finally {
    // Cleanup worktree
    try {
      execFileSync('git', ['worktree', 'remove', '--force', wtDir], { cwd: REPO_ROOT, stdio: 'pipe' })
    } catch (e) {
      console.error(`worktree cleanup failed: ${(e as Error).message}`)
    }
  }
}

main()
