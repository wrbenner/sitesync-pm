/**
 * BRT sub-8 §4.4 scale-test teardown.
 *
 * Idempotent service-role script that removes every organization tagged
 * settings.scale_test = true. The ON DELETE CASCADE chain on
 * organizations.id sweeps every child row (projects, rfis, daily_logs,
 * photos, drawings, schedule, conversations, audit_log, members, invites…).
 *
 * --- USAGE ---
 *   # Remove EVERY scale_test org across all prior batches:
 *   SUPABASE_URL=https://<project>.supabase.co \
 *   SUPABASE_SERVICE_KEY=<service-role-key> \
 *   npx tsx scripts/scale-test/teardown.ts
 *
 *   # Remove a single seed batch:
 *   npx tsx scripts/scale-test/teardown.ts --batch <batch_uuid>
 *
 *   # Dry-run (count only, no DELETE):
 *   npx tsx scripts/scale-test/teardown.ts --dry-run
 *
 * Owner: BRT Track C / sub-8 §4.4
 */

import { createClient } from '@supabase/supabase-js';
import { parseArgs } from 'node:util';

const { values: args } = parseArgs({
  options: {
    batch: { type: 'string', short: 'b' },
    'dry-run': { type: 'boolean' },
  },
  allowPositionals: false,
  strict: false,
});

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error(
    'Missing required env: SUPABASE_URL and SUPABASE_SERVICE_KEY must both be set.',
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const batchId = args.batch;
const dryRun = Boolean(args['dry-run']);

async function main() {
  const scope = batchId ? `batch_id=${batchId}` : 'all scale_test orgs';
  console.error(`[teardown] scope=${scope} dry-run=${dryRun}`);

  // Count before.
  let countQuery = supabase
    .from('organizations')
    .select('id', { count: 'exact', head: true })
    .eq('settings->>scale_test', 'true');
  if (batchId) {
    countQuery = countQuery.eq('settings->>batch_id', batchId);
  }

  const { count: before, error: countErr } = await countQuery;
  if (countErr) {
    console.error(`[teardown] count failed: ${countErr.message}`);
    process.exit(1);
  }

  console.error(`[teardown] orgs matching scope: ${before ?? 0}`);

  if (dryRun) {
    console.error('[teardown] dry-run — no DELETE issued.');
    return;
  }

  if (!before || before === 0) {
    console.error('[teardown] nothing to delete.');
    return;
  }

  // DELETE. RLS is bypassed by the service-role key.
  let delQuery = supabase
    .from('organizations')
    .delete()
    .eq('settings->>scale_test', 'true');
  if (batchId) {
    delQuery = delQuery.eq('settings->>batch_id', batchId);
  }

  const { error: delErr } = await delQuery;
  if (delErr) {
    console.error(`[teardown] DELETE failed: ${delErr.message}`);
    process.exit(1);
  }

  // Count after — should be zero.
  let afterQuery = supabase
    .from('organizations')
    .select('id', { count: 'exact', head: true })
    .eq('settings->>scale_test', 'true');
  if (batchId) {
    afterQuery = afterQuery.eq('settings->>batch_id', batchId);
  }
  const { count: after } = await afterQuery;

  console.error(`[teardown] before=${before} after=${after ?? '?'} (expect 0)`);

  if ((after ?? 0) > 0) {
    console.error('[teardown] WARNING — orgs still match scope after delete.');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('[teardown] fatal:', err);
  process.exit(1);
});
