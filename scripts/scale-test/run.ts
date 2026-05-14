/**
 * BRT sub-8 §4.4 scale test (k6).
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
 *   # Smoke (default):
 *   k6 run \
 *     -e SUPABASE_URL=https://<project>.supabase.co \
 *     -e SUPABASE_ANON_KEY=<anon> \
 *     -e TEST_ORG_IDS=<csv> \
 *     scripts/scale-test/run.ts
 *
 *   # Heavy:
 *   k6 run -e PROFILE=heavy \
 *     -e SUPABASE_URL=... -e SUPABASE_ANON_KEY=... -e TEST_ORG_IDS=... \
 *     scripts/scale-test/run.ts
 *
 * Required env:
 *   SUPABASE_URL        - project URL
 *   SUPABASE_ANON_KEY   - anon key
 *   TEST_ORG_IDS        - comma-separated org UUIDs from seed-orgs.ts
 *   PROFILE             - "heavy" for the 500-VU battle profile (default: smoke)
 *
 * --- KNOWN GAP ---
 * This harness uses the ANON key only. Under RLS that means every read returns
 * zero rows and every write 403s. The k6 numbers therefore measure
 * "permission-denied throughput" — useful for floor-level latency, edge fn
 * cold-start, rate-limiter behavior, and timeout shaping, but NOT for real
 * feature throughput. The primary battle test is the Playwright persona suite
 * — see docs/runbooks/BATTLE_TEST_RUNBOOK.md.
 *
 * Tear down via: npx tsx scripts/scale-test/teardown.ts
 *
 * Owner: BRT Track C / sub-8 §4.4
 */

// @ts-expect-error - k6 imports resolved at runtime by the k6 binary, not tsc.
import http from 'k6/http';
// @ts-expect-error - k6 imports resolved at runtime by the k6 binary, not tsc.
import { check, sleep } from 'k6';

// ---------------------------------------------------------------------------
// Load profile
// ---------------------------------------------------------------------------
const PROFILE = (__ENV.PROFILE || 'smoke').toLowerCase();

// Smoke (default): cheap, ~37 min total.
//   1m  ramp-up   0  -> 50  VUs
//  30m  steady    50         VUs
//   5m  spike     50 -> 150  VUs
//   1m  ramp-down 150 -> 0   VUs
const SMOKE_STAGES = [
  { duration: '1m', target: 50 },
  { duration: '30m', target: 50 },
  { duration: '5m', target: 150 },
  { duration: '1m', target: 0 },
];

// Heavy: full battle, ~2h 8m total.
//   5m   ramp-up    0    -> 500   VUs
// 100m   sustain    500          VUs
//   2m   spike-up   500  -> 1500 VUs
//   5m   spike-hold 1500         VUs
//   3m   spike-down 1500 -> 500  VUs
//   5m   sustain    500          VUs
//   5m   ramp-down  500  -> 0    VUs
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
    // Heavy profile widens the perf threshold — under 500 VUs against prod
    // Supabase, p95<500ms is unrealistic. Floor-level smoke keeps the tight gate.
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
const TEST_ORG_IDS = (__ENV.TEST_ORG_IDS || '')
  .split(',')
  .map((s: string) => s.trim())
  .filter(Boolean);

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || TEST_ORG_IDS.length === 0) {
  throw new Error(
    'Missing required env: SUPABASE_URL, SUPABASE_ANON_KEY, TEST_ORG_IDS (comma-separated UUIDs)',
  );
}

const baseHeaders = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
  Prefer: 'return=minimal',
};

// ---------------------------------------------------------------------------
// Per-VU per-minute call mix
// ---------------------------------------------------------------------------
// 200 RFI reads + 50 RFI creates + 30 daily-log creates +
// 100 AI calls + 20 schedule reads + 10 PDF exports = 410 calls/min/VU.
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

// Weighted bag of operations: each entry repeated by its target count.
const OP_BAG: Op[] = [
  ...Array<Op>(200).fill('rfi_read'),
  ...Array<Op>(50).fill('rfi_create'),
  ...Array<Op>(30).fill('daily_log_create'),
  ...Array<Op>(100).fill('ai_call'),
  ...Array<Op>(20).fill('schedule_read'),
  ...Array<Op>(10).fill('pdf_export'),
];

function pickOrg(): string {
  return TEST_ORG_IDS[Math.floor(Math.random() * TEST_ORG_IDS.length)];
}

function pickOp(): Op {
  return OP_BAG[Math.floor(Math.random() * OP_BAG.length)];
}

// ---------------------------------------------------------------------------
// Operation implementations
// ---------------------------------------------------------------------------

function rfiRead(orgId: string) {
  const res = http.get(
    `${SUPABASE_URL}/rest/v1/rfis?select=*&organization_id=eq.${orgId}`,
    { headers: baseHeaders, tags: { op: 'rfi_read' } },
  );
  check(
    res,
    { 'rfi_read status 200': (r: { status: number }) => r.status === 200 },
    { op: 'rfi_read' },
  );
}

function rfiCreate(orgId: string) {
  const body = JSON.stringify({
    organization_id: orgId,
    subject: `Scale-test RFI ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    question: 'Synthetic question for load testing.',
    status: 'open',
    priority: 'normal',
    metadata: { scale_test: true },
  });
  const res = http.post(`${SUPABASE_URL}/rest/v1/rfis`, body, {
    headers: baseHeaders,
    tags: { op: 'rfi_create' },
  });
  check(
    res,
    { 'rfi_create status 201': (r: { status: number }) => r.status === 201 || r.status === 200 },
    { op: 'rfi_create' },
  );
}

function dailyLogCreate(orgId: string) {
  const body = JSON.stringify({
    organization_id: orgId,
    log_date: new Date().toISOString().slice(0, 10),
    weather: 'sunny',
    notes: `Scale-test daily log ${Date.now()}`,
    metadata: { scale_test: true },
  });
  const res = http.post(`${SUPABASE_URL}/rest/v1/daily_logs`, body, {
    headers: baseHeaders,
    tags: { op: 'daily_log_create' },
  });
  check(
    res,
    {
      'daily_log_create status 201': (r: { status: number }) =>
        r.status === 201 || r.status === 200,
    },
    { op: 'daily_log_create' },
  );
}

function aiCall(orgId: string) {
  const body = JSON.stringify({
    organization_id: orgId,
    prompt: 'Summarize the open RFIs for this project.',
    feature: 'scale_test',
    metadata: { scale_test: true },
  });
  const res = http.post(`${SUPABASE_URL}/functions/v1/iris-call`, body, {
    headers: baseHeaders,
    tags: { op: 'ai_call' },
  });
  check(
    res,
    { 'ai_call status 200': (r: { status: number }) => r.status === 200 },
    { op: 'ai_call' },
  );
}

function scheduleRead(orgId: string) {
  const res = http.get(
    `${SUPABASE_URL}/rest/v1/schedule_tasks?select=*&organization_id=eq.${orgId}&order=start_date.asc&limit=200`,
    { headers: baseHeaders, tags: { op: 'schedule_read' } },
  );
  check(
    res,
    { 'schedule_read status 200': (r: { status: number }) => r.status === 200 },
    { op: 'schedule_read' },
  );
}

function pdfExport(orgId: string) {
  const body = JSON.stringify({
    organization_id: orgId,
    document_type: 'rfi_log',
    metadata: { scale_test: true },
  });
  const res = http.post(`${SUPABASE_URL}/functions/v1/export-pdf`, body, {
    headers: baseHeaders,
    tags: { op: 'pdf_export' },
  });
  check(
    res,
    {
      'pdf_export status 200': (r: { status: number }) => r.status === 200 || r.status === 202,
    },
    { op: 'pdf_export' },
  );
}

// ---------------------------------------------------------------------------
// VU entry point
// ---------------------------------------------------------------------------
export default function () {
  const orgId = pickOrg();
  const op = pickOp();

  switch (op) {
    case 'rfi_read':
      rfiRead(orgId);
      break;
    case 'rfi_create':
      rfiCreate(orgId);
      break;
    case 'daily_log_create':
      dailyLogCreate(orgId);
      break;
    case 'ai_call':
      aiCall(orgId);
      break;
    case 'schedule_read':
      scheduleRead(orgId);
      break;
    case 'pdf_export':
      pdfExport(orgId);
      break;
  }

  sleep(SLEEP_BETWEEN_CALLS_SEC);
}
