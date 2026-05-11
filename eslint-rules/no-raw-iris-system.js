/**
 * no-raw-iris-system
 *
 * Per ADR-020 and IRIS_PHASE_1 spec §5.3: the Context Fabric
 * (src/services/iris/contextFabric.ts) is the SINGLE retrieval entrypoint
 * for assembling Iris system prompts. Caller-supplied `system=` strings are
 * deprecated and removed by Lap 3 close.
 *
 * This rule fires when a file outside `src/services/iris/` sets a `system:`
 * property on an object literal that flows into either:
 *
 *   1. `callIris({ ..., system: <expr>, ... })`             (direct call)
 *   2. `callFn({ ..., system: <expr>, ... })`               (aliased — drafts.ts test injection)
 *   3. `supabase.functions.invoke('iris-call', { body: { system: ... } })`
 *
 * The allow-list is path-based: any file whose path includes
 * `/src/services/iris/` is exempted. That covers `contextFabric.ts`,
 * `legacyAdapters.ts`, `templates.ts`, `drafts.ts`, and the slot builders
 * landing on Phase 1 Days 2–8.
 *
 * Rationale: a free-text `system=` per caller defeats the WHO/WHAT/WHEN/
 * WHERE/WHY assembly discipline that the Fabric exists to enforce. New
 * callers must describe intent (IrisInvocation) and let buildContext()
 * produce the system prompt, not invent one. Reverting to caller-supplied
 * prompts re-fragments the persona model and breaks the per-persona
 * telemetry dashboards (Phase 1d).
 *
 * Allowed via comment escape hatch:
 *
 *   // eslint-disable-next-line sitesync/no-raw-iris-system
 *
 * Use sparingly — only for legitimately one-off integration points (e.g.
 * a low-volume admin tool that doesn't ship to customers).
 */

function pathIsExempt(filename) {
  // Normalize Windows backslashes just in case CI ever runs there.
  const norm = filename.replace(/\\/g, '/');
  return (
    norm.includes('/src/services/iris/')
    || norm.includes('/eslint-rules/__tests__/')
    || norm.includes('/test/')
    || norm.includes('/tests/')
  );
}

function getCalleeName(callee) {
  if (callee.type === 'Identifier') return callee.name;
  if (callee.type === 'MemberExpression') {
    // e.g. `supabase.functions.invoke` → "invoke" (the leaf)
    if (callee.property && callee.property.type === 'Identifier') {
      return callee.property.name;
    }
  }
  return null;
}

function isSupabaseFunctionsInvoke(callee) {
  if (callee.type !== 'MemberExpression') return false;
  // Match `<anything>.functions.invoke`
  const obj = callee.object;
  return (
    callee.property?.name === 'invoke'
    && obj?.type === 'MemberExpression'
    && obj.property?.name === 'functions'
  );
}

function firstArgumentIsIrisCall(callExpr) {
  const first = callExpr.arguments?.[0];
  return first
    && first.type === 'Literal'
    && typeof first.value === 'string'
    && first.value === 'iris-call';
}

function objectExpressionHasSystemProperty(node) {
  if (!node || node.type !== 'ObjectExpression') return null;
  for (const prop of node.properties) {
    if (
      prop.type === 'Property'
      && !prop.computed
      && prop.key
      && ((prop.key.type === 'Identifier' && prop.key.name === 'system')
        || (prop.key.type === 'Literal' && prop.key.value === 'system'))
    ) {
      return prop;
    }
  }
  return null;
}

function getRootInvokeArgObject(callExpr) {
  // For supabase.functions.invoke('iris-call', { body: { system: ... } }),
  // we want the inner `body` object literal.
  const second = callExpr.arguments?.[1];
  if (!second || second.type !== 'ObjectExpression') return null;
  for (const prop of second.properties) {
    if (
      prop.type === 'Property'
      && !prop.computed
      && prop.key
      && ((prop.key.type === 'Identifier' && prop.key.name === 'body')
        || (prop.key.type === 'Literal' && prop.key.value === 'body'))
      && prop.value.type === 'ObjectExpression'
    ) {
      return prop.value;
    }
  }
  return null;
}

export default {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow caller-supplied `system=` prompts on iris-call invocations. Route through src/services/iris/contextFabric.ts buildContext() per ADR-020.',
      recommended: true,
    },
    schema: [],
    messages: {
      rawSystem:
        'Raw `system=` on an iris-call invocation is deprecated (ADR-020 / IRIS_PHASE_1 §5.3). Build the system prompt via `buildContext()` in src/services/iris/contextFabric.ts and call through `adaptStreamItemToFabric()` (src/services/iris/legacyAdapters.ts) instead.',
    },
  },
  create(context) {
    const filename = context.filename ?? context.getFilename?.() ?? '';
    if (pathIsExempt(filename)) {
      return {};
    }
    return {
      CallExpression(node) {
        const calleeName = getCalleeName(node.callee);

        // ── Pattern 1+2: callIris({ system: ... }) or callFn({ system: ... }) ──
        if (calleeName && /^(callIris|callFn)$/.test(calleeName)) {
          const firstArg = node.arguments?.[0];
          const offending = objectExpressionHasSystemProperty(firstArg);
          if (offending) {
            context.report({ node: offending, messageId: 'rawSystem' });
          }
        }

        // ── Pattern 3: supabase.functions.invoke('iris-call', { body: { system: ... }}) ──
        if (isSupabaseFunctionsInvoke(node.callee) && firstArgumentIsIrisCall(node)) {
          const bodyObj = getRootInvokeArgObject(node);
          const offending = objectExpressionHasSystemProperty(bodyObj);
          if (offending) {
            context.report({ node: offending, messageId: 'rawSystem' });
          }
        }
      },
    };
  },
};
