// ─────────────────────────────────────────────────────────────────────────────
// ActorContext — audit attribution surface (Tab C / Wave 1)
// ─────────────────────────────────────────────────────────────────────────────
// Threads the current actor identity through the React tree so audit writers
// downstream can stamp hash-chain entries with `actor_kind`. Two paths feed it:
//   - authenticated user session (kind: 'user', actor_id = user.id)
//   - magic-link sub access     (kind: 'magic_link', + magic_link_token_id +
//                                 companyId from token validation)
//
// Default value is 'user' with no ids — pages that read this context outside
// the magic-link route fall through to whatever auth provider supplies.
// ─────────────────────────────────────────────────────────────────────────────

import React, { createContext, useContext, useMemo } from 'react'
import type { ActorContext as ActorContextValue } from '../types/stream'

const DEFAULT_ACTOR: ActorContextValue = { kind: 'user' }

const ActorReactContext = createContext<ActorContextValue>(DEFAULT_ACTOR)

interface ActorProviderProps {
  value: ActorContextValue
  children: React.ReactNode
}

export const ActorProvider: React.FC<ActorProviderProps> = ({ value, children }) => {
  // Stable identity per (kind, userId, magicLinkTokenId, companyId) tuple so
  // children that memoize on the context don't churn from a new object every
  // render of the parent.
  const memoized = useMemo<ActorContextValue>(
    () => ({
      kind: value.kind,
      userId: value.userId,
      magicLinkTokenId: value.magicLinkTokenId,
      companyId: value.companyId,
    }),
    [value.kind, value.userId, value.magicLinkTokenId, value.companyId],
  )
  return <ActorReactContext.Provider value={memoized}>{children}</ActorReactContext.Provider>
}

export function useActor(): ActorContextValue {
  return useContext(ActorReactContext)
}
