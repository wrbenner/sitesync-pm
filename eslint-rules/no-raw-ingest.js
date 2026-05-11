/**
 * no-raw-ingest
 *
 * Per IRIS_PHASE_3 spec §6: every upload path that lands a new chunk in
 * `iris_kb_chunks` must go through `routeArtifact()` (the classifier in
 * `src/services/iris/ingestion/router.ts`) and a per-source-type worker.
 * Direct `INSERT INTO iris_kb_chunks` or `supabase.from('iris_kb_chunks').
 * insert(...)` from anywhere outside the worker allow-list is forbidden.
 *
 * The rule fires when code outside `src/services/iris/ingestion/` OR
 * `supabase/functions/iris-ingest-*-worker/` calls one of:
 *   - `supabase.from('iris_kb_chunks').insert(...)`
 *   - `supabase.from('iris_kb_chunks').upsert(...)`
 *   - `supabase.from('iris_kb_sources').insert(...)`  (workers own the tracker)
 *
 * Allow-list (path-based):
 *   - src/services/iris/ingestion/      — chunkers + router + retrieve
 *   - supabase/functions/iris-ingest-   — per-source worker prefix
 *   - tests/                            — fixture setup is fine
 *   - eslint-rules/__tests__/           — rule's own tests
 */

function pathIsExempt(filename) {
  const norm = filename.replace(/\\/g, '/');
  return (
    norm.includes('/src/services/iris/ingestion/')
    || norm.includes('/supabase/functions/iris-ingest-')
    || norm.includes('/tests/')
    || norm.includes('/test/')
    || norm.includes('/eslint-rules/__tests__/')
    || norm.endsWith('.test.ts')
    || norm.endsWith('.test.tsx')
    || norm.endsWith('.test.js')
  );
}

const FORBIDDEN_TABLES = new Set(['iris_kb_chunks', 'iris_kb_sources']);
const FORBIDDEN_OPS = new Set(['insert', 'upsert']);

// Match `<x>.from('table').<op>(...)` chained patterns.
function checkChain(node, context) {
  // node is a CallExpression; node.callee should be a MemberExpression
  // whose object is also a CallExpression of `.from('table')`.
  if (node.callee.type !== 'MemberExpression') return;
  const op = node.callee.property?.name;
  if (!FORBIDDEN_OPS.has(op)) return;

  const fromCall = node.callee.object;
  if (!fromCall || fromCall.type !== 'CallExpression') return;
  if (fromCall.callee.type !== 'MemberExpression') return;
  if (fromCall.callee.property?.name !== 'from') return;

  const tableArg = fromCall.arguments?.[0];
  if (!tableArg || tableArg.type !== 'Literal' || typeof tableArg.value !== 'string') return;
  if (!FORBIDDEN_TABLES.has(tableArg.value)) return;

  context.report({
    node,
    messageId: 'rawIngest',
    data: { table: tableArg.value, op },
  });
}

export default {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow direct writes to iris_kb_chunks / iris_kb_sources outside the ingestion worker allow-list. Route through routeArtifact() + a per-source worker per IRIS_PHASE_3 spec §6.',
      recommended: true,
    },
    schema: [],
    messages: {
      rawIngest:
        'Direct {{op}} on {{table}} is forbidden outside src/services/iris/ingestion/ and supabase/functions/iris-ingest-*-worker/. Route the artifact through routeArtifact() and let the per-source worker write the chunk.',
    },
  },
  create(context) {
    const filename = context.filename ?? context.getFilename?.() ?? '';
    if (pathIsExempt(filename)) {
      return {};
    }
    return {
      CallExpression(node) {
        checkChain(node, context);
      },
    };
  },
};
