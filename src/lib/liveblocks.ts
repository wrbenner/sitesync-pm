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
  avatar: string | null
  color: string
}

type Storage = {
  // Collaborative document content
}

export const {
  RoomProvider,
  useOthers,
  useSelf,
  useMyPresence,
  useUpdateMyPresence,
} = createRoomContext<Presence, Storage>(client)
