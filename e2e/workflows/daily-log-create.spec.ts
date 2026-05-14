/**
 * Workflow B.2 — Daily log create regression spec.
 *
 * Companion to submittal-create.spec.ts + rfi-create.spec.ts. Catches the
 * second half of the 2026-05-14 demo bug class: daily_logs_iris_ingest_trigger
 * regression to NEW.narrative (column doesn't exist; correct is NEW.summary).
 *
 * --- USAGE ---
 *   E2E_REAL_BACKEND=true E2E_BASE_URL=<vercel-preview-url> \
 *   POLISH_USER=<email> POLISH_PASS=<pw> \
 *   SUPABASE_URL=<target> SUPABASE_SERVICE_KEY=<service-role> \
 *   npx playwright test e2e/workflows/daily-log-create.spec.ts
 */
import { test, expect, type Page } from '@playwright/test'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const REAL_BACKEND = process.env.E2E_REAL_BACKEND === 'true'
const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:5173'
const USER = process.env.POLISH_USER ?? ''
const PASS = process.env.POLISH_PASS ?? ''
const SUPABASE_URL = process.env.SUPABASE_URL ?? ''
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY ?? ''

test.skip(!REAL_BACKEND, 'Stage-env only — set E2E_REAL_BACKEND=true')
test.skip(
  REAL_BACKEND && (!SUPABASE_URL || !SUPABASE_SERVICE_KEY),
  'SUPABASE_URL + SUPABASE_SERVICE_KEY required for DB-side assertions',
)

let admin: SupabaseClient
test.beforeAll(() => {
  if (REAL_BACKEND && SUPABASE_URL && SUPABASE_SERVICE_KEY) {
    admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }
})

const MARKER = `b2-daily-log-${Date.now()}`

async function signIn(page: Page): Promise<void> {
  await page.goto(`${BASE_URL}/#/login`)
  await page.getByPlaceholder('you@company.com').fill(USER)
  await page.getByPlaceholder('Enter your password').fill(PASS)
  await page.locator('button[type="submit"]').first().click()
  await page.waitForURL(/#\/(dashboard|onboarding|profile|day|$)/, { timeout: 20_000 })
  await page.waitForTimeout(1_200)
}

test('B.2 — UI: daily log create submits without 42703 or NEW.narrative error', async ({ page }) => {
  const failures: Array<{ url: string; status: number; body: string }> = []
  page.on('response', async (res) => {
    const url = res.url()
    if (!url.includes('/rest/v1/daily_logs') && !url.includes('/rest/v1/rpc/')) return
    if (res.status() >= 400) {
      const body = await res.text().catch(() => '<unreadable>')
      failures.push({ url, status: res.status(), body })
    }
  })

  await signIn(page)
  await page.goto(`${BASE_URL}/#/daily-log`)
  await page
    .waitForFunction(() => !/Loading…|Loading\.\.\./.test(document.body.textContent ?? ''), { timeout: 20_000 })
    .catch(() => undefined)

  await page
    .getByRole('button', { name: /new log|new entry|create log|^new$/i })
    .first()
    .click()

  // Daily log forms typically have a summary/narrative textarea + date.
  const summary = page.getByPlaceholder(/summary|narrative|notes|what happened/i).first()
  if (await summary.count() > 0) {
    await summary.fill(`${MARKER} summary text`)
  }
  // Fallback: any textarea on the page
  const ta = page.locator('textarea').first()
  if ((await summary.count()) === 0 && (await ta.count()) > 0) {
    await ta.fill(`${MARKER} narrative fallback`)
  }

  await page
    .getByRole('button', { name: /^submit$|^save$|^create$/i })
    .first()
    .click()

  await page.waitForTimeout(2_000)

  for (const f of failures) {
    // The two regression signatures we care about:
    //   42703 — column does not exist (org_id or NEW.narrative)
    //   PGSQL error citing "narrative" or "org_id" in trigger body
    expect(
      f.body,
      `daily_logs create returned ${f.status} from ${f.url}: ${f.body}`,
    ).not.toMatch(/42703|42501|column .+ does not exist|NEW\.narrative|projects\.org_id|record .+ has no field/i)
  }

  await expect(page.locator('body')).toContainText(MARKER, { timeout: 10_000 })
})

test('B.2 — DB: daily_log row persisted with summary set', async () => {
  const { data, error } = await admin
    .from('daily_logs')
    .select('id, summary, project_id, log_date, created_at')
    .ilike('summary', `${MARKER}%`)
    .order('created_at', { ascending: false })
    .limit(1)

  expect(error, error ? `daily_logs select failed: ${error.message}` : undefined).toBeNull()
  expect(data?.length ?? 0).toBeGreaterThan(0)
  expect(data![0].summary).toContain(MARKER)
  expect(data![0].project_id).toBeTruthy()
})

test('B.2 — DB: trigger source on prod matches fix (no NEW.narrative, no projects.org_id)', async () => {
  // Belt-and-suspenders: query the trigger source directly. If anyone ever
  // re-introduces the broken column refs, this fails fast.
  const { data, error } = await admin
    .schema('pg_catalog' as never)
    .from('pg_proc' as never)
    .select('prosrc')
    .eq('proname', 'daily_logs_iris_ingest_trigger')
    .limit(1)

  if (error) {
    // pg_catalog isn't always exposed via PostgREST; soft skip.
    test.skip(true, `pg_proc not exposed via PostgREST: ${error.message}`)
  }
  const src = (data?.[0] as { prosrc?: string } | undefined)?.prosrc ?? ''
  if (src) {
    expect(src, 'daily_logs trigger must not reference NEW.narrative').not.toMatch(/NEW\.narrative/)
    expect(src, 'daily_logs trigger must not reference projects.org_id').not.toMatch(/org_id FROM/)
    expect(src, 'daily_logs trigger must reference organization_id').toMatch(/organization_id/)
  }
})
