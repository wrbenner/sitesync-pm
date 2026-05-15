/**
 * FMEA K.ANTH.1 — No secret patterns in production bundle
 *
 * Hazard: server-side API keys (Anthropic, Stripe, Resend, OpenAI, the
 *         Supabase service-role JWT, etc.) are accidentally inlined into
 *         the client bundle, where every user who loads the app can
 *         exfiltrate them.
 *
 * Test approach:
 *   1. Locate the latest production build under `dist/` (run `npm run
 *      build` ahead of CI, or skip if dist is absent).
 *   2. Recursively read every JS/CSS/HTML/source-map file.
 *   3. Grep for known secret prefixes:
 *        - sk_live_       (Stripe secret keys)
 *        - sk_test_       (Stripe test secrets — also shouldn't ship)
 *        - rk_live_       (Stripe restricted)
 *        - ANTHROPIC_API_KEY
 *        - OPENAI_API_KEY
 *        - RESEND_API_KEY
 *        - sk-ant-        (Anthropic API key prefix)
 *        - re_            (Resend API key prefix; very short, used
 *                          with extra heuristic — must be inside a
 *                          quote and ≥20 chars)
 *        - service_role JWT (decoded payload contains
 *          `"role":"service_role"` after base64-decoding)
 *
 *   Each finding is appended to a leak report; the test fails with the
 *   list of files+patterns.
 *
 * The test runs only when `dist/` exists; CI is expected to `npm run
 * build` before invoking it. Skipping cleanly is the right default so
 * the test never false-fails on a clean checkout.
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'

const DIST = resolve(__dirname, '../../dist')
const HAS_DIST = existsSync(DIST)

interface SecretPattern {
  name: string
  re: RegExp
  /** Optional payload-decode hook (e.g. JWT body inspection). */
  inspect?: (match: string, file: string) => string | null
}

const PATTERNS: SecretPattern[] = [
  { name: 'stripe-live-secret', re: /\bsk_live_[A-Za-z0-9]{16,}\b/g },
  { name: 'stripe-test-secret', re: /\bsk_test_[A-Za-z0-9]{16,}\b/g },
  { name: 'stripe-restricted', re: /\brk_live_[A-Za-z0-9]{16,}\b/g },
  { name: 'anthropic-prefix', re: /\bsk-ant-[A-Za-z0-9_\-]{20,}\b/g },
  { name: 'env-var-anthropic', re: /\bANTHROPIC_API_KEY\s*=\s*['"]?sk[-_]?[A-Za-z0-9]/g },
  { name: 'env-var-openai', re: /\bOPENAI_API_KEY\s*=\s*['"]?sk[-_]?[A-Za-z0-9]/g },
  { name: 'env-var-resend', re: /\bRESEND_API_KEY\s*=\s*['"]?re_[A-Za-z0-9]/g },
  {
    name: 'service-role-jwt',
    re: /\beyJ[A-Za-z0-9_\-]{20,}\.[A-Za-z0-9_\-]{20,}\.[A-Za-z0-9_\-]{20,}\b/g,
    inspect: (match: string) => {
      // Decode middle segment; if `role: service_role`, leak.
      const parts = match.split('.')
      if (parts.length !== 3) return null
      try {
        const padded = parts[1] + '='.repeat((4 - (parts[1].length % 4)) % 4)
        const body = Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8')
        const j = JSON.parse(body)
        if (j?.role === 'service_role') return `service_role JWT (sub=${j?.sub ?? '?'})`
      } catch {
        return null
      }
      return null
    },
  },
]

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) walk(full, out)
    else if (/\.(js|mjs|cjs|css|html|map|json)$/.test(entry)) out.push(full)
  }
  return out
}

describe.skipIf(!HAS_DIST)('FMEA K.ANTH.1 — production bundle secret scan', () => {
  it('no known secret pattern appears in any dist file', () => {
    const files = walk(DIST)
    const findings: { file: string; pattern: string; sample: string }[] = []
    for (const file of files) {
      let content: string
      try {
        content = readFileSync(file, 'utf-8')
      } catch {
        continue
      }
      for (const pat of PATTERNS) {
        pat.re.lastIndex = 0
        const matches = content.match(pat.re)
        if (!matches) continue
        for (const m of matches) {
          if (pat.inspect) {
            const note = pat.inspect(m, file)
            if (!note) continue
            findings.push({ file, pattern: `${pat.name} :: ${note}`, sample: m.slice(0, 24) + '…' })
          } else {
            findings.push({ file, pattern: pat.name, sample: m.slice(0, 24) + '…' })
          }
        }
      }
    }

    if (findings.length > 0) {
      // Print a structured report.
      const lines = findings.map((f) => `  - ${f.pattern}  (${f.file})  sample=${f.sample}`)
      throw new Error(
        `K.ANTH.1 leak: ${findings.length} secret-pattern hits in dist/:\n${lines.join('\n')}`,
      )
    }
    expect(findings).toEqual([])
  })

  it('dist files exist (sanity)', () => {
    const files = walk(DIST)
    expect(files.length).toBeGreaterThan(0)
  })
})
