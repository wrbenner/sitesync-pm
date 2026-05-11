// ────────────────────────────────────────────────────────────────────────────
// no-raw-iris-system rule tests
// ────────────────────────────────────────────────────────────────────────────
// Spec: docs/audits/IRIS_PHASE_1_ROLE_LAYER_CONTEXT_FABRIC_SPEC_2026-05-08.md §5.3
// ADR-020 — Context Fabric is the single retrieval entrypoint.

import { describe, it } from 'vitest'
import { RuleTester } from 'eslint'

import noRawIrisSystem from '../no-raw-iris-system.js'

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2023,
    sourceType: 'module',
  },
})

describe('sitesync/no-raw-iris-system', () => {
  it('runs the RuleTester matrix', () => {
    ruleTester.run('no-raw-iris-system', noRawIrisSystem, {
      valid: [
        // ── 1. Non-iris callers are untouched ─────────────────────────────
        {
          name: 'unrelated function call with a system property is fine',
          filename: '/Users/x/src/components/foo.ts',
          code: `someUnrelated({ system: 'whatever' })`,
        },
        // ── 2. Files under src/services/iris/ are exempt ─────────────────
        {
          name: 'callIris inside the iris service may still set system',
          filename: '/Users/x/src/services/iris/legacyAdapters.ts',
          code: `await callIris({ task: 'reasoning', prompt: 'x', system: 'persona-prompt' })`,
        },
        {
          name: 'supabase.functions.invoke inside the iris service is fine',
          filename: '/Users/x/src/services/iris/edgeBridge.ts',
          code: `supabase.functions.invoke('iris-call', { body: { system: 'x' } })`,
        },
        // ── 3. callIris without system= is always fine ───────────────────
        {
          name: 'callIris elsewhere is fine when system= is not set',
          filename: '/Users/x/src/components/owner/Owner.tsx',
          code: `await callIris({ task: 'reasoning', prompt: 'hi' })`,
        },
        {
          name: 'supabase.functions.invoke iris-call without body.system is fine',
          filename: '/Users/x/src/lib/foo.ts',
          code: `supabase.functions.invoke('iris-call', { body: { prompt: 'x' } })`,
        },
        // ── 4. system on unrelated invoke is fine ────────────────────────
        {
          name: 'system property on a DIFFERENT edge function invoke is fine',
          filename: '/Users/x/src/lib/foo.ts',
          code: `supabase.functions.invoke('iris-suggest', { body: { system: 'x' } })`,
        },
        // ── 5. Test paths are exempt (allows test injection) ─────────────
        {
          name: 'test files can set system= for fixture purposes',
          filename: '/Users/x/src/test/fixtures/foo.test.ts',
          code: `await callIris({ system: 'fixture' })`,
        },
      ],
      invalid: [
        // ── A. Direct callIris with system= outside iris service ─────────
        {
          name: 'callIris in a non-iris file with system= is flagged',
          filename: '/Users/x/src/components/owner/Owner.tsx',
          code: `await callIris({ task: 'reasoning', prompt: 'x', system: 'inline preamble' })`,
          errors: [{ messageId: 'rawSystem' }],
        },
        {
          name: 'callFn (aliased) with system= outside iris service is flagged',
          filename: '/Users/x/src/components/admin/Tool.tsx',
          code: `await callFn({ system: 'p', prompt: 'q' })`,
          errors: [{ messageId: 'rawSystem' }],
        },
        // ── B. supabase.functions.invoke('iris-call', { body: { system } }) ──
        {
          name: 'supabase.functions.invoke iris-call body.system in a UI file is flagged',
          filename: '/Users/x/src/pages/Reports.tsx',
          code: `supabase.functions.invoke('iris-call', { body: { system: 'p', prompt: 'q' } })`,
          errors: [{ messageId: 'rawSystem' }],
        },
        // ── C. Multiple offenders in the same file ───────────────────────
        {
          name: 'multiple callIris sites in a non-iris file each flag separately',
          filename: '/Users/x/src/components/admin/MultiTool.tsx',
          code: `
            async function a() { await callIris({ system: 'a', prompt: 'q' }) }
            async function b() { await callIris({ system: 'b', prompt: 'q' }) }
          `,
          errors: [{ messageId: 'rawSystem' }, { messageId: 'rawSystem' }],
        },
        // ── D. String-key form (callIris({ 'system': ... })) ─────────────
        {
          name: 'string-key form is flagged the same as identifier form',
          filename: '/Users/x/src/components/admin/StrTool.tsx',
          code: `await callIris({ 'system': 'p', prompt: 'q' })`,
          errors: [{ messageId: 'rawSystem' }],
        },
      ],
    })
  })
})
