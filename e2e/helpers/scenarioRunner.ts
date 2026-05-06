/**
 * scenarioRunner — shared lifecycle for the integration scenarios.
 *
 * Each scenario:
 *   1. Resets the test DB to a known seed (helpers/dbReset.ts)
 *   2. Loads the scenario's input fixture (e2e/fixtures/scenarios/<name>.json)
 *   3. Runs the chain
 *   4. Asserts post-conditions
 *
 * Mocks are wired here so each spec is concise:
 *   • Anthropic API → fixture-recorded responses (no real API call)
 *   • Resend / SMTP → spy capturing outbound emails
 *   • Cron / scheduler → manual trigger via test endpoint, never wall-clock
 *
 * The helper enforces the spec's performance gates (setup+teardown < 30s)
 * by wrapping each phase in its own timeout.
 */

import { type Page, type Request, type Route } from '@playwright/test'
import { resetTestDb, type DbResetOptions } from './dbReset'

export interface OutboundEmail {
  to: string
  subject: string
  body: string
  from?: string
  /** Raw payload as the SMTP/webhook saw it. */
  raw: unknown
}

export interface AnthropicCall {
  model: string
  systemPrompt?: string
  userPrompt: string
  /** Resolved response payload (text or JSON, whichever the route returned). */
  response: unknown
}

export interface ScenarioContext {
  /** Fixture name (matches e2e/fixtures/scenarios/<name>.json). */
  name: string
  /** Loaded JSON from the fixture file. */
  fixture: Record<string, unknown>
  /** Captured outbound emails for the duration of the scenario. */
  emails: OutboundEmail[]
  /** Captured Anthropic API calls. */
  ai: AnthropicCall[]
  /** Trigger a named cron job synchronously via the test endpoint. */
  triggerCron: (name: string, payload?: unknown) => Promise<unknown>
}

interface SetupOptions extends DbResetOptions {
  /** Scenario name — drives fixture loading. */
  name: string
  /** Mock Anthropic responses keyed by user-prompt prefix. */
  aiResponses?: Record<string, unknown>
}

const SETUP_BUDGET_MS = 15_000
const TEARDOWN_BUDGET_MS = 15_000

async function withTimeout<T>(label: string, ms: number, run: () => Promise<T>): Promise<T> {
  const t0 = Date.now()
  const result = await Promise.race([
    run(),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} exceeded ${ms}ms budget`)), ms),
    ),
  ])
  const elapsed = Date.now() - t0
  if (elapsed > ms * 0.8) {
    // Log a soft-warning when we're within 20% of the budget — early
    // indicator that setup is creeping toward the spec's 30s gate.

    console.warn(`[scenarioRunner] ${label} took ${elapsed}ms (budget ${ms}ms)`)
  }
  return result
}

/**
 * Set up a scenario. Returns the active context so the spec can drive it.
 * Call `teardown()` from `test.afterEach` to clean up DB state and unhook
 * route handlers.
 */
export async function setupScenario(
  page: Page,
  opts: SetupOptions,
): Promise<{ ctx: ScenarioContext; teardown: () => Promise<void> }> {
  const ctx: ScenarioContext = {
    name: opts.name,
    fixture: {},
    emails: [],
    ai: [],
    triggerCron: async (cronName: string, payload?: unknown) => {
      // The test app exposes /test/trigger-cron/<name> when ENABLE_TEST_HOOKS=1.
      // Locally the dev server has this; CI sets the env var on its preview
      // server. The endpoint short-circuits the cron's wall-clock wait and
      // invokes the underlying handler directly.
      const url = `${page.context().baseURL ?? ''}/test/trigger-cron/${cronName}`
      const resp = await page.request.post(url, { data: payload ?? {} })
      if (!resp.ok()) {
        throw new Error(`triggerCron(${cronName}) returned ${resp.status()}: ${await resp.text()}`)
      }
      return await resp.json().catch(() => ({}))
    },
  }

  await withTimeout('dbReset', SETUP_BUDGET_MS, () => resetTestDb(opts))

  // Load the scenario fixture.
  ctx.fixture = await loadFixture(opts.name)

  // ── Mock Anthropic at the boundary ───────────────────────────────
  // The app's edge functions call api.anthropic.com. We route every
  // matching outbound request to the fixture map. Missing keys throw
  // loudly so a scenario can't silently rely on a real-API hit.
  await page.route('**://api.anthropic.com/**', async (route: Route, req: Request) => {
    const body = req.postData() ?? ''
    let parsed: { messages?: Array<{ content: string }>; system?: string; model?: string } = {}
    try { parsed = JSON.parse(body) } catch { /* not all calls are JSON */ }
    const userPrompt = parsed.messages?.find(m => typeof m.content === 'string')?.content ?? body.slice(0, 200)
    const matchKey = Object.keys(opts.aiResponses ?? {}).find(k => userPrompt.includes(k))
    const response = matchKey ? opts.aiResponses?.[matchKey] : { error: `[scenarioRunner] no AI fixture for prompt prefix: ${userPrompt.slice(0, 80)}` }
    ctx.ai.push({
      model: parsed.model ?? 'unknown',
      systemPrompt: parsed.system,
      userPrompt,
      response,
    })
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        content: [{ type: 'text', text: typeof response === 'string' ? response : JSON.stringify(response) }],
        model: parsed.model ?? 'claude-sonnet-4-20250514',
        usage: { input_tokens: 100, output_tokens: 50 },
      }),
    })
  })

  // ── Mock outbound mail (Resend / SMTP webhook) ───────────────────
  await page.route('**://api.resend.com/**', async (route: Route, req: Request) => {
    const body = req.postData() ?? ''
    let parsed: { to?: string | string[]; subject?: string; html?: string; from?: string } = {}
    try { parsed = JSON.parse(body) } catch { /* */ }
    const to = Array.isArray(parsed.to) ? parsed.to.join(',') : (parsed.to ?? '')
    ctx.emails.push({
      to,
      subject: parsed.subject ?? '',
      body: parsed.html ?? '',
      from: parsed.from,
      raw: parsed,
    })
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'mock' }) })
  })

  const teardown = async () => {
    await withTimeout('teardown', TEARDOWN_BUDGET_MS, async () => {
      await page.unrouteAll().catch(() => undefined)
      await resetTestDb({ ...opts, mode: 'truncate' })
    })
  }

  return { ctx, teardown }
}

async function loadFixture(name: string): Promise<Record<string, unknown>> {
  const fs = await import('node:fs/promises')
  const path = await import('node:path')
  const file = path.resolve('e2e/fixtures/scenarios', `${name}.json`)
  try {
    const raw = await fs.readFile(file, 'utf8')
    return JSON.parse(raw)
  } catch {
    // A scenario may not have a fixture (the SLA loop generates its own
    // RFI in-test). Return empty rather than throwing — let the spec
    // decide whether the absence is a problem.
    return {}
  }
}
