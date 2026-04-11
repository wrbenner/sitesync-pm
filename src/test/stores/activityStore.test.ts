import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock supabase before importing the store
const mockFrom = vi.fn()
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}))

import { useActivityStore } from '../../stores/activityStore'
import type { ActivityEntry } from '../../stores/activityStore'

function resetStore() {
  useActivityStore.setState({
    activities: [],
    loading: false,
  })
}

function buildChain(data: unknown[], error: unknown = null) {
  const limit = vi.fn().mockResolvedValue({ data, error })
  const order = vi.fn().mockReturnValue({ limit })
  const eq = vi.fn().mockReturnValue({ order })
  const select = vi.fn().mockReturnValue({ eq })
  mockFrom.mockReturnValue({ select })
}

const SAMPLE_ROW = {
  id: 'act-1',
  activity_type: 'rfi',
  user_name: 'Sarah Chen',
  user_initials: 'SC',
  action: 'submitted',
  target: 'RFI-042',
  created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
  comment_count: 2,
  preview: 'Curtain wall detail question',
  photo_url: null,
}

describe('activityStore', () => {
  beforeEach(() => {
    resetStore()
    vi.clearAllMocks()
  })

  describe('initial state', () => {
    it('should start with empty activities', () => {
      expect(useActivityStore.getState().activities).toHaveLength(0)
    })

    it('should start not loading', () => {
      expect(useActivityStore.getState().loading).toBe(false)
    })
  })

  describe('addActivity', () => {
    it('should add activity to the front of the list', () => {
      useActivityStore.getState().addActivity({
        type: 'rfi',
        user: 'Mike Torres',
        userInitials: 'MT',
        action: 'created',
        target: 'RFI-043',
        commentCount: 0,
      })
      const activities = useActivityStore.getState().activities
      expect(activities).toHaveLength(1)
      expect(activities[0].target).toBe('RFI-043')
    })

    it('should generate numeric id', () => {
      useActivityStore.getState().addActivity({
        type: 'task',
        user: 'John Smith',
        userInitials: 'JS',
        action: 'completed',
        target: 'Foundation pour',
        commentCount: 1,
      })
      const id = useActivityStore.getState().activities[0].id
      expect(typeof id).toBe('number')
    })

    it('should set timestamp to now', () => {
      const before = Date.now()
      useActivityStore.getState().addActivity({
        type: 'punch',
        user: 'Alice Wong',
        userInitials: 'AW',
        action: 'closed',
        target: 'P-012',
        commentCount: 0,
      })
      const after = Date.now()
      const ts = useActivityStore.getState().activities[0].timestamp.getTime()
      expect(ts).toBeGreaterThanOrEqual(before)
      expect(ts).toBeLessThanOrEqual(after)
    })

    it('should prepend to existing activities', () => {
      useActivityStore.getState().addActivity({
        type: 'rfi', user: 'A', userInitials: 'A', action: 'x', target: 'First', commentCount: 0,
      })
      useActivityStore.getState().addActivity({
        type: 'rfi', user: 'B', userInitials: 'B', action: 'y', target: 'Second', commentCount: 0,
      })
      expect(useActivityStore.getState().activities[0].target).toBe('Second')
      expect(useActivityStore.getState().activities[1].target).toBe('First')
    })
  })

  describe('getFiltered', () => {
    beforeEach(() => {
      const activities: ActivityEntry[] = [
        { id: 1, type: 'rfi', user: 'A', userInitials: 'A', action: 'created', target: 'RFI-001', timestamp: new Date(), commentCount: 0 },
        { id: 2, type: 'task', user: 'B', userInitials: 'B', action: 'done', target: 'Task-001', timestamp: new Date(), commentCount: 1 },
        { id: 3, type: 'rfi', user: 'C', userInitials: 'C', action: 'closed', target: 'RFI-002', timestamp: new Date(), commentCount: 0 },
        { id: 4, type: 'punch', user: 'D', userInitials: 'D', action: 'added', target: 'P-001', timestamp: new Date(), commentCount: 0 },
      ]
      useActivityStore.setState({ activities, loading: false })
    })

    it('should return all activities for filter "all"', () => {
      const result = useActivityStore.getState().getFiltered('all')
      expect(result).toHaveLength(4)
    })

    it('should filter by type "rfi"', () => {
      const result = useActivityStore.getState().getFiltered('rfi')
      expect(result).toHaveLength(2)
      expect(result.every(a => a.type === 'rfi')).toBe(true)
    })

    it('should filter by type "task"', () => {
      const result = useActivityStore.getState().getFiltered('task')
      expect(result).toHaveLength(1)
      expect(result[0].target).toBe('Task-001')
    })

    it('should return empty array for unknown type', () => {
      const result = useActivityStore.getState().getFiltered('nonexistent')
      expect(result).toHaveLength(0)
    })

    it('should return empty array when store is empty', () => {
      useActivityStore.setState({ activities: [], loading: false })
      const result = useActivityStore.getState().getFiltered('all')
      expect(result).toHaveLength(0)
    })
  })

  describe('loadActivities', () => {
    it('should set loading to true then false on success', async () => {
      buildChain([SAMPLE_ROW])
      const promise = useActivityStore.getState().loadActivities('proj-001')
      expect(useActivityStore.getState().loading).toBe(true)
      await promise
      expect(useActivityStore.getState().loading).toBe(false)
    })

    it('should populate activities from supabase response', async () => {
      buildChain([SAMPLE_ROW])
      await useActivityStore.getState().loadActivities('proj-001')
      const activities = useActivityStore.getState().activities
      expect(activities).toHaveLength(1)
      expect(activities[0].user).toBe('Sarah Chen')
      expect(activities[0].target).toBe('RFI-042')
    })

    it('should map activity_type to type field', async () => {
      buildChain([{ ...SAMPLE_ROW, activity_type: 'submittal' }])
      await useActivityStore.getState().loadActivities('proj-001')
      expect(useActivityStore.getState().activities[0].type).toBe('submittal')
    })

    it('should default type to task when activity_type is null', async () => {
      buildChain([{ ...SAMPLE_ROW, activity_type: null }])
      await useActivityStore.getState().loadActivities('proj-001')
      expect(useActivityStore.getState().activities[0].type).toBe('task')
    })

    it('should default user to Unknown when user_name is null', async () => {
      buildChain([{ ...SAMPLE_ROW, user_name: null, user_initials: null }])
      await useActivityStore.getState().loadActivities('proj-001')
      expect(useActivityStore.getState().activities[0].user).toBe('Unknown')
    })

    it('should handle supabase error gracefully', async () => {
      const limit = vi.fn().mockResolvedValue({ data: null, error: new Error('DB error') })
      const order = vi.fn().mockReturnValue({ limit })
      const eq = vi.fn().mockReturnValue({ order })
      const select = vi.fn().mockReturnValue({ eq })
      mockFrom.mockReturnValue({ select })

      await useActivityStore.getState().loadActivities('proj-001')
      expect(useActivityStore.getState().activities).toHaveLength(0)
      expect(useActivityStore.getState().loading).toBe(false)
    })

    it('should handle empty response', async () => {
      buildChain([])
      await useActivityStore.getState().loadActivities('proj-001')
      expect(useActivityStore.getState().activities).toHaveLength(0)
    })

    it('should parse timestamp from created_at', async () => {
      buildChain([SAMPLE_ROW])
      await useActivityStore.getState().loadActivities('proj-001')
      const ts = useActivityStore.getState().activities[0].timestamp
      expect(ts instanceof Date).toBe(true)
    })
  })
})
