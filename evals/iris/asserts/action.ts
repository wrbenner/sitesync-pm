/**
 * evals/iris/asserts/action.ts
 *
 * Structural assertion on the Iris-call response. The voice and
 * citation asserts grade language and grounding; this assert grades
 * SHAPE — does the response satisfy the action_type's structural
 * contract?
 *
 * Each constraint is independent and AND-ed:
 *   - maxWords / minWords     length bounds (case-insensitive whitespace)
 *   - mustContain             every listed substring is present
 *   - mustNotContain          no listed substring is present
 *   - bulletSectionCount      daily-log only: number of bullet groups
 *
 * The assert is intentionally simple — sophisticated semantic checks
 * belong in the voice rules + citation resolver. This is the structural
 * floor that says "if Iris returned a 5,000-word essay when the cap was
 * 60, fail loudly."
 *
 * Reference: docs/audits/IRIS_EVAL_PIPELINE_SPEC_2026-05-08.md § Asserts
 */

import type { EvalCorpusRow, IrisProviderOutput } from '../types'

export interface ActionAssertResult {
  passed: boolean
  failures: string[]
  reason: string
}

const BULLET_LINE = /^\s*[-*•]\s+/

function countBulletSections(text: string): number {
  // A "section" = one or more consecutive bullet lines, separated by
  // a blank line OR by a non-bullet line. This is a heuristic — real
  // daily-log narratives use either bullet lists per heading or a
  // mix; either passes when the count matches.
  const lines = text.split(/\r?\n/)
  let sections = 0
  let inSection = false
  for (const line of lines) {
    const isBullet = BULLET_LINE.test(line)
    if (isBullet && !inSection) {
      sections++
      inSection = true
    } else if (!isBullet && line.trim().length === 0) {
      inSection = false
    } else if (!isBullet && line.trim().length > 0) {
      // Heading lines or prose between sections close the current section.
      inSection = false
    }
  }
  return sections
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter((w) => w.length > 0).length
}

export function assertActionShape(
  row: EvalCorpusRow,
  out: IrisProviderOutput,
): ActionAssertResult {
  const text = out.output
  const shape = row.expected.actionShape
  const failures: string[] = []

  if (shape.maxWords != null) {
    const wc = wordCount(text)
    if (wc > shape.maxWords) failures.push(`word count ${wc} > maxWords ${shape.maxWords}`)
  }
  if (shape.minWords != null) {
    const wc = wordCount(text)
    if (wc < shape.minWords) failures.push(`word count ${wc} < minWords ${shape.minWords}`)
  }

  if (shape.mustContain) {
    const lower = text.toLowerCase()
    for (const needle of shape.mustContain) {
      if (!lower.includes(needle.toLowerCase())) {
        failures.push(`missing required substring: "${needle}"`)
      }
    }
  }

  if (shape.mustNotContain) {
    const lower = text.toLowerCase()
    for (const banned of shape.mustNotContain) {
      if (lower.includes(banned.toLowerCase())) {
        failures.push(`contains banned substring: "${banned}"`)
      }
    }
  }

  if (shape.bulletSectionCount != null) {
    const count = countBulletSections(text)
    if (count !== shape.bulletSectionCount) {
      failures.push(`bullet sections ${count} != expected ${shape.bulletSectionCount}`)
    }
  }

  const passed = failures.length === 0
  return {
    passed,
    failures,
    reason: passed ? 'shape ok' : failures.join('; '),
  }
}
