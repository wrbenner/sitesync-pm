/**
 * BRT sub-8 §4.4 scale-test fixture seeder.
 *
 * Seeds 50 synthetic orgs via the `provision_organization()` RPC, then
 * populates each with sample data via `seed_sample_data()` to exercise
 * the full range of roles (PM, super, sub, owner).
 *
 * Every row written is tagged with:
 *   - is_demo = true
 *   - settings / metadata containing { scale_test: true, batch_id: <uuid> }
 *
 * --- USAGE ---
 *   SUPABASE_URL=https://<staging>.supabase.co \
 *   SUPABASE_SERVICE_KEY=<service-role-key> \
 *   npx tsx scripts/scale-test/seed-orgs.ts
 *
 * Output: CSV of org UUIDs printed to stdout, e.g.
 *   uuid1,uuid2,...,uuid50
 *
 * Pipe directly into the k6 runner:
 *   TEST_ORG_IDS=$(SUPABASE_URL=... SUPABASE_SERVICE_KEY=... \
 *     npx tsx scripts/scale-test/seed-orgs.ts) \
 *   k6 run -e SUPABASE_URL=... -e SUPABASE_ANON_KEY=... \
 *          -e TEST_ORG_IDS=$TEST_ORG_IDS scripts/scale-test/run.ts
 *
 * --- TEARDOWN ---
 * One-shot SQL to remove every artifact from this run:
 *   DELETE FROM organizations WHERE settings->>'scale_test' = 'true';
 *
 * The ON DELETE CASCADE chain on organizations.id will sweep:
 *   projects, rfis, daily_logs, schedule_tasks, photos, drawings,
 *   conversations, audit_log, org_members, invitations, etc.
 *
 * If you only want to remove a single batch:
 *   DELETE FROM organizations
 *   WHERE settings->>'scale_test' = 'true'
 *     AND settings->>'batch_id' = '<batch_uuid>';
 *
 * Owner: BRT Track C / sub-8 §4.4
 */

import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const TARGET_ORG_COUNT = Number(process.env.TARGET_ORG_COUNT ?? '50');

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error(
    'Missing required env: SUPABASE_URL and SUPABASE_SERVICE_KEY must both be set.',
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
