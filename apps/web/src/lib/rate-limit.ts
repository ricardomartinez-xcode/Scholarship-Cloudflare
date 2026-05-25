type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();
const DEFAULT_MAX_BUCKETS = 5_000;
const CLEANUP_INTERVAL_MS = 60_000;
let lastCleanupAt = 0;

function readMaxBuckets() {
  const parsed = Number(process.env.RATE_LIMIT_MAX_BUCKETS);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_BUCKETS;
}

function cleanupBuckets(now: number, maxBuckets = readMaxBuckets()) {
  if (buckets.size < maxBuckets && now - lastCleanupAt < CLEANUP_INTERVAL_MS) return;
  lastCleanupAt = now;

  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }

  while (buckets.size > maxBuckets) {
    const oldestKey = buckets.keys().next().value as string | undefined;
    if (!oldestKey) break;
    buckets.delete(oldestKey);
  }
}

function pruneOverflow() {
  const maxBuckets = readMaxBuckets();
  while (buckets.size > maxBuckets) {
    const oldestKey = buckets.keys().next().value as string | undefined;
    if (!oldestKey) break;
    buckets.delete(oldestKey);
  }
}

export function checkRateLimit(
  key: string,
  options?: { limit?: number; windowMs?: number }
) {
  const limit = options?.limit ?? 5;
  const windowMs = options?.windowMs ?? 60_000;
  const now = Date.now();
  cleanupBuckets(now);
  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    pruneOverflow();
    return { ok: true as const, remaining: limit - 1 };
  }

  if (current.count >= limit) {
    return {
      ok: false as const,
      retryAfterMs: Math.max(0, current.resetAt - now),
    };
  }

  current.count += 1;
  buckets.set(key, current);
  pruneOverflow();
  return { ok: true as const, remaining: Math.max(0, limit - current.count) };
}

export function __getRateLimitBucketCountForTests() {
  return buckets.size;
}

export function __resetRateLimitForTests() {
  buckets.clear();
  lastCleanupAt = 0;
}

