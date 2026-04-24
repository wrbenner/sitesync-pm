/**
 * Service Worker Registration Utility
 *
 * Registers the service worker and shows a one-tap Sonner toast when a new
 * SW version is waiting. Tapping Reload posts SKIP_WAITING to the waiting
 * worker and reloads the page once it takes control.
 *
 * Call registerServiceWorker() from main.tsx after the app mounts.
 */

import { toast } from 'sonner';

// Module-scoped flag so we only reload once per SW transition.
let isReloading = false;

export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) {
    console.log('[SW] Service workers are not supported in this browser.');
    return;
  }

  // Skip SW in development — Vite HMR and service worker caching conflict
  if (import.meta.env.DEV) {
    // Unregister any existing SW in dev mode
    navigator.serviceWorker.getRegistrations().then(regs =>
      regs.forEach(r => r.unregister()),
    );
    return;
  }

  // When the waiting SW takes over (via SKIP_WAITING), reload so the user
  // sees the new bundle immediately. Guard against double-reload.
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (isReloading) return;
    isReloading = true;
    window.location.reload();
  });

  window.addEventListener('load', async () => {
    try {
      const base = import.meta.env.BASE_URL || '/';
      const registration = await navigator.serviceWorker.register(`${base}sw.js`, {
        scope: base,
      });

      console.log('[SW] Service worker registered successfully.', registration.scope);

      // If an update is already waiting at registration time (page was opened
      // while a previous tab had triggered install), surface the prompt now.
      if (registration.waiting && navigator.serviceWorker.controller) {
        showUpdatePrompt(registration);
      }

      // Check for updates during this session
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;

        console.log('[SW] New service worker installing...');

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed') {
            if (navigator.serviceWorker.controller) {
              // There is an existing SW — a new version is available
              console.log('[SW] New version available. Refresh to update.');
              dispatchUpdateEvent(registration);
              showUpdatePrompt(registration);
            } else {
              // First-time install — content is cached for offline
              console.log('[SW] Content cached for offline use.');
            }
          }
        });
      });
    } catch (error) {
      console.error('[SW] Service worker registration failed:', error);
    }
  });
}

/**
 * Dispatch a custom event so legacy listeners can also react. Retained for
 * backward compatibility — the built-in Sonner prompt below is the primary UX.
 */
function dispatchUpdateEvent(registration: ServiceWorkerRegistration): void {
  const event = new CustomEvent('sw-update-available', {
    detail: { registration },
  });
  window.dispatchEvent(event);
}

/**
 * One-tap update prompt: persistent Sonner toast with a Reload action.
 * The toast is deduped by id so re-firing updatefound doesn't stack toasts.
 */
function showUpdatePrompt(registration: ServiceWorkerRegistration): void {
  toast('New version available', {
    id: 'sw-update',
    description: 'Tap Reload to get the latest bundle.',
    duration: Infinity,
    action: {
      label: 'Reload',
      onClick: () => applyUpdate(registration),
    },
  });
}

/**
 * Tell the waiting service worker to skip waiting and take control.
 * Call this when the user accepts the update prompt.
 */
export function applyUpdate(registration: ServiceWorkerRegistration): void {
  registration.waiting?.postMessage('SKIP_WAITING');
}
