import { describe, it, expect, beforeEach } from 'vitest'
import { useProjectStore } from '../../stores/projectStore'
import type { ProjectData, Metrics } from '../../stores/projectStore'

// ── Helpers ────────────────────────────────────────────────────────────────

function makeProject(overrides: Partial<ProjectData> = {}): ProjectData {
  return {
    id: 'proj-1',
    organizationId: 'org-1',
    name: 'Downtown Office Tower',
    address: '123 Main St',
    type: 'Commercial',
    totalValue: 52_000_000,
    status: 'active',
    completionPercentage: 45,
    daysRemaining: 340,
    startDate: '2024-01-15',
    scheduledEndDate: '2027-03-31',
    actualEndDate: null,
    owner: 'Acme Development Corp',
    architect: 'Smith & Associates',
    contractor: 'BuildRight GC',
    description: 'Class A office tower, 24 floors',
    ...overrides,
  }
}

function makeMetrics(overrides: Partial<Metrics> = {}): Metrics {
  return {
    progress: 45,
    budgetSpent: 23_400_000,
    budgetTotal: 52_000_000,
    crewsActive: 12,
    workersOnSite: 87,
    rfiOpen: 14,
    rfiOverdue: 3,
    punchListOpen: 0,
    aiHealthScore: 78,
    daysBeforeSchedule: 2,
    milestonesHit: 7,
    milestoneTotal: 12,
    aiConfidenceLevel: 0.82,
    ...overrides,
  }
}

// ── Setup ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  useProjectStore.setState({
    activeProject: null,
    projectList: [],
    metrics: null,
    loading: false,
    error: null,
  })
})

// ── setActiveProject ───────────────────────────────────────────────────────

describe('setActiveProject', () => {
  it('should start with no active project', () => {
    expect(useProjectStore.getState().activeProject).toBeNull()
  })

  it('should set an active project', () => {
    const project = makeProject()
    useProjectStore.getState().setActiveProject(project)
    expect(useProjectStore.getState().activeProject).toEqual(project)
  })

  it('should replace the previous active project', () => {
    useProjectStore.getState().setActiveProject(makeProject({ id: 'proj-1', name: 'First Project' }))
    useProjectStore.getState().setActiveProject(makeProject({ id: 'proj-2', name: 'Second Project' }))
    expect(useProjectStore.getState().activeProject?.id).toBe('proj-2')
    expect(useProjectStore.getState().activeProject?.name).toBe('Second Project')
  })

  it('should clear the active project when set to null', () => {
    useProjectStore.getState().setActiveProject(makeProject())
    useProjectStore.getState().setActiveProject(null)
    expect(useProjectStore.getState().activeProject).toBeNull()
  })

  it('should preserve all project fields', () => {
    const project = makeProject({
      completionPercentage: 72,
      daysRemaining: 120,
      totalValue: 15_000_000,
    })
    useProjectStore.getState().setActiveProject(project)
    const stored = useProjectStore.getState().activeProject
    expect(stored?.completionPercentage).toBe(72)
    expect(stored?.daysRemaining).toBe(120)
    expect(stored?.totalValue).toBe(15_000_000)
  })
})

// ── setProjectList ─────────────────────────────────────────────────────────

describe('setProjectList', () => {
  it('should start with empty project list', () => {
    expect(useProjectStore.getState().projectList).toHaveLength(0)
  })

  it('should set the project list', () => {
    const projects = [makeProject({ id: 'p1' }), makeProject({ id: 'p2' }), makeProject({ id: 'p3' })]
    useProjectStore.getState().setProjectList(projects)
    expect(useProjectStore.getState().projectList).toHaveLength(3)
  })

  it('should replace an existing project list', () => {
    useProjectStore.getState().setProjectList([makeProject({ id: 'p1' }), makeProject({ id: 'p2' })])
    useProjectStore.getState().setProjectList([makeProject({ id: 'p3' })])
    expect(useProjectStore.getState().projectList).toHaveLength(1)
    expect(useProjectStore.getState().projectList[0].id).toBe('p3')
  })

  it('should accept an empty array to clear the list', () => {
    useProjectStore.getState().setProjectList([makeProject()])
    useProjectStore.getState().setProjectList([])
    expect(useProjectStore.getState().projectList).toHaveLength(0)
  })

  it('should preserve the order of projects', () => {
    const projects = ['Alpha', 'Beta', 'Gamma'].map((name, i) =>
      makeProject({ id: `p${i + 1}`, name })
    )
    useProjectStore.getState().setProjectList(projects)
    const stored = useProjectStore.getState().projectList
    expect(stored[0].name).toBe('Alpha')
    expect(stored[1].name).toBe('Beta')
    expect(stored[2].name).toBe('Gamma')
  })
})

// ── setMetrics ─────────────────────────────────────────────────────────────

describe('setMetrics', () => {
  it('should start with null metrics', () => {
    expect(useProjectStore.getState().metrics).toBeNull()
  })

  it('should set metrics', () => {
    const metrics = makeMetrics()
    useProjectStore.getState().setMetrics(metrics)
    expect(useProjectStore.getState().metrics).toEqual(metrics)
  })

  it('should replace existing metrics', () => {
    useProjectStore.getState().setMetrics(makeMetrics({ progress: 30 }))
    useProjectStore.getState().setMetrics(makeMetrics({ progress: 60 }))
    expect(useProjectStore.getState().metrics?.progress).toBe(60)
  })

  it('should clear metrics when set to null', () => {
    useProjectStore.getState().setMetrics(makeMetrics())
    useProjectStore.getState().setMetrics(null)
    expect(useProjectStore.getState().metrics).toBeNull()
  })

  it('should handle metrics with null AI fields', () => {
    const metrics = makeMetrics({ aiHealthScore: null, aiConfidenceLevel: null })
    useProjectStore.getState().setMetrics(metrics)
    const stored = useProjectStore.getState().metrics
    expect(stored?.aiHealthScore).toBeNull()
    expect(stored?.aiConfidenceLevel).toBeNull()
  })

  it('should preserve all metric fields', () => {
    const metrics = makeMetrics({
      rfiOpen: 25,
      rfiOverdue: 8,
      workersOnSite: 143,
      milestonesHit: 5,
      milestoneTotal: 20,
    })
    useProjectStore.getState().setMetrics(metrics)
    const stored = useProjectStore.getState().metrics
    expect(stored?.rfiOpen).toBe(25)
    expect(stored?.rfiOverdue).toBe(8)
    expect(stored?.workersOnSite).toBe(143)
    expect(stored?.milestonesHit).toBe(5)
    expect(stored?.milestoneTotal).toBe(20)
  })
})

// ── Independent state fields ───────────────────────────────────────────────

describe('state independence', () => {
  it('should not affect projectList when setting activeProject', () => {
    const projects = [makeProject({ id: 'p1' }), makeProject({ id: 'p2' })]
    useProjectStore.getState().setProjectList(projects)
    useProjectStore.getState().setActiveProject(makeProject({ id: 'p3' }))
    // projectList should be unchanged
    expect(useProjectStore.getState().projectList).toHaveLength(2)
  })

  it('should not affect metrics when setting activeProject', () => {
    const metrics = makeMetrics({ progress: 55 })
    useProjectStore.getState().setMetrics(metrics)
    useProjectStore.getState().setActiveProject(makeProject())
    expect(useProjectStore.getState().metrics?.progress).toBe(55)
  })

  it('should not affect activeProject when setting projectList', () => {
    const active = makeProject({ id: 'active-proj' })
    useProjectStore.getState().setActiveProject(active)
    useProjectStore.getState().setProjectList([makeProject({ id: 'list-proj' })])
    expect(useProjectStore.getState().activeProject?.id).toBe('active-proj')
  })
})
