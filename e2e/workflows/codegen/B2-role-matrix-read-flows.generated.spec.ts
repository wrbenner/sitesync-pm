/**
 * B.2 — Role × Read-flow matrix (generated).
 *
 * Companion to `B2-role-matrix-create-flows.generated.spec.ts` (iter 9).
 * Where that spec exercises the create-permission gate (heavily
 * role-dependent), this spec exercises the read-permission gate for the
 * same 5 entities. Read is intentionally permissive — anyone in the
 * project can see ongoing work — but a misconfigured route guard or RLS
 * policy that hides a list from a valid role is a real regression worth
 * catching.
 *
 * Coverage delta: +75 cells (15 roles × 5 read flows).
 *
 * --- Per-role credential convention (reused from iter 9) ---
 *
 * Same env-var keys as B2-role-matrix-create-flows:
 *   B2_USER_<ROLE_UPPER>
 *   B2_PASS_<ROLE_UPPER>
 *
 * Tests skip per-role when credentials are not provisioned.
 *
 * --- Expected outcomes (first pass) ---
 *
 * All 15 roles are expected to be able to READ the 5 list pages. This
 * follows the project's "field visibility" principle: every authenticated
 * role in a project can see ongoing RFIs, submittals, daily logs, punch
 * items, and change orders. Per-entity write/edit permissions vary widely
 * (see iter 9), but read access is broad.
 *
 * If `ops/coverage/permission-matrix.json.cells[*].expected` is later
 * populated and contradicts this assumption (e.g. owner_rep should NOT
 * see internal daily logs), update `EXPECTED_ALLOW` accordingly.
 *
 * --- Per-cell assertion semantics ---
 *
 * For each (role, flow) cell:
 *   1. Sign in with the role's credentials (skip if env unset).
 *   2. Navigate to the flow's list page.
 *   3. If expectedAllow=true: assert landed on the list path AND a
 *      page-level header / list affordance is present (proves the
 *      page rendered without a route-guard redirect).
 *   4. If expectedAllow=false: assert either (a) redirected away,
 *      (b) PermissionGate fallback, or (c) empty/inaccessible content.
 *
 * Skip semantics match iter 9 (E2E_REAL_BACKEND required; per-role
 * creds gate per-cell).
 */
import { test, expect, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const REAL_BACKEND = process.env.E2E_REAL_BACKEND === 'true'
const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:5173'

test.skip(!REAL_BACKEND, 'Stage-env only — set E2E_REAL_BACKEND=true')

interface MatrixCell {
  role: string
  entity: string
  action: string
  expected: boolean | null
  coverage_status: string
}
interface PermissionMatrix {
  roles: string[]
  cells: MatrixCell[]
}
const matrix = JSON.parse(
  readFileSync(resolve(__dirname, '../../../ops/coverage/permission-matrix.json'), 'utf-8'),
) as PermissionMatrix

const ROLES = matrix.roles

interface ReadFlow {
  key: 'rfi' | 'submittal' | 'daily_log' | 'punch_item' | 'change_order'
  listPath: string
  // A loose regex matching a page-level header or list affordance that
  // proves the list page rendered (vs being redirected to an error page).
  pageMarker: RegExp
}

const FLOWS: ReadFlow[] = [
  { key: 'rfi',           listPath: '/rfis',           pageMarker: /rfis?|requests? for information/i },
  { key: 'submittal',     listPath: '/submittals',     pageMarker: /submittals?/i },
  { key: 'daily_log',     listPath: '/daily-log',      pageMarker: /daily log|log entries?/i },
  { key: 'punch_item',    listPath: '/punch-list',     pageMarker: /punch (list|items?)/i },
  { key: 'change_order',  listPath: '/change-orders',  pageMarker: /change orders?|cos/i },
]

type FlowKey = ReadFlow['key']

// First-pass expectation: read is universally allowed for all 15 roles
// across all 5 list pages. See file-level docblock for rationale.
const EXPECTED_ALLOW: Record<string, Record<FlowKey, boolean>> = Object.fromEntries(
  ROLES.map((r) => [
    r,
    { rfi: true, submittal: true, daily_log: true, punch_item: true, change_order: true } as Record<FlowKey, boolean>,
  ]),
)

function envKeyForRole(role: string): { user: string; pass: string } {
  const slug = role.toUpperCase().replace(/[^A-Z0-9]+/g, '_')
  return { user: `B2_USER_${slug}`, pass: `B2_PASS_${slug}` }
}

async function signIn(page: Page, user: string, pass: string): Promise<void> {
  await page.goto(`${BASE_URL}/#/login`)
  await page.waitForTimeout(400)
  await page
    .getByRole('button', { name: /sign in with password/i })
    .first()
    .click()
    .catch(() => undefined)
  await page.waitForTimeout(200)
  await page.getByLabel('Email', { exact: true }).fill(user)
  await page.getByLabel('Password', { exact: true }).fill(pass)
  await page.getByLabel('Password', { exact: true }).press('Enter')
  await page.waitForURL(/#\/(dashboard|onboarding|profile|day|$)/, { timeout: 20_000 })
  await page.waitForTimeout(1_200)
}

test.describe('B.2 — Role × read-flow permission matrix (generated)', () => {
  for (const role of ROLES) {
    test.describe(`role: ${role}`, () => {
      for (const flow of FLOWS) {
        const expected = EXPECTED_ALLOW[role]?.[flow.key]
        const title = `${role} — ${flow.key} read (${expected === true ? 'allow' : expected === false ? 'deny' : 'unmapped'})`

        test(title, async ({ page }) => {
          test.skip(expected === undefined, `No expectation mapped for role=${role} flow=${flow.key} — refresh EXPECTED_ALLOW`)

          const { user: userVar, pass: passVar } = envKeyForRole(role)
          const user = process.env[userVar] ?? ''
          const pass = process.env[passVar] ?? ''
          test.skip(!user || !pass, `Credentials not provisioned: set ${userVar} and ${passVar} in CI`)

          await signIn(page, user, pass)
          await page.goto(`${BASE_URL}/#${flow.listPath}`)
          await page
            .waitForFunction(() => !/Loading…|Loading\.\.\./.test(document.body.textContent ?? ''), { timeout: 20_000 })
            .catch(() => undefined)
          await page.waitForTimeout(1_200)

          const currentHash = await page.evaluate(() => window.location.hash)
          const landedOnListPage = currentHash.startsWith(`#${flow.listPath}`)
          const bodyText = (await page.locator('body').innerText().catch(() => '')) ?? ''
          const pageMarkerVisible = flow.pageMarker.test(bodyText)
          const permissionGated = /access denied|not authorized|permission|insufficient|don'?t have access/i.test(bodyText)

          if (expected === true) {
            // Allow path: landed on the page AND a page-level marker
            // is visible AND no permission-gate fallback.
            expect(
              landedOnListPage,
              `expected role=${role} to reach ${flow.listPath} for read, but landed on ${currentHash}`,
            ).toBe(true)
            expect(
              permissionGated,
              `expected role=${role} to NOT see permission-gate text on ${flow.listPath} read`,
            ).toBe(false)
            expect(
              pageMarkerVisible,
              `expected role=${role} to see ${flow.key} list page marker (matching ${flow.pageMarker})`,
            ).toBe(true)
          } else {
            // Deny path (none under current EXPECTED_ALLOW, but kept
            // for forward-compat): one of three signals.
            const denied = !landedOnListPage || permissionGated || !pageMarkerVisible
            expect(
              denied,
              `expected role=${role} to be denied read for ${flow.key}: ` +
                `landedOnListPage=${landedOnListPage} permissionGated=${permissionGated} pageMarkerVisible=${pageMarkerVisible}`,
            ).toBe(true)
          }
        })
      }
    })
  }
})
