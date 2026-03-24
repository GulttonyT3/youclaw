type CachedBootstrapDocs<T> = T[]

const cache = new Map<string, CachedBootstrapDocs<unknown>>()

export function getOrLoadBootstrapDocs<T>(params: {
  cacheKey: string
  loader: () => T[]
}): T[] {
  const existing = cache.get(params.cacheKey) as CachedBootstrapDocs<T> | undefined
  if (existing) {
    return existing
  }

  const docs = params.loader()
  cache.set(params.cacheKey, docs)
  return docs
}

export function clearBootstrapSnapshot(cacheKey: string): void {
  cache.delete(cacheKey)
}

export function clearBootstrapSnapshotOnSessionRollover(params: {
  cacheKey?: string
  previousSessionId?: string | null
  nextSessionId?: string | null
}): void {
  if (!params.cacheKey) return
  if (!params.previousSessionId || !params.nextSessionId) return
  if (params.previousSessionId === params.nextSessionId) return
  clearBootstrapSnapshot(params.cacheKey)
}

export function clearAllBootstrapSnapshots(): void {
  cache.clear()
}
