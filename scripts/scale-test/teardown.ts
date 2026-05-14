/**
 * BRT sub-8 §4.4 scale-test teardown.
 *
 * Idempotent service-role script that removes every organization tagged
 * settings.scale_test = true. Sequence:
 *   1. DELETE FROM projects WHERE organization_id IN (scale_test orgs)
 *      — cascades to rfis / daily_logs / punch_items / submittals /
 *        schedule_phases / photos / drawings / etc. via project_id FK.
 *   2. DELETE FROM organizations WHERE settings->>scale_test = true
 *      — cascades to organization_members via organization_id FK.
 *
 * Step 1 is required because projects.organization_id is NO ACTION (not
 * CASCADE), so deleting the org alone would fail while projects remain.
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

// Hard-fail blocklist guard. teardown.ts can mutate at scale (cascade
// deletes); refuse to run against a blocklisted host unless the operator
// explicitly opts in with --i-know-this-is-blocklisted (for incident-cleanup).
const BLOCKLIST_RAW = process.env.SCALE_TEST_PROD_BLOCKLIST;
if (!BLOCKLIST_RAW || BLOCKLIST_RAW.trim().length === 0) {
  console.error('[teardown] FATAL: SCALE_TEST_PROD_BLOCKLIST is empty. Refusing to run.');
  process.exit(2);
}
const PROD_BLOCKLIST = BLOCKLIST_RAW.split(',').map((s) => s.trim()).filter(Boolean);
const HOST = new URL(SUPABASE_URL).host;
const BLOCKED_HIT = PROD_BLOCKLIST.find((ref) => HOST.includes(ref));
if (BLOCKED_HIT && !process.argv.includes('--i-know-this-is-blocklisted')) {
  console.error(
    `[teardown] FATAL: SUPABASE_URL host "${HOST}" matches blocklisted ref "${BLOCKED_HIT}". ` +
      'Pass --i-know-this-is-blocklisted to confirm this is an incident cleanup.',
  );
  process.exit(2);
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

  // Count auth.users tagged scale_test so the dry-run report is accurate.
  // We do this even on dry-run to give the operator the full blast radius.
  const { data: authProbe } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1 });
  void authProbe; // smoke that the admin endpoint works under this service-role key
  const { count: userCountBefore } = await supabase
    .schema('auth' as never)
    .from('users' as never)
    .select('id', { count: 'exact', head: true })
    .filter('raw_user_meta_data->>scale_test', 'eq', 'true');
  console.error(`[teardown] auth.users matching scale_test=true: ${userCountBefore ?? '?'}`);

  if (dryRun) {
    console.error('[teardown] dry-run — no DELETE issued.');
    return;
  }

  if (!before || before === 0) {
    console.error('[teardown] nothing to delete (orgs=0).');
    // Even with no orgs we still purge stray auth.users tagged scale_test
    // (idempotent cleanup if a previous run partially failed).
  }

  // First pull the org IDs in scope so we can chain the project delete on them.
  let orgIdQuery = supabase
    .from('organizations')
    .select('id')
    .eq('settings->>scale_test', 'true');
  if (batchId) {
    orgIdQuery = orgIdQuery.eq('settings->>batch_id', batchId);
  }
  const { data: orgRows, error: orgIdErr } = await orgIdQuery;
  if (orgIdErr) {
    console.error(`[teardown] fetch org ids failed: ${orgIdErr.message}`);
    process.exit(1);
  }
  const orgIds = (orgRows ?? []).map((r) => r.id as string);

  // projects.organization_id is NO ACTION, so we must delete projects first.
  // Each project delete cascades to rfis / daily_logs / punch_items /
  // submittals / schedule_phases / photos / drawings / ... so the actual k6
  // load rows leave with their parent.
  if (orgIds.length > 0) {
    const { error: projErr, count: projCount } = await supabase
      .from('projects')
      .delete({ count: 'exact' })
      .in('organization_id', orgIds);
    if (projErr) {
      console.error(`[teardown] DELETE projects failed: ${projErr.message}`);
      process.exit(1);
    }
    console.error(`[teardown] deleted projects=${projCount ?? '?'} (cascades child rows)`);
  }

  // Now the org delete is unblocked. organization_members cascades on org delete.
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

  // auth.users sweep: the admin API doesn't support filter+bulk-delete, so we
  // page through users tagged scale_test=true and delete them one by one.
  // organization_members cascades on org delete (above) so we don't need to
  // unlink first.
  let userDeleted = 0;
  let page = 1;
  const perPage = 200;
  while (true) {
    const { data: pageData, error: pageErr } = await supabase.auth.admin.listUsers({
      page,
      perPage,
    });
    if (pageErr) {
      console.error(`[teardown] listUsers page=${page} failed: ${pageErr.message}`);
      break;
    }
    const users = pageData?.users ?? [];
    if (users.length === 0) break;

    const targets = users.filter(
      (u) =>
        u.user_metadata?.scale_test === true ||
        (typeof u.email === 'string' && /^scaletest-org-\d+-/i.test(u.email)),
    );
    for (const u of targets) {
      const { error: delUserErr } = await supabase.auth.admin.deleteUser(u.id);
      if (delUserErr) {
        console.error(`[teardown] deleteUser ${u.email} failed: ${delUserErr.message}`);
      } else {
        userDeleted++;
      }
    }

    // listUsers returns the SAME page-1 again after deletes shrink the pool,
    // so stay on page=1 until no targets remain in the current page; only
    // advance if everything on this page was a non-target.
    if (targets.length === 0) {
      if (users.length < perPage) break;
      page++;
    }
  }
  console.error(`[teardown] auth.users deleted=${userDeleted}`);
}

main().catch((err) => {
  console.error('[teardown] fatal:', err);
  process.exit(1);
});
