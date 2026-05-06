// Posthog is loaded asynchronously after the initial render so that the
// 52 KB gzipped library doesn't sit on the cold-open critical path. Capture
// calls made before posthog has finished loading are queued and flushed once
// the real client is ready. Day 30 — Lap 1 acceptance gate.

type CaptureProps = Record<string, unknown> | undefined
type RealPosthog = { capture: (event: string, props?: CaptureProps) => void }

let realPosthog: RealPosthog | null = null
const queue: Array<() => void> = []

const stub = {
  capture(event: string, props?: CaptureProps) {
    if (realPosthog) {
      realPosthog.capture(event, props)
    } else {
      queue.push(() => realPosthog?.capture(event, props))
    }
  },
}

const key = import.meta.env.VITE_POSTHOG_KEY || ''
if (typeof window !== 'undefined' && key) {
  const loadPosthog = async () => {
    try {
      const mod = await import('posthog-js')
      const ph = mod.default
      ph.init(key, {
        api_host: 'https://us.i.posthog.com',
        capture_pageview: true,
        capture_pageleave: true,
        loaded: (client) => {
          if (import.meta.env.DEV) client.opt_out_capturing()
        },
      })
      realPosthog = ph as unknown as RealPosthog
      while (queue.length > 0) queue.shift()!()
    } catch {
      queue.length = 0
    }
  }
  const idle = (window as Window & { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => void }).requestIdleCallback
  if (idle) idle(loadPosthog, { timeout: 3000 })
  else setTimeout(loadPosthog, 1500)
}

export default stub
