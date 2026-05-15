/**
 * B.2 — Role × Update-flow matrix (generated).
 *
 * Third member of the B.2 role-matrix family (iter 9 = create, iter 10 =
 * read). Exercises the edit/update permission gate for the same 5
 * entities across all 15 roles = 75 cells.
 *
 * Coverage delta: +75 cells.
 *
 * --- Per-role credential convention (reused from iter 9/10) ---
 *
 * B2_USER_<ROLE_UPPER> / B2_PASS_<ROLE_UPPER>. Per-cell skip when creds
 * unset. Suite-level skip when E2E_REAL_BACKEND != true.
 *
 * --- Expected outcomes (first pass) ---
 *
 * Update is more permissive than create — the people who can create can
 * also edit their own entries; some additional read-write roles can edit
 * but not create.
 *
 *   - owner, project_executive, admin, project_manager, superintendent
 *       → allow update all 5 (full management)
 *   - foreman, project_engineer, field_engineer
 *       → allow rfi, daily_log, punch_item; deny submittal, change_order
 *         (matches create perms)
 *   - safety_manager
 *       → allow daily_log, punch_item; deny rest
 *   - subcontractor, architect, owner_rep
 *       → allow rfi (their own responses); deny rest
 *   - member, field_user, viewer
 *       → deny all 5 (read-only)
 *
 * --- Per-cell assertion ---
 *
 * Update assertions are weaker than create's because update affordances
 * are typically per-row (require entities to exist) rather than page-
 * level. We use a permissive composite check:
 *   - Allow: page has any element matching the edit-affordance regex
 *     visible somewhere — covers per-row Edit buttons, kebab menus,
 *     header-level "Settings" / "Manage" links.
 *   - Deny: route-guard redirect away, OR PermissionGate fallback, OR
 *     no edit-affordance visible.
 *
 * False-negatives are possible if the role's account has no entities to
 * edit on the list. The skip-per-role convention covers that gracefully:
 * CI will land per-role provisioning that includes seed data when ready.
 *
 * Skip semantics identical to iter 9/10.
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

interface UpdateFlow {
  key: 'rfi' | 'submittal' | 'daily_log' | 'punch_item' | 'change_order'
  listPath: string
  // Composite edit-affordance regex matched against visible button/menu
  // accessible names. Kept generic to survive UI churn.
  editAffordance: RegExp
}

const FLOWS: UpdateFlow[] = [
  { key: 'rfi',           listPath: '/rfis',           editAffordance: /edit|update|modify|⋮|menu|actions?|manage/i },
  { key: 'submittal',     listPath: '/submittals',     editAffordance: /edit|update|modify|⋮|menu|actions?|manage/i },
  { key: 'daily_log',     listPath: '/daily-log',      editAffordance: /edit|update|modify|⋮|menu|actions?|manage|revise/i },
  { key: 'punch_item',    listPath: '/punch-list',     editAffordance: /edit|update|modify|⋮|menu|actions?|manage|resolve|reopen/i },
  { key: 'change_order',  listPath: '/change-orders',  editAffordance: /edit|update|modify|⋮|menu|actions?|manage|approve|reject/i },
]

type FlowKey = UpdateFlow['key']

const EXPECTED_ALLOW: Record<string, Record<FlowKey, boolean>> = {
  owner:             { rfi: true,  submittal: true,  daily_log: true,  punch_item: true,  change_order: true  },
  project_executive: { rfi: true,  submittal: true,  daily_log: true,  punch_item: true,  change_order: true  },
  admin:             { rfi: true,  submittal: true,  daily_log: true,  punch_item: true,  change_order: true  },
  project_manager:   { rfi: true,  submittal: true,  daily_log: true,  punch_item: true,  change_order: true  },
  superintendent:    { rfi: true,  submittal: true,  daily_log: true,  punch_item: true,  change_order: true  },
  foreman:           { rfi: true,  submittal: false, daily_log: true,  punch_item: true,  change_order: false },
  project_engineer:  { rfi: true,  submittal: false, daily_log: true,  punch_item: true,  change_order: false },
  field_engineer:    { rfi: true,  submittal: false, daily_log: true,  punch_item: true,  change_order: false },
  safety_manager:    { rfi: false, submittal: false, daily_log: true,  punch_item: true,  change_order: false },
  subcontractor:     { rfi: true,  submittal: false, daily_log: false, punch_item: false, change_order: false },
  architect:         { rfi: true,  submittal: false, daily_log: false, punch_item: false, change_order: false },
  owner_rep:         { rfi: true,  submittal: false, daily_log: false, punch_item: false, change_order: false },
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

test.describe('B.2 — Role × update-flow permission matrix (generated)', () => {
  for (const role of ROLES) {
    test.describe(`role: ${role}`, () => {
      for (const flow of FLOWS) {
        const expected = EXPECTED_ALLOW[role]?.[flow.key]
        const title = `${role} — ${flow.key} update (${expected === true ? 'allow' : expected === false ? 'deny' : 'unmapped'})`

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

          // Search for any visible button/menu whose accessible name matches.
          const affordanceLocator = page.getByRole('button', { name: flow.editAffordance })
          const affordanceCount = await affordanceLocator.count()
          const affordanceVisible = affordanceCount > 0
            ? await affordanceLocator.first().isVisible().catch(() => false)
            : false

          if (expected === true) {
            expect(
              landedOnListPage,
              `expected role=${role} to reach ${flow.listPath} for update, but landed on ${currentHash}`,
            ).toBe(true)
            expect(
              permissionGated,
              `expected role=${role} to NOT see permission-gate text on ${flow.listPath}`,
            ).toBe(false)
            expect(
              affordanceVisible,
              `expected role=${role} to see ${flow.key} edit affordance matching ${flow.editAffordance} (affordanceCount=${affordanceCount})`,
            ).toBe(true)
          } else {
            const denied = !landedOnListPage || permissionGated || !affordanceVisible
            expect(
              denied,
              `expected role=${role} to be denied update for ${flow.key}: ` +
                `landedOnListPage=${landedOnListPage} permissionGated=${permissionGated} affordanceVisible=${affordanceVisible}`,
            ).toBe(true)
          }
        })
      }
    })
  }
})
