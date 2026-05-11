// ────────────────────────────────────────────────────────────────────────────
// PersonaDashboardShell — shared chrome for the 3 Phase 1d persona homes
// ────────────────────────────────────────────────────────────────────────────
// Spec: docs/audits/IRIS_PHASE_1_ROLE_LAYER_CONTEXT_FABRIC_SPEC_2026-05-08.md §6
// ADR-019.
//
// Phase 1d scope: the dashboards are REACHABLE and render the spec'd card
// list with persona-appropriate copy. Real data fetching lands in Phase 4
// (per-page Insight Slot / Ambient Awareness). Cards currently render an
// honest "Loading…" / "Connected in Phase 4" placeholder rather than
// faking metrics — invisible failure is worse than visible placeholder.

import { Link } from 'react-router-dom'

import { spacing } from '../../../styles/theme'
import type { PersonaSlug } from '../../../services/iris/types/context'
import { getPersonaConfig } from '../../../services/iris/personas'

export interface PersonaCardSpec {
  id: string
  title: string
  description: string
  // Phase 4 will replace `placeholder` with `fetch: (ctx) => Promise<TData>`
  // per spec §6.3. Phase 1d holds the slot open with honest copy.
  placeholder: string
  cta?: { label: string; to: string }
}

interface Props {
  persona: PersonaSlug
  resolved: boolean
  cards: PersonaCardSpec[]
}

export function PersonaDashboardShell({ persona, resolved, cards }: Props) {
  const config = getPersonaConfig(persona)
  return (
    <div
      data-testid={`persona-dashboard-${persona}`}
      style={{
        padding: spacing[6],
        display: 'flex',
        flexDirection: 'column',
        gap: spacing[6],
      }}
    >
      <header style={{ display: 'flex', flexDirection: 'column', gap: spacing[2] }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 600 }}>
          {config.display_name} home
        </h1>
        {!resolved && (
          <div
            role="status"
            data-testid="persona-fallback-banner"
            style={{
              padding: spacing[3],
              borderRadius: 8,
              background: 'var(--color-surface-inset, #fff7e6)',
              borderLeft: '4px solid var(--color-warning, #f5a623)',
              fontSize: '0.9rem',
            }}
          >
            We&rsquo;ve defaulted you to the Project Manager view. Your
            administrator can change this in Org Settings &rarr; Roles.
          </div>
        )}
      </header>

      <section
        aria-label={`${config.display_name} dashboard cards`}
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: spacing[4],
        }}
      >
        {cards.map((card) => (
          <article
            key={card.id}
            data-testid={`persona-card-${card.id}`}
            style={{
              padding: spacing[4],
              borderRadius: 12,
              background: 'var(--color-surface-raised, #ffffff)',
              border: '1px solid var(--color-border-subtle, #e5e7eb)',
              display: 'flex',
              flexDirection: 'column',
              gap: spacing[2],
            }}
          >
            <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>{card.title}</h2>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-text-secondary, #555)' }}>
              {card.description}
            </p>
            <p
              style={{
                margin: 0,
                fontSize: '0.8rem',
                color: 'var(--color-text-muted, #888)',
                fontStyle: 'italic',
              }}
            >
              {card.placeholder}
            </p>
            {card.cta && (
              <Link
                to={card.cta.to}
                style={{
                  marginTop: 'auto',
                  fontSize: '0.85rem',
                  color: 'var(--color-primary-text, #c84a00)',
                  textDecoration: 'none',
                  fontWeight: 500,
                }}
              >
                {card.cta.label} &rarr;
              </Link>
            )}
          </article>
        ))}
      </section>
    </div>
  )
}
