/**
 * B.2 — Role × Create-flow matrix (generated).
 *
 * Parametric counterpart to the four hand-written create specs in
 * `e2e/workflows/{rfi,submittal,daily-log,punch-item,change-order}-create.spec.ts`.
 * Where those specs cover a single privileged user provisioning each
 * entity end-to-end, this spec exercises the *role permission gate*
 * for all 15 roles in `ops/coverage/permission-matrix.json` across the
 * same 5 create flows = 75 cells.
 *
 * Coverage delta: +75 cells (15 roles × 5 create flows).
 *
 * --- Per-role credential convention (env vars) ---
 *
 * Each role expects two env vars, named after the role in upper-snake-case:
 *   B2_USER_<ROLE_UPPER>
 *   B2_PASS_<ROLE_UPPER>
 *
 * Examples:
 *   B2_USER_OWNER, B2_PASS_OWNER
 *   B2_USER_PROJECT_MANAGER, B2_PASS_PROJECT_MANAGER
 *   B2_USER_VIEWER, B2_PASS_VIEWER
 *
 * Tests skip if either env var is unset for the role under test. This
 * lets CI provision per-role staging users incrementally — when a role's
 * user lands, its 5 cells start running automatically.
 *
 * --- Expected outcomes (hardcoded matrix) ---
 *
 * These expectations are a *first pass* based on the role hierarchy
 * documented in `src/permissions/` and AGENTS.md. They are subject to
 * refinement when `ops/coverage/permission-matrix.json.cells[*].expected`
 * gets populated by the canonical permission source-of-truth audit
 * (tracked as B.2 follow-up).
 *
 * Mapping summary:
 *   - owner, project_executive, admin, project_manager, superintendent
 *       → allow all 5 (privileged management roles)
 *   - foreman, project_engineer, field_engineer
 *       → allow rfi, daily_log, punch_item; deny submittal, change_order
 *         (field-facing roles can raise field issues; not contracts/money)
 *   - safety_manager
 *       → allow daily_log, punch_item; deny rest (safety-only scope)
 *   - subcontractor, architect, owner_rep
 *       → allow rfi only; deny rest (external stakeholders, narrow scope)
 *   - member, field_user, viewer
 *       → deny all 5 (no create permissions)
 *
 * --- Per-cell assertion semantics ---
 *
 * For each (role, flow) cell:
 *   1. Sign in with the role's credentials (skip if env unset).
 *   2. Navigate to the flow's list page (e.g. /rfis).
 *   3. If expectedAllow=true: assert the create-trigger button is
 *      reachable (visible+enabled) — uses data-testid first, falls back
 *      to a loose role/name selector to survive UI churn.
 *   4. If expectedAllow=false: assert that *either* (a) the page
 *      redirected away (route guard), (b) PermissionGate fallback
 *      is rendered, or (c) the create-trigger button is not visible.
 *
 * Skip semantics match `tests/visual/codegen/B10-visual-multi-viewport.generated.spec.ts`:
 * the whole suite skips unless `E2E_REAL_BACKEND=true`, and individual
 * cells skip when their role's credentials are not provisioned in CI.
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

// Defensive: pin to the 15 roles we expect. If the matrix grows, the
// `for` loop below picks up the additions, but the expectedAllow map will
// not have an entry → those new cells will be skipped with a clear note.
const ROLES = matrix.roles

interface CreateFlow {
  key: 'rfi' | 'submittal' | 'daily_log' | 'punch_item' | 'change_order'
  listPath: string
  // Loose name regex for the create-trigger button. Kept generic to
  // survive copy tweaks (Create / New / Add / + Add).
  createButtonName: RegExp
  // Preferred testid for the create-trigger button. If present in DOM
  // we use it; otherwise fall back to createButtonName.
  createButtonTestId?: string
}

const FLOWS: CreateFlow[] = [
  {
    key: 'rfi',
    listPath: '/rfis',
    createButtonName: /(create|new|add).*rfi|new rfi|create rfi/i,
    createButtonTestId: 'create-rfi-button',
  },
  {
    key: 'submittal',
    listPath: '/submittals',
    createButtonName: /(create|new|add).*submittal|new submittal|create submittal/i,
    createButtonTestId: 'create-submittal-button',
  },
  {
    key: 'daily_log',
    listPath: '/daily-log',
    createButtonName: /(create|new|add).*(daily log|log|entry)|new daily log/i,
    createButtonTestId: 'create-daily-log-button',
  },
  {
    key: 'punch_item',
    listPath: '/punch-list',
    createButtonName: /(create|new|add).*(punch|item)|new punch/i,
    createButtonTestId: 'create-punch-item-button',
  },
  {
    key: 'change_order',
    listPath: '/change-orders',
    createButtonName: /(create|new|add).*(change order|co)|new change order/i,
    createButtonTestId: 'create-change-order-button',
  },
]

type FlowKey = CreateFlow['key']

/**
 * First-pass expected matrix. See file-level docblock for derivation.
 * Once `permission-matrix.json.cells[*].expected` is populated by the
 * canonical permission audit, this map can be replaced by a lookup
 * against `matrix.cells` filtered by action='create'.
 */
const EXPECTED_ALLOW: Record<string, Record<FlowKey, boolean>> = {
  owner: { rfi: true, submittal: true, daily_log: true, punch_item: true, change_order: true },
  project_executive: { rfi: true, submittal: true, daily_log: true, punch_item: true, change_order: true },
  admin: { rfi: true, submittal: true, daily_log: true, punch_item: true, change_order: true },
  project_manager: { rfi: true, submittal: true, daily_log: true, punch_item: true, change_order: true },
  superintendent: { rfi: true, submittal: true, daily_log: true, punch_item: true, change_order: true },
  foreman: { rfi: true, submittal: false, daily_log: true, punch_item: true, change_order: false },
  project_engineer: { rfi: true, submittal: false, daily_log: true, punch_item: true, change_order: false },
  field_engineer: { rfi: true, submittal: false, daily_log: true, punch_item: true, change_order: false },
  safety_manager: { rfi: false, submittal: false, daily_log: true, punch_item: true, change_order: false },
  subcontractor: { rfi: true, submittal: false, daily_log: false, punch_item: false, change_order: false },
  architect: { rfi: true, submittal: false, daily_log: false, punch_item: false, change_order: false },
  owner_rep: { rfi: true, submittal: false, daily_log: false, punch_item: false, change_order: false },
  member: { rfi: false, submittal: false, daily_log: false, punch_item: false, change_order: false },
  field_user: { rfi: false, submittal: false, daily_log: false, punch_item: false, change_order: false },
  viewer: { rfi: false, submittal: false, daily_log: false, punch_item: false, change_order: false },
}

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

async function findCreateButton(page: Page, flow: CreateFlow) {
  // Prefer the testid path (matches the hand-written B.2 specs convention).
  if (flow.createButtonTestId) {
    const byTestId = page.getByTestId(flow.createButtonTestId)
    if (await byTestId.count() > 0) return byTestId.first()
  }
  // Fallback: any button whose accessible name matches.
  return page.getByRole('button', { name: flow.createButtonName }).first()
}

test.describe('B.2 — Role × create-flow permission matrix (generated)', () => {
  for (const role of ROLES) {
    test.describe(`role: ${role}`, () => {
      for (const flow of FLOWS) {
        const expected = EXPECTED_ALLOW[role]?.[flow.key]
        const title = `${role} — ${flow.key} create (${expected === true ? 'allow' : expected === false ? 'deny' : 'unmapped'})`

        test(title, async ({ page }) => {
          // Cells with no expectation in EXPECTED_ALLOW (e.g. roles
          // added to the matrix after this file was generated) skip
          // with a clear note rather than passing trivially.
          test.skip(expected === undefined, `No expectation mapped for role=${role} flow=${flow.key} — refresh EXPECTED_ALLOW`)

          const { user: userVar, pass: passVar } = envKeyForRole(role)
          const user = process.env[userVar] ?? ''
          const pass = process.env[passVar] ?? ''
          test.skip(!user || !pass, `Credentials not provisioned: set ${userVar} and ${passVar} in CI`)

          await signIn(page, user, pass)

          // Capture pre-navigation URL so we can detect a redirect-deny.
          await page.goto(`${BASE_URL}/#${flow.listPath}`)
          await page
            .waitForFunction(() => !/Loading…|Loading\.\.\./.test(document.body.textContent ?? ''), { timeout: 20_000 })
            .catch(() => undefined)
          // Settle SPA route guards.
          await page.waitForTimeout(1_200)

          const currentHash = await page.evaluate(() => window.location.hash)
          const landedOnListPage = currentHash.startsWith(`#${flow.listPath}`)

          if (expected === true) {
            // Allow path: must have landed on the list page AND the
            // create-trigger button must be reachable.
            expect(landedOnListPage, `expected role=${role} to reach ${flow.listPath} for create, but landed on ${currentHash}`).toBe(true)

            const createBtn = await findCreateButton(page, flow)
            const count = await createBtn.count()
            expect(count, `expected create-trigger for ${flow.key} to be present for ${role}`).toBeGreaterThan(0)
            await expect(createBtn).toBeVisible({ timeout: 10_000 })
            await expect(createBtn).toBeEnabled({ timeout: 10_000 })
          } else {
            // Deny path: one of three acceptable signals.
            //   (a) Route guard redirected us away from the list page.
            //   (b) PermissionGate fallback rendered (text match).
            //   (c) Create-trigger button is not visible on the page.
            const bodyText = (await page.locator('body').innerText().catch(() => '')) ?? ''
            const permissionGated = /access denied|not authorized|permission|insufficient|don'?t have access/i.test(bodyText)
            const createBtn = await findCreateButton(page, flow)
            const btnCount = await createBtn.count()
            const btnVisible = btnCount > 0 ? await createBtn.isVisible().catch(() => false) : false

            const denied = !landedOnListPage || permissionGated || !btnVisible
            expect(
              denied,
              `expected role=${role} to be denied create for ${flow.key}: ` +
                `landedOnListPage=${landedOnListPage} permissionGated=${permissionGated} createBtnVisible=${btnVisible}`,
            ).toBe(true)
          }
        })
      }
    })
  }
})
