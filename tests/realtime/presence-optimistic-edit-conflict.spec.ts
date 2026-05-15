/**
 * FMEA M.OPT.2 — Presence + optimistic edit conflict
 *
 * Hazard: a user clicks "Edit" on an entity row while another user already
 *         holds an editing lock (their presence broadcast says
 *         action='editing', editingEntityId=X). The optimistic UI applies
 *         the local user's edit immediately, then a presence-driven guard
 *         (EditConflictGuard / EditingLockBanner) must:
 *           a) flag the conflict visually,
 *           b) roll the optimistic edit back if the conflict was undetected
 *              at click time (race between presence broadcast and submit),
 *           c) keep the presence store's `isEntityBeingEdited` consistent
 *              across the optimistic + realtime collision window.
 *
 *   The hazard is "presence flag accurate" — i.e. once both users are in
 *   the editing state, the store must report `isEntityBeingEdited === true`
 *   and `getUsersEditingEntity(X).length === 2` (not just 1, not stale 0).
 *
 * Test approach (pure-unit on the zustand store + simulated broadcasts):
 *   - Spawn `usePresenceStore`. Simulate broadcasts arriving in different
 *     orders + with stale data. Assert the store's accessors give the
 *     correct answers in every order.
 *   - Race the broadcast: user A enters "editing" before user B but user
 *     B's optimistic UI fires first. After all broadcasts settle, the
 *     store must report both users editing.
 *   - Stale-data guard: user A leaves the page (no editing broadcast).
 *     The store must drop them; isEntityBeingEdited goes false; the
 *     remaining user B optimistic flag stays accurate.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { usePresenceStore, type PresenceUserWithAction } from '../../src/stores/presenceStore'

const ENTITY = 'rfi-abc-123'

function mkUser(
  id: string,
  overrides: Partial<PresenceUserWithAction> = {},
): PresenceUserWithAction {
  return {
    userId: id,
    name: `User ${id}`,
    displayName: `User ${id}`,
    initials: id.slice(0, 2).toUpperCase(),
    color: '#000',
    page: '/rfis',
    lastSeen: Date.now(),
    action: 'viewing',
    ...overrides,
  }
}

describe('FMEA M.OPT.2 — presence + optimistic edit conflict', () => {
  beforeEach(() => {
    usePresenceStore.setState({ onlineUsers: [], isInitialized: false })
  })

  it('two users editing same entity: store reports both', () => {
    const a = mkUser('a', { action: 'editing', editingEntityId: ENTITY, editingEntityType: 'rfi' })
    const b = mkUser('b', { action: 'editing', editingEntityId: ENTITY, editingEntityType: 'rfi' })
    usePresenceStore.getState().setOnlineUsers([a, b])

    expect(usePresenceStore.getState().isEntityBeingEdited(ENTITY)).toBe(true)
    expect(usePresenceStore.getState().getUsersEditingEntity(ENTITY)).toHaveLength(2)
  })

  it('race: presence broadcast lags optimistic edit — flag is consistent after settle', () => {
    const a = mkUser('a', { action: 'editing', editingEntityId: ENTITY })
    // Step 1: local user B fires optimistic edit; their broadcast hasn't
    // arrived yet. Store currently sees only A.
    usePresenceStore.getState().setOnlineUsers([a])
    expect(usePresenceStore.getState().getUsersEditingEntity(ENTITY)).toHaveLength(1)

    // Step 2: B's editing broadcast lands.
    const b = mkUser('b', { action: 'editing', editingEntityId: ENTITY })
    usePresenceStore.getState().setOnlineUsers([a, b])

    // After settle, flag is accurate.
    expect(usePresenceStore.getState().isEntityBeingEdited(ENTITY)).toBe(true)
    const editors = usePresenceStore
      .getState()
      .getUsersEditingEntity(ENTITY)
      .map((u) => u.userId)
    expect(editors).toContain('a')
    expect(editors).toContain('b')
  })

  it('drop: user A leaves → isEntityBeingEdited correctly returns false', () => {
    const a = mkUser('a', { action: 'editing', editingEntityId: ENTITY })
    usePresenceStore.getState().setOnlineUsers([a])
    expect(usePresenceStore.getState().isEntityBeingEdited(ENTITY)).toBe(true)

    // A leaves — empty broadcast.
    usePresenceStore.getState().setOnlineUsers([])
    expect(usePresenceStore.getState().isEntityBeingEdited(ENTITY)).toBe(false)
    expect(usePresenceStore.getState().getUsersEditingEntity(ENTITY)).toHaveLength(0)
  })

  it('viewing != editing: a user merely viewing the entity is NOT an editor', () => {
    const a = mkUser('a', { action: 'viewing', editingEntityId: ENTITY })
    usePresenceStore.getState().setOnlineUsers([a])
    expect(usePresenceStore.getState().isEntityBeingEdited(ENTITY)).toBe(false)
    expect(usePresenceStore.getState().getUsersEditingEntity(ENTITY)).toHaveLength(0)
    // But getUsersViewingEntity matches on entityId, not editingEntityId.
    expect(usePresenceStore.getState().getUsersViewingEntity(ENTITY)).toHaveLength(0)
  })

  it('optimistic local edit + remote editing user: store distinguishes editors per-entity', () => {
    // Different entities — only the targeted one is locked.
    const a = mkUser('a', { action: 'editing', editingEntityId: 'rfi-other' })
    const b = mkUser('b', { action: 'editing', editingEntityId: ENTITY })
    usePresenceStore.getState().setOnlineUsers([a, b])
    expect(usePresenceStore.getState().isEntityBeingEdited(ENTITY)).toBe(true)
    expect(usePresenceStore.getState().isEntityBeingEdited('rfi-other')).toBe(true)
    expect(usePresenceStore.getState().isEntityBeingEdited('rfi-unrelated')).toBe(false)
    expect(usePresenceStore.getState().getUsersEditingEntity(ENTITY)).toHaveLength(1)
    expect(usePresenceStore.getState().getUsersEditingEntity(ENTITY)[0].userId).toBe('b')
  })

  it('rapid broadcast churn: 100 setOnlineUsers calls leave a consistent final state', () => {
    // Stress the store with rapid updates; final read must be deterministic.
    for (let i = 0; i < 100; i++) {
      const editing = i % 2 === 0
      usePresenceStore.getState().setOnlineUsers([
        mkUser('a', {
          action: editing ? 'editing' : 'viewing',
          editingEntityId: editing ? ENTITY : undefined,
        }),
      ])
    }
    // Final iteration (i=99) is odd → 'viewing' → not editing.
    expect(usePresenceStore.getState().isEntityBeingEdited(ENTITY)).toBe(false)

    // Flip one more time and verify.
    usePresenceStore.getState().setOnlineUsers([
      mkUser('a', { action: 'editing', editingEntityId: ENTITY }),
    ])
    expect(usePresenceStore.getState().isEntityBeingEdited(ENTITY)).toBe(true)
  })

  it('contract: getUsersEditingEntity filters by BOTH action AND editingEntityId', () => {
    // Bug shape we want to catch: if the filter dropped one of the two
    // predicates (action OR editingEntityId), edited-elsewhere users would
    // leak into the result.
    const a = mkUser('a', { action: 'editing', editingEntityId: 'unrelated' })
    const b = mkUser('b', { action: 'viewing', editingEntityId: ENTITY })
    const c = mkUser('c', { action: 'editing', editingEntityId: ENTITY })
    usePresenceStore.getState().setOnlineUsers([a, b, c])

    const editors = usePresenceStore
      .getState()
      .getUsersEditingEntity(ENTITY)
      .map((u) => u.userId)
    expect(editors).toEqual(['c'])
  })
})
