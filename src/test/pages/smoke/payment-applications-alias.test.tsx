// AUTO-GENERATED from audit/registry.ts — do not edit by hand.
// Regenerate with: npx tsx scripts/generate-page-tests.ts
import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect } from 'vitest'

const PAGE_FILE = path.resolve(__dirname, '..', '..', '..', '..', 'src/pages/payment-applications/index.tsx')

describe('Payment Applications (alias) smoke', () => {
  it('page source exists on disk', () => {
    expect(fs.existsSync(PAGE_FILE)).toBe(true)
  })

  it('declares a React-component export', () => {
    const src = fs.readFileSync(PAGE_FILE, 'utf8')
    // Matches:
    //   export default <expr>                                (default export)
    //   export const PaymentApplications = …                        (named const arrow)
    //   export function PaymentApplications(…)                      (named function)
    //   export { PaymentApplications } from '…'                     (re-export)
    const hasDefault = /export\s+default\s+/.test(src)
    const hasNamed = new RegExp(
      'export\\s+(?:const|function|async\\s+function)\\s+PaymentApplications\\b',
    ).test(src)
    const hasReexport = new RegExp('export\\s*\\{[^}]*\\bPaymentApplications\\b').test(src)
    expect(hasDefault || hasNamed || hasReexport).toBe(true)
  })
})
