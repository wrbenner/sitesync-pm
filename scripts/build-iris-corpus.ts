/**
 * scripts/build-iris-corpus.ts — generate evals/iris/corpus/seed.jsonl
 *
 * Walks the 6 DraftedActionType values × 5 confidence buckets to emit a
 * 30-row synthetic seed corpus. Each row targets one or more voice rules
 * from `src/lib/iris/style.ts` so a regression in any rule (prompt
 * change, model swap, retrieval drift) surfaces in CI.
 *
 * Idempotent — re-running rewrites the file in place.
 *
 * Usage:
 *   npx tsx scripts/build-iris-corpus.ts
 *   npx tsx scripts/build-iris-corpus.ts --print     # echo to stdout instead
 *
 * Reference: docs/audits/IRIS_EVAL_PIPELINE_SPEC_2026-05-08.md
 *            docs/audits/IRIS_VOICE_GUIDE_SPEC_2026-05-04.md
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { DraftedActionType } from '../src/types/draftedActions'
import type { EvalCorpusRow } from '../evals/iris/types'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const OUT_PATH = resolve(__dirname, '..', 'evals', 'iris', 'corpus', 'seed.jsonl')

const ACTION_TYPES: DraftedActionType[] = [
  'rfi.draft',
  'daily_log.draft',
  'pay_app.draft',
  'punch_item.draft',
  'schedule.resequence',
  'submittal.transmittal_draft',
]

/**
 * Synthetic-prompt template per action type. Each prompt deliberately
 * includes a phrase that should trigger a voice rule (em-dash, contraction,
 * "certainly", etc.) so the linter has something to grade.
 *
 * The structure: 5 prompts per action type, one per confidence bucket
 * (0=low signal, 4=high signal). Prompt difficulty rises across the band.
 */
const TEMPLATES: Record<DraftedActionType, ReadonlyArray<{
  prompt: string
  voiceRuleIds: string[]
  citationKinds: EvalCorpusRow['expected']['citationKinds']
  actionShape: EvalCorpusRow['expected']['actionShape']
}>> = {
  'rfi.draft': [
    {
      prompt: 'Architect missed the wall finish at column line 7. We need an answer to keep the slab pour on Friday. Draft an RFI follow-up under 60 words.',
      voiceRuleIds: ['no-em-dash', 'no-i-hope-this-helps', 'rfi-followup-length', 'no-contractions-in-formal-actions', 'acronym-casing'],
      citationKinds: ['drawing_coordinate'],
      actionShape: { maxWords: 60, mustNotContain: ['—', 'I hope this helps'] },
    },
    {
      prompt: 'The submittal for door hardware (spec 08 71 00) is overdue. Draft an RFI follow-up that asks the architect for a revised disposition deadline. Keep it tight.',
      voiceRuleIds: ['no-em-dash', 'no-great-question', 'rfi-followup-length', 'no-filler-words'],
      citationKinds: ['spec_reference'],
      actionShape: { maxWords: 60, mustNotContain: ['Great question', 'absolutely'] },
    },
    {
      prompt: 'Owner wants a written follow-up after the field meeting where the MEP coordinator flagged a conflict above the ceiling at grid B/4. Draft.',
      voiceRuleIds: ['no-em-dash', 'rfi-followup-length', 'use-construction-vernacular', 'acronym-casing'],
      citationKinds: ['drawing_coordinate', 'rfi_reference'],
      actionShape: { maxWords: 60 },
    },
    {
      prompt: 'Draft an RFI follow-up about the missing coordination drawing for plumbing risers in core 2. Reference the open RFI #4172. Two sentences max.',
      voiceRuleIds: ['rfi-followup-length', 'rfi-state-question-and-deadline', 'no-em-dash'],
      citationKinds: ['rfi_reference'],
      actionShape: { maxWords: 60, mustContain: ['4172'] },
    },
    {
      prompt: 'Schedule slipped because the MEP rough-in cannot start until the architect releases the wall-finish RFI. Draft a tight follow-up that names the dependency. CRITICAL — must NOT contain em-dashes, must NOT contain "I hope this helps", must use ALL-CAPS for RFI.',
      voiceRuleIds: ['no-em-dash', 'no-i-hope-this-helps', 'rfi-followup-length', 'rfi-state-question-and-deadline', 'acronym-casing', 'no-contractions-in-formal-actions'],
      citationKinds: ['rfi_reference', 'schedule_phase'],
      actionShape: { maxWords: 60, mustNotContain: ['—', 'I hope this helps', 'we\'re', 'we\'ll'] },
    },
  ],
  'daily_log.draft': [
    {
      prompt: 'Walked the site at 7am. Crews on site: 6 carpenters, 4 plumbers, 2 electricians. Weather sunny 72F. Slab pour completed at column line 5. Draft today\'s daily log narrative.',
      voiceRuleIds: ['daily-log-length', 'no-em-dash'],
      citationKinds: [],
      actionShape: { maxWords: 200, bulletSectionCount: 5 },
    },
    {
      prompt: 'Yesterday\'s incident: scaffolding on level 3 was tagged out by safety. Today: trades resumed by 10am after retag. Manpower: 14 onsite. Weather: light rain AM, clear PM. Draft the log.',
      voiceRuleIds: ['daily-log-length', 'no-em-dash', 'use-construction-vernacular'],
      citationKinds: ['photo_observation'],
      actionShape: { maxWords: 200, bulletSectionCount: 5 },
    },
    {
      prompt: 'Trades on site: framers (8), drywall (12), MEP (6). Owner walkthrough at 2pm. Two punch items added (cracked baseboard at unit 304, missing trim at unit 312). Draft the log.',
      voiceRuleIds: ['daily-log-length', 'no-em-dash', 'acronym-casing'],
      citationKinds: ['photo_observation'],
      actionShape: { maxWords: 200, bulletSectionCount: 5 },
    },
    {
      prompt: 'Concrete delivery delayed 4 hours because of a truck breakdown. Pour completed at 6pm. Manpower: 22. Crew worked overtime. Weather: 88F sunny. Owner notified. Draft.',
      voiceRuleIds: ['daily-log-length', 'no-em-dash', 'no-i-hope-this-helps'],
      citationKinds: [],
      actionShape: { maxWords: 200, bulletSectionCount: 5 },
    },
    {
      prompt: 'Multi-trade day: 8 framers, 12 drywallers, 6 MEP, 4 painters. Two photos from level 4 west, three from MEP coordination meeting. Owner walked at 3pm with PM. Draft a complete daily log narrative covering manpower, weather, activities, issues, tomorrow.',
      voiceRuleIds: ['daily-log-length', 'no-em-dash', 'no-filler-words', 'acronym-casing'],
      citationKinds: ['photo_observation', 'daily_log_excerpt'],
      actionShape: { maxWords: 200, bulletSectionCount: 5 },
    },
  ],
  'pay_app.draft': [
    {
      prompt: 'Draft pay app #5 narrative. Total scheduled value $4.2M, work this period $480K, retainage 5%. Three line items hit 80% complete: foundations, framing, MEP rough.',
      voiceRuleIds: ['no-em-dash', 'no-i-hope-this-helps', 'use-construction-vernacular'],
      citationKinds: ['budget_line'],
      actionShape: { mustNotContain: ['—'] },
    },
    {
      prompt: 'Pay app #3, period 04/01-04/30. Owner is questioning the materials-stored line. Walk through the calculation. Schedule of values has 47 line items.',
      voiceRuleIds: ['no-em-dash', 'no-great-question', 'use-construction-vernacular'],
      citationKinds: ['budget_line'],
      actionShape: { mustNotContain: ['Great question'] },
    },
    {
      prompt: 'Pay app draft narrative — change order #12 ($85K) was approved this period and gets billed in full. Retainage staying at 10% pending substantial completion.',
      voiceRuleIds: ['no-em-dash', 'use-construction-vernacular', 'no-contractions-in-formal-actions'],
      citationKinds: ['change_order', 'budget_line'],
      actionShape: { mustNotContain: ['—'] },
    },
    {
      prompt: 'Final pay app — substantial completion was issued 04/15. Retainage release scheduled. Two punch items remain open (door hardware swap, exterior caulking touchup).',
      voiceRuleIds: ['no-em-dash', 'use-construction-vernacular'],
      citationKinds: ['budget_line'],
      actionShape: { mustNotContain: ['—'] },
    },
    {
      prompt: 'Owner is comparing pay app #6 against the original schedule of values and flagged a 3% variance on the structural steel line. Draft a narrative that explains the variance, references CO #8 (steel substitution approved 03/12), and confirms billing accuracy.',
      voiceRuleIds: ['no-em-dash', 'no-i-hope-this-helps', 'use-construction-vernacular', 'acronym-casing', 'no-filler-words'],
      citationKinds: ['change_order', 'budget_line'],
      actionShape: { mustContain: ['#8'], mustNotContain: ['—', 'I hope this helps'] },
    },
  ],
  'punch_item.draft': [
    {
      prompt: 'Drywall photo shows a 2-inch dent at unit 412 hallway near the kitchen entry. Draft a punch item.',
      voiceRuleIds: ['no-em-dash', 'use-construction-vernacular'],
      citationKinds: ['photo_observation'],
      actionShape: { mustNotContain: ['—'] },
    },
    {
      prompt: 'Owner walkthrough flagged scratched paint on the lobby ceiling, three locations. Draft punch items for each.',
      voiceRuleIds: ['no-em-dash', 'no-filler-words'],
      citationKinds: ['photo_observation'],
      actionShape: {},
    },
    {
      prompt: 'Architect noted at substantial completion that the door at unit 207 won\'t latch. Draft a punch item with severity high.',
      voiceRuleIds: ['no-em-dash', 'use-construction-vernacular'],
      citationKinds: ['photo_observation'],
      actionShape: { mustNotContain: ['—'] },
    },
    {
      prompt: 'Field super flagged exposed conduit above the lobby ceiling that wasn\'t in the coordination drawings. Draft a punch item that calls out the location and lists the fix.',
      voiceRuleIds: ['no-em-dash', 'use-construction-vernacular', 'acronym-casing'],
      citationKinds: ['drawing_coordinate', 'photo_observation'],
      actionShape: { mustNotContain: ['—'] },
    },
    {
      prompt: 'CRITICAL punch list cleanup: the owner expects the unit-412 dent, the unit-207 latch, and the lobby ceiling scratches to be tracked as ONE coordinated batch with severity tags. Draft the parent punch item with three children.',
      voiceRuleIds: ['no-em-dash', 'no-i-hope-this-helps', 'use-construction-vernacular', 'no-filler-words'],
      citationKinds: ['photo_observation'],
      actionShape: { mustContain: ['unit'], mustNotContain: ['—', 'I hope this helps'] },
    },
  ],
  'schedule.resequence': [
    {
      prompt: 'MEP rough-in is the long pole. Drywall hangs on it. Propose a parallelize move that pulls 5 days back into the schedule. Two phase IDs.',
      voiceRuleIds: ['no-em-dash', 'use-construction-vernacular', 'acronym-casing'],
      citationKinds: ['schedule_phase'],
      actionShape: { mustNotContain: ['—'] },
    },
    {
      prompt: 'Owner is pushing for substantial completion 14 days earlier. Identify two phases that can run in parallel without violating the inspection sequence.',
      voiceRuleIds: ['no-em-dash', 'use-construction-vernacular'],
      citationKinds: ['schedule_phase'],
      actionShape: {},
    },
    {
      prompt: 'Weather delayed slab pour by 4 days. Resequence MEP rough and underfloor insulation to recover the schedule. Output two parallelize pairs.',
      voiceRuleIds: ['no-em-dash', 'use-construction-vernacular', 'no-contractions-in-formal-actions'],
      citationKinds: ['schedule_phase'],
      actionShape: { mustNotContain: ['—'] },
    },
    {
      prompt: 'Architect approved a phasing change on the lobby finishes. Propose a resequence that lets paint and tile run in parallel on level 1 while level 2 holds.',
      voiceRuleIds: ['no-em-dash', 'use-construction-vernacular'],
      citationKinds: ['schedule_phase'],
      actionShape: { mustNotContain: ['—'] },
    },
    {
      prompt: 'CRITICAL: substantial completion is at risk. Draft a resequence that recovers 7 days by running MEP rough-in on level 3 in parallel with level 2 framing. List exact phase IDs and computed days_recovered. NO em-dashes, NO filler.',
      voiceRuleIds: ['no-em-dash', 'no-filler-words', 'use-construction-vernacular', 'acronym-casing'],
      citationKinds: ['schedule_phase'],
      actionShape: { mustContain: ['phase'], mustNotContain: ['—', 'just', 'actually'] },
    },
  ],
  'submittal.transmittal_draft': [
    {
      prompt: 'Door hardware submittal package ready for transmittal. To: architect (architect@example.com). CC: owner. Mention spec 08 71 00.',
      voiceRuleIds: ['no-em-dash', 'no-contractions-in-formal-actions', 'use-construction-vernacular'],
      citationKinds: ['spec_reference'],
      actionShape: { mustNotContain: ['—', 'we\'re', 'we\'ll'] },
    },
    {
      prompt: 'Steel shop drawings transmittal — owner wants a 5-business-day turnaround. To: architect, structural engineer. Reference RFI #1187.',
      voiceRuleIds: ['no-em-dash', 'no-contractions-in-formal-actions', 'acronym-casing', 'rfi-state-question-and-deadline'],
      citationKinds: ['rfi_reference'],
      actionShape: { mustContain: ['1187'], mustNotContain: ['—'] },
    },
    {
      prompt: 'Resubmittal of the lobby ceiling tile after the architect rejected the original. New manufacturer (Armstrong vs. USG). To: architect. Note the change.',
      voiceRuleIds: ['no-em-dash', 'no-contractions-in-formal-actions', 'use-construction-vernacular'],
      citationKinds: ['spec_reference'],
      actionShape: { mustNotContain: ['—'] },
    },
    {
      prompt: 'Transmittal for the elevator submittal — package includes cab finishes + cab car materials. To: architect (cc engineer). Spec 14 21 00.',
      voiceRuleIds: ['no-em-dash', 'no-contractions-in-formal-actions', 'use-construction-vernacular'],
      citationKinds: ['spec_reference'],
      actionShape: { mustContain: ['14 21 00'], mustNotContain: ['—'] },
    },
    {
      prompt: 'CRITICAL transmittal: third-attempt submittal of the structural steel mill certs. Owner threatened to withhold next pay app if this slips. To: architect, structural engineer, owner. Reference CO #8 + RFI #1187. Tone: tight, no apologies, no LLM filler. Must use ALL-CAPS RFI/CO.',
      voiceRuleIds: ['no-em-dash', 'no-i-hope-this-helps', 'no-great-question', 'no-contractions-in-formal-actions', 'acronym-casing', 'no-filler-words'],
      citationKinds: ['rfi_reference', 'change_order', 'spec_reference'],
      actionShape: { mustContain: ['#8', '1187'], mustNotContain: ['—', 'I hope this helps', 'Great question'] },
    },
  ],
}

function buildCorpus(): EvalCorpusRow[] {
  const rows: EvalCorpusRow[] = []
  for (const actionType of ACTION_TYPES) {
    const templates = TEMPLATES[actionType]
    templates.forEach((t, i) => {
      const bucket = i as 0 | 1 | 2 | 3 | 4
      rows.push({
        id: `${actionType}__bucket-${bucket}`,
        actionType,
        source: 'synthetic',
        confidenceBucket: bucket,
        prompt: t.prompt,
        expected: {
          voiceRuleIds: t.voiceRuleIds,
          citationKinds: t.citationKinds,
          actionShape: t.actionShape,
        },
      })
    })
  }
  return rows
}

function main(): void {
  const args = new Set(process.argv.slice(2))
  const rows = buildCorpus()
  const jsonl = rows.map((r) => JSON.stringify(r)).join('\n') + '\n'

  if (args.has('--print')) {
    process.stdout.write(jsonl)
    return
  }
  mkdirSync(dirname(OUT_PATH), { recursive: true })
  writeFileSync(OUT_PATH, jsonl, 'utf8')
  console.log(`[build-iris-corpus] wrote ${rows.length} rows to ${OUT_PATH}`)
}

main()
