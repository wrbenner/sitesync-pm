/**
 * BRT scale-test storage sweep — 2026-05-14 incident response.
 *
 * Companion to teardown.ts. Removes every storage.objects row whose path
 * starts with `<org_id>/` for an org that was tagged scale_test=true.
 * The teardown of organizations already happened, so we have to use the
 * incident-doc snapshot of org_ids (or pass --org-ids on the CLI).
 *
 * Buckets swept: drawings, photos, documents (the three the seeder wrote to).
 *
 * --- USAGE ---
 *   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... \
 *     npx tsx scripts/scale-test/teardown-storage.ts \
 *       --org-ids 5a3d3070-13c2-...,58d9c689-...
 *
 *   # or read the list from the seed-orgs NDJSON output that's still on disk:
 *   npx tsx scripts/scale-test/teardown-storage.ts \
 *     --fixture ops/scale-test-fixtures.ndjson
 *
 *   # dry-run:
 *   npx tsx scripts/scale-test/teardown-storage.ts --fixture ... --dry-run
 *
 * Owner: BRT scale-test incident response 2026-05-14
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';

// Hard-fail guard mirrors seed-orgs.ts — refuse to run with empty blocklist
// or against a blocklisted project ref.
{
  const url = process.env.SUPABASE_URL;
  const blocklistRaw = process.env.SCALE_TEST_PROD_BLOCKLIST;
  if (!blocklistRaw || blocklistRaw.trim().length === 0) {
    console.error('[teardown-storage] FATAL: SCALE_TEST_PROD_BLOCKLIST empty. Refusing to run.');
    process.exit(2);
  }
  if (!url || url.trim().length === 0) {
    console.error('[teardown-storage] FATAL: SUPABASE_URL empty. Refusing to run.');
    process.exit(2);
  }
  // NOTE: this sweeper is the ONE script that intentionally CAN run against
  // a project in the blocklist — it exists to clean up after a misfire. The
  // operator must explicitly opt in with --i-know-this-is-blocklisted.
  const host = new URL(url).host;
  const blocked = blocklistRaw.split(',').map((s) => s.trim()).filter(Boolean);
  const hit = blocked.find((ref) => host.includes(ref));
  if (hit && !process.argv.includes('--i-know-this-is-blocklisted')) {
    console.error(
      `[teardown-storage] FATAL: ${host} matches blocklist (${hit}). ` +
        'Pass --i-know-this-is-blocklisted to confirm this is an incident cleanup.',
    );
    process.exit(2);
  }
}

const { values: args } = parseArgs({
  options: {
    'org-ids': { type: 'string' },
    fixture: { type: 'string' },
    'dry-run': { type: 'boolean' },
  },
  allowPositionals: true,
  strict: false,
});

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
if (!SUPABASE_SERVICE_KEY) {
  console.error('[teardown-storage] FATAL: SUPABASE_SERVICE_KEY missing.');
  process.exit(2);
}

const BUCKETS = ['drawings', 'photos', 'documents'];
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function loadOrgIds(): string[] {
  if (args['org-ids']) {
    return (args['org-ids'] as string).split(',').map((s) => s.trim()).filter(Boolean);
  }
  if (args.fixture) {
    const raw = readFileSync(args.fixture as string, 'utf-8');
    const ids = new Set<string>();
    for (const line of raw.split('\n')) {
      const t = line.trim();
      if (!t) continue;
      try {
        const obj = JSON.parse(t) as { orgId?: string };
        if (obj.orgId) ids.add(obj.orgId);
      } catch {
        // ignore malformed lines
      }
    }
    return Array.from(ids);
  }
  console.error('[teardown-storage] FATAL: pass --org-ids or --fixture.');
  process.exit(2);
}

async function sweepBucketForOrg(bucket: string, orgId: string, dryRun: boolean): Promise<number> {
  // List recursively under the org prefix, then remove. Supabase list is
  // single-level; we walk via project folders.
  const { data: projectFolders, error: lsErr } = await supabase.storage
    .from(bucket)
    .list(orgId, { limit: 1000 });
  if (lsErr) {
    console.error(`[teardown-storage] list ${bucket}/${orgId} failed: ${lsErr.message}`);
    return 0;
  }

  let total = 0;
  for (const entry of projectFolders ?? []) {
    // Each entry is a project folder (or sometimes a stray file). For folders
    // (no metadata.size), recurse one level. For files, remove directly.
    if (entry.name && entry.metadata == null) {
      const dir = `${orgId}/${entry.name}`;
      const { data: files, error: fileErr } = await supabase.storage
        .from(bucket)
        .list(dir, { limit: 1000 });
      if (fileErr) {
        console.error(`[teardown-storage] list ${bucket}/${dir} failed: ${fileErr.message}`);
        continue;
      }
      const paths = (files ?? []).map((f) => `${dir}/${f.name}`);
      if (paths.length === 0) continue;
      if (dryRun) {
        total += paths.length;
        console.error(`[teardown-storage] DRY ${bucket}: would remove ${paths.length} (${dir})`);
      } else {
        const { error: rmErr } = await supabase.storage.from(bucket).remove(paths);
        if (rmErr) {
          console.error(`[teardown-storage] remove ${bucket}/${dir} failed: ${rmErr.message}`);
          continue;
        }
        total += paths.length;
      }
    }
  }
  return total;
}

async function main() {
  const orgIds = loadOrgIds();
  const dryRun = Boolean(args['dry-run']);
  console.error(
    `[teardown-storage] orgs=${orgIds.length} buckets=${BUCKETS.join(',')} dry-run=${dryRun}`,
  );

  let removed = 0;
  for (const bucket of BUCKETS) {
    for (const orgId of orgIds) {
      removed += await sweepBucketForOrg(bucket, orgId, dryRun);
    }
  }
  console.error(`[teardown-storage] done. ${dryRun ? 'would_remove' : 'removed'}=${removed}`);
}

main().catch((err) => {
  console.error('[teardown-storage] fatal:', err);
  process.exit(1);
});
