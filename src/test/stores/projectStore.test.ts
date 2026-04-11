import { describe, it, expect, beforeEach } from 'vitest'
import { useProjectStore } from '../../stores/projectStore'
import type { ProjectData, Metrics } from '../../stores/projectStore'

const SAMPLE_PROJECT: ProjectData = {
  id: 'proj-001',
  organizationId: 'org-001',
  name: 'Downtown Office Tower',
  address: '123 Main St, Phoenix AZ',
  type: 'commercial',
  totalValue: 15_000_000,
  status: 'active',
  completionPercentage: 45,
  daysRemaining: 180,
  startDate: '2025-01-01',
  scheduledEndDate: '2026-06-30',
  actualEndDate: null,
  owner: 'Acme Development',
  architect: 'Smith + Partners',
  contractor: 'BuildCo GC',
  description: 'Mixed use tower with 20 floors',
}

const SAMPLE_METRICS: Metrics = {
  progress: 45,
  budgetSpent: 6_750_000,
  budgetTotal: 15_000_000,
  crewsActive: 4,
  workersOnSite: 32,
  rfiOpen: 8,
  rfiOverdue: 2,
  punchListOpen: 0,
  aiHealthScore: 82,
  daysBeforeSchedule: 5,
  milestonesHit: 3,
  milestoneTotal: 8,
  aiConfidenceLevel: 0.87,
}

function resetStore() {
  useProjectStore.setState({
    activeProject: null,
    projectList: [],
    metrics: null,
    loading: false,
    error: null,
  })
}

describe('projectStore', () => {
  beforeEach(resetStore)

  describe('initial state', () => {
    it('should have null active project', () => {
      expect(useProjectStore.getState().activeProject).toBeNull()
    })

    it('should have empty project list', () => {
      expect(useProjectStore.getState().projectList).toHaveLength(0)
    })

    it('should have null metrics', () => {
      expect(useProjectStore.getState().metrics).toBeNull()
    })
  })

  describe('setActiveProject', () => {
    it('should set active project', () => {
      useProjectStore.getState().setActiveProject(SAMPLE_PROJECT)
      expect(useProjectStore.getState().activeProject).toEqual(SAMPLE_PROJECT)
    })

    it('should clear active project when set to null', () => {
      useProjectStore.setState({ activeProject: SAMPLE_PROJECT })
      useProjectStore.getState().setActiveProject(null)
      expect(useProjectStore.getState().activeProject).toBeNull()
    })

    it('should replace active project with new one', () => {
      useProjectStore.getState().setActiveProject(SAMPLE_PROJECT)
      const newProject = { ...SAMPLE_PROJECT, id: 'proj-002', name: 'Warehouse Complex' }
      useProjectStore.getState().setActiveProject(newProject)
      expect(useProjectStore.getState().activeProject?.name).toBe('Warehouse Complex')
    })

    it('should store all project fields', () => {
      useProjectStore.getState().setActiveProject(SAMPLE_PROJECT)
      const stored = useProjectStore.getState().activeProject!
      expect(stored.totalValue).toBe(15_000_000)
      expect(stored.completionPercentage).toBe(45)
      expect(stored.actualEndDate).toBeNull()
    })
  })

  describe('setProjectList', () => {
    it('should set project list', () => {
      const projects = [SAMPLE_PROJECT, { ...SAMPLE_PROJECT, id: 'proj-002', name: 'Warehouse' }]
      useProjectStore.getState().setProjectList(projects)
      expect(useProjectStore.getState().projectList).toHaveLength(2)
    })

    it('should replace existing project list', () => {
      useProjectStore.setState({ projectList: [SAMPLE_PROJECT] })
      useProjectStore.getState().setProjectList([])
      expect(useProjectStore.getState().projectList).toHaveLength(0)
    })

    it('should preserve all project data in list', () => {
      useProjectStore.getState().setProjectList([SAMPLE_PROJECT])
      const first = useProjectStore.getState().projectList[0]
      expect(first.name).toBe('Downtown Office Tower')
      expect(first.address).toBe('123 Main St, Phoenix AZ')
    })
  })

  describe('setMetrics', () => {
    it('should set metrics', () => {
      useProjectStore.getState().setMetrics(SAMPLE_METRICS)
      expect(useProjectStore.getState().metrics).toEqual(SAMPLE_METRICS)
    })

    it('should clear metrics when set to null', () => {
      useProjectStore.setState({ metrics: SAMPLE_METRICS })
      useProjectStore.getState().setMetrics(null)
      expect(useProjectStore.getState().metrics).toBeNull()
    })

    it('should store metrics with null ai fields', () => {
      const metricsNoAI: Metrics = { ...SAMPLE_METRICS, aiHealthScore: null, aiConfidenceLevel: null }
      useProjectStore.getState().setMetrics(metricsNoAI)
      expect(useProjectStore.getState().metrics?.aiHealthScore).toBeNull()
    })

    it('should store financial metrics', () => {
      useProjectStore.getState().setMetrics(SAMPLE_METRICS)
      const m = useProjectStore.getState().metrics!
      expect(m.budgetSpent).toBe(6_750_000)
      expect(m.rfiOpen).toBe(8)
      expect(m.rfiOverdue).toBe(2)
    })
  })
})
