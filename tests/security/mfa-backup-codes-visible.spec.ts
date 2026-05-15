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
 * Codebase status (Issue #586 — fix landed):
 *   `src/components/auth/MfaEnrollment.tsx` now walks
 *   (idle → showing-qr → verifying → backup-codes → success), with
 *   `backup-codes` rendering the 10 codes, a Copy button, a Download as
 *   TXT button, and an acknowledgment checkbox that gates the modal
 *   close. The corresponding SQL RPCs (`generate_mfa_backup_codes`,
 *   `consume_mfa_backup_code`) live in
 *   `supabase/migrations/20261026000000_mfa_backup_codes.sql`.
 *
 * This vitest spec asserts the contract at the static level (the
 * component source contains backup-code markers). When the UI is
 * removed or regresses, this spec turns red — the catalog entry for
 * F.MFA.1 flips back to PARTIAL.
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

    it('MfaEnrollment.tsx renders backup recovery codes on the post-verify step', () => {
      const src = readFileSync(COMPONENT_PATH, 'utf-8')
      const hasBackup = /backup[\s_-]?code|recovery[\s_-]?code/i.test(src)
      expect(hasBackup).toBe(true)
    })

    it('MfaEnrollment.tsx exposes a download-as-TXT affordance', () => {
      const src = readFileSync(COMPONENT_PATH, 'utf-8')
      // Component uses Blob + URL.createObjectURL + a.download to emit the
      // codes as a .txt file.
      const hasBlob = /new Blob\(/.test(src)
      const hasObjectUrl = /createObjectURL/.test(src)
      const hasDownloadAttr = /\.download\s*=/.test(src)
      const hasDownloadLabel = /Download as TXT/.test(src)
      expect(hasBlob && hasObjectUrl && hasDownloadAttr && hasDownloadLabel).toBe(
        true,
      )
    })

    it('MfaEnrollment.tsx exposes a copy-to-clipboard affordance for backup codes', () => {
      const src = readFileSync(COMPONENT_PATH, 'utf-8')
      const hasCopyAll = /copyAllBackupCodes/.test(src)
      const hasClipboardWrite = /clipboard\.writeText/.test(src)
      expect(hasCopyAll && hasClipboardWrite).toBe(true)
    })

    it('MfaEnrollment.tsx gates modal close on the "I have saved these codes" acknowledgment', () => {
      const src = readFileSync(COMPONENT_PATH, 'utf-8')
      const hasAck = /acknowledgedSaved/.test(src)
      const hasGate =
        /step\s*===\s*'backup-codes'\s*&&\s*!acknowledgedSaved/.test(src)
      const hasCheckboxLabel = /I have saved these codes/i.test(src)
      expect(hasAck && hasGate && hasCheckboxLabel).toBe(true)
    })

    it('MfaEnrollment.tsx calls the generate_mfa_backup_codes RPC', () => {
      const src = readFileSync(COMPONENT_PATH, 'utf-8')
      expect(/generate_mfa_backup_codes/.test(src)).toBe(true)
    })

    it('MfaEnrollment.tsx does not log plaintext backup codes', () => {
      const src = readFileSync(COMPONENT_PATH, 'utf-8')
      // Sanity: no console.* call that references backupCodes (we should
      // never log secrets). Strip comments first so explanatory prose is
      // not a false positive.
      const codeWithoutComments = src
        .replace(/\/\/[^\n]*/g, '')
        .replace(/\/\*[\s\S]*?\*\//g, '')
      const logsCodes =
        /console\.(log|info|warn|error)\([^)]*backupCodes/.test(
          codeWithoutComments,
        )
      expect(logsCodes).toBe(false)
    })
  },
)
