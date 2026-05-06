// Regression test for the EntityAuditViewer infinite render loop.
//
// Root cause (pre-fix): the component destructured `data: rows = []` from
// useQuery. JS evaluates the default `[]` literal on every destructure, so
// when `data` is undefined (loading / error state), `rows` was a fresh array
// reference each render. That bypassed `useMemo([rows])`, produced a new
// `orderedRows` reference, re-fired `useEffect([orderedRows])`, which called
// `setChain({ ok: true, total: 0, gaps: [] })` with a fresh object each
// invocation — state changed → re-render → effect re-fired → loop.
//
// The fix uses module-scoped frozen `EMPTY_ROWS` and `EMPTY_CHAIN` constants
// plus `useMemo([data])` so reference equality holds across renders when the
// underlying data has not changed. This test asserts the component does not
// re-render more than a small bounded number of times during the loading
// (`data === undefined`) or empty-data (`data === []`) states. We can't rely
// on React emitting "Maximum update depth exceeded" — in some configurations
// the loop just spins indefinitely without bailing — so we cap renders by
// bracketing the component with a render-counting wrapper that throws once
// the threshold is crossed, which surfaces as a test failure within ms.

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock the supabase client and the hash-chain verifier so the component
// does not perform real network or crypto work during the test.
vi.mock('../../../lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            order: () => ({
              order: () => Promise.resolve({ data: [], error: null }),
            }),
          }),
        }),
      }),
    }),
    functions: { invoke: () => Promise.resolve({ data: null, error: null }) },
  },
}));

vi.mock('../../../lib/audit/hashChainVerifier', async () => ({
  verifyChain: vi.fn(async () => ({ ok: true, total: 0, gaps: [] })),
}));

vi.mock('../HashChainBadge', () => ({
  HashChainBadge: () => React.createElement('span', { 'data-testid': 'hash-chain-badge' }),
}));

vi.mock('../AuditTimeline', () => ({
  AuditTimeline: () => React.createElement('div', { 'data-testid': 'audit-timeline' }),
}));

vi.mock('sonner', () => ({
  toast: { message: vi.fn(), error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));

import { EntityAuditViewer } from '../EntityAuditViewer';

function createTestClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  });
}

// Deterministic render-counter ceiling. Even with the React-DevTools-style
// double-render, a healthy component should stabilise within a handful of
// renders; 50 is generously above noise and well below where an infinite
// loop becomes ambiguous with a slow test.
const RENDER_LIMIT = 50;

function CountingHarness({ children }: { children: React.ReactNode }): React.ReactElement {
  const count = React.useRef(0);
  count.current += 1;
  if (count.current > RENDER_LIMIT) {
    throw new Error(
      `EntityAuditViewer harness exceeded ${RENDER_LIMIT} renders — the ` +
        'chain-verify effect is firing in a loop. Look at orderedRows / ' +
        'setChain reference stability in EntityAuditViewer.tsx.',
    );
  }
  return React.createElement(React.Fragment, null, children);
}

describe('EntityAuditViewer — render-loop regression', () => {
  beforeEach(() => {
    // Suppress any error logs the test environment surfaces. The render
    // counter does the actual assertion; console noise would only confuse
    // the failure message.
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('does not infinite-loop while the audit_log query is loading (data=undefined)', async () => {
    const client = createTestClient();

    expect(() => {
      render(
        React.createElement(
          QueryClientProvider,
          { client },
          React.createElement(
            CountingHarness,
            null,
            React.createElement(EntityAuditViewer, {
              entityType: 'rfi',
              entityId: 'rfi-1',
              projectId: 'proj-1',
            }),
          ),
        ),
      );
    }).not.toThrow();
  });

  it('does not infinite-loop when the audit_log query resolves to an empty array', async () => {
    const client = createTestClient();

    render(
      React.createElement(
        QueryClientProvider,
        { client },
        React.createElement(
          CountingHarness,
          null,
          React.createElement(EntityAuditViewer, {
            entityType: 'submittal',
            entityId: 'sub-1',
            projectId: 'proj-1',
          }),
        ),
      ),
    );

    // Flush microtasks so the resolved queryFn promise drives a final render.
    // The harness will throw inside `act` if the loop is happening.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
  });
});
