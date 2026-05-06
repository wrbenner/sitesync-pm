/**
 * sw-field-capture.js — service worker for the durable capture queue.
 *
 * Registered from the app shell. Listens for the 'sync' event (Background
 * Sync API) and a periodic timer fallback for browsers without that API.
 * On sync, opens the same IndexedDB store the in-tab queue uses and posts
 * each ready item to the project's sync endpoint.
 *
 * NOTE: This is a v1 stub. The actual draining + auth-token reuse needs
 * the parent to register('sync', ...) and to establish a credentials
 * channel between the tab and the SW (postMessage of the bearer). For
 * now the SW survives quiet-tab and reawakens when a tag is registered.
 */

const QUEUE_DB = 'sitesync-field-capture'
const QUEUE_STORE = 'queue'
const SYNC_TAG = 'field-capture-drain'

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting())
})
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

// Background Sync — fired when connectivity returns.
self.addEventListener('sync', (event) => {
  if (event.tag !== SYNC_TAG) return
  event.waitUntil(drainQueue())
})

// One-shot manual nudge from the page: navigator.serviceWorker.controller.postMessage('drain')
self.addEventListener('message', (event) => {
  if (event.data === 'drain') event.waitUntil(drainQueue())
})

async function drainQueue() {
  // The actual handler uses an auth token passed via postMessage from the
  // main thread; in v1 we ping the page to take over. This keeps secrets
  // out of the SW and avoids storing them in IndexedDB.
  const clientList = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' })
  for (const client of clientList) {
    client.postMessage({ kind: 'sw-drain-request' })
  }
}
