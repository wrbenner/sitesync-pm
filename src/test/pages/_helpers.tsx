// Shared helpers for page smoke tests.
//
// Pages have many transitive dependencies (copilot store, route context, AI
// annotations, sonner, etc.). Each smoke test uses vi.mock at top to stub
// them. This file provides:
//   - renderPageWithProviders: wraps a page in QueryClient + MemoryRouter
//   - createTestQueryClient: one retry-disabled client per test
//
// Because vi.mock is hoisted, the actual mock declarations still live in
// each test file. This helper is only the render wrapper + factory — the
// template at the top of each smoke test declares the mocks literally.

import React, { type PropsWithChildren, type ReactElement } from 'react'
import { render, type RenderOptions, type RenderResult } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'

export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  })
}

interface PageRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  route?: string
  queryClient?: QueryClient
}

export function renderPageWithProviders(ui: ReactElement, options: PageRenderOptions = {}): RenderResult {
  const client = options.queryClient ?? createTestQueryClient()
  const route = options.route ?? '/'
  const Wrapper = ({ children }: PropsWithChildren): ReactElement =>
    React.createElement(
      QueryClientProvider,
      { client },
      React.createElement(
        MemoryRouter,
        { initialEntries: [route] },
        children,
      ),
    )
  const { route: _r, queryClient: _q, ...renderOpts } = options
  void _r
  void _q
  return render(ui, { ...renderOpts, wrapper: Wrapper })
}
