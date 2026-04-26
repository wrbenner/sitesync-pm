import React from 'react'
import { ShieldCheck, Lock, Database, Eye, KeyRound, FileCheck2, Server, AlertTriangle } from 'lucide-react'
import { colors, spacing, typography, borderRadius } from '../styles/theme'

// ── Public security overview page ──────────────────────────────
//
// Lives at /security and is intentionally accessible WITHOUT auth so
// procurement teams, security reviewers, and prospective customers can
// read it without going through signup. Mirrors SECURITY.md at repo root
// and the customer-facing docs/mintlify/trust/security-overview.mdx.

interface ControlCardProps {
  icon: React.ReactNode
  title: string
  body: string
}

const ControlCard: React.FC<ControlCardProps> = ({ icon, title, body }) => (
  <div
    style={{
      display: 'flex',
      gap: spacing['3'],
      padding: spacing['5'],
      borderRadius: borderRadius.lg,
      background: colors.surfaceRaised,
      border: `1px solid ${colors.borderSubtle}`,
    }}
  >
    <div
      aria-hidden="true"
      style={{
        flexShrink: 0,
        width: 36,
        height: 36,
        borderRadius: borderRadius.md,
        background: `${colors.primaryOrange}15`,
        color: colors.primaryOrange,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {icon}
    </div>
    <div style={{ minWidth: 0 }}>
      <h3 style={{ margin: 0, fontSize: typography.fontSize.base, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
        {title}
      </h3>
      <p style={{ margin: `${spacing['1']} 0 0`, fontSize: typography.fontSize.sm, color: colors.textSecondary, lineHeight: 1.55 }}>
        {body}
      </p>
    </div>
  </div>
)

const SecurityOverview: React.FC = () => {
  return (
    <main
      role="main"
      aria-label="Security overview"
      style={{
        minHeight: '100vh',
        background: colors.surfacePage,
        fontFamily: typography.fontFamily,
        color: colors.textPrimary,
      }}
    >
      {/* ── Hero ─────────────────────────────────────────── */}
      <section style={{ maxWidth: 920, margin: '0 auto', padding: `${spacing['10']} ${spacing['6']} ${spacing['8']}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'], marginBottom: spacing['4'] }}>
          <ShieldCheck size={28} color={colors.primaryOrange} aria-hidden="true" />
          <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Trust center
          </span>
        </div>
        <h1 style={{ margin: 0, fontSize: '2.25rem', fontWeight: typography.fontWeight.bold, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
          Security at SiteSync PM
        </h1>
        <p style={{ margin: `${spacing['4']} 0 0`, fontSize: typography.fontSize.lg, color: colors.textSecondary, lineHeight: 1.55, maxWidth: 720 }}>
          We protect customer project data with defense-in-depth: encrypted in transit and at rest, multi-tenant row-level security in Postgres, mandatory MFA for privileged roles, tamper-evident audit logs, and edge-level HTTP security headers. This page is the public summary; for a deeper review (CAIQ-Lite, SIG, custom questionnaires, DPA), email{' '}
          <a href="mailto:security@sitesync.app" style={{ color: colors.primaryOrange, textDecoration: 'underline' }}>
            security@sitesync.app
          </a>
          .
        </p>
      </section>

      {/* ── Controls grid ─────────────────────────────── */}
      <section style={{ maxWidth: 920, margin: '0 auto', padding: `0 ${spacing['6']} ${spacing['8']}` }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: spacing['4'] }}>
          <ControlCard
            icon={<KeyRound size={18} />}
            title="Identity &amp; authentication"
            body="Email + password with bcrypt hashing (Supabase Auth). TOTP MFA available for everyone, soft-forced for owner / admin / project_manager. 30-min idle session timeout. Per-email account lockout after 5 failed attempts in any rolling 15-minute window. SAML SSO + SCIM available on the enterprise tier."
          />
          <ControlCard
            icon={<Database size={18} />}
            title="Tenant isolation"
            body="Every row carries organization_id and project_id. Postgres Row-Level Security policies enforce tenant scoping at the database layer — a query that &quot;forgets&quot; to filter still returns zero rows for unauthorized callers. Every tenant-scoped table is FORCE ROW LEVEL SECURITY enabled, so even superuser-equivalent service-role queries cannot bypass policies without explicitly disabling them per-statement."
          />
          <ControlCard
            icon={<FileCheck2 size={18} />}
            title="Tamper-evident audit log"
            body="Every privileged mutation is captured with actor, timestamp, before/after state, and changed fields. Audit log entries form a SHA-256 hash chain — each entry's hash covers its content plus the prior entry's hash. A scheduled verifier walks the chain nightly and alerts on integrity break. UPDATE/DELETE on the audit log is blocked at the database layer for non-superuser roles."
          />
          <ControlCard
            icon={<Lock size={18} />}
            title="Encryption"
            body="TLS 1.2+ in transit; HSTS preloaded. AES-256 at rest (Supabase / AWS). Field-level encryption via Supabase Vault for SSN, tax ID, and contract terms. Secrets never leave the server tier; the browser holds only the public anon key."
          />
          <ControlCard
            icon={<Server size={18} />}
            title="Application &amp; edge"
            body="HTTP security headers at the edge: HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy, Cross-Origin-Opener-Policy. DOMPurify-sanitized markdown rendering with explicit allowlist. No eval / new Function in application code. Dependabot weekly; high-severity merge SLA 7 days."
          />
          <ControlCard
            icon={<Eye size={18} />}
            title="Edge functions"
            body="Every privileged endpoint validates the caller's JWT via GoTrue's /auth/v1/user and resolves project membership before any service-role write. Cron-only endpoints authenticate via a separate CRON_SECRET. There are no anonymous endpoints that can write data."
          />
          <ControlCard
            icon={<AlertTriangle size={18} />}
            title="Backup &amp; recovery"
            body="Daily full backups + point-in-time recovery for the trailing 7 days (Supabase managed). RPO 24 hours, RTO 4 hours. Quarterly DR drills against a parallel restore."
          />
          <ControlCard
            icon={<ShieldCheck size={18} />}
            title="Compliance"
            body="SOC 2 Type I in progress. Type II planned post-Type-I + 6-month observation. GDPR-ready: data export and deletion endpoints in place. DPA available on request. Davis-Bacon / WH-347 certified payroll computation + PDF export shipped."
          />
        </div>
      </section>

      {/* ── Disclosure / contact ─────────────────────── */}
      <section style={{ maxWidth: 920, margin: '0 auto', padding: `${spacing['6']} ${spacing['6']} ${spacing['10']}` }}>
        <div
          style={{
            padding: spacing['6'],
            borderRadius: borderRadius.lg,
            background: `linear-gradient(135deg, ${colors.primaryOrange}10, ${colors.statusInfo}10)`,
            border: `1px solid ${colors.borderSubtle}`,
          }}
        >
          <h2 style={{ margin: 0, fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold }}>
            Reporting a vulnerability
          </h2>
          <p style={{ margin: `${spacing['2']} 0 ${spacing['3']}`, fontSize: typography.fontSize.sm, color: colors.textSecondary, lineHeight: 1.55 }}>
            Please don&apos;t open a public GitHub issue for security findings. Email{' '}
            <a href="mailto:security@sitesync.app" style={{ color: colors.primaryOrange, textDecoration: 'underline' }}>
              security@sitesync.app
            </a>{' '}
            with a description, reproduction steps, and your assessment of impact. We acknowledge within 24 hours and aim for a fix-or-mitigation within 14 days for high-severity findings, 30 days for the rest.
          </p>
          <p style={{ margin: 0, fontSize: typography.fontSize.xs, color: colors.textTertiary }}>
            For a longer-form security questionnaire response, completed CAIQ-Lite, or a copy of our DPA, email{' '}
            <a href="mailto:security@sitesync.app" style={{ color: colors.primaryOrange, textDecoration: 'underline' }}>
              security@sitesync.app
            </a>
            .
          </p>
        </div>
      </section>
    </main>
  )
}

export default SecurityOverview
