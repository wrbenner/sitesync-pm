import React, { useCallback, useRef, useState } from 'react'
import { Plus, Save } from 'lucide-react'
import { Whiteboard } from '../../components/shared/Whiteboard'
import type { WhiteboardData } from '../../components/shared/Whiteboard'
import { PageContainer, Btn, useToast } from '../../components/Primitives'
import {
  colors,
  spacing,
  typography,
  borderRadius,

  transitions,
  layout,
} from '../../styles/theme'

// ── Types ─────────────────────────────────────────────────

interface SavedBoard {
  id: string
  name: string
  data: WhiteboardData
  updatedAt: string
}

function generateBoardId(): string {
  return `board_${Date.now()}_${crypto.randomUUID().slice(0, 7)}`
}

const EMPTY_DATA: WhiteboardData = {
  elements: [],
  viewportX: 0,
  viewportY: 0,
  zoom: 1,
}

// ── Component ─────────────────────────────────────────────

export const WhiteboardPage: React.FC = () => {
  const toast = useToast()
  const [boardId, setBoardId] = useState(() => generateBoardId())
  const [boardName, setBoardName] = useState('Untitled Whiteboard')
  const [isEditingName, setIsEditingName] = useState(false)
  const [boardData, setBoardData] = useState<WhiteboardData>(EMPTY_DATA)
  const nameInputRef = useRef<HTMLInputElement>(null)
  const whiteboardKeyRef = useRef(0)

  // ── Handlers ──────────────────────────────────────────────

  const handleSave = useCallback(() => {
    // Get current data from Whiteboard via window hack
    const getData = (window as unknown as Record<string, unknown>).__whiteboardGetData as (() => WhiteboardData) | undefined
    const data = getData ? getData() : boardData

    const saved: SavedBoard = {
      id: boardId,
      name: boardName,
      data,
      updatedAt: new Date().toISOString(),
    }

    // Store in localStorage. Bugatti Sev-1 closure: the previous version
    // silently swallowed quota errors and unconditionally toasted "saved
    // successfully" — so a full localStorage looked like a successful save
    // until the next reload revealed the loss. Now we surface the real
    // outcome with a typed error message.
    let saveError: string | null = null
    try {
      const existing = JSON.parse(localStorage.getItem('sitesync_whiteboards') ?? '[]') as unknown as SavedBoard[]
      const idx = existing.findIndex(b => b.id === boardId)
      if (idx >= 0) existing[idx] = saved
      else existing.push(saved)
      localStorage.setItem('sitesync_whiteboards', JSON.stringify(existing))
    } catch (err) {
      // QuotaExceededError is the dominant case — browser cap is ~5MB total.
      // SecurityError fires in private mode on some browsers. Either way,
      // the board was NOT persisted; tell the user explicitly.
      const isQuota =
        err instanceof DOMException &&
        (err.name === 'QuotaExceededError' || err.code === 22 || err.code === 1014)
      saveError = isQuota
        ? 'Browser storage is full. Delete an older whiteboard or export this one.'
        : err instanceof Error
          ? err.message
          : 'Could not save this whiteboard. Try again.'
    }

    if (toast?.addToast) {
      if (saveError) toast.addToast('error', saveError)
      else toast.addToast('success', 'Board saved successfully')
    }
  }, [boardId, boardName, boardData, toast])

  const handleNewBoard = useCallback(() => {
    whiteboardKeyRef.current += 1
    setBoardId(generateBoardId())
    setBoardName('Untitled Whiteboard')
    setBoardData(EMPTY_DATA)
  }, [])

  const handleNameClick = useCallback(() => {
    setIsEditingName(true)
    setTimeout(() => nameInputRef.current?.select(), 50)
  }, [])

  const handleNameBlur = useCallback(() => {
    setIsEditingName(false)
    if (!boardName.trim()) setBoardName('Untitled Whiteboard')
  }, [boardName])

  const handleNameKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === 'Escape') {
      setIsEditingName(false)
      if (!boardName.trim()) setBoardName('Untitled Whiteboard')
    }
  }, [boardName])

  // ── Header actions ────────────────────────────────────────

  const headerActions = (
    <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'] }}>
      <Btn
        icon={<Plus size={16} />}
        variant="secondary"
        size="sm"
        onClick={handleNewBoard}
      >
        New Board
      </Btn>
      <Btn
        icon={<Save size={16} />}
        variant="primary"
        size="sm"
        onClick={handleSave}
      >
        Save
      </Btn>
    </div>
  )

  return (
    <PageContainer
      title=""
      actions={headerActions}
      aria-label="Whiteboard"
    >
      {/* Inline-editable board name */}
      <div style={{ marginBottom: spacing['4'], display: 'flex', alignItems: 'center', gap: spacing['3'] }}>
        {isEditingName ? (
          <input
            ref={nameInputRef}
            value={boardName}
            onChange={e => setBoardName(e.target.value)}
            onBlur={handleNameBlur}
            onKeyDown={handleNameKeyDown}
            autoFocus
            style={{
              fontSize: typography.fontSize.large,
              fontWeight: typography.fontWeight.semibold,
              fontFamily: typography.fontFamily,
              color: colors.textPrimary,
              border: `1px solid ${colors.borderFocus}`,
              borderRadius: borderRadius.md,
              padding: `${spacing['1']} ${spacing['2']}`,
              background: colors.surfaceRaised,
              outline: 'none',
              minWidth: 200,
              lineHeight: typography.lineHeight.tight,
            }}
          />
        ) : (
          <h1
            onClick={handleNameClick}
            title="Click to rename"
            style={{
              fontSize: typography.fontSize.large,
              fontWeight: typography.fontWeight.semibold,
              fontFamily: typography.fontFamily,
              color: colors.textPrimary,
              margin: 0,
              cursor: 'text',
              padding: `${spacing['1']} ${spacing['2']}`,
              borderRadius: borderRadius.md,
              transition: transitions.quick,
              border: '1px solid transparent',
              lineHeight: typography.lineHeight.tight,
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = colors.surfaceHover
              ;(e.currentTarget as HTMLElement).style.borderColor = colors.borderSubtle
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = 'transparent'
              ;(e.currentTarget as HTMLElement).style.borderColor = 'transparent'
            }}
          >
            {boardName}
          </h1>
        )}
      </div>

      {/* Whiteboard at full remaining height */}
      <div style={{ height: `calc(100vh - ${layout.topbarHeight} - 140px)` }}>
        <Whiteboard
          key={whiteboardKeyRef.current}
          initialData={boardData}
          onSave={setBoardData}
          height="100%"
        />
      </div>
    </PageContainer>
  )
}

export default WhiteboardPage
