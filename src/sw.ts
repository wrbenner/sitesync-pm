/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'
import { registerRoute, NavigationRoute } from 'workbox-routing'
import { CacheFirst, NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'
import { BackgroundSyncPlugin } from 'workbox-background-sync'
import { CacheableResponsePlugin } from 'workbox-cacheable-response'

declare const self: ServiceWorkerGlobalScope

// ── 1. Precache app shell ────────────────────────────────
// Vite + workbox-build injects the manifest at build time
precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

// ── 2. Navigation requests: serve app shell ──────────────
// SPA: all navigation requests get the cached index.html
registerRoute(
  new NavigationRoute(
    new NetworkFirst({
      cacheName: 'app-shell',
      plugins: [
        new CacheableResponsePlugin({ statuses: [200] }),
      ],
    })
  )
)

// ── 3. Static assets: cache first (fonts, images, icons) ─
registerRoute(
  ({ request }) =>
    request.destination === 'image' ||
    request.destination === 'font' ||
    request.destination === 'manifest',
  new CacheFirst({
    cacheName: 'static-assets',
    plugins: [
      new ExpirationPlugin({ maxEntries: 150, maxAgeSeconds: 30 * 24 * 60 * 60 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  })
)

// ── 4. JS/CSS bundles: stale-while-revalidate ────────────
registerRoute(
  ({ request }) =>
    request.destination === 'script' || request.destination === 'style',
  new StaleWhileRevalidate({
    cacheName: 'app-bundles',
    plugins: [
      new ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 7 * 24 * 60 * 60 }),
    ],
  })
)

// ── 5. API GET requests: network first with cache fallback
registerRoute(
  ({ url }) =>
    (url.pathname.includes('/rest/v1/') || url.hostname.includes('supabase')) &&
    !url.pathname.includes('/auth/'),
  new NetworkFirst({
    cacheName: 'api-cache',
    plugins: [
      new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 24 * 60 * 60 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  }),
  'GET'
)

// ── 6. API mutations: background sync when offline ───────
const bgSyncPlugin = new BackgroundSyncPlugin('mutations-queue', {
  maxRetentionTime: 48 * 60, // 48 hours
  onSync: async ({ queue }) => {
    let entry;
    while ((entry = await queue.shiftRequest())) {
      try {
        await fetch(entry.request.clone())
      } catch (error) {
        await queue.unshiftRequest(entry)
        throw error
      }
    }
    // Notify the app that sync completed
    const clients = await self.clients.matchAll({ type: 'window' })
    for (const client of clients) {
      client.postMessage({ type: 'BACKGROUND_SYNC_COMPLETE' })
    }
  },
})

registerRoute(
  ({ url, request }) =>
    (url.pathname.includes('/rest/v1/') || url.hostname.includes('supabase')) &&
    request.method !== 'GET',
  new NetworkFirst({ plugins: [bgSyncPlugin] }),
  'POST'
)

registerRoute(
  ({ url, request }) =>
    (url.pathname.includes('/rest/v1/') || url.hostname.includes('supabase')) &&
    (request.method === 'PATCH' || request.method === 'DELETE'),
  new NetworkFirst({ plugins: [bgSyncPlugin] }),
  'PATCH'
)

// ── 7. Listen for skip waiting (app update flow) ─────────
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

// ── 8. Notify clients when new SW activates ──────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Claim all open clients immediately
      await self.clients.claim()

      // Notify all windows that a new version is active
      const clients = await self.clients.matchAll({ type: 'window' })
      for (const client of clients) {
        client.postMessage({ type: 'SW_ACTIVATED' })
      }
    })()
  )
})
