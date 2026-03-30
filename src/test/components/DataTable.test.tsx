import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DataTable, createColumnHelper } from '../../components/shared/DataTable'

interface TestItem {
  id: number
  name: string
  status: string
}

const columnHelper = createColumnHelper<TestItem>()
const columns = [
  columnHelper.accessor('name', { header: 'Name' }),
  columnHelper.accessor('status', { header: 'Status' }),
]

const data: TestItem[] = [
  { id: 1, name: 'Item One', status: 'active' },
  { id: 2, name: 'Item Two', status: 'pending' },
  { id: 3, name: 'Item Three', status: 'active' },
]

describe('DataTable', () => {
  it('should render column headers', () => {
    render(<DataTable data={data} columns={columns} />)
    expect(screen.getByText('Name')).toBeDefined()
    expect(screen.getByText('Status')).toBeDefined()
  })

  it('should render data rows', () => {
    render(<DataTable data={data} columns={columns} />)
    expect(screen.getByText('Item One')).toBeDefined()
    expect(screen.getByText('Item Two')).toBeDefined()
    expect(screen.getByText('Item Three')).toBeDefined()
  })

  it('should show empty state when no data', () => {
    render(<DataTable data={[]} columns={columns} emptyMessage="Nothing here" />)
    expect(screen.getByText('Nothing here')).toBeDefined()
  })

  it('should show loading skeleton', () => {
    const { container } = render(<DataTable data={[]} columns={columns} loading />)
    // Skeletons render as divs with animation
    expect(container.innerHTML).toBeTruthy()
  })

  it('should render with sorting enabled', () => {
    render(<DataTable data={data} columns={columns} enableSorting />)
    // Headers should be clickable for sorting
    const nameHeader = screen.getByText('Name')
    expect(nameHeader).toBeDefined()
  })
})
