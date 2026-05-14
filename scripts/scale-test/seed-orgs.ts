/**
 * BRT sub-8 §4.4 scale-test fixture seeder (per-VU auth edition).
 *
 * Seeds N synthetic orgs. For each org:
 *   1. Creates a confirmed auth.users row for the owner via admin.createUser
 *      (deterministic email `scaletest-org-NN-owner@sitesync.test`, shared
 *      password from SCALE_TEST_PASSWORD env, fall-back `scaletest-pw-2026`).
 *   2. Calls `provision_organization(name, slug, owner, settings)` so the
 *      org row + organization_members(owner) + audit log all land atomically.
 *   3. Calls `seed_sample_data(org_id, persona, metadata)` for the demo
 *      fixtures (RFIs, daily logs, punch items). Soft-fails — non-fatal.
 *   4. If --members-per-org N is set, mints N-1 extra auth users with a
 *      role mix (default {pm:1, super:2, sub:5, architect:1}) and calls
 *      `bulk_add_team_members(org_id, members)` to attach them.
 *
 * Every row written is tagged with:
 *   - is_demo = true
 *   - settings / metadata containing { scale_test: true, batch_id: <uuid> }
 *
 * --- USAGE ---
 *   SUPABASE_URL=https://<project>.supabase.co \
 *   SUPABASE_SERVICE_KEY=<service-role-key> \
 *   SCALE_TEST_PASSWORD=<shared-pw> \
 *   npx tsx scripts/scale-test/seed-orgs.ts --count 50 --members-per-org 10
 *
 * Output: JSON to stdout, one object per line (NDJSON), e.g.
 *   {"orgId":"<uuid>","ownerEmail":"scaletest-org-01-owner@sitesync.test",
 *    "ownerUserId":"<uuid>",
 *    "members":[{"email":"...","userId":"...","role":"pm"}, ...]}
 *
 * Consumed by `scripts/scale-test/run.ts` setup() which sends NDJSON via
 * SCALE_TEST_FIXTURE_JSON (path to file, since k6 can't read stdin directly).
 *
 * --- TEARDOWN ---
 *   npx tsx scripts/scale-test/teardown.ts                # removes ALL scale_test orgs
 *   npx tsx scripts/scale-test/teardown.ts --batch <uuid> # removes a single batch
 *
 * Owner: BRT Track C / sub-8 §4.4 + Track 1c
 */

import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { parseArgs } from 'node:util';
import { writeFileSync } from 'node:fs';

const { values: args } = parseArgs({
  options: {
    count: { type: 'string', short: 'n' },
    'members-per-org': { type: 'string' },
    'role-mix': { type: 'string' }, // JSON, e.g. '{"pm":1,"super":2,"sub":5,"architect":1}'
    out: { type: 'string', short: 'o' }, // optional file path; default stdout
  },
  allowPositionals: false,
  strict: false,
});

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const TARGET_ORG_COUNT = Number(args.count ?? process.env.TARGET_ORG_COUNT ?? '50');
const MEMBERS_PER_ORG = Number(args['members-per-org'] ?? process.env.MEMBERS_PER_ORG ?? '1');
const SHARED_PASSWORD = process.env.SCALE_TEST_PASSWORD ?? 'scaletest-pw-2026';

const DEFAULT_ROLE_MIX: Record<string, number> = { pm: 1, super: 2, sub: 5, architect: 1 };
const ROLE_MIX: Record<string, number> = args['role-mix']
  ? (JSON.parse(args['role-mix'] as string) as Record<string, number>)
  : DEFAULT_ROLE_MIX;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing required env: SUPABASE_URL and SUPABASE_SERVICE_KEY must both be set.');
  process.exit(1);
}

if (!Number.isFinite(TARGET_ORG_COUNT) || TARGET_ORG_COUNT <= 0) {
  console.error(`Invalid --count value: ${args.count ?? process.env.TARGET_ORG_COUNT}.`);
  process.exit(1);
}

if (!Number.isFinite(MEMBERS_PER_ORG) || MEMBERS_PER_ORG <= 0) {
  console.error(`Invalid --members-per-org value: ${args['members-per-org']}.`);
  process.exit(1);
}

// Hard guard: refuse to run against the production project ref. The seeder
// tags rows with scale_test=true so teardown can sweep them, but a misconfigured
// SUPABASE_URL is still a real risk. Allowlist staging / local hostnames only.
const PROD_PROJECT_REF_BLOCKLIST = (process.env.SCALE_TEST_PROD_BLOCKLIST ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const HOST = new URL(SUPABASE_URL).host;
if (PROD_PROJECT_REF_BLOCKLIST.some((ref) => HOST.includes(ref))) {
  console.error(`[seed-orgs] FATAL: SUPABASE_URL host "${HOST}" matches PROD blocklist. Aborting.`);
  process.exit(2);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const BATCH_ID = randomUUID();

const ROLE_PERSONAS = ['pm', 'super', 'sub', 'owner'] as const;
type Persona = (typeof ROLE_PERSONAS)[number];

interface SeededMember {
  email: string;
  userId: string;
  role: string;
}

interface SeededOrg {
  orgId: string;
  ownerEmail: string;
  ownerUserId: string;
  persona: Persona;
  members: SeededMember[];
}

async function createAuthUser(email: string): Promise<string> {
  // admin.createUser is idempotent-ish: it throws on duplicate email. Catch
  // that and look up the existing row so re-runs are stable.
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: SHARED_PASSWORD,
    email_confirm: true,
    user_metadata: { scale_test: true, batch_id: BATCH_ID },
  });
  if (error) {
    const dup = /already.*registered|exists/i.test(error.message);
    if (!dup) throw error;
    const { data: list, error: listErr } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    if (listErr) throw listErr;
    const existing = list.users.find((u) => u.email === email);
    if (!existing) throw new Error(`createUser dup but no listUsers match for ${email}`);
    return existing.id;
  }
  if (!data.user) throw new Error(`createUser returned no user for ${email}`);
  return data.user.id;
}

function buildMemberRoles(): string[] {
  const roles: string[] = [];
  for (const [role, count] of Object.entries(ROLE_MIX)) {
    for (let i = 0; i < count; i++) roles.push(role);
  }
  // Pad or truncate to MEMBERS_PER_ORG - 1 (owner counts as the 1st slot).
  const need = Math.max(0, MEMBERS_PER_ORG - 1);
  while (roles.length < need) roles.push('pm');
  return roles.slice(0, need);
}

async function provisionOne(index: number): Promise<SeededOrg> {
  const persona: Persona = ROLE_PERSONAS[index % ROLE_PERSONAS.length];
  const tag = String(index + 1).padStart(3, '0');
  const ownerEmail = `scaletest-org-${tag}-owner@sitesync.test`;
  const orgName = `Scale-Test Org ${tag} (${persona})`;
  const slugHint = `scale-test-${BATCH_ID.slice(0, 8)}-${tag}`;

  const ownerUserId = await createAuthUser(ownerEmail);

  // provision_organization(p_name text, p_slug text, p_owner uuid, p_metadata jsonb)
  const { data: orgId, error: provErr } = await supabase.rpc('provision_organization', {
    p_name: orgName,
    p_slug: slugHint,
    p_owner: ownerUserId,
    p_metadata: {
      scale_test: true,
      batch_id: BATCH_ID,
      persona,
      created_by: 'scripts/scale-test/seed-orgs.ts',
    },
  });
  if (provErr || typeof orgId !== 'string') {
    throw new Error(
      `provision_organization failed for index ${index}: ${provErr?.message ?? 'no org id'}`,
    );
  }

  // Soft-call seed_sample_data — non-fatal so a missing fn doesn't kill the run.
  const { error: seedErr } = await supabase.rpc('seed_sample_data', {
    p_organization_id: orgId,
    p_persona: persona,
    p_metadata: { scale_test: true, batch_id: BATCH_ID },
  });
  if (seedErr) {
    console.error(`[seed-orgs] seed_sample_data soft-fail org=${orgId}: ${seedErr.message}`);
  }

  // Team diversity: extra members beyond owner.
  const memberRoles = buildMemberRoles();
  const members: SeededMember[] = [];
  if (memberRoles.length > 0) {
    const memberPayload: Array<{ user_id: string; role: string }> = [];
    for (let i = 0; i < memberRoles.length; i++) {
      const role = memberRoles[i];
      const email = `scaletest-org-${tag}-${role}-${String(i + 1).padStart(2, '0')}@sitesync.test`;
      const userId = await createAuthUser(email);
      members.push({ email, userId, role });
      memberPayload.push({ user_id: userId, role });
    }
    const { error: bulkErr } = await supabase.rpc('bulk_add_team_members', {
      p_org_id: orgId,
      p_members: memberPayload,
    });
    if (bulkErr) {
      console.error(`[seed-orgs] bulk_add_team_members soft-fail org=${orgId}: ${bulkErr.message}`);
    }
  }

  return { orgId, ownerEmail, ownerUserId, persona, members };
}

async function main() {
  console.error(
    `[seed-orgs] batch=${BATCH_ID} orgs=${TARGET_ORG_COUNT} members/org=${MEMBERS_PER_ORG} host=${HOST}`,
  );

  const results: SeededOrg[] = [];

  for (let i = 0; i < TARGET_ORG_COUNT; i++) {
    try {
      const row = await provisionOne(i);
      results.push(row);
      console.error(
        `[seed-orgs] ${i + 1}/${TARGET_ORG_COUNT} org=${row.orgId} members=${row.members.length}`,
      );
    } catch (err) {
      console.error(`[seed-orgs] index ${i} failed:`, err);
    }
  }

  console.error(
    `[seed-orgs] done. provisioned=${results.length}/${TARGET_ORG_COUNT} batch=${BATCH_ID}`,
  );

  const ndjson = results.map((r) => JSON.stringify(r)).join('\n') + '\n';
  if (args.out) {
    writeFileSync(args.out as string, ndjson);
    console.error(`[seed-orgs] wrote ${results.length} records to ${args.out}`);
    // Also emit org-id CSV to stdout for legacy callers piping into TEST_ORG_IDS.
    process.stdout.write(results.map((r) => r.orgId).join(','));
    process.stdout.write('\n');
  } else {
    process.stdout.write(ndjson);
  }
}

main().catch((err) => {
  console.error('[seed-orgs] fatal:', err);
  process.exit(1);
});
