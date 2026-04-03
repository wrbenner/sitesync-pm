import { useCallback, useMemo } from 'react'
import { useQuery } from './useQuery'
import { useProjectId } from './useProjectId'
import { fetchBudgetDivisions } from '../api/endpoints/budget'
import type { MappedChangeOrder } from '../api/endpoints/budget'
import { getSchedulePhases } from '../api/endpoints/schedule'
import type { BudgetItemRow, ScheduleActivity } from '../types/api'
import type { InvoiceRow } from '../types/financial'

export interface BudgetData {
  budgetItems: BudgetItemRow[]
  changeOrders: MappedChangeOrder[]
  invoices: InvoiceRow[]
  scheduleActivities: ScheduleActivity[]
  loading: boolean
  refetch: () => void
}

export function useBudgetData(): BudgetData {
  const projectId = useProjectId()

  const { data: costData, loading: costLoading, refetch: refetchCost } = useQuery(
    `cost-data-${projectId}`,
    () => fetchBudgetDivisions(projectId!),
    { enabled: !!projectId },
  )

  const { data: scheduleData, loading: scheduleLoading, refetch: refetchSchedule } = useQuery(
    `schedule-phases-${projectId}`,
    () => getSchedulePhases(projectId!),
    { enabled: !!projectId },
  )

  const refetch = useCallback(() => {
    void refetchCost()
    void refetchSchedule()
  }, [refetchCost, refetchSchedule])

  // Derive invoices from budget items: each item with actual spend represents an approved cost
  const invoices = useMemo<InvoiceRow[]>(
    () =>
      (costData?.budgetItems ?? [])
        .filter(b => (b.actual_amount ?? 0) > 0)
        .map(b => ({
          id: b.id,
          total: b.actual_amount!,
          status: 'approved',
        })),
    [costData?.budgetItems],
  )

  return {
    budgetItems: costData?.budgetItems ?? [],
    changeOrders: costData?.changeOrders ?? [],
    invoices,
    scheduleActivities: scheduleData ?? [],
    loading: costLoading || scheduleLoading,
    refetch,
  }
}
