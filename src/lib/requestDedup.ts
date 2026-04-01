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

// Generate a cache key from a query's table + filter parameters
export function queryKey(table: string, filters: Record<string, unknown>): string {
  return `${table}:${JSON.stringify(filters)}`
}
