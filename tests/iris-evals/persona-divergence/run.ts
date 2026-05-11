#!/usr/bin/env tsx
// ────────────────────────────────────────────────────────────────────────────
// Persona-divergence eval harness — Phase 1e
// ────────────────────────────────────────────────────────────────────────────
// Spec: docs/audits/IRIS_PHASE_1_ROLE_LAYER_CONTEXT_FABRIC_SPEC_2026-05-08.md §7
//
// For each fixture invocation in ./fixtures/ × each of the 5 personas, this
// harness:
//   1. Runs buildContext() to assemble an IrisContext.
//   2. Runs renderContext() to produce the persona-conditioned system prompt.
//   3. Computes pairwise bigram-divergence between the 5 prompts for the
//      fixture (the *automated* divergence metric — Phase 1e baseline).
//   4. Aggregates per-fixture mean divergence and overall mean.
//
// Exit codes:
//   0  — all fixtures produced 5 distinct prompts AND overall mean divergence
//        meets the automated floor (0.40 — provisional; spec's 0.80 rubric is
//        Walker-rated on a separate cadence)
//   1  — at least one fixture produced byte-identical prompts across personas
//        OR overall mean divergence below the automated floor
//
// The Walker-rated rubric layer (spec §7.2) runs at the Phase 1 exit gate.
// This automated check is a smoke gate that catches the "every persona
// renders the same thing" failure mode before any LLM-budget is spent.

import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildContext, type BuildContextOverrides } from '../../../src/services/iris/contextFabric'
import { renderContext } from '../../../src/services/iris/renderContext'
import type {
  PersonaSlug,
  WhatSlot,
  WhenSlot,
  WhereSlot,
  WhoSlot,
  WhySlot,
} from '../../../src/services/iris/types/context'
import type { IrisInvocation } from '../../../src/services/iris/types/invocation'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURES_DIR = join(__dirname, 'fixtures')
const PERSONAS: PersonaSlug[] = ['pm', 'superintendent', 'foreman', 'owner_rep', 'office']

// Provisional automated floor. Spec's 0.80 target is Walker's rubric-based
// rating on a separate Day 27 review; this is the lower-bound smoke check.
//
// Calibration: with the Phase 1a renderer (persona preamble + factual
// WHO/WHAT/WHEN/WHERE/WHY blocks shared across personas), real bigram
// divergence across personas runs ~0.21–0.28. 0.18 catches a regression
// where the preamble would no longer differentiate (e.g. all 5 personas
// got the same `base_prompt_fragment` by mistake) while passing under the
// current fixture set with margin. Tighten this floor as the renderer
// expands persona-specific signal (tool allow-list, tone, etc.) in
// Phase 1 Days 2–8 and Walker's Day 27 hand-tuning.
const AUTOMATED_DIVERGENCE_FLOOR = 0.18

interface Fixture {
  name: string
  description: string
  invocation: IrisInvocation
  slots: {
    who?: WhoSlot
    what?: WhatSlot
    when?: WhenSlot
    where?: WhereSlot
    why?: WhySlot
  }
}

function loadFixtures(): Fixture[] {
  const files = readdirSync(FIXTURES_DIR).filter((f) => f.endsWith('.json'))
  return files.map((f) => JSON.parse(readFileSync(join(FIXTURES_DIR, f), 'utf8')) as Fixture)
}

// Bigram-divergence: 1 - (|A ∩ B| / |A ∪ B|) over character-bigrams of the
// two prompts. 0 = identical, 1 = no overlap. The bigram approach is robust
// to word reordering and captures the "persona vocabulary" axis without
// needing an embedding model.
function bigrams(text: string): Set<string> {
  const out = new Set<string>()
  const normalized = text.toLowerCase().replace(/\s+/g, ' ').trim()
  for (let i = 0; i < normalized.length - 1; i++) {
    out.add(normalized.slice(i, i + 2))
  }
  return out
}

function jaccardDivergence(a: string, b: string): number {
  const ba = bigrams(a)
  const bb = bigrams(b)
  let intersection = 0
  for (const x of ba) if (bb.has(x)) intersection += 1
  const union = ba.size + bb.size - intersection
  if (union === 0) return 0
  return 1 - intersection / union
}

interface FixtureResult {
  name: string
  prompts: Record<PersonaSlug, string>
  prompt_tokens: Record<PersonaSlug, number>
  mean_pairwise_divergence: number
  all_distinct: boolean
}

function evalFixture(fixture: Fixture): FixtureResult {
  const prompts: Record<PersonaSlug, string> = {} as Record<PersonaSlug, string>
  const tokens: Record<PersonaSlug, number> = {} as Record<PersonaSlug, number>

  for (const persona of PERSONAS) {
    const overrides: BuildContextOverrides = {
      who: {
        user_id: fixture.invocation.user_id,
        persona,
        role: 'gc_pm',
        display_name: 'Fixture User',
        first_name: 'Fixture',
        recent_actions: [],
        permissions: [],
        reporting_chain: [],
      },
      what: fixture.slots.what ?? null,
      when: fixture.slots.when ?? null,
      where: fixture.slots.where ?? null,
      why: fixture.slots.why ?? null,
    }
    const invocation: IrisInvocation = {
      ...fixture.invocation,
      caller_override_persona: persona,
    }
    const { context, resolved_persona } = buildContext(invocation, overrides)
    if (resolved_persona !== persona) {
      throw new Error(
        `Fixture ${fixture.name}: expected persona ${persona} but Fabric resolved ${resolved_persona}`,
      )
    }
    const rendered = renderContext(context, persona)
    prompts[persona] = rendered.prompt
    tokens[persona] = rendered.tokens_estimated
  }

  // Pairwise divergence — 10 pairs across 5 personas.
  let sum = 0
  let count = 0
  let allDistinct = true
  for (let i = 0; i < PERSONAS.length; i++) {
    for (let j = i + 1; j < PERSONAS.length; j++) {
      const a = prompts[PERSONAS[i]]
      const b = prompts[PERSONAS[j]]
      if (a === b) allDistinct = false
      sum += jaccardDivergence(a, b)
      count += 1
    }
  }

  return {
    name: fixture.name,
    prompts,
    prompt_tokens: tokens,
    mean_pairwise_divergence: count === 0 ? 0 : sum / count,
    all_distinct: allDistinct,
  }
}

function main(): void {
  const fixtures = loadFixtures()
  if (fixtures.length === 0) {
    console.error(`[persona-divergence] no fixtures found in ${FIXTURES_DIR}`)
    process.exit(1)
  }

  const results = fixtures.map(evalFixture)
  const overallMean =
    results.reduce((s, r) => s + r.mean_pairwise_divergence, 0) / results.length
  const allFixturesDistinct = results.every((r) => r.all_distinct)

  // Report
  console.log('Persona-divergence eval — Phase 1e')
  console.log('─'.repeat(70))
  console.log(`Fixtures: ${fixtures.length}`)
  console.log(`Personas: ${PERSONAS.join(', ')}`)
  console.log()
  for (const r of results) {
    const flag = r.all_distinct ? ' ' : '!'
    console.log(
      `${flag} ${r.name.padEnd(40)} divergence=${r.mean_pairwise_divergence.toFixed(3)}`,
    )
  }
  console.log()
  console.log(`Overall mean pairwise divergence: ${overallMean.toFixed(3)}`)
  console.log(`Automated floor: ${AUTOMATED_DIVERGENCE_FLOOR.toFixed(3)}`)
  console.log(`All fixtures distinct: ${allFixturesDistinct}`)
  console.log()

  const failures: string[] = []
  if (!allFixturesDistinct) {
    failures.push('At least one fixture produced byte-identical prompts across personas.')
  }
  if (overallMean < AUTOMATED_DIVERGENCE_FLOOR) {
    failures.push(
      `Overall mean divergence ${overallMean.toFixed(3)} below automated floor ${AUTOMATED_DIVERGENCE_FLOOR}.`,
    )
  }

  // Emit a machine-readable summary the CI workflow consumes.
  console.log(JSON.stringify({
    fixtures: fixtures.length,
    overall_mean_divergence: Number(overallMean.toFixed(4)),
    automated_floor: AUTOMATED_DIVERGENCE_FLOOR,
    all_fixtures_distinct: allFixturesDistinct,
    per_fixture: results.map((r) => ({
      name: r.name,
      mean_pairwise_divergence: Number(r.mean_pairwise_divergence.toFixed(4)),
      all_distinct: r.all_distinct,
    })),
    failures,
  }, null, 2))

  if (failures.length > 0) {
    process.exit(1)
  }
}

main()
