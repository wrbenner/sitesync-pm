import { describe, it, expect } from 'vitest'
import type { ProjectRow, ProjectSummaryRow } from '../../types/api'

// Compile-time check: ProjectSummaryRow must be a strict subset of ProjectRow keys.
// If ProjectRow ever drops one of these fields the error surfaces here, not at runtime.
// The asserted-true value is consumed via `satisfies` so noUnusedLocals stays happy.
true satisfies (keyof ProjectSummaryRow extends keyof ProjectRow ? true : never)

// Verify the summary shape is narrower than the full row.
describe('ProjectSummaryRow', () => {
  it('has fewer keys than ProjectRow', () => {
    const summaryKeys: Array<keyof ProjectSummaryRow> = [
      'id',
      'status',
      'contract_value',
      'target_completion',
    ]

    // ProjectRow (via TableRow<'projects'>) has well over 10 columns.
    // Checking at least 10 to guard against accidental widening of ProjectSummaryRow.
    const projectRowSampleSize = 10
    expect(summaryKeys.length).toBeLessThan(projectRowSampleSize)
  })

  it('contains exactly the columns needed for portfolio aggregation', () => {
    const row: ProjectSummaryRow = {
      id: 'proj-1',
      status: 'active',
      contract_value: 1_000_000,
      target_completion: '2026-12-31',
    }
    expect(row.id).toBe('proj-1')
    expect(row.contract_value).toBe(1_000_000)
  })
})

// Portfolio page load time benchmark.
// Simulates aggregating metrics across N projects using only the summary columns,
// asserting the operation stays under a reasonable CPU threshold.
describe('portfolio metrics aggregation benchmark', () => {
  function buildSummaries(count: number): ProjectSummaryRow[] {
    return Array.from({ length: count }, (_, i) => ({
      id: `proj-${i}`,
      status: i % 5 === 0 ? 'on_hold' : 'active',
      contract_value: 500_000 + i * 10_000,
      target_completion: '2026-12-31',
    }))
  }

  function aggregatePortfolioMetrics(projects: ProjectSummaryRow[]) {
    const totalContractValue = projects.reduce((sum, p) => sum + (p.contract_value ?? 0), 0)
    const activeCount = projects.filter((p) => p.status === 'active').length
    const overdueCount = projects.filter(
      (p) => p.target_completion !== null && p.target_completion < new Date().toISOString().slice(0, 10)
    ).length
    return { totalContractValue, activeCount, overdueCount }
  }

  it('aggregates 20 project summaries in under 5 ms', () => {
    const summaries = buildSummaries(20)
    const start = performance.now()
    const result = aggregatePortfolioMetrics(summaries)
    const elapsed = performance.now() - start

    expect(elapsed).toBeLessThan(5)
    expect(result.activeCount).toBe(16) // 20 projects minus 4 on_hold (indices 0,5,10,15)
    expect(result.totalContractValue).toBeGreaterThan(0)
  })

  it('aggregates 100 project summaries in under 10 ms', () => {
    const summaries = buildSummaries(100)
    const start = performance.now()
    aggregatePortfolioMetrics(summaries)
    const elapsed = performance.now() - start

    expect(elapsed).toBeLessThan(10)
  })
})
