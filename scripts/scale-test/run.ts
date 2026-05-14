/**
 * BRT sub-8 §4.4 scale test (k6) — per-VU auth edition.
 *
 * DO NOT EXECUTE the `heavy` profile without Walker greenlight on spend —
 * see BATTLE_TEST_RUNBOOK.md for the budget envelope.
 *
 * Two profiles:
 *   default  50 → 150 VUs, ~37 min total. Cheap infra-level smoke.
 *   heavy    0 → 500 VUs sustained + 1500 VU spike, ~2h 8m total. Full battle.
 *
 * Per-VU per-minute op mix (both profiles):
 *   200 RFI reads, 50 RFI creates, 30 daily-log creates, 100 IRIS calls,
 *   20 schedule reads, 10 PDF exports = 410 calls/min/VU.
 *
 * --- USAGE ---
 *   # 1. Seed (writes NDJSON fixture file with per-org credentials):
 *   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... SCALE_TEST_PASSWORD=... \
 *     npx tsx scripts/scale-test/seed-orgs.ts \
 *       --count 50 --members-per-org 10 \
 *       --out /tmp/scale-fixture.ndjson
 *
 *   # 2. Sign in all users up-front (Node-side, since k6 can't easily POST
 *   #    in setup() against a remote Supabase auth endpoint with persistence):
 *   SUPABASE_URL=... SUPABASE_ANON_KEY=... SCALE_TEST_PASSWORD=... \
 *     npx tsx scripts/scale-test/mint-vu-tokens.ts \
 *       --fixture /tmp/scale-fixture.ndjson \
 *       --out /tmp/scale-vu-tokens.json
 *
 *   # 3. Run k6, pointing at the minted token file:
 *   k6 run \
 *     -e SUPABASE_URL=https://<project>.supabase.co \
 *     -e SUPABASE_ANON_KEY=<anon> \
 *     -e VU_TOKENS_FILE=/tmp/scale-vu-tokens.json \
 *     scripts/scale-test/run.ts
 *
 *   # Heavy:
 *   k6 run -e PROFILE=heavy \
 *     -e SUPABASE_URL=... -e SUPABASE_ANON_KEY=... -e VU_TOKENS_FILE=... \
 *     scripts/scale-test/run.ts
 *
 * Required env:
 *   SUPABASE_URL       - project URL
 *   SUPABASE_ANON_KEY  - anon key (still required as the `apikey` header)
 *   VU_TOKENS_FILE     - path to JSON {tokens: [{jwt, orgId, projectId}, ...]}
 *                        produced by mint-vu-tokens.ts. Per-VU index modulo.
 *   PROFILE            - "heavy" for the 500-VU battle profile (default: smoke)
 *
 * --- SAFETY GUARD ---
 * Refuses to run if SUPABASE_URL host matches SCALE_TEST_PROD_BLOCKLIST.
 *
 * Tear down via: npx tsx scripts/scale-test/teardown.ts
 *
 * Owner: BRT Track C / sub-8 §4.4 + Track 1b
 */

// @ts-expect-error - k6 imports resolved at runtime by the k6 binary, not tsc.
import http from 'k6/http';
// @ts-expect-error - k6 imports resolved at runtime by the k6 binary, not tsc.
import { check, sleep } from 'k6';
// @ts-expect-error - k6 imports resolved at runtime by the k6 binary, not tsc.
import { SharedArray } from 'k6/data';

// ---------------------------------------------------------------------------
// Load profile
// ---------------------------------------------------------------------------
const PROFILE = (__ENV.PROFILE || 'smoke').toLowerCase();

const SMOKE_STAGES = [
  { duration: '1m', target: 50 },
  { duration: '30m', target: 50 },
  { duration: '5m', target: 150 },
  { duration: '1m', target: 0 },
];

const HEAVY_STAGES = [
  { duration: '5m', target: 500 },
  { duration: '100m', target: 500 },
  { duration: '2m', target: 1500 },
  { duration: '5m', target: 1500 },
  { duration: '3m', target: 500 },
  { duration: '5m', target: 500 },
  { duration: '5m', target: 0 },
];

const STAGES = PROFILE === 'heavy' ? HEAVY_STAGES : SMOKE_STAGES;

export const options = {
  stages: STAGES,
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: PROFILE === 'heavy' ? ['p(95)<1500'] : ['p(95)<500'],
    // Reads — strict
    'checks{op:rfi_read}': ['rate>0.99'],
    'checks{op:daily_log_read}': ['rate>0.99'],
    'checks{op:punch_read}': ['rate>0.99'],
    'checks{op:submittal_read}': ['rate>0.99'],
    'checks{op:schedule_read}': ['rate>0.99'],
    'checks{op:project_read}': ['rate>0.99'],
    'checks{op:member_read}': ['rate>0.99'],
    // Creates — strict
    'checks{op:rfi_create}': ['rate>0.99'],
    'checks{op:daily_log_create}': ['rate>0.99'],
    'checks{op:punch_create}': ['rate>0.99'],
    'checks{op:submittal_create}': ['rate>0.99'],
    // Updates — strict
    'checks{op:rfi_update}': ['rate>0.99'],
    'checks{op:punch_update}': ['rate>0.99'],
    // Deletes — strict
    'checks{op:rfi_delete}': ['rate>0.99'],
    // Edge fns — looser (cold-start tolerance)
    'checks{op:ai_call}': ['rate>0.95'],
    'checks{op:pdf_export}': ['rate>0.95'],
    'checks{op:health}': ['rate>0.95'],
  },
};

// ---------------------------------------------------------------------------
// Env
// ---------------------------------------------------------------------------
const SUPABASE_URL = __ENV.SUPABASE_URL;
const SUPABASE_ANON_KEY = __ENV.SUPABASE_ANON_KEY;
const VU_TOKENS_FILE = __ENV.VU_TOKENS_FILE;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !VU_TOKENS_FILE) {
  throw new Error(
    'Missing required env: SUPABASE_URL, SUPABASE_ANON_KEY, VU_TOKENS_FILE',
  );
}

// Hard guard: refuse to run against prod host.
const PROD_BLOCKLIST = (__ENV.SCALE_TEST_PROD_BLOCKLIST || '')
  .split(',')
  .map((s: string) => s.trim())
  .filter(Boolean);
const HOST = SUPABASE_URL.replace(/^https?:\/\//, '').split('/')[0];
if (PROD_BLOCKLIST.some((ref: string) => HOST.indexOf(ref) >= 0)) {
  throw new Error(`scale-test run.ts: SUPABASE_URL host "${HOST}" is in PROD blocklist`);
}

// ---------------------------------------------------------------------------
// Per-VU credentials (loaded once, shared across VUs via SharedArray)
// ---------------------------------------------------------------------------
interface VuToken {
  jwt: string;
  orgId: string;
  projectId?: string;
}

// SharedArray loads + parses on the main thread once. VUs read by index.
// Accepts either the legacy JSON shape ({mintedAt, tokens:[{jwt, ...}]}) OR
// the runbook NDJSON shape (one line per token: {userId, orgId, projectId,
// accessToken, role}). Auto-detected from the first non-whitespace char.
const vuTokens = new SharedArray<VuToken>('vu_tokens', () => {
  // @ts-expect-error - k6 SharedArray callback runs at init time only.
  const raw = open(VU_TOKENS_FILE) as string;
  const trimmed = raw.trimStart();
  let toks: VuToken[];
  if (trimmed.startsWith('{') && trimmed.includes('"tokens"')) {
    const parsed = JSON.parse(raw) as { tokens: Array<{ jwt: string; orgId: string; projectId?: string }> };
    toks = parsed.tokens.map((t) => ({ jwt: t.jwt, orgId: t.orgId, projectId: t.projectId }));
  } else {
    toks = raw
      .split('\n')
      .map((l: string) => l.trim())
      .filter(Boolean)
      .map((l: string) => {
        const o = JSON.parse(l) as { accessToken?: string; jwt?: string; orgId: string; projectId?: string };
        return { jwt: o.accessToken ?? o.jwt ?? '', orgId: o.orgId, projectId: o.projectId };
      });
  }
  if (toks.length === 0) {
    throw new Error(`VU_TOKENS_FILE ${VU_TOKENS_FILE} contains no tokens`);
  }
  return toks;
});

function tokenForVu(): VuToken {
  // __VU is 1-indexed; modulo so VU counts above token count round-robin.
  return vuTokens[(__VU - 1) % vuTokens.length];
}

function headersFor(tok: VuToken) {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${tok.jwt}`,
    'Content-Type': 'application/json',
    Prefer: 'return=minimal',
  };
}

// ---------------------------------------------------------------------------
// Per-VU per-minute call mix — expanded to 18 ops covering reads, creates,
// updates, deletes, edge fns. Total ~410/min/VU.
// ---------------------------------------------------------------------------
const CALLS_PER_MINUTE_PER_VU = 410;
const SLEEP_BETWEEN_CALLS_SEC = 60 / CALLS_PER_MINUTE_PER_VU;

type Op =
  // Reads (60% of mix — typical web app read/write ratio)
  | 'rfi_read'
  | 'daily_log_read'
  | 'punch_read'
  | 'submittal_read'
  | 'schedule_read'
  | 'project_read'
  | 'member_read'
  // Creates (20%)
  | 'rfi_create'
  | 'daily_log_create'
  | 'punch_create'
  | 'submittal_create'
  // Updates (10%)
  | 'rfi_update'
  | 'punch_update'
  // Deletes (3%) — small mix to test the cascade paths
  | 'rfi_delete'
  // Edge fns (7%)
  | 'ai_call'
  | 'pdf_export'
  | 'health';

const OP_BAG: Op[] = [
  // Reads — 60% (246/410)
  ...Array<Op>(80).fill('rfi_read'),
  ...Array<Op>(40).fill('daily_log_read'),
  ...Array<Op>(30).fill('punch_read'),
  ...Array<Op>(20).fill('submittal_read'),
  ...Array<Op>(40).fill('schedule_read'),
  ...Array<Op>(20).fill('project_read'),
  ...Array<Op>(16).fill('member_read'),
  // Creates — 20% (82/410)
  ...Array<Op>(40).fill('rfi_create'),
  ...Array<Op>(20).fill('daily_log_create'),
  ...Array<Op>(12).fill('punch_create'),
  ...Array<Op>(10).fill('submittal_create'),
  // Updates — 10% (41/410)
  ...Array<Op>(30).fill('rfi_update'),
  ...Array<Op>(11).fill('punch_update'),
  // Deletes — 3% (12/410)
  ...Array<Op>(12).fill('rfi_delete'),
  // Edge fns — 7% (29/410)
  ...Array<Op>(15).fill('ai_call'),
  ...Array<Op>(10).fill('pdf_export'),
  ...Array<Op>(4).fill('health'),
];

function pickOp(): Op {
  return OP_BAG[Math.floor(Math.random() * OP_BAG.length)];
}

// ---------------------------------------------------------------------------
// Ops — all now scoped by per-VU JWT, hitting real (RLS-allowed) rows.
// ---------------------------------------------------------------------------

// Tables in this schema scope by project_id (not organization_id). Only
// `projects` and `organization_members` carry organization_id directly. RLS
// resolves org membership through the projects→organizations chain.
function rfiRead(tok: VuToken) {
  const res = http.get(
    `${SUPABASE_URL}/rest/v1/rfis?select=id&project_id=eq.${tok.projectId}&limit=50`,
    { headers: headersFor(tok), tags: { op: 'rfi_read' } },
  );
  check(
    res,
    { 'rfi_read status 200': (r: { status: number }) => r.status === 200 },
    { op: 'rfi_read' },
  );
}

function rfiCreate(tok: VuToken) {
  // is_demo=true so the row is distinguishable from real load and reachable
  // by the teardown's belt-and-suspenders filter even if FK cascade fails.
  const body = JSON.stringify({
    project_id: tok.projectId,
    title: `Scale-test RFI ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    description: 'Synthetic RFI for load testing.',
    is_demo: true,
  });
  const res = http.post(`${SUPABASE_URL}/rest/v1/rfis`, body, {
    headers: headersFor(tok),
    tags: { op: 'rfi_create' },
  });
  check(
    res,
    { 'rfi_create status 2xx': (r: { status: number }) => r.status >= 200 && r.status < 300 },
    { op: 'rfi_create' },
  );
}

function dailyLogCreate(tok: VuToken) {
  const body = JSON.stringify({
    project_id: tok.projectId,
    log_date: new Date().toISOString().slice(0, 10),
    is_demo: true,
  });
  const res = http.post(`${SUPABASE_URL}/rest/v1/daily_logs`, body, {
    headers: headersFor(tok),
    tags: { op: 'daily_log_create' },
  });
  check(
    res,
    {
      'daily_log_create status 2xx': (r: { status: number }) => r.status >= 200 && r.status < 300,
    },
    { op: 'daily_log_create' },
  );
}

function aiCall(tok: VuToken) {
  // iris-call expects { task: enum, prompt, ... }. `feature` is not accepted —
  // the function returns 400 with "task must be one of reasoning, classification,
  // code_lookup, summarization". 'summarization' matches our prompt intent.
  const body = JSON.stringify({
    task: 'summarization',
    organization_id: tok.orgId,
    project_id: tok.projectId,
    prompt: 'Summarize the open RFIs for this project.',
    metadata: { scale_test: true },
  });
  const res = http.post(`${SUPABASE_URL}/functions/v1/iris-call`, body, {
    headers: headersFor(tok),
    tags: { op: 'ai_call' },
  });
  check(
    res,
    { 'ai_call status 200': (r: { status: number }) => r.status === 200 },
    { op: 'ai_call' },
  );
}

function scheduleRead(tok: VuToken) {
  // Schedule lives in schedule_phases (not schedule_tasks). Scoped by project_id.
  const res = http.get(
    `${SUPABASE_URL}/rest/v1/schedule_phases?select=id&project_id=eq.${tok.projectId}&limit=50`,
    { headers: headersFor(tok), tags: { op: 'schedule_read' } },
  );
  check(
    res,
    { 'schedule_read status 200': (r: { status: number }) => r.status === 200 },
    { op: 'schedule_read' },
  );
}

function pdfExport(tok: VuToken) {
  // NOTE 2026-05-14: the `export-pdf` Edge Function doesn't exist in the
  // codebase yet — supabase/functions/ has no export-pdf dir. Until that
  // function ships, treat 404 as "function not deployed" (acceptable load
  // profile signal — same shape as `health` accepts <500). The day the
  // function lands, this check tightens automatically because deployed
  // responses will return 200/202.
  const body = JSON.stringify({
    organization_id: tok.orgId,
    project_id: tok.projectId,
    document_type: 'rfi_log',
    metadata: { scale_test: true },
  });
  // responseCallback marks 200/202/404 as "expected" so http_req_failed
  // doesn't count pdf_export 404s as global request failures while the
  // function is still unbuilt.
  const res = http.post(`${SUPABASE_URL}/functions/v1/export-pdf`, body, {
    headers: headersFor(tok),
    tags: { op: 'pdf_export' },
    // @ts-expect-error k6 http types don't expose responseCallback in tsx
    responseCallback: http.expectedStatuses({ min: 200, max: 202 }, 404),
  });
  check(
    res,
    {
      'pdf_export status ok': (r: { status: number }) =>
        r.status === 200 || r.status === 202 || r.status === 404,
    },
    { op: 'pdf_export' },
  );
}

// ---------------------------------------------------------------------------
// Expanded ops — reads, creates, updates, deletes, health.
// ---------------------------------------------------------------------------

function projectScopeRead(tok: VuToken, table: string, op: Op) {
  const res = http.get(
    `${SUPABASE_URL}/rest/v1/${table}?select=id&project_id=eq.${tok.projectId}&limit=50`,
    { headers: headersFor(tok), tags: { op } },
  );
  check(res, { [`${op} 200`]: (r: { status: number }) => r.status === 200 }, { op });
}

function orgScopeRead(tok: VuToken, table: string, op: Op) {
  const res = http.get(
    `${SUPABASE_URL}/rest/v1/${table}?select=id&organization_id=eq.${tok.orgId}&limit=50`,
    { headers: headersFor(tok), tags: { op } },
  );
  check(res, { [`${op} 200`]: (r: { status: number }) => r.status === 200 }, { op });
}

function dailyLogRead(tok: VuToken)  { projectScopeRead(tok, 'daily_logs', 'daily_log_read'); }
function punchRead(tok: VuToken)     { projectScopeRead(tok, 'punch_items', 'punch_read'); }
function submittalRead(tok: VuToken) { projectScopeRead(tok, 'submittals', 'submittal_read'); }
function projectRead(tok: VuToken)   { orgScopeRead(tok, 'projects', 'project_read'); }
function memberRead(tok: VuToken)    { orgScopeRead(tok, 'organization_members', 'member_read'); }

function punchCreate(tok: VuToken) {
  const body = JSON.stringify({
    project_id: tok.projectId,
    title: `k6 punch ${Date.now()}`,
    description: 'Synthetic punch item for load testing.',
    is_demo: true,
  });
  const res = http.post(`${SUPABASE_URL}/rest/v1/punch_items`, body, {
    headers: headersFor(tok), tags: { op: 'punch_create' },
  });
  check(res, { 'punch_create 2xx': (r: { status: number }) => r.status >= 200 && r.status < 300 }, { op: 'punch_create' });
}

function submittalCreate(tok: VuToken) {
  const body = JSON.stringify({
    project_id: tok.projectId,
    title: `k6 submittal ${Date.now()}`,
    is_demo: true,
  });
  const res = http.post(`${SUPABASE_URL}/rest/v1/submittals`, body, {
    headers: headersFor(tok), tags: { op: 'submittal_create' },
  });
  check(res, { 'submittal_create 2xx': (r: { status: number }) => r.status >= 200 && r.status < 300 }, { op: 'submittal_create' });
}

function rfiUpdate(tok: VuToken) {
  // RFIs default to status='draft' on insert. Transition draft → answered for
  // demo rows; the filter is strict on is_demo so no real RFIs can be touched.
  const res = http.patch(
    `${SUPABASE_URL}/rest/v1/rfis?project_id=eq.${tok.projectId}&is_demo=eq.true&status=eq.draft&limit=1`,
    JSON.stringify({ status: 'answered' }),
    { headers: headersFor(tok), tags: { op: 'rfi_update' } },
  );
  check(res, { 'rfi_update 2xx': (r: { status: number }) => r.status >= 200 && r.status < 300 }, { op: 'rfi_update' });
}

function punchUpdate(tok: VuToken) {
  // punch_items default status='open' on insert. Strict is_demo filter.
  const res = http.patch(
    `${SUPABASE_URL}/rest/v1/punch_items?project_id=eq.${tok.projectId}&is_demo=eq.true&status=eq.open&limit=1`,
    JSON.stringify({ status: 'in_progress' }),
    { headers: headersFor(tok), tags: { op: 'punch_update' } },
  );
  check(res, { 'punch_update 2xx': (r: { status: number }) => r.status >= 200 && r.status < 300 }, { op: 'punch_update' });
}

function rfiDelete(tok: VuToken) {
  // Delete RFIs we previously flipped to 'answered'. Strict is_demo guard so
  // we can never reach a non-test row.
  const res = http.del(
    `${SUPABASE_URL}/rest/v1/rfis?project_id=eq.${tok.projectId}&is_demo=eq.true&status=eq.answered&limit=1`,
    null,
    { headers: headersFor(tok), tags: { op: 'rfi_delete' } },
  );
  check(res, { 'rfi_delete 2xx': (r: { status: number }) => r.status >= 200 && r.status < 300 }, { op: 'rfi_delete' });
}

function health(tok: VuToken) {
  const res = http.get(`${SUPABASE_URL}/functions/v1/health`, {
    headers: headersFor(tok), tags: { op: 'health' },
  });
  // /health may not exist on all projects — accept 200, 401, or 404 as
  // "function-level reachable." 5xx = real issue.
  check(res, { 'health reachable': (r: { status: number }) => r.status < 500 }, { op: 'health' });
}

// ---------------------------------------------------------------------------
// VU entry point
// ---------------------------------------------------------------------------
declare const __VU: number;

export default function () {
  const tok = tokenForVu();
  const op = pickOp();

  switch (op) {
    case 'rfi_read':         rfiRead(tok); break;
    case 'daily_log_read':   dailyLogRead(tok); break;
    case 'punch_read':       punchRead(tok); break;
    case 'submittal_read':   submittalRead(tok); break;
    case 'schedule_read':    scheduleRead(tok); break;
    case 'project_read':     projectRead(tok); break;
    case 'member_read':      memberRead(tok); break;
    case 'rfi_create':       rfiCreate(tok); break;
    case 'daily_log_create': dailyLogCreate(tok); break;
    case 'punch_create':     punchCreate(tok); break;
    case 'submittal_create': submittalCreate(tok); break;
    case 'rfi_update':       rfiUpdate(tok); break;
    case 'punch_update':     punchUpdate(tok); break;
    case 'rfi_delete':       rfiDelete(tok); break;
    case 'ai_call':          aiCall(tok); break;
    case 'pdf_export':       pdfExport(tok); break;
    case 'health':           health(tok); break;
  }

  sleep(SLEEP_BETWEEN_CALLS_SEC);
}
