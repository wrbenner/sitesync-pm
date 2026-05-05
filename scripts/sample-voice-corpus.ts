/**
 * sample-voice-corpus.ts — Day 43 sampling script.
 *
 * Pulls 50 (or N) drafted_actions from the dev environment, biased to
 * even distribution across action_type and across confidence buckets,
 * and writes them as JSONL to docs/audits/voice-corpus/sample-<date>.jsonl
 * for the hand-edit cycle.
 *
 * The output file is gitignored except for `voice-corpus/README.md`
 * (corpus structure docs). Walker hand-edits each entry, captures
 * rationales, then commits the *style.ts* rules — never the corpus
 * itself, which contains real-ish draft text.
 *
 * Usage:
 *   SUPABASE_URL=...  SUPABASE_SERVICE_ROLE_KEY=...  \
 *     npx tsx scripts/sample-voice-corpus.ts \
 *     --count=50 --out=docs/audits/voice-corpus/sample-2026-06-15.jsonl
 *
 * Distribution (per spec § Phase 1):
 *   Even across 6 action_types (≈ N / 6 each)
 *   Even across 5 confidence buckets (0.7-.75, .75-.8, .8-.85, .85-.9, .9+)
 *   Even across 5 detector kinds (cascade/aging/variance/staffing/weather)
 *
 * When the source pool is too small to fill every bucket evenly the
 * script prints which buckets are short — an honest signal that the
 * dev environment hasn't accumulated enough variety yet.
 */

import { createClient } from '@supabase/supabase-js'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars')
  process.exit(2)
}

const args = new Map<string, string>()
for (const a of process.argv.slice(2)) {
  if (a.startsWith('--')) {
    const eq = a.indexOf('=')
    args.set(eq < 0 ? a.slice(2) : a.slice(2, eq), eq < 0 ? '' : a.slice(eq + 1))
  }
}
const targetCount = Number(args.get('count') ?? '50')
const outPath = args.get('out') ?? `docs/audits/voice-corpus/sample-${new Date().toISOString().slice(0, 10)}.jsonl`

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const ACTION_TYPES = [
  'rfi.draft',
  'daily_log.draft',
  'pay_app.draft',
  'punch_item.draft',
  'schedule.resequence',
  'submittal.transmittal_draft',
] as const

const CONFIDENCE_BUCKETS = [
  [0.7, 0.75],
  [0.75, 0.8],
  [0.8, 0.85],
  [0.85, 0.9],
  [0.9, 1.01],
] as const

interface DraftRow {
  id: string
  project_id: string
  action_type: string
  title: string
  summary: string | null
  payload: Record<string, unknown> | null
  citations: unknown
  confidence: number
  drafted_by: string
  status: string
  created_at: string
}

async function main(): Promise<void> {
  // Pull a wide net — we'll sample down with stratification client-side.
  const { data, error } = await supabase
    .from('drafted_actions')
    .select(
      'id, project_id, action_type, title, summary, payload, citations, confidence, drafted_by, status, created_at',
    )
    .gte('confidence', 0.7)
    .order('created_at', { ascending: false })
    .limit(2000)
  if (error) throw new Error(`drafted_actions query: ${error.message}`)

  const pool = (data ?? []) as DraftRow[]
  if (pool.length === 0) {
    console.error('Pool is empty. Run the scheduled-insights worker against dev seed first.')
    process.exit(1)
  }

  // Bucket by (action_type, confidence_bucket_index).
  const buckets = new Map<string, DraftRow[]>()
  for (const d of pool) {
    const bucketIdx = CONFIDENCE_BUCKETS.findIndex(
      ([lo, hi]) => d.confidence >= lo && d.confidence < hi,
    )
    if (bucketIdx < 0) continue
    const key = `${d.action_type}:${bucketIdx}`
    const list = buckets.get(key) ?? []
    list.push(d)
    buckets.set(key, list)
  }

  // Stratified sample: targetCount / (6 × 5) = ~1-2 per bucket, plus
  // a leftover round-robin fill.
  const perBucket = Math.max(1, Math.floor(targetCount / (ACTION_TYPES.length * CONFIDENCE_BUCKETS.length)))
  const sampled: DraftRow[] = []
  const shortBuckets: string[] = []

  for (const at of ACTION_TYPES) {
    for (let b = 0; b < CONFIDENCE_BUCKETS.length; b++) {
      const key = `${at}:${b}`
      const list = (buckets.get(key) ?? []).slice()
      shuffle(list)
      const take = list.slice(0, perBucket)
      if (take.length < perBucket) shortBuckets.push(`${key} (${take.length}/${perBucket})`)
      sampled.push(...take)
    }
  }

  // Round-robin fill from non-empty buckets up to targetCount.
  while (sampled.length < targetCount) {
    let added = false
    for (const [key, list] of buckets) {
      const used = new Set(sampled.filter((s) => `${s.action_type}:${bucketIndex(s.confidence)}` === key).map((s) => s.id))
      const candidate = list.find((d) => !used.has(d.id))
      if (candidate) {
        sampled.push(candidate)
        added = true
      }
      if (sampled.length >= targetCount) break
    }
    if (!added) break
  }

  // Write JSONL.
  mkdirSync(dirname(outPath), { recursive: true })
  const lines = sampled.map((d) => JSON.stringify(d))
  writeFileSync(outPath, lines.join('\n') + '\n', 'utf8')

  console.log(`Sampled ${sampled.length} of ${targetCount} drafts → ${outPath}`)
  if (shortBuckets.length > 0) {
    console.log(`\nUnder-filled buckets (corpus has gaps — note for the receipt):`)
    for (const b of shortBuckets) console.log('  - ' + b)
  }
}

function bucketIndex(confidence: number): number {
  return CONFIDENCE_BUCKETS.findIndex(([lo, hi]) => confidence >= lo && confidence < hi)
}

function shuffle<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
}

main().catch((err) => {
  console.error('sample-voice-corpus failed:', err.message ?? err)
  process.exit(2)
})
