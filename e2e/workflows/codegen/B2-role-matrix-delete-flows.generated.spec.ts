/**
 * B.2 — Role × Delete-flow matrix (generated).
 *
 * Final member of the B.2 CRUD quad (iter 9 create, iter 10 read,
 * iter 11 update, iter 12 delete). 15 roles × 5 entity delete flows = 75 cells.
 *
 * Coverage delta: +75 cells. Completes B.2 CRUD = 300 cells total
 * across the 4 family members.
 *
 * --- Per-role credential convention (reused from iter 9-11) ---
 *
 * B2_USER_<ROLE_UPPER> / B2_PASS_<ROLE_UPPER>. Per-cell skip when creds
 * unset. Suite-level skip when E2E_REAL_BACKEND != true.
 *
 * --- Expected outcomes (first pass — DELETE is most restrictive) ---
 *
 * Deletion is irreversible and is typically restricted to top-level
 * roles. Operational entries (daily_log, punch_item) have softer delete
 * permissions for project managers/superintendents since these can be
 * mis-entered. Submittals, change_orders, and RFIs go through formal
 * lifecycles and shouldn't be hard-deleted by mid-tier roles.
 *
 *   - owner, project_executive, admin
 *       → allow delete all 5 (full admin)
 *   - project_manager, superintendent
 *       → allow daily_log, punch_item; deny rfi/submittal/change_order
 *         (formal-lifecycle entities don't get hard-deleted)
 *   - foreman, project_engineer, field_engineer, safety_manager
 *       → deny all 5 (can revise but not delete)
 *   - subcontractor, architect, owner_rep
 *       → deny all (external, no delete authority)
 *   - member, field_user, viewer
 *       → deny all (read-only or limited)
 *
 * --- Per-cell assertion ---
 *
 * Delete affordances are typically per-row (confirm-then-delete pattern)
 * or live behind a kebab/overflow menu. We use a permissive composite
 * check:
 *   - Allow: page has any element matching the delete-affordance regex
 *     visible (covers Delete button, "Remove", "Archive", trash icon
 *     buttons with text labels).
 *   - Deny: route-guard redirect, OR PermissionGate fallback, OR no
 *     delete-affordance visible.
 *
 * Same false-negative caveat as iter 11 (requires entities to exist in
 * the role's accessible set). Skip-per-role covers gracefully.
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

interface DeleteFlow {
  key: 'rfi' | 'submittal' | 'daily_log' | 'punch_item' | 'change_order'
  listPath: string
  // Composite delete-affordance regex. Includes archive/void which are
  // semantically "soft-delete" — same permission gate in practice.
  deleteAffordance: RegExp
}

const FLOWS: DeleteFlow[] = [
  { key: 'rfi',           listPath: '/rfis',           deleteAffordance: /delete|remove|archive|trash|void|withdraw/i },
  { key: 'submittal',     listPath: '/submittals',     deleteAffordance: /delete|remove|archive|trash|void|withdraw/i },
  { key: 'daily_log',     listPath: '/daily-log',      deleteAffordance: /delete|remove|archive|trash|void|discard/i },
  { key: 'punch_item',    listPath: '/punch-list',     deleteAffordance: /delete|remove|archive|trash|void|cancel/i },
  { key: 'change_order',  listPath: '/change-orders',  deleteAffordance: /delete|remove|archive|trash|void|withdraw|reject/i },
]

type FlowKey = DeleteFlow['key']

const EXPECTED_ALLOW: Record<string, Record<FlowKey, boolean>> = {
  owner:             { rfi: true,  submittal: true,  daily_log: true,  punch_item: true,  change_order: true  },
  project_executive: { rfi: true,  submittal: true,  daily_log: true,  punch_item: true,  change_order: true  },
  admin:             { rfi: true,  submittal: true,  daily_log: true,  punch_item: true,  change_order: true  },
  project_manager:   { rfi: false, submittal: false, daily_log: true,  punch_item: true,  change_order: false },
  superintendent:    { rfi: false, submittal: false, daily_log: true,  punch_item: true,  change_order: false },
  foreman:           { rfi: false, submittal: false, daily_log: false, punch_item: false, change_order: false },
  project_engineer:  { rfi: false, submittal: false, daily_log: false, punch_item: false, change_order: false },
  field_engineer:    { rfi: false, submittal: false, daily_log: false, punch_item: false, change_order: false },
  safety_manager:    { rfi: false, submittal: false, daily_log: false, punch_item: false, change_order: false },
  subcontractor:     { rfi: false, submittal: false, daily_log: false, punch_item: false, change_order: false },
  architect:         { rfi: false, submittal: false, daily_log: false, punch_item: false, change_order: false },
  owner_rep:         { rfi: false, submittal: false, daily_log: false, punch_item: false, change_order: false },
  member:            { rfi: false, submittal: false, daily_log: false, punch_item: false, change_order: false },
  field_user:        { rfi: false, submittal: false, daily_log: false, punch_item: false, change_order: false },
  viewer:            { rfi: false, submittal: false, daily_log: false, punch_item: false, change_order: false },
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

test.describe('B.2 — Role × delete-flow permission matrix (generated)', () => {
  for (const role of ROLES) {
    test.describe(`role: ${role}`, () => {
      for (const flow of FLOWS) {
        const expected = EXPECTED_ALLOW[role]?.[flow.key]
        const title = `${role} — ${flow.key} delete (${expected === true ? 'allow' : expected === false ? 'deny' : 'unmapped'})`

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
          const permissionGated = /access denied|not authorized|permission|insufficient|don'?t have access/i.test(bodyText)

          const affordanceLocator = page.getByRole('button', { name: flow.deleteAffordance })
          const affordanceCount = await affordanceLocator.count()
          const affordanceVisible = affordanceCount > 0
            ? await affordanceLocator.first().isVisible().catch(() => false)
            : false

          if (expected === true) {
            expect(
              landedOnListPage,
              `expected role=${role} to reach ${flow.listPath} for delete, but landed on ${currentHash}`,
            ).toBe(true)
            expect(
              permissionGated,
              `expected role=${role} to NOT see permission-gate text on ${flow.listPath}`,
            ).toBe(false)
            expect(
              affordanceVisible,
              `expected role=${role} to see ${flow.key} delete affordance matching ${flow.deleteAffordance} (affordanceCount=${affordanceCount})`,
            ).toBe(true)
          } else {
            const denied = !landedOnListPage || permissionGated || !affordanceVisible
            expect(
              denied,
              `expected role=${role} to be denied delete for ${flow.key}: ` +
                `landedOnListPage=${landedOnListPage} permissionGated=${permissionGated} affordanceVisible=${affordanceVisible}`,
            ).toBe(true)
          }
        })
      }
    })
  }
})
