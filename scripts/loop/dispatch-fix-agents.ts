#!/usr/bin/env tsx
/**
 * dispatch-fix-agents.ts — turn a parse-gate-failures.ts JSON document into
 * a list of agent prompts the loop's orchestrator can spawn in parallel.
 *
 * Each failure CLASS (not each failure) gets one agent. The agent receives
 * the full list of failures in its class. Up to 5 agents per iteration.
 *
 * Output (stdout, JSON):
 *   [
 *     { class: "selector-aligner", prompt: "...", failures: [...] },
 *     ...
 *   ]
 *
 * Usage:
 *   npx tsx scripts/loop/parse-gate-failures.ts <run-id> \
 *     | npx tsx scripts/loop/dispatch-fix-agents.ts
 *
 * The orchestrator (Claude Code Agent tool) consumes this and spawns one
 * subagent per entry with run_in_background=true.
 */

import { readFileSync } from 'node:fs'

type FailureClass =
  | 'selector-aligner'
  | 'platform-bug'
  | 'infra-bug'
  | 'test-spec'
  | 'unfixable'

interface Failure {
  workflow: string
  job: string
  test: string | null
  errorLine: string
  category: FailureClass
  retryCount: number
}

interface Summary {
  total: number
  by_category: Record<string, number>
  failures: Record<FailureClass, Failure[]>
}

const AGENT_PROMPTS: Record<FailureClass, (fs: Failure[]) => string> = {
  'selector-aligner': (fs) => `Working dir: \`/Users/walkerbenner/Desktop/sitesync-main\`. Branch from latest main into a uniquely-named fix branch.

You're the selector-aligner agent for the functional-frog self-heal loop. ${fs.length} Playwright test(s) are timing out on selector waits — the spec's locator doesn't match real DOM.

For each failing test below, open the spec + matching \`src/pages/**\` source file, identify the real DOM (real placeholder, aria-label, test id, button text), and update the spec's locator. DO NOT change source. DO NOT alter test assertions.

Failures:
${fs.map((f, i) => `${i + 1}. ${f.test}\n   Error: ${f.errorLine}`).join('\n')}

Commit per file or one omnibus commit. Push, open PR titled \`fix(coverage): selector alignment — <suite> <count tests>\`, queue auto-merge with \`gh pr merge --auto --squash --delete-branch\`. Report PR URL + per-test fix description.`,

  'platform-bug': (fs) => `Working dir: \`/Users/walkerbenner/Desktop/sitesync-main\`. Branch from latest main.

You're the platform-diagnoser agent for the functional-frog self-heal loop. ${fs.length} test(s) hit real platform errors — DB errors, RPC failures, schema drift, RLS rejection.

Investigate each one:
1. Read the failing test log + the relevant src/ + supabase/functions/ + supabase/migrations/ + relevant edge function source.
2. Use Supabase MCP \`get_logs\` for the project (\`nrsbvqkpxxlonvkmcmxf\` = staging) at the same timestamp.
3. Determine root cause.
4. If mechanical (column rename, trigger drift, missing migration): apply the fix. STAGING migrations: apply via \`apply_migration\` MCP. PROD migrations: also apply via \`apply_migration\` against \`hypxrmcppjfbtlwuoafc\` — user has granted blanket authorization per \`~/.claude/plans/fix-everything-and-keep-compiled-sky.md\`. Pair each apply with shadow row in \`supabase_migrations.schema_migrations\`.
5. If not mechanical (needs product decision): open a GitHub Issue with full repro using template \`.github/ISSUE_TEMPLATE/loop-detected-bug.md\`. Add the file/test to \`.agent/loop-state.json.quarantined\`.

Failures:
${fs.map((f, i) => `${i + 1}. ${f.test}\n   Error: ${f.errorLine}`).join('\n')}

Commit, push, PR titled \`fix(platform): <summary>\`, queue auto-merge. Report PR URL + per-failure resolution (fixed / quarantined → issue #N).`,

  'infra-bug': (fs) => `Working dir: \`/Users/walkerbenner/Desktop/sitesync-main\`. Branch from latest main.

You're the gate-tuner agent for the functional-frog self-heal loop. ${fs.length} CI-infrastructure failure(s) — workflow YAML, secrets, runner OOM, browser install, timeouts at workflow level.

For each one: edit the relevant \`.github/workflows/gate-*.yml\` to fix the issue. Common fixes:
- Missing env var → add \`secrets.STAGING_*\` to env block
- Timeout too low → bump \`timeout-minutes\`
- Browser install flake → add retry around \`npx playwright install\`
- Path filter missing self → add \`.github/workflows/gate-N-*.yml\` to its own paths

Failures:
${fs.map((f, i) => `${i + 1}. ${f.test ?? f.job}\n   Error: ${f.errorLine}`).join('\n')}

Validate each YAML via \`node -e "require('js-yaml').load(require('fs').readFileSync('<path>'))"\`. Commit, push, PR titled \`fix(gates): <summary>\`, queue auto-merge. Report PR URL + per-gate fix.`,

  'test-spec': (fs) => `Working dir: \`/Users/walkerbenner/Desktop/sitesync-main\`. Branch from latest main.

You're the test-spec fixer for the functional-frog self-heal loop. ${fs.length} spec(s) have non-runtime errors: ESM \`__dirname\` issues, missing imports, syntax errors, vitest/playwright config mismatches.

For each one:
1. Read the spec to find the error site.
2. Apply the mechanical fix (e.g., \`__dirname\` → \`fileURLToPath(import.meta.url)\` + \`dirname()\`).
3. Verify locally: \`npx vitest run <path>\` or \`npx playwright test <path> --list\` (no real run, just compile).

Failures:
${fs.map((f, i) => `${i + 1}. ${f.test}\n   Error: ${f.errorLine}`).join('\n')}

Commit, push, PR titled \`fix(test-spec): <summary>\`, queue auto-merge. Report PR URL + per-spec fix.`,

  'unfixable': (fs) => `Working dir: \`/Users/walkerbenner/Desktop/sitesync-main\`.

You're the issue-opener for the functional-frog self-heal loop. ${fs.length} failure(s) couldn't be auto-categorized OR have been retried 5+ times without resolution.

For each one: open a GitHub Issue using template \`.github/ISSUE_TEMPLATE/loop-detected-bug.md\`. Include CI run link, error signature, hypothesis. Add the file/test pair to \`.agent/loop-state.json.quarantined\` so subsequent iterations skip it until Walker acts on the issue.

Failures:
${fs.map((f, i) => `${i + 1}. ${f.test}\n   Error: ${f.errorLine}`).join('\n')}

Report: list of Issue URLs created + updated \`.agent/loop-state.json\`.`,
}

function main(): void {
  const stdin = readFileSync(0, 'utf-8')
  const summary = JSON.parse(stdin) as Summary

  const dispatched: Array<{
    class: FailureClass
    prompt: string
    failures: Failure[]
  }> = []

  // Order: platform-bug first (highest impact), then selector, test-spec, infra, unfixable
  const order: FailureClass[] = [
    'platform-bug',
    'selector-aligner',
    'test-spec',
    'infra-bug',
    'unfixable',
  ]
  for (const cls of order) {
    const fs = summary.failures[cls] ?? []
    if (fs.length === 0) continue
    dispatched.push({ class: cls, prompt: AGENT_PROMPTS[cls](fs), failures: fs })
    if (dispatched.length >= 5) break
  }

  console.log(JSON.stringify(dispatched, null, 2))
}

main()
