/**
 * LinkageChain — the audit-trail visualizer
 *
 *   "This RFI → 3 photos → drawing M-401 (sheet B-3 at 12,8) → daily log 4/15 →
 *    Lone Star Framers on site that day → resulting CO #014"
 *
 * Lives at the top of every entity detail page that has linked media. Each
 * link is a clickable chip; the dot color encodes confidence; hover reveals
 * provenance (auto vs manual, the resolver's notes).
 *
 * The visual language is deliberately quiet — this is a forensic component,
 * not a hero element. It's the thing that becomes priceless six months from
 * now when insurance asks who installed the flashing.
 */

import React, { useMemo, useState } from 'react'
import { ChevronRight, Camera, FileText, Layers, Users, ClipboardList, MessageSquare, Send, Banknote, Link2 } from 'lucide-react'
import { colors, typography, spacing } from '../../styles/theme'
import { Eyebrow } from '../atoms'
import type { Confidence, EntityType, LinkSource } from '../../lib/linkage/types'

export interface LinkageNode {
  id: string
  entityType: EntityType | 'media'
  /** What to render inside the chip — usually entity number + short label. */
  label: string
  /** Secondary line, e.g. sheet number "A2.10" or "ABC Roofing". */
  detail?: string
  /** Drawing-relative pin position when entityType='drawing'. */
  pinX?: number | null
  pinY?: number | null
  /** Confidence drives the dot color — high=ink, medium=amber, low=gray. */
  confidence?: Confidence
  /** auto/manual provenance — auto rows show a faint underline. */
  source?: LinkSource
  /** Resolver's reason note, surfaced in the hover tooltip. */
  notes?: string
  /** Click handler. If omitted the chip is non-interactive. */
  onClick?: () => void
}

const ICON_MAP: Record<LinkageNode['entityType'], React.ElementType> = {
  media: Camera,
  drawing: Layers,
  crew: Users,
  daily_log: FileText,
  punch_item: ClipboardList,
  rfi: MessageSquare,
  submittal: Send,
  change_order: Banknote,
}

const TYPE_LABEL: Record<LinkageNode['entityType'], string> = {
  media: 'Photo',
  drawing: 'Drawing',
  crew: 'Crew',
  daily_log: 'Daily Log',
  punch_item: 'Punch',
  rfi: 'RFI',
  submittal: 'Submittal',
  change_order: 'Change Order',
}

function confidenceDotColor(conf: Confidence | undefined): string {
  if (!conf) return colors.ink4
  if (conf === 'high')   return colors.ink
  if (conf === 'medium') return colors.statusPending  // amber
  return colors.ink4                                  // low → quiet gray
}

interface ChipProps {
  node: LinkageNode
  /** True for the leftmost chip (no leading chevron). */
  first: boolean
}

const Chip: React.FC<ChipProps> = ({ node, first }) => {
  const [hovered, setHovered] = useState(false)
  const Icon = ICON_MAP[node.entityType]
  const interactive = !!node.onClick

  const tooltip = useMemo(() => {
    const parts: string[] = []
    parts.push(TYPE_LABEL[node.entityType])
    if (node.confidence) parts.push(`${node.confidence} confidence`)
    if (node.source)     parts.push(`${node.source}-linked`)
    if (node.notes)      parts.push(node.notes)
    return parts.join(' · ')
  }, [node])

  return (
    <>
      {!first && (
        <ChevronRight
          size={14}
          aria-hidden="true"
          style={{
            color: colors.ink4,
            flexShrink: 0,
            margin: `0 ${spacing['1']}`,
          }}
        />
      )}
      <button
        type="button"
        onClick={node.onClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        title={tooltip}
        disabled={!interactive}
        aria-label={`${TYPE_LABEL[node.entityType]}: ${node.label}${node.detail ? ` — ${node.detail}` : ''}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: spacing['1.5'],
          padding: `6px 10px`,
          backgroundColor: 'var(--color-surfaceRaised, #FFFFFF)',
          border: `1px solid ${hovered && interactive ? 'var(--hairline-2)' : 'var(--hairline)'}`,
          borderRadius: 999,
          fontFamily: typography.fontFamily,
          fontSize: '12px',
          fontWeight: typography.fontWeight.medium,
          color: colors.ink,
          cursor: interactive ? 'pointer' : 'default',
          transition: 'border-color 120ms ease',
          whiteSpace: 'nowrap',
          maxWidth: 220,
          textDecoration: node.source === 'auto' ? 'none' : 'none',
          textAlign: 'left',
        }}
      >
        {/* Confidence dot — replaces the leading icon's color signal so even
            a glance reads "this link is solid / unverified" without hover. */}
        <span
          aria-hidden="true"
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            backgroundColor: confidenceDotColor(node.confidence),
            flexShrink: 0,
          }}
        />
        <Icon size={13} style={{ color: colors.ink3, flexShrink: 0 }} />
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {node.label}
          {node.detail && (
            <span style={{ color: colors.ink3, fontWeight: typography.fontWeight.normal }}>
              {' · '}{node.detail}
            </span>
          )}
        </span>
      </button>
    </>
  )
}

interface LinkageChainProps {
  /** Ordered left-to-right. The first node is typically the "I am here" anchor. */
  nodes: LinkageNode[]
  /** Optional eyebrow above the chain. Default "Linked to" when omitted. */
  eyebrow?: string
  /** Compact mode: smaller padding for embedding inside detail pages. */
  compact?: boolean
  /** When false, hide the chain entirely — the page should fall back to a quiet
   *  "no linkage yet" affordance owned by the parent. */
  visible?: boolean
}

export const LinkageChain: React.FC<LinkageChainProps> = ({
  nodes,
  eyebrow,
  compact = false,
  visible = true,
}) => {
  if (!visible || nodes.length === 0) return null

  return (
    <div
      role="navigation"
      aria-label="Linked records"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: spacing['1.5'],
        padding: compact ? `${spacing['2']} 0` : `${spacing['3']} 0`,
        borderBottom: '1px solid var(--hairline)',
        marginBottom: compact ? spacing['3'] : spacing['4'],
      }}
    >
      <Eyebrow style={{ display: 'inline-flex', alignItems: 'center', gap: spacing['1.5'] }}>
        <Link2 size={11} aria-hidden="true" />
        <span>{eyebrow ?? 'Linked to'}</span>
      </Eyebrow>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: spacing['0.5'],
          rowGap: spacing['2'],
        }}
      >
        {nodes.map((node, i) => (
          <Chip key={`${node.entityType}-${node.id}-${i}`} node={node} first={i === 0} />
        ))}
      </div>
    </div>
  )
}
