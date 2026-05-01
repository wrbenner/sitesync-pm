/**
 * IrisSuggests — orchestrator for per-entity Iris suggestions.
 *
 * Mounts on entity pages with `<IrisSuggests entityType="rfi" entityId={id} projectId={...} />`.
 * Calls the iris-suggest edge function, renders 0-3 IrisSuggestionCards.
 */

import React, { useEffect, useState } from 'react'
import { spacing } from '../../styles/theme'
import { IrisSuggestionCard } from './IrisSuggestionCard'
import type { Suggestion } from '../../lib/iris/suggestPolicy'
import { supabase } from '../../lib/supabase'

export interface IrisSuggestsProps {
  entityType: 'rfi' | 'submittal' | 'change_order' | 'punch_item' | 'daily_log'
  entityId: string
  projectId: string
}

export const IrisSuggests: React.FC<IrisSuggestsProps> = ({ entityType, entityId, projectId }) => {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    setLoading(true)
    ;(async () => {
      try {
        const { data, error } = await supabase.functions.invoke('iris-suggest', {
          body: { entity_type: entityType, entity_id: entityId, project_id: projectId },
        })
        if (!mounted) return
        if (error) {
          // Graceful: just no suggestions if the function isn't deployed yet.
          setSuggestions([])
          return
        }
        const list = (data as { suggestions?: Suggestion[] })?.suggestions ?? []
        setSuggestions(list)
      } catch {
        if (mounted) setSuggestions([])
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [entityType, entityId, projectId])

  if (loading) return null
  if (suggestions.length === 0) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['3'], marginTop: spacing['4'] }}>
      {suggestions.map((s) => (
        <IrisSuggestionCard
          key={`${s.kind}:${s.entity_id}`}
          suggestion={s}
          busy={busy === s.kind}
          onAccept={async (sug) => {
            setBusy(sug.kind)
            try {
              // Map to the appropriate draft endpoint. We dispatch by kind.
              if (sug.kind === 'rfi.draft_response') {
                await supabase.functions.invoke('iris-rfi-response-draft', {
                  body: { rfi_id: sug.entity_id, project_id: projectId },
                })
              }
              setSuggestions((prev) => prev.filter((p) => p.kind !== sug.kind))
            } finally {
              setBusy(null)
            }
          }}
          onDismiss={async (sug) => {
            setSuggestions((prev) => prev.filter((p) => p.kind !== sug.kind))
          }}
        />
      ))}
    </div>
  )
}

export default IrisSuggests
