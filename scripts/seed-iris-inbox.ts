/**
 * seed-iris-inbox.ts
 *
 * Seeds one credible drafted action into `drafted_actions` for the
 * Riverside Commercial Tower demo project. Without this, the first
 * thing a reviewer or demo-watcher sees when they click "Iris Inbox"
 * is empty-state copy. With this, they see the AI-super pitch land:
 * Iris already drafted an RFI, cited the drawing, and is waiting for
 * approval.
 *
 * The drafted action references the same overdue RFI that
 * `supabase/seed/demo-story-arc.sql` plants on the project — so the
 * narrative across the entire demo (overdue RFI → Iris noticed →
 * drafted a follow-up RFI) reads as one coherent story.
 *
 * Idempotent: deletes any existing seeded draft (by deterministic id)
 * before inserting, so re-running always lands you in a clean state.
 *
 * Usage:
 *   SUPABASE_URL=...  SUPABASE_SERVICE_ROLE_KEY=...  npx tsx scripts/seed-iris-inbox.ts
 *
 * Run AFTER `supabase db push` (so the drafted_actions migration has
 * been applied) and AFTER `seed.sql` + `demo-story-arc.sql` (so the
 * Riverside Tower project + overdue RFI exist).
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars')
  process.exit(1)
}

const RIVERSIDE_PROJECT_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const SEED_DRAFT_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaae01'
const RELATED_RFI_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa01' // from demo-story-arc.sql

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main(): Promise<void> {
  // Delete any prior seed so the script is fully idempotent.
  await supabase.from('drafted_actions').delete().eq('id', SEED_DRAFT_ID)

  const { error } = await supabase.from('drafted_actions').insert({
    id: SEED_DRAFT_ID,
    project_id: RIVERSIDE_PROJECT_ID,
    action_type: 'rfi.draft',
    title: 'Iris drafted: follow-up RFI on electrical panel A2 conflict',
    summary:
      "RFI-047 has been ball-in-court with the architect for 3 days. Iris noticed the prior daily log mentions Bright Wire Co. did not show up — the panel-A2 location is now the critical-path constraint. Drafted a polite escalation RFI you can send with one click.",
    payload: {
      title: 'Follow-up: confirm panel A2 location at column line 7',
      description:
        'Following up on RFI-047 (submitted 7 days ago, response due 4 days ago). Drawing E-2 places electrical panel A2 between columns 6 and 7 in the same chase as the chilled-water riser shown on M-4. Bright Wire Co. has not shown up to lay out rough-in pending this answer; the panel rough-in is now on the project critical path.\n\nRequest: please confirm the final panel location by EOD tomorrow so we can release the rough-in to Bright Wire Co. and not lose another day on the schedule.',
      priority: 'high',
      discipline: 'Electrical',
      spec_section: '26 24 16',
      due_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      ball_in_court: 'Architect of Record',
    },
    citations: [
      {
        kind: 'rfi_reference',
        label: 'RFI-047 — Confirm electrical panel A2 location at column line 7',
        ref: RELATED_RFI_ID,
        snippet: 'Drawing E-2 shows panel A2 between columns 6 and 7, but mechanical drawing M-4 shows the chilled-water riser in the same chase.',
      },
      {
        kind: 'daily_log_excerpt',
        label: "Yesterday's daily log",
        snippet: 'Electrical sub (Bright Wire Co.) did not show up — third no-show this week. Foundation rough-in for panel A2 is now the critical-path constraint.',
      },
      {
        kind: 'spec_reference',
        label: 'Spec 26 24 16 — Panelboards',
      },
    ],
    confidence: 0.86,
    status: 'pending',
    drafted_by: 'iris-demo-seed@2026-04-27',
    draft_reason:
      'RFI overdue ball-in-court > 3 days; daily log indicates downstream sub blocked; AI suggests escalation.',
    related_resource_type: 'rfi',
    related_resource_id: RELATED_RFI_ID,
  })

  if (error) {
    console.error('Failed to insert seed drafted action:', error.message)
    process.exit(1)
  }

  console.log(`✓ Seeded Iris Inbox draft (id=${SEED_DRAFT_ID}) for Riverside Tower`)
  console.log('  Open /iris/inbox in the app to see it.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
