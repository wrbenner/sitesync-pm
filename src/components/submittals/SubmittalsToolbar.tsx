// Phase 1 — toolbar shell. Search · Add Filter ▾ · Bulk Actions ▾ on the
// left; 1-N of M counter + page selector on the right. The Add Filter +
// Bulk Actions menus are stubs — Phase 3 wires them.

import React from 'react'
import { Search, Filter, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'

const C = {
  ink: '#1A1613',
  ink2: '#5C5550',
  ink3: '#8C857E',
  ink4: '#C4BDB4',
  border: 'rgba(26, 22, 19, 0.10)',
  borderSubtle: 'rgba(26, 22, 19, 0.05)',
  surface: '#FCFCFA',
  surfaceAlt: '#F5F5F1',
  surfaceHover: '#F0EFEB',
}

const FONT = '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'

export interface SubmittalsToolbarProps {
  searchQuery: string
  onSearchChange: (q: string) => void
  rangeFrom: number
  rangeTo: number
  totalCount: number
  selectedCount: number
  onPagePrev?: () => void
  onPageNext?: () => void
  hasPrev?: boolean
  hasNext?: boolean
  /** Phase 2: clicked when ≥ 1 row is selected. Phase 3 wires the menu;
   *  Phase 2 just surfaces a toast. */
  onBulkActions?: () => void
  /** Phase 3 slot — replaces the stub Add Filter button when provided. */
  addFilterSlot?: React.ReactNode
  /** Phase 3 slot — replaces the stub Bulk Actions button when provided. */
  bulkActionsSlot?: React.ReactNode
}

export const SubmittalsToolbar: React.FC<SubmittalsToolbarProps> = ({
  searchQuery,
  onSearchChange,
  rangeFrom,
  rangeTo,
  totalCount,
  selectedCount,
  onPagePrev,
  onPageNext,
  hasPrev = false,
  hasNext = false,
  onBulkActions,
  addFilterSlot,
  bulkActionsSlot,
}) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '10px 24px',
      borderBottom: `1px solid ${C.borderSubtle}`,
      backgroundColor: C.surface,
      flexWrap: 'wrap',
    }}
  >
    <div style={{ position: 'relative', width: 240 }}>
      <Search
        size={13}
        style={{
          position: 'absolute',
          left: 9,
          top: '50%',
          transform: 'translateY(-50%)',
          color: C.ink3,
          pointerEvents: 'none',
        }}
      />
      <input
        type="search"
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Search submittals…"
        aria-label="Search submittals"
        style={{
          width: '100%',
          padding: '6px 10px 6px 28px',
          minHeight: 30,
          border: `1px solid ${C.border}`,
          borderRadius: 4,
          fontSize: 12,
          fontFamily: FONT,
          backgroundColor: '#fff',
          color: C.ink,
          outline: 'none',
        }}
      />
    </div>

    {addFilterSlot ?? (
      <ToolbarStubButton ariaLabel="Add filter" disabled>
        <Filter size={12} />
        Add Filter
        <ChevronDown size={11} />
      </ToolbarStubButton>
    )}

    {bulkActionsSlot ?? (
      <ToolbarStubButton
        ariaLabel="Bulk actions"
        disabled={selectedCount === 0}
        title={selectedCount === 0 ? 'Select rows to enable bulk actions' : 'Bulk actions'}
        onClick={selectedCount > 0 ? onBulkActions : undefined}
      >
        Bulk Actions
        {selectedCount > 0 && <span style={{ color: C.ink2 }}>({selectedCount})</span>}
        <ChevronDown size={11} />
      </ToolbarStubButton>
    )}

    <div style={{ flex: 1 }} />
    <div
      aria-label="Result count"
      style={{
        fontSize: 12,
        color: C.ink2,
        fontFamily: FONT,
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {totalCount === 0 ? '0 of 0' : `${rangeFrom}-${rangeTo} of ${totalCount}`}
    </div>

    <div role="group" aria-label="Page navigation" style={{ display: 'inline-flex', gap: 2 }}>
      <PageBtn aria-label="Previous page" disabled={!hasPrev} onClick={onPagePrev}>
        <ChevronLeft size={12} />
      </PageBtn>
      <PageBtn aria-label="Next page" disabled={!hasNext} onClick={onPageNext}>
        <ChevronRight size={12} />
      </PageBtn>
    </div>
  </div>
)

interface ToolbarStubButtonProps {
  ariaLabel: string
  children: React.ReactNode
  disabled?: boolean
  title?: string
  onClick?: () => void
}

const ToolbarStubButton: React.FC<ToolbarStubButtonProps> = ({
  ariaLabel,
  children,
  disabled,
  title,
  onClick,
}) => (
  <button
    type="button"
    aria-label={ariaLabel}
    aria-haspopup="menu"
    title={title}
    disabled={disabled}
    onClick={onClick}
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
      padding: '5px 10px',
      minHeight: 30,
      border: `1px solid ${C.border}`,
      borderRadius: 4,
      backgroundColor: '#fff',
      color: disabled ? C.ink4 : C.ink,
      cursor: disabled ? 'not-allowed' : 'pointer',
      fontFamily: FONT,
      fontSize: 12,
      fontWeight: 500,
      opacity: disabled ? 0.65 : 1,
    }}
  >
    {children}
  </button>
)

const PageBtn: React.FC<{
  children: React.ReactNode
  disabled?: boolean
  onClick?: () => void
  'aria-label'?: string
}> = ({ children, disabled, onClick, ...rest }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    {...rest}
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 28,
      height: 28,
      padding: 0,
      border: `1px solid ${C.border}`,
      borderRadius: 4,
      backgroundColor: '#fff',
      color: disabled ? C.ink4 : C.ink,
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.55 : 1,
    }}
  >
    {children}
  </button>
)

export default SubmittalsToolbar
