import { useState, useCallback, useRef } from 'react';
import { captureException } from '../lib/errorTracking';

interface RetryConfig {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
}

interface RetryState<T> {
  data: T | null;
  error: Error | null;
  loading: boolean;
  retryCount: number;
  execute: (...args: any[]) => Promise<T | null>;
  reset: () => void;
}

/**
 * Hook for executing async operations with exponential backoff retry.
 * Useful for network requests that may fail transiently.
 */
export function useRetry<T>(
  fn: (...args: any[]) => Promise<T>,
  config: RetryConfig = {}
): RetryState<T> {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 10000,
    backoffMultiplier = 2,
  } = config;

  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const abortRef = useRef(false);

  const execute = useCallback(
    async (...args: any[]): Promise<T | null> => {
      setLoading(true);
      setError(null);
      abortRef.current = false;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        if (abortRef.current) break;

        try {
          const result = await fn(...args);
          setData(result);
          setRetryCount(attempt);
          setLoading(false);
          return result;
        } catch (err) {
          const error = err instanceof Error ? err : new Error(String(err));

          if (attempt === maxRetries) {
            setError(error);
            setRetryCount(attempt);
            setLoading(false);
            captureException(error, { action: 'retry_exhausted', extra: { maxRetries, attempt } });
            return null;
          }

          // Exponential backoff with jitter
          const delay = Math.min(
            baseDelay * Math.pow(backoffMultiplier, attempt) + (crypto.getRandomValues(new Uint16Array(1))[0] % 500),
            maxDelay
          );

          setRetryCount(attempt + 1);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }

      setLoading(false);
      return null;
    },
    [fn, maxRetries, baseDelay, maxDelay, backoffMultiplier]
  );

  const reset = useCallback(() => {
    abortRef.current = true;
    setData(null);
    setError(null);
    setLoading(false);
    setRetryCount(0);
  }, []);

  return { data, error, loading, retryCount, execute, reset };
}

/**
 * Hook to detect online/offline status with debouncing.
 */
export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useState(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  });

  return isOnline;
}
