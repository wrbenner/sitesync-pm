/**
 * FMEA M.KBD.2 (Wave 4) — "/" in text input opens global search
 *
 * Hazard: many apps register "/" as a global "open search" hotkey
 *         (Slack, GitHub, Vercel dashboard). If the keyboard hook does
 *         not gate non-meta shortcuts behind an `isTyping` check, the
 *         user can never type a literal "/" inside a text input —
 *         they instead trigger the global search dialog and lose their
 *         in-progress text.
 *
 *         The mitigation in `useKeyboardShortcuts.ts` (line 41-50,
 *         98-102) is the `isTyping` guard: when the keydown target is
 *         an INPUT, TEXTAREA, or contentEditable element, non-meta
 *         shortcuts bail. Sequential chord shortcuts (lines 47-49) also
 *         bail in `isTyping`.
 *
 *         The codebase audit (Wave-4 inventory) found NO bare-`/`
 *         shortcut registered anywhere — Cmd+/ is registered as a
 *         meta-modifier chord for the shortcuts help dialog (line 680
 *         of App.tsx). So a bare-`/` keypress in an input passes
 *         through naturally.
 *
 *         This spec pins the contract:
 *           (1) No bare-`/` (non-meta) shortcut is registered.
 *           (2) The hook's isTyping guard exists and bails for non-meta
 *               single-key shortcuts.
 *           (3) Live: pressing `/` inside an input inserts the literal
 *               character.
 */
import { test, expect } from '@playwright/test'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const STAGING = process.env.STAGING_URL ?? process.env.E2E_BASE_URL
const skipReason = 'set STAGING_URL or E2E_BASE_URL to run the live `/` keyboard probe'

test.describe('FMEA M.KBD.2 — `/` keypress in text input', () => {
  test('static probe: no bare-`/` shortcut is registered in App.tsx', () => {
    const body = readFileSync(join(process.cwd(), 'src', 'App.tsx'), 'utf8')
    // A bare-`/` registration would look like one of:
    //   { key: '/', ... }
    //   { keys: ['/'], ... }   (no `meta+` prefix)
    // The Cmd+/ chord (`['meta+/']`) is fine — meta-modifier matches
    // bypass the typing guard but that's the intentional override.
    const bareSlashKey = /key:\s*['"]\/['"]\s*,(?![^}]*meta:\s*true)/m
    const bareSlashKeys = /keys:\s*\[\s*['"]\/['"]\s*\]/

    expect(body.match(bareSlashKey)).toBeNull()
    expect(body.match(bareSlashKeys)).toBeNull()
  })

  test('static probe: useKeyboardShortcuts has an `isTyping` guard that bails for non-meta single-key shortcuts', () => {
    const hookBody = readFileSync(
      join(process.cwd(), 'src', 'hooks', 'useKeyboardShortcuts.ts'),
      'utf8',
    )
    // The guard variable.
    expect(hookBody).toMatch(/const\s+isTyping\s*=\s*.*INPUT.*TEXTAREA.*isContentEditable/s)

    // The bailout for non-meta single-key (legacy form) — line 120-123:
    //   if (!isTyping) {
    //     e.preventDefault()
    //     shortcut.action()
    //     return
    //   }
    expect(hookBody).toMatch(/if\s*\(\s*!isTyping\s*\)/)
  })

  test('static probe: sequential chord shortcuts bail in `isTyping` (gd/gr/gb/gs navigation)', () => {
    const hookBody = readFileSync(
      join(process.cwd(), 'src', 'hooks', 'useKeyboardShortcuts.ts'),
      'utf8',
    )
    // Sequential branch around line 47-49:
    //   if (sequential && keys.length === 2) {
    //     if (isTyping) continue
    expect(hookBody).toMatch(/sequential.*length\s*===\s*2[\s\S]*?if\s*\(\s*isTyping\s*\)\s*continue/m)
  })

  test('static probe: scan all source files for bare-`/` shortcut registrations', () => {
    // A future PR adding a "/ to focus search" shortcut would
    // re-introduce the hazard. Surface any addition by scanning
    // beyond App.tsx.
    const root = join(process.cwd(), 'src')
    const offenders: string[] = []
    function walk(dir: string) {
      let entries: string[]
      try {
        entries = readdirSync(dir)
      } catch {
        return
      }
      for (const ent of entries) {
        const full = join(dir, ent)
        let s: ReturnType<typeof statSync>
        try {
          s = statSync(full)
        } catch {
          continue
        }
        if (s.isDirectory()) {
          if (ent === 'node_modules' || ent === '__tests__' || ent === 'test') continue
          walk(full)
          continue
        }
        if (!ent.endsWith('.ts') && !ent.endsWith('.tsx')) continue
        let body: string
        try {
          body = readFileSync(full, 'utf8')
        } catch {
          continue
        }
        // Look for shortcut registration patterns containing the
        // literal `/` char as a *key* (not Cmd+/).
        // Pattern 1: { key: '/', ... } without meta:true on same logical block.
        const bareKey = /key:\s*['"]\/['"]\s*,(?![^}]*meta:\s*true)/m
        const bareKeys = /keys:\s*\[\s*['"]\/['"]\s*\]/
        if (bareKey.test(body) || bareKeys.test(body)) {
          offenders.push(full.replace(root + '/', ''))
        }
      }
    }
    walk(root)
    expect(offenders, `bare-/ shortcut registrations: ${offenders.join(', ')}`).toEqual([])
  })

  test('live probe: typing `/` inside an input inserts the literal character', async ({ page }) => {
    test.skip(!STAGING, skipReason)
    await page.goto(`${STAGING}/rfis`)
    await page.waitForLoadState('networkidle')

    const input = page.locator('input[type="text"], input:not([type]), textarea').first()
    if ((await input.count()) === 0) {
      test.skip(true, 'no text input on the landing page; live probe inconclusive')
      return
    }
    await input.focus()
    await input.fill('') // clear
    await page.keyboard.press('/')

    // The value must be exactly `/`. If a global search dialog
    // opened, focus shifts away and value remains empty.
    const value = await input.inputValue()
    expect(value).toBe('/')

    // Defensive: a [cmdk-root] dialog must NOT be visible.
    const dialog = page.locator('[cmdk-root], [role="dialog"]').filter({ hasText: /search/i })
    const count = await dialog.count()
    expect(count).toBe(0)
  })
})
