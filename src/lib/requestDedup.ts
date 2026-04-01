// In-flight request deduplication.
// If the same query is already in-flight, return the existing promise instead of making a new request.

const inflightRequests = new Map<string, Promise<unknown>>()

export function dedup<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existing = inflightRequests.get(key)
  if (existing) return existing as Promise<T>

  const promise = fn().finally(() => {
    inflightRequests.delete(key)
  })

  inflightRequests.set(key, promise)
  return promise
}

// TTL-aware deduplication: returns a cached resolved value until it expires,
// then falls through to in-flight dedup for the next fetch.
interface TtlEntry<T> { value: T; expiresAt: number }
const ttlCache = new Map<string, TtlEntry<unknown>>()

export function dedupTtl<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const cached = ttlCache.get(key)
  if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.value as T)

  return dedup(key, async () => {
    const value = await fn()
    ttlCache.set(key, { value, expiresAt: Date.now() + ttlMs })
    return value
  })
}

// Generate a cache key from a query's table + filter parameters
export function queryKey(table: string, filters: Record<string, unknown>): string {
  return `${table}:${JSON.stringify(filters)}`
}
