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
    'owner-only': { type: 'boolean' }, // skip non-owner members; useful for read-mostly smoke
  },
  allowPositionals: false,
  strict: false,
});

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SHARED_PASSWORD = process.env.SCALE_TEST_PASSWORD ?? 'scaletest-pw-2026';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Missing required env: SUPABASE_URL and SUPABASE_ANON_KEY.');
  process.exit(1);
}
if (!args.fixture || !args.out) {
  console.error('Missing required flags: --fixture <ndjson> --out <json>');
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
}

interface MintedToken {
  jwt: string;
  orgId: string;
  email: string;
  role: string;
  expiresAt: number;
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function mintFor(email: string, orgId: string, role: string): Promise<MintedToken | null> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: SHARED_PASSWORD,
  });
  if (error || !data.session) {
    console.error(`[mint] ${email} sign-in failed: ${error?.message ?? 'no session'}`);
    return null;
  }
  return {
    jwt: data.session.access_token,
    orgId,
    email,
    role,
    expiresAt: data.session.expires_at ? data.session.expires_at * 1000 : Date.now() + 3600_000,
  };
}

async function main() {
  const raw = readFileSync(args.fixture as string, 'utf-8');
  const orgs: SeededOrg[] = raw
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => JSON.parse(l) as SeededOrg);

  console.error(`[mint] loaded ${orgs.length} orgs from ${args.fixture}`);

  const tokens: MintedToken[] = [];

  for (const org of orgs) {
    const ownerTok = await mintFor(org.ownerEmail, org.orgId, 'owner');
    if (ownerTok) tokens.push(ownerTok);

    if (!args['owner-only']) {
      for (const m of org.members) {
        const t = await mintFor(m.email, org.orgId, m.role);
        if (t) tokens.push(t);
      }
    }
  }

  writeFileSync(
    args.out as string,
    JSON.stringify({ mintedAt: new Date().toISOString(), tokens }, null, 2),
  );
  console.error(`[mint] wrote ${tokens.length} tokens to ${args.out}`);
  if (tokens.length === 0) {
    console.error('[mint] FATAL: zero tokens minted. Check fixture + password.');
    process.exit(3);
  }
}

main().catch((err) => {
  console.error('[mint] fatal:', err);
  process.exit(1);
});
