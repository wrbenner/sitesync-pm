// SiteSync PM — Real User Monitoring
// Tracks Core Web Vitals (LCP, FID, CLS, INP, TTFB) and custom performance metrics.
// Sends to both Sentry Performance and PostHog for dual visibility.

import * as Sentry from '@sentry/react'

// ── Types ───────────────────────────────────────────────

interface MetricEntry {
  name: string
  value: number
  rating?: 'good' | 'needs-improvement' | 'poor'
}

type MetricCallback = (metric: MetricEntry) => void

// ── Core Web Vitals via PerformanceObserver ─────────────

function observeWebVital(type: string, cb: MetricCallback) {
  if (typeof PerformanceObserver === 'undefined') return

  try {
    const po = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const value = type === 'CLS'
          ? (entry as PerformanceEntry & { value?: number }).value ?? 0
          : entry.startTime ?? (entry as PerformanceEntry & { processingStart?: number }).processingStart ?? entry.duration

        cb({ name: type, value })
      }
    })

    const entryTypeMap: Record<string, string> = {
      LCP: 'largest-contentful-paint',
      FID: 'first-input',
      CLS: 'layout-shift',
      INP: 'event',
      TTFB: 'navigation',
    }

    const entryType = entryTypeMap[type]
    if (entryType) {
      po.observe({ type: entryType, buffered: true })
    }
  } catch {
    // PerformanceObserver not supported for this type
  }
}

// ── Rating Thresholds ───────────────────────────────────

function rateMetric(name: string, value: number): 'good' | 'needs-improvement' | 'poor' {
  const thresholds: Record<string, [number, number]> = {
    LCP: [2500, 4000],
    FID: [100, 300],
    CLS: [0.1, 0.25],
    INP: [200, 500],
    TTFB: [800, 1800],
  }

  const t = thresholds[name]
  if (!t) return 'good'
  if (value <= t[0]) return 'good'
  if (value <= t[1]) return 'needs-improvement'
  return 'poor'
}

// ── Sink: send to Sentry + PostHog ──────────────────────

function reportMetric(metric: MetricEntry) {
  const rating = metric.rating ?? rateMetric(metric.name, metric.value)

  // Sentry custom measurement
  Sentry.setMeasurement(metric.name, metric.value, metric.name === 'CLS' ? '' : 'millisecond')

  // PostHog event (lazy import to avoid blocking init)
  import('./analytics').then((mod) => {
    mod.default.capture('web_vital', {
      metric_name: metric.name,
      metric_value: metric.value,
      metric_rating: rating,
    })
  }).catch(() => {})
}

// ── Custom SiteSync Metrics ─────────────────────────────

/** Track how long a mutation takes from submit to server response */
export function trackMutationLatency(entity: string, action: string, durationMs: number) {
  reportMetric({ name: 'mutation_latency', value: durationMs })

  Sentry.addBreadcrumb({
    category: 'perf',
    message: `${action} ${entity}: ${Math.round(durationMs)}ms`,
    level: 'info',
  })
}

/** Track AI copilot response time */
export function trackAIResponseTime(durationMs: number, model?: string) {
  reportMetric({ name: 'ai_response_time', value: durationMs })

  import('./analytics').then((mod) => {
    mod.default.capture('ai_response_time', {
      duration_ms: durationMs,
      model: model ?? 'unknown',
    })
  }).catch(() => {})
}

/** Track offline sync cycle duration */
export function trackOfflineSyncDuration(durationMs: number, itemCount: number) {
  reportMetric({ name: 'offline_sync_duration', value: durationMs })

  import('./analytics').then((mod) => {
    mod.default.capture('offline_sync', {
      duration_ms: durationMs,
      item_count: itemCount,
    })
  }).catch(() => {})
}

/** Track drawing/plan load time */
export function trackDrawingLoadTime(durationMs: number, fileSize?: number) {
  reportMetric({ name: 'drawing_load_time', value: durationMs })

  import('./analytics').then((mod) => {
    mod.default.capture('drawing_load', {
      duration_ms: durationMs,
      file_size: fileSize,
    })
  }).catch(() => {})
}

/** Track search query performance */
export function trackSearchTime(durationMs: number, resultCount: number, queryLength: number) {
  reportMetric({ name: 'search_query_time', value: durationMs })

  import('./analytics').then((mod) => {
    mod.default.capture('search_performance', {
      duration_ms: durationMs,
      result_count: resultCount,
      query_length: queryLength,
    })
  }).catch(() => {})
}

/** Track per-page Time to Interactive */
export function trackPageTTI(page: string, durationMs: number) {
  reportMetric({ name: `tti_${page}`, value: durationMs })
}

// ── Generic timing helper ───────────────────────────────

/** Start a timer; returns a function to call when the operation completes. */
export function startTimer(): () => number {
  const start = performance.now()
  return () => performance.now() - start
}

// ── Initialize ──────────────────────────────────────────

export function initVitals() {
  observeWebVital('LCP', reportMetric)
  observeWebVital('FID', reportMetric)
  observeWebVital('CLS', reportMetric)
  observeWebVital('INP', reportMetric)

  // TTFB from Navigation Timing API (more reliable)
  if (typeof performance !== 'undefined' && performance.getEntriesByType) {
    try {
      const [nav] = performance.getEntriesByType('navigation') as unknown as PerformanceNavigationTiming[]
      if (nav) {
        reportMetric({ name: 'TTFB', value: nav.responseStart - nav.requestStart })
      }
    } catch {
      // Fallback: observe
      observeWebVital('TTFB', reportMetric)
    }
  }
}
