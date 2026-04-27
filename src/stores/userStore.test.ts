import { describe, it, expect, beforeEach } from 'vitest'
import { useUserStore } from './userStore'

beforeEach(() => {
  // Restore defaults: clearUser resets everything that the legacy setters touch.
  useUserStore.getState().clearUser()
  useUserStore.setState({
    preferences: { compactView: false },
    error: null,
    errorDetails: null,
  })
})

describe('userStore — initial state', () => {
  it('starts with the dev-user fallback (not authenticated)', () => {
    const s = useUserStore.getState()
    expect(s.currentUser.id).toBe('dev-user')
    expect(s.isAuthenticated).toBe(false)
  })

  it('starts with empty profile + role data', () => {
    const s = useUserStore.getState()
    expect(s.profile).toBeNull()
    expect(s.orgRole).toBeNull()
    expect(s.projectRole).toBeNull()
  })

  it('preferences start with compactView=false', () => {
    expect(useUserStore.getState().preferences.compactView).toBe(false)
  })
})

describe('userStore — setCurrentUser', () => {
  it('marks isAuthenticated true and copies the supplied fields', () => {
    useUserStore.getState().setCurrentUser({
      id: 'u-1',
      email: 'walker@example.com',
      name: 'Walker Benner',
      role: 'superintendent',
      company: 'SiteSync',
    })
    const s = useUserStore.getState()
    expect(s.isAuthenticated).toBe(true)
    expect(s.currentUser.id).toBe('u-1')
    expect(s.currentUser.email).toBe('walker@example.com')
    expect(s.currentUser.name).toBe('Walker Benner')
    expect(s.currentUser.role).toBe('superintendent')
    expect(s.currentUser.company).toBe('SiteSync')
  })

  it('derives initials from the supplied name (first 2 first-letters)', () => {
    useUserStore.getState().setCurrentUser({
      id: 'u',
      email: 'x@y.com',
      name: 'Alice Bob Carol',
    })
    expect(useUserStore.getState().currentUser.initials).toBe('AB')
  })

  it('falls back to the email local-part for the name when name is missing', () => {
    useUserStore.getState().setCurrentUser({
      id: 'u',
      email: 'walker.benner@example.com',
    })
    expect(useUserStore.getState().currentUser.name).toBe('walker.benner')
  })

  it('initials default to "U" when no derivable letters', () => {
    useUserStore.getState().setCurrentUser({
      id: 'u',
      email: '@example.com',
      name: '',
    })
    expect(useUserStore.getState().currentUser.initials).toBe('U')
  })

  it('role defaults to project_manager when not supplied', () => {
    useUserStore.getState().setCurrentUser({ id: 'u', email: 'a@b.com' })
    expect(useUserStore.getState().currentUser.role).toBe('project_manager')
  })

  it('company defaults to empty string when not supplied', () => {
    useUserStore.getState().setCurrentUser({ id: 'u', email: 'a@b.com' })
    expect(useUserStore.getState().currentUser.company).toBe('')
  })
})

describe('userStore — clearUser', () => {
  it('resets currentUser to the dev fallback and isAuthenticated to false', () => {
    useUserStore.getState().setCurrentUser({ id: 'u-1', email: 'a@b.com' })
    expect(useUserStore.getState().isAuthenticated).toBe(true)

    useUserStore.getState().clearUser()
    expect(useUserStore.getState().isAuthenticated).toBe(false)
    expect(useUserStore.getState().currentUser.id).toBe('dev-user')
  })

  it('clears profile + orgRole + projectRole', () => {
    useUserStore.setState({
      profile: { id: 'u-1' } as never,
      orgRole: 'admin',
      projectRole: 'project_manager',
    })
    useUserStore.getState().clearUser()
    expect(useUserStore.getState().profile).toBeNull()
    expect(useUserStore.getState().orgRole).toBeNull()
    expect(useUserStore.getState().projectRole).toBeNull()
  })

  it('clears error + errorDetails', () => {
    useUserStore.setState({ error: 'boom', errorDetails: { foo: 'bar' } as never })
    useUserStore.getState().clearUser()
    expect(useUserStore.getState().error).toBeNull()
    expect(useUserStore.getState().errorDetails).toBeNull()
  })
})

describe('userStore — setPreference', () => {
  it('updates a single preference key without touching others', () => {
    useUserStore.getState().setPreference('compactView', true)
    expect(useUserStore.getState().preferences.compactView).toBe(true)
  })

  it('merges new preferences over existing ones', () => {
    useUserStore.getState().setPreference('compactView', true)
    useUserStore.getState().setPreference('compactView', false)
    expect(useUserStore.getState().preferences.compactView).toBe(false)
  })
})

describe('userStore — clearError', () => {
  it('resets error and errorDetails', () => {
    useUserStore.setState({ error: 'oops', errorDetails: { foo: 'bar' } as never })
    useUserStore.getState().clearError()
    expect(useUserStore.getState().error).toBeNull()
    expect(useUserStore.getState().errorDetails).toBeNull()
  })
})
