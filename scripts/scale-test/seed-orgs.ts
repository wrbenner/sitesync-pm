/**
 * BRT sub-8 §4.4 scale-test fixture seeder.
 *
 * Seeds N synthetic orgs via the `provision_organization()` RPC, then
 * populates each with sample data via `seed_sample_data()` to exercise
 * the full range of role-shaped sample datasets.
 *
 * Every row written is tagged with:
 *   - is_demo = true
 *   - settings / metadata containing { scale_test: true, batch_id: <uuid> }
 *
 * --- USAGE ---
 *   SUPABASE_URL=https://<project>.supabase.co \
 *   SUPABASE_SERVICE_KEY=<service-role-key> \
 *   npx tsx scripts/scale-test/seed-orgs.ts --count 500
 *
 * Output: CSV of org UUIDs printed to stdout, e.g.
 *   uuid1,uuid2,...,uuidN
 *
 * Pipe directly into the k6 runner (small/coarse load only — see KNOWN GAP):
 *   TEST_ORG_IDS=$(SUPABASE_URL=... SUPABASE_SERVICE_KEY=... \
 *     npx tsx scripts/scale-test/seed-orgs.ts --count 500) \
 *   k6 run -e SUPABASE_URL=... -e SUPABASE_ANON_KEY=... \
 *          -e TEST_ORG_IDS=$TEST_ORG_IDS scripts/scale-test/run.ts
 *
 * --- KNOWN GAP (don't ship without reading) ---
 * This seeder uses the SERVICE_ROLE key and does NOT create per-org auth.users.
 * That means k6 (which uses the ANON key in its current form) hits RLS-denied
 * paths for every read/write — it measures "permission denied throughput,"
 * not real feature throughput. The primary battle-test harness is the
 * Playwright persona suite (docs/runbooks/BATTLE_TEST_RUNBOOK.md), which signs
 * in as real users. Use k6 only for coarse infra-level smoke (latency floor,
 * timeout/threshold tripping, edge fn cold-starts) until run.ts is reworked to
 * sign in per VU.
 *
 * --- TEARDOWN ---
 *   npx tsx scripts/scale-test/teardown.ts                # removes ALL scale_test orgs
 *   npx tsx scripts/scale-test/teardown.ts --batch <uuid> # removes a single batch
 *
 * Or by hand:
 *   DELETE FROM organizations WHERE settings->>'scale_test' = 'true';
 *
 * The ON DELETE CASCADE chain on organizations.id sweeps every child table.
 *
 * Owner: BRT Track C / sub-8 §4.4
 */

import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { parseArgs } from 'node:util';

const { values: args } = parseArgs({
  options: {
    count: { type: 'string', short: 'n' },
  },
  allowPositionals: false,
  strict: false,
});

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const TARGET_ORG_COUNT = Number(
  args.count ?? process.env.TARGET_ORG_COUNT ?? '50',
);

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error(
    'Missing required env: SUPABASE_URL and SUPABASE_SERVICE_KEY must both be set.',
  );
  process.exit(1);
}

if (!Number.isFinite(TARGET_ORG_COUNT) || TARGET_ORG_COUNT <= 0) {
  console.error(
    `Invalid --count value: ${args.count ?? process.env.TARGET_ORG_COUNT}. Must be a positive integer.`,
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const BATCH_ID = randomUUID();

// Rotate through a small fleet of role personas so seed_sample_data() generates
// data that exercises different RLS code paths.
const ROLE_PERSONAS: Array<'pm' | 'super' | 'sub' | 'owner'> = [
  'pm',
  'super',
  'sub',
  'owner',
];

interface ProvisionResult {
  organization_id: string;
}

async function provisionOrg(index: number): Promise<string> {
  const persona = ROLE_PERSONAS[index % ROLE_PERSONAS.length];
  const orgName = `Scale-Test Org ${String(index + 1).padStart(2, '0')} (${persona})`;

  const { data, error } = await supabase.rpc('provision_organization', {
    p_name: orgName,
    p_is_demo: true,
    p_settings: {
      scale_test: true,
      batch_id: BATCH_ID,
      persona,
      created_by: 'scripts/scale-test/seed-orgs.ts',
    },
  });

  if (error) {
    throw new Error(
      `provision_organization failed for index ${index}: ${error.message}`,
    );
  }

  // RPC may return either a scalar uuid or a row { organization_id }.
  const orgId =
    typeof data === 'string'
      ? data
      : (data as ProvisionResult | null)?.organization_id;

  if (!orgId) {
    throw new Error(
      `provision_organization returned no org id for index ${index}`,
    );
  }

  const { error: seedErr } = await supabase.rpc('seed_sample_data', {
    p_organization_id: orgId,
    p_persona: persona,
    p_metadata: { scale_test: true, batch_id: BATCH_ID },
  });

  if (seedErr) {
    // Soft-fail: we still want the org id even if sample seed fails, so the
    // load test has something to talk to. Log to stderr.
    console.error(
      `seed_sample_data soft-failed for org ${orgId}: ${seedErr.message}`,
    );
  }

  return orgId;
}

async function main() {
  console.error(
    `[seed-orgs] batch_id=${BATCH_ID} target=${TARGET_ORG_COUNT}`,
  );

  const orgIds: string[] = [];

  // Sequential — avoid hammering provision_organization in parallel; the
  // function does auth.users inserts that can deadlock under concurrency.
  for (let i = 0; i < TARGET_ORG_COUNT; i++) {
    try {
      const id = await provisionOrg(i);
      orgIds.push(id);
      console.error(
        `[seed-orgs] ${i + 1}/${TARGET_ORG_COUNT} provisioned ${id}`,
      );
    } catch (err) {
      console.error(`[seed-orgs] index ${i} failed:`, err);
    }
  }

  console.error(
    `[seed-orgs] done. provisioned=${orgIds.length}/${TARGET_ORG_COUNT}`,
  );
  console.error(
    `[seed-orgs] teardown SQL: DELETE FROM organizations WHERE settings->>'batch_id' = '${BATCH_ID}';`,
  );

  // CSV to stdout — caller pipes this into TEST_ORG_IDS.
  process.stdout.write(orgIds.join(','));
  process.stdout.write('\n');
}

main().catch((err) => {
  console.error('[seed-orgs] fatal:', err);
  process.exit(1);
});
