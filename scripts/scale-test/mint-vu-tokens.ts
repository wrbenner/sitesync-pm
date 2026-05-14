/**
 * BRT scale-test Track 1b — mint a JWT pool for k6.
 *
 * k6's setup() runs in-process and can't easily POST to Supabase's auth
 * endpoint without persistence (cookies, refresh-token loops). So instead
 * we mint the tokens up-front in Node using the anon key + the seeded
 * fixture credentials, then hand k6 a flat JSON file it can SharedArray-load.
 *
 * --- USAGE ---
 *   SUPABASE_URL=https://<project>.supabase.co \
 *   SUPABASE_ANON_KEY=<anon> \
 *   SCALE_TEST_PASSWORD=<shared-pw> \
 *   npx tsx scripts/scale-test/mint-vu-tokens.ts \
 *     --fixture /tmp/scale-fixture.ndjson \
 *     --out /tmp/scale-vu-tokens.json
 *
 * Reads NDJSON from seed-orgs.ts (one `SeededOrg` per line). For each org
 * AND each non-owner member, attempts a password sign-in and captures the
 * access_token. Output JSON shape:
 *   {
 *     "mintedAt": "<iso>",
 *     "tokens": [
 *       { "jwt": "<access_token>", "orgId": "<uuid>", "email": "<email>",
 *         "role": "owner" | "pm" | "super" | "sub" | "architect",
 *         "expiresAt": <epoch-ms> }
 *     ]
 *   }
 *
 * NOTE: Supabase JWTs default to 1h expiry. The smoke profile (37 min) fits
 * within one mint. The heavy profile (~2h 8m) does NOT — call this script
 * again mid-run, or extend JWT expiry to 3h in the project's auth config
 * before kicking off the heavy run. The runbook documents the procedure.
 *
 * Owner: BRT Track C / sub-8 §4.4 + Track 1b
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';

const { values: args } = parseArgs({
  options: {
    fixture: { type: 'string', short: 'f' },
    out: { type: 'string', short: 'o' },
    'owner-only': { type: 'boolean' }, // legacy spelling (singular)
    'owners-only': { type: 'boolean' }, // canonical spelling (plural) — runbook form
    'rate-ms': { type: 'string' }, // delay between mints in ms (default 250)
    throttle: { type: 'string' }, // req/sec — alias for rate-ms (throttle=5 → rate-ms=200)
    ndjson: { type: 'boolean' }, // emit NDJSON shape per token instead of the JSON object
  },
  allowPositionals: true,
  strict: false,
});

// Default fixture/out paths so the runbook command works with no flags.
const FIXTURE_PATH = (args.fixture as string | undefined) ?? 'ops/scale-test-fixtures.ndjson';
const OUT_PATH = (args.out as string | undefined) ?? 'ops/scale-test-vu-tokens.ndjson';
// If the operator passed --throttle (req/sec), translate to rate-ms; explicit
// --rate-ms wins if both are set.
const THROTTLE_PER_SEC = args.throttle ? Number(args.throttle) : undefined;
const RATE_MS = args['rate-ms']
  ? Number(args['rate-ms'])
  : THROTTLE_PER_SEC && THROTTLE_PER_SEC > 0
    ? Math.round(1000 / THROTTLE_PER_SEC)
    : 250;
const OWNERS_ONLY = Boolean(args['owners-only'] || args['owner-only']);
// Default output mode: NDJSON when the path ends in .ndjson or --ndjson is set.
const EMIT_NDJSON = Boolean(args.ndjson) || OUT_PATH.endsWith('.ndjson');
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SHARED_PASSWORD = process.env.SCALE_TEST_PASSWORD ?? 'scaletest-pw-2026';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Missing required env: SUPABASE_URL and SUPABASE_ANON_KEY.');
  process.exit(1);
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

interface MintedToken {
  jwt: string;
  orgId: string;
  projectId?: string;
  email: string;
  role: string;
  expiresAt: number;
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function mintFor(
  email: string,
  orgId: string,
  role: string,
  projectId?: string,
): Promise<MintedToken | null> {
  // Retry on rate-limit with exponential backoff so a 60s per-IP cap
  // doesn't strand half the pool. Five attempts: 2s, 4s, 8s, 16s, 32s (62s total).
  let backoff = 2000;
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: SHARED_PASSWORD,
    });
    if (!error && data.session) {
      return {
        jwt: data.session.access_token,
        orgId,
        projectId,
        email,
        role,
        expiresAt: data.session.expires_at ? data.session.expires_at * 1000 : Date.now() + 3600_000,
      };
    }
    const rateLimited = error && /rate limit|too many/i.test(error.message);
    if (!rateLimited) {
      console.error(`[mint] ${email} sign-in failed: ${error?.message ?? 'no session'}`);
      return null;
    }
    console.error(`[mint] ${email} rate-limited, backoff ${backoff}ms (attempt ${attempt + 1}/5)`);
    await sleep(backoff);
    backoff *= 2;
  }
  console.error(`[mint] ${email} gave up after 5 rate-limit retries`);
  return null;
}

async function main() {
  const raw = readFileSync(FIXTURE_PATH, 'utf-8');
  const orgs: SeededOrg[] = raw
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => JSON.parse(l) as SeededOrg);

  console.error(
    `[mint] loaded ${orgs.length} orgs from ${FIXTURE_PATH} owners-only=${OWNERS_ONLY} rate-ms=${RATE_MS} ndjson=${EMIT_NDJSON}`,
  );

  const tokens: MintedToken[] = [];

  for (const org of orgs) {
    const ownerTok = await mintFor(org.ownerEmail, org.orgId, 'owner', org.projectId);
    if (ownerTok) {
      // Embed the actual auth.users id on each token so the NDJSON shape can
      // surface `userId` for k6's per-VU lookups without an extra round-trip.
      (ownerTok as MintedToken & { userId?: string }).userId = org.ownerUserId;
      tokens.push(ownerTok);
    }
    if (RATE_MS > 0) await sleep(RATE_MS);

    if (!OWNERS_ONLY) {
      for (const m of org.members) {
        const t = await mintFor(m.email, org.orgId, m.role, org.projectId);
        if (t) {
          (t as MintedToken & { userId?: string }).userId = m.userId;
          tokens.push(t);
        }
        if (RATE_MS > 0) await sleep(RATE_MS);
      }
    }
  }

  if (EMIT_NDJSON) {
    // Runbook-shape NDJSON: {userId, orgId, projectId, accessToken, role}
    const lines = tokens
      .map((t) =>
        JSON.stringify({
          userId: (t as MintedToken & { userId?: string }).userId ?? null,
          orgId: t.orgId,
          projectId: t.projectId ?? null,
          accessToken: t.jwt,
          role: t.role,
          email: t.email,
          expiresAt: t.expiresAt,
        }),
      )
      .join('\n') + (tokens.length > 0 ? '\n' : '');
    writeFileSync(OUT_PATH, lines);
  } else {
    writeFileSync(
      OUT_PATH,
      JSON.stringify({ mintedAt: new Date().toISOString(), tokens }, null, 2),
    );
  }
  console.error(`[mint] wrote ${tokens.length} tokens to ${OUT_PATH}`);
  if (tokens.length === 0) {
    console.error('[mint] FATAL: zero tokens minted. Check fixture + password.');
    process.exit(3);
  }
}

main().catch((err) => {
  console.error('[mint] fatal:', err);
  process.exit(1);
});
