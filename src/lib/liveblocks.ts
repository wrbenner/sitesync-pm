import { createClient } from '@liveblocks/client'
import { createRoomContext } from '@liveblocks/react'

const client = createClient({
  authEndpoint: import.meta.env.VITE_LIVEBLOCKS_AUTH_ENDPOINT || undefined,
  publicApiKey: import.meta.env.VITE_LIVEBLOCKS_PUBLIC_KEY || undefined,
})

type Presence = {
  cursor: { x: number; y: number } | null
  page: string
  name: string
  initials: string
  avatar: string | null
  color: string
}

type Storage = {
  // Collaborative document content
}

// Markup event payload shared between DrawingViewer broadcast and remote apply
export type DrawingMarkupPayload = {
  id: number
  tool: string
  x: number
  y: number
  endX?: number
  endY?: number
  text?: string
}

type RoomEvent =
  | { type: 'MARKUP_ADD'; markup: DrawingMarkupPayload }
  | { type: 'MARKUP_DELETE'; id: number }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const {
  RoomProvider,
  useOthers,
  useSelf,
  useMyPresence,
  useUpdateMyPresence,
  useBroadcastEvent,
  useEventListener,
} = createRoomContext<Presence, Storage, { id: string }, RoomEvent>(client)
