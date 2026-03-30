import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ExportButton } from '../../components/shared/ExportButton'

describe('ExportButton', () => {
  it('should render export button', () => {
    render(<ExportButton onExportCSV={() => {}} />)
    expect(screen.getByText('Export')).toBeDefined()
  })

  it('should show dropdown on click', () => {
    render(<ExportButton onExportCSV={() => {}} />)
    fireEvent.click(screen.getByText('Export'))
    expect(screen.getByText('Export CSV')).toBeDefined()
  })

  it('should call CSV export handler', () => {
    const handler = vi.fn()
    render(<ExportButton onExportCSV={handler} />)
    fireEvent.click(screen.getByText('Export'))
    fireEvent.click(screen.getByText('Export CSV'))
    expect(handler).toHaveBeenCalledOnce()
  })
})
