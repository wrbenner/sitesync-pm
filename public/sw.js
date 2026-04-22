/**
 * SiteSync PM Service Worker
 * Provides offline support with:
 * - Cache-first for static assets (images, fonts, icons)
 * - Stale-while-revalidate for API requests
 * - Network-first with offline fallback for HTML navigation
 */

const CACHE_VERSION = 'v3';
const STATIC_CACHE = `sitesync-static-${CACHE_VERSION}`;
const API_CACHE = `sitesync-api-${CACHE_VERSION}`;
const APP_SHELL_CACHE = `sitesync-shell-${CACHE_VERSION}`;
const TILES_CACHE = `sitesync-tiles-${CACHE_VERSION}`;
const MAX_TILE_CACHE_SIZE = 500; // Max tiles in cache (512×512 JPEG ≈ 30KB each → ~15MB)

// App shell resources to precache on install (resolved relative to SW scope)
const SW_SCOPE = self.registration ? self.registration.scope : self.location.href.replace(/sw\.js$/, '');
const APP_SHELL_URLS = [
  new URL('./', SW_SCOPE).href,
  new URL('./manifest.json', SW_SCOPE).href,
  new URL('./favicon.svg', SW_SCOPE).href,
];

// ─── Install: precache app shell ────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(APP_SHELL_CACHE).then((cache) => cache.addAll(APP_SHELL_URLS))
  );
  self.skipWaiting();
});

// ─── Activate: clean up old caches ──────────────────────────────────────────
self.addEventListener('activate', (event) => {
  const currentCaches = [STATIC_CACHE, API_CACHE, APP_SHELL_CACHE, TILES_CACHE];
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => !currentCaches.includes(key))
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// ─── Fetch strategies ───────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip Supabase auth/realtime and external auth endpoints
  if (url.hostname.includes('supabase')) return;

  // Strategy 0: Cache-first for DZI tiles (critical for offline drawing viewing)
  if (isDrawingTile(url)) {
    event.respondWith(tileCacheFirst(request));
    return;
  }

  // Strategy 1: Cache-first for static assets (images, fonts, icons)
  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // Strategy 2: Stale-while-revalidate for API requests
  if (isApiRequest(url)) {
    event.respondWith(staleWhileRevalidate(request, API_CACHE));
    return;
  }

  // Strategy 3: Network-first with offline fallback for HTML navigation
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstWithFallback(request));
    return;
  }

  // Default: cache-first for JS/CSS bundles (app shell assets)
  if (url.pathname.endsWith('.js') || url.pathname.endsWith('.css')) {
    event.respondWith(cacheFirst(request, APP_SHELL_CACHE));
    return;
  }
});

// ─── Strategy implementations ───────────────────────────────────────────────

/**
 * Cache-first: serve from cache if available, otherwise fetch and cache.
 */
function cacheFirst(request, cacheName) {
  return caches.open(cacheName).then((cache) =>
    cache.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok) {
          cache.put(request, response.clone());
        }
        return response;
      });
    })
  );
}

/**
 * Stale-while-revalidate: serve from cache immediately, then update cache
 * in the background with a fresh network response.
 */
function staleWhileRevalidate(request, cacheName) {
  return caches.open(cacheName).then((cache) =>
    cache.match(request).then((cached) => {
      const fetchPromise = fetch(request)
        .then((response) => {
          if (response.ok) {
            cache.put(request, response.clone());
          }
          return response;
        })
        .catch(() => cached);

      return cached || fetchPromise;
    })
  );
}

/**
 * Network-first with offline fallback: try network, fall back to cached
 * HTML, or serve the cached root page as an SPA fallback.
 */
function networkFirstWithFallback(request) {
  return fetch(request)
    .then((response) => {
      const clone = response.clone();
      caches.open(APP_SHELL_CACHE).then((cache) => cache.put(request, clone));
      return response;
    })
    .catch(() =>
      caches.match(request).then((cached) => cached || caches.match(APP_SHELL_URLS[0]))
    );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Detect DZI tile requests — these are the 512×512 JPEG tiles served from
 * Supabase Storage under drawing-tiles/{drawingId}/tile_files/{level}/{col}_{row}.jpeg
 */
function isDrawingTile(url) {
  return (
    url.pathname.includes('drawing-tiles/') &&
    (url.pathname.endsWith('.jpeg') || url.pathname.endsWith('.jpg') || url.pathname.endsWith('.dzi'))
  );
}

/**
 * Tile cache-first with LRU eviction.
 * Tiles are immutable (same URL = same tile forever), so cache-first is safe.
 * We cap the cache at MAX_TILE_CACHE_SIZE entries to avoid filling device storage.
 */
function tileCacheFirst(request) {
  return caches.open(TILES_CACHE).then((cache) =>
    cache.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok) {
          cache.put(request, response.clone());
          // Evict oldest tiles if cache is too large
          trimTileCache(cache);
        }
        return response;
      }).catch(() => {
        // Offline and not cached — return a transparent 1x1 pixel
        return new Response(new Uint8Array([
          0x47,0x49,0x46,0x38,0x39,0x61,0x01,0x00,0x01,0x00,
          0x80,0x00,0x00,0xFF,0xFF,0xFF,0x00,0x00,0x00,0x21,
          0xF9,0x04,0x01,0x00,0x00,0x00,0x00,0x2C,0x00,0x00,
          0x00,0x00,0x01,0x00,0x01,0x00,0x00,0x02,0x02,0x44,
          0x01,0x00,0x3B
        ]), { status: 200, headers: { 'Content-Type': 'image/gif' } });
      });
    })
  );
}

async function trimTileCache(cache) {
  try {
    const keys = await cache.keys();
    if (keys.length > MAX_TILE_CACHE_SIZE) {
      // Delete oldest entries (first in = first out)
      const toDelete = keys.slice(0, keys.length - MAX_TILE_CACHE_SIZE);
      await Promise.all(toDelete.map((key) => cache.delete(key)));
    }
  } catch (e) {
    // Non-fatal — just log
    console.warn('[SW] Tile cache trim failed:', e);
  }
}

function isStaticAsset(url) {
  return (
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.jpeg') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.gif') ||
    url.pathname.endsWith('.webp') ||
    url.pathname.endsWith('.woff') ||
    url.pathname.endsWith('.woff2') ||
    url.pathname.endsWith('.ttf') ||
    url.pathname.endsWith('.ico') ||
    url.pathname.startsWith('/icons/')
  );
}

function isApiRequest(url) {
  return (
    url.pathname.startsWith('/api/') ||
    url.pathname.includes('/rest/v1/') ||
    url.hostname.includes('open-meteo') ||
    url.hostname.includes('openweathermap') ||
    url.hostname.includes('nominatim')
  );
}

// ─── Message handling ───────────────────────────────────────────────────────
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }

  // Prefetch tiles for offline viewing: { type: 'PREFETCH_TILES', urls: string[] }
  if (event.data && event.data.type === 'PREFETCH_TILES') {
    const urls = event.data.urls || [];
    event.waitUntil(
      caches.open(TILES_CACHE).then((cache) =>
        Promise.allSettled(
          urls.map((url) =>
            cache.match(url).then((existing) => {
              if (existing) return; // Already cached
              return fetch(url).then((res) => {
                if (res.ok) cache.put(url, res);
              });
            })
          )
        ).then((results) => {
          const cached = results.filter((r) => r.status === 'fulfilled').length;
          if (event.source) {
            event.source.postMessage({
              type: 'PREFETCH_COMPLETE',
              total: urls.length,
              cached,
            });
          }
        })
      )
    );
    return;
  }

  // Clear tile cache for a specific drawing: { type: 'CLEAR_DRAWING_TILES', drawingId: string }
  if (event.data && event.data.type === 'CLEAR_DRAWING_TILES') {
    const drawingId = event.data.drawingId;
    event.waitUntil(
      caches.open(TILES_CACHE).then(async (cache) => {
        const keys = await cache.keys();
        const toDelete = keys.filter((req) => req.url.includes(drawingId));
        await Promise.all(toDelete.map((key) => cache.delete(key)));
      })
    );
    return;
  }
});
