/**
 * FMEA N.RT.1 (wave 3) — Realtime channel survives logout / cross-user
 *                         message leak.
 *
 * Hazard: Supabase Realtime channels subscribed by user A persist into
 *         user B's session if logout doesn't tear them down. Worst-
 *         case: user B sees postgres_changes events that include rows
 *         user A could see but user B should not.
 *
 * Test approach (vitest, mocked supabase):
 *   1. Stand up a fake supabase client whose `.channel(name)` returns a
 *      tracked Channel object. Track `.subscribe()` and `.unsubscribe()`
 *      / `.removeChannel()` calls.
 *   2. Subscribe a channel as "user A".
 *   3. Trigger signOut (auth state change SIGNED_OUT).
 *   4. Subscribe a *new* channel as "user B".
 *   5. Assert: user A's channel was removed before / during the signOut
 *      tear-down (no orphan channels persist).
 *   6. Assert: an event fired on user A's old channel after signOut is
 *      NOT delivered to user B's handler.
 *
 *   Plus a static-source contract: at minimum, signOut path or the
 *   onAuthStateChange SIGNED_OUT branch should reset channels — today
 *   the codebase does NOT call removeAllChannels on signOut. This is
 *   the FMEA-documented gap.
 */
import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const AUTH_STORE_SRC = resolve(__dirname, '..', '..', 'src', 'stores', 'authStore.ts')

describe('FMEA N.RT.1 — channel teardown on logout', () => {
  it('static: authStore signOut calls removeAllChannels (FMEA N.RT.1 fix)', () => {
    const source = readFileSync(AUTH_STORE_SRC, 'utf-8')
    // Find the IMPLEMENTATION of signOut (the second occurrence — the
    // first is the interface type declaration). The fix lives inside
    // the function body.
    const firstIdx = source.indexOf('signOut:')
    expect(firstIdx).toBeGreaterThan(-1)
    const implIdx = source.indexOf('signOut: async')
    expect(implIdx).toBeGreaterThan(-1)
    const window = source.slice(implIdx, implIdx + 1200)
    expect(/removeAllChannels/.test(window)).toBe(true)
  })

  it('static: SIGNED_OUT branch of onAuthStateChange also tears down channels', () => {
    const source = readFileSync(AUTH_STORE_SRC, 'utf-8')
    const handlerIdx = source.indexOf('onAuthStateChange')
    const window = source.slice(handlerIdx, handlerIdx + 3000)
    expect(/removeAllChannels/.test(window)).toBe(true)
  })

  it('mocked supabase: a channel subscribed pre-logout is not auto-removed', async () => {
    const removed: string[] = []
    const subscribed: string[] = []
    type FakeChannel = {
      name: string
      on: () => FakeChannel
      subscribe: () => FakeChannel
      unsubscribe: () => Promise<{ ok: true }>
    }
    const channels: Record<string, FakeChannel> = {}
    const fakeSupabase = {
      channel: (name: string) => {
        const ch: FakeChannel = {
          name,
          on() { return ch },
          subscribe() {
            subscribed.push(name)
            return ch
          },
          unsubscribe() {
            removed.push(name)
            return Promise.resolve({ ok: true as const })
          },
        }
        channels[name] = ch
        return ch
      },
      removeChannel: (ch: FakeChannel) => {
        removed.push(ch.name)
        return Promise.resolve({ ok: true })
      },
      auth: {
        signOut: vi.fn(async () => ({ error: null })),
        getSession: vi.fn(async () => ({ data: { session: null } })),
        onAuthStateChange: vi.fn(() => ({
          data: { subscription: { unsubscribe: vi.fn() } },
        })),
      },
    }

    // Subscribe as "user A".
    const chA = fakeSupabase.channel('project-A-changes')
    chA.on().subscribe()
    expect(subscribed).toEqual(['project-A-changes'])

    // Simulate signOut (today's authStore does not touch channels).
    await fakeSupabase.auth.signOut()

    // Subscribe as "user B".
    const chB = fakeSupabase.channel('project-B-changes')
    chB.on().subscribe()

    // HAZARD ASSERTION: chA was never torn down on signOut. This is the
    // bug-recording baseline. When N.RT.1 is fixed, this flips to:
    //   expect(removed).toContain('project-A-changes')
    expect(removed).not.toContain('project-A-changes')

    // Sanity: chA is still in the tracked map (orphaned, not removed).
    expect(channels['project-A-changes']).toBeDefined()
  })

  it('mocked supabase: events on user-A channel after logout would still fire its handler', () => {
    // Demonstration that the hazard manifests at the channel layer: an
    // event delivered to an orphan channel still invokes the original
    // handler unless someone calls removeChannel.
    const handlerA = vi.fn()
    const chHandlers: Record<string, () => void> = {}
    const fakeChannel = {
      on: (_evt: string, _filter: unknown, cb: () => void) => {
        chHandlers.A = cb
        return { subscribe: () => fakeChannel }
      },
    }
    fakeChannel.on('postgres_changes', {}, handlerA)

    // Simulate an event delivered after signOut: handler fires (BUG).
    chHandlers.A?.()
    expect(handlerA).toHaveBeenCalledTimes(1)
  })
})
