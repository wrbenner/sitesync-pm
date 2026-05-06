import { createClient } from '@liveblocks/client'
import { createRoomContext } from '@liveblocks/react'

const authEndpoint: string | undefined = import.meta.env.VITE_LIVEBLOCKS_AUTH_ENDPOINT || undefined
const client = createClient(authEndpoint
  ? { authEndpoint }
  : { publicApiKey: import.meta.env.VITE_LIVEBLOCKS_PUBLIC_KEY || 'pk_dev_placeholder_not_active' }
)

type Presence = {
  cursor: { x: number; y: number } | null
  page: string
  name: string
  initials: string
  avatar: string | null
  color: string
}

type Storage = Record<string, never>

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

export const {
  RoomProvider,
  useOthers,
  useSelf,
  useMyPresence,
  useUpdateMyPresence,
  useBroadcastEvent,
  useEventListener,
} = createRoomContext<Presence, Storage, { id: string }, RoomEvent>(client)
