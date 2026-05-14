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
    'checks{op:rfi_read}': ['rate>0.99'],
    'checks{op:rfi_create}': ['rate>0.99'],
    'checks{op:daily_log_create}': ['rate>0.99'],
    'checks{op:ai_call}': ['rate>0.95'],
    'checks{op:schedule_read}': ['rate>0.99'],
    'checks{op:pdf_export}': ['rate>0.95'],
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
const vuTokens = new SharedArray<VuToken>('vu_tokens', () => {
  // @ts-expect-error - k6 SharedArray callback runs at init time only.
  const raw = open(VU_TOKENS_FILE);
  const parsed = JSON.parse(raw) as { tokens: VuToken[] };
  if (!parsed.tokens || parsed.tokens.length === 0) {
    throw new Error(`VU_TOKENS_FILE ${VU_TOKENS_FILE} contains no tokens`);
  }
  return parsed.tokens;
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
// Per-VU per-minute call mix (200 + 50 + 30 + 100 + 20 + 10 = 410/min/VU)
// ---------------------------------------------------------------------------
const CALLS_PER_MINUTE_PER_VU = 410;
const SLEEP_BETWEEN_CALLS_SEC = 60 / CALLS_PER_MINUTE_PER_VU;

type Op =
  | 'rfi_read'
  | 'rfi_create'
  | 'daily_log_create'
  | 'ai_call'
  | 'schedule_read'
  | 'pdf_export';

const OP_BAG: Op[] = [
  ...Array<Op>(200).fill('rfi_read'),
  ...Array<Op>(50).fill('rfi_create'),
  ...Array<Op>(30).fill('daily_log_create'),
  ...Array<Op>(100).fill('ai_call'),
  ...Array<Op>(20).fill('schedule_read'),
  ...Array<Op>(10).fill('pdf_export'),
];

function pickOp(): Op {
  return OP_BAG[Math.floor(Math.random() * OP_BAG.length)];
}

// ---------------------------------------------------------------------------
// Ops — all now scoped by per-VU JWT, hitting real (RLS-allowed) rows.
// ---------------------------------------------------------------------------

function rfiRead(tok: VuToken) {
  const res = http.get(
    `${SUPABASE_URL}/rest/v1/rfis?select=*&organization_id=eq.${tok.orgId}`,
    { headers: headersFor(tok), tags: { op: 'rfi_read' } },
  );
  check(
    res,
    { 'rfi_read status 200': (r: { status: number }) => r.status === 200 },
    { op: 'rfi_read' },
  );
}

function rfiCreate(tok: VuToken) {
  const body = JSON.stringify({
    organization_id: tok.orgId,
    project_id: tok.projectId,
    subject: `Scale-test RFI ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    question: 'Synthetic question for load testing.',
    status: 'open',
    priority: 'normal',
    metadata: { scale_test: true },
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
    organization_id: tok.orgId,
    project_id: tok.projectId,
    log_date: new Date().toISOString().slice(0, 10),
    weather: 'sunny',
    notes: `Scale-test daily log ${Date.now()}`,
    metadata: { scale_test: true },
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
  const body = JSON.stringify({
    organization_id: tok.orgId,
    prompt: 'Summarize the open RFIs for this project.',
    feature: 'scale_test',
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
  const res = http.get(
    `${SUPABASE_URL}/rest/v1/schedule_tasks?select=*&organization_id=eq.${tok.orgId}&order=start_date.asc&limit=200`,
    { headers: headersFor(tok), tags: { op: 'schedule_read' } },
  );
  check(
    res,
    { 'schedule_read status 200': (r: { status: number }) => r.status === 200 },
    { op: 'schedule_read' },
  );
}

function pdfExport(tok: VuToken) {
  const body = JSON.stringify({
    organization_id: tok.orgId,
    project_id: tok.projectId,
    document_type: 'rfi_log',
    metadata: { scale_test: true },
  });
  const res = http.post(`${SUPABASE_URL}/functions/v1/export-pdf`, body, {
    headers: headersFor(tok),
    tags: { op: 'pdf_export' },
  });
  check(
    res,
    {
      'pdf_export status ok': (r: { status: number }) => r.status === 200 || r.status === 202,
    },
    { op: 'pdf_export' },
  );
}

// ---------------------------------------------------------------------------
// VU entry point
// ---------------------------------------------------------------------------
declare const __VU: number;

export default function () {
  const tok = tokenForVu();
  const op = pickOp();

  switch (op) {
    case 'rfi_read':
      rfiRead(tok);
      break;
    case 'rfi_create':
      rfiCreate(tok);
      break;
    case 'daily_log_create':
      dailyLogCreate(tok);
      break;
    case 'ai_call':
      aiCall(tok);
      break;
    case 'schedule_read':
      scheduleRead(tok);
      break;
    case 'pdf_export':
      pdfExport(tok);
      break;
  }

  sleep(SLEEP_BETWEEN_CALLS_SEC);
}
