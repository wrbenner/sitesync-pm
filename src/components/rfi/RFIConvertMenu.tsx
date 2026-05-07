// ── RFIConvertMenu ──────────────────────────────────────────────────────
// Phase 1.2 — non-destructive RFI → other-entity conversion.
//
// Each conversion:
//   • Pre-fills the target's create form with the RFI's relevant fields.
//   • Inserts an `rfi_links` row of kind `converts_to` so both sides
//     show the link.
//   • Leaves the original RFI open. The PM closes it manually if/when
//     the converted entity supersedes it.

import React, { useState } from 'react'
import { ChevronDown, FilePlus2, Wrench, Hammer, ClipboardCheck } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { PermissionGate } from '../auth/PermissionGate'
import { useAddRFILink } from '../../hooks/queries/useRFILinks'
import { logAuditEntry } from '../../lib/auditLogger'
import { fromTable } from '../../lib/db/queries'
import { supabase } from '../../lib/supabase'
import { colors, typography, borderRadius } from '../../styles/theme'

const from = (table: string) => fromTable(table as never)

interface RFIConvertMenuProps {
  rfiId: string
  projectId: string
  rfiTitle: string
  rfiQuestion: string | null
  costImpactCents: number | null
  scheduleDaysImpact: number | null
}

type ConvertTarget = 'submittal' | 'change_order' | 'punch_item' | 'field_directive'

const TARGET_META: Record<ConvertTarget, { label: string; icon: React.ReactNode }> = {
  submittal: { label: 'Convert to Submittal', icon: <FilePlus2 size={12} /> },
  change_order: { label: 'Convert to Change Event', icon: <Wrench size={12} /> },
  punch_item: { label: 'Convert to Punch Item', icon: <Hammer size={12} /> },
  field_directive: { label: 'Convert to Field Directive', icon: <ClipboardCheck size={12} /> },
}

export const RFIConvertMenu: React.FC<RFIConvertMenuProps> = ({
  rfiId, projectId, rfiTitle, rfiQuestion, costImpactCents, scheduleDaysImpact,
}) => {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const addLink = useAddRFILink()

  const handleConvert = async (target: ConvertTarget) => {
    setOpen(false)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      let createdId: string | null = null

      if (target === 'submittal') {
        const { data, error } = await from('submittals')
          .insert({
            project_id: projectId,
            title: `From RFI: ${rfiTitle}`.slice(0, 200),
            spec_section: null,
            assigned_to: null,
            created_by: user?.id ?? null,
          } as never)
          .select('id')
          .single()
        if (error) throw error
        createdId = (data as { id?: string } | null)?.id ?? null
      } else if (target === 'change_order') {
        const { data, error } = await from('change_orders')
          .insert({
            project_id: projectId,
            title: `From RFI: ${rfiTitle}`.slice(0, 200),
            description: rfiQuestion ?? null,
            cost_impact_cents: costImpactCents ?? null,
            schedule_impact_days: scheduleDaysImpact ?? null,
            source_rfi_id: rfiId,
            created_by: user?.id ?? null,
          } as never)
          .select('id')
          .single()
        if (error) throw error
        createdId = (data as { id?: string } | null)?.id ?? null
      } else if (target === 'punch_item') {
        const { data, error } = await from('punch_items')
          .insert({
            project_id: projectId,
            title: `From RFI: ${rfiTitle}`.slice(0, 200),
            description: rfiQuestion ?? null,
            reported_by: user?.id ?? null,
          } as never)
          .select('id')
          .single()
        if (error) throw error
        createdId = (data as { id?: string } | null)?.id ?? null
      } else if (target === 'field_directive') {
        // Field directives often don't have a dedicated table yet —
        // log an audit-traceable note and link back. The wired
        // creation form ships when /field-directives lands.
        await logAuditEntry({
          projectId,
          entityType: 'rfi',
          entityId: rfiId,
          action: 'update',
          afterState: { converted_to: 'field_directive', notes: rfiQuestion?.slice(0, 200) },
          metadata: { kind: 'rfi_convert_stub', target: 'field_directive' },
        })
        toast('Field directive logged. Wired creation flow ships in a follow-up.')
        return
      }

      if (createdId) {
        // Insert the converts_to link both ways via a single rfi_links
        // row keyed on (rfi_id, target_type, target_id, link_kind).
        const targetType = target === 'change_order' ? 'change_order'
          : target === 'submittal' ? 'submittal'
          : target === 'punch_item' ? 'punch_item'
          : 'change_order'
        await addLink.mutateAsync({
          rfiId,
          projectId,
          targetType,
          targetId: createdId,
          linkKind: 'converts_to',
        })
        toast.success(`${TARGET_META[target].label.replace('Convert to ', '')} created`)
        const route = targetType === 'submittal' ? `/submittals/${createdId}`
          : targetType === 'change_order' ? `/change-orders/${createdId}`
          : `/punch-list/${createdId}`
        navigate(route)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Conversion failed')
    }
  }

  return (
    <PermissionGate permission="rfis.edit">
      <div style={{ position: 'relative', display: 'inline-block' }}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={open}
          style={triggerStyle}
        >
          Convert <ChevronDown size={12} />
        </button>
        {open && (
          <ul
            role="menu"
            onMouseLeave={() => setOpen(false)}
            style={menuStyle}
          >
            {(Object.keys(TARGET_META) as ConvertTarget[]).map((t) => (
              <li key={t} role="menuitem">
                <button
                  type="button"
                  onClick={() => handleConvert(t)}
                  style={menuItemStyle}
                >
                  {TARGET_META[t].icon} {TARGET_META[t].label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </PermissionGate>
  )
}

const triggerStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: '5px 12px',
  fontSize: 12,
  fontWeight: 600,
  color: colors.textSecondary,
  background: 'transparent',
  border: `1px solid ${colors.borderSubtle}`,
  borderRadius: borderRadius.sm,
  cursor: 'pointer',
  fontFamily: 'inherit',
}

const menuStyle: React.CSSProperties = {
  position: 'absolute',
  right: 0,
  top: '100%',
  marginTop: 4,
  listStyle: 'none',
  padding: 4,
  minWidth: 220,
  backgroundColor: colors.surfaceRaised,
  border: `1px solid ${colors.borderSubtle}`,
  borderRadius: borderRadius.base,
  boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
  zIndex: 30,
}

const menuItemStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  width: '100%',
  textAlign: 'left',
  padding: '6px 10px',
  fontSize: typography.fontSize.sm,
  background: 'transparent',
  border: 'none',
  borderRadius: borderRadius.sm,
  color: colors.textPrimary,
  cursor: 'pointer',
}

export default RFIConvertMenu
