type Bucket = {
  count: number
  resetAt: number
}

const globalRateLimit = globalThis as unknown as {
  tochukwuRateLimitBuckets?: Map<string, Bucket>
}

const buckets = globalRateLimit.tochukwuRateLimitBuckets ?? new Map<string, Bucket>()
globalRateLimit.tochukwuRateLimitBuckets = buckets

const MAX_BUCKETS = 10_000

export function consumeServerRateLimit(input: {
  key: string
  limit: number
  windowMs: number
}) {
  const now = Date.now()
  const key = String(input.key || "").slice(0, 300)
  const limit = Math.max(1, Math.trunc(input.limit))
  const windowMs = Math.max(1_000, Math.trunc(input.windowMs))
  const current = buckets.get(key)

  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    trimExpiredBuckets(now)
    return { allowed: true, retryAfterSeconds: 0 }
  }

  current.count += 1
  return {
    allowed: current.count <= limit,
    retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000))
  }
}

function trimExpiredBuckets(now: number) {
  if (buckets.size <= MAX_BUCKETS) return
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key)
    if (buckets.size <= MAX_BUCKETS) return
  }
  while (buckets.size > MAX_BUCKETS) {
    const oldestKey = buckets.keys().next().value
    if (typeof oldestKey !== "string") break
    buckets.delete(oldestKey)
  }
}
