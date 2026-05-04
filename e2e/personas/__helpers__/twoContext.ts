/**
 * twoContext.ts — Run a callback with two browser contexts.
 *
 * Used for presence, conflict, and cursor tests. Each context loads its
 * own copy of e2e/.auth/state.json. In production these would be
 * different accounts; for the audit we observe presence machinery firing
 * from a single account writing through two tabs.
 */
import { type Browser, type BrowserContext, type Page } from '@playwright/test'
import { STATE_PATH } from './personaAuth'

export interface TwoContext {
  ctxA: BrowserContext
  ctxB: BrowserContext
  pageA: Page
  pageB: Page
  close: () => Promise<void>
}

export async function withTwoContexts(browser: Browser): Promise<TwoContext> {
  const ctxA = await browser.newContext({ storageState: STATE_PATH })
  const ctxB = await browser.newContext({ storageState: STATE_PATH })
  const pageA = await ctxA.newPage()
  const pageB = await ctxB.newPage()
  return {
    ctxA,
    ctxB,
    pageA,
    pageB,
    close: async () => {
      await Promise.all([ctxA.close(), ctxB.close()])
    },
  }
}
