// Phase 5 — Iris pre-flight inline panel.
//
// Renders the rule-based pre-flight findings from
// `src/services/iris/submittalDraft.ts` `runPreflight()`. Phase 7 augments
// this with Iris LLM citations + similar-past lookups.

import React from 'react'
import { AlertTriangle, AlertCircle, Info } from 'lucide-react'
import type {
  PreflightFinding,
  PreflightSeverity,
} from '../../../services/iris/submittalDraft'

const C = {
  ink: '#1A1613',
  ink2: '#5C5550',
  ink3: '#8C857E',
  border: 'rgba(26, 22, 19, 0.10)',
  surfaceInset: '#F5F5F1',
  brandOrange: '#F47820',
  critical: '#C93B3B',
  pending: '#C4850C',
  active: '#2D8A6E',
}

const FONT = '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'

const sevColor: Record<PreflightSeverity, string> = {
  block: C.critical,
  warning: C.pending,
  info: C.ink3,
}

const SeverityIcon: React.FC<{ severity: PreflightSeverity }> = ({ severity }) => {
  if (severity === 'block') return <AlertCircle size={12} />
  if (severity === 'warning') return <AlertTriangle size={12} />
  return <Info size={12} />
}

export interface IrisPreflightInlineProps {
  findings: PreflightFinding[]
}

export const IrisPreflightInline: React.FC<IrisPreflightInlineProps> = ({ findings }) => {
  // Sort: block → warning → info; stable within severity.
  const ordered = [...findings].sort((a, b) => severityRank[b.severity] - severityRank[a.severity])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontFamily: FONT }}>
      <h3
        style={{
          margin: 0,
          fontSize: 11,
          fontWeight: 600,
          color: C.ink2,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <span style={{ color: C.brandOrange }}>✨</span> Iris pre-flight
      </h3>

      {ordered.length === 0 ? (
        <p style={{ margin: 0, fontSize: 12, color: C.active }}>
          ✓ Looks good. Nothing flagged.
        </p>
      ) : (
        <ul
          role="list"
          style={{
            listStyle: 'none',
            padding: 0,
            margin: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          {ordered.map((f) => (
            <li
              key={f.id}
              style={{
                padding: '8px 10px',
                backgroundColor: '#fff',
                border: `1px solid ${C.border}`,
                borderLeft: `3px solid ${sevColor[f.severity]}`,
                borderRadius: 4,
                fontSize: 12,
                color: C.ink,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                <span style={{ color: sevColor[f.severity], paddingTop: 1 }}>
                  <SeverityIcon severity={f.severity} />
                </span>
                <span style={{ flex: 1, lineHeight: 1.35 }}>{f.message}</span>
              </div>
              {f.link && (
                <a
                  href={f.link.href}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    marginTop: 4,
                    display: 'inline-block',
                    fontSize: 11,
                    color: C.brandOrange,
                    textDecoration: 'none',
                    fontWeight: 500,
                  }}
                >
                  → {f.link.kind === 'spec' ? 'Open spec section' :
                     f.link.kind === 'past_submittal' ? 'See similar past' :
                     'Open standard'}
                </a>
              )}
            </li>
          ))}
        </ul>
      )}

      <p style={{ margin: '8px 0 0', fontSize: 11, color: C.ink3, lineHeight: 1.4 }}>
        Iris LLM augmentation (citations + similar-past) lands in Phase 7.
        Phase 5 ships the deterministic rule-set so the inline preview is
        live today.
      </p>
    </div>
  )
}

const severityRank: Record<PreflightSeverity, number> = {
  block: 3,
  warning: 2,
  info: 1,
}

export default IrisPreflightInline
