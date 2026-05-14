/**
 * BRT scale-test Track 1d — provision one demo project per seeded org.
 *
 * The `seed_sample_data(org_id, persona, metadata)` RPC referenced by
 * seed-orgs.ts does not exist on staging. The load profile (run.ts) needs
 * a valid `tok.projectId` for every create/update/delete op, so we hydrate
 * a minimal project per org here.
 *
 * Idempotent: skips orgs that already have a scale_test project. Reads the
 * org fixture NDJSON produced by seed-orgs.ts, augments each line with the
 * project_id, and writes the result to a new NDJSON (default: in-place via
 * --out same path).
 *
 * --- USAGE ---
 *   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... \
 *     npx tsx scripts/scale-test/seed-projects.ts \
 *       --fixture ops/scale-test-fixtures.ndjson \
 *       --out ops/scale-test-fixtures.ndjson
 *
 * Output NDJSON shape adds:
 *   { ..., "projectId": "<uuid>" }
 *
 * Owner: BRT scale-test Track 1d
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';

const { values: args } = parseArgs({
  options: {
    fixture: { type: 'string', short: 'f' },
    out: { type: 'string', short: 'o' },
  },
  allowPositionals: false,
  strict: false,
});

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing required env: SUPABASE_URL and SUPABASE_SERVICE_KEY.');
  process.exit(1);
}

// Default the in/out paths to the runbook convention so this script can run
// with no args after seed-orgs.ts has written its NDJSON fixture.
const FIXTURE_PATH = (args.fixture as string | undefined) ?? 'ops/scale-test-fixtures.ndjson';
const OUT_PATH = (args.out as string | undefined) ?? FIXTURE_PATH;

// Hard-fail blocklist guard (same shape as seed-orgs.ts) — refuses to run
// when SCALE_TEST_PROD_BLOCKLIST is empty OR when the URL host matches an
// entry. Empty blocklist is treated as critical missing input, not permissive.
const BLOCKLIST_RAW = process.env.SCALE_TEST_PROD_BLOCKLIST;
if (!BLOCKLIST_RAW || BLOCKLIST_RAW.trim().length === 0) {
  console.error('[seed-projects] FATAL: SCALE_TEST_PROD_BLOCKLIST is empty. Refusing to run.');
  process.exit(2);
}
const PROD_BLOCKLIST = BLOCKLIST_RAW.split(',').map((s) => s.trim()).filter(Boolean);
const HOST = new URL(SUPABASE_URL).host;
const BLOCKED_HIT = PROD_BLOCKLIST.find((ref) => HOST.includes(ref));
if (BLOCKED_HIT) {
  console.error(
    `[seed-projects] FATAL: SUPABASE_URL host "${HOST}" matches blocklisted ref "${BLOCKED_HIT}". ` +
      'See docs/audits/INCIDENT_2026-05-14_SCALE_TEST_IN_PROD.md.',
  );
  process.exit(2);
}

interface SeededMember {
  email: string;
  userId: string;
  role: string;
}

interface SeededOrg {
  orgId: string;
  ownerEmail: string;
  ownerUserId: string;
  persona: string;
  members: SeededMember[];
  projectId?: string;
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Persona → project_members.role mapping. project_members has a richer role
// vocabulary than organization_members.role (which is owner|admin|member).
// Falling back to 'member' for unknown personas keeps the script safe under
// role-mix changes.
const PERSONA_TO_PROJECT_ROLE: Record<string, string> = {
  pm: 'project_manager',
  super: 'superintendent',
  sub: 'subcontractor',
  architect: 'architect',
  owner: 'owner',
};
function personaToProjectRole(persona: string): string {
  return PERSONA_TO_PROJECT_ROLE[persona] ?? 'member';
}

async function ensureProject(org: SeededOrg): Promise<string> {
  // Look up an existing demo project for this org first (idempotent).
  const { data: existing, error: lookupErr } = await supabase
    .from('projects')
    .select('id')
    .eq('organization_id', org.orgId)
    .eq('is_demo', true)
    .order('created_at', { ascending: true })
    .limit(1);
  if (lookupErr) throw new Error(`lookup failed for org=${org.orgId}: ${lookupErr.message}`);
  if (existing && existing.length > 0) return existing[0].id as string;

  const tagSuffix = org.orgId.slice(0, 8);
  const { data: created, error: insertErr } = await supabase
    .from('projects')
    .insert({
      organization_id: org.orgId,
      owner_id: org.ownerUserId,
      name: `Scale-Test Project ${tagSuffix}`,
      description: 'Synthetic project for scale-test fixture.',
      status: 'active',
      project_phase: 'construction',
      is_demo: true,
      timezone: 'UTC',
    })
    .select('id')
    .single();
  if (insertErr || !created) {
    throw new Error(`insert failed for org=${org.orgId}: ${insertErr?.message ?? 'no row'}`);
  }
  return created.id as string;
}

async function ensureProjectMembers(projectId: string, org: SeededOrg): Promise<number> {
  // RLS on rfis/punch_items/submittals/daily_logs requires project_members
  // membership (not just organization_members). Seed the owner + every
  // fixture member into project_members so all minted tokens can write.
  const { data: existing, error: lookupErr } = await supabase
    .from('project_members')
    .select('user_id')
    .eq('project_id', projectId);
  if (lookupErr) throw new Error(`pm lookup failed proj=${projectId}: ${lookupErr.message}`);
  const present = new Set((existing ?? []).map((r) => r.user_id as string));

  const rows: Array<{ project_id: string; user_id: string; role: string; accepted_at: string }> = [];
  const now = new Date().toISOString();
  if (!present.has(org.ownerUserId)) {
    rows.push({ project_id: projectId, user_id: org.ownerUserId, role: 'owner', accepted_at: now });
  }
  for (const m of org.members) {
    if (present.has(m.userId)) continue;
    rows.push({
      project_id: projectId,
      user_id: m.userId,
      role: personaToProjectRole(m.role),
      accepted_at: now,
    });
  }
  if (rows.length === 0) return 0;

  const { error: insertErr } = await supabase.from('project_members').insert(rows);
  if (insertErr) {
    throw new Error(`project_members insert failed proj=${projectId}: ${insertErr.message}`);
  }
  return rows.length;
}

async function main() {
  const raw = readFileSync(FIXTURE_PATH, 'utf-8');
  const orgs: SeededOrg[] = raw
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => JSON.parse(l) as SeededOrg);

  console.error(`[seed-projects] orgs=${orgs.length} host=${HOST}`);

  const augmented: SeededOrg[] = [];
  let created = 0;
  let reused = 0;
  let membersInserted = 0;
  for (let i = 0; i < orgs.length; i++) {
    const org = orgs[i];
    try {
      const projectId = await ensureProject(org);
      const isNew = !org.projectId || org.projectId !== projectId;
      const inserted = await ensureProjectMembers(projectId, org);
      membersInserted += inserted;
      augmented.push({ ...org, projectId });
      if (isNew) created++;
      else reused++;
      if ((i + 1) % 10 === 0 || i === orgs.length - 1) {
        console.error(
          `[seed-projects] ${i + 1}/${orgs.length} org=${org.orgId} project=${projectId} +pm=${inserted}`,
        );
      }
    } catch (err) {
      console.error(`[seed-projects] org=${org.orgId} failed:`, err);
      augmented.push(org);
    }
  }

  const ndjson = augmented.map((o) => JSON.stringify(o)).join('\n') + '\n';
  writeFileSync(OUT_PATH, ndjson);
  console.error(
    `[seed-projects] done. wrote ${augmented.length} records (created=${created} reused=${reused} project_members_inserted=${membersInserted}) → ${OUT_PATH}`,
  );
}

main().catch((err) => {
  console.error('[seed-projects] fatal:', err);
  process.exit(1);
});
