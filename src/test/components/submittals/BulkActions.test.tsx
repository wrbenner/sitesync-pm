// Phase 3 — BulkActionsMenu enable/disable + dispatch tests.
//
// Real-DOM exercise of the bulk actions menu (the toolbar trigger lives
// in the page itself; here we cover the menu component shipped to consumers).

import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('../../../components/auth/PermissionGate', () => ({
  PermissionGate: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('../../../services/submittalService', () => ({
  submittalService: {
    deleteSubmittal: vi.fn().mockResolvedValue({ data: null, error: null }),
    distribute: vi.fn().mockResolvedValue({ data: null, error: null }),
  },
}))

import { BulkActionsMenu } from '../../../components/submittals/BulkActionsMenu'

const baseProps = {
  selectedIds: ['a', 'b', 'c'],
  onClose: vi.fn(),
  onOpenEdit: vi.fn(),
  onOpenDistribute: vi.fn(),
  onClearSelection: vi.fn(),
}

describe('BulkActionsMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the section header with selected count', () => {
    render(<BulkActionsMenu {...baseProps} />)
    expect(screen.getByLabelText(/Bulk actions for 3 submittals/i)).toBeInTheDocument()
  })

  it('Edit menu item invokes onOpenEdit', () => {
    render(<BulkActionsMenu {...baseProps} />)
    fireEvent.click(screen.getByRole('menuitem', { name: /^Edit$/i }))
    expect(baseProps.onOpenEdit).toHaveBeenCalledTimes(1)
  })

  it('Distribute menu item invokes onOpenDistribute (delegates to dialog)', () => {
    render(<BulkActionsMenu {...baseProps} />)
    fireEvent.click(screen.getByRole('menuitem', { name: /Distribute to Field/i }))
    expect(baseProps.onOpenDistribute).toHaveBeenCalledTimes(1)
    expect(baseProps.onClose).toHaveBeenCalledTimes(1)
  })

  it('disables Re-run Iris Pre-flight (Phase 4 stub)', () => {
    render(<BulkActionsMenu {...baseProps} />)
    const item = screen.getByRole('menuitem', { name: /Re-run Iris Pre-flight/i })
    expect(item).toBeDisabled()
  })

  it('disables Generate Stamp PDF (Phase 4 stub)', () => {
    render(<BulkActionsMenu {...baseProps} />)
    const item = screen.getByRole('menuitem', { name: /Generate Stamp PDF/i })
    expect(item).toBeDisabled()
  })

  it('Delete requires DELETE confirmation (cancels on mismatch)', async () => {
    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValueOnce('cancel')
    const { submittalService } = await import('../../../services/submittalService')
    render(<BulkActionsMenu {...baseProps} />)
    fireEvent.click(screen.getByRole('menuitem', { name: /^Delete$/i }))
    await waitFor(() => {
      expect(submittalService.deleteSubmittal).not.toHaveBeenCalled()
    })
    promptSpy.mockRestore()
  })

  it('Delete fans out per-row when confirmation matches', async () => {
    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValueOnce('DELETE')
    const { submittalService } = await import('../../../services/submittalService')
    render(<BulkActionsMenu {...baseProps} />)
    fireEvent.click(screen.getByRole('menuitem', { name: /^Delete$/i }))
    await waitFor(() => {
      expect(submittalService.deleteSubmittal).toHaveBeenCalledTimes(3)
    })
    expect(baseProps.onClearSelection).toHaveBeenCalled()
    promptSpy.mockRestore()
  })
})
