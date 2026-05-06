/**
 * runSeed — invoke scripts/seed-90-day-lifecycle.ts as a child process.
 *
 * Pulled out of the spec so the spec body reads as a list of test.step()
 * blocks, not a wall of `spawn` boilerplate. Surfaces stderr verbatim
 * when the seed fails so the spec failure message points at the seam
 * (seed script vs spec assertion).
 */

import { spawn } from 'node:child_process'

export interface SeedResult {
  exitCode: number
  stdout: string
  stderr: string
  /** Total rows inserted, parsed from the seed's summary table. -1 if unparsable. */
  totalRows: number
}

export async function runSeed(projectId: string, opts: { quiet?: boolean } = {}): Promise<SeedResult> {
  const args = ['tsx', 'scripts/seed-90-day-lifecycle.ts', '--project-id', projectId]
  if (opts.quiet) args.push('--quiet')

  const child = spawn('npx', args, {
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  let stdout = ''
  let stderr = ''
  child.stdout.on('data', (chunk) => { stdout += chunk.toString() })
  child.stderr.on('data', (chunk) => { stderr += chunk.toString() })

  const exitCode: number = await new Promise((resolve, reject) => {
    child.on('error', reject)
    child.on('close', (code) => resolve(code ?? -1))
  })

  // The seed prints a final line: "   total rows:    NNNN"
  const totalRows = (() => {
    const m = stdout.match(/total rows:\s+(\d+)/i)
    return m ? Number(m[1]) : -1
  })()

  return { exitCode, stdout, stderr, totalRows }
}
