/**
 * E2E: MFA enrollment shows downloadable backup recovery codes.
 *
 * Issue #586 — landed UI + RPCs land in this same PR. The static-source
 * canary at tests/security/mfa-backup-codes-visible.spec.ts covers the
 * component shape today; this Playwright spec covers the full flow.
 *
 * Currently skipped: requires a seeded MFA-test user in staging (a user
 * we can deterministically log in as, who has no TOTP factor yet, plus
 * a known TOTP secret we can compute the 6-digit code from). That
 * fixture lands in a follow-up — see Issue #587 (filed alongside this
 * PR). When the fixture is ready, flip `test.skip` to `test`.
 */
import { test, expect } from '@playwright/test'

test.skip('MFA enrollment surfaces and downloads backup recovery codes', async ({
  page,
}) => {
  await page.goto('/profile')

  // 1. Click "Enable two-factor authentication"
  await page.getByRole('button', { name: /Enable two-factor authentication/i }).click()

  // 2. Modal opens with QR; enter a known TOTP code (from fixture secret).
  await page.getByLabel(/Verification code/i).fill(process.env.MFA_TEST_TOTP_CODE ?? '000000')
  await page.getByRole('button', { name: /Verify and enable/i }).click()

  // 3. Backup-codes step appears.
  await expect(page.getByTestId('mfa-backup-codes')).toBeVisible()
  await expect(page.getByText(/These backup recovery codes will only be shown once/i)).toBeVisible()

  // 4. Exactly 10 codes rendered.
  const codeCells = page.getByTestId('mfa-backup-codes').locator('code')
  await expect(codeCells).toHaveCount(10)

  // 5. Done button is disabled until acknowledgment checkbox is ticked.
  const doneBtn = page.getByRole('button', { name: /^Done$/ })
  await expect(doneBtn).toBeDisabled()

  // 6. Download triggers a file with codes.
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: /Download as TXT/i }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/sitesync-mfa-backup-codes-/)

  // 7. Check the box → Done enables → modal closes.
  await page.getByLabel(/I have saved these codes/i).check()
  await expect(doneBtn).toBeEnabled()
  await doneBtn.click()
  await expect(page.getByTestId('mfa-backup-codes')).toBeHidden()
})
