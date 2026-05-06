/**
 * useInboxSession — stable per-inbox-mount session UUID for Iris telemetry.
 *
 * Why a context, not just `useState`:
 *   The session id needs to be the same for every draft card the user
 *   reviews in one inbox sitting, so the materialized view can answer
 *   "how many drafts did the user decide in one session" without joining
 *   to a sessions table. A context shared by the inbox tree gives every
 *   `IrisApprovalGate` the same id.
 *
 * Outside the provider (e.g. an approval gate rendered on an RFI detail
 * page), `useInboxSession()` returns null — those decisions are not
 * inbox-sittings and shouldn't be counted as such. The RPC accepts null
 * and leaves `inbox_session_id` unset.
 */

import { createContext, useContext, useState, type ReactNode, createElement } from 'react'

const InboxSessionContext = createContext<string | null>(null)

export function InboxSessionProvider({ children }: { children: ReactNode }) {
  const [sessionId] = useState(() => crypto.randomUUID())
  return createElement(InboxSessionContext.Provider, { value: sessionId }, children)
}

/** The current inbox session id, or null when outside an InboxSessionProvider. */
export function useInboxSession(): string | null {
  return useContext(InboxSessionContext)
}
