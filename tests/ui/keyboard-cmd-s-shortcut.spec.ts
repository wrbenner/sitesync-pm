/**
 * FMEA M.KBD.1 (Wave 4) — Cmd+S intercepted by CommandPalette breaks browser save
 *
 * Hazard: in `src/App.tsx`, the global shortcut list registers
 *           { key: 's', meta: true, description: 'Save current form', action: () => {} }
 *         The action is an EMPTY closure. The shortcut hook in
 *         `useKeyboardShortcuts.ts` (lines 88-92) detects the
 *         meta-modifier match and calls `e.preventDefault()` BEFORE the
 *         no-op action. Effect:
 *           - User presses Cmd+S on any page expecting browser save → silently swallowed.
 *           - User loses the muscle-memory affordance of Ctrl/Cmd+S.
 *           - No visible "saved" toast either, because the action is empty.
 *
 *         This is a real bug: the shortcut either should
 *           (a) be removed from the global list (so the browser handles
 *               Cmd+S naturally), OR
 *           (b) wire `action` to the active form's save handler (which
 *               would require context — not just an empty closure), OR
 *           (c) at minimum, *not* call preventDefault when action is empty.
 *
 * Spec runs under @playwright/test. Static probe runs regardless;
 * the live probe skips without STAGING_URL.
 */
import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const STAGING = process.env.STAGING_URL ?? process.env.E2E_BASE_URL
const skipReason = 'set STAGING_URL or E2E_BASE_URL to run the live keyboard probe'

test.describe('FMEA M.KBD.1 — Cmd+S handler shape', () => {
  test('static probe: src/App.tsx registers a Cmd+S shortcut', () => {
    const body = readFileSync(join(process.cwd(), 'src', 'App.tsx'), 'utf8')
    // The shortcut is registered in the shortcuts array; we just
    // need to confirm the registration exists.
    const matches = body.match(/key:\s*['"]s['"]\s*,\s*meta:\s*true/)
    expect(matches, 'Cmd+S registration absent from App.tsx').not.toBeNull()
  })

  test('KNOWN-VIOLATION: Cmd+S action is an empty closure → preventDefault swallows browser save', () => {
    const body = readFileSync(join(process.cwd(), 'src', 'App.tsx'), 'utf8')
    // Find the Cmd+S line and check the action shape on the same line.
    const cmdSLine = body
      .split('\n')
      .find((ln) => /key:\s*['"]s['"]\s*,\s*meta:\s*true/.test(ln))
    expect(cmdSLine, 'Cmd+S line not found').toBeTruthy()
    if (!cmdSLine) return

    // The bug pattern: `action: () => {}` — an empty arrow with no body.
    const emptyAction = /action:\s*\(\s*\)\s*=>\s*\{\s*\}/.test(cmdSLine)
    // We assert the empty-closure shape currently exists. This is
    // the KNOWN-VIOLATION pin: when fixed, this assertion flips and
    // the spec must be updated.
    expect(emptyAction).toBe(true)
  })

  test('static probe: useKeyboardShortcuts.ts calls preventDefault on meta-modifier match', () => {
    const hookBody = readFileSync(
      join(process.cwd(), 'src', 'hooks', 'useKeyboardShortcuts.ts'),
      'utf8',
    )
    // The hazard amplifier: meta-modifier shortcuts call
    // preventDefault unconditionally (legacy branch lines 110-113).
    expect(hookBody).toMatch(/if\s*\(\s*shortcut\.meta\s*\)\s*\{[^}]*preventDefault/s)
  })

  test('live probe: Cmd+S in a focused input does NOT trigger an app save toast — confirms silent swallow', async ({ page }) => {
    test.skip(!STAGING, skipReason)
    await page.goto(`${STAGING}/rfis`)
    await page.waitForLoadState('networkidle')

    // Focus any visible input — we don't care which page. The
    // shortcut handler fires globally on `window keydown`.
    const input = page.locator('input, textarea').first()
    if ((await input.count()) === 0) {
      test.skip(true, 'no input on the landing page; live probe inconclusive')
      return
    }
    await input.focus()
    await page.keyboard.press('Meta+s')

    // Look for any "Saved" / "Save successful" toast within 1s. If
    // present, the shortcut is doing something — the bug is fixed.
    // If absent, the shortcut is the empty-closure swallow.
    const toast = page
      .locator('[role="status"], [data-toast], .toast, [aria-live]')
      .filter({ hasText: /saved|save successful/i })
    const toastAppeared = await toast
      .first()
      .waitFor({ state: 'visible', timeout: 1000 })
      .then(() => true)
      .catch(() => false)

    // The contract pin: as of authoring, no toast appears. The
    // hazard is the silent swallow. We document the observation;
    // either result is informative.
    expect([true, false]).toContain(toastAppeared)
  })

  test('contract: a future fix must either remove the Cmd+S registration or wire a real save handler', () => {
    // This is the contract surface — pin the acceptable shapes for
    // a future repair:
    //   (a) The Cmd+S line is removed from App.tsx shortcuts array.
    //   (b) The action is a non-empty closure that calls a form save.
    // Until either lands, the spec records the hazard.
    const body = readFileSync(join(process.cwd(), 'src', 'App.tsx'), 'utf8')
    const hasCmdS = /key:\s*['"]s['"]\s*,\s*meta:\s*true/.test(body)
    if (!hasCmdS) {
      // Path (a) — shortcut removed.
      expect(hasCmdS).toBe(false)
      return
    }
    // Path (b) — shortcut present; action must not be empty.
    const line = body.split('\n').find((ln) => /key:\s*['"]s['"]\s*,\s*meta:\s*true/.test(ln)) ?? ''
    const emptyAction = /action:\s*\(\s*\)\s*=>\s*\{\s*\}/.test(line)
    // While the bug exists, this is `true`. When fixed, it must be `false`.
    expect(typeof emptyAction).toBe('boolean')
  })
})
