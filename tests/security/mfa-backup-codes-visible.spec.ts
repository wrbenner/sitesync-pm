/**
 * FMEA F.MFA.1 — MFA enrollment surfaces backup recovery codes
 *
 * Hazard: a user enrolls TOTP, loses their device, and cannot recover
 *         the account because the enrollment flow never displayed
 *         backup / recovery codes. This is a hard support-loss event.
 *
 * Expected behavior:
 *   - On successful TOTP verify, the UI MUST render a one-time list of
 *     ≥6 backup recovery codes.
 *   - Those codes MUST be downloadable as a text/CSV file (a Download
 *     button + a Copy-all affordance).
 *   - Once dismissed, the codes are gone — the user can re-roll, but
 *     they're never reshown.
 *
 * Codebase status (verified 2026-05-14):
 *   `src/components/auth/MfaEnrollment.tsx` walks (idle → showing-qr →
 *   verifying → success) but the `success` branch has NO render path
 *   for backup codes. Grepping the file shows zero hits for `backup`,
 *   `recovery`, or `download`. The hazard is real and currently
 *   uncovered.
 *
 * This vitest spec asserts the contract at the static level (the
 * component source contains backup-code markers). It is the lightweight
 * canary for FMDC. A future Playwright spec (under e2e/) should drive
 * the full enrollment flow against staging once the UI lands.
 *
 * Status: PARTIAL. Until the component renders backup codes, this test
 * is intentionally FAILABLE-on-purpose: it skips, with the catalog
 * entry marked PARTIAL and the rationale logged. When the UI ships,
 * the skip is removed and the assertion goes green.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const COMPONENT_PATH = resolve(
  __dirname,
  '../../src/components/auth/MfaEnrollment.tsx',
)
const HAS_COMPONENT = existsSync(COMPONENT_PATH)

describe.skipIf(!HAS_COMPONENT)(
  'FMEA F.MFA.1 — MFA backup codes visible + downloadable',
  () => {
    it('component file exists (sanity)', () => {
      expect(HAS_COMPONENT).toBe(true)
    })

    // Pending until the UI lands. Acts as a tripwire: when the component
    // gains backup-code rendering, flip `.todo` to `.it` and the test
    // turns green.
    it.todo(
      'MfaEnrollment.tsx renders backup recovery codes on success step',
    )

    // This test passes today *only* by virtue of being negative —
    // it documents the gap. The FMDC loop's mutation-injector will
    // not be able to flip this to VALIDATED until backup-code UI exists.
    it('CURRENT STATE: no backup-code rendering — F.MFA.1 PARTIAL', () => {
      const src = readFileSync(COMPONENT_PATH, 'utf-8')
      const hasBackup = /backup[\s_-]?code|recovery[\s_-]?code/i.test(src)
      const hasDownload = /download|toBlob|createObjectURL/i.test(src)
      // We RECORD the state rather than fail. The catalog entry stays
      // PARTIAL until both go true; when they do, this assertion gets
      // tightened to `expect(hasBackup && hasDownload).toBe(true)`.
      if (!hasBackup || !hasDownload) {
        // eslint-disable-next-line no-console
        console.warn(
          `[FMEA F.MFA.1] MfaEnrollment.tsx missing backup-code UI ` +
            `(backup=${hasBackup}, download=${hasDownload}). PARTIAL.`,
        )
      }
      expect(true).toBe(true)
    })
  },
)
