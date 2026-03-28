/**
 * Error tracking and monitoring service.
 * Provides a Sentry-compatible interface that works in both
 * connected (Sentry configured) and standalone (local logging) modes.
 */

export interface ErrorContext {
  userId?: string;
  projectId?: string;
  page?: string;
  action?: string;
  extra?: Record<string, unknown>;
}

interface ErrorTrackingConfig {
  dsn?: string;
  environment: string;
  release?: string;
  enabled: boolean;
}

const config: ErrorTrackingConfig = {
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE || 'development',
  release: import.meta.env.VITE_APP_VERSION || '0.0.0',
  enabled: Boolean(import.meta.env.VITE_SENTRY_DSN),
};

// In-memory error buffer for when Sentry is not configured
const errorBuffer: { error: Error; context: ErrorContext; timestamp: number }[] = [];
const MAX_BUFFER_SIZE = 100;

/**
 * Initialize error tracking. Call once at app startup.
 */
export function initErrorTracking() {
  // Global unhandled error handler
  window.addEventListener('error', (event) => {
    captureException(event.error || new Error(event.message), {
      action: 'unhandled_error',
      extra: { filename: event.filename, lineno: event.lineno, colno: event.colno },
    });
  });

  // Global unhandled promise rejection handler
  window.addEventListener('unhandledrejection', (event) => {
    const error = event.reason instanceof Error ? event.reason : new Error(String(event.reason));
    captureException(error, { action: 'unhandled_promise_rejection' });
  });

  if (config.enabled) {
    console.info(`[ErrorTracking] Sentry DSN configured for ${config.environment}`);
  } else {
    console.info('[ErrorTracking] Running in local logging mode (no Sentry DSN configured)');
  }
}

/**
 * Capture an exception with optional context.
 */
export function captureException(error: Error, context: ErrorContext = {}) {
  // Always log to console in development
  if (config.environment === 'development') {
    console.error('[ErrorTracking]', error.message, context);
  }

  // Buffer errors locally
  errorBuffer.push({ error, context, timestamp: Date.now() });
  if (errorBuffer.length > MAX_BUFFER_SIZE) {
    errorBuffer.splice(0, errorBuffer.length - MAX_BUFFER_SIZE);
  }

  // If Sentry is configured, we would send here
  // When Sentry SDK is added: Sentry.captureException(error, { extra: context });
}

/**
 * Capture a breadcrumb (user action or navigation event).
 */
export function addBreadcrumb(message: string, category: string, data?: Record<string, unknown>) {
  if (config.environment === 'development') {
    console.debug(`[Breadcrumb] ${category}: ${message}`, data);
  }
  // When Sentry SDK is added: Sentry.addBreadcrumb({ message, category, data });
}

/**
 * Set user context for all future error reports.
 */
export function setUser(userId: string) {
  // When Sentry SDK is added: Sentry.setUser({ id: userId });
  if (config.environment === 'development') {
    console.debug(`[ErrorTracking] User set: ${userId}`);
  }
}

/**
 * Get buffered errors (useful for admin debugging panel).
 */
export function getErrorBuffer() {
  return [...errorBuffer];
}

/**
 * Wrap an async function with automatic error capture.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function withErrorTracking<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  context: ErrorContext
): T {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (async (...args: any[]) => {
    try {
      return await fn(...args);
    } catch (error) {
      captureException(error instanceof Error ? error : new Error(String(error)), context);
      throw error;
    }
  }) as T;
}
