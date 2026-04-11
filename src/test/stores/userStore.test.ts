import { describe, it, expect, beforeEach } from 'vitest'
import { useUserStore } from '../../stores/userStore'
import type { AppUser } from '../../stores/userStore'

const DEFAULT_USER: AppUser = {
  id: 'dev-user',
  name: 'Development User',
  initials: 'DU',
  email: 'dev@sitesync.ai',
  role: 'project_manager',
  company: 'SiteSync AI',
}

function resetStore() {
  useUserStore.setState({
    currentUser: DEFAULT_USER,
    isAuthenticated: false,
    preferences: { compactView: false },
  })
}

describe('userStore', () => {
  beforeEach(resetStore)

  describe('initial state', () => {
    it('should start unauthenticated', () => {
      expect(useUserStore.getState().isAuthenticated).toBe(false)
    })

    it('should have development user as default', () => {
      expect(useUserStore.getState().currentUser.id).toBe('dev-user')
    })

    it('should default to project_manager role', () => {
      expect(useUserStore.getState().currentUser.role).toBe('project_manager')
    })

    it('should default compactView to false', () => {
      expect(useUserStore.getState().preferences.compactView).toBe(false)
    })
  })

  describe('setCurrentUser', () => {
    it('should set user and mark as authenticated', () => {
      useUserStore.getState().setCurrentUser({
        id: 'user-123',
        email: 'sam@buildco.com',
        name: 'Sam Johnson',
        role: 'superintendent',
        company: 'BuildCo',
      })
      const state = useUserStore.getState()
      expect(state.isAuthenticated).toBe(true)
      expect(state.currentUser.id).toBe('user-123')
      expect(state.currentUser.role).toBe('superintendent')
    })

    it('should derive name from email when name not provided', () => {
      useUserStore.getState().setCurrentUser({
        id: 'user-456',
        email: 'mike@contractor.com',
      })
      expect(useUserStore.getState().currentUser.name).toBe('mike')
    })

    it('should generate initials from full name', () => {
      useUserStore.getState().setCurrentUser({
        id: 'user-789',
        email: 'test@test.com',
        name: 'Maria Garcia',
      })
      expect(useUserStore.getState().currentUser.initials).toBe('MG')
    })

    it('should generate single initial from single name', () => {
      useUserStore.getState().setCurrentUser({
        id: 'user-abc',
        email: 'test@test.com',
        name: 'Alex',
      })
      expect(useUserStore.getState().currentUser.initials).toBe('A')
    })

    it('should use uppercase initials', () => {
      useUserStore.getState().setCurrentUser({
        id: 'user-def',
        email: 'test@test.com',
        name: 'john doe',
      })
      expect(useUserStore.getState().currentUser.initials).toBe('JD')
    })

    it('should truncate initials to 2 characters', () => {
      useUserStore.getState().setCurrentUser({
        id: 'user-ghi',
        email: 'test@test.com',
        name: 'John Michael Doe Smith',
      })
      expect(useUserStore.getState().currentUser.initials.length).toBeLessThanOrEqual(2)
    })

    it('should default role to project_manager when not provided', () => {
      useUserStore.getState().setCurrentUser({
        id: 'user-jkl',
        email: 'test@test.com',
      })
      expect(useUserStore.getState().currentUser.role).toBe('project_manager')
    })

    it('should store avatar when provided', () => {
      useUserStore.getState().setCurrentUser({
        id: 'user-mno',
        email: 'test@test.com',
        avatar: 'https://example.com/avatar.jpg',
      })
      expect(useUserStore.getState().currentUser.avatar).toBe('https://example.com/avatar.jpg')
    })

    it('should store company', () => {
      useUserStore.getState().setCurrentUser({
        id: 'user-pqr',
        email: 'bob@ironworks.com',
        company: 'Iron Works LLC',
      })
      expect(useUserStore.getState().currentUser.company).toBe('Iron Works LLC')
    })

    it('should default company to empty string when not provided', () => {
      useUserStore.getState().setCurrentUser({
        id: 'user-stu',
        email: 'test@test.com',
      })
      expect(useUserStore.getState().currentUser.company).toBe('')
    })
  })

  describe('clearUser', () => {
    it('should reset to default user', () => {
      useUserStore.getState().setCurrentUser({ id: 'u1', email: 'user@co.com', name: 'Some User' })
      useUserStore.getState().clearUser()
      expect(useUserStore.getState().currentUser.id).toBe('dev-user')
    })

    it('should mark as unauthenticated', () => {
      useUserStore.getState().setCurrentUser({ id: 'u1', email: 'user@co.com' })
      useUserStore.getState().clearUser()
      expect(useUserStore.getState().isAuthenticated).toBe(false)
    })
  })

  describe('setPreference', () => {
    it('should enable compact view', () => {
      useUserStore.getState().setPreference('compactView', true)
      expect(useUserStore.getState().preferences.compactView).toBe(true)
    })

    it('should disable compact view', () => {
      useUserStore.setState({ preferences: { compactView: true } })
      useUserStore.getState().setPreference('compactView', false)
      expect(useUserStore.getState().preferences.compactView).toBe(false)
    })
  })
})
