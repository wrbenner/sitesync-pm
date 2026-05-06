/**
 * CrossProjectSearchPalette — Cmd+K "across all projects" mode.
 *
 * Drops into the existing CommandPalette as an additional tab/mode. The
 * parent owns the keybinding registration; this component renders the
 * input + grouped results.
 *
 * Data fetch: caller supplies a `runSearch(query)` callback that goes
 * through Supabase RPC to `search_org()`. Grouping/sorting/highlighting
 * is pure (src/lib/search/ftsQuery).
 */

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import { colors, typography, spacing } from '../../styles/theme'
import { Eyebrow, Hairline } from '../atoms'
import { groupByEntity, parseQuery, type SearchRow } from '../../lib/search/ftsQuery'
import { SearchResultRow } from './SearchResultRow'

interface Props {
  open: boolean
  onClose: () => void
  /** Map of project_id → display name, fed by the parent's project store. */
  projectNames: Map<string, string>
  /** Caller-supplied async search. Returns rows from search_org(). */
  runSearch: (tsqueryInput: string) => Promise<SearchRow[]>
  /** Called when the user picks a result. Parent navigates. */
  onSelect: (row: SearchRow) => void
}

const TYPE_ORDER = ['rfi', 'submittal', 'change_order', 'punch_item', 'meeting', 'daily_log', 'drawing']
const TYPE_HEADER: Record<string, string> = {
  rfi: 'RFIs',
  submittal: 'Submittals',
  change_order: 'Change Orders',
  punch_item: 'Punch List',
  meeting: 'Meetings',
  daily_log: 'Daily Logs',
  drawing: 'Drawings',
}

export const CrossProjectSearchPalette: React.FC<Props> = ({
  open, onClose, projectNames, runSearch, onSelect,
}) => {
  const [raw, setRaw] = useState('')
  const [results, setResults] = useState<SearchRow[]>([])
  const [loading, setLoading] = useState(false)
  const [activeIdx, setActiveIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const parsed = useMemo(() => parseQuery(raw), [raw])
  const grouped = useMemo(() => groupByEntity(results), [results])
  const flatOrdered = useMemo(() => {
    const out: SearchRow[] = []
    for (const t of TYPE_ORDER) {
      const rows = grouped[t] ?? []
      for (const r of rows) out.push(r)
    }
    return out
  }, [grouped])

  useEffect(() => {
    if (!open) return
    const t = setTimeout(() => inputRef.current?.focus(), 60)
    return () => clearTimeout(t)
  }, [open])

  useEffect(() => {
    if (parsed.empty || parsed.tooShort) { setResults([]); return }
    let cancelled = false
    setLoading(true)
    runSearch(parsed.tsqueryInput).then(rows => {
      if (cancelled) return
      setResults(rows)
      setActiveIdx(0)
    }).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [parsed.tsqueryInput, parsed.empty, parsed.tooShort, runSearch])

  if (!open) return null

  return (
    <div
      role="dialog" aria-modal="true" aria-label="Search across all projects"
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1060,
        backgroundColor: 'rgba(26, 22, 19, 0.45)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: 80, paddingLeft: 16, paddingRight: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(720px, 100%)',
          maxHeight: 'calc(100vh - 120px)',
          display: 'flex', flexDirection: 'column',
          backgroundColor: 'var(--color-surfaceRaised, #FFFFFF)',
          border: '1px solid var(--hairline)',
          borderRadius: 12,
          overflow: 'hidden',
          boxShadow: '0 24px 60px rgba(26, 22, 19, 0.20)',
        }}
      >
        {/* Input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'], padding: spacing['3'], borderBottom: '1px solid var(--hairline)' }}>
          <Search size={16} style={{ color: colors.ink3 }} />
          <input
            ref={inputRef}
            type="text"
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose()
              else if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(flatOrdered.length - 1, i + 1)) }
              else if (e.key === 'ArrowUp')   { e.preventDefault(); setActiveIdx(i => Math.max(0, i - 1)) }
              else if (e.key === 'Enter' && flatOrdered[activeIdx]) onSelect(flatOrdered[activeIdx])
            }}
            placeholder="Search across all projects — RFIs, submittals, punch, drawings…"
            style={{
              flex: 1, border: 'none', outline: 'none',
              fontFamily: typography.fontFamily, fontSize: 16, color: colors.ink,
              backgroundColor: 'transparent',
            }}
          />
          <button onClick={onClose} aria-label="Close" style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: colors.ink3, padding: 4 }}>
            <X size={16} />
          </button>
        </div>

        {/* Results */}
        <div style={{ flex: 1, overflowY: 'auto', padding: spacing['2'] }}>
          {parsed.empty && (
            <p style={{ padding: spacing['4'], fontFamily: typography.fontFamilySerif, fontStyle: 'italic', color: colors.ink3, textAlign: 'center' }}>
              Type to search across every project you have access to.
            </p>
          )}
          {parsed.tooShort && (
            <p style={{ padding: spacing['4'], fontFamily: typography.fontFamily, fontSize: 12, color: colors.ink3, textAlign: 'center' }}>
              Keep typing — at least 2 characters.
            </p>
          )}
          {!parsed.empty && !parsed.tooShort && loading && results.length === 0 && (
            <p style={{ padding: spacing['4'], fontFamily: typography.fontFamily, fontSize: 12, color: colors.ink3, textAlign: 'center' }}>
              Searching…
            </p>
          )}
          {!parsed.empty && !parsed.tooShort && !loading && results.length === 0 && (
            <p style={{ padding: spacing['4'], fontFamily: typography.fontFamilySerif, fontStyle: 'italic', color: colors.ink3, textAlign: 'center' }}>
              No matches.
            </p>
          )}
          {(() => {
            let cursor = -1
            return TYPE_ORDER.map(t => {
              const rows = grouped[t] ?? []
              if (rows.length === 0) return null
              return (
                <div key={t} style={{ marginBottom: spacing['3'] }}>
                  <Eyebrow style={{ padding: `${spacing['2']} ${spacing['3']} ${spacing['1']}`, display: 'block' }}>
                    {TYPE_HEADER[t]} <span style={{ color: colors.ink4, fontWeight: 400 }}>· {rows.length}</span>
                  </Eyebrow>
                  {rows.map(r => {
                    cursor += 1
                    return (
                      <SearchResultRow
                        key={`${r.entity_type}-${r.entity_id}`}
                        row={r}
                        highlights={parsed.highlights}
                        projectName={projectNames.get(r.project_id) ?? '(project)'}
                        active={cursor === activeIdx}
                        onClick={() => onSelect(r)}
                      />
                    )
                  })}
                </div>
              )
            })
          })()}
        </div>

        {/* Footer */}
        {results.length > 0 && (
          <>
            <Hairline weight={2} spacing="tight" style={{ margin: 0 }} />
            <div style={{
              padding: `${spacing['2']} ${spacing['3']}`,
              fontFamily: typography.fontFamily, fontSize: 11, color: colors.ink3,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span>↑↓ navigate · Enter to open · Esc to close</span>
              <span>{results.length} result{results.length === 1 ? '' : 's'}</span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
