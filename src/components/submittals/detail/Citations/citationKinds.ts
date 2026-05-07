// Phase 7 — Citation kinds for the Submittal detail page.
//
// The 8 citation kinds per the world-class plan Pillar B + spec Part 8:
//
//   1. spec_section      — links to the spec book section + paragraph + page
//   2. prior_submittal   — vector-similarity match to a past submittal
//   3. industry_standard — AAMA / AISC / ASTM reference (external URL or PDF)
//   4. package_item      — file inside the same submittal package
//   5. drawing_pin       — pin on a sheet (auto-pinned at distribute time)
//   6. schedule_activity — schedule activity referenced by the submittal
//   7. rfi               — related RFI thread
//   8. change_order      — related change order
//
// Each kind has a card (left rail) + preview (right rail). Spec sections
// and drawing pins get PDF preview with highlight rect; others get a
// structured detail view.

import type { LucideIcon } from 'lucide-react'
import {
  BookOpen,
  Files,
  Award,
  Layers,
  MapPin,
  Calendar,
  HelpCircle,
  DollarSign,
} from 'lucide-react'

export type CitationKind =
  | 'spec_section'
  | 'prior_submittal'
  | 'industry_standard'
  | 'package_item'
  | 'drawing_pin'
  | 'schedule_activity'
  | 'rfi'
  | 'change_order'

export interface CitationKindMeta {
  kind: CitationKind
  label: string
  shortLabel: string
  icon: LucideIcon
  /** Short colour-tint used for the left-rail accent bar. */
  accent: string
  /** Whether this citation kind supports PDF preview with a highlight rect. */
  hasPdfPreview: boolean
}

export const CITATION_KIND_META: Record<CitationKind, CitationKindMeta> = {
  spec_section: {
    kind: 'spec_section',
    label: 'Spec section',
    shortLabel: 'Spec',
    icon: BookOpen,
    accent: '#4F46E5',
    hasPdfPreview: true,
  },
  prior_submittal: {
    kind: 'prior_submittal',
    label: 'Prior submittal',
    shortLabel: 'Prior',
    icon: Files,
    accent: '#2D8A6E',
    hasPdfPreview: false,
  },
  industry_standard: {
    kind: 'industry_standard',
    label: 'Industry standard',
    shortLabel: 'Standard',
    icon: Award,
    accent: '#C4850C',
    hasPdfPreview: true,
  },
  package_item: {
    kind: 'package_item',
    label: 'Package item',
    shortLabel: 'Package',
    icon: Layers,
    accent: '#8B5CF6',
    hasPdfPreview: true,
  },
  drawing_pin: {
    kind: 'drawing_pin',
    label: 'Drawing pin',
    shortLabel: 'Pin',
    icon: MapPin,
    accent: '#F47820',
    hasPdfPreview: true,
  },
  schedule_activity: {
    kind: 'schedule_activity',
    label: 'Schedule activity',
    shortLabel: 'Schedule',
    icon: Calendar,
    accent: '#0EA5E9',
    hasPdfPreview: false,
  },
  rfi: {
    kind: 'rfi',
    label: 'RFI',
    shortLabel: 'RFI',
    icon: HelpCircle,
    accent: '#DB2777',
    hasPdfPreview: false,
  },
  change_order: {
    kind: 'change_order',
    label: 'Change order',
    shortLabel: 'CO',
    icon: DollarSign,
    accent: '#65A30D',
    hasPdfPreview: false,
  },
}

export const CITATION_KIND_ORDER: CitationKind[] = [
  'spec_section',
  'drawing_pin',
  'package_item',
  'prior_submittal',
  'industry_standard',
  'rfi',
  'change_order',
  'schedule_activity',
]

// ── Citation row shape (the card payload) ───────────────────────────────────

export interface CitationBase {
  id: string
  kind: CitationKind
  /** One-line label for the card (e.g. "08 41 13 §2.04.B.3"). */
  label: string
  /** Optional secondary line under the label (e.g. spec section title). */
  subtitle?: string | null
  /** Optional preview-pane payload — kind-specific. */
  preview?: CitationPreview
}

export type CitationPreview =
  | { kind: 'pdf'; pdfUrl: string; page: number; highlightRect?: [number, number, number, number] }
  | { kind: 'text'; body: string }
  | { kind: 'submittal_summary'; submittal_id: string; number: string | null; title: string; disposition: string | null; rev_count: number }
  | { kind: 'rfi_summary'; rfi_id: string; number: string | null; question: string; status: string }
  | { kind: 'change_order_summary'; co_id: string; number: string | null; description: string; amount_cents: number | null; status: string }
  | { kind: 'schedule_activity_summary'; activity_id: string; name: string; start_date: string | null; end_date: string | null }
